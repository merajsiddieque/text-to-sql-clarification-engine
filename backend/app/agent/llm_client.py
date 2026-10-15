import json
import re
import urllib.request
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field
from app.core.config import settings


class AmbiguityResult(BaseModel):
    is_ambiguous: bool
    reason: Optional[str] = None
    clarification_question: Optional[str] = None
    options: List[Dict[str, str]] = Field(default_factory=list)


# Fallback ambiguity rules for when LLM is unreachable
AMBIGUITY_RULES = [
    {
        "keywords": ["best", "top performing", "most popular", "highest performing"],
        "target": "product",
        "reason": "Performance can be measured in multiple distinct ways (revenue, quantity sold, or customer ratings).",
        "question": "How would you like to define performance?",
        "options": [
            {"id": "revenue", "label": "Total Revenue", "description": "Rank by total gross sales dollars generated."},
            {"id": "units", "label": "Units Sold", "description": "Rank by total quantity of items purchased."},
            {"id": "rating", "label": "Average Rating", "description": "Rank by average review score (1-5 stars)."}
        ]
    },
    {
        "keywords": ["top customer", "best customer", "valuable customer"],
        "target": "customer",
        "reason": "Customer value can be determined by total spend, order count, or recent activity.",
        "question": "How should customer value be measured?",
        "options": [
            {"id": "total_spend", "label": "Total Spend", "description": "Sum of total order amounts across all time."},
            {"id": "order_frequency", "label": "Order Count", "description": "Total number of completed orders placed."},
            {"id": "recent_spend", "label": "Recent Spend", "description": "Total spend in the last 90 days."}
        ]
    },
    {
        "keywords": ["active customer", "active user"],
        "target": "customer",
        "reason": "Active customers could refer to account status flag or purchase activity.",
        "question": "How should active customers be filtered?",
        "options": [
            {"id": "account_status", "label": "Account Status Flag", "description": "Customers where account_status = 'active'."
            },
            {"id": "recent_orders", "label": "Recent Purchase", "description": "Customers who completed an order within the last 30 days."}
        ]
    }
]


class LLMClient:
    """
    Production Gemini LLM Client for Text-to-SQL reasoning, query synthesis,
    ambiguity disambiguation, and self-repairing SQL.
    Supports all connected and uploaded databases (.sql, .sqlite, .db, .dump, .csv, .tsv, .bak, .sql.gz).
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.models = settings.LLM_FALLBACK_MODELS

    def _call_gemini(self, prompt: str, timeout: int = 8) -> Optional[str]:
        """Direct REST caller for Gemini with multi-model fallback."""
        if not self.api_key:
            return None

        payload = json.dumps({
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "topP": 0.95,
            }
        }).encode("utf-8")

        for model_name in self.models:
            clean_model = model_name.replace("models/", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={self.api_key}"
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return parts[0].get("text", "").strip()
            except Exception as e:
                # Try next candidate model
                continue

        return None

    def detect_ambiguity(self, query: str, schema_context: str) -> AmbiguityResult:
        """
        Uses Gemini LLM to decide if the user's natural query contains business ambiguity.
        """
        gemini_prompt = f"""
You are an expert SQL Business Analyst. Determine if the user's question contains business ambiguity that requires clarification before writing SQL.
Database Schema Context:
{schema_context}

User Question: "{query}"

Rules:
1. If the question is clear and can be answered directly by the schema, set "is_ambiguous": false.
2. If vague terms like 'best', 'top', 'active', 'good' have multiple conflicting definitions in this database schema, set "is_ambiguous": true and provide 2-3 specific clarification options.
3. Respond ONLY in valid JSON matching this exact structure:
{{
    "is_ambiguous": false,
    "reason": null,
    "clarification_question": null,
    "options": []
}}
"""
        response_text = self._call_gemini(gemini_prompt)
        if response_text:
            try:
                cleaned = re.sub(r"^```(?:json)?\s*", "", response_text, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s*```$", "", cleaned)
                data = json.loads(cleaned.strip())
                return AmbiguityResult(**data)
            except Exception:
                pass

        # Offline / heuristic fallback
        lower_q = query.lower()
        for rule in AMBIGUITY_RULES:
            for kw in rule["keywords"]:
                if kw in lower_q:
                    return AmbiguityResult(
                        is_ambiguous=True,
                        reason=rule["reason"],
                        clarification_question=rule["question"],
                        options=rule["options"]
                    )

        return AmbiguityResult(is_ambiguous=False)

    def generate_sql(
        self,
        query: str,
        schema_context: str,
        dialect: str = "sqlite",
        clarification_context: Optional[str] = None
    ) -> str:
        """
        Uses Gemini LLM to analyze the schema of any connected or uploaded database,
        decide which tables and columns to query, and generate accurate SQL.
        """
        clarification_text = f"User Clarification Decision: {clarification_context}\n" if clarification_context else ""
        gemini_prompt = f"""
