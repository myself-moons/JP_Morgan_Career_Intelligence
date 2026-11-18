from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health Check")
async def health_check():
    """Returns local system health status, version, and runtime mode."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "app": settings.PROJECT_NAME,
        "environment": "local",
        "database": "sqlite",
        "database_path": str(settings.DATABASE_PATH.name),
        "db_console_url": f"http://{settings.HOST}:{settings.DB_CONSOLE_PORT}",
    }
