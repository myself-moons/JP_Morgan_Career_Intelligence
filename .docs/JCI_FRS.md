# JPMorgan Career Intelligence - Functional Requirements Specification (FRS)

*Detailed user-facing functions, workflows, validation rules and functional acceptance tests*

| **Document status** | Baseline functional specification (revised for local-first MVP & taxonomy alignment) |
| --- | --- |
| **Version / date** | 1.2 / 17 November 2026 |
| **Project scope** | JPMorgan Chase roles initially; local-first MVP (Phase 1) |

---

### Document Revision History

| Version | Date | Author / Reviewer | Summary of Changes |
| --- | --- | --- | --- |
| 1.0 | 17 Nov 2026 | Baseline Team | Initial draft baseline for project development. |
| 1.1 | 17 Nov 2026 | Documentation Review | Initial functional requirements cross-referencing. |
| 1.2 | 17 Nov 2026 | JCI Plan Review & Architecture Alignment | **Clarified MVP vs. Cloud scope:** Confirmed Phase 1 MVP is 100% local-first (React + FastAPI + SQLite). Explicitly assigned FR-29 through FR-36 (Firebase Hosting, RTDB, cloud auth) to release priority **"Later" (Phase 2, post-M7)**.<br>**Status & denominator alignment:** Added `JD unavailable` status support to FR-01, FR-04, and BR-01. Clarified in FR-15 and BR-06 that skill frequency denominator $N$ is strictly the count of analysable jobs ($N = 10$).<br>**Role Family integration:** Added `role_family` attribute (Family A: Governance/DQ, Family B: Analytics/AI, Family C: Finance/Operations) to FR-01, FR-04, FR-16, and BR-05.<br>**New Feature - Resume Keyword Coverage:** Added requirements **FR-37** (resume document ingestion), **FR-38** (resume vs. JD coverage with matching lines from both texts; no single score), **FR-39** (parse check warning), and **FR-40** (claimed but unsupported check tied to CardLyze attribution).<br>**New Business Rules:** Added **BR-13** (resume mention != demonstrated), **BR-14** (resume coverage uses same alias map as JD extraction), and **BR-15** (education prerequisites evaluated exclusively under Education/Eligibility dimension).<br>**New Test Scenarios:** Added **TC-19** (resume coverage against JD), **TC-20** (skill in resume with no evidence), and **TC-21** (Reference Data postgraduate finance requirement as education gap).<br>**Release Priority:** Placed FR-37 and FR-38 in **Should have**, FR-39 and FR-40 in **Could have**, scheduled for Milestone **M5**. |

---

## 1. Purpose and scope

This FRS translates the JCI project goals into observable application behaviour. It focuses on the functions the user can perform and the outputs the system should produce. It complements the SRS and should be used when implementing and testing each module.

## 2. Roles and permissions

The MVP has one local user with full access to the local dataset. There is no public registration, role-based access control or multi-user collaboration in the first release. Destructive actions should still require a clear confirmation.

## 3. Functional requirements

