# JPMorgan Career Intelligence (JCI)

**Version 1.2 | 17 November 2026**

JPMorgan Career Intelligence (JCI) is a personal, local-first career research and decision-support application. It collects JPMorgan Chase job descriptions, extracts their technical, functional, domain, experience, and educational requirements into structured data, compares skill coverage across roles, and evaluates those requirements against an evidence-based professional profile. It helps prioritize verified learning resources that address genuine gaps without relying on black-box scoring or speculative hiring predictions.

---

## Key Highlights & Architectural Principles

- **Local-First Architecture (Phase 1 MVP):** Built as a fast, 100% local-first application using a modern **React web frontend**, a **Python FastAPI backend**, and a **local SQLite database** (`jci_local.db`). Requires zero paid cloud infrastructure or external AI API keys for core operations.
- **Hybrid Intelligence for Low-Spec Hardware:** Specifically optimized to run smoothly on low-spec client hardware (e.g. 4.00 GB RAM dual-core CPUs) without memory exhaustion or disk swap thrashing. Local storage and deterministic parsers run under 150 MB RAM, while heavy semantic skill disambiguation (M3) and qualitative resume critique (M5) route through a zero-RAM external cloud LLM adapter (Google Gemini / Groq free tier) with graceful offline fallback.
- **Traceable Extraction:** Every extracted requirement and skill is permanently linked to an immutable source evidence snippet from the original job description.
- **Explainable Multi-Dimensional Matching:** Separates technical alignment, functional domain alignment, experience seniority, and formal education/licensing prerequisites. Formal degree requirements are reported strictly as **Education / Eligibility Gaps**, not as learnable skill gaps.
- **Honest Evidence Attribution (FR-19):** Distinguishes independent implementation, AI-assisted implementation, supervised work, and theoretical course completions. Validated against the CardLyze project profile baseline.
- **Phased Cloud Roadmap:** Cloud hosting (Firebase Hosting, hosted PostgreSQL, containerized FastAPI, and Firebase Realtime Database) is cleanly defined as **Phase 2 (Post-M7)**, preventing premature infrastructure overhead during MVP development.

---

## Role Families & Baseline Research Dataset

The initial research dataset encompasses **11 JPMorgan Chase job descriptions** categorized into three functional role families:

| Role Family | Focus Area | Baseline Listings Included |
| --- | --- | --- |
| **Family A** | **Data Management, Quality and Governance** | • CAO Chief Data Office - Data Management - Associate (3+ yrs)<br>• Chief Data Office - Data Quality - Business Analytics Associate (5+ yrs)<br>• JPMorgan Data Governance – Senior Associate *(Status: `JD unavailable`)* |
| **Family B** | **Analytics, Automation and AI** | • Applied AI and Data Science Specialist – Global Research Modernization (1–5 yrs)<br>• Analytics Solution - Associate (10+ yrs) *(Payments Finance automation)*<br>• Data Analytics Associate (5+ yrs) *(Asset & Wealth Management FP&A)*<br>• CR Portfolio Analytics - Associate (3+ yrs) *(Commercial Real Estate credit risk)* |
| **Family C** | **Finance, Credit and Operations** | • Reference Data Analyst *(Requires postgraduate qualification in finance)*<br>• Analyst - Project Finance & Infrastructure Credit Risk<br>• Corporate & Investment Bank Credit Risk Analyst<br>• Corporate Payment Sales - Analyst (2+ yrs) |

*Active Denominator ($N$):* 10 analysable listings (the 1 unavailable listing is excluded from skill frequency denominators).

---

## Project Documentation Suite

Complete project specifications are maintained in the [`.docs/`](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs) directory:

1. [**Project Overview** (`JCI_Project_Overview.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_Project_Overview.md)  
   Executive summary, rationale, goals, 2-phase architecture, 7-step user workflow, analytical methodology, 11-job scope, hand-tallied baseline frequencies, target priority order, strategic learning paths, and 7 core development milestones (M0–M7).

2. [**Software Requirements Specification** (`JCI_SRS.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_SRS.md)  
   System boundary, operating environment (React + FastAPI + SQLite), user classes, system constraints, entity data model (with `role_family` and `status`), 10 non-functional requirements (NFR-01 to NFR-10), acceptance criteria, and Phase 2 cloud specifications.

3. [**Functional Requirements Specification** (`JCI_FRS.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_FRS.md)  
   28 Phase 1 functional requirements (FR-01 to FR-28), 8 Phase 2 cloud requirements (FR-29 to FR-36), 6 detailed operational workflows, 13 business validation rules (including BR-13 for education gap isolation), dashboard outputs, exception handling, 19 functional test scenarios (including TC-19), and release priorities.

4. [**Job Listings Dataset** (`Job_Listings.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/Job_Listings.md)  
   Full text and metadata for all 11 collected JPMorgan Chase job listings, annotated with Role Family badges, availability status, and analytical context notes.

5. [**Plan Review & Alignment Findings** (`JCI_Plan_Review.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_Plan_Review.md)  
   Full text review transcript covering evidence attribution, role family insights, hand-tallied baseline skill counts, and key rewording recommendations.

6. [**Implementation Roadmap & Sequential Phases** (`phases.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/phases.md)  
   Master implementation plan detailing sequential execution phases, file deliverables, and acceptance checkpoints for Phase 1 Local MVP and Phase 2 Cloud.

7. [**Documentation Index** (`.docs/README.md`)](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/README.md)  
   Quick reference and navigation guide for all project documentation.

---

## Development Milestones (Phase 1: Local MVP)

- **M0: Foundation:** Project structure, Python environment, React setup, FastAPI stub, dependencies, and v1.2 docs.
- **M1: Database & Ingestion:** SQLite schema, job library, paste & PDF/DOCX ingestion, preserving immutable original text.
- **M2: JD Processing:** Text cleaning, deterministic extraction of experience, qualifications, responsibilities, and requirements.
- **M3: Taxonomy & Review:** Canonical skills, aliases, categories, source evidence snippets, human review workflow, and AI-assisted semantic disambiguation (FR-42).
- **M4: Comparative Analytics:** Distinct-job skill frequency across the 10 analysable JDs, required vs. preferred split, and role family filters.
- **M5: Profile Matcher, Resume Coverage & AI Critique:** Seed profile with CardLyze project (recording independent vs. AI-assisted attribution per FR-19), evaluate multi-dimensional fit, line-by-line resume keyword coverage (FR-38), and AI semantic resume critique & rewording (FR-43).
- **M6: Learning Intelligence:** Vetted resource catalogue, gap-to-course mapping, and progress tracking.
- **M7: Validation & Delivery:** Full automated test suite (Pytest), CSV/Excel exports, SQLite backup/restore procedures, and privacy review.
