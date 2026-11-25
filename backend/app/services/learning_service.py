import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.entities import (
    JobListing,
    JobSkill,
    LearningProgress,
    LearningResource,
    ProfileEvidence,
    Skill,
    utcnow,
)
from app.models.schemas import (
    LearningProgressResponse,
    LearningProgressUpdate,
    LearningRecommendationItem,
    LearningRecommendationsResponse,
    LearningResourceCreate,
    LearningResourceOut,
)
from app.services.profile_service import seed_profile_if_empty
from app.services.taxonomy_service import seed_taxonomy_if_empty

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "learning_resources.json"
VALID_COST_STATUSES = {"Free", "Paid", "Freemium", "Unknown"}
VALID_PROGRESS_STATUSES = {"Not started", "In progress", "Completed", "Paused"}


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def seed_learning_resources_if_empty(db: Session) -> int:
    """Seeds vetted learning resources from learning_resources.json if table is empty."""
    count = db.query(LearningResource).count()
    if count > 0:
        return count

    if not CATALOG_PATH.exists():
        return 0

    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    added = 0
    for item in data:
        res = LearningResource(
            provider=item["provider"],
            title=item["title"],
            url=item.get("url"),
            skills_addressed=json.dumps(item.get("skills", [])),
            cost_status=item.get("cost_status", "Unknown"),
            has_certificate=1 if item.get("has_certificate") else 0,
            duration=item.get("duration"),
            verification_date=item.get("verification_date", _today_str()),
            description=item.get("description"),
            is_custom=0,
        )
        db.add(res)
        db.flush()
        db.add(LearningProgress(resource_id=res.id, status="Not started"))
        added += 1
    db.commit()
    return added


def _parse_skills_list(raw: str) -> List[str]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(s) for s in parsed]
    except Exception:
        pass
    return [s.strip() for s in (raw or "").split(",") if s.strip()]


def _to_resource_out(res: LearningResource) -> LearningResourceOut:
    prog = res.progress
    return LearningResourceOut(
        id=res.id,
        provider=res.provider,
        title=res.title,
        url=res.url,
        skills_addressed=_parse_skills_list(res.skills_addressed),
        cost_status=res.cost_status,
        has_certificate=bool(res.has_certificate),
        duration=res.duration,
        verification_date=res.verification_date,
        description=res.description,
        is_custom=bool(res.is_custom),
        progress_status=prog.status if prog else "Not started",
        started_at=prog.started_at if prog else None,
        completed_at=prog.completed_at if prog else None,
        notes=prog.notes if prog else None,
        updated_at=prog.updated_at if prog else res.updated_at,
    )


def list_learning_resources(
    db: Session,
    cost_status: Optional[str] = None,
    progress_status: Optional[str] = None,
    skill: Optional[str] = None,
    search: Optional[str] = None,
) -> List[LearningResourceOut]:
    seed_learning_resources_if_empty(db)
    resources = db.query(LearningResource).order_by(LearningResource.id.asc()).all()
    items = [_to_resource_out(r) for r in resources]

    if cost_status and cost_status != "All":
        items = [i for i in items if i.cost_status.lower() == cost_status.lower()]
    if progress_status and progress_status != "All":
        items = [i for i in items if i.progress_status.lower() == progress_status.lower()]
    if skill and skill != "All":
        skill_lower = skill.lower()
        items = [i for i in items if any(s.lower() == skill_lower for s in i.skills_addressed)]
    if search and search.strip():
        q = search.strip().lower()
        items = [
            i
            for i in items
            if q in i.title.lower()
            or q in i.provider.lower()
            or any(q in s.lower() for s in i.skills_addressed)
        ]
    return items


def create_learning_resource(db: Session, payload: LearningResourceCreate) -> LearningResourceOut:
    seed_learning_resources_if_empty(db)
    cost = payload.cost_status if payload.cost_status in VALID_COST_STATUSES else "Unknown"
    verif = payload.verification_date or _today_str()
    res = LearningResource(
        provider=payload.provider.strip(),
        title=payload.title.strip(),
        url=payload.url.strip() if payload.url else None,
        skills_addressed=json.dumps(payload.skills_addressed),
        cost_status=cost,
        has_certificate=1 if payload.has_certificate else 0,
        duration=payload.duration,
        verification_date=verif,
        description=payload.description,
        is_custom=1,
    )
    db.add(res)
    db.flush()
    db.add(LearningProgress(resource_id=res.id, status="Not started"))
    db.commit()
    db.refresh(res)
    return _to_resource_out(res)


