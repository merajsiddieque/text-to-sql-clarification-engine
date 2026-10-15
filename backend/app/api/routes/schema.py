from fastapi import APIRouter, HTTPException
from app.db.manager import db_manager
from app.schema.models import DatabaseSchema

router = APIRouter(prefix="/schema", tags=["schema"])


@router.get("/{connection_id}", response_model=DatabaseSchema)
def get_schema(connection_id: str):
    """Retrieves discovered schema catalog for the given connection ID."""
    try:
        return db_manager.get_schema(connection_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect schema: {str(e)}")


@router.post("/{connection_id}/refresh", response_model=DatabaseSchema)
def refresh_schema(connection_id: str):
    """Forces cache invalidation and re-inspects database schema."""
    try:
        return db_manager.get_schema(connection_id, force_refresh=True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh schema: {str(e)}")


@router.get("/{connection_id}/table/{table_name}")
def get_table_data(
    connection_id: str,
    table_name: str,
    limit: int = 100,
    offset: int = 0
):
    """
    Retrieves records for a specific table to display in the 'Fetched Table from database' studio grid.
    """
    adapter = db_manager.get_adapter(connection_id)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Connection '{connection_id}' not found.")
    
    schema = db_manager.get_schema(connection_id)
    if table_name not in schema.tables:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' does not exist in schema.")

    # Escape table identifier safely
    safe_table = table_name.replace('"', '""')
    sql = f'SELECT * FROM "{safe_table}" LIMIT {limit} OFFSET {offset};'
    
    res = adapter.execute_query(sql, limit=limit)
    return {
        "table_name": table_name,
        "columns": res.columns,
        "rows": res.rows,
        "total_rows": res.total_rows,
        "execution_time_ms": res.execution_time_ms,
        "truncated": res.truncated,
        "error": res.error
    }

