from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schema.models import DatabaseSchema


class QueryResult(BaseModel):
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    total_rows: int = 0
    execution_time_ms: float = 0.0
    truncated: bool = False
    error: Optional[str] = None


class BaseDatabaseAdapter(ABC):
    """
    Abstract Database Adapter for multi-engine support (PostgreSQL, MySQL, SQLite, etc.)
    Provides unified interface for testing connections, inspecting schemas, and safely executing queries.
    """

    def __init__(self, connection_id: str, name: str):
        self.connection_id = connection_id
        self.name = name

    @property
    @abstractmethod
    def dialect(self) -> str:
        """Returns the SQLGlot / SQLAlchemy dialect name (e.g., 'postgres', 'mysql', 'sqlite')."""
        pass

    @abstractmethod
    def connect(self) -> None:
        """Establishes or verifies connection pool."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Closes connections and disposes pools."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Runs a ping/validation query (e.g. SELECT 1) to verify connectivity."""
        pass

    @abstractmethod
    def inspect_schema(self) -> DatabaseSchema:
        """Inspects live database to produce structured DatabaseSchema."""
        pass

    @abstractmethod
    def execute_query(
        self,
        sql: str,
        params: Optional[Dict[str, Any]] = None,
        limit: Optional[int] = None,
        timeout_sec: Optional[int] = None
    ) -> QueryResult:
        """
        Executes a validated read-only SQL query with timeouts and row limits.
        """
        pass
