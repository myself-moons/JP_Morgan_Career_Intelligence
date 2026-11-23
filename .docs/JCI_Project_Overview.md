# JPMorgan Career Intelligence - Project Overview

*Purpose, business need, proposed solution, roadmap and project context*

| **Document status** | Baseline project overview (revised for local-first MVP & taxonomy alignment) |
| --- | --- |
| **Version / date** | 2.0 / 23 November 2026 |
| **Project scope** | JPMorgan Chase roles initially; local-first MVP (Phase 1) |

---

### Document Revision History

| Version | Date | Author / Reviewer | Summary of Changes |
| --- | --- | --- | --- |
| 1.0 | 17 Nov 2026 | Baseline Team | Initial draft baseline for project development. |
| 1.1 | 17 Nov 2026 | Documentation Review | Structural review and consistency cross-check. |
| 1.2 | 17 Nov 2026 | JCI Plan Review & Architecture Alignment | **Local-First MVP vs. Cloud Phase 2:** Formally defined two-phase roadmap. Phase 1 (Milestones M0–M7) delivers a 100% local-first application using React, Python FastAPI, and SQLite. Deferred Firebase Hosting, Realtime Database, and cloud hosting to Phase 2 (post-M7).<br>**UI alignment:** Confirmed React frontend with FastAPI backend across all specifications.<br>**Dataset & Status Definition:** Clarified initial collection of 11 JPMorgan Chase roles: 10 analysable JDs with full text and 1 record with status `JD unavailable` (*JPMorgan Data Governance – Senior Associate*).<br>**Baseline Taxonomy & Role Families:** Established three distinct functional role families: Family A (Data Management, Quality & Governance), Family B (Analytics, Automation & AI), and Family C (Finance, Credit & Operations).<br>**Realistic Target Priority:** Adjusted priority ranking based on deep JD analysis: (1) Applied AI & Data Science (1–5 yrs), (2) Data Quality Business Analytics (5+ yrs), (3) CAO Data Management (3+ yrs). Corrected title-only misconceptions (e.g. Data Analytics is FP&A; CR Portfolio Analytics is Commercial Real Estate credit risk).<br>**Expanded Skill Taxonomy:** Added finance/credit domain requirements (FP&A, GAAP/IFRS, credit analysis) and enterprise tools (Alteryx, Databricks, Snowflake, Informatica, Collibra) alongside core technical skills.<br>**CardLyze Profile Seed (M5):** Added requirement to pre-seed the user profile with the CardLyze project and its explicit contribution split (independent requirements, data dictionaries, EDA vs. AI-assisted codebase implementation) per FR-19 before matching tests.<br>**Strategic Learning Order:** Defined the common core foundation (SQL depth, Python/Pandas, DQ/reconciliation, BI dashboarding, AI-assisted analytics) followed by track-specific specialization. |
| 2.0 | 23 Nov 2026 | Architecture & Implementation Review | **Taxonomy & Comparative Analytics Delivery:** Documented completion of M3 (Canonical Skill Taxonomy, Alias Engine, Human Review Workspace) and M4 (Comparative Analytics Engine, Cross-Role Matrix, Evidence Snippet Inspector).<br>**Live Job Sync & Automation:** Added live Oracle Cloud CX integration, multi-resume workspace with LaTeX compilation, daily GitHub Actions watcher with email alerts, and 35 automated pytest tests passing in CI. |

---

## 1. Executive summary

JPMorgan Career Intelligence (JCI) is a personal, local-first career research and decision-support application. It will collect JPMorgan Chase job descriptions, convert their requirements into structured information, compare skills across roles, and evaluate those requirements against an evidence-based professional profile. It will then help prioritise learning resources that address genuine gaps.

The initial version is intended for one user and JPMorgan Chase listings. It is not an applicant-tracking system, a hiring predictor, or a tool that can guarantee interview selection. Its purpose is to make career preparation more systematic, traceable and grounded in actual job requirements.

## 2. Why this project is needed

