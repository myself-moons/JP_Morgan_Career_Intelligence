import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.entities import (
    JobListing,
    JobSkill,
    ProfileEvidence,
    ResumeDocument,
    Skill,
    SkillAlias,
    UserProfile,
    utcnow,
)
from app.models.schemas import (
    ClaimedUnsupportedItem,
    DimensionEvaluation,
    ProfileEvidenceOut,
    ProfileJobMatchResponse,
    ProfileOverviewResponse,
    ResumeParseCheck,
    SkillCoverageComparisonRow,
    UserProfileOut,
    UserProfileUpdate,
)
from app.services.taxonomy_service import (
    _split_into_sentences,
    extract_and_save_job_skills,
    seed_taxonomy_if_empty,
)

VALID_EVIDENCE_STATUSES = {"Demonstrated", "Partial", "Learning", "Not demonstrated"}
VALID_CONTRIBUTION_TYPES = {
    "Independent",
    "AI-assisted",
    "Supervised",
    "Collaborative",
    "Tested",
    "Validated",
}

# Pre-seeded evidence records incorporating explicit CardLyze attribution (FR-19, TC-15)
# alongside verified independent experience (EbixCash TMS, Kaggle, Teaching, Power BI).
CARDLYZE_BASELINE_EVIDENCE = [
    {
        "canonical_name": "Data Modeling",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "CardLyze",
        "evidence_description": (
            "Independently authored TMS-ATM requirement specification, per-provider data dictionaries, "
            "and entity mapping before AI-assisted code generation."
        ),
    },
    {
        "canonical_name": "Data Quality",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Tested",
        "source_project": "CardLyze & EbixCash TMS",
        "evidence_description": (
            "Independently executed Card_Data.ipynb exploratory data quality profiling and implemented "
            "transaction validation and reconciliation checks at EbixCash."
        ),
    },
    {
        "canonical_name": "Reference Data",
        "evidence_status": "Partial",
        "contribution_type": "Independent",
        "source_project": "CardLyze",
        "evidence_description": (
            "Authored per-provider card/ATM reference data dictionaries independently; enterprise-wide "
            "MDM stewardship workflow experience still developing."
        ),
    },
    {
        "canonical_name": "Python",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, AI-assisted, Tested",
        "source_project": "EbixCash TMS, CardLyze & Teaching",
        "evidence_description": (
            "Independent Python workflows at EbixCash TMS, Kaggle Top 11% pipeline, and 61 Python lectures; "
            "CardLyze rule/report engine was AI-assisted and locally tested."
        ),
    },
    {
        "canonical_name": "SQL",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, AI-assisted, Tested",
        "source_project": "KES Shroff Teaching, EbixCash & CardLyze",
        "evidence_description": (
            "Independently delivered SQL curriculum across 5 student batches and wrote TMS queries; "
            "CardLyze T-SQL alert ledger was AI-assisted and validated."
        ),
    },
    {
        "canonical_name": "Pandas",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "CardLyze & EbixCash TMS",
        "evidence_description": (
            "Independently built Card_Data.ipynb EDA and EbixCash Pandas reporting pipelines."
        ),
    },
    {
        "canonical_name": "NumPy",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "Student Health Risk Prediction (Kaggle)",
        "evidence_description": (
            "Vectorized numerical preprocessing and feature engineering across 690K+ records."
        ),
    },
    {
        "canonical_name": "FastAPI",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Tested",
        "source_project": "EbixCash TMS",
        "evidence_description": (
            "Built modular transaction-processing APIs and Pytest validation checks for EbixCash TMS."
        ),
    },
    {
        "canonical_name": "REST APIs",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Tested",
        "source_project": "EbixCash TMS",
        "evidence_description": (
            "Designed and tested RESTful backend services for transaction monitoring workflows."
        ),
    },
    {
        "canonical_name": "Cron / Scheduling",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, AI-assisted",
        "source_project": "EbixCash TMS & CardLyze",
        "evidence_description": (
            "Built scheduled Cron reporting jobs independently at EbixCash; CardLyze scheduler was AI-assisted."
        ),
    },
    {
        "canonical_name": "LocalStack",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Tested",
        "source_project": "EbixCash TMS",
        "evidence_description": (
            "Executed S3-compatible object storage integration testing locally with LocalStack."
        ),
    },
    {
        "canonical_name": "AWS",
        "evidence_status": "Partial",
        "contribution_type": "Independent, AI-assisted",
        "source_project": "CardLyze & EbixCash",
        "evidence_description": (
            "Independently supplied AWS RDS and environment specifications for CardLyze; S3 adapters were AI-assisted."
        ),
    },
    {
        "canonical_name": "Docker",
        "evidence_status": "Partial",
        "contribution_type": "AI-assisted, Tested",
        "source_project": "CardLyze",
        "evidence_description": (
            "CardLyze Dockerfiles and container orchestration were AI-assisted and verified through local test execution."
        ),
    },
    {
        "canonical_name": "Power BI",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "Global Sales & Profit Dashboard",
        "evidence_description": (
            "Built interactive multi-region Power BI and Power Query executive profitability dashboard."
        ),
    },
    {
        "canonical_name": "Machine Learning",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "Student Health Risk Prediction (Kaggle)",
        "evidence_description": (
            "Benchmarked Logistic Regression, Random Forest, and XGBoost with Stratified 5-Fold CV (Top 11%, 371/3452)."
        ),
    },
    {
        "canonical_name": "Scikit-Learn",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "Student Health Risk Prediction (Kaggle)",
        "evidence_description": (
            "Implemented stratified cross-validation, encoding, and model selection pipelines in scikit-learn."
        ),
    },
    {
        "canonical_name": "Compliance & AML",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Validated",
        "source_project": "EbixCash TMS & CYKYC 2.0",
        "evidence_description": (
            "Performed CYKYC 2.0 UAT validating KYC search and compliance profile workflows; contributed to TMS."
        ),
    },
    {
        "canonical_name": "Git",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Collaborative",
        "source_project": "EbixCash & Portfolio",
        "evidence_description": (
            "Managed version control, branching, pull requests, and CI validation across project repositories."
        ),
    },
    {
        "canonical_name": "Problem Solving",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent",
        "source_project": "KES Shroff Hackathon & Kaggle",
        "evidence_description": (
            "Winner of KES Shroff College Hackathon (2024-2025) and Top 11% Kaggle playground finish."
        ),
    },
    {
        "canonical_name": "Stakeholder Management",
        "evidence_status": "Demonstrated",
        "contribution_type": "Independent, Collaborative",
        "source_project": "Teaching Assistant & EbixCash UAT",
        "evidence_description": (
            "Taught 174 students across 5 batches and coordinated CYKYC 2.0 UAT sign-off with Compliance."
        ),
    },
    {
        "canonical_name": "Deep Learning / GenAI",
        "evidence_status": "Learning",
        "contribution_type": "Supervised",
        "source_project": "Forage GenAI Job Simulation",
        "evidence_description": (
            "Completed guided Forage GenAI simulation; independent LLM/RAG production deliverable pending per BR-09."
        ),
    },
]


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def seed_profile_if_empty(db: Session) -> UserProfile:
    """Seeds baseline UserProfile and CardLyze-attributed ProfileEvidence if empty."""
    seed_taxonomy_if_empty(db)

    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile(
            full_name="Manthan Waghela",
            highest_degree="M.Sc. in Data Science (Pursuing) / B.Sc. in Information Technology (CGPA 9.52)",
            education_summary=(
                "M.Sc. in Data Science (Pursuing, Sem 2 SGPA: 8.50, KES Shroff College); "
                "B.Sc. in Information Technology (CGPA: 9.52, May 2025). No postgraduate finance degree."
            ),
            years_experience="0.5 - 1 year (IT Systems Coordinator Intern, Data Analyst Intern & Teaching Assistant)",
            experience_summary=(
                "IT Systems Coordinator Intern at EbixCash (Oct 2026-Present: TMS Python/FastAPI/SQL, CYKYC 2.0 UAT); "
                "Data Analyst Intern at InAmigos Foundation (Aug-Sep 2026); Teaching Assistant at KES Shroff College (Dec 2025-Mar 2026)."
            ),
            projects_summary=(
                "CardLyze (Independent TMS-ATM requirements, data dictionaries, Card_Data.ipynb EDA, AWS RDS spec; "
                "AI-assisted rule/report engine, T-SQL & Docker); Student Health Risk Prediction (Kaggle Top 11%); "
                "Global Sales & Profit Power BI Dashboard."
            ),
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    if db.query(ProfileEvidence).count() == 0:
        skills_by_name = {s.canonical_name: s for s in db.query(Skill).all()}
        today = _today_str()
        for item in CARDLYZE_BASELINE_EVIDENCE:
            skill = skills_by_name.get(item["canonical_name"])
            if skill:
                ev = ProfileEvidence(
                    skill_id=skill.id,
                    evidence_status=item["evidence_status"],
                    contribution_type=item["contribution_type"],
                    source_project=item["source_project"],
                    evidence_description=item["evidence_description"],
                    recorded_date=today,
                )
                db.add(ev)
        db.commit()

    return profile


def _to_evidence_out(ev: ProfileEvidence) -> ProfileEvidenceOut:
    return ProfileEvidenceOut(
        id=ev.id,
        skill_id=ev.skill_id,
        canonical_name=ev.skill.canonical_name if ev.skill else f"Skill #{ev.skill_id}",
        category=ev.skill.category if ev.skill else "Technical",
        evidence_status=ev.evidence_status,
        contribution_type=ev.contribution_type,
        source_project=ev.source_project,
        evidence_description=ev.evidence_description,
        recorded_date=ev.recorded_date,
        updated_at=ev.updated_at,
    )


def get_profile_overview(db: Session) -> ProfileOverviewResponse:
    """Returns the user profile, all recorded skill evidence, and status/contribution summaries."""
    profile = seed_profile_if_empty(db)
    records = db.query(ProfileEvidence).all()
    items = [_to_evidence_out(r) for r in records]
    items.sort(key=lambda x: (x.evidence_status != "Demonstrated", x.canonical_name))

    status_counts: Dict[str, int] = {
        "Demonstrated": 0,
        "Partial": 0,
        "Learning": 0,
        "Not demonstrated": 0,
    }
    contribution_counts: Dict[str, int] = {}

    for item in items:
        status_counts[item.evidence_status] = status_counts.get(item.evidence_status, 0) + 1
        for tag in [t.strip() for t in item.contribution_type.split(",") if t.strip()]:
            contribution_counts[tag] = contribution_counts.get(tag, 0) + 1

    return ProfileOverviewResponse(
        profile=UserProfileOut.model_validate(profile),
        evidence_items=items,
        status_counts=status_counts,
        contribution_counts=contribution_counts,
    )


def update_user_profile(db: Session, payload: UserProfileUpdate) -> UserProfileOut:
    profile = seed_profile_if_empty(db)
    for field in (
        "full_name",
        "highest_degree",
        "education_summary",
        "years_experience",
        "experience_summary",
        "projects_summary",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(profile, field, val)
    profile.updated_at = utcnow()
    db.commit()
    db.refresh(profile)
    return UserProfileOut.model_validate(profile)


def upsert_profile_evidence(
    db: Session,
    skill_id: int,
    evidence_status: str,
    contribution_type: str,
    source_project: Optional[str],
    evidence_description: Optional[str],
    recorded_date: Optional[str] = None,
) -> ProfileEvidenceOut:
    seed_profile_if_empty(db)
    status_clean = evidence_status if evidence_status in VALID_EVIDENCE_STATUSES else "Partial"
    existing = db.query(ProfileEvidence).filter(ProfileEvidence.skill_id == skill_id).first()
    if existing:
        existing.evidence_status = status_clean
        existing.contribution_type = contribution_type or existing.contribution_type
        if source_project is not None:
            existing.source_project = source_project
        if evidence_description is not None:
            existing.evidence_description = evidence_description
        if recorded_date:
            existing.recorded_date = recorded_date
        existing.updated_at = utcnow()
        db.commit()
        db.refresh(existing)
        return _to_evidence_out(existing)

    ev = ProfileEvidence(
        skill_id=skill_id,
        evidence_status=status_clean,
        contribution_type=contribution_type or "Independent",
        source_project=source_project,
        evidence_description=evidence_description,
        recorded_date=recorded_date or _today_str(),
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _to_evidence_out(ev)


def validate_resume_parse(raw_text: Optional[str]) -> ResumeParseCheck:
    """Validates extracted resume text and flags corrupted/scrambled/empty extracts (FR-39)."""
    if not raw_text or not raw_text.strip():
        return ResumeParseCheck(
            status="Empty",
            char_count=0,
            line_count=0,
            warnings=["Resume text is empty or unreadable. Upload a text-based PDF/TeX or paste text manually."],
        )

    text = raw_text.strip()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    char_count = len(text)
    line_count = len(lines)
    warnings: List[str] = []

    if char_count < 200:
        warnings.append(
            f"Extracted resume text is unusually short ({char_count} characters). Verify document was not scanned/image-only."
        )

    if line_count >= 10:
        short_lines = sum(1 for ln in lines if len(ln) < 12)
        if short_lines / line_count > 0.55:
            warnings.append(
                "High ratio of fragmented short lines detected (possible multi-column PDF scrambling). Please review raw text."
            )

    if re.search(r"\s{8,}", text):
        warnings.append("Excessive consecutive whitespace blocks detected; check table/column alignment.")

    status = "Warning" if warnings else "Healthy"
    return ResumeParseCheck(
        status=status,
        char_count=char_count,
        line_count=line_count,
        warnings=warnings,
    )


def match_text_to_canonical_skills(text: str, db: Session) -> Dict[int, str]:
    """
    Scans text using the exact same Skill + SkillAlias taxonomy as JD extraction (BR-14).
    Returns mapping of { skill_id: verbatim_matching_line }.
    """
    if not text or not text.strip():
        return {}

    seed_taxonomy_if_empty(db)
    skills = db.query(Skill).all()
    aliases = db.query(SkillAlias).all()

    alias_map: Dict[str, int] = {}
    for a in aliases:
        alias_map[a.alias_text.lower()] = a.skill_id
    for s in skills:
        alias_map[s.canonical_name.lower()] = s.id

    sorted_aliases = sorted(alias_map.keys(), key=lambda x: len(x), reverse=True)
    # Use raw lines first so resume bullet points preserve clean line references, fallback to sentences
    lines = [ln.strip() for ln in text.splitlines() if len(ln.strip()) >= 5]
    if len(lines) < 3:
        lines = _split_into_sentences(text)

    matched: Dict[int, str] = {}
    for line in lines:
        line_lower = line.lower()
        for alias in sorted_aliases:
            pattern = r"(?i)\b" + re.escape(alias) + r"\b"
            if re.search(pattern, line_lower):
                sid = alias_map[alias]
                if sid not in matched:
                    matched[sid] = line[:260]
    return matched


def _extract_education_and_experience(job: JobListing) -> Tuple[List[str], List[str]]:
    """Extracts explicit education/degree clauses and years-of-experience statements (BR-15)."""
    qual_text = "\n".join(
        part for part in [job.qualifications, job.preferred_qualifications, job.summary] if part
    )
    sentences = _split_into_sentences(qual_text)

    edu_patterns = re.compile(
        r"(?i)\b(bachelor|master|postgraduate|post-graduate|mba|cfa|ca\b|phd|degree|diploma|finance\s+degree|university|graduate)\b"
    )
    exp_patterns = re.compile(
        r"(?i)(\b\d+\s*\+?\s*(?:to\s+\d+\s*)?years?\b|\bminimum\s+of\s+\d+\s+years\b|\bsenior\b|\bexperienced\b)"
    )

    edu_reqs: List[str] = []
    exp_reqs: List[str] = []
    for s in sentences:
        if edu_patterns.search(s) and s not in edu_reqs:
            edu_reqs.append(s[:220])
        if exp_patterns.search(s) and s not in exp_reqs:
            exp_reqs.append(s[:220])
    return edu_reqs, exp_reqs


def _evaluate_education_eligibility(
    edu_reqs: List[str],
    profile: UserProfile,
    job_title: str,
) -> DimensionEvaluation:
    """Strictly evaluates degree/finance prerequisites under Education & Eligibility (BR-15, TC-21)."""
    if not edu_reqs:
        return DimensionEvaluation(
            dimension_key="education_eligibility",
            dimension_label="Education & Eligibility",
            status_badge="Strong",
            summary="No restrictive formal degree or license prerequisites detected in this job description.",
            matched_items=[profile.highest_degree],
            gap_items=[],
        )

    edu_blob = " ".join(edu_reqs).lower()
    user_edu_lower = f"{profile.highest_degree} {profile.education_summary or ''}".lower()

    matched: List[str] = [f"Candidate education: {profile.highest_degree}"]
    gaps: List[str] = []

    requires_postgrad_finance = bool(
        re.search(
            r"(?i)(postgraduate|post-graduate|master'?s|mba|cfa)\s+(?:in\s+|degree\s+in\s+|or\s+\w+\s+in\s+)?.*?(finance|accounting|commerce|economics|banking)",
            edu_blob,
        )
        or (
            "reference data" in (job_title or "").lower()
            and re.search(r"(?i)(postgraduate|master|finance|mba)", edu_blob)
        )
    )

    if requires_postgrad_finance and "postgraduate finance" not in user_edu_lower and "mba" not in user_edu_lower and "m.com" not in user_edu_lower:
        gaps.append(
            "Formal postgraduate finance / MBA / CFA eligibility criterion not met by IT & Data Science degree track (BR-15)."
        )
    elif re.search(r"(?i)\b(postgraduate|master'?s|mba)\b", edu_blob) and "pursuing" in user_edu_lower:
        gaps.append("Master's / Postgraduate credential listed (M.Sc. Data Science currently pursuing).")

    if gaps:
        return DimensionEvaluation(
            dimension_key="education_eligibility",
            dimension_label="Education & Eligibility",
            status_badge="Eligibility Gap",
            summary="Formal degree/postgraduate eligibility requirements flagged separately from learnable technical skills (BR-15).",
            matched_items=matched,
            gap_items=gaps,
            notes="Source requirements: " + " | ".join(edu_reqs[:2]),
        )

    return DimensionEvaluation(
        dimension_key="education_eligibility",
        dimension_label="Education & Eligibility",
        status_badge="Strong",
        summary="B.Sc. IT & M.Sc. Data Science (pursuing) align with the stated technical/analytical degree expectations.",
        matched_items=matched + edu_reqs[:2],
        gap_items=[],
    )


def _evaluate_experience_alignment(exp_reqs: List[str], profile: UserProfile) -> DimensionEvaluation:
    if not exp_reqs:
        return DimensionEvaluation(
            dimension_key="experience_alignment",
            dimension_label="Experience Alignment",
            status_badge="Review Needed",
            summary="No explicit minimum years-of-experience clause parsed; verify role seniority manually.",
            matched_items=[profile.years_experience],
            gap_items=[],
        )

    years_found = [int(m) for m in re.findall(r"\b(\d+)\s*\+?\s*years?\b", " ".join(exp_reqs), re.IGNORECASE)]
    max_req_years = max(years_found) if years_found else 0
    gaps: List[str] = []
    if max_req_years >= 3:
        gaps.append(
            f"Role asks for {max_req_years}+ years of industry experience vs. current internship/teaching track ({profile.years_experience})."
        )
        badge = "Gap"
        summary = f"Experience gap identified ({max_req_years}+ years requested)."
    elif max_req_years >= 1:
        gaps.append(f"Role requests {max_req_years}+ years experience; internships and CardLyze deliverables partially offset.")
        badge = "Partial"
        summary = f"Entry/early-career stretch ({max_req_years}+ years requested)."
    else:
        badge = "Strong"
        summary = "Experience expectations align with early-career / internship profile."

    return DimensionEvaluation(
        dimension_key="experience_alignment",
        dimension_label="Experience Alignment",
        status_badge=badge,
        summary=summary,
        matched_items=[profile.years_experience],
        gap_items=gaps,
        notes=exp_reqs[0] if exp_reqs else None,
    )


def _evaluate_skill_dimension(
    label: str,
    key: str,
    rows: List[SkillCoverageComparisonRow],
) -> DimensionEvaluation:
    if not rows:
        return DimensionEvaluation(
            dimension_key=key,
            dimension_label=label,
            status_badge="Strong",
            summary=f"No specific {label.lower()} requirements extracted for this role.",
            matched_items=[],
            gap_items=[],
        )

    matched = [
        f"{r.canonical_name} ({r.profile_evidence_status})"
        for r in rows
        if r.profile_evidence_status in ("Demonstrated", "Partial")
    ]
    gaps = [
        f"{r.canonical_name} [{r.requirement_type}]"
        for r in rows
        if r.profile_evidence_status in ("Not demonstrated", "Learning")
    ]

    if not gaps:
        badge = "Strong"
    elif matched:
        badge = "Partial"
    else:
        badge = "Gap"

    return DimensionEvaluation(
        dimension_key=key,
        dimension_label=label,
        status_badge=badge,
        summary=f"{len(matched)} of {len(rows)} extracted {label.lower()} backed by profile evidence.",
        matched_items=matched,
        gap_items=gaps,
    )


def evaluate_profile_vs_job(
    db: Session,
    job_id: int,
    resume_id: Optional[int] = None,
) -> Optional[ProfileJobMatchResponse]:
    """
    Deterministic multi-dimensional profile vs. JD evaluation and resume audit
    (FR-20, FR-21, FR-38, FR-39, FR-40, BR-13, BR-14, BR-15, TC-15, TC-19, TC-20, TC-21).
    Does NOT generate a single composite percentage score.
    """
    profile = seed_profile_if_empty(db)
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        return None

    # Ensure JD skills are extracted
    job_skills = (
        db.query(JobSkill)
        .filter(JobSkill.job_id == job.id)
        .filter(JobSkill.review_status != "Rejected")
        .all()
    )
    if not job_skills and job.status == "Available":
        job_skills = [js for js in extract_and_save_job_skills(job, db) if js.review_status != "Rejected"]

    # Resolve resume (specified or active)
    resume: Optional[ResumeDocument] = None
    if resume_id is not None:
        resume = db.query(ResumeDocument).filter(ResumeDocument.id == resume_id).first()
    if not resume:
        resume = db.query(ResumeDocument).filter(ResumeDocument.is_active == 1).first() or db.query(ResumeDocument).first()

    resume_text = (resume.raw_text or "") if resume else ""
    parse_check = validate_resume_parse(resume_text)
    resume_skill_lines = match_text_to_canonical_skills(resume_text, db)

    # Load all ProfileEvidence mapped by skill_id
    ev_by_skill: Dict[int, ProfileEvidence] = {
        ev.skill_id: ev for ev in db.query(ProfileEvidence).all()
    }
    skills_by_id: Dict[int, Skill] = {s.id: s for s in db.query(Skill).all()}

    # Build SkillCoverageComparisonRows for every extracted JD skill
    coverage_rows: List[SkillCoverageComparisonRow] = []
    for js in job_skills:
        skill = js.skill or skills_by_id.get(js.skill_id)
        if not skill:
            continue
        ev = ev_by_skill.get(skill.id)
        resume_line = resume_skill_lines.get(skill.id)
        coverage_rows.append(
            SkillCoverageComparisonRow(
                skill_id=skill.id,
                canonical_name=skill.canonical_name,
                category=skill.category,
                requirement_type=js.requirement_type,
                mentioned_in_resume=resume_line is not None,
                jd_evidence_snippet=js.evidence_snippet,
                resume_matching_line=resume_line,
                profile_evidence_status=ev.evidence_status if ev else "Not demonstrated",
                contribution_type=ev.contribution_type if ev else None,
                source_project=ev.source_project if ev else None,
            )
        )

    coverage_rows.sort(key=lambda r: (r.requirement_type != "Required", r.canonical_name))

    # FR-40 / BR-13 / TC-20: Claimed in resume but unsupported by verified profile evidence
    claimed_unsupported: List[ClaimedUnsupportedItem] = []
    for skill_id, matching_line in resume_skill_lines.items():
        skill = skills_by_id.get(skill_id)
        if not skill:
            continue
        ev = ev_by_skill.get(skill_id)
        current_status = ev.evidence_status if ev else "Not demonstrated"
        if current_status in ("Not demonstrated", "Learning"):
            claimed_unsupported.append(
                ClaimedUnsupportedItem(
                    skill_id=skill.id,
                    canonical_name=skill.canonical_name,
                    category=skill.category,
                    resume_matching_line=matching_line,
                    current_evidence_status=current_status,
                    warning_message=(
                        f"Claimed in resume, unsupported by profile evidence (current status: {current_status}; BR-13)."
                    ),
                )
            )
    claimed_unsupported.sort(key=lambda x: x.canonical_name)

    # Separate 6 Dimensions (FR-21)
    tech_rows = [r for r in coverage_rows if r.category == "Technical"]
    domain_rows = [r for r in coverage_rows if r.category in ("Governance & Quality", "Finance & Risk")]
    core_rows = [r for r in coverage_rows if r.category == "Core Competency"]

    edu_reqs, exp_reqs = _extract_education_and_experience(job)
    edu_dim = _evaluate_education_eligibility(edu_reqs, profile, job.title)
    exp_dim = _evaluate_experience_alignment(exp_reqs, profile)

    independent_count = sum(
        1 for r in coverage_rows if r.contribution_type and "independent" in r.contribution_type.lower()
    )
    ai_only_count = sum(
        1
        for r in coverage_rows
        if r.contribution_type
        and "ai-assisted" in r.contribution_type.lower()
        and "independent" not in r.contribution_type.lower()
    )
    evidence_dim = DimensionEvaluation(
        dimension_key="evidence_strength",
        dimension_label="Evidence Strength & Attribution",
        status_badge="Partial" if (claimed_unsupported or ai_only_count > 0) else "Strong",
        summary=(
            f"{independent_count} JD skills backed by independent deliverables; "
            f"{ai_only_count} AI-assisted only; {len(claimed_unsupported)} resume keyword(s) need evidence."
        ),
        matched_items=[
            f"{r.canonical_name}: {r.contribution_type} ({r.source_project})"
            for r in coverage_rows
            if r.profile_evidence_status in ("Demonstrated", "Partial")
        ],
        gap_items=[f"{c.canonical_name} (Claimed unsupported in resume)" for c in claimed_unsupported],
    )

    dimensions = [
        _evaluate_skill_dimension("Technical Skills", "technical_skills", tech_rows),
        _evaluate_skill_dimension("Domain & Governance", "domain_governance", domain_rows),
        _evaluate_skill_dimension("Core Competencies", "core_competencies", core_rows),
        edu_dim,
        exp_dim,
        evidence_dim,
    ]

    return ProfileJobMatchResponse(
        job_id=job.id,
        job_title=job.title,
        external_job_id=job.external_job_id,
        role_family=job.role_family,
        resume_id=resume.id if resume else None,
        resume_name=resume.name if resume else None,
        parse_check=parse_check,
        dimensions=dimensions,
        skill_coverage=coverage_rows,
        claimed_unsupported=claimed_unsupported,
        education_requirements=edu_reqs,
        experience_requirements=exp_reqs,
    )
