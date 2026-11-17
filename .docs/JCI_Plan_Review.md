# JCI Plan Review: JD Analysis and Proposed Rewording

*Review of the JCI Project Overview, SRS and FRS (v1.0, 17 November 2026) against the full text of the collected JPMorgan Chase job descriptions. Prepared 17 November 2026.*

---

## 1. Evidence attribution note

The CardLyze brief was written by the Antigravity AI assistant in the first person. Implementation (rule engine, report engine, alert ledger, scheduler, data provider and S3 adapters, T-SQL, dashboard and reports UI, Docker setup, automated tests) is therefore AI-implemented. The user's own inputs were the TMS-ATM requirement document, the per-provider data dictionaries, the `Card_Data.ipynb` EDA notebook, sample datasets, and the AWS RDS and environment specifications.

This is the independent versus AI-assisted distinction that FR-19 asks the profile to record. It decides what can honestly be marked "Demonstrated" for T-SQL, Python and Docker. The requirements and domain work are real evidence in their own right.

---

## 2. What the real JDs change

The earlier ranking was based on job titles, and a few of those were misleading:
- **Data Analytics Associate** is an Asset & Wealth Management FP&A role. It asks for GAAP/IFRS, variance analysis and 2+ years in financial analytics, so it is a poor near-term target.
- **CR Portfolio Analytics** is Commercial Real Estate credit risk. It is Python and SQL-heavy, but domain knowledge and years of experience are a stretch.
- **Analytics Solution (10+ years)** is Payments Finance automation. It is out of reach as a role, but its stack is a useful learning guide: Python, SQL, Databricks, reconciliation and data quality controls, and React dashboards.

### Role families

- **A. Data management, quality and governance:** CAO Data Management, Data Quality Business Analytics, Data Governance (no JD text available yet).
- **B. Analytics, automation and AI:** Applied AI and Data Science, Analytics Solution, Data Analytics, CRE Portfolio Analytics.
- **C. Finance, credit and operations:** Reference Data Analyst, Project Finance Credit Risk, CIB Credit Risk, Corporate Payment Sales. These hinge on postgraduate or finance qualifications and are a different career track.

### Priority order

1. **Applied AI and Data Science (1–5 years):** The best fit on years. Gaps: NLP, LLM workflow automation and model validation.
2. **Data Quality Business Analytics (5+ years):** Matches well on skills: SQL, Python, dashboards, profiling and reconciliation, AI use. Gaps: Alteryx, Informatica or Collibra, and years of experience (the JD allows "equivalent depth").
3. **CAO Data Management (3+ years):** Gaps are mainly years of experience, plus metadata and governance vocabulary.

### Common skills across the 10 JDs with text

*These are hand-tallied counts and are approximate. JCI should produce them itself.*

| Skill | Approx. roles |
| --- | --- |
| Stakeholder communication | 10 of 10 |
| AI / GenAI | about 6 |
| Data quality, controls, reconciliation | about 6 |
| Python | 5 |
| BI dashboards (Tableau, Power BI, Qlik, Sigma) | 5 |
| SQL | 4 |
| Alteryx | 3 |
| Governance, lineage, metadata | 3 |
| Databricks / Snowflake | 2 |

---

## 3. Proposed rewording of the plan

1. **UI conflict:** SRS section 2.3 says Streamlit, while the Overview, SRS section 13 and FRS section 11 say React with FastAPI. Change the SRS to React.
2. **Local-first versus Firebase:** The Overview's out-of-scope list rules out the cloud, yet Overview section 15, SRS section 13 and FRS section 11 pull Firebase Hosting, Realtime Database and authentication into scope. Make the MVP React, FastAPI and SQLite, all local, and move Firebase to a Phase 2 after M7. Analysing about 10 JDs is fast enough that live progress updates are not needed. FR-29 to FR-36 also have no release priority, so mark them "Later".
3. **Versions:** The README says 1.1 and the three documents say 1.0. Align them to v1.2.
4. **Sample size:** There are 10 analysable JDs, not 11. Add a "JD unavailable" status for the Data Governance role.
5. **Role family field:** FR-16 filters by job family, so add a role family field with values A, B and C.
6. **Taxonomy:** Add finance-domain skills (FP&A, GAAP, credit analysis) and tools such as Alteryx alongside the technical skills, because about half of the roles are finance-heavy.
7. **Test case:** The Reference Data role must show its postgraduate-finance requirement as an education gap, not a skill gap.
8. **Profile seed:** Before M5, load CardLyze into the profile with its contribution split (see section 1).
9. **Learning order:** Start with the common core: SQL depth, Python and Pandas, data quality and reconciliation, one BI tool, and AI-assisted analytics. Then specialise into family A (governance, lineage, metadata) or family B (ML, NLP, LLMs).

---

## 4. Next step

Apply the changes above as v1.2 of the Overview, SRS and FRS, with edits clearly marked, or adjust the plan first.