You are a Principal Database Architect and SQL Generator for {dialect.upper()}.
Task: Write a precise, read-only SQL query to answer the user's question.

Database Schema (Tables, Columns, Types, and Sample Data):
{schema_context}

{clarification_text}
User Question: "{query}"

Strict Rules:
1. Return ONLY the raw SQL query. No explanations, no markdown backticks, no markdown formatting.
2. The query MUST be strictly a read-only SELECT statement.
3. Use only tables and columns that exist in the provided Database Schema.
4. If querying an uploaded table or custom database, match the exact column names given in the schema.
5. If table or column names contain spaces or special characters, wrap them in double quotes ("table", "column").
6. Ensure syntax is 100% compatible with {dialect.upper()}.
7. Add a reasonable LIMIT clause (e.g. LIMIT 50 or 100) if no limit is specified.
"""
        response_text = self._call_gemini(gemini_prompt)
        if response_text:
            cleaned = re.sub(r"^```(?:sql)?\s*", "", response_text, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned).strip()
            if cleaned:
                return cleaned

        # Dynamic fallback for uploaded databases or demo DB
        lower_q = query.lower()
        # If schema contains tables, query first available table
        tables_match = re.findall(r"Table:\s*([a-zA-Z0-9_]+)", schema_context)
        if tables_match:
            first_tbl = tables_match[0]
            if "count" in lower_q or "how many" in lower_q or "total" in lower_q:
                return f'SELECT COUNT(*) AS total_records FROM "{first_tbl}";'
            return f'SELECT * FROM "{first_tbl}" LIMIT 25;'

        return "SELECT 1;"

    def summarize_results(
        self,
        query: str,
        columns: List[str],
        rows: List[Dict[str, Any]]
    ) -> Tuple[str, str]:
        """
        Uses Gemini LLM to analyze the fetched query result records and produce
        an executive summary with suggested visualization type (table, bar, line, pie).
        """
        if not rows:
            return "Query executed successfully, but returned 0 records.", "table"

        # Prepare a sample of up to 10 rows for LLM summary
        sample_rows = rows[:10]
        gemini_prompt = f"""
You are a Senior Data Analyst. Summarize the query results into a concise executive finding.
User Question: "{query}"
Returned Columns: {columns}
Sample Rows ({len(sample_rows)} of {len(rows)}):
{json.dumps(sample_rows, default=str)}

Respond in valid JSON with:
{{
  "summary": "1-2 sentence high-level takeaway summarizing the numbers and business insight.",
  "visualization_type": "table" | "bar" | "line" | "pie"
}}
"""
        response_text = self._call_gemini(gemini_prompt, timeout=12)
        if response_text:
            try:
                cleaned = re.sub(r"^```(?:json)?\s*", "", response_text, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s*```$", "", cleaned).strip()
                parsed = json.loads(cleaned)
                return parsed.get("summary", ""), parsed.get("visualization_type", "table")
            except Exception:
                pass

        # Clean fallback summary
        count = len(rows)
        vis_type = "table"
        if len(columns) == 2 and any(isinstance(rows[0].get(c), (int, float)) for c in columns):
            vis_type = "bar"

        return f"Successfully retrieved {count} record{'s' if count != 1 else ''} matching your query.", vis_type

    def repair_sql(
        self,
        failed_sql: str,
        error_message: str,
        schema_context: str,
        dialect: str = "sqlite"
    ) -> str:
        """
        Uses Gemini LLM to self-heal a failed SQL query by correcting syntax or column names.
        """
        gemini_prompt = f"""
You are an expert SQL debugger. The following SQL query failed with an execution error.
Database Schema:
{schema_context}

Failed SQL Query:
{failed_sql}

Error Message:
{error_message}

Task: Repair the SQL query so that it executes successfully on {dialect.upper()}.
Rules:
1. Return ONLY the repaired raw SQL statement.
2. Do not wrap in markdown quotes or explanations.
"""
        response_text = self._call_gemini(gemini_prompt)
        if response_text:
            cleaned = re.sub(r"^```(?:sql)?\s*", "", response_text, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned).strip()
            if cleaned:
                return cleaned

        return failed_sql


# Global singleton instance
llm_client = LLMClient()
