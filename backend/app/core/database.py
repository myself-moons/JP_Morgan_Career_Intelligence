from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Create SQLite database engine
# connect_args={"check_same_thread": False} is required for SQLite with multi-threaded FastAPI
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    """Initializes tables and automatically migrates SQLite columns if needed."""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            cursor = conn.exec_driver_sql("PRAGMA table_info(job_listings)")
            existing_cols = [row[1] for row in cursor.fetchall()]
            for col in ["summary", "responsibilities", "qualifications", "preferred_qualifications"]:
                if col not in existing_cols and "title" in existing_cols:
                    conn.exec_driver_sql(f"ALTER TABLE job_listings ADD COLUMN {col} TEXT")
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
