import pytest
from app.validator.sql_validator import SQLValidator
from app.schema.models import DatabaseSchema, TableMetadata, ColumnMetadata


@pytest.fixture
def sample_schema():
    return DatabaseSchema(
        database_name="test_db",
        dialect="sqlite",
        tables={
            "products": TableMetadata(
                name="products",
                columns=[
                    ColumnMetadata(name="product_id", data_type="INTEGER", is_primary_key=True),
                    ColumnMetadata(name="name", data_type="TEXT"),
                    ColumnMetadata(name="unit_price", data_type="DECIMAL"),
                ],
                primary_keys=["product_id"]
            ),
            "orders": TableMetadata(
                name="orders",
                columns=[
                    ColumnMetadata(name="order_id", data_type="INTEGER", is_primary_key=True),
                    ColumnMetadata(name="total_amount", data_type="DECIMAL"),
                ],
                primary_keys=["order_id"]
            )
        }
    )


def test_valid_select_query(sample_schema):
    sql = "SELECT name, unit_price FROM products WHERE unit_price > 50;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is True
    assert "products" in res.tables_used
    assert "LIMIT 100" in res.sanitized_sql.upper()


def test_cte_select_query(sample_schema):
    sql = "WITH high_val AS (SELECT * FROM products WHERE unit_price > 100) SELECT name FROM high_val;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is True
    assert "high_val" in res.sanitized_sql.lower() or "products" in res.sanitized_sql.lower()


def test_stacked_query_injection_blocked(sample_schema):
    sql = "SELECT * FROM products; DROP TABLE products;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is False
    assert any("Multiple SQL statements" in err for err in res.errors)


def test_drop_table_blocked(sample_schema):
    sql = "DROP TABLE products;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is False
    assert any("Only read-only SELECT" in err or "Forbidden" in err for err in res.errors)


def test_update_blocked(sample_schema):
    sql = "UPDATE products SET unit_price = 0 WHERE product_id = 1;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is False
    assert any("Only read-only SELECT" in err or "Forbidden" in err for err in res.errors)


def test_delete_blocked(sample_schema):
    sql = "DELETE FROM products WHERE unit_price < 10;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is False
    assert any("Only read-only SELECT" in err or "Forbidden" in err for err in res.errors)


def test_dangerous_function_blocked(sample_schema):
    sql = "SELECT pg_sleep(10);"
    res = SQLValidator.validate_and_sanitize(sql, dialect="postgres", schema=sample_schema)
    assert res.is_valid is False
    assert any("pg_sleep" in err for err in res.errors)


def test_schema_grounding_rejects_hallucinated_table(sample_schema):
    sql = "SELECT * FROM non_existent_payroll_table;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema)
    assert res.is_valid is False
    assert any("Schema grounding error" in err for err in res.errors)


def test_excessive_limit_is_capped(sample_schema):
    sql = "SELECT name FROM products LIMIT 5000;"
    res = SQLValidator.validate_and_sanitize(sql, dialect="sqlite", schema=sample_schema, max_limit=1000)
    assert res.is_valid is True
    assert "LIMIT 1000" in res.sanitized_sql.upper()
