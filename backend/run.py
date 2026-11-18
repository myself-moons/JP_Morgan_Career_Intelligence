import sys
from pathlib import Path

# Ensure backend directory is in Python path for direct script execution
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print("=" * 65)
    print(f" Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    print(" Local-First Development Server")
    print("=" * 65)
    print(f" API Server:    http://{settings.HOST}:{settings.PORT}")
    print(f" Swagger Docs:  http://{settings.HOST}:{settings.PORT}/docs")
    print(f" Health Check:  http://{settings.HOST}:{settings.PORT}{settings.API_PREFIX}/health")
    print("=" * 65)
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
