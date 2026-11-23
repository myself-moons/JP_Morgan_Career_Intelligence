# JPMorgan Career Intelligence (JCI) - Documentation Index

**Version 2.0 | November 2026**

This directory contains the authoritative specification, architecture, baseline research dataset, and operational guides for the **JPMorgan Career Intelligence (JCI)** platform. All documents have been aligned to **Version 2.0** reflecting the delivery of the Canonical Skill Taxonomy (M3), Comparative Analytics Matrix (M4), Multi-Resume & LaTeX Workspace (M5), and Autonomous Cloud Automation.

---

## 📚 Document Suite

| Document | Primary Focus | Key Contents |
| :--- | :--- | :--- |
| [phases.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/phases.md) | **Master Roadmap & Evolution** | Sequential execution phases, milestone deliverables, low-spec hardware optimization, system evolution audit, progress matrix, and Phase 2 cloud extension plan. |
| [GITHUB_WORKFLOWS_SETUP.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/GITHUB_WORKFLOWS_SETUP.md) | **Cloud Automation & Workflows** | Complete configuration guide for GitHub Actions CI (35 tests) and the daily JPMC job watcher cron, secret management, Gmail App Password setup, and manual dispatch. |
| [JCI_Project_Overview.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_Project_Overview.md) | **Strategic Vision & Rationale** | Executive summary, business rationale, goals, 2-phase architecture (Local MVP vs Cloud Extension), 7-step user workflow, analytical methodology, 11-job scope, Role Families (A, B, C), target priority ranking, and strategic learning sequence. |
| [JCI_SRS.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_SRS.md) | **Software Requirements Specification** | Product perspective, operating environment (React + FastAPI + SQLite), Hybrid Intelligence architecture, system boundaries, user classes, architectural constraints, external interfaces, relational entity data model, non-functional requirements (NFR-01 to NFR-10), and acceptance baseline. |
| [JCI_FRS.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_FRS.md) | **Functional Requirements Specification** | 28 core functional requirements (FR-01 to FR-28), deferred Phase 2 cloud requirements (FR-29 to FR-36), resume coverage requirements (FR-37 to FR-41), AI disambiguation & critique (FR-42, FR-43), operational workflows, 15 business validation rules, dashboard definitions, and 23 test scenarios. |
| [Job_Listings.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/Job_Listings.md) | **Research Dataset & Baseline** | Full text and metadata for all 11 collected JPMorgan Chase job listings (10 analysable JDs with full text, 1 placeholder record with status `JD unavailable`), annotated with Role Families (Family A, Family B, Family C), availability status, and analytical context notes. |
| [JCI_Plan_Review.md](file:///c:/Users/Manthan.waghela/Github_Repositories/JP_Morgan_Career_Intelligence/.docs/JCI_Plan_Review.md) | **Plan Review & Alignment Findings** | Markdown transcript of the JD analysis and plan review notes: CardLyze evidence attribution, role family insights, hand-tallied skill counts, and the 9 key plan rewording recommendations. |

---

## 🏛️ Core Architectural Principles in Version 2.0

1. **Local-First with Hybrid Cloud Intelligence:** 
   - Core ingestion, parsing, SQLite persistence, and UI execute 100% locally under 150 MB RAM for low-spec hardware (4.00 GB RAM / dual-core CPUs).
   - High-compute semantic NLP (Gemini Flash Bar Raiser) runs via zero-RAM cloud LLM adapter with SHA-256 fingerprint caching in SQLite and graceful offline fallback.
2. **Deterministic & Explainable Matching:**
   - Every requirement and skill extraction captures immutable verbatim sentence evidence snippets.
   - Distinct-job coverage strictly enforces active denominator ($N=10$, excluding unavailable JDs per BR-06).
   - Multi-dimensional fit separates Technical, Domain/Governance, Seniority, and Education/Eligibility prerequisites (BR-15).
3. **Autonomous Cloud Automation (Pulled Forward):**
   - Autonomous GitHub Actions cron synchronizes live JPMC Mumbai/Goregaon postings daily at 08:30 IST.
   - Matches new openings against the candidate's active resume and delivers an executive HTML briefing via Gmail SMTP without paid servers.
4. **Human-in-the-Loop Review (M3 & M4 Delivered):**
   - Interactive review screen allows editing, accepting, rejecting, or reclassifying extracted skills and adding aliases directly to the taxonomy database.
   - Cross-Role Matrix grid maps skills across jobs with click-to-inspect evidence modals.
