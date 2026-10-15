from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.db.manager import db_manager
from app.db.importer import process_uploaded_database, UploadLimitError
from app.core.security import encrypt_secret
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
