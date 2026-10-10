from typing import List, Optional, Set, Tuple
import sqlglot
from sqlglot import exp
from pydantic import BaseModel, Field
from app.schema.models import DatabaseSchema
from app.core.config import settings


class SQLValidationResult(BaseModel):
    is_valid: bool
    sanitized_sql: Optional[str] = None
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    tables_used: List[str] = Field(default_factory=list)
    columns_used: List[str] = Field(default_factory=list)
    has_limit: bool = False
    original_sql: str = ""


# Disallowed SQLGlot AST node classes that mutate state, schema, or system configurations
DISALLOWED_EXPRESSION_TYPES = (
    exp.Insert,
    exp.Update,
    exp.Delete,
    exp.Drop,
    exp.Alter,
    exp.TruncateTable,
    exp.Create,
    exp.Command,
    exp.Kill,
    exp.Set,
    exp.Grant,
    exp.Revoke,
    exp.Transaction,
    exp.Commit,
    exp.Rollback,
    exp.Pragma,
)

# Functions known for side effects, DOS, or external access
PROHIBITED_FUNCTIONS = {
    "pg_sleep",
    "sleep",
    "benchmark",
    "load_file",
    "sys_eval",
    "sys_exec",
    "xp_cmdshell",
    "pg_read_file",
    "pg_write_file",
    "pg_read_binary_file",
    "dblink",
    "copy",
}


