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
