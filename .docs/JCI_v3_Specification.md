# JPMorgan Career Intelligence (JCI) — Version 3.0 Specification & Simplification Plan

**Status:** Revised Draft for Review (Incorporating User Feedback)  
**Target Version:** Version 3.0  
**Preceding Baseline:** Version 2.0 (`v2.0.0`)

---

## 1. Core Principles for Version 3.0

Version 3.0 strips away specification jargon, feature hype/glazing, and desktop-only table clutter to deliver a calm, practical, **mobile-first** job-preparation tool:

1. **Mobile-First Responsive Design (Desktop Secondary):**
   - Built primarily for phones (375px–430px viewports), scaling smoothly to desktop (`md:` / `lg:`).
   - **Zero horizontal-scrolling tables on mobile:** Data displays as clean, tappable **stacked cards and expandable accordions** showing only essential info upfront, with details revealed on tap.
   - Thumb-friendly navigation (clean bottom tab bar on mobile, compact top bar on desktop) and bottom-sheet/drawer modals instead of cramped popups.
2. **No Unneeded Noise or Feature Glazing:**
   - Remove promotional banners, marketing copy, compliance rule callouts (`FR-*`, `BR-*`, `TC-*`), and redundant KPI cards. Every screen shows only actionable data.
3. **Remove LaTeX Completely:**
   - Drop the `.tex` editor, syntax pane, `.tex` download, and Overleaf buttons entirely—users handle formatting externally in Overleaf.
   - Keep lightweight **PDF / DOCX / Plain Text resume upload** strictly for fallback ranking and generating plain-English **Resume Modification Suggestions** (what to add, emphasize, or reword for a specific role).
4. **100% Dynamic, Multi-User Ready (Zero Static Content in HTML/UI):**
   - **No hardcoded user info, project names, fallback counts (`10`, `11`, `35+`), or static suggestions inside JSX/HTML tags.**
   - Every metric, recommendation, skill count, and suggestion is computed dynamically from the active user's database records, API responses, and live AI/deterministic outputs.
   - Fresh installations start clean without baking personal identities or specific resume histories into the frontend or default code.
5. **Strict Anti-API-Hoarding & Quota Safety (Preserved from v2.0 + Extended to Mini-RAG):**
   - **Zero automatic LLM calls:** Browsing Dashboard, Job Library, Skill Explorer, Experience Vault, or My Roadmap makes **zero** Gemini generation calls. Dashboard rankings & Skill Explorer run 100% locally/deterministically.
   - **Explicit User Triggers & Clear "AI" Button Labels:** `gemini-2.5-flash` / `gemini-2.5-pro` only run when explicitly triggered. **Every button that calls the AI API must clearly include `AI` in its label** so users always distinguish external AI calls from local actions, while keeping labels **2 words preferred (3 words max)** for clean mobile buttons (e.g., `Compare with AI`, `Review with AI`, `Refresh AI`, `Match with AI`). Local deterministic buttons omit `AI` (e.g., `Add Entry`, `Sync Jobs`, `Export CSV`).
   - **SHA-256 Caching for Both Embeddings & Generations:**
     - Experience Vault / JD chunks cache `gemini-embedding-001` vectors by `SHA-256(chunk_text + embedding_model)` in SQLite—unchanged chunks are never re-embedded.
     - AI comparisons and roadmap reviews cache outputs in SQLite by `SHA-256(job_ids + vault_hashes + resume_hash + roadmap_hash + model)`—repeating the same check hits local cache with 0 API requests.
   - **Batched Embeddings & Graceful Offline Fallback:** Chunk embeddings are batched rather than sent one sentence at a time, with automatic local keyword fallback if offline or rate-limited.
6. **One Deduplicated, Live-Updating Canonical Skill System:**
   - All skill names are kept **short and clean** (1–3 words, e.g., `Python`, `SQL`, `Collibra`, `Data Lineage`, `BCBS 239`, `Alteryx`—never sentence-length phrases).
   - Different wordings (`PostgreSQL`, `T-SQL`, `ANSI SQL` → `SQL`; `MDM`, `Master Data` → `Reference Data`) map to **one canonical skill** via aliases and normalized matching so duplicates never pile up.
   - **Live Typeahead Autocomplete (`SkillTagInput`):** Typing anywhere (Experience Vault tags, Roadmap items, Saved Resources) searches all canonical skills extracted across JDs (e.g., typing `"co"` suggests `Collibra`, `Compliance & AML`, `Core Competency`).
   - **Remembered & Reused Globally:** Adding a new short skill or mapping a new alias updates the shared skill table immediately—making it available to autocomplete, JD extraction, Dashboard rankings, Skill Explorer, Mini-RAG matching, and Roadmap across the entire app.

