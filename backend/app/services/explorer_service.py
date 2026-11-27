import math
from typing import Dict, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.entities import JobListing, JobSkill, Skill
from app.models.schemas import (
    ExplorerJobEvidence,
    ExplorerSkillItem,
    MatrixJobInfo,
    SkillExplorerResponse,
)
from app.services.taxonomy_service import extract_and_save_job_skills, seed_taxonomy_if_empty


def compare_selected_jobs_skills(
    db: Session,
    user_id: Optional[int] = None,
    job_ids: Optional[List[int]] = None,
    role_family: Optional[str] = None,
) -> SkillExplorerResponse:
    """
    Compares skills across a user-selected subset of jobs or Role Family (v3.0 Skill Explorer).
    Buckets canonical skills into:
    - common_core: appears across >= 60% of selected jobs (at least 2 when N>=2)
    - shared: appears in 2+ selected jobs below common_core threshold
    - role_specific: appears in exactly 1 selected job
    """
    seed_taxonomy_if_empty(db)

    query = db.query(JobListing).filter(JobListing.status != "JD unavailable")
    if user_id is not None:
        query = query.filter(or_(JobListing.user_id.is_(None), JobListing.user_id == user_id))
    else:
        query = query.filter(JobListing.user_id.is_(None))

    all_available = query.order_by(JobListing.id.asc()).all()

    # Ensure every job with text has extracted skills
    existing_job_ids = {r[0] for r in db.query(JobSkill.job_id).distinct().all()}
    for j in all_available:
        if j.id not in existing_job_ids and (j.original_description or j.responsibilities or j.qualifications):
            extract_and_save_job_skills(j, db)

    available_info = [
        MatrixJobInfo(
            job_id=j.id,
            external_job_id=j.external_job_id,
            title=j.title,
            role_family=j.role_family,
            status=j.status,
        )
        for j in all_available
    ]

    # Resolve selected jobs
    if job_ids:
        id_set = set(job_ids)
        selected_jobs = [j for j in all_available if j.id in id_set]
    elif role_family and role_family != "All":
        fam_prefix = role_family.split(":")[0].strip().lower()
        selected_jobs = [j for j in all_available if j.role_family.split(":")[0].strip().lower() == fam_prefix]
    else:
        selected_jobs = all_available

    selected_ids = [j.id for j in selected_jobs]
    n_selected = len(selected_jobs)

    if n_selected == 0:
        return SkillExplorerResponse(
            selected_job_ids=[],
            total_selected_jobs=0,
            available_jobs=available_info,
            common_core=[],
            shared=[],
            role_specific=[],
        )

    job_by_id = {j.id: j for j in selected_jobs}
    skills_by_id = {s.id: s for s in db.query(Skill).all()}

    records = (
        db.query(JobSkill)
        .filter(JobSkill.job_id.in_(selected_ids))
        .filter(JobSkill.review_status != "Rejected")
        .all()
    )

    by_skill: Dict[int, Dict[int, JobSkill]] = {}
    for rec in records:
        by_skill.setdefault(rec.skill_id, {})[rec.job_id] = rec

    common_threshold = 1 if n_selected == 1 else max(2, math.ceil(0.6 * n_selected))

    common_core: List[ExplorerSkillItem] = []
    shared: List[ExplorerSkillItem] = []
    role_specific: List[ExplorerSkillItem] = []

    for skill_id, job_map in by_skill.items():
        skill = skills_by_id.get(skill_id)
        if not skill:
            continue

        evidences: List[ExplorerJobEvidence] = []
        req_count = 0
        pref_count = 0
        for jid, rec in job_map.items():
            job = job_by_id.get(jid)
            if not job:
                continue
            if rec.requirement_type == "Required":
                req_count += 1
            elif rec.requirement_type == "Preferred":
                pref_count += 1
            evidences.append(
                ExplorerJobEvidence(
                    job_id=job.id,
                    job_title=job.title,
                    external_job_id=job.external_job_id,
                    role_family=job.role_family,
                    requirement_type=rec.requirement_type,
                    evidence_snippet=rec.evidence_snippet,
                )
            )

        count = len(evidences)
        if count == 0:
            continue

        if count >= common_threshold and n_selected > 1:
            bucket = "common_core"
        elif count >= 2:
            bucket = "shared"
        elif n_selected == 1:
            bucket = "common_core"
        else:
            bucket = "role_specific"

        item = ExplorerSkillItem(
            skill_id=skill.id,
            canonical_name=skill.canonical_name,
            category=skill.category,
            selected_job_count=count,
            total_selected_jobs=n_selected,
            bucket=bucket,
            required_count=req_count,
            preferred_count=pref_count,
            evidences=sorted(evidences, key=lambda e: (e.requirement_type != "Required", e.job_title)),
        )

        if bucket == "common_core":
            common_core.append(item)
        elif bucket == "shared":
            shared.append(item)
        else:
            role_specific.append(item)

    sort_fn = lambda x: (-x.selected_job_count, -x.required_count, x.canonical_name)
    common_core.sort(key=sort_fn)
    shared.sort(key=sort_fn)
    role_specific.sort(key=sort_fn)

    return SkillExplorerResponse(
        selected_job_ids=selected_ids,
        total_selected_jobs=n_selected,
        available_jobs=available_info,
        common_core=common_core,
        shared=shared,
        role_specific=role_specific,
    )
