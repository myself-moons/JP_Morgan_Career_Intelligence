# JPMorgan Career Intelligence - Software Requirements Specification (SRS)

*System scope, stakeholders, constraints, quality requirements and acceptance baseline*

| **Document status** | Baseline requirements specification (revised for local-first MVP & taxonomy alignment) |
| --- | --- |
| **Version / date** | 1.2 / 17 November 2026 |
| **Project scope** | JPMorgan Chase roles initially; local-first MVP (Phase 1) |

---

### Document Revision History

| Version | Date | Author / Reviewer | Summary of Changes |
| --- | --- | --- | --- |
| 1.0 | 17 Nov 2026 | Baseline Team | Initial draft baseline for JCI project development. |
| 1.1 | 17 Nov 2026 | Documentation Review | Aligned documentation structure and initial requirements cross-references. |
| 1.2 | 17 Nov 2026 | JCI Plan Review & Architecture Alignment | **Resolved UI framework conflict:** Corrected Section 2.3 Table 3 from Streamlit to React + FastAPI.<br>**Clarified MVP vs. Cloud scope:** Explicitly established Phase 1 as a 100% local-first application (React + FastAPI + SQLite). Deferred Firebase Hosting, Realtime Database, and cloud deployments to Phase 2 (post-M7).<br>**Sample size & status alignment:** Clarified dataset as 11 captured listings (10 analysable JDs, 1 with status `JD unavailable`).<br>**Schema enhancement:** Added `role_family` (A, B, C) and `status` (`Available`, `JD unavailable`, `Stale`, `Archived`) to the `Job listing` entity.<br>**Education vs. skill gap test:** Added explicit requirement that degree/licensure prerequisites must be evaluated as formal education gaps, not technical skill gaps.<br>**Profile seed:** Added requirement to seed the profile with the CardLyze project and its explicit contribution split per FR-19 before Milestone M5. |

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the requirements for the JPMorgan Career Intelligence (JCI) MVP. It is intended to guide design, implementation, testing and future change. It describes what the system must do and the quality constraints it should satisfy; it does not prescribe every implementation detail.

### 1.2 Product scope

JCI is a local-first, single-user career intelligence application focused initially on JPMorgan Chase job listings. It stores job descriptions, extracts structured requirements, compares skills across listings, matches requirements against an evidence-based user profile and tracks learning resources.

### 1.3 Intended users

- Primary user: the individual researching JPMorgan Chase career opportunities and maintaining a personal profile.
- Future users: additional users may be considered only after privacy, authentication and data separation are designed in Phase 2.

### 1.4 Definitions

| **Term** | **Definition** |
| --- | --- |
| MVP | Minimum viable product: the smallest useful version that validates the core workflow. |
| JD | Job description: source text describing a vacancy, its responsibilities and requirements. |
| Role Family | A functional grouping of related job listings: Family A (Data Management, Quality & Governance), Family B (Analytics, Automation & AI), Family C (Finance, Credit & Operations). |
| FR | Functional requirement describing system behaviour. |
| NFR | Non-functional requirement describing quality or constraints. |
| Evidence | A source snippet or profile example supporting a requirement or skill claim. |
| Human review | User confirmation or correction of extracted information. |

## 2. Overall description

### 2.1 Product perspective

JCI is a standalone local application in Phase 1 (MVP) designed with a **Hybrid Intelligence Architecture** optimized for resource-constrained client machines (e.g., 4.00 GB RAM, dual-core CPUs). The React frontend communicates with Python service modules through a local FastAPI backend. A local SQL relational database (SQLite) stores all structured project data. Uploaded documents are processed locally with lightweight deterministic parsers. To prevent memory exhaustion while offering state-of-the-art NLP, heavy semantic analysis (skill disambiguation and qualitative resume critique) is routed through a zero-RAM external cloud LLM adapter (Google Gemini 1.5 Flash / Groq via free-tier API). Core workflows remain 100% functional offline without an external API key. Cloud hosting and Firebase services are reserved for Phase 2.

### 2.2 Product functions

- Create and manage a library of job listings, storing role family and availability status.
- Accept pasted descriptions and PDF/DOCX uploads.
- Extract and review job attributes and requirement statements.
- Normalise skill names using a controlled taxonomy and aliases.
- Compare skills across selected jobs and role groups (Families A, B, C).
- Maintain a structured user profile with verified contribution types (independent, AI-assisted, supervised).
- Accept pasted resume text or uploaded resume documents (PDF/DOCX) and validate parsing (FR-37, FR-39).
- Compare resume keyword mentions against a chosen JD's skills using canonical aliases without single composite scores (FR-38).
- Flag skills listed on a resume that lack supporting profile evidence deliverables (FR-40).
- Identify skill, functional, domain, education and experience gaps separately.
- Maintain learning resources and track progress against priority gaps.
- Display analysis and export selected results.
- Inspect live database tables, schema, and execute SQL queries via an interactive web console (equivalent to Firebase Realtime DB Console).