---

## 2. Screen-by-Screen Architecture (Mobile-First)

### Navigation (4 Primary Tabs + 1 Compact Header Utility)

| Version 2.0 | Version 3.0 | Mobile UX Pattern |
| :--- | :--- | :--- |
| **Dashboard** | **Dashboard** *(Simplified)* | Stacked cards: *Top Recommended Roles* + *Skills in Demand* |
| **Job Library** | **Job Library** *(Mobile-Refactored)* | Search/filter pills + stacked job cards (tap for bottom-sheet JD) |
| **Skill Analysis** | **Skill Explorer** | Job shortlist chips + *Common Core* / *Shared* / *Role-Specific* accordion cards |
| **Resume Workspace** + **Profile & Resume** | **Experience Vault** *(+ Simple Resume Upload)* | Card list of real work/academic entries + Mini-RAG JD comparison + plain resume tips |
| **Learning Tracker** | **My Roadmap** | Short deduplicated skill goals + saved resource links/notes + optional AI review |
| **Database Console** | **Header Icon Utility** | Subtle DB icon on desktop/utility menu (removed from main mobile tab bar) |

---

### 2.1 Dashboard (Minimalist Entry View)
Displays **only** two focused sections, with smart ranking fallback:

1. **Top Recommended Roles** — Ranked using a clear **3-tier source fallback**:
   - **Tier 1 (Primary):** Uses the user's full **Experience Vault** (+ academic/project history) whenever entries exist, so rankings reflect real depth beyond a 1-page resume.
   - **Tier 2 (Automatic Fallback):** If the Experience Vault is empty, automatically ranks against the **uploaded/active Resume**.
   - **Tier 3 (Empty State):** If neither Experience Vault history nor a Resume exists, shows a direct, clear prompt inviting the user to add their detailed work/academic history or upload a resume.
   - Shows a subtle source indicator (e.g., *"Ranked from Experience Vault"* or *"Ranked from Active Resume"*) without noisy cards.
2. **Skills in Demand** — Clean ranked list (progress bar + job count); tapping any skill opens a responsive drawer/sheet showing the exact JD sentences where it appears. Includes a compact CSV/Excel export action.

---

### 2.2 Job Library (Responsive Mobile Cards)
- Retains core capabilities (browse, search, role family filter, manual paste, PDF/DOCX upload, live Oracle Cloud sync, CSV/Excel export).
- **Mobile UI Improvement:** Replace wide desktop tables with clean stacked job cards (Title, Role Family pill, Status dot, Requisition ID, Posted Date) that open a readable full-screen/sheet detail view on tap.

---

### 2.3 Skill Explorer (Replaces *Skill Analysis*)
Answers one simple question without clutter: *"Across the specific jobs or role family I picked, which skills show up everywhere and which belong to just one role?"*

1. **Scope Picker:**
   - Filter by **Role Family** (`Family A`, `Family B`, `Family C`) **or** toggle **specific jobs** with mobile-friendly checkboxes / chips.
2. **Deduplicated Buckets:**
   - **Common Core:** Skills appearing across most/all selected jobs → highest priority.
   - **Shared:** Skills appearing in 2+ selected jobs.
   - **Role-Specific:** Skills unique to 1 selected job.
3. **Tap-to-Read Evidence:**
   - Tapping any skill expands the exact matching JD sentences grouped by job (`Required` vs. `Preferred`).
   - Quick **"+ Add to Roadmap"** button right on each skill (adds the short canonical skill directly, preventing duplicates).
4. **Quiet Alias/Merge Control:**
   - Tucked into a secondary drawer so users can merge any accidental wording duplicates into one canonical skill without cluttering the main view.

---

### 2.4 Experience Vault (Replaces *Resume Workspace* + *Profile & Resume*)
Removes all LaTeX tooling and rigid `Demonstrated / Partial / Learning` checklists.