Job descriptions are often long, inconsistent and written for different teams. Similar skills may be described using different terms, while roles with similar titles may require very different experience, domain knowledge or qualifications. Reviewing many listings manually makes it difficult to identify recurring requirements and distinguish a learnable skill gap from a formal eligibility gap.

- A central library is needed to preserve job descriptions, source links and the date each listing was captured.
- A consistent way is needed to extract required and preferred skills, experience, qualifications and responsibilities.
- Comparisons are needed to identify common skills across roles as well as specialist skills for individual job families.
- A profile comparison should distinguish demonstrated ability from partial exposure, current learning and unsupported claims.
- Learning recommendations should be connected to specific gaps and should show whether a resource is genuinely free.
- The analysis should remain explainable: users should be able to trace a skill or requirement back to the source text.

## 3. Project goals

- Build a searchable library of JPMorgan Chase job listings.
- Extract structured job information with source evidence and human review.
- Measure skill frequency and coverage across the selected listings.
- Compare role requirements with the user's education, experience and practical evidence.
- Separate technical, functional, domain, education and experience alignment.
- Map priority gaps to relevant courses, certifications and job simulations.
- Track learning progress and support later export to CSV or Excel.

## 4. Current proposed plan

| **Area** | **Phase 1: Local-First MVP (Current)** | **Phase 2: Cloud Extension (Post-M7)** | **Reason / Implication** |
| --- | --- | --- | --- |
| Initial scope | JPMorgan Chase only | Multi-firm or broader finance | Keeps the initial taxonomy and analysis focused; architecture supports expansion later. |
| Job input | Manual paste and PDF/DOCX upload | Automated URL ingestion / browser integration | Reliable MVP inputs without depending on fragile website scraping. |
| URL handling | Store source URL, capture date, and status | Automated refresh and link monitoring | Preserves provenance while avoiding premature browser automation. |
| Analysis engine | Hybrid: deterministic rules plus optional local/AI assistance | Managed AI service adapter with privacy redaction | Rules provide 100% repeatability; AI assistance remains strictly reviewable. |
| Frontend interface | React web frontend (Vite / React) running locally | Firebase Hosting for static asset delivery | High-performance, modern dashboard for tables, filters, charts and review workflows. |
| Backend API | Python FastAPI service running locally on localhost | Containerized FastAPI on cloud host (e.g. Cloud Run, Railway) | Clean REST boundary decoupling core analytics from presentation. |
| Data processing | Pandas + Python service modules | Pandas / PySpark where dataset size warrants | Fast tabular calculations, normalisation, and matrix comparisons. |
| Database | SQLite relational database (`jci_local.db`) with web-based DB Console | Hosted PostgreSQL with automated backups | Zero-configuration single-user persistence for MVP; visual web console for real-time table inspection (equivalent to Firebase Console). |
| Document parsing | PyMuPDF (PDF) + python-docx (DOCX) | Async background worker queue for document OCR | Reliable local text extraction from common job and resume formats. |
| Visualisation | Plotly / Recharts | Plotly interactive dashboards | Clear skill coverage bars, role comparisons, and multi-dimensional gap radars. |
| Testing | Pytest test suite with automated test cases | CI/CD automated pipeline | Continuous verification of parsing, normalisation, matching, and calculations. |
| Realtime updates | Not needed for local single-user analysis | Firebase Realtime Database for batch progress | Local SQLite queries execute in milliseconds; RTDB is deferred until cloud batching requires it. |

## 5. Proposed user workflow

1. **Add a job:** paste its description or upload a PDF/DOCX; record company, title, external job ID, location, source URL, role family, and capture date.
2. **Review extraction:** inspect parsed text side-by-side with extracted experience, qualifications, skills, and responsibilities.
3. **Correct and confirm:** edit incorrect classifications, map approved aliases, and confirm structured requirements.
4. **Compare listings:** view recurring skills, mandatory versus preferred requirements, and role-specific patterns across Families A, B, and C.
5. **Maintain profile:** record education, work history, projects, and supporting evidence with verified contribution types (independent, AI-assisted, supervised).
6. **Review fit and gaps:** inspect technical, functional, domain, education, and experience dimensions separately.
7. **Plan learning:** map identified gaps to vetted learning resources, track progress, and update evidence upon completing practical deliverables.

