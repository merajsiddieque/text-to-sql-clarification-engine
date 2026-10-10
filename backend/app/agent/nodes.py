from typing import Dict, Any
from app.agent.state import TextToSQLState
from app.agent.llm_client import llm_client
from app.validator.sql_validator import SQLValidator
from app.db.manager import db_manager


def classify_ambiguity_node(state: TextToSQLState) -> Dict[str, Any]:
    """
    Evaluates whether the incoming query is ambiguous.
    If the user has already selected a clarification option, passes through immediately.
    """
    if state.get("selected_clarification"):
        return {
            "is_ambiguous": False,
            "status": "executing"
        }

    schema_context = state.get("schema_context", "")
    query = state.get("natural_query", "")
    
    ambiguity_check = llm_client.detect_ambiguity(query, schema_context)
    
    if ambiguity_check.is_ambiguous:
        return {
            "is_ambiguous": True,
            "ambiguity_reason": ambiguity_check.reason,
            "clarification_question": ambiguity_check.clarification_question,
            "clarification_options": ambiguity_check.options,
            "status": "needs_clarification",
            "status_message": "Clarification required to resolve business ambiguity."
        }
    
    return {
        "is_ambiguous": False,
        "status": "executing"
    }


def generate_sql_node(state: TextToSQLState) -> Dict[str, Any]:
    """
    Generates dialect-specific read-only SQL.
    """
    query = state.get("natural_query", "")
    schema_context = state.get("schema_context", "")
    dialect = state.get("dialect", "sqlite")
    clarification = state.get("selected_clarification")

    raw_sql = llm_client.generate_sql(
        query=query,
        schema_context=schema_context,
        dialect=dialect,
        clarification_context=clarification
    )

    return {
        "generated_sql": raw_sql,
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", 2)
    }


def validate_sql_node(state: TextToSQLState) -> Dict[str, Any]:
    """
    Applies SQLGlot AST validation, read-only enforcement, safety checks, and schema grounding.
    """
    raw_sql = state.get("generated_sql", "")
    dialect = state.get("dialect", "sqlite")
    connection_id = state.get("connection_id", "demo-ecommerce")
    
    try:
        schema = db_manager.get_schema(connection_id)
    except Exception:
        schema = None

    validation = SQLValidator.validate_and_sanitize(
        sql=raw_sql,
        dialect=dialect,
        schema=schema
    )

    if validation.is_valid:
        return {
            "sanitized_sql": validation.sanitized_sql,
            "validation_result": validation.model_dump(),
            "validation_errors": []
        }
    else:
        return {
            "validation_result": validation.model_dump(),
            "validation_errors": validation.errors
        }


def repair_sql_node(state: TextToSQLState) -> Dict[str, Any]:
    """
    Self-healing node: prompts LLM with the failed query and exact error message to recover.
    """
    current_retries = state.get("retry_count", 0) + 1
    failed_sql = state.get("generated_sql", "")
    dialect = state.get("dialect", "sqlite")
    schema_context = state.get("schema_context", "")

    # Combine validation or execution errors
    errors = state.get("validation_errors", [])
    if state.get("execution_error"):
        errors.append(state.get("execution_error"))
    error_msg = "; ".join(errors)

    repaired_sql = llm_client.repair_sql(
        failed_sql=failed_sql,
        error_message=error_msg,
        schema_context=schema_context,
        dialect=dialect
    )

    return {
        "generated_sql": repaired_sql,
        "retry_count": current_retries,
        "execution_error": None
    }


def execute_sql_node(state: TextToSQLState) -> Dict[str, Any]:
    """
    Executes the validated SQL query against the target database adapter with limits and timeouts.
    """
    connection_id = state.get("connection_id", "demo-ecommerce")
    adapter = db_manager.get_adapter(connection_id)
    
    if not adapter:
        return {
            "execution_error": f"Database adapter for '{connection_id}' not found.",
            "status": "failed"
        }

    sanitized_sql = state.get("sanitized_sql", "")
    exec_result = adapter.execute_query(sanitized_sql)

    if exec_result.error:
        return {
            "execution_error": exec_result.error,
            "execution_result": exec_result.model_dump()
        }

    return {
        "execution_result": exec_result.model_dump(),
        "execution_error": None
    }


def summarize_results_node(state: TextToSQLState) -> Dict[str, Any]:
    """
    Generates plain-English executive summary and selects optimal chart visualization.
    """
    exec_dict = state.get("execution_result", {})
    columns = exec_dict.get("columns", [])
    rows = exec_dict.get("rows", [])
    query = state.get("natural_query", "")

    summary, vis_type = llm_client.summarize_results(query, columns, rows)

    return {
        "summary": summary,
        "visualization_type": vis_type,
        "status": "success",
        "status_message": "Query completed successfully."
    }
