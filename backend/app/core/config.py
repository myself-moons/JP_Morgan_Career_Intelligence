import os
from pathlib import Path
from typing import List

# Resolve repository root directory reliably
# backend/app/core/config.py -> backend/app/core -> backend/app -> backend -> root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
DATA_DIR = ROOT_DIR / "data"
UPLOADS_DIR = ROOT_DIR / "uploads"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class Settings:
    PROJECT_NAME: str = "JPMorgan Career Intelligence"
    PROJECT_SLUG: str = "jci"
    VERSION: str = "1.2.0"
    API_PREFIX: str = "/api"
    
    # Server host & port configuration
    HOST: str = os.getenv("JCI_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("JCI_PORT", "8000"))
    DB_CONSOLE_PORT: int = int(os.getenv("JCI_DB_CONSOLE_PORT", "8080"))
    
    # Paths & Relational Persistence
    BASE_DIR: Path = ROOT_DIR
    DATA_DIR: Path = DATA_DIR
    UPLOADS_DIR: Path = UPLOADS_DIR
    DATABASE_PATH: Path = DATA_DIR / "jci_local.db"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}"
    )
    
    # CORS Origins for Local-First Development
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]


settings = Settings()
