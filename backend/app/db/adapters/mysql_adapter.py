import time
from typing import Dict, Any, Optional, List
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from app.db.adapters.base import BaseDatabaseAdapter, QueryResult
from app.schema.models import DatabaseSchema, TableMetadata, ColumnMetadata, ForeignKeyMetadata
from app.core.config import settings


class MySQLDatabaseAdapter(BaseDatabaseAdapter):
    """
    Adapter for MySQL & MariaDB databases.
    Enforces read-only sessions and maximum execution timeouts.
    """

    def __init__(
        self,
        connection_id: str,
        name: str,
        connection_uri: str,
        database_name: str
    ):
        super().__init__(connection_id, name)
        self.connection_uri = connection_uri
        self.db_name = database_name
        self._engine: Optional[Engine] = None

    @property
    def dialect(self) -> str:
        return "mysql"

    def _get_engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(
                self.connection_uri,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10
            )
        return self._engine

    def connect(self) -> None:
        self._get_engine()

    def disconnect(self) -> None:
        if self._engine:
            self._engine.dispose()
            self._engine = None

    def test_connection(self) -> bool:
        try:
            engine = self._get_engine()
            with engine.connect() as conn:
                res = conn.execute(text("SELECT 1;")).scalar()
                return bool(res == 1)
        except Exception:
            return False

    def inspect_schema(self) -> DatabaseSchema:
        engine = self._get_engine()
        inspector = inspect(engine)

        table_names = inspector.get_table_names(schema=self.db_name)
        tables: Dict[str, TableMetadata] = {}

        with engine.connect() as conn:
            for tbl in table_names:
                try:
                    count_res = conn.execute(text(f"SELECT COUNT(*) FROM `{self.db_name}`.`{tbl}`;")).scalar()
                    row_count = int(count_res) if count_res is not None else 0
                except Exception:
                    row_count = 0

                columns_info = inspector.get_columns(tbl, schema=self.db_name)
                pk_info = inspector.get_pk_constraint(tbl, schema=self.db_name)
                pk_cols = pk_info.get("constrained_columns", [])

                fk_info = inspector.get_foreign_keys(tbl, schema=self.db_name)
                fks = [
                    ForeignKeyMetadata(
                        constrained_column=fk["constrained_columns"][0],
                        referred_table=fk["referred_table"],
                        referred_column=fk["referred_columns"][0]
                    )
                    for fk in fk_info
                    if fk.get("constrained_columns") and fk.get("referred_columns")
                ]

                columns: List[ColumnMetadata] = []
                for col in columns_info:
                    c_name = col["name"]
                    c_type = str(col["type"])
                    is_nullable = col.get("nullable", True)
                    is_pk = c_name in pk_cols
                    dflt = str(col["default"]) if col.get("default") is not None else None

                    sample_vals = []
                    try:
                        samples = conn.execute(
                            text(f"SELECT DISTINCT `{c_name}` FROM `{self.db_name}`.`{tbl}` WHERE `{c_name}` IS NOT NULL LIMIT 3;")
                        ).fetchall()
                        sample_vals = [s[0] for s in samples]
                    except Exception:
                        pass

                    columns.append(ColumnMetadata(
                        name=c_name,
                        data_type=c_type,
                        is_nullable=is_nullable,
                        is_primary_key=is_pk,
                        default_value=dflt,
                        sample_values=sample_vals
                    ))

                tables[tbl] = TableMetadata(
                    name=tbl,
                    columns=columns,
                    primary_keys=pk_cols,
                    foreign_keys=fks,
                    row_count=row_count
                )

        return DatabaseSchema(
            database_name=self.name,
            dialect="mysql",
            tables=tables
        )

    def execute_query(
        self,
        sql: str,
        params: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
        timeout_sec: Optional[int] = None
    ) -> QueryResult:
        query_limit = limit or settings.DEFAULT_QUERY_LIMIT
        max_rows = min(query_limit, settings.MAX_QUERY_LIMIT)
        timeout_ms = (timeout_sec or settings.DEFAULT_QUERY_TIMEOUT_SECONDS) * 1000

        engine = self._get_engine()
        start_time = time.perf_counter()

        try:
            with engine.connect() as conn:
                # Set session read only and max_execution_time
                conn.execute(text("SET SESSION TRANSACTION READ ONLY;"))
                conn.execute(text(f"SET SESSION max_execution_time = {timeout_ms};"))

                result_proxy = conn.execute(text(sql), params or {})
                column_names = list(result_proxy.keys())

                raw_rows = result_proxy.fetchmany(max_rows + 1)
                duration_ms = (time.perf_counter() - start_time) * 1000.0

                truncated = len(raw_rows) > max_rows
                returned_rows = raw_rows[:max_rows]

                rows_dict = [dict(zip(column_names, r)) for r in returned_rows]

                return QueryResult(
                    columns=column_names,
                    rows=rows_dict,
                    total_rows=len(rows_dict),
                    execution_time_ms=round(duration_ms, 2),
                    truncated=truncated
                )
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return QueryResult(
                columns=[],
                rows=[],
                total_rows=0,
                execution_time_ms=round(duration_ms, 2),
                error=str(e)
            )