| **ID** | **Function** | **Expected behaviour** | **Rules / validation** | **Acceptance outcome** |
| --- | --- | --- | --- | --- |
| FR-01 | Add a job by manual entry | The user can enter company, title, external job ID, location, source URL, capture date, role family, availability status, and full job-description text. | Required fields: company, title, and role family. Description required unless status is `JD unavailable`. | A saved job appears in the Job Library and persists across restarts. |
| FR-02 | Add a job from PDF/DOCX | The user can upload a supported PDF or DOCX and extract its text into a new job record. | Reject unsupported file types; show clear errors for unreadable or empty text. | Extracted text is previewed and editable before saving. |
| FR-03 | Preserve source snapshot | The system stores the original description separately from cleaned text and extracted records. | Do not overwrite original source text during cleaning or re-analysis. | The original description can be viewed later and is unchanged by extraction. |
| FR-04 | View and search jobs | The user can browse, search and filter saved listings by title, location, company, role family (A, B, C), experience band, or status (`Available`, `JD unavailable`, `Stale`, `Archived`). | Search should tolerate case differences; blank filters mean no restriction. | Results match the selected filters and show useful listing metadata. |
| FR-05 | Edit job metadata and text | The user can correct job metadata, role family, status, and description text. | Show a warning that changing source text may require re-analysis; preserve a prior snapshot or change history if feasible. | Updated values persist and the user can identify when the source was last changed. |
| FR-06 | Delete a job | The user can remove a job and its dependent extracted records according to defined database rules. | Require confirmation; cascade or handle linked records consistently. | Deleted job no longer appears and no orphaned dependent records remain. |
| FR-07 | Clean job-description text | The system can create a normalised working copy by removing irrelevant whitespace and formatting artefacts while preserving meaningful content. | Cleaning must not change the stored original description. | Cleaned text is available for extraction and can be compared with original text. |
| FR-08 | Extract experience requirements | The system identifies explicit years-of-experience statements and stores the extracted value and supporting text. | Do not infer a precise minimum when wording is ambiguous; retain the original phrase and confidence/review status. | User can review and correct experience values. |
| FR-09 | Extract qualifications | The system identifies degree, postgraduate, certification and other education/eligibility statements. | Separate mandatory, preferred and unspecified wording where possible; flag degree prerequisites as education eligibility criteria. | Qualification statements are displayed with source evidence and review status. |
| FR-10 | Extract responsibilities | The system identifies responsibility statements and groups them into functional themes where possible. | AI interpretation, if used, must be marked as suggested rather than verified. | User can edit or accept responsibility classifications. |
| FR-11 | Extract skills | The system identifies skills from a maintained dictionary and optional contextual interpretation. | Each extraction stores source evidence, method and review state; avoid unsupported inference. | User can inspect the text supporting each extracted skill. |
| FR-12 | Classify requirement type | The system classifies each requirement as required, preferred or unspecified. | Ambiguous language should remain unspecified pending review. | Analytics can filter by requirement type. |
| FR-13 | Normalise skill aliases | The system maps approved aliases to canonical skill records. | Do not merge distinct concepts merely because they are related; unknown terms can be proposed for review. | Equivalent terms count under one approved canonical skill. |
| FR-14 | Review and correct extraction | The user can approve, edit, reject or reclassify extracted requirements and skill links. | Record review state and retain source evidence. | Corrections persist and are reflected in analytics. |
| FR-15 | Compare skills across jobs | The system calculates how many distinct selected jobs mention each canonical skill and its coverage percentage. | Count each skill at most once per job; calculate required/preferred separately; exclude `JD unavailable` listings from the denominator $N$. | Results show count, denominator, percentage and selected filters. |
| FR-16 | Show role-family patterns | The user can filter comparisons by role family (Family A, Family B, Family C), title, location and experience band. | Do not imply a statistically robust pattern from a very small sample; display sample size ($N$). | Charts and tables update to match selected filters. |
| FR-17 | Maintain user profile | The user can record education, experience, projects, tools, responsibilities and other career evidence. | Profile claims should be linked to a supporting description or evidence item where possible. | Profile data can be viewed and edited. |
| FR-18 | Assign skill evidence status | The user can mark each skill as Demonstrated, Partial, Learning or Not demonstrated and provide supporting notes. | A course completion alone must not automatically set Demonstrated. | Status and notes are saved and visible in profile matching. |
| FR-19 | Record contribution type | The user can describe whether work was independently implemented, AI-assisted, supervised, collaborative, tested or validated. | Allow more than one contribution type when appropriate; do not force a false binary. Supports the CardLyze attribution model. | The profile can represent the user's actual contribution accurately. |
| FR-20 | Compare profile with a job | The system compares job requirements with profile evidence and presents supported matches and gaps. | Distinguish unsupported from explicitly missing skills; isolate formal degree requirements into education gaps. | Each match/gap has a reason and evidence reference where available. |
| FR-21 | Separate fit dimensions | The system reports technical, functional, domain, education, experience and evidence-strength dimensions separately. | Do not hide formal eligibility gaps inside a single composite percentage score. | User can inspect each dimension independently. |
| FR-22 | Maintain learning resources | The user can add provider, title, URL, skills addressed, cost status, certificate availability and duration. | Cost status should support Free, Paid, Freemium and Unknown; include verification date. | Resource appears in the catalogue with its metadata. |
| FR-23 | Recommend learning resources | The system can suggest resources mapped to identified gaps and priority skills. | Recommendations must explain which gap they address; unknown or stale pricing must be labelled. | User can see the reason for each recommendation. |
| FR-24 | Track learning progress | The user can set resource status to Not started, In progress, Completed or Paused and record dates/notes. | Completion does not automatically change skill evidence status. | Progress persists and is reflected in the learning tracker. |
| FR-25 | Dashboard visualisation | The dashboard presents summary counts, skill coverage, required/preferred distribution, role comparisons and gap summaries. | Show sample sizes ($N$), active filters and clear labels; avoid misleading scales. | Dashboard values agree with underlying records and filters. |
| FR-26 | Export analysis | The user can export selected job, skill and comparison data to CSV or Excel. | Respect active filters; use clear column names and include source references where possible. | Exported rows and values match the displayed selection. |
| FR-27 | Re-run analysis | The user can re-run extraction after changing source text or extraction logic. | Preserve prior approved corrections or make re-analysis changes reviewable; version extraction runs where practical. | New results are distinguishable from the previous analysis. |
| FR-28 | Operate without AI | All core ingestion, storage, dictionary extraction, normalisation, comparison and profile functions work without external AI. | AI features must be optional and fail gracefully. | Core acceptance tests pass with no AI credentials configured. |
| **FR-37** | **Resume as a profile document** | The user can paste or upload a resume (PDF or DOCX). It is stored as source text, with file retention following the configured privacy decision. | Reject unsupported file types; warn on unreadable or empty text. Raw files stored locally in private `uploads/`. | Resume source text is saved and linked to the active user profile. |
| **FR-38** | **Resume vs. JD coverage** | For a chosen JD, the system lists each required and preferred skill and shows whether the resume mentions it, displaying the matching line/sentence from both texts. | Uses the same canonical skill taxonomy and alias mappings as JD extraction. Must not compute or display a single or composite score. | Side-by-side snippet evidence showing which JD skills are mentioned in the resume. |
| **FR-39** | **Resume parse check** | The system validates extracted resume text and warns when extraction appears flawed (e.g. empty text, scrambled multi-column text, corrupted table structures). | Check for suspicious whitespace, unusually short line fragments, or empty text. | User receives an actionable warning to verify or paste text manually. |
| **FR-40** | **Claimed but unsupported check** | The system flags skills that the resume mentions or lists, but for which no supporting profile evidence is recorded in the profile. | Flags unsupported claims without auto-deleting them; ties into evidence status and CardLyze contribution split. | Clear visual indicator distinguishing resume keywords from verified profile deliverables. |
| **FR-41** | **Database inspection console** | The system provides a web-based database inspection console allowing the user to view live SQLite tables, schemas, field types, records, and run queries in the browser at any time (equivalent to the Firebase Realtime DB Console). | Operates locally on demand; read/inspect access to SQLite database without modifying application code. | User can inspect the live database state through a browser tab whenever desired. |