class SQLValidator:
    """
    Production SQL Validator powered by SQLGlot AST analysis.
    Guarantees query safety, enforces read-only access, injects limits, and checks schema grounding.
    """

    DIALECT_MAP = {
        "postgres": "postgres",
        "postgresql": "postgres",
        "mysql": "mysql",
        "mariadb": "mysql",
        "sqlite": "sqlite",
    }

    @classmethod
    def normalize_dialect(cls, dialect: str) -> str:
        return cls.DIALECT_MAP.get(dialect.lower(), "sqlite")

    @classmethod
    def validate_and_sanitize(
        cls,
        sql: str,
        dialect: str = "sqlite",
        schema: Optional[DatabaseSchema] = None,
        default_limit: int = settings.DEFAULT_QUERY_LIMIT,
        max_limit: int = settings.MAX_QUERY_LIMIT,
    ) -> SQLValidationResult:
        glot_dialect = cls.normalize_dialect(dialect)
        clean_sql = sql.strip().rstrip(";")
        
        result = SQLValidationResult(
            is_valid=True,
            original_sql=sql,
            sanitized_sql=None
        )

        if not clean_sql:
            result.is_valid = False
            result.errors.append("SQL query cannot be empty.")
            return result

        # 1. Parse into AST statements
        try:
            parsed_statements = sqlglot.parse(clean_sql, read=glot_dialect)
        except Exception as e:
            result.is_valid = False
            result.errors.append(f"SQL syntax error: {str(e)}")
            return result

        if not parsed_statements or parsed_statements[0] is None:
            result.is_valid = False
            result.errors.append("Could not parse SQL expression.")
            return result

        # 2. Block stacked queries (multi-statement injection prevention)
        if len(parsed_statements) > 1:
            result.is_valid = False
            result.errors.append("Multiple SQL statements are strictly prohibited.")
            return result

        ast = parsed_statements[0]

        # 3. Verify statement is strictly a read-only SELECT or CTE
        # An expression can be exp.Select, or exp.Union (whose inputs are selects)
        is_select_query = False
        if isinstance(ast, (exp.Select, exp.Union)):
            is_select_query = True
        elif isinstance(ast, exp.Expression) and ast.find(exp.Select):
            # Check if root has CTE with select
            if isinstance(ast.this, (exp.Select, exp.Union)):
                is_select_query = True

        if not is_select_query:
            result.is_valid = False
            result.errors.append(
                f"Prohibited SQL statement type: {ast.__class__.__name__}. Only read-only SELECT queries are permitted."
            )
            return result

        # 4. Deep search for any prohibited write/DDL/system AST nodes
        for node in ast.walk():
            if isinstance(node, DISALLOWED_EXPRESSION_TYPES):
                result.is_valid = False
                result.errors.append(
                    f"Forbidden operation '{node.__class__.__name__}' detected. Write, DDL, or administrative commands are blocked."
                )
                return result

            # Check dangerous functions
            if isinstance(node, (exp.Anonymous, exp.Func)):
                func_name = ""
                if isinstance(node, exp.Anonymous):
                    func_name = (getattr(node, "name", "") or "").lower()
                elif hasattr(node, "sql_name") and callable(node.sql_name):
                    try:
                        s_name = node.sql_name()
                        if s_name and s_name.upper() != "ANONYMOUS":
                            func_name = s_name.lower()
                    except Exception:
                        pass
                
                if not func_name:
                    func_name = (getattr(node, "name", "") or node.__class__.__name__).lower()

                if func_name in PROHIBITED_FUNCTIONS:
                    result.is_valid = False
                    result.errors.append(
                        f"Prohibited function '{func_name}()' detected. Unsafe system functions are blocked."
                    )
                    return result

        # 5. Extract CTE alias definitions (CTEs are temporary in-query tables)
        cte_aliases: Set[str] = set()
        for cte in ast.find_all(exp.CTE):
            alias = cte.alias
            if alias:
                cte_aliases.add(alias.lower())

        # Extract tables and check schema grounding
        tables_found: Set[str] = set()
        for table_node in ast.find_all(exp.Table):
            t_name = table_node.name
            if t_name and t_name.lower() not in cte_aliases:
                tables_found.add(t_name.lower())
        
        result.tables_used = list(tables_found)

        # Extract column references
        cols_found: Set[str] = set()
        for col_node in ast.find_all(exp.Column):
            c_name = col_node.name
            if c_name:
                cols_found.add(c_name.lower())
        result.columns_used = list(cols_found)

        # Grounding validation against supplied schema
        if schema and schema.tables:
            known_tables = {k.lower(): v for k, v in schema.tables.items()}
            
            # Check table existence
            for t in tables_found:
                if t not in known_tables and t not in cte_aliases:
                    result.is_valid = False
                    result.errors.append(
                        f"Schema grounding error: Table '{t}' does not exist in the database. "
                        f"Valid tables are: {list(schema.tables.keys())}."
                    )

            # Check column existence where possible
            if result.is_valid:
                all_known_cols = set()
                for tbl_meta in schema.tables.values():
                    for col_meta in tbl_meta.columns:
                        all_known_cols.add(col_meta.name.lower())

                for c in cols_found:
                    # Ignore special aliases like * or count/sum aliases
                    if c not in all_known_cols and c != "*":
                        result.warnings.append(
                            f"Column '{c}' was not found in schema columns. Verify if it's a dynamic alias or CTE reference."
                        )

        if not result.is_valid:
            return result

        # 6. Row Limit Enforcement
        # Check if AST already has a limit
        existing_limit = ast.args.get("limit")
        if existing_limit:
            result.has_limit = True
            try:
                limit_expr = existing_limit.expression
                limit_val = int(limit_expr.this) if hasattr(limit_expr, "this") else int(str(limit_expr))
                if limit_val > max_limit:
                    result.warnings.append(
                        f"Requested limit of {limit_val} exceeded maximum allowed ({max_limit}). Capped to {max_limit}."
                    )
                    ast.set("limit", exp.Limit(expression=exp.Literal.number(max_limit)))
            except Exception:
                pass
        else:
            # Safely inject default LIMIT
            result.has_limit = False
            result.warnings.append(f"No LIMIT clause detected; auto-injected LIMIT {default_limit}.")
            if isinstance(ast, (exp.Select, exp.Union)):
                ast.set("limit", exp.Limit(expression=exp.Literal.number(default_limit)))

        # 7. Transpile to clean target dialect SQL
        try:
            sanitized_sql = ast.sql(dialect=glot_dialect, pretty=True)
            result.sanitized_sql = sanitized_sql
        except Exception as e:
            result.is_valid = False
            result.errors.append(f"Transpilation error for dialect '{dialect}': {str(e)}")

        return result
