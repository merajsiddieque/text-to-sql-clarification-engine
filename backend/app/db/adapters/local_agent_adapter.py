from typing import Any, Dict, Optional
from app.db.adapters.base import BaseDatabaseAdapter, QueryResult
from app.db.local_relay import local_agent_relay
from app.schema.models import DatabaseSchema


class LocalAgentDatabaseAdapter(BaseDatabaseAdapter):
    """Database adapter whose SQL runs on a paired local connector agent."""
    def __init__(self, connection_id: str, name: str, dialect: str = "mysql"):
        super().__init__(connection_id, name)
        self._dialect = dialect

    @property
    def dialect(self) -> str:
        return self._dialect

    def connect(self) -> None:
        self.test_connection()

    def disconnect(self) -> None:
        local_agent_relay.remove(self.connection_id)

    def test_connection(self) -> bool:
        try:
            self._request({"operation": "ping"})
            return True
        except Exception:
            return False

    def inspect_schema(self) -> DatabaseSchema:
        return DatabaseSchema.model_validate(self._request({"operation": "schema"}))

    def execute_query(self, sql: str, params: Optional[Dict[str, Any]] = None,
                      limit: Optional[int] = None, timeout_sec: Optional[int] = None) -> QueryResult:
        data = self._request({"operation": "query", "sql": sql, "params": params or {},
                              "limit": limit, "timeout_sec": timeout_sec},
                             timeout=(timeout_sec or 20) + 10)
        return QueryResult.model_validate(data)

    def _request(self, payload: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
        return local_agent_relay.submit(self.connection_id, payload, timeout=timeout)
