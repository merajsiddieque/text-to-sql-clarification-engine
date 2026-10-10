from langgraph.graph import StateGraph, END
from app.agent.state import TextToSQLState
from app.agent.nodes import (
    classify_ambiguity_node,
    generate_sql_node,
    validate_sql_node,
    repair_sql_node,
    execute_sql_node,
    summarize_results_node,
)


def route_after_ambiguity(state: TextToSQLState) -> str:
    """If the question is ambiguous and has no chosen clarification, stop to ask user."""
    if state.get("is_ambiguous") and not state.get("selected_clarification"):
        return END
    return "generate_sql"


def route_after_validation(state: TextToSQLState) -> str:
    """Routes to execution if query is valid, or self-repair if retries remain."""
    val_res = state.get("validation_result", {})
    if val_res.get("is_valid", False):
        return "execute_sql"
    
    current_retries = state.get("retry_count", 0)
    max_retries = state.get("max_retries", 2)
    if current_retries < max_retries:
        return "repair_sql"
    
    return END


def route_after_execution(state: TextToSQLState) -> str:
    """Routes to repair if runtime execution error occurred, else summarizes results."""
    if state.get("execution_error"):
        current_retries = state.get("retry_count", 0)
        max_retries = state.get("max_retries", 2)
        if current_retries < max_retries:
            return "repair_sql"
        return END
    
    return "summarize_results"


def build_text_to_sql_graph():
    """
    Constructs the end-to-end LangGraph state machine with clarification,
    AST safety validation, bounded self-repair, execution, and summarization.
    """
    workflow = StateGraph(TextToSQLState)

    # Add Nodes
    workflow.add_node("classify_ambiguity", classify_ambiguity_node)
    workflow.add_node("generate_sql", generate_sql_node)
    workflow.add_node("validate_sql", validate_sql_node)
    workflow.add_node("repair_sql", repair_sql_node)
    workflow.add_node("execute_sql", execute_sql_node)
    workflow.add_node("summarize_results", summarize_results_node)

    # Set Entry Point
    workflow.set_entry_point("classify_ambiguity")

    # Add Conditional Edges
    workflow.add_conditional_edges(
        "classify_ambiguity",
        route_after_ambiguity,
        {
            "generate_sql": "generate_sql",
            END: END,
        }
    )

    workflow.add_edge("generate_sql", "validate_sql")

    workflow.add_conditional_edges(
        "validate_sql",
        route_after_validation,
        {
            "execute_sql": "execute_sql",
            "repair_sql": "repair_sql",
            END: END,
        }
    )

    workflow.add_edge("repair_sql", "validate_sql")

    workflow.add_conditional_edges(
        "execute_sql",
        route_after_execution,
        {
            "repair_sql": "repair_sql",
            "summarize_results": "summarize_results",
            END: END,
        }
    )

    workflow.add_edge("summarize_results", END)

    return workflow.compile()


# Compiled agent graph
text_to_sql_agent = build_text_to_sql_graph()
