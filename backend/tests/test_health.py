import sys
from pathlib import Path
import pytest
import httpx

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_api_health():
    """Verify that GET /api/health returns 200 OK and healthy status payload."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == settings.VERSION
        assert data["app"] == settings.PROJECT_NAME
        assert data["database"] == "sqlite"
        assert "db_console_url" in data


@pytest.mark.asyncio
async def test_direct_health():
    """Verify that GET /health route alias is functional and returns 200 OK."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root_welcome():
    """Verify that root endpoint GET / provides project metadata."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert data["version"] == settings.VERSION
        assert "/docs" in data["documentation"]


if __name__ == "__main__":
    import asyncio

    async def main():
        print("Running health endpoint checks...")
        await test_api_health()
        print("✓ GET /api/health passed")
        await test_direct_health()
        print("✓ GET /health passed")
        await test_root_welcome()
        print("✓ GET / passed")
        print("All tests passed successfully!")

    asyncio.run(main())