## 6. Proposed analytical approach

### 6.1 Job-skill frequency

For a selected set of $N$ distinct analysable jobs, skill coverage is calculated as:
$$\text{Coverage}(\%) = \left( \frac{\text{Distinct Jobs Mentioning Skill}}{N} \right) \times 100$$
- In the initial baseline research dataset, $N = 10$ analysable jobs (the 1 listing with status `JD unavailable` is excluded from the denominator).
- Required and preferred mentions are calculated and reported separately.
- Frequency is an exploratory research signal, not an absolute guarantee that a skill is universally mandatory.

### 6.2 Evidence-based profile matching

| **Evidence status** | **Meaning** | **How it should be treated** |
| --- | --- | --- |
| Demonstrated | Practical evidence exists and the user can explain the work. | Can count as supported evidence for matching. |
| Partial | Some exposure exists, but independent application is not yet reliable. | Show as a development area; do not present as mastery. |
| Learning | Currently studying or practising the skill. | Show progress, but do not treat as demonstrated proficiency. |
| Not demonstrated | No supporting evidence is currently recorded. | Show as an evidence gap, not necessarily proof of inability. |

The platform shall not infer proficiency from course completion alone. It preserves the crucial distinction between independently implemented work, AI-assisted implementation, supervised work, and testing/validation.

### 6.3 Fit dimensions

- **Technical alignment:** languages (Python, SQL), databases, analytical tools (Alteryx, Databricks, Snowflake), and reporting platforms (Tableau, Power BI).
- **Functional alignment:** data quality profiling, anomaly detection, reconciliation controls, governance frameworks, and operational monitoring.
- **Domain alignment:** financial services, reference data operations, corporate payments, credit risk analysis, transaction monitoring, or FP&A.
- **Education alignment:** stated bachelor's, master's, postgraduate finance, or specialist degree requirements.
- **Experience alignment:** explicit stated years, relevant industry background, and seniority expectations.
- **Evidence strength:** whether the profile contains verifiable, explainable deliverables for the claimed skills.

### 6.4 Baseline Role Families & Target Priority Order

Deep review of the collected job listings indicates that job titles alone are frequently misleading. The 11 roles fall into three distinct functional families:

#### Role Families

- **Family A: Data Management, Quality and Governance**
  - *CAO Chief Data Office - Data Management - Associate (3+ years)*
  - *Chief Data Office - Data Quality - Business Analytics Associate (5+ years)*
  - *JPMorgan Data Governance – Senior Associate (Status: JD unavailable)*
- **Family B: Analytics, Automation and AI**
  - *Applied AI and Data Science Specialist – Global Research Modernization (1–5 years)*
  - *Analytics Solution - Associate (10+ years)* (Payments Finance automation)
  - *Data Analytics Associate (5+ years)* (Asset & Wealth Management FP&A role requiring GAAP/IFRS)
  - *CR Portfolio Analytics - Associate (3+ years)* (Commercial Real Estate credit risk)
- **Family C: Finance, Credit and Operations**
  - *Reference Data Analyst (requires postgraduate qualification in finance)*
  - *Analyst - Project Finance & Infrastructure Credit Risk*
  - *Corporate & Investment Bank Credit Risk Analyst*
  - *Corporate Payment Sales - Analyst (2+ years)*

#### Realistic Target Priority Order

1. **Applied AI and Data Science Specialist (1–5 years):** Highest strategic alignment on experience requirements. Core gaps: NLP pipelines, LLM workflow automation, and formal model validation.
2. **Data Quality Business Analytics Associate (5+ years):** Exceptional skills match on SQL, Python, dashboards, data profiling, anomaly detection, reconciliation, and AI enablement. Gaps: Alteryx, enterprise DQ tools (Informatica/Collibra), and stated years of experience (though the JD explicitly accepts "equivalent depth").
3. **CAO Data Management Associate (3+ years):** Strong operational and data governance fit. Gaps: formal enterprise governance vocabulary, metadata cataloguing, and years of experience.
4. *Other roles:* Roles in Family C depend heavily on formal finance postgraduate qualifications, while *Analytics Solution* (10+ yrs) serves primarily as a valuable technology stack blueprint (Python, SQL, Databricks, reconciliation, React dashboards) rather than an immediate target.

