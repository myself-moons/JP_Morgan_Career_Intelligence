import logging
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.models.entities import JobListing, JobSkill
from app.services.taxonomy_service import batch_extract_all_jobs, seed_taxonomy_if_empty

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.explorer import router as explorer_router
from app.api.exports import router as exports_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.resumes import router as resumes_router
from app.api.roadmap import router as roadmap_router
from app.api.taxonomy import router as taxonomy_router
from app.api.vault import router as vault_router


logger = logging.getLogger("jci.security")

# Per-IP sliding-window limiters (protects Cloud Run backend from burst floods & brute force)
_IP_REQUEST_WINDOWS: dict[str, deque] = defaultdict(deque)
_AUTH_IP_WINDOWS: dict[str, deque] = defaultdict(deque)


def _extract_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "").strip()
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    if settings.AUTH_REQUIRED and settings.USING_EPHEMERAL_JWT_SECRET:
        logger.warning(
            "SECURITY WARNING: AUTH_REQUIRED=true without a fixed JWT_SECRET. "
            "Set JWT_SECRET in your environment so sessions survive restarts and scaling."
        )

    init_db()

    db = SessionLocal()
    try:
        # Seed only shared baseline JPMC dataset and canonical skill dictionary
        # (never bake personal user resumes or personal experience data into startup)
        if db.query(JobListing).count() == 0:
            seed_baseline_jobs(db)
        seed_taxonomy_if_empty(db)
        if db.query(JobSkill).count() == 0:
            batch_extract_all_jobs(db)
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
async def security_and_traffic_middleware(request: Request, call_next):
    path = request.url.path

    # 1. Reject oversized payloads before buffering
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit():
        if int(content_length) > settings.MAX_UPLOAD_BYTES + 1024 * 1024:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request payload exceeds allowed size limit."},
            )

    # 2. Per-IP burst protection for API routes (allow internal health probes and TestClient without XFF)
    client_ip = _extract_client_ip(request)
    is_test_client = client_ip == "testclient" and not request.headers.get("x-forwarded-for")
    if path.startswith("/api") and path != "/api/health" and not is_test_client:
        now = time.time()
        ip_win = _IP_REQUEST_WINDOWS[client_ip]
        while ip_win and (now - ip_win[0]) > 60:
            ip_win.popleft()
        if len(ip_win) >= settings.GLOBAL_IP_RATE_LIMIT_PER_MIN:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests from this IP. Please slow down."},
                headers={"Retry-After": "60"},
            )
        ip_win.append(now)

        if path == "/api/auth/google":
            auth_win = _AUTH_IP_WINDOWS[client_ip]
            while auth_win and (now - auth_win[0]) > 60:
                auth_win.popleft()
            if len(auth_win) >= settings.AUTH_IP_RATE_LIMIT_PER_MIN:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many login attempts. Please wait a minute and retry."},
                    headers={"Retry-After": "60"},
                )
            auth_win.append(now)

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if settings.COOKIE_SECURE:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if path.startswith(("/api/auth", "/api/vault", "/api/resumes", "/api/analytics")):
        response.headers.setdefault("Cache-Control", "no-store")
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


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if not (SERVE_FRONTEND and FRONTEND_INDEX.exists()):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if full_path.startswith(("api/", "api", "docs", "redoc", "openapi.json")):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    candidate = (FRONTEND_DIST_DIR / full_path).resolve()
    try:
        candidate.relative_to(FRONTEND_DIST_DIR.resolve())
    except ValueError:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if candidate.is_file():
        return FileResponse(str(candidate))
    return FileResponse(str(FRONTEND_INDEX))