1. **Detailed Work & Academic History:**
   - Mobile-friendly cards + clean editor form where each entry stores:
     - **Title & Role / Project** (e.g., *Backend Internship*, *Credit Risk Capstone*, *M.Sc. Data Science Coursework*)
     - **Detailed Narrative** (problem solved, tools, datasets, metrics, edge cases—no 1-page space limit)
     - **My Role / Contribution** *(optional)* — e.g., *Built independently*, *Co-built with AI & tested*, *Academic*
     - **Tags / Skills** *(optional)* — powered by **live autocomplete** from all canonical JD skills (`SkillTagInput`). New short skills or aliases typed here are remembered globally across the app.
   - *(Note: No personal history is hardcoded into the UI or default app code; new users start with a clean Vault or can import/add their own entries.)*
2. **Simple Resume Slot (No LaTeX):**
   - Upload/replace PDF, DOCX, or plain text resume(s) cleanly in a collapsed panel/sub-tab (used as Tier 2 Dashboard fallback and as baseline context when generating resume tailoring tips).
3. **Mini-RAG Comparison (`Compare with AI`):**
   - Pick **1 job or shortlisted jobs** and tap **`Compare with AI`** (`Refresh AI` to bypass cache):
     - Retrieves the most relevant Experience Vault chunks using **`gemini-embedding-001`** + cosine similarity (offline keyword fallback when no API key/network).
     - Synthesizes via **`gemini-2.5-flash`** (with optional **`gemini-2.5-pro`** deep mode):
       - **What Your History Already Covers** (pulling real project details missed by a short resume)
       - **Genuine Gaps** (skills not yet backed by your Experience Vault or resume)
       - **Plain-Text Resume Suggestions** — concrete bullet/skill additions or wording tweaks the user can paste into Overleaf themselves.

---

### 2.5 My Roadmap (Replaces *Learning Tracker*)
Removes the hardcoded course list and broken external links completely.

1. **Short, Deduplicated Skill & Goal List:**
   - Each roadmap item binds to a **short canonical skill name** (via the same global autocomplete—no duplicates, no sentence-long skill names) plus an optional brief action note (e.g., Skill: `Collibra` · Goal: `"Glossary & Lineage basics"`, or Skill: `Deep Learning / GenAI` · Goal: `"Build 1 RAG evaluation demo"`).
   - Lightweight optional status (`To Learn`, `In Progress`, `Done`).
2. **Personal Resource & Certification Links:**
   - Paste any URL (course, certification, docs, YouTube, article), attach it to a skill/goal or target job, and save personal notes.
3. **Optional AI Roadmap Review (`Review with AI`):**
   - Single **`Review with AI`** button sends shortlisted jobs + Experience Vault summary + current Roadmap to **`gemini-2.5-flash`** for practical, concise feedback on missing common skills or unnecessary detours.

---

## 3. Mini-RAG & Model Selection

| Role | Selected Model | Notes |
| :--- | :--- | :--- |
| **Embeddings** | `gemini-embedding-001` | Embeds Experience Vault chunks & JD sections; vectors cached in SQLite (`experience_chunks`). |
| **Primary Reasoning** | `gemini-2.5-flash` | 1M token input window; fast Mini-RAG JD comparison, plain-text resume tips, and Roadmap review. |
| **Optional Deep Critique** | `gemini-2.5-pro` | Selectable when deeper multi-role review is wanted. |
| **Offline / Rate-Limit Fallback** | `gemini-2.5-flash-lite` + local token/alias matching | Keeps Dashboard, Explorer, Vault, and Roadmap 100% usable offline. |

---

## 4. Security, Privacy & Google Login Architecture

To safely support multiple users beyond local single-user use, Version 3.0 builds authentication, row-level isolation, upload hardening, and AI data hygiene directly into the core architecture:

### 4.1 Google Login (OAuth 2.0 / OIDC) & Session Security
- **Sign In With Google:** Frontend uses Google Identity Services (`GOOGLE_CLIENT_ID`) to obtain a signed Google ID token, sent to `POST /api/auth/google`.
- **Server-Side Verification:** FastAPI verifies the Google ID token signature, issuer (`accounts.google.com`), expiration, and `aud` (`GOOGLE_CLIENT_ID`) using Google's public keys (`google-auth`).
- **HttpOnly Session Cookie:** Backend creates/updates the `User` record (keyed by immutable `google_sub`) and sets a signed **`HttpOnly`, `SameSite=Lax` JWT session cookie** (`Secure=true` in HTTPS production)—never exposing auth tokens to `localStorage`.
- **Auth Endpoints:** `POST /api/auth/google`, `GET /api/auth/me`, `POST /api/auth/logout`.
- **Offline/Local Dev Convenience:** Supports an explicit local-only flag (`JCI_AUTH_REQUIRED=false`, default `true` in production/Docker) when testing offline without Google network access, mapping requests to a local dev profile.