### 6.5 Strategic Learning Progression Order

Based on the hand-tallied baseline frequencies, the user's learning path should follow a two-tier sequence:

1. **Tier 1: Core Foundation (Shared across all target opportunities):**
   - **SQL Depth:** Complex queries, window functions, data validation, reconciliation scripts.
   - **Python & Pandas:** Data blending, automated profiling, parsing, and pipeline scripts.
   - **Data Quality & Controls:** Profiling techniques, reconciliation frameworks, data dictionary authoring, anomaly detection.
   - **Business Intelligence Dashboarding:** Hands-on dashboard construction in Power BI or Tableau.
   - **AI-Assisted Analytics:** Applying AI/LLMs to accelerate analysis, automate data wrangling, and draft documentation.
2. **Tier 2: Specialized Branching:**
   - **Branch A (Governance & Quality Track):** Enterprise data governance concepts, metadata repositories, data lineage, Collibra/Informatica workflows.
   - **Branch B (Advanced Analytics & AI Track):** Applied ML workflows, NLP text mining, LLM orchestration, model validation, and Databricks/PySpark basics.

## 7. Initial data and scope

The initial research dataset contains the **11 JPMorgan Chase roles** collected by the project maintainer:
- **10 analysable listings** with complete job description text.
- **1 placeholder listing** with status `JD unavailable` (*JPMorgan Data Governance – Senior Associate*).

#### Approximate Hand-Tallied Skill Frequencies (Baseline across 10 Analysable JDs)

| Skill / Competency Area | Approximate Roles Mentioned (Out of 10) | Coverage |
| --- | --- | --- |
| Stakeholder Communication & Synthesis | 10 of 10 | 100% |
| AI / GenAI / Automation | ~6 of 10 | ~60% |
| Data Quality, Controls & Reconciliation | ~6 of 10 | ~60% |
| Python (Extraction, Analytics, Automation) | 5 of 10 | 50% |
| BI Dashboards (Tableau, Power BI, Qlik, Sigma) | 5 of 10 | 50% |
| SQL (Querying, Data Manipulation) | 4 of 10 | 40% |
| Alteryx (Analytics Workflows) | 3 of 10 | 30% |
| Governance, Lineage, Metadata | 3 of 10 | 30% |
| Databricks / Snowflake / Big Data | 2 of 10 | 20% |
| Finance / Credit / FP&A Domain Knowledge | 5 of 10 | 50% |

> [!IMPORTANT]
> **Important:** A job listing is a time-sensitive snapshot. Store the original description, source URL, capture date, role family, and availability status. Do not silently overwrite an older description when a listing changes.

## 8. High-level architecture

| **Layer** | **Phase 1: Local MVP Component** | **Phase 2: Cloud Component** | **Responsibility** |
| --- | --- | --- | --- |
| Presentation | React frontend (Vite/React) | Firebase Hosting | Job library, review screens, analysis dashboard, profile matcher, and learning tracker. |
| API & Orchestration | Local FastAPI service | Containerized FastAPI | Validated REST endpoints, background processing, and service orchestration. |
| Analytical Services | Python service modules | Python service modules | Parsing, extraction, normalisation, comparison, matching, and recommendations. |
| Persistence | SQLite (`jci_local.db`) | Hosted PostgreSQL | Authoritative relational store for jobs, skills, requirements, profile evidence, and learning. |
| Local File Store | Local private `uploads/` | Cloud Object Store (e.g. S3 / GCS) | Original uploaded PDFs, DOCXs, and generated exports. |
| Analysis & Charts | Pandas + Plotly | Pandas + Plotly | Tabular calculations, matrix calculations, and interactive charts. |
| Quality & Testing | Pytest test suite | CI/CD automated pipeline | Regression tests and validation of extraction, normalisation, and matching logic. |

The Python service layer does not depend on the UI framework, ensuring full portability between local development and future deployment targets.