### 2.3 Operating environment

| **Item** | **MVP Expectation (Phase 1)** |
| --- | --- |
| Operating system | Windows development environment initially; cross-platform Python/Node where dependencies permit. |
| Runtime | Python 3.12+ (backend) and Node.js 18+ (frontend development server / static build). |
| Frontend Interface | React web frontend running locally in a modern web browser. |
| Backend API | Python FastAPI service running locally on localhost, exposing REST endpoints. |
| Database | SQLite file stored locally in the application workspace (`jci_local.db`). |
| Documents | PDF and DOCX text extraction via PyMuPDF and python-docx; scanned/image-only PDFs require manual text input in MVP. |
| Network | Not required for core local analysis; required only to open external resource/source links or use optional AI services. |

### 2.4 Assumptions and dependencies

- The user supplies job descriptions or files that they are permitted to use for personal research.
- The quality of extraction depends on readable source text and the consistency of the input document.
- The user reviews extracted information before relying on analytical results.
- External job listings and course links may change or become unavailable.
- Any AI service is optional, replaceable and subject to its own privacy and cost terms.
- The initial baseline dataset contains 11 captured listings: 10 analysable JDs with full text and 1 placeholder listing with status `JD unavailable`.

## 3. System boundary

### 3.1 In scope

- Manual job entry (paste) and document upload (PDF/DOCX).
- Cleaned text generation and side-by-side review against original source text.
- Extraction of experience, qualifications, responsibilities and skills.
- Skill normalisation via canonical names, categories and alias mappings.
- Role family assignment (Family A: Governance/DQ, Family B: Analytics/AI, Family C: Finance/Credit/Operations).
- Comparative skill coverage calculations across the 10 analysable baseline jobs.
- Profile maintenance, tracking evidence states (Demonstrated, Partial, Learning, Not demonstrated) and contribution types (independent, AI-assisted, supervised).
- Separate evaluation of technical, functional, domain, education, and experience dimensions.
- Learning resource catalogue and progress tracking.
- Pre-seeding the profile with the CardLyze project baseline (independent requirements/EDA vs. AI-assisted implementation) prior to matching tests.
- Local SQLite persistence and data backup/export.

### 3.2 Out of scope for MVP

- Automated scraping or live crawling of JPMorgan Chase career websites.
- Direct job application submission or candidate-to-recruiter communication.
- Automated selection probability prediction or singular ATS scores.
- Mandatory cloud hosting, cloud relational databases, or public multi-user authentication.
- Firebase Hosting and Firebase Realtime Database live synchronization (deferred to Phase 2).
- Automatic course enrolment or credential verification against third-party training platforms.

## 4. User classes and characteristics

| **User class** | **Needs** | **Expected technical knowledge** |
| --- | --- | --- |
| Primary analyst/user | Add roles, review requirements, inspect trends, maintain evidence and plan learning. | Basic computer and spreadsheet familiarity; no programming knowledge required to use the finished interface. |
| Project maintainer | Configure, test, extend taxonomy, manage database and maintain code. | Python, SQL, React/TypeScript, Git and basic application troubleshooting. |

## 5. Constraints

- The MVP should be local-first and must not require paid hosting, cloud infrastructure, or a paid AI API key.
- The core analysis must work deterministically without an external AI service.
- Original source text must be preserved separately and immutably from cleaned or extracted data.
- Private profile information, uploaded resumes, local database files and secrets must not be committed to Git.
- The application must not present inferred or incomplete data as verified fact.
- A skill mention in a JD does not automatically mean the skill is mandatory; requirement type (required vs. preferred vs. unspecified) must be preserved.
- Formal education or licensing prerequisites must be reported strictly as education/eligibility gaps and never merged into an ordinary skill gap.

## 6. External interface requirements

### 6.1 User interface

The UI should provide clear navigation for Dashboard, Job Library, Skill Analysis, Profile Matcher, Learning Tracker, and an interactive SQL Database Console (equivalent to the Firebase Realtime DB Console). Forms should validate required fields and show actionable error messages. Tables and charts should display filters and sample counts where relevant.

### 6.2 File interface

