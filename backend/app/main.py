from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models.entities import JobListing
from app.core.seed import seed_baseline_jobs
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure local persistence and upload folders exist
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize database tables
    Base.metadata.create_all(bind=engine)

    # Auto-seed baseline jobs if database is fresh
    db = SessionLocal()
    try:
        count = db.query(JobListing).count()
        if count == 0:
            seed_baseline_jobs(db)
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


@app.get("/", summary="Root Welcome Endpoint")
async def root():
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