## 9. Development roadmap

| **Milestone** | **Focus** | **Expected Outcome** |
| --- | --- | --- |
| **M0** | Project foundation | Repository structure, Python virtualenv, React setup, FastAPI stub, dependencies, and v1.2 docs. |
| **M1** | Database, ingestion & DB Console | SQLite schema; add, view and edit jobs; paste and PDF/DOCX input; preserve immutable original text; record `role_family` and `status`; integrate web-based SQL Database Console (FR-41) for real-time table inspection (Firebase Console equivalent). |
| **M2** | Job description processing | Cleaned text generation; deterministic extraction of experience, qualifications, responsibilities, and requirement statements. |
| **M3** | Skill taxonomy and review | Canonical skills, aliases, categories, evidence snippets, and human correction review workflow. |
| **M4** | Comparative analytics | Distinct-job skill coverage across the 10 analysable JDs, required vs. preferred split, and role family filters (A, B, C). |
| **M5** | Profile matcher, CardLyze seed & Resume Coverage | **Seed user profile with the CardLyze project baseline** (recording independent requirements/EDA vs. AI-assisted implementation per FR-19); evaluate multi-dimensional fit; verify Reference Data Analyst postgraduate degree as an education gap. Implement **Resume Keyword Coverage (FR-37 to FR-40)** for line-by-line JD skill comparison, parse check warnings, and claimed-unsupported checks. |
| **M6** | Learning intelligence | Vetted resource catalogue, gap-to-course mapping, and learning-progress tracking. |
| **M7** | Validation and local delivery | Complete automated test suite, exports (CSV/Excel), database backup/restore procedures, and privacy audit. |

#### Phase 2: Cloud & Firebase Extension (Post-M7)

Following delivery of the local MVP (M0–M7), the project may optionally implement Phase 2:
- Containerizing FastAPI for remote deployment.
- Hosting the compiled React application via Firebase Hosting.
- Migrating the relational database from SQLite to hosted PostgreSQL.
- Integrating Firebase Realtime Database for batch job processing status and user notifications.
- Establishing remote authentication, authorization, and cloud secret management.

## 10. Risks and controls

| **Risk** | **Potential Effect** | **Control** |
| --- | --- | --- |
| Inaccurate extraction | Incorrect skill counts or misleading recommendations. | Display exact source evidence snippets; allow human review; test deterministic rules. |
| Skill synonym errors | Distinct skills merged inappropriately or duplicate terms retained. | Use a controlled alias map and human-approved canonical names. |
| Small job sample | Overgeneralised conclusions about JPMorgan hiring. | Display sample size ($N = 10$) and role family filters; label findings as sample-specific. |
| Stale job listings | Analysis reflects closed vacancies. | Store capture dates, verification dates, and availability status. |
| False proficiency claims | Misleading profile matches and incorrect career preparation. | Record explicit evidence states (Demonstrated, Partial, Learning) and contribution types. |
| Privacy exposure | Personal resume data or secrets committed to repository. | Strictly exclude uploads, SQLite databases, and environment files from Git via `.gitignore`. |
| Premature cloud complexity | Development stalls on cloud infrastructure before core logic works. | Strict adherence to Phase 1 Local MVP: React + FastAPI + SQLite with zero cloud dependencies. |
| AI dependency or cost | Application fails when external AI is offline or costly. | Deterministic rule-based baseline; optional AI adapter remains replaceable. |

## 11. Out of scope for the first MVP

- Automated scraping or live crawling of JPMorgan Chase career portals.
- Automated job applications, recruiter emailing, or interview selection prediction.
- A singular ATS score or speculative hiring probability claims.
- Multi-company taxonomy expansion or multi-user collaborative access.
- Mandatory paid AI APIs, cloud databases, or cloud infrastructure.
- Automatic course enrolment or credential certification verification.

## 12. Success criteria

