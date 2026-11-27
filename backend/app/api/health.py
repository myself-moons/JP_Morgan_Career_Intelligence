import os
from fastapi import APIRouter
from sqlalchemy import text
from app.core.config import settings
from app.core.database import SessionLocal, is_sqlite

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health Check")
async def health_check():
    """Returns system health status, version, database backend, and runtime environment."""
    is_cloud = bool(os.getenv("K_SERVICE"))
    db_ok = True
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
    except Exception:
        db_ok = False

    payload = {
        "status": "healthy" if db_ok else "degraded",
        "version": settings.VERSION,
        "app": settings.PROJECT_NAME,
        "environment": "cloud" if is_cloud else ("postgresql" if not is_sqlite else "local"),
        "database": "sqlite" if is_sqlite else "postgresql",
        "database_connected": db_ok,
    }
    if is_sqlite:
        payload["database_path"] = str(settings.DATABASE_PATH.name)
        payload["db_console_url"] = f"http://{settings.HOST}:{settings.DB_CONSOLE_PORT}"
    return payload
