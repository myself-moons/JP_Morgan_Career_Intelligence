from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine_kwargs = {
    "echo": False,
    "pool_pre_ping": not is_sqlite,
}
if is_sqlite:
    # check_same_thread=False is SQLite-only; PostgreSQL rejects it
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Cloud Run + managed/serverless PostgreSQL (Neon / Cloud SQL) pool resilience
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["connect_args"] = {"connect_timeout": 10}

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _sqlite_add_column_if_missing(conn, table_name: str, column_name: str, col_type: str):
    cursor = conn.exec_driver_sql(f"PRAGMA table_info({table_name})")
    existing_cols = [row[1] for row in cursor.fetchall()]
    if existing_cols and column_name not in existing_cols:
        conn.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {col_type}")


def init_db():
    """Initializes tables for SQLite or PostgreSQL and runs safe SQLite column migrations."""
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            try:
                for col in [
                    "summary",
                    "responsibilities",
                    "qualifications",
                    "preferred_qualifications",
                    "source_job_id",
                ]:
                    col_type = "VARCHAR(100)" if col == "source_job_id" else "TEXT"
                    _sqlite_add_column_if_missing(conn, "job_listings", col, col_type)

                # Multi-user isolation columns (v3.0 upgrades for existing local SQLite DBs)
                _sqlite_add_column_if_missing(conn, "job_listings", "user_id", "INTEGER")
                _sqlite_add_column_if_missing(conn, "resumes", "user_id", "INTEGER")
                _sqlite_add_column_if_missing(conn, "resumes", "stored_filename", "VARCHAR(255)")
                _sqlite_add_column_if_missing(conn, "resumes", "pdf_data", "BLOB")
                _sqlite_add_column_if_missing(conn, "users", "email_alerts_enabled", "INTEGER NOT NULL DEFAULT 1")
                _sqlite_add_column_if_missing(conn, "llm_evaluations", "user_id", "INTEGER")
                conn.commit()
            except Exception:
                pass
    elif engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            try:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts_enabled INTEGER NOT NULL DEFAULT 1"
                )
                conn.exec_driver_sql(
                    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS pdf_data BYTEA"
                )
                conn.commit()
            except Exception:
                pass


def get_db():
    """FastAPI dependency yielding a SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