### 4.2 Strict Per-User Data Isolation
- **`users` Table:** `id`, `google_sub` (unique indexed), `email`, `display_name`, `avatar_url`, `created_at`, `last_login_at`.
- **Row-Level Scoping:** `experience_entries`, `experience_chunks`, `resumes`, `roadmap_items`, `saved_resources`, `llm_cache`, and user-added `job_listings` all carry `user_id` (`FK -> users.id`). Every read, write, delete, export, and PDF stream strictly enforces `user_id == current_user.id` via a FastAPI `Depends(get_current_user)` guard.
- **Shared vs. Private Data:** Canonical `skills` / `skill_aliases` and shared baseline JPMC listings can remain globally readable (or forked per user), while user-created custom skill notes, Experience Vault narratives, resumes, and roadmaps remain strictly private to `user_id`.

### 4.3 File Upload Hardening & Storage Hygiene
- **Path-Traversal & DoS Prevention:** Reject uploads exceeding 10 MB, verify magic bytes (`%PDF` / DOCX zip header) rather than file extensions alone, strip directory components, and save under `uploads/<user_id>/<uuid><ext>`.
- **No Personal Files in Git:** Stop tracking personal resume PDFs/TeX files in Git; user resumes live exclusively in ignored local `uploads/` (or encrypted S3/GCS bucket in cloud deployments).

### 4.4 PII Scrubbing & Per-User AI Rate Limiting
- **PII Redaction Before Gemini Calls:** Strip email addresses, phone numbers, and personal portfolio/social URLs from Experience Vault and resume chunks before calling `gemini-embedding-001` or `gemini-2.5-flash`.
- **Per-User Quota Safety:** Apply per-user rate limits on `Compare with AI`, `Review with AI`, and `Refresh AI` endpoints alongside SHA-256 SQLite caching.

### 4.5 Mandatory Production Gates (Before Public Multi-User Launch)
- Serve strictly over **HTTPS/TLS** with production-only `CORS_ORIGINS` and security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`).
- Switch `DATABASE_URL` from local SQLite to encrypted managed **PostgreSQL** and move binary file storage from local disk to private object storage.
- Keep `sqlite-web` (`run_db_console.py`) strictly local/disabled in production and Docker images.

---

## 5. Technical Changes Summary (When Approved)

1. **Backend Cleanup & Additions:**
   - **Remove / Retire:** LaTeX update/export endpoints & Overleaf logic; hardcoded `learning_resources.json` seeding; rigid `FR/BR` status checklists.
   - **Add / Upgrade:**
     - `User` auth + `google-auth` ID-token verification + `HttpOnly` JWT session middleware (`get_current_user`).
     - `ExperienceEntry`, `ExperienceChunk` (with `gemini-embedding-001` vector cache), `RoadmapItem`, `SavedResource`, all scoped by `user_id`.
     - Upload size limits, magic-byte checks, UUID file naming, and PII scrubbing before Gemini calls.
     - Skill deduplication & global tag upsert endpoint (`/api/taxonomy/suggest?q=...` + alias resolution preventing duplicate skill names).
     - Dashboard ranking service implementing **Vault → Resume → Empty Prompt** 3-tier fallback.
     - `/api/auth/*`, `/api/explorer/compare`, `/api/vault/*` (Mini-RAG), and `/api/roadmap/*`.
- **Frontend Mobile-First Overhaul & Dynamic Audit:**
   - Google Sign-In screen & user profile/logout menu in mobile-first layout.
   - Responsive card/accordion layouts across every page (zero horizontal table scrolling on phones).
   - Shared `SkillTagInput` autocomplete component connected to live global canonical skills.
   - Audit all JSX/HTML components to remove hardcoded personal data, static counts/numbers, and static suggestions—every visible value driven by live state/API or neutral empty states.
- **Tests & Docker:**
   - Replace/update pytest suite for new v3 endpoints (Google auth/isolation checks, upload limits/sanitization, 3-tier Dashboard fallback, skill deduplication/autocomplete, SHA-256 embedding & LLM cache hits with 0 duplicate calls, Mini-RAG offline fallback, Roadmap CRUD) and verify mobile/desktop Vite builds + Dockerfile.
