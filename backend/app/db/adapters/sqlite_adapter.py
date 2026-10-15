import os
import sqlite3
import time
from typing import Dict, Any, Optional, List
from app.db.adapters.base import BaseDatabaseAdapter, QueryResult
from app.schema.models import DatabaseSchema, TableMetadata, ColumnMetadata, ForeignKeyMetadata
from app.core.config import settings


class SQLiteDatabaseAdapter(BaseDatabaseAdapter):
    """
    Adapter for SQLite databases, with support for read-only connection mode,
    schema extraction, and guarded query execution.
    """

    def __init__(self, connection_id: str, name: str, db_path: str, read_only: bool = True):
        super().__init__(connection_id, name)
        self.is_memory = db_path.startswith("file:") and "mode=memory" in db_path
        self.db_path = db_path if self.is_memory else os.path.abspath(db_path)
        self.read_only = read_only
        self._anchor_connection = (
            sqlite3.connect(self.db_path, uri=True, timeout=settings.DEFAULT_QUERY_TIMEOUT_SECONDS)
            if self.is_memory else None
        )

    def load_from_connection(self, source: sqlite3.Connection) -> None:
        """Copies an imported in-memory database into this adapter's shared memory DB."""
        if not self.is_memory or self._anchor_connection is None:
            raise ValueError("Database adapter is not backed by in-memory SQLite.")
        source.backup(self._anchor_connection)

    @property
    def dialect(self) -> str:
        return "sqlite"

    def _get_connection(self) -> sqlite3.Connection:
        if self.is_memory:
            conn = sqlite3.connect(self.db_path, uri=True, timeout=settings.DEFAULT_QUERY_TIMEOUT_SECONDS)
        elif not os.path.exists(self.db_path):
            raise FileNotFoundError(f"SQLite database file not found at {self.db_path}")
        elif self.read_only:
            # Open using SQLite URI in read-only mode to prevent any filesystem writes
            uri = f"file:{self.db_path}?mode=ro"
            conn = sqlite3.connect(uri, uri=True, timeout=settings.DEFAULT_QUERY_TIMEOUT_SECONDS)
        else:
            conn = sqlite3.connect(self.db_path, timeout=settings.DEFAULT_QUERY_TIMEOUT_SECONDS)
            
        conn.row_factory = sqlite3.Row
        return conn

    def connect(self) -> None:
        conn = self._get_connection()
        conn.close()

    def disconnect(self) -> None:
        if self._anchor_connection is not None:
            self._anchor_connection.close()
            self._anchor_connection = None

    def test_connection(self) -> bool:
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            res = cursor.fetchone()
            conn.close()
            return bool(res and res[0] == 1)
        except Exception:
            return False

    def inspect_schema(self) -> DatabaseSchema:
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Get all non-system tables
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name;
        """)
        table_names = [row["name"] for row in cursor.fetchall()]
        
        tables: Dict[str, TableMetadata] = {}
        
        for tbl in table_names:
            # Get row count estimate
            try:
                cursor.execute(f"SELECT COUNT(*) FROM `{tbl}`;")
                count_res = cursor.fetchone()
                row_count = count_res[0] if count_res else 0
            except Exception:
                row_count = 0

            # Columns via PRAGMA table_info
            cursor.execute(f"PRAGMA table_info(`{tbl}`);")
            col_rows = cursor.fetchall()
            
            columns: List[ColumnMetadata] = []
            pk_cols: List[str] = []
            
            for col in col_rows:
                c_name = col["name"]
                c_type = col["type"] or "TEXT"
                is_nullable = not bool(col["notnull"])
                is_pk = bool(col["pk"])
                dflt = str(col["dflt_value"]) if col["dflt_value"] is not None else None
                
                if is_pk:
                    pk_cols.append(c_name)

                # Fetch 3 distinct sample values for grounding
                sample_vals = []
                try:
                    cursor.execute(f"SELECT DISTINCT `{c_name}` FROM `{tbl}` WHERE `{c_name}` IS NOT NULL LIMIT 3;")
                    sample_vals = [s[0] for s in cursor.fetchall()]
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

            # Foreign keys via PRAGMA foreign_key_list
            cursor.execute(f"PRAGMA foreign_key_list(`{tbl}`);")
            fk_rows = cursor.fetchall()
            fks: List[ForeignKeyMetadata] = []
            for fk in fk_rows:
                fks.append(ForeignKeyMetadata(
                    constrained_column=fk["from"],
                    referred_table=fk["table"],
                    referred_column=fk["to"]
                ))

            tables[tbl] = TableMetadata(
                name=tbl,
                columns=columns,
                primary_keys=pk_cols,
                foreign_keys=fks,
                row_count=row_count
            )

        conn.close()
        return DatabaseSchema(
            database_name=self.name,
            dialect="sqlite",
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
        timeout = timeout_sec or settings.DEFAULT_QUERY_TIMEOUT_SECONDS

        conn = self._get_connection()
        start_time = time.perf_counter()
        
        try:
            cursor = conn.cursor()
            # Execute with parameter binding if any
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)

            # Fetch up to max_rows + 1 to detect truncation
            raw_rows = cursor.fetchmany(max_rows + 1)
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            truncated = len(raw_rows) > max_rows
            returned_rows = raw_rows[:max_rows]

            column_names = [d[0] for d in cursor.description] if cursor.description else []
            rows_dict = [dict(zip(column_names, [r[col] for col in column_names])) for r in returned_rows]

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
        finally:
            conn.close()
