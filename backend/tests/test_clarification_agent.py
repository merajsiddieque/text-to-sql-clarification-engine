import pytest
from app.agent.graph import text_to_sql_agent
from app.db.manager import db_manager


@pytest.fixture(scope="module")
def setup_demo_db():
    from demo_data.init_demo_db import init_database
    init_database()
    return "demo-ecommerce"


def test_ambiguous_product_performance_triggers_clarification(setup_demo_db):
    schema = db_manager.get_schema(setup_demo_db)
    state = {
        "natural_query": "What are our top performing products?",
        "connection_id": setup_demo_db,
        "schema_context": schema.to_prompt_context(),
        "dialect": "sqlite",
    }
    result = text_to_sql_agent.invoke(state)
    assert result.get("is_ambiguous") is True
    assert result.get("status") == "needs_clarification"
    assert len(result.get("clarification_options", [])) >= 2
    assert "revenue" in [opt["id"] for opt in result.get("clarification_options")]


def test_ambiguity_resolved_with_selected_option(setup_demo_db):
    schema = db_manager.get_schema(setup_demo_db)
    state = {
        "natural_query": "What are our top performing products?",
        "connection_id": setup_demo_db,
        "schema_context": schema.to_prompt_context(),
        "dialect": "sqlite",
        "selected_clarification": "revenue"
    }
    result = text_to_sql_agent.invoke(state)
    assert result.get("is_ambiguous") is False
    assert result.get("status") == "success"
    assert result.get("execution_result") is not None
    assert len(result["execution_result"]["rows"]) > 0
    assert result.get("sanitized_sql") is not None
    assert "revenue" in result["sanitized_sql"].lower() or "sum" in result["sanitized_sql"].lower()


def test_unambiguous_query_proceeds_directly(setup_demo_db):
    schema = db_manager.get_schema(setup_demo_db)
    state = {
        "natural_query": "Show total revenue by shipping country for completed orders",
        "connection_id": setup_demo_db,
        "schema_context": schema.to_prompt_context(),
        "dialect": "sqlite",
    }
    result = text_to_sql_agent.invoke(state)
    assert result.get("is_ambiguous") is False
    assert result.get("status") == "success"
    assert len(result["execution_result"]["rows"]) > 0
    assert result.get("summary") is not None
    assert result.get("visualization_type") in ("bar", "line", "table", "metric", "pie")