The system shall accept PDF and DOCX files for text extraction. It should retain the original file only according to the configured retention decision. Unsupported, password-protected, corrupted or text-empty files must produce a clear error or warning rather than silently generating incomplete analysis.

### 6.3 External services

No external service is mandatory for the MVP. If optional AI or external resource verification is introduced, the user must be informed what data is sent and the feature must fail gracefully when unavailable.

## 7. Data requirements

| **Entity** | **Purpose** | **Key data** |
| --- | --- | --- |
| Company | Company catalogue for extensibility. | Company ID, name. |
| Job listing | Preserve one captured vacancy snapshot. | Job ID, company, title, external job ID, location, URL, capture date, role_family (A, B, C), status (Available, JD unavailable, Stale, Archived), original description. |
| Job requirement | Store extracted statements. | Requirement ID, job ID, category, text, required/preferred/unspecified type, evidence location. |
| Skill | Canonical skill catalogue. | Skill ID, canonical name, category (technical, finance domain, tool, etc.), description. |
| Skill alias | Map approved alternate terms. | Alias ID, skill ID, alias text. |
| Job skill | Link a skill to a job and evidence. | Job ID, skill ID, requirement type, evidence snippet, extraction method, review status. |
| Profile evidence | Record user experience supporting a skill. | Evidence ID, skill ID, status (Demonstrated, Partial, Learning, Not demonstrated), description, source/project, contribution type (independent, AI-assisted, supervised), date. |
| Learning resource | Catalogue courses and simulations. | Resource ID, provider, title, URL, cost status (Free, Paid, Freemium, Unknown), certificate flag, duration, skill mapping, verification date. |
| Learning progress | Track user progress. | Resource ID, status (Not started, In progress, Completed, Paused), start/completion dates, notes. |
| Resume document | Store multiple named uploaded/pasted resumes and LaTeX source for keyword coverage and personalization. | Resume ID, user ID, name, source type (pasted, PDF, DOCX, LaTeX), raw text, latex_source, is_active flag, parse check status, capture date, file paths (PDF/TeX). |

The database design must prevent orphan records and avoid duplicating the same captured job unintentionally. Foreign key integrity and unique constraints on external job IDs per company must be enforced.

## 8. Non-functional requirements

| **ID** | **Requirement** | **Verification** |
| --- | --- | --- |
| NFR-01 | Usability: common workflows should be understandable without editing code. | Walk through add-job, review and dashboard tasks. |
| NFR-02 | Traceability: extracted requirements and skills should link to source evidence snippets. | Inspect records and UI evidence for a sample job. |
| NFR-03 | Data integrity: use primary/foreign keys and validate required fields. | Database constraint and invalid-input tests. |
| NFR-04 | Reliability: saved records should persist across application restarts. | Restart application and verify stored data. |
| NFR-05 | Privacy: local personal files and secrets must be excluded from version control. | Review .gitignore and inspect repository before commit. |
| NFR-06 | Maintainability: parsing, extraction, matching, API and UI should be cleanly decoupled into modules. | Code review and unit tests. |
| NFR-07 | Explainability: no unexplained single fit score should be presented as a hiring prediction; education gaps must be distinct from skill gaps. | Review dashboard labels and methodology notes. |
| NFR-08 | Performance: normal single-user operations on the initial dataset (10 analysable JDs) should execute in under 2 seconds locally. | Automated benchmark timing with the baseline dataset. |
| NFR-09 | Recoverability: provide a documented way to back up and restore the SQLite database. | Perform a backup/restore test script. |
| NFR-10 | Portability: dependencies and setup steps should be documented and reproducible across Windows and Linux environments. | Create a clean virtual environment from README instructions. |
| NFR-11 | Low Memory Footprint: local backend memory usage must remain under 300 MB RAM to ensure stable execution on 4 GB RAM machines without swap thrashing. | Benchmark memory consumption of FastAPI process during peak local tasks. |
| NFR-12 | Graceful AI Degradation: system must execute all core ingestion, extraction, and comparison workflows offline using rules and dictionaries when no external AI API key is configured. | Execute test suite without API keys and verify all deterministic endpoints succeed. |

## 9. Acceptance criteria for the MVP

