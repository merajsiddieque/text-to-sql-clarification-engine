from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.db.manager import db_manager
from app.db.importer import process_uploaded_database, UploadLimitError
from app.db.local_relay import local_agent_relay
from fastapi import Header
import hashlib
import secrets
import uuid

router = APIRouter(prefix="/connections", tags=["connections"])


class ConnectRequest(BaseModel):
    name: str
    dialect: str  # 'postgres', 'mysql', 'sqlite'
    # PostgreSQL / MySQL
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    # SQLite
    sqlite_path: Optional[str] = None
    # Direct URI
    connection_uri: Optional[str] = None


class ConnectionResponse(BaseModel):
    connection_id: str
    name: str
    dialect: str
    is_demo: bool
    is_local: bool = False


class LocalPairRequest(BaseModel):
    pair_code: str


class LocalAgentResult(BaseModel):
    call_id: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post("/local/pairing")
def create_local_pairing(request: Request):
    """Create a short-lived code for pairing the desktop connector."""
    connection_id = f"local_{uuid.uuid4().hex[:12]}"
    token = secrets.token_urlsafe(32)
    pair_code = local_agent_relay.create_pairing_code(connection_id, _token_hash(token))
    _pair_tokens[connection_id] = token
    # Keep this pairing pending until the desktop agent validates MySQL and
    # begins polling the relay; pending pairings must not appear as databases.
    _pair_owners[connection_id] = request.state.user_id
    return {"connection_id": connection_id, "pair_code": pair_code, "expires_in_seconds": 600}


@router.post("/local/pair")
def pair_local_agent(req: LocalPairRequest):
    """Redeem a pairing code from the desktop connector. The code expires after 10 minutes."""
    connection_id = local_agent_relay.redeem_pairing_code(req.pair_code.strip())
    if not connection_id:
        raise HTTPException(status_code=400, detail="Pairing code is invalid or expired. Generate a new code in the web app.")
    # The secret is generated once by the authenticated pairing endpoint and held only there.
    token = _pair_tokens.pop(connection_id, None)
    if not token:
        raise HTTPException(status_code=400, detail="Pairing session expired. Generate a new code in the web app.")
    return {"connection_id": connection_id, "agent_token": token}


_pair_tokens: Dict[str, str] = {}
_pair_owners: Dict[str, str] = {}


def _authenticate_agent(connection_id: str, authorization: Optional[str]) -> None:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not local_agent_relay.authenticate_agent(connection_id, _token_hash(token)):
        raise HTTPException(status_code=401, detail="Invalid connector token.")


@router.get("/local/agent/{connection_id}/next")
def next_local_agent_operation(connection_id: str, authorization: Optional[str] = Header(None)):
    _authenticate_agent(connection_id, authorization)
    if db_manager.get_adapter(connection_id) is None:
        owner_id = _pair_owners.pop(connection_id, None)
        if owner_id is None:
            raise HTTPException(status_code=404, detail="Pairing session is no longer available. Generate a new code in the web app.")
        db_manager.register_local_agent(connection_id, "Local MySQL (Desktop Connector)")
        db_manager.set_connection_owner(connection_id, owner_id)
    return local_agent_relay.next_operation(connection_id, timeout=20)


@router.post("/local/agent/{connection_id}/result")
def submit_local_agent_result(connection_id: str, req: LocalAgentResult, authorization: Optional[str] = Header(None)):
    _authenticate_agent(connection_id, authorization)
    accepted = local_agent_relay.resolve(connection_id, req.call_id, req.model_dump(exclude={"call_id"}))
    return {"accepted": accepted}


@router.get("/local/{connection_id}/status")
def local_connector_status(connection_id: str, request: Request):
    if not db_manager.can_access_connection(connection_id, request.state.user_id):
        raise HTTPException(status_code=404, detail="Connection not found.")
    return {"online": local_agent_relay.is_online(connection_id)}


@router.get("", response_model=List[ConnectionResponse])
def list_connections(request: Request):
    """Lists all registered active database connections."""
    return db_manager.list_connections(request.state.user_id)


