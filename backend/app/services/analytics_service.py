from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import JobListing, Skill, JobSkill
from app.models.schemas import (
    SkillCoverageItem,
    CoverageResponse,
    MatrixJobInfo,
    CrossRoleMatrixResponse,
    SkillEvidenceItem,
    SkillEvidenceResponse,
)
from app.services.taxonomy_service import seed_taxonomy_if_empty, extract_and_save_job_skills


def _ensure_skills_extracted(db: Session):
    """Ensures that skills are seeded and extracted for any un-extracted available jobs."""
    seed_taxonomy_if_empty(db)
    available_jobs = db.query(JobListing).filter(JobListing.status == "Available").all()
    # Check if we have extracted skills
    existing_job_ids = {r[0] for r in db.query(JobSkill.job_id).distinct().all()}
    for job in available_jobs:
        if job.id not in existing_job_ids:
            extract_and_save_job_skills(job, db)


def compute_skill_coverage(
    db: Session,
    role_family: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> CoverageResponse:
    """
    Computes mathematical skill coverage across available jobs (FR-15, BR-06, BR-07, TC-11, TC-12).
    - Denominator N is strictly the count of selected jobs with status == 'Available'.
    - Jobs with status 'JD unavailable' are excluded from the denominator (BR-06).
    - A single job contributes at most 1 to a skill's count (BR-07).
    - If role_family filter is provided, recalculates N and coverage strictly for that family (TC-12).
    """
    _ensure_skills_extracted(db)

    # Base query for analysable denominator jobs
    job_query = db.query(JobListing).filter(JobListing.status == "Available")
    total_jobs_count = db.query(JobListing).count()

    # Role family counts across all available jobs
    all_available = job_query.all()
    role_family_counts: Dict[str, int] = {}
    for j in all_available:
        fam_key = j.role_family.split(":")[0].strip()
        role_family_counts[fam_key] = role_family_counts.get(fam_key, 0) + 1

    # Apply family filter if present
    if role_family and role_family != "All":
        target_fam = role_family.split(":")[0].strip().lower()
        active_jobs = [j for j in all_available if j.role_family.split(":")[0].strip().lower() == target_fam]
    else:
        active_jobs = all_available

    denominator = len(active_jobs)
    active_job_ids = {j.id for j in active_jobs}

    # Query all skills
    skills_query = db.query(Skill)
    if category and category != "All":
        skills_query = skills_query.filter(Skill.category == category)
    if search:
        search_term = f"%{search.strip()}%"
        skills_query = skills_query.filter(Skill.canonical_name.ilike(search_term))

    all_skills = skills_query.order_by(Skill.canonical_name).all()

    # Query job_skills for the active jobs
    job_skills = (
        db.query(JobSkill)
        .filter(JobSkill.job_id.in_(active_job_ids))
        .filter(JobSkill.review_status != "Rejected")
        .all()
    )

    # Map: skill_id -> list of JobSkill records for active jobs
    by_skill_id: Dict[int, List[JobSkill]] = {}
    for js in job_skills:
        by_skill_id.setdefault(js.skill_id, []).append(js)

    # Pre-map all available jobs by ID for family lookup
    job_by_id = {j.id: j for j in all_available}

    coverage_items: List[SkillCoverageItem] = []

    for skill in all_skills:
        records = by_skill_id.get(skill.id, [])
        # Distinct jobs constraint (BR-07)
        distinct_jobs = {r.job_id for r in records}
        distinct_count = len(distinct_jobs)

        if denominator > 0:
            coverage_pct = round((distinct_count / denominator) * 100, 1)
        else:
            coverage_pct = 0.0

        # Required vs Preferred counts (distinct jobs)
        req_jobs = {r.job_id for r in records if r.requirement_type == "Required"}
        pref_jobs = {r.job_id for r in records if r.requirement_type == "Preferred"}

        # Family breakdown across all available jobs
        all_skill_records = (
            db.query(JobSkill)
            .filter(JobSkill.skill_id == skill.id)
            .filter(JobSkill.review_status != "Rejected")
            .all()
        )
        fam_a_jobs = set()
        fam_b_jobs = set()
        fam_c_jobs = set()

        for r in all_skill_records:
            j = job_by_id.get(r.job_id)
            if j and j.status == "Available":
                fam = j.role_family.lower()
                if "family a" in fam or "governance" in fam:
                    fam_a_jobs.add(j.id)
                elif "family b" in fam or "analytics" in fam or "automation" in fam:
                    fam_b_jobs.add(j.id)
                elif "family c" in fam or "finance" in fam or "credit" in fam:
                    fam_c_jobs.add(j.id)

        coverage_items.append(
            SkillCoverageItem(
                skill_id=skill.id,
                canonical_name=skill.canonical_name,
                category=skill.category,
                distinct_job_count=distinct_count,
                coverage_percentage=coverage_pct,
                required_count=len(req_jobs),
                preferred_count=len(pref_jobs),
                family_a_count=len(fam_a_jobs),
                family_b_count=len(fam_b_jobs),
                family_c_count=len(fam_c_jobs),
            )
        )

    # Sort descending by coverage percentage, then by canonical name
    coverage_items.sort(key=lambda x: (x.coverage_percentage, x.distinct_job_count, x.canonical_name), reverse=True)

    return CoverageResponse(
        total_jobs=total_jobs_count,
        analysable_count=denominator,
        role_family_counts=role_family_counts,
        active_family_filter=role_family,
        skills=coverage_items,
    )


def compute_cross_role_matrix(db: Session) -> CrossRoleMatrixResponse:
    """
    Builds the cross-role comparative analytics matrix (FR-16).
    Rows = Canonical skills sorted by frequency.
    Columns = All analysable jobs ($N=10$).
    Cells = 'required' | 'preferred' | 'none'.
    """
    _ensure_skills_extracted(db)

    # Available jobs
    available_jobs = (
        db.query(JobListing)
        .filter(JobListing.status == "Available")
        .order_by(JobListing.role_family, JobListing.id)
        .all()
    )
    analysable_count = len(available_jobs)
    job_ids = [j.id for j in available_jobs]

    family_counts: Dict[str, int] = {}
    jobs_info: List[MatrixJobInfo] = []
    for j in available_jobs:
        fam_key = j.role_family.split(":")[0].strip()
        family_counts[fam_key] = family_counts.get(fam_key, 0) + 1
        jobs_info.append(
            MatrixJobInfo(
                job_id=j.id,
                external_job_id=j.external_job_id or f"ID-{j.id}",
                title=j.title,
                role_family=j.role_family,
                status=j.status,
            )
        )

    # Coverage items across all available jobs
    coverage_data = compute_skill_coverage(db)
    skills = coverage_data.skills

    # Query all job_skills
    job_skills = (
        db.query(JobSkill)
        .filter(JobSkill.job_id.in_(job_ids))
        .filter(JobSkill.review_status != "Rejected")
        .all()
    )

    # Build matrix map: skill_id -> { job_id: status }
    matrix: Dict[int, Dict[int, str]] = {}
    for s in skills:
        matrix[s.skill_id] = {j_id: "none" for j_id in job_ids}

    for js in job_skills:
        if js.skill_id in matrix and js.job_id in matrix[js.skill_id]:
            status_val = "required" if js.requirement_type == "Required" else "preferred"
            matrix[js.skill_id][js.job_id] = status_val

    return CrossRoleMatrixResponse(
        total_analysable_jobs=analysable_count,
        family_counts=family_counts,
        jobs=jobs_info,
        skills=skills,
        matrix=matrix,
    )


def get_skill_evidence(
    skill_id: int,
    db: Session,
    status_filter: Optional[str] = "Available",
) -> SkillEvidenceResponse:
    """
    Returns verbatim JD evidence snippets and metadata for all jobs mentioning a specific skill (FR-15).
    Filters to status == 'Available' by default to match the analysable denominator (BR-06).
    """
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise ValueError(f"Skill with ID {skill_id} not found.")

    query = (
        db.query(JobSkill)
        .join(JobListing, JobSkill.job_id == JobListing.id)
        .filter(JobSkill.skill_id == skill_id)
        .filter(JobSkill.review_status != "Rejected")
    )
    if status_filter and status_filter != "All":
        query = query.filter(JobListing.status == status_filter)

    records = query.order_by(JobListing.role_family, JobListing.id).all()

    items: List[SkillEvidenceItem] = []
    seen_jobs = set()

    for r in records:
        job = r.job
        if job.id not in seen_jobs:
            seen_jobs.add(job.id)
            items.append(
                SkillEvidenceItem(
                    job_id=job.id,
                    job_title=job.title,
                    external_job_id=job.external_job_id,
                    role_family=job.role_family,
                    requirement_type=r.requirement_type,
                    review_status=r.review_status,
                    evidence_snippet=r.evidence_snippet or f"Mentioned via {r.matched_alias or skill.canonical_name}.",
                )
            )

    return SkillEvidenceResponse(
        skill_id=skill.id,
        canonical_name=skill.canonical_name,
        category=skill.category,
        distinct_jobs_count=len(items),
        items=items,
    )
