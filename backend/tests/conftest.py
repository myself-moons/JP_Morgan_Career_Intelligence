import os
import pytest

# Always run pytest against an isolated local SQLite test database unless explicitly opted out,
# preventing accidental test mutations against production PostgreSQL in .env.
if os.getenv("JCI_TEST_USE_ENV_DB", "").lower() not in ("1", "true", "yes"):
    os.environ["DATABASE_URL"] = "sqlite:///./data/jci_test.db"

from app.core.auth import get_current_user, get_or_create_local_dev_user
from app.core.database import SessionLocal, init_db
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def default_test_auth_override():
    """
    Provides an authenticated local test user for functional suites even when
    JCI_AUTH_REQUIRED=true in .env. Security/auth tests override or clear this explicitly.
    """
    init_db()

    def _override_user():
        db = SessionLocal()
        try:
            return get_or_create_local_dev_user(db)
        finally:
            db.close()

    app.dependency_overrides[get_current_user] = _override_user
    yield
    app.dependency_overrides.clear()