---

## 4. Detailed workflows

### 4.1 Add a job by paste

1. User opens Job Library and selects Add Job.
2. User enters job metadata (company, title, external job ID, location, source URL, capture date, role family: A, B, or C, and status: `Available` or `JD unavailable`) and pastes description.
3. System validates required fields and checks for a possible duplicate using external job ID and/or source URL.
4. System displays a preview and asks the user to confirm saving.
5. System stores the original description and metadata, then makes the job available for analysis.

### 4.2 Add a job by document

1. User selects a PDF or DOCX file.
2. System validates file type and attempts local text extraction via PyMuPDF or python-docx.
3. System displays extracted text and any warnings, such as low or empty text output.
4. User enters or confirms job metadata (including role family) and edits the text if necessary.
5. System saves the job only after user confirmation.

### 4.3 Analyse and review a job

1. System creates a cleaned working copy of the original description.
2. System extracts candidate experience, qualifications, responsibilities, requirements and skills with snippet coordinates.
3. Each candidate is associated with a source snippet and an extraction/review status (`Proposed`, `Accepted`, `Rejected`, `Edited`).
4. System maps recognised skill aliases to canonical skills; unresolved terms are flagged for user review.
5. User accepts, edits or rejects candidates.
6. Approved records become available to comparative analytics.

### 4.4 Compare roles

