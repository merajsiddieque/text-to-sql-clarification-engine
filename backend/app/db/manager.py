import os
import sqlite3
from typing import Dict, Optional, List, Any
from app.db.adapters.base import BaseDatabaseAdapter
from app.db.adapters.sqlite_adapter import SQLiteDatabaseAdapter
from app.db.adapters.postgres_adapter import PostgreSQLDatabaseAdapter
from app.db.adapters.mysql_adapter import MySQLDatabaseAdapter
from app.db.adapters.local_agent_adapter import LocalAgentDatabaseAdapter
from app.schema.models import DatabaseSchema
from app.core.config import settings
from app.core.security import encrypt_secret, decrypt_secret


class DatabaseConnectionManager:
    """
    Manages active database connections, cached schemas, and adapter lifecycle.
    """

    def __init__(self):
        self._adapters: Dict[str, BaseDatabaseAdapter] = {}
        self._schema_cache: Dict[str, DatabaseSchema] = {}
        self._connection_owners: Dict[str, str] = {}
        self._init_demo_connection()

    def _init_demo_connection(self):
        """Initializes the built-in demo database connection."""
        demo_id = "demo-ecommerce"
        # Ensure path exists or will be created
        if not os.path.exists(settings.DEMO_DB_PATH):
            from demo_data.init_demo_db import init_database
            init_database()

        adapter = SQLiteDatabaseAdapter(
            connection_id=demo_id,
            name="Demo E-commerce Store",
            db_path=settings.DEMO_DB_PATH,
            read_only=True
        )
        self._adapters[demo_id] = adapter

    def register_sqlite(self, connection_id: str, name: str, db_path: str, read_only: bool = True) -> SQLiteDatabaseAdapter:
        adapter = SQLiteDatabaseAdapter(connection_id=connection_id, name=name, db_path=db_path, read_only=read_only)
        self._adapters[connection_id] = adapter
        self.invalidate_schema_cache(connection_id)
        return adapter

    def register_sqlite_from_connection(
        self, connection_id: str, name: str, source: sqlite3.Connection
    ) -> SQLiteDatabaseAdapter:
        """Registers a session-only SQLite database copied from a source connection."""
        memory_uri = f"file:{connection_id}?mode=memory&cache=shared"
        adapter = SQLiteDatabaseAdapter(connection_id, name, memory_uri, read_only=False)
        try:
            adapter.load_from_connection(source)
        except Exception:
            adapter.disconnect()
            raise
        self._adapters[connection_id] = adapter
        self.invalidate_schema_cache(connection_id)
        return adapter

    def register_postgres(self, connection_id: str, name: str, connection_uri: str, schema_name: str = "public") -> PostgreSQLDatabaseAdapter:
        adapter = PostgreSQLDatabaseAdapter(connection_id=connection_id, name=name, connection_uri=connection_uri, schema_name=schema_name)
        self._adapters[connection_id] = adapter
        self.invalidate_schema_cache(connection_id)
        return adapter

    def register_mysql(self, connection_id: str, name: str, connection_uri: str, database_name: str) -> MySQLDatabaseAdapter:
        adapter = MySQLDatabaseAdapter(connection_id=connection_id, name=name, connection_uri=connection_uri, database_name=database_name)
        self._adapters[connection_id] = adapter
        self.invalidate_schema_cache(connection_id)
        return adapter

    def register_local_agent(self, connection_id: str, name: str, dialect: str = "mysql") -> LocalAgentDatabaseAdapter:
        adapter = LocalAgentDatabaseAdapter(connection_id, name, dialect)
        self._adapters[connection_id] = adapter
        self.invalidate_schema_cache(connection_id)
        return adapter

    def get_adapter(self, connection_id: str) -> Optional[BaseDatabaseAdapter]:
        return self._adapters.get(connection_id)

    def list_connections(self, user_id: str = "local") -> List[Dict[str, Any]]:
        connections = []
        for cid, adapter in self._adapters.items():
            if cid != "demo-ecommerce" and self._connection_owners.get(cid) != user_id:
                continue
            connections.append({
                "connection_id": cid,
                "name": adapter.name,
                "dialect": adapter.dialect,
                "is_demo": cid == "demo-ecommerce",
                "is_local": isinstance(adapter, LocalAgentDatabaseAdapter),
            })
        return connections

    def set_connection_owner(self, connection_id: str, user_id: str) -> None:
        self._connection_owners[connection_id] = user_id

    def can_access_connection(self, connection_id: str, user_id: str) -> bool:
        return connection_id == "demo-ecommerce" or self._connection_owners.get(connection_id) == user_id

    def get_schema(self, connection_id: str, force_refresh: bool = False) -> DatabaseSchema:
        if not force_refresh and connection_id in self._schema_cache:
            return self._schema_cache[connection_id]

        adapter = self.get_adapter(connection_id)
        if not adapter:
            raise ValueError(f"Connection ID '{connection_id}' not found.")

        schema = adapter.inspect_schema()
        self._schema_cache[connection_id] = schema
        return schema

    def invalidate_schema_cache(self, connection_id: str) -> None:
        if connection_id in self._schema_cache:
            del self._schema_cache[connection_id]

    def remove_connection(self, connection_id: str) -> bool:
        if connection_id == "demo-ecommerce":
            raise ValueError("Cannot remove default demo database connection.")
        if connection_id in self._adapters:
            self._adapters[connection_id].disconnect()
            del self._adapters[connection_id]
            self._connection_owners.pop(connection_id, None)
            self.invalidate_schema_cache(connection_id)
            return True
        return False


# Singleton manager instance
db_manager = DatabaseConnectionManager()
