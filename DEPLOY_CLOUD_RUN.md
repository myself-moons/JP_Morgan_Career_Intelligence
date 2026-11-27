# Deploying JPMorgan Career Intelligence (JCI v3.0) to Google Cloud Run + PostgreSQL

This repository builds into a single production container (`Dockerfile`) that serves both the **mobile-first React UI** and the **FastAPI API** on `$PORT`, backed by **PostgreSQL** (`psycopg` v3).

---

## Prerequisites

1. **Google Cloud CLI (`gcloud`)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```
2. **Enable required Google Cloud APIs**:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```
   *(If using Cloud SQL instead of Neon/external PostgreSQL, also enable `sqladmin.googleapis.com`.)*

---

## Step 1: Prepare PostgreSQL

### Option A: Managed Serverless PostgreSQL (e.g. Neon — already in `.env`)
- Use your pooled connection string:
  `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`
- The backend automatically normalizes `postgresql://` / `postgres://` to `postgresql+psycopg://` with `pool_pre_ping=True` and `pool_recycle=300`.

### Option B: Google Cloud SQL for PostgreSQL
1. Create a Cloud SQL PostgreSQL instance & database:
   ```bash
   gcloud sql instances create jci-pg --database-version=POSTGRES_16 --tier=db-f1-micro --region=asia-south1
   gcloud sql databases create jci_db --instance=jci-pg
   gcloud sql users create jci_user --instance=jci-pg --password="STRONG_DB_PASSWORD"
   ```
2. Your Cloud Run Unix-socket `DATABASE_URL` will be:
   `postgresql+psycopg://jci_user:STRONG_DB_PASSWORD@/jci_db?host=/cloudsql/YOUR_GCP_PROJECT_ID:asia-south1:jci-pg`

---

## Step 2: Store Secrets in Google Secret Manager

Never bake `.env` into Docker images (`.dockerignore` already excludes `.env`). Store sensitive keys in Secret Manager:

```bash
# Generate a strong persistent JWT secret first
python -c "import secrets; print(secrets.token_urlsafe(48))"

printf "%s" "YOUR_POSTGRES_DATABASE_URL" | gcloud secrets create JCI_DATABASE_URL --data-file=-
printf "%s" "YOUR_GENERATED_JWT_SECRET"  | gcloud secrets create JCI_JWT_SECRET --data-file=-
printf "%s" "YOUR_GEMINI_API_KEY"        | gcloud secrets create JCI_GEMINI_API_KEY --data-file=-
printf "%s" "YOUR_GOOGLE_CLIENT_ID"      | gcloud secrets create JCI_GOOGLE_CLIENT_ID --data-file=-
```

Grant your Cloud Run runtime service account access to read secrets (`Secret Manager Secret Accessor`):
```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 3: Build & Deploy to Cloud Run

From the repository root:

```bash
gcloud run deploy jci-platform \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "JCI_SERVE_FRONTEND=true,JCI_AUTH_REQUIRED=true,JCI_COOKIE_SECURE=true,GEMINI_MODEL=gemini-2.5-flash" \
  --set-secrets "DATABASE_URL=JCI_DATABASE_URL:latest,JWT_SECRET=JCI_JWT_SECRET:latest,GEMINI_API_KEY=JCI_GEMINI_API_KEY:latest,GOOGLE_CLIENT_ID=JCI_GOOGLE_CLIENT_ID:latest"
```

*(If using Option B Cloud SQL, also pass `--add-cloudsql-instances YOUR_GCP_PROJECT_ID:asia-south1:jci-pg`.)*

---

## Step 4: Authorize Cloud Run Domain in Google OAuth

1. Copy the service URL printed by `gcloud run deploy` (e.g. `https://jci-platform-xxxxxx-el.a.run.app`).
2. Go to **Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web Client ID**.
3. Under **Authorized JavaScript origins**, add:
   - `https://jci-platform-xxxxxx-el.a.run.app`
   - Keep `http://localhost:5173` if you still test locally.
4. Save changes (Google OAuth origin updates take ~1–5 minutes to propagate).

---

## Step 5: Verify Production Health & Mobile UX

1. Check `/api/health`:
   ```bash
   curl https://jci-platform-xxxxxx-el.a.run.app/api/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "version": "3.0.0",
     "app": "JPMorgan Career Intelligence",
     "environment": "cloud",
     "database": "postgresql",
     "database_connected": true
   }
   ```
2. Open the Cloud Run URL on your phone (or Chrome DevTools mobile viewport) to verify the mobile-first Landing Page, Google Sign-In, Dashboard, Experience Vault, Skill Explorer, Job Library (including Live JPMC Sync), and My Roadmap.

---

## Notes on Cloud Run Ephemeral Filesystem
- All structured records (Users, Jobs, Extracted Skills, Experience Vault narratives & embedding vectors, Resume extracted `raw_text`, Roadmap items, AI caches, and AI rate-limit logs) are persisted in **PostgreSQL**.
- Raw uploaded resume binaries (`.pdf`) stored under `/app/uploads` are ephemeral across Cloud Run container recycles; `resumes.raw_text` in PostgreSQL remains permanent for scoring and Mini-RAG.