1. User selects all jobs or applies filters such as role family (Family A: Governance/DQ, Family B: Analytics/AI, Family C: Finance/Operations), location, or experience band.
2. System calculates distinct-job counts and coverage percentages for each skill across the active analysable sample ($N = 10$).
3. System separates required, preferred and unspecified mentions.
4. Dashboard displays common skills and role-family patterns with the exact sample size ($N$) indicated.
5. User can open a skill to inspect the jobs and evidence snippets contributing to its count.

### 4.5 Profile matching

1. User maintains education, experience, projects (including the CardLyze seed project) and supporting evidence.
2. User assigns evidence statuses (Demonstrated, Partial, Learning, Not demonstrated) and explicitly records contribution types (independent, AI-assisted, supervised).
3. User selects a job or role family for comparison.
4. System maps requirements to profile evidence and groups outcomes by fit dimension (technical, functional, domain, education, experience, evidence strength).
5. System lists formal education/degree gaps separately from technical skill gaps.
6. User can use the gap list to prioritise practical projects and learning resources.

### 4.6 Learning tracking

1. User opens Learning Tracker and adds a resource or selects a recommendation mapped to an identified gap.
2. System stores provider, title, URL, skill mapping, cost status and verification date.
3. User updates progress (Not started, In progress, Completed, Paused) and adds notes.
4. System shows progress but does not automatically upgrade profile skill proficiency to Demonstrated upon course completion.
5. User separately updates profile evidence after completing practical, explainable deliverables.

### 4.7 Resume upload and keyword coverage

1. User opens Profile and selects the Resume tab.
2. User pastes resume text or uploads a PDF/DOCX file.
3. System extracts text via PyMuPDF or python-docx and performs a parse check (FR-39). If empty text, scrambled columns, or distorted tables are detected, the system displays an alert with raw text preview.
4. User reviews extracted text and confirms saving (FR-37).
5. User navigates to a job in the Job Library and selects "Check Resume Coverage".
6. System scans resume text against the target JD's required and preferred skills using the canonical skill taxonomy and alias dictionary (BR-14).
7. System displays a side-by-side coverage view (FR-38):
   - Each required and preferred skill from the JD.
   - Mention status in the resume (Mentioned / Not Mentioned).
   - Verbatim matching line from the JD and verbatim matching line from the resume.
   - Strictly no single/composite ATS percentage score is generated.
8. System cross-references detected resume skills against recorded profile evidence (FR-40, BR-13):
   - Skills mentioned in the resume with corresponding profile evidence deliverables are marked verified.
   - Skills mentioned in the resume without recorded profile evidence are flagged as **Claimed but unsupported** (tied to the CardLyze attribution model).

## 5. Data validation and business rules

| **Rule ID** | **Rule** |
| --- | --- |
| BR-01 | A job must have a title, company, role family, and non-empty original description before it can be saved, unless specifically ingested as a placeholder listing with status `JD unavailable`. |
| BR-02 | A job snapshot must retain its capture date and availability status; source URL may be blank for manually supplied text. |
| BR-03 | A newly extracted requirement must be linked to its source evidence snippet and have an extraction method and review status. |
| BR-04 | Canonical skill names must be unique within the taxonomy; an alias cannot point to more than one canonical skill simultaneously. |
| BR-05 | Each job listing must be assigned to exactly one primary Role Family: Family A (Data Management, Quality & Governance), Family B (Analytics, Automation & AI), or Family C (Finance, Credit & Operations). |
| BR-06 | Skill coverage percentage shall be calculated using only active, analysable jobs as the denominator ($N$); listings with status `JD unavailable` shall be excluded from coverage calculations. |
| BR-07 | A single job cannot contribute more than once to a canonical skill's count in job-level coverage calculations. |
| BR-08 | Profile evidence must specify an evidence status (Demonstrated, Partial, Learning, Not demonstrated) and a contribution type (independent, AI-assisted, supervised). |
| BR-09 | Course completion alone must not automatically upgrade a skill to Demonstrated; practical, explainable deliverables are required. |
| BR-10 | A recommendation must cite the specific gap or priority skill justifying the suggestion. |
| BR-11 | A learning resource must record cost status and verification date; unverified resources must be labelled Unknown. |
| BR-12 | Changing source text must not silently erase the prior source snapshot or user-approved corrections. |
| **BR-13** | **A resume mention does not mean the skill is demonstrated; a resume mention indicates keyword presence in text, whereas Demonstrated status requires recorded profile evidence and an explainable deliverable.** |
| **BR-14** | **Resume coverage analysis must use the exact same canonical skill taxonomy and approved alias map as job description extraction.** |
| **BR-15** | **Formal education and eligibility criteria (e.g. required postgraduate degrees, accredited certifications, or statutory licenses) must be evaluated exclusively under the Education/Eligibility fit dimension and shall not be evaluated or scored as an ordinary learnable technical skill gap.** |

