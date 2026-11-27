import os
import secrets
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Resolve repository root directory reliably
# backend/app/core/config.py -> backend/app/core -> backend/app -> backend -> root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT_DIR / ".env")
BACKEND_DIR = ROOT_DIR / "backend"
DATA_DIR = ROOT_DIR / "data"
UPLOADS_DIR = ROOT_DIR / "uploads"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_database_url(raw_url: str) -> str:
    """Normalizes PostgreSQL connection strings to SQLAlchemy 2 + psycopg v3 dialect."""
    url = (raw_url or "").strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def _parse_cors_origins() -> List[str]:
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
    extra = os.getenv("JCI_CORS_ORIGINS", "")
    for item in extra.split(","):
        cleaned = item.strip().rstrip("/")
        if cleaned and cleaned not in defaults:
            defaults.append(cleaned)
    return defaults


_EPHEMERAL_DEV_SECRET = secrets.token_urlsafe(32)


class Settings:
    PROJECT_NAME: str = "JPMorgan Career Intelligence"
    PROJECT_SLUG: str = "jci"
    VERSION: str = "3.0.0"
    API_PREFIX: str = "/api"

    # Server host & port configuration (supports cloud $PORT)
    HOST: str = os.getenv("JCI_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", os.getenv("JCI_PORT", "8000")))
    DB_CONSOLE_PORT: int = int(os.getenv("JCI_DB_CONSOLE_PORT", "8080"))

    # Authentication & Session Security (Google OAuth 2.0 + HttpOnly JWT cookies)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    JWT_SECRET: str = (
        os.getenv("JWT_SECRET", "").strip()
        or os.getenv("JCI_JWT_SECRET", "").strip()
        or _EPHEMERAL_DEV_SECRET
    )
    AUTH_REQUIRED: bool = os.getenv(
        "JCI_AUTH_REQUIRED",
        "true" if os.getenv("GOOGLE_CLIENT_ID", "").strip() else "false",
    ).strip().lower() in ("1", "true", "yes")
    COOKIE_SECURE: bool = os.getenv("JCI_COOKIE_SECURE", "false").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    SESSION_COOKIE_NAME: str = "jci_session"
    SESSION_EXPIRE_HOURS: int = int(os.getenv("JCI_SESSION_HOURS", "168"))  # 7 days

    # LLM & Mini-RAG Settings (Anti-API-Hoarding + Gemini Flash + Embedding 001)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    GEMINI_DEEP_MODEL: str = os.getenv("GEMINI_DEEP_MODEL", "gemini-pro-latest")
    GEMINI_EMBEDDING_MODEL: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    AI_RATE_LIMIT_PER_HOUR: int = int(os.getenv("JCI_AI_RATE_LIMIT_PER_HOUR", "30"))

    # Upload Safety Limits
    MAX_UPLOAD_BYTES: int = int(os.getenv("JCI_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

    # Paths & Relational Persistence
    BASE_DIR: Path = ROOT_DIR
    DATA_DIR: Path = DATA_DIR
    UPLOADS_DIR: Path = UPLOADS_DIR
    DATABASE_PATH: Path = DATA_DIR / "jci_local.db"
    DATABASE_URL: str = _normalize_database_url(
        os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}")
    )

    CORS_ORIGINS: List[str] = _parse_cors_origins()


settings = Settings()
