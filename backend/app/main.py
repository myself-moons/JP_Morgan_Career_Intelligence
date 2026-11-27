import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.models.entities import JobListing
from app.services.taxonomy_service import seed_taxonomy_if_empty

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.explorer import router as explorer_router
from app.api.exports import router as exports_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.learning import router as learning_router
from app.api.profile import router as profile_router
from app.api.resumes import router as resumes_router
from app.api.roadmap import router as roadmap_router
from app.api.taxonomy import router as taxonomy_router
from app.api.vault import router as vault_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    init_db()

    db = SessionLocal()
    try:
        # Seed only shared baseline JPMC dataset and canonical skill dictionary
        # (never bake personal user resumes or personal experience data into startup)
        if db.query(JobListing).count() == 0:
            seed_baseline_jobs(db)
        seed_taxonomy_if_empty(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Career Intelligence, Skill Explorer, Experience Vault (Mini-RAG), and User Roadmap Platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


# Include v3 & core API Routers
for r in (
    health_router,
    auth_router,
    jobs_router,
    resumes_router,
    taxonomy_router,
    analytics_router,
    explorer_router,
    vault_router,
    roadmap_router,
    exports_router,
    profile_router,
    learning_router,
):
    app.include_router(r, prefix=settings.API_PREFIX)
    app.include_router(r)

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
        "mode": "Version 3.0",
    }


@app.get("/api/info", summary="API Metadata Endpoint")
async def api_info():
    return _welcome_payload()


@app.get("/", summary="Root Welcome / Frontend Entrypoint")
async def root():
    if SERVE_FRONTEND and FRONTEND_INDEX.exists():
        return FileResponse(str(FRONTEND_INDEX))
    return _welcome_payload()