## 6. Dashboard and report outputs

| **View** | **Information shown** | **Key interaction** |
| --- | --- | --- |
| Overview dashboard | Number of jobs ($N$), role family breakdown, locations, experience bands, top recurring skills and review status. | Filter by job subset or role family and open underlying records. |
| Skill analysis | Skill count, coverage %, required/preferred counts, categories, and hand-tallied baseline comparisons. | Sort, filter, and inspect underlying source evidence snippets. |
| Role comparison | Comparison across role families (A, B, C) showing common core skills vs. specialist requirements. | Select role families or specific jobs for side-by-side matrix view. |
| Profile matcher | Technical, functional, domain, education, and experience dimensions shown separately with evidence states. | Inspect specific gaps and jump to recommended learning resources. |
| **Resume coverage view** | Line-by-line comparison of required/preferred JD skills against resume text; flags claimed-unsupported skills. | Select JD, inspect matching text lines, and jump to profile evidence to substantiate claims. |
| Learning tracker | Active courses, status, cost status, verification date, and mapped skill gaps. | Add resources, log progress, and record completion notes. |
| **SQL database console** | Web-based live database browser displaying all SQLite tables, schemas, field types, records, and SQL query runner (equivalent to Firebase Console). | Open console in browser tab (`http://localhost:8080` or navbar button), browse tables, filter rows, and run ad-hoc queries. |
| Exports | Filtered job, skill, matrix, resume coverage, and gap tables formatted for CSV or Excel. | Choose export format and download file. |

## 7. Error and exception handling

- **Unsupported document:** Explain accepted formats (PDF, DOCX) and do not create an empty job or resume record.
- **Unreadable or scanned PDF:** Show a clear warning that text extraction yielded no readable text; prompt the user to paste text manually.
- **Corrupted resume extraction (FR-39):** Detect scrambled columns, anomalous whitespace ratios, or empty buffers; display actionable parse check warning before saving.
- **Duplicate listing:** Detect identical external job IDs or source URLs; warn the user and offer to inspect the existing record rather than silently overwriting.
- **Unavailable job text:** Ingest listings with missing text as status `JD unavailable`; exclude them from skill frequency denominators while preserving listing metadata.
- **Database unavailable or write failure:** Display actionable error message and roll back transaction; do not falsely report successful save.
- **Optional AI service unavailable:** Fall back seamlessly to deterministic rule-based extraction; label AI features as unavailable without blocking workflows.
- **Stale or invalid URL:** Allow manual editing of URLs and flag unverified learning resources.

## 8. Functional test scenarios