def update_learning_progress(
    db: Session,
    resource_id: int,
    payload: LearningProgressUpdate,
) -> Optional[LearningProgressResponse]:
    """
    Updates course/resource study progress (FR-24).
    Strictly enforces BR-09 & TC-14: NEVER upgrades ProfileEvidence to Demonstrated automatically!
    """
    res = db.query(LearningResource).filter(LearningResource.id == resource_id).first()
    if not res:
        return None

    new_status = payload.status if payload.status in VALID_PROGRESS_STATUSES else "Not started"
    prog = res.progress
    if not prog:
        prog = LearningProgress(resource_id=res.id, status=new_status)
        db.add(prog)

    today = _today_str()
    prog.status = new_status
    if payload.started_at is not None:
        prog.started_at = payload.started_at
    elif new_status == "In progress" and not prog.started_at:
        prog.started_at = today

    if payload.completed_at is not None:
        prog.completed_at = payload.completed_at
    elif new_status == "Completed" and not prog.completed_at:
        prog.completed_at = today

    if payload.notes is not None:
        prog.notes = payload.notes
    prog.updated_at = utcnow()
    db.commit()
    db.refresh(res)

    notice = (
        "Progress updated to Completed. Per BR-09, your Profile Evidence was NOT auto-upgraded to Demonstrated "
        "— record a hands-on project deliverable in Profile & Resume once ready."
        if new_status == "Completed"
        else f"Study progress saved as '{new_status}'."
    )
    return LearningProgressResponse(
        resource=_to_resource_out(res),
        profile_evidence_auto_upgraded=False,
        policy_notice=notice,
    )


def get_gap_recommendations(
    db: Session,
    job_id: Optional[int] = None,
) -> LearningRecommendationsResponse:
    """
    Recommends learning resources mapped directly to unverified/missing JD skill gaps (FR-23, BR-10, BR-11).
    """
    seed_taxonomy_if_empty(db)
    seed_profile_if_empty(db)
    seed_learning_resources_if_empty(db)

    available_jobs = db.query(JobListing).filter(JobListing.status == "Available").all()
    target_job: Optional[JobListing] = None
    if job_id is not None:
        target_job = db.query(JobListing).filter(JobListing.id == job_id).first()
        scoped_jobs = [target_job] if target_job else available_jobs
    else:
        scoped_jobs = available_jobs

    scoped_ids = {j.id for j in scoped_jobs if j}
    job_skills = (
        db.query(JobSkill)
        .filter(JobSkill.job_id.in_(scoped_ids))
        .filter(JobSkill.review_status != "Rejected")
        .all()
    )

    skills_by_id = {s.id: s for s in db.query(Skill).all()}
    ev_by_skill_id = {ev.skill_id: ev for ev in db.query(ProfileEvidence).all()}

    # Count distinct jobs requiring each skill & keep only skills lacking Demonstrated evidence
    skill_job_counts: Dict[str, set] = {}
    skill_evidence_status: Dict[str, str] = {}

    for js in job_skills:
        skill = skills_by_id.get(js.skill_id)
        if not skill:
            continue
        ev = ev_by_skill_id.get(skill.id)
        status = ev.evidence_status if ev else "Not demonstrated"
        if status in ("Not demonstrated", "Learning", "Partial"):
            skill_job_counts.setdefault(skill.canonical_name, set()).add(js.job_id)
            skill_evidence_status[skill.canonical_name] = status

    # Rank gap skills by priority: unverified (Not demonstrated / Learning) first, then demand count
    priority_gaps = sorted(
        skill_job_counts.keys(),
        key=lambda name: (
            0 if skill_evidence_status.get(name) in ("Not demonstrated", "Learning") else 1,
            -len(skill_job_counts[name]),
            name,
        ),
    )

    resources = [_to_resource_out(r) for r in db.query(LearningResource).all()]
    recs: List[LearningRecommendationItem] = []

    for res_out in resources:
        matched_gaps = [s for s in res_out.skills_addressed if s in skill_job_counts]
        if not matched_gaps:
            continue
        max_cov = max(len(skill_job_counts[g]) for g in matched_gaps)
        primary_gap = max(matched_gaps, key=lambda g: len(skill_job_counts[g]))
        ev_state = skill_evidence_status.get(primary_gap, "Not demonstrated")
        denom = len(scoped_ids)
        gap_reason = (
            f"Addresses '{primary_gap}' ({ev_state}) — requested across {len(skill_job_counts[primary_gap])} "
            f"of {denom} active JPMC role{'s' if denom != 1 else ''}."
        )
        pricing_warning = (
            "Pricing unverified — verify current enrollment fee before starting (BR-11)."
            if res_out.cost_status == "Unknown"
            else None
        )
        recs.append(
            LearningRecommendationItem(
                resource=res_out,
                addressed_gaps=matched_gaps,
                max_jd_coverage_count=max_cov,
                gap_reason=gap_reason,
                pricing_warning=pricing_warning,
            )
        )

    recs.sort(key=lambda r: (-r.max_jd_coverage_count, -len(r.addressed_gaps), r.resource.cost_status != "Free"))

    return LearningRecommendationsResponse(
        analysable_jobs_count=len(available_jobs),
        target_job_id=target_job.id if target_job else None,
        target_job_title=target_job.title if target_job else None,
        priority_gap_skills=priority_gaps[:10],
        recommendations=recs,
    )
