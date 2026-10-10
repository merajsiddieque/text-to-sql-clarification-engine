from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.agent.graph import text_to_sql_agent
from app.validator.sql_validator import SQLValidator, SQLValidationResult
from app.db.manager import db_manager

router = APIRouter(prefix="/query", tags=["query"])


class QueryExecutionRequest(BaseModel):
    natural_query: str
    connection_id: str = "demo-ecommerce"
    selected_clarification: Optional[str] = None
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)


class QueryValidationRequest(BaseModel):
    sql: str
    connection_id: str = "demo-ecommerce"
    dialect: Optional[str] = None


@router.post("")
def execute_natural_query(req: QueryExecutionRequest):
    """
    Executes the full Text-to-SQL workflow via LangGraph:
    Ambiguity classification -> Clarification OR (SQL generation -> SQLGlot validation -> Safe execution -> Summary).
    """
    adapter = db_manager.get_adapter(req.connection_id)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Connection '{req.connection_id}' not found.")

    schema = db_manager.get_schema(req.connection_id)
    schema_context = schema.to_prompt_context(include_samples=True)

    initial_state = {
        "natural_query": req.natural_query,
        "connection_id": req.connection_id,
        "conversation_history": req.conversation_history,
        "schema_context": schema_context,
        "dialect": adapter.dialect,
        "selected_clarification": req.selected_clarification,
        "retry_count": 0,
        "max_retries": 2
    }

    try:
        final_state = text_to_sql_agent.invoke(initial_state)

        # Ambiguous response requiring clarification
        if final_state.get("is_ambiguous") and not final_state.get("selected_clarification"):
            return {
                "status": "needs_clarification",
                "is_ambiguous": True,
                "ambiguity_reason": final_state.get("ambiguity_reason"),
                "clarification_question": final_state.get("clarification_question"),
                "clarification_options": final_state.get("clarification_options"),
                "natural_query": req.natural_query,
                "connection_id": req.connection_id
            }

        # Successful or failed query
        return {
            "status": final_state.get("status", "success"),
            "natural_query": req.natural_query,
            "generated_sql": final_state.get("generated_sql"),
            "sanitized_sql": final_state.get("sanitized_sql"),
            "validation_result": final_state.get("validation_result"),
            "execution_result": final_state.get("execution_result"),
            "summary": final_state.get("summary"),
            "visualization_type": final_state.get("visualization_type", "table"),
            "retries_used": final_state.get("retry_count", 0),
            "error": final_state.get("execution_error") or ("; ".join(final_state.get("validation_errors", [])) if final_state.get("validation_errors") else None)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow failed: {str(e)}")


@router.post("/validate", response_model=SQLValidationResult)
def validate_sql(req: QueryValidationRequest):
    """Directly inspects and validates an arbitrary SQL query with SQLGlot AST analysis."""
    adapter = db_manager.get_adapter(req.connection_id)
    dialect = req.dialect or (adapter.dialect if adapter else "sqlite")
    
    try:
        schema = db_manager.get_schema(req.connection_id) if adapter else None
    except Exception:
        schema = None

    return SQLValidator.validate_and_sanitize(
        sql=req.sql,
        dialect=dialect,
        schema=schema
    )
