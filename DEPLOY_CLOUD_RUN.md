# Deploying & Operating JCI Career Studio (v3.0) on Google Cloud Run + PostgreSQL

This repository builds into a single production container (`Dockerfile`) serving both the **mobile-first React UI** and **FastAPI API** on `PORT=8000`, backed by **Neon PostgreSQL**.

---

## 1. Enable Admin Live Sync (`JCI_ADMIN_EMAILS`)

In Cloud Run → **jci-app** → **Edit & deploy new revision** → **Variables & Secrets**, add:

- Name: `JCI_ADMIN_EMAILS`
- Value: `your.gmail@gmail.com` *(comma-separated if multiple admins)*

Only listed Google accounts see **Fetch Live JPMC Jobs**, **Reset Baseline**, and **Promote** in the UI; all other signed-in users stay strictly isolated to their own private workspace.

---

## 2. Move Secrets to Google Secret Manager (Recommended)

Currently your sensitive keys may be plain environment variables. To protect them from revision YAML exports:

1. Open **Google Cloud Console → Security → Secret Manager → + Create Secret**:
   - `JCI_DATABASE_URL` → your Neon `postgresql://...` string
   - `JCI_JWT_SECRET` → your random JWT secret
   - `JCI_GEMINI_API_KEY` → your Gemini API key
   - `JCI_GOOGLE_CLIENT_ID` → your OAuth Web Client ID
2. Grant your Cloud Run service account access:
   - Go to **IAM & Admin → IAM**, find `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com` (or your custom Cloud Run service account), and add the role **Secret Manager Secret Accessor**.
3. In **Cloud Run → jci-app → Edit & deploy new revision → Variables & Secrets**:
   - Remove the plain env vars `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`.
   - Click **Reference a secret** and map each secret as an Environment Variable (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID` using `latest`).
   - Keep non-secret env vars (`JCI_SERVE_FRONTEND=true`, `JCI_AUTH_REQUIRED=true`, `JCI_COOKIE_SECURE=true`, `GEMINI_MODEL=gemini-flash-lite-latest`, `JCI_ADMIN_EMAILS=...`).

---

## 3. Publish Google OAuth Consent Screen (For Other Users)

1. Open **Google Cloud Console → APIs & Services → OAuth consent screen**.
2. If **Publishing status** says **Testing**, only emails listed under *Test users* can sign in.
3. Click **Publish App** → **Confirm**.
   *(JCI only requests basic OpenID email/profile info, so no restricted Google app verification is required.)*
4. Under **APIs & Services → Credentials → OAuth 2.0 Client ID**, confirm **Authorized JavaScript origins** includes:
   - `https://jci-app-60056461331.asia-southeast1.run.app`
   - `http://localhost:5173` (for local Vite dev)

---

## 4. Free ($0) Automated Daily Sync & Multi-User Email Alerts

`.github/workflows/jpmc_daily_job_sync.yml` runs daily at **03:00 UTC (08:30 IST)** via GitHub Actions:
- Queries JPMC's live Careers API and inserts newly discovered jobs into shared Neon PostgreSQL.
- Evaluates **every registered user** who has email alerts enabled (bell icon ON in the header) against their **Experience Vault** or **Active Resume** using deterministic matching (**$0 Gemini API cost**).
- Dispatches personalized match digests via free Gmail SMTP.

**Setup in GitHub Repo → Settings → Secrets and variables → Actions:**
- **Repository Secrets**:
  - `DATABASE_URL`: same Neon PostgreSQL connection string
  - `SMTP_USER`: your Gmail address
  - `SMTP_PASSWORD`: a 16-character **Google App Password** (from Google Account → Security → 2-Step Verification → App passwords)
- **Repository Variables** (optional):
  - `APP_URL`: `https://jci-app-60056461331.asia-southeast1.run.app`

---

## 5. Verify Production Health

Open `https://jci-app-60056461331.asia-southeast1.run.app/api/health` and confirm:
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "app": "JCI Career Studio",
  "environment": "cloud",
  "database": "postgresql",
  "database_connected": true
}
```
