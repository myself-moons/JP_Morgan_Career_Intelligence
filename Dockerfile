# ==============================================================================
# JPMorgan Career Intelligence (JCI) v3.0 - Multi-Stage Production Dockerfile
# Supports dynamic cloud $PORT, PostgreSQL via DATABASE_URL, and serves both
# the mobile-first React UI and FastAPI backend on a single port.
# ==============================================================================

# --- Stage 1: Build React + TypeScript Frontend ---
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# --- Stage 2: Python 3.12 Backend + Static Frontend Runtime ---
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    JCI_HOST=0.0.0.0 \
    PORT=8000 \
    JCI_SERVE_FRONTEND=true \
    JCI_COOKIE_SECURE=true

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source and shared baseline job dataset (no personal resumes baked in)
COPY backend/ ./backend/
COPY .docs/Job_Listings.md ./.docs/Job_Listings.md

# Copy compiled frontend static assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure writable persistence directories exist
RUN mkdir -p /app/data /app/data/backups /app/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\", \"8000\")}/api/health')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