- All 11 baseline job records can be stored and retrieved across application restarts (10 `Available`, 1 `JD unavailable`).
- Listings can be cleanly filtered and grouped by Role Family (Families A, B, and C).
- Each extracted requirement can be traced directly to its source evidence snippet.
- Users can correct extraction results without altering the immutable original text.
- Required and preferred skills are reported and filtered separately.
- Skill coverage calculations are mathematically verifiable across the 10 analysable jobs.
- Profile matching evaluates the CardLyze seeded baseline with accurate attribution (independent vs. AI-assisted).
- Formal education prerequisites (e.g. Reference Data Analyst postgraduate finance degree) are strictly separated from technical skill gaps.
- The entire application operates locally without cloud credentials or an external AI API key.
- Private documents, uploaded files, and SQLite database files are excluded from Git.

## 13. Decisions confirmed in v1.2

- **UI Architecture:** Confirmed React web frontend with Python FastAPI backend.
- **Phase Boundary:** Phase 1 is 100% local-first (React + FastAPI + SQLite). Phase 2 is the cloud extension (post-M7).
- **Initial Dataset:** 11 total listings (10 analysable JDs + 1 placeholder with status `JD unavailable`).
- **Role Taxonomy:** Standardized on Families A, B, and C.
- **Profile Seed:** CardLyze project seeded in Milestone M5 with verified contribution attribution.
- **Evaluation Rule:** Formal degree/education prerequisites are evaluated exclusively as education gaps.

## 14. Glossary

| **Term** | **Meaning in JCI** |
| --- | --- |
| Job description (JD) | The source text describing a vacancy, its responsibilities, and qualifications. |
| Requirement | A structured statement regarding skills, experience, qualifications, or responsibilities. |
| Canonical skill | The standardized, normalized skill name used across all analytics. |
| Alias | An alternate phrase or synonym mapped to an approved canonical skill. |
| Role Family | A functional job cluster: Family A (Governance/DQ), Family B (Analytics/AI), Family C (Finance/Operations). |
| Evidence snippet | The verbatim excerpt from the JD supporting an extracted requirement. |
| Coverage | The percentage of analysed jobs ($N = 10$) that mention a given skill. |
| Profile evidence | A verified project, deliverable, or role supporting the user's skill claim. |
| Contribution type | The nature of the user's involvement: independent, AI-assisted, or supervised. |

---

## 15. Phase 2 Architecture: Cloud Deployment, SQL & Firebase (Post-M7)

> [!NOTE]
> **Scope note:** This section describes the architectural target for **Phase 2 (Cloud Extension)**. It is planned for deployment following completion of Phase 1 (Milestones M0–M7). Phase 1 remains entirely local-first.

In Phase 2, the project may implement a distributed cloud deployment:
- **React Frontend:** Compiled into static production assets and served globally via Firebase Hosting over HTTPS.
- **FastAPI Backend:** Containerized with Docker and hosted on a Python-capable cloud host (e.g. Cloud Run, Railway, or AWS).
- **SQL Database:** Migrated from SQLite to a managed PostgreSQL database instance, serving as the sole authoritative system of record for all business entities.
- **Firebase Realtime Database:** Utilized as a complementary transient store for live job-processing progress, long-running task status, and real-time frontend notifications. RTDB shall never store duplicate copies of relational business records.
- **Security & Access Control:** Private SQL and Firebase administrative service-account credentials remain strictly on the backend. Authentication (via Firebase Auth) and granular authorization rules must be established before exposing endpoints to the public internet.

#### Phase 2 Component Mapping

- **React frontend:** Web UI, client-side routing, state management, and presentation.
- **Firebase Hosting:** Global CDN delivery and HTTPS SSL termination for the static React bundle.
- **FastAPI backend:** Secure REST API gateway, input validation, orchestration, and business logic execution.
- **SQL database (PostgreSQL):** Authoritative, ACID-compliant relational data store.
- **Firebase Realtime Database:** Real-time progress updates, task queues, and user notifications.
- **Python services:** Deterministic document extraction, NLP/AI adapters, normalisation, and matching algorithms.

---

## 16. Alignment with JPMorgan Chase Enterprise Data Roles & Resume Positioning

This platform is architected to mirror the exact functional competencies evaluated in JPMorgan Chase data teams, including the **Chief Data Office (CDO)**, **Asset & Wealth Management Analytics (AWM)**, and **Corporate & Investment Bank (CIB)**:

| JPMC Data Role Competency | How JCI Implements It Under the Hood |
| :--- | :--- |
| **Data Quality (DQ) & Reconciliation Controls** *(Chief Data Office / CAO)* | • **Active Denominator Governance ($N=10$, BR-06):** Unavailable listings are excluded from frequency denominators so statistical percentages are never skewed.<br>• **Single-Count Constraint (BR-07, TC-11):** Deduplicates repeated mentions within a single listing to prevent frequency distortion.<br>• **Deduplication:** Hash keys and external job ID matching (`JPMC-REQ-XX`). |
| **Master Data Management (MDM) & Taxonomy** *(Data Governance / Metadata)* | • **Canonical Taxonomy Engine:** Standardizes 60+ raw aliases, abbreviations, and misspellings into 35+ canonical enterprise entities.<br>• **100% Data Lineage & Traceability:** Every extracted skill links permanently to immutable, verbatim sentence evidence snippets. |
| **ETL Pipeline & REST API Integration** *(Analytics Solution / Automation)* | • **Automated Extraction:** Ingests live job descriptions from JPMorgan Chase's Oracle Cloud REST API (`CX_1001`).<br>• **Data Normalization:** Parses unstructured HTML and multi-page PDFs into structured relational tables (SQLAlchemy + SQLite). |
| **Comparative & Exploratory Data Analysis (EDA)** *(Asset & Wealth Management / FP&A)* | • **Cross-Role Matrix & Distribution:** Computes distinct-job frequency percentages across 3 functional Role Families (Family A: Governance/DQ, Family B: Analytics/AI, Family C: Finance/Operations). |
| **Pipeline Orchestration & Alerting** *(Global Research Modernization)* | • **Automated Scheduled Execution:** GitHub Actions cron running daily at 08:30 IST to trigger sync pipelines, rank matches, and deliver executive HTML/Markdown digests via Gmail SMTP. |

### Resume Framing Guide

#### Option A: For Data Analyst / Business Analytics Associate Roles
> **JPMorgan Chase Labor Market Analytics & Requirement Intelligence Platform**
> - **Engineered an automated data pipeline** ingesting and cleaning 100+ live JPMorgan Chase job descriptions via Oracle Cloud REST APIs, extracting structured requirements across technical, domain, and experience dimensions.
> - **Designed a comparative analytics engine** computing distinct-job skill coverage and cross-role matrix distributions across 3 functional banking families, enforcing data quality rules to exclude unavailable records from statistical denominators ($N=10$).
> - **Developed an interactive analytics dashboard** featuring dynamic filtering by role family, requirement severity (Must-Have vs. Nice-to-Have), and click-to-inspect data lineage modals.
> - **Automated daily pipeline orchestration** via GitHub Actions cron, publishing scheduled executive digests and alerting with zero manual intervention.
> - **Tech Stack:** *Python, FastAPI, SQLite, Pandas/NumPy, React, TypeScript, REST APIs, GitHub Actions, Pytest.*

#### Option B: For Chief Data Office (CDO) / Data Governance Roles
> **Enterprise Competency Taxonomy & Data Quality Governance Framework**
> - **Architected a master data management (MDM) taxonomy engine** resolving 60+ unstructured aliases, synonyms, and variations into 35+ canonical banking and analytics competencies with deterministic regex word-boundary logic.
> - **Implemented strict data governance controls and full data lineage**, guaranteeing that 100% of extracted requirements are permanently linked to immutable verbatim source evidence snippets.
> - **Integrated a hybrid disambiguation pipeline** utilizing Google Gemini Flash LLM adapter for semantic edge-case classification, backed by an offline heuristic fallback and SQLite SHA-256 fingerprint caching.
> - **Established automated data quality validation rules (BR-01 to BR-15)**, preventing composite score skewing and isolating formal educational prerequisites into distinct eligibility metrics.
> - **Tech Stack:** *Python, SQL, SQLite, PyMuPDF, Data Governance (BCBS 239/Lineage principles), REST APIs, Pytest.*
