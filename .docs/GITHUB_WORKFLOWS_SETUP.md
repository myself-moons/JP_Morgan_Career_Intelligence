# GitHub Workflows & Autonomous Cloud Automation Setup

This guide explains how to configure and run the autonomous GitHub Actions workflows for **JPMorgan Career Intelligence (JCI)**.

---

## 📋 Available Workflows

| Workflow | File | Trigger | Purpose |
| :--- | :--- | :--- | :--- |
| **CI - Test & Build** | `.github/workflows/ci.yml` | `push`, `pull_request`, manual | Runs backend pytest suite (25 tests) and frontend Vite TypeScript build. |
| **JPMC Daily Job Watcher** | `.github/workflows/jpmc_daily_job_sync.yml` | Daily at 03:00 UTC (08:30 IST) or manual | Synchronizes live JPMC Mumbai/Goregaon postings, matches against candidate profile, and dispatches email briefing. |

---

## ⚙️ Setting Up Repository Secrets (For Email Alerts & AI Matching)

To enable automatic email delivery and Gemini AI evaluations in the cloud:

1. Navigate to your GitHub repository:
   **Settings** &rarr; **Secrets and variables** &rarr; **Actions** &rarr; **New repository secret**.

2. Add the following secrets:

| Secret Name | Required? | Description / Example |
| :--- | :--- | :--- |
| `SMTP_USER` | **Recommended** | Your sending email address (e.g. `yourname@gmail.com`). Alias: `GMAIL_USER`. |
| `SMTP_PASSWORD` | **Recommended** | Your 16-character **Gmail App Password** (or SMTP password). Alias: `GMAIL_APP_PASSWORD`. |
| `ALERT_EMAIL` | **Recommended** | Destination email to receive the daily match briefing (can be same as `SMTP_USER`). |
| `GEMINI_API_KEY` | Optional | Your Google AI Studio Gemini API key. *(If omitted, runs 100% free with the canonical taxonomy matcher).* |
| `SMTP_HOST` | Optional | Defaults to `smtp.gmail.com`. |
| `SMTP_PORT` | Optional | Defaults to `587`. |

---

## 🔑 How to Generate a Free Gmail App Password (2 Minutes)

If using a standard Gmail account to send the alerts:
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned ON.
3. Search for or navigate to **App Passwords** (`https://myaccount.google.com/apppasswords`).
4. Enter an app name (e.g., `JCI Career Bot`) and click **Create**.
5. Copy the generated 16-character password (e.g., `abcd efgh ijkl mnop`).
6. Paste it into your GitHub Repository Secret as `SMTP_PASSWORD`.

---

## 🚀 How to Run Manually from GitHub Actions

You don't have to wait for the daily schedule (08:30 IST) to test:

1. Go to your repository on GitHub.
2. Click the **Actions** tab at the top.
3. Select **JPMC Daily Job Sync & Match Alerts** in the left sidebar.
4. Click **Run workflow**:
   - `limit`: Max jobs to query (default: `25`).
   - `min_score`: Minimum fit score threshold (default: `50`).
   - `force_email`: Check this to send an email immediately even if no new jobs were added.
   - `dry_run`: Check to preview matching without modifying database state.
5. Click the green **Run workflow** button.
6. When complete, inspect the **Job Summary** to view the rendered Markdown briefing directly in GitHub!