@router.post("/test")
def test_connection(req: ConnectRequest):
    """Validates connectivity without saving connection credentials."""
    temp_id = f"test_{uuid.uuid4().hex[:8]}"
    try:
        if req.dialect == "sqlite":
            if not req.sqlite_path:
                raise HTTPException(status_code=400, detail="sqlite_path is required for SQLite.")
            adapter = db_manager.register_sqlite(temp_id, req.name, req.sqlite_path)
        elif req.dialect in ("postgres", "postgresql"):
            uri = req.connection_uri or f"postgresql://{req.username}:{req.password}@{req.host}:{req.port or 5432}/{req.database}"
            adapter = db_manager.register_postgres(temp_id, req.name, uri)
        elif req.dialect in ("mysql", "mariadb"):
            uri = req.connection_uri or f"mysql+pymysql://{req.username}:{req.password}@{req.host}:{req.port or 3306}/{req.database}"
            adapter = db_manager.register_mysql(temp_id, req.name, uri, database_name=req.database or "")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported dialect '{req.dialect}'.")

        is_connected = adapter.test_connection()
        db_manager.remove_connection(temp_id)
        return {"success": is_connected, "message": "Connection successful!" if is_connected else "Connection test failed."}
    except Exception as e:
        if temp_id in db_manager._adapters:
            db_manager.remove_connection(temp_id)
        return {"success": False, "message": str(e)}


@router.post("", response_model=ConnectionResponse)
def create_connection(req: ConnectRequest, request: Request):
    """Registers and persists a new database connection."""
    conn_id = f"conn_{uuid.uuid4().hex[:8]}"
    if req.dialect == "sqlite":
        if not req.sqlite_path:
            raise HTTPException(status_code=400, detail="sqlite_path is required for SQLite.")
        adapter = db_manager.register_sqlite(conn_id, req.name, req.sqlite_path)
    elif req.dialect in ("postgres", "postgresql"):
        uri = req.connection_uri or f"postgresql://{req.username}:{req.password}@{req.host}:{req.port or 5432}/{req.database}"
        adapter = db_manager.register_postgres(conn_id, req.name, uri)
    elif req.dialect in ("mysql", "mariadb"):
        uri = req.connection_uri or f"mysql+pymysql://{req.username}:{req.password}@{req.host}:{req.port or 3306}/{req.database}"
        adapter = db_manager.register_mysql(conn_id, req.name, uri, database_name=req.database or "")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported dialect '{req.dialect}'.")

    if not adapter.test_connection():
        db_manager.remove_connection(conn_id)
        raise HTTPException(status_code=400, detail="Could not connect to target database with provided parameters.")

    db_manager.set_connection_owner(conn_id, request.state.user_id)

    return ConnectionResponse(
        connection_id=conn_id,
        name=adapter.name,
        dialect=adapter.dialect,
        is_demo=False
    )


@router.delete("/{connection_id}")
def delete_connection(connection_id: str, request: Request):
    """Removes a registered database connection."""
    if connection_id == "demo-ecommerce":
        raise HTTPException(status_code=400, detail="Cannot delete default demo database.")
    if not db_manager.can_access_connection(connection_id, request.state.user_id):
        raise HTTPException(status_code=404, detail="Connection not found.")
    removed = db_manager.remove_connection(connection_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Connection not found.")
    return {"success": True, "message": f"Connection '{connection_id}' removed."}


@router.post("/upload")
async def upload_database(
    request: Request,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None)
):
    """
    Upload a database or data file (.sql, .sqlite, .db, .dump, .csv, .tsv, .bak, .sql.gz)
    and register it as a queryable database connection.
    """
    try:
        file.file.seek(0, 2)
        upload_size = file.file.tell()
        file.file.seek(0)
        if not upload_size:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = await run_in_threadpool(
            process_uploaded_database,
            file_bytes=file.file,
            filename=file.filename,
            custom_name=name
        )
        db_manager.set_connection_owner(result["connection_id"], request.state.user_id)
        return result
    except HTTPException:
        raise
    except UploadLimitError as limit_error:
        raise HTTPException(status_code=413, detail=str(limit_error))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process database file: {str(e)}")