| **Test ID** | **Test action** | **Expected result** |
| --- | --- | --- |
| TC-01 | Paste a valid job description | Job saved with metadata, role family, and original text. |
| TC-02 | Upload a text-based PDF | Text preview appears, metadata fields populate, and record can be saved. |
| TC-03 | Upload a text-based DOCX | Extracted text matches document and can be saved. |
| TC-04 | Upload unsupported file type | Rejection message appears; no job record created. |
| TC-05 | Upload empty/scanned PDF | Warning shown; user can cancel or provide text manually. |
| TC-06 | Add duplicate external job ID | Duplicate warning appears; existing record retained. |
| TC-07 | Ingest listing with status `JD unavailable` | Record saved with metadata; job excluded from skill frequency denominator. |
| TC-08 | Run deterministic skill extraction | Candidate skills include evidence snippets and review status. |
| TC-09 | Map an approved alias | Alias and canonical skill appear as one skill in coverage results. |
| TC-10 | Map an ambiguous alias | System flags term for review rather than guessing. |
| TC-11 | Count skill across multiple jobs | Distinct-job count and percentage are mathematically correct across the 10 analysable JDs. |
| TC-12 | Filter by role family | Denominator and results recalculate strictly for the selected family (A, B, or C). |
| TC-13 | Review and edit a requirement | Edited value persists and analytics reflect the correction. |
| TC-14 | Complete a course in tracker | Learning progress changes to Completed, but profile skill evidence does not auto-upgrade. |
| TC-15 | Evaluate profile seeded with CardLyze | Technical requirements evaluate against CardLyze attribution; independent items count towards Demonstrated; AI-assisted items reflect assisted status. |
| TC-16 | Run without AI credentials | Core parsing, storage, normalisation, and matching functions execute cleanly. |
| TC-17 | Restart application | Stored SQLite records, review statuses, and learning progress persist intact. |
| TC-18 | Export filtered skills | CSV/Excel export content matches the active filter and visible table rows. |
| **TC-19** | **Resume coverage against a JD** | For a chosen JD and uploaded resume, system lists each required and preferred skill, shows whether the resume mentions it, and displays the matching line from both texts using canonical skills and aliases with no single composite score. |
| **TC-20** | **Skill that is in the resume but has no evidence** | System flags skills mentioned in the resume that lack supporting profile evidence as "Claimed in resume, unsupported by profile evidence", preserving evidence status integrity per BR-13. |
| **TC-21** | **Reference Data role postgraduate requirement under education** | System evaluates the postgraduate finance qualification strictly under the **Education / Eligibility** fit dimension, displaying it separately from technical skill gaps per BR-15. |
| **TC-22** | **AI-assisted semantic taxonomy disambiguation** | When an ambiguous skill phrase is sent to the LLM adapter, system returns candidate canonical taxonomy mappings with confidence score and justification; when API key is missing, system falls back cleanly to manual review without error. |
| **TC-23** | **AI-assisted resume critique & graceful degradation** | When requested, LLM adapter evaluates resume bullet points against target JD, identifies implicit capabilities and bullet rewording suggestions; if offline or unconfigured, standard deterministic line matching (TC-19) continues unaffected. |

## 9. MVP release priority

| **Priority** | **Functions** | **Release treatment** |
| --- | --- | --- |
| **Must have (Phase 1)** | FR-01 to FR-16, FR-17 to FR-21, FR-28 | Core job library, role family filtering, extraction review, comparative analysis, profile gap analysis, and deterministic offline engine. |
| **Should have (Phase 1)** | FR-22 to FR-25, **FR-37, FR-38, FR-41** | Learning catalogue/tracking, core dashboard views, **resume document ingestion, resume vs. JD keyword coverage, and web-based database console (Milestone M1)**. |
| **Could have (Phase 1)** | FR-26, FR-27, **FR-39, FR-40** | Exports (CSV/Excel), versioned re-analysis, **resume parse check warnings, and claimed-unsupported evidence audits**; implement in Milestone M5 after core profile matching. |
| **Later (Phase 2)** | FR-29 to FR-36 (Cloud, Firebase Hosting, RTDB, Cloud Auth), Automated URL scraping, OCR, multi-company taxonomy, public multi-user access | Deferred to Phase 2 (post-M7) so as not to complicate or delay the local MVP. |

> [!NOTE]
> **Milestone placement:** The resume keyword coverage feature (FR-37 to FR-40) is built in **Milestone M5** immediately following completion of core profile matching and CardLyze attribution seeding.

## 10. Open functional decisions

- **Profile and resume versioning:** Should the system allow multiple resume/profile snapshots for different career target tracks? *(Resolution for Phase 1: Support single active resume and single active profile; named multi-version snapshots designated for Phase 2).*
- **Uploaded file retention:** Should raw PDF/DOCX files be retained on disk after text extraction? *(Current stance: Retain in local `uploads/` folder for verification; exclude folder from Git).*
- **Stale listing review cadence:** What criteria mark an active listing as stale? *(Recommendation: Flag listings older than 90 days or when verified closed on careers portal).*
- **Free learning resource verification:** How frequently should free course availability and audit access be re-checked? *(Recommendation: Manual verification date stored; quarterly review cadence).*