- A user can add a job by pasting text and by uploading a supported PDF or DOCX.
- The 11 baseline job records can be saved, with 10 marked `Available` and 1 marked `JD unavailable`.
- The system correctly filters listings by role family (`Family A`, `Family B`, `Family C`).
- A job record stores title, location, source URL when supplied, capture date, role family, status, and original description.
- A user can view, edit and delete a job record through the application, subject to confirmation for destructive actions.
- The system extracts a first-pass set of requirements and skills and marks them for review.
- Each extracted skill has a canonical name, category, requirement type and source evidence where available.
- The user can correct an extracted skill or requirement and the correction persists.
- The dashboard calculates distinct-job skill frequency across the 10 analysable jobs and separates required from preferred mentions.
- The profile matcher evaluates the CardLyze seeded profile and shows evidence status and separate experience/education gaps (specifically testing that the Reference Data Analyst role's postgraduate finance degree is flagged as an education gap).
- The user can paste or upload a resume (PDF/DOCX) and compare its keyword mentions against a chosen JD with matching lines from both texts (no single score).
- Resume parse checks flag empty or scrambled extractions, and unsupported claims are flagged against profile evidence.
- Learning resources can be added and progress can be updated.
- The application works without an external AI API key configured.
- Automated tests cover core parsing, normalisation, analytics and persistence behaviour.

## 10. Risks and unresolved requirements

| **Topic** | **Current position** | **Decision needed** |
| --- | --- | --- |
| Resume retention | Not fixed. | Keep original resume, keep extracted text only, or allow user-selectable retention. |
| OCR | Excluded from MVP. | Add only if scanned documents become a recurring input. |
| AI provider | Optional and secondary. | Choose provider and define redaction/consent rules before enabling. |
| Job refresh | Manual capture and verification dates. | Define how old listings are marked stale. |
| Resource verification | Store verification date and cost status. | Define review cadence and evidence for free status. |
| Scoring | No overall ATS score. | Maintain transparent dimension-by-dimension evaluation; avoid single black-box scores. |

## 11. Change management

Requirements should be versioned. A change should state its reason, affected modules, data migration impact, privacy impact and tests required. New features should not silently alter previously captured job snapshots or overwrite user-approved extraction corrections.

## 12. SRS baseline note

> [!NOTE]
> **Baseline status (v1.2):** This requirements specification represents the agreed baseline for the Phase 1 Local MVP. Items related to Cloud deployment and Firebase are specified in Sections 13 and 14 for Phase 2 implementation.

---

## 13. Phase 2 Architecture: Cloud Deployment, SQL & Firebase (Post-M7)

> [!NOTE]
> **Scope note:** The requirements in this section and Section 14 represent **Phase 2 (Cloud Extension)**. They are scheduled for implementation after Milestone M7 and do not block delivery of the Phase 1 Local-First MVP.

The system shall support optional cloud migration in Phase 2 using a React frontend deployed via Firebase Hosting, a containerized Python FastAPI backend, a hosted PostgreSQL database, and Firebase Realtime Database for selected real-time synchronization.

The SQL database (PostgreSQL in cloud deployment) shall remain the authoritative source of truth for durable business records, including job listings and snapshots, extracted requirements, skills, aliases, profile evidence, learning resources and learning progress. The system shall not maintain competing editable copies of these records in Firebase Realtime Database.

Database access shall be isolated behind repository/data-access interfaces so that the engine can transition from SQLite to PostgreSQL without modifying core business logic.

Firebase Realtime Database shall be used only for data that benefits from real-time synchronisation, such as batch job-processing progress, background task status or user notifications. The exact RTDB paths, data ownership, retention and security rules must be documented before integration.

Firebase Hosting shall host the compiled React frontend. The FastAPI backend shall run as a separate containerized service on a Python-capable backend host (e.g. Cloud Run, Railway, or VPS). The frontend shall communicate with the backend through HTTPS REST API requests.

Private SQL and Firebase administrative credentials shall remain server-side. No service-account private key, database password or privileged credential may be embedded in frontend assets or committed to source control.

Before cloud deployment, the project shall define authentication (e.g. Firebase Auth), authorization rules, CORS policy, secure secret storage, persistent file storage, database backups, logging and recovery procedures.

## 14. Phase 2 Component Responsibilities (Cloud Target)

**React:** User interface and client-side presentation only; deployed to Firebase Hosting; communicates with FastAPI via HTTPS; contains no database credentials or privileged business rules.

**FastAPI:** Authenticated API endpoints, input validation, orchestration and controlled access to backend services and SQL database.

**SQL Database (PostgreSQL):** Authoritative durable relational records, constraint enforcement, and analytical queries.

**Firebase Realtime Database:** Narrowly scoped live task state, progress notifications, and transient cache.

**Firebase Hosting:** Static asset delivery and HTTPS SSL termination for the frontend web application.

**Python service modules:** Document parsing, deterministic extraction, optional AI adapter, normalisation, analytics and profile matching.
