import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal, init_db
from app.models.entities import JobListing
from app.core.seed import seed_baseline_jobs
from app.services.resume_service import seed_resumes
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.resumes import router as resumes_router
from app.api.taxonomy import router as taxonomy_router
from app.api.analytics import router as analytics_router
from app.api.profile import router as profile_router
from app.api.learning import router as learning_router
from app.api.exports import router as exports_router
from app.services.taxonomy_service import seed_taxonomy_if_empty
from app.services.profile_service import seed_profile_if_empty
from app.services.learning_service import seed_learning_resources_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure local persistence and upload folders exist
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize database tables & run auto-migrations
    init_db()

    # Auto-seed baseline jobs if database is fresh
    db = SessionLocal()
    try:
        count = db.query(JobListing).count()
        if count == 0:
            seed_baseline_jobs(db)
        # Ensure resumes from resumes/ directory are indexed
        seed_resumes(db)
        # Ensure canonical taxonomy and aliases are seeded
        seed_taxonomy_if_empty(db)
        # Ensure CardLyze profile attribution and learning catalogue are seeded
        seed_profile_if_empty(db)
        seed_learning_resources_if_empty(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Local-first Career Intelligence and JD Extraction Platform for JPMorgan Chase roles.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(health_router)
app.include_router(jobs_router, prefix=settings.API_PREFIX)
app.include_router(jobs_router)
app.include_router(resumes_router, prefix=settings.API_PREFIX)
app.include_router(resumes_router)
app.include_router(taxonomy_router, prefix=settings.API_PREFIX)
app.include_router(taxonomy_router)
app.include_router(analytics_router, prefix=settings.API_PREFIX)
app.include_router(analytics_router)
app.include_router(profile_router, prefix=settings.API_PREFIX)
app.include_router(profile_router)
app.include_router(learning_router, prefix=settings.API_PREFIX)
app.include_router(learning_router)
app.include_router(exports_router, prefix=settings.API_PREFIX)
app.include_router(exports_router)


FRONTEND_DIST_DIR = settings.BASE_DIR / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST_DIR / "index.html"
SERVE_FRONTEND = os.getenv("JCI_SERVE_FRONTEND", "").lower() in ("1", "true", "yes")

if (FRONTEND_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="frontend-assets")


def _welcome_payload():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "documentation": "/docs",
        "health_check": f"{settings.API_PREFIX}/health",
        "jobs_endpoint": f"{settings.API_PREFIX}/jobs",
        "db_console": f"http://{settings.HOST}:{settings.DB_CONSOLE_PORT}",
        "status": "online",
        "mode": "Phase 1: Local-First MVP",
    }


@app.get("/api/info", summary="API Metadata Endpoint")
async def api_info():
    return _welcome_payload()


@app.get("/", summary="Root Welcome / Frontend Entrypoint")
async def root():
    if SERVE_FRONTEND and FRONTEND_INDEX.exists():
        return FileResponse(str(FRONTEND_INDEX))
    return _welcome_payload()