---

### Phase 1 Hybrid Intelligence Requirements (Zero-RAM Cloud LLM Adapter)

**FR-42 AI-assisted semantic taxonomy disambiguation:** The backend shall provide an optional endpoint to query a lightweight external cloud LLM (e.g. Google Gemini 1.5 Flash or Groq Llama 3 via free tier API) to analyze unmapped or ambiguous skill phrases in their surrounding JD sentence context, propose the most appropriate canonical skill from the existing taxonomy, and provide a confidence rating and brief rationale. All suggested mappings shall remain provisional until explicitly confirmed or edited by the user in the review workflow (FR-14). If the external service is unavailable or unconfigured, the system shall gracefully fall back to manual entry without error.

**FR-43 AI-assisted semantic resume critique & rewording recommendations:** The backend shall provide an optional endpoint to submit parsed resume text and a target JD to the external LLM adapter to generate deep qualitative alignment feedback. The evaluation shall:
1. Detect implicit capabilities and contextual skills demonstrated in experience bullets that do not contain verbatim keywords.
2. Evaluate bullet strength (action verbs, quantifiable metrics, clarity for financial technology roles).
3. Generate authentic, evidence-based bullet rewording recommendations that highlight verified project deliverables (e.g. CardLyze independent vs. AI-assisted achievements) without inflating proficiency claims or violating rule BR-13.
The system shall display this critique in a dedicated frontend inspection drawer while preserving the deterministic, line-by-line keyword coverage table (FR-38).

---

## 11. Phase 2 Functional Requirements: Cloud, FastAPI Deployment & Firebase (Post-M7)

> [!NOTE]
> **Scope note:** Requirements FR-29 through FR-36 represent **Phase 2 (Cloud Extension)**. They are scheduled for implementation after completion of Milestone M7 and are not required for Phase 1 Local-First MVP acceptance.

**FR-29 Frontend delivery:** The React application shall be buildable as static frontend assets and deployable through Firebase Hosting. The hosted frontend shall not contain SQL credentials or Firebase administrative secrets.

**FR-30 Backend API:** The FastAPI backend shall expose documented endpoints for job ingestion, job retrieval and editing, analysis, profile matching, learning-resource management and exports. The backend shall validate inputs and return clear success or error responses.

**FR-31 SQL persistence:** The backend shall read and write durable project records through a SQL data-access layer. PostgreSQL shall serve as the hosted cloud database for durable jobs, requirements, skills, profile evidence and learning records.

**FR-32 Realtime status:** Where a workflow benefits from live updates (e.g. batch document processing), the backend shall publish a limited status record to Firebase Realtime Database (queued, processing, completed, failed) with an update timestamp and task identifier.

**FR-33 Realtime status display:** The frontend may subscribe to authorised RTDB status paths to display progress or notifications without repeatedly polling the SQL database. RTDB status must not be treated as the authoritative job or analysis record.

**FR-34 Service failure handling:** If Firebase Realtime Database is unavailable, core SQL-backed workflows shall continue where possible. Live progress indicators may become unavailable, but durable job and profile data must remain accessible.

**FR-35 Hosting/backend separation:** The frontend shall call the separately deployed FastAPI backend through a configurable API base URL. Local development and hosted environments shall be configurable without hard-coding environment-specific URLs.

**FR-36 Access control:** Before remote deployment, private endpoints and RTDB paths shall enforce an appropriate authentication and authorisation model. Client-side hiding of controls is not sufficient security.

## 12. Phase 2 Cloud Deployment Workflow (Post-M7)

1. During local development (Phase 1), run the React development server and FastAPI backend separately using a local SQLite database (`jci_local.db`).
2. For cloud frontend deployment (Phase 2), compile the React application (`npm run build`) and deploy the static distribution to Firebase Hosting.
3. Deploy FastAPI separately to a containerized Python cloud host (e.g. Cloud Run, Railway). Configure the hosted PostgreSQL database and Firebase project using server-side environment variables or a managed secret store.
4. Configure the frontend API base URL for the deployed backend host. Configure CORS to allow only the intended frontend origin.
5. Before go-live, test authentication, authorization rules, database migrations, backup/restore, file persistence, RTDB security rules, error handling, and rollback procedures.
