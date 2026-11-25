# ==============================================================================
# JPMorgan Career Intelligence (JCI) - Production Multi-Stage Dockerfile
# Serves both the compiled React/Vite frontend and FastAPI backend on port 8000.
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
    JCI_PORT=8000 \
    JCI_SERVE_FRONTEND=true

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source, research baseline dataset, and resumes
COPY backend/ ./backend/
COPY .docs/Job_Listings.md ./.docs/Job_Listings.md
COPY resumes/ ./resumes/

# Copy compiled frontend static assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure writable persistence directories exist
RUN mkdir -p /app/data /app/data/backups /app/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
