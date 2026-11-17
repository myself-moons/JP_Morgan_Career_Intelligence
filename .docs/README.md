# JPMorgan Career Intelligence (JCI) - Documentation Index

**Version 1.2 | 17 November 2026**

This directory contains the authoritative specification, architecture, and baseline research dataset for the **JPMorgan Career Intelligence (JCI)** platform. All documents have been aligned to **Version 1.2** based on the findings and recommendations of the *JCI Plan Review*.

---

## Document Suite

| Document | Primary Focus | Key Contents |
| --- | --- | --- |
| [JCI_Project_Overview.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_Project_Overview.md) | **Strategic Vision & Roadmap** | Executive summary, business rationale, goals, 2-phase architectural plan (Local MVP vs Cloud Extension), 7-step user workflow, analytical methodology, 11-job scope, hand-tallied baseline frequencies, Role Families (A, B, C), target priority ranking, strategic learning sequence, and risk controls. |
| [JCI_SRS.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_SRS.md) | **Software Requirements Specification** | Product perspective, operating environment (React + FastAPI + SQLite), system boundaries, user classes, architectural constraints, external interfaces, relational entity data model (with `role_family` and `status`), 10 non-functional requirements (NFR-01 to NFR-10), acceptance baseline, and Phase 2 cloud specifications. |
| [JCI_FRS.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_FRS.md) | **Functional Requirements Specification** | 28 core functional requirements (FR-01 to FR-28) for Phase 1, 8 deferred Phase 2 cloud requirements (FR-29 to FR-36), 6 detailed operational workflows, 13 business validation rules (including BR-13 for education gap isolation), dashboard view definitions, exception handling, 19 test scenarios (including TC-19), and release priorities. |
| [Job_Listings.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/Job_Listings.md) | **Research Dataset & Taxonomy Baseline** | Full text and metadata for all 11 collected JPMorgan Chase job listings (10 analysable JDs with full text, 1 placeholder record with status `JD unavailable`), annotated with Role Families (Family A, Family B, Family C), availability status, and analytical context notes. |
| [JCI_Plan_Review.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_Plan_Review.md) | **Plan Review & Alignment Findings** | Markdown transcript of the JD analysis and plan review notes: CardLyze evidence attribution, role family insights, hand-tallied skill counts, and the 9 key plan rewording recommendations. |
| [phases.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/phases.md) | **Implementation Roadmap & Sequential Phases** | Master implementation plan breaking down Phase 1 Local-First MVP (Milestones M0–M7) and Phase 2 Cloud Extension into detailed step-by-step tasks, file structures, schemas, and verification checklists. |

---

## Key Alignment Decisions in Version 1.2

1. **UI Framework Harmonization:** Resolved legacy interface conflicts in the SRS by standardizing on a **React web frontend** communicating with a **Python FastAPI backend** over HTTP/REST.
2. **Two-Phase Architectural Boundary:**
   - **Phase 1: Local-First MVP (Milestones M0–M7):** Strictly local, single-user system utilizing React, Python FastAPI, and a local SQLite database (`jci_local.db`). Operates 100% offline without requiring paid cloud hosting, cloud relational databases, or external AI API keys.
   - **Phase 2: Cloud Extension (Post-M7):** Optional cloud deployment utilizing Firebase Hosting (static React bundle), containerized FastAPI backend, hosted PostgreSQL, and Firebase Realtime Database for batch job-processing status. Requirements FR-29 to FR-36 are formally assigned release priority **"Later"**.
3. **Dataset Definition & Frequency Calculation:** The baseline research collection contains 11 listings:
   - **10 analysable listings** with complete job description text.
   - **1 placeholder listing** with status `JD unavailable` (*JPMorgan Data Governance – Senior Associate*).
   - The skill frequency denominator is strictly the count of analysable jobs ($N = 10$).
4. **Role Family Taxonomy:** Grouped the 11 roles into three functional families:
   - **Family A: Data Management, Quality and Governance** (CAO Data Management, Data Quality Business Analytics, Data Governance).
   - **Family B: Analytics, Automation and AI** (Applied AI and Data Science, Analytics Solution, Data Analytics, CRE Portfolio Analytics).
   - **Family C: Finance, Credit and Operations** (Reference Data Analyst, Project Finance Credit Risk, CIB Credit Risk, Corporate Payment Sales).
5. **Realistic Target Priority:** Adjusted career preparation targets based on deep JD analysis rather than titles alone:
   1. *Applied AI and Data Science Specialist (1–5 yrs)*: Optimal fit on years of experience. Gaps: NLP, LLM automation, model validation.
   2. *Data Quality Business Analytics Associate (5+ yrs)*: High technical skill overlap (SQL, Python, dashboards, profiling & reconciliation, AI enablement). Gaps: Alteryx, enterprise DQ tools (Informatica/Collibra), and stated years (JD accepts "equivalent depth").
   3. *CAO Data Management Associate (3+ yrs)*: Strong governance fit. Gaps: formal enterprise metadata and governance vocabulary.
6. **Education vs. Skill Gap Isolation (BR-13 & TC-19):** Formal degree and licensing prerequisites (specifically the Reference Data Analyst role's postgraduate finance degree requirement) must be evaluated exclusively as **Education / Formal Eligibility Gaps** and never lumped into technical skill gaps or masked behind a single composite score.
7. **CardLyze Profile Seed (Milestone M5):** Pre-seed the profile before M5 matching tests with the CardLyze project and its explicit contribution attribution (TMS-ATM requirements, data dictionaries, and EDA notebook as independent work; codebase implementation as AI-assisted) per FR-19.
8. **Structured Learning Progression:** Common foundational core (SQL depth, Python/Pandas, data quality controls, BI dashboarding, AI-assisted analytics) followed by track specialization in Governance (Branch A) or AI/Automation (Branch B).
