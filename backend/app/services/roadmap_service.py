import hashlib
import json
from typing import List, Optional
import requests
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import check_ai_rate_limit
from app.core.config import settings
from app.models.entities import (
    AICache,
    ExperienceEntry,
    JobListing,
    JobSkill,
    RoadmapItem,
    SavedResource,
    Skill,
    utcnow,
)
from app.models.schemas import (
    RoadmapItemCreate,
    RoadmapItemOut,
    RoadmapItemUpdate,
    RoadmapReviewResponse,
    SavedResourceCreate,
    SavedResourceOut,
)
from app.services.taxonomy_service import resolve_or_create_canonical_skill
from app.services.vault_service import redact_pii

VALID_PRIORITIES = {"High", "Medium", "Low"}
VALID_STATUSES = {"To Learn", "In Progress", "Done"}
VALID_RESOURCE_TYPES = {"Course", "Certification", "Docs", "Video", "Article", "Other"}


def _to_item_out(item: RoadmapItem, job_title_map: dict) -> RoadmapItemOut:
    return RoadmapItemOut(
        id=item.id,
        skill_id=item.skill_id,
        skill_name=item.skill_name,
        goal_note=item.goal_note,
        target_job_id=item.target_job_id,
        target_job_title=job_title_map.get(item.target_job_id) if item.target_job_id else None,
        priority=item.priority,
        status=item.status,
        sort_order=item.sort_order,
        resources=[SavedResourceOut.model_validate(r) for r in (item.resources or [])],
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def list_roadmap(db: Session, user_id: int) -> List[RoadmapItemOut]:
    items = (
        db.query(RoadmapItem)
        .filter(RoadmapItem.user_id == user_id)
        .order_by(RoadmapItem.sort_order.asc(), RoadmapItem.id.desc())
        .all()
    )
    job_ids = [i.target_job_id for i in items if i.target_job_id]
    job_titles = {}
    if job_ids:
        for jid, jtitle in db.query(JobListing.id, JobListing.title).filter(JobListing.id.in_(job_ids)).all():
            job_titles[jid] = jtitle
    return [_to_item_out(i, job_titles) for i in items]


def create_roadmap_item(db: Session, user_id: int, payload: RoadmapItemCreate) -> RoadmapItemOut:
    skill, _, _ = resolve_or_create_canonical_skill(payload.skill_name, db)
    priority = payload.priority if payload.priority in VALID_PRIORITIES else "Medium"
    status = payload.status if payload.status in VALID_STATUSES else "To Learn"

    # Prevent duplicate roadmap entries for the same canonical skill
    existing = (
        db.query(RoadmapItem)
        .filter(
            RoadmapItem.user_id == user_id,
            or_(
                RoadmapItem.skill_id == skill.id,
                RoadmapItem.skill_name.ilike(skill.canonical_name),
            ),
        )
        .first()
    )
    if existing:
        if payload.goal_note and not existing.goal_note:
            existing.goal_note = payload.goal_note.strip()
            existing.updated_at = utcnow()
            db.commit()
            db.refresh(existing)
        job_titles = {}
        if existing.target_job_id:
            j = db.query(JobListing).filter(JobListing.id == existing.target_job_id).first()
            if j:
                job_titles[j.id] = j.title
        return _to_item_out(existing, job_titles)

    item = RoadmapItem(
        user_id=user_id,
        skill_id=skill.id,
        skill_name=skill.canonical_name,
        goal_note=payload.goal_note.strip() if payload.goal_note else None,
        target_job_id=payload.target_job_id,
        priority=priority,
        status=status,
        sort_order=db.query(RoadmapItem).filter(RoadmapItem.user_id == user_id).count(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    job_titles = {}
    if item.target_job_id:
        j = db.query(JobListing).filter(JobListing.id == item.target_job_id).first()
        if j:
            job_titles[j.id] = j.title
    return _to_item_out(item, job_titles)


def update_roadmap_item(
    db: Session,
    user_id: int,
    item_id: int,
    payload: RoadmapItemUpdate,
) -> Optional[RoadmapItemOut]:
    item = (
        db.query(RoadmapItem)
        .filter(RoadmapItem.id == item_id, RoadmapItem.user_id == user_id)
        .first()
    )
    if not item:
        return None
    if payload.skill_name is not None:
        skill, _, _ = resolve_or_create_canonical_skill(payload.skill_name, db)
        item.skill_id = skill.id
        item.skill_name = skill.canonical_name
    if payload.goal_note is not None:
        item.goal_note = payload.goal_note.strip() or None
    if payload.target_job_id is not None:
        item.target_job_id = payload.target_job_id
    if payload.priority in VALID_PRIORITIES:
        item.priority = payload.priority
    if payload.status in VALID_STATUSES:
        item.status = payload.status
    if payload.sort_order is not None:
        item.sort_order = payload.sort_order
    item.updated_at = utcnow()
    db.commit()
    db.refresh(item)
    job_titles = {}
    if item.target_job_id:
        j = db.query(JobListing).filter(JobListing.id == item.target_job_id).first()
        if j:
            job_titles[j.id] = j.title
    return _to_item_out(item, job_titles)


def delete_roadmap_item(db: Session, user_id: int, item_id: int) -> bool:
    item = (
        db.query(RoadmapItem)
        .filter(RoadmapItem.id == item_id, RoadmapItem.user_id == user_id)
        .first()
    )
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True


def list_saved_resources(db: Session, user_id: int) -> List[SavedResourceOut]:
    rows = (
        db.query(SavedResource)
        .filter(SavedResource.user_id == user_id)
        .order_by(SavedResource.id.desc())
        .all()
    )
    return [SavedResourceOut.model_validate(r) for r in rows]


def create_saved_resource(db: Session, user_id: int, payload: SavedResourceCreate) -> SavedResourceOut:
    resolved_skill_name: Optional[str] = None
    if payload.skill_name and payload.skill_name.strip():
        skill, _, _ = resolve_or_create_canonical_skill(payload.skill_name, db)
        resolved_skill_name = skill.canonical_name

    # Ensure roadmap_item_id belongs to current_user if supplied
    roadmap_item_id = payload.roadmap_item_id
    if roadmap_item_id is not None:
        own_item = (
            db.query(RoadmapItem)
            .filter(RoadmapItem.id == roadmap_item_id, RoadmapItem.user_id == user_id)
            .first()
        )
        if not own_item:
            roadmap_item_id = None

    rtype = payload.resource_type if payload.resource_type in VALID_RESOURCE_TYPES else "Other"
    res = SavedResource(
        user_id=user_id,
        roadmap_item_id=roadmap_item_id,
        title=payload.title.strip(),
        url=payload.url.strip(),
        resource_type=rtype,
        skill_name=resolved_skill_name,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return SavedResourceOut.model_validate(res)


def delete_saved_resource(db: Session, user_id: int, resource_id: int) -> bool:
    row = (
        db.query(SavedResource)
        .filter(SavedResource.id == resource_id, SavedResource.user_id == user_id)
        .first()
    )
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def review_roadmap_with_ai(
    db: Session,
    user_id: int,
    job_ids: List[int],
    model_mode: str = "flash",
    force_refresh: bool = False,
) -> RoadmapReviewResponse:
    """
    On-demand AI advisor ('Review with AI') comparing user's custom roadmap against
    shortlisted jobs & Experience Vault with SHA-256 caching and PII redaction.
    """
    roadmap_items = db.query(RoadmapItem).filter(RoadmapItem.user_id == user_id).all()
    entries = db.query(ExperienceEntry).filter(ExperienceEntry.user_id == user_id).all()

    jobs_query = db.query(JobListing).filter(JobListing.status != "JD unavailable").filter(
        or_(JobListing.user_id.is_(None), JobListing.user_id == user_id)
    )
    if job_ids:
        jobs_query = jobs_query.filter(JobListing.id.in_(job_ids))
    jobs = jobs_query.all()

    model_name = (
        settings.GEMINI_DEEP_MODEL if model_mode == "pro" else settings.GEMINI_MODEL
    ) or "gemini-2.5-flash"

    roadmap_fp = "|".join(f"{r.id}:{r.skill_name}:{r.status}:{r.goal_note or ''}" for r in roadmap_items)
    vault_fp = "|".join(f"{e.id}:{e.updated_at.isoformat()}" for e in entries)
    jobs_fp = "|".join(str(j.id) for j in jobs)
    content_hash = hashlib.sha256(f"{user_id}|{roadmap_fp}|{vault_fp}|{jobs_fp}".encode("utf-8")).hexdigest()

    if not force_refresh:
        cached = (
            db.query(AICache)
            .filter(
                AICache.user_id == user_id,
                AICache.cache_type == "roadmap_review",
                AICache.content_hash == content_hash,
                AICache.model_used == model_name,
            )
            .first()
        )
        if cached:
            data = json.loads(cached.response_json)
            data["is_cached"] = True
            return RoadmapReviewResponse(**data)

    # Compute deterministic skill frequencies across selected jobs
    job_id_list = [j.id for j in jobs]
    skill_counts: dict[str, int] = {}
    if job_id_list:
        rows = (
            db.query(Skill.canonical_name, JobSkill.job_id)
            .join(JobSkill, JobSkill.skill_id == Skill.id)
            .filter(JobSkill.job_id.in_(job_id_list), JobSkill.review_status != "Rejected")
            .distinct()
            .all()
        )
        for sname, _ in rows:
            skill_counts[sname] = skill_counts.get(sname, 0) + 1

    roadmap_skill_set = {r.skill_name.lower() for r in roadmap_items}
    vault_blob = " ".join(f"{e.title} {e.detailed_narrative} {e.skill_tags}" for e in entries).lower()

    missing_common = [
        f"{name} ({cnt}/{len(jobs)} roles)"
        for name, cnt in sorted(skill_counts.items(), key=lambda x: -x[1])
        if cnt >= max(2, len(jobs) // 2) and name.lower() not in roadmap_skill_set and name.lower() not in vault_blob
    ][:5]

    niche_items = [
        f"{r.skill_name} (appears in {skill_counts.get(r.skill_name, 0)} selected role)"
        for r in roadmap_items
        if skill_counts.get(r.skill_name, 0) <= 1 and len(jobs) > 2
    ][:4]

    api_key = settings.GEMINI_API_KEY.strip()
    if api_key and (roadmap_items or jobs):
        check_ai_rate_limit(user_id, db=db, endpoint="roadmap_review")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        roadmap_text = "\n".join(
            f"- {r.skill_name} [{r.status}, {r.priority}]: {r.goal_note or 'No note'}"
            for r in roadmap_items
        ) or "Empty roadmap."
        vault_summary = "\n".join(
            f"- {e.title}: {redact_pii(e.detailed_narrative[:350])}"
            for e in entries[:8]
        ) or "No Experience Vault entries yet."
        top_demand = ", ".join(
            f"{k} ({v}/{len(jobs)})" for k, v in sorted(skill_counts.items(), key=lambda x: -x[1])[:12]
        )

        prompt = f"""
You are a concise, practical career mentor reviewing a candidate's self-created learning roadmap.

Target Roles ({len(jobs)}): {', '.join(j.title for j in jobs[:6])}
Top Skills Requested Across Target Roles: {top_demand}

Candidate Experience Vault Summary:
{vault_summary}

Candidate's Current Roadmap:
{roadmap_text}

Return strictly valid JSON:
{{
  "summary": "2-sentence direct assessment of how well this roadmap aligns with the target roles.",
  "missing_common_skills": ["High-demand skill missing from both Vault and Roadmap"],
  "niche_or_low_priority": ["Roadmap item that only shows up in 0-1 selected roles (optional detour)"],
  "project_ideas": ["Small, concrete hands-on project idea to prove a missing core skill"]
}}
"""
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.2},
        }
        candidate_models = []
        for m in [model_name, "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"]:
            if m and m not in candidate_models:
                candidate_models.append(m)

        for try_model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{try_model}:generateContent?key={api_key}"
            try:
                resp = requests.post(url, json=payload, timeout=settings.GEMINI_TIMEOUT_SECONDS)
                if resp.status_code == 200:
                    candidates = resp.json().get("candidates", [])
                    if candidates:
                        parsed = json.loads(candidates[0]["content"]["parts"][0]["text"].strip())
                        result = RoadmapReviewResponse(
                            summary=parsed.get("summary", "Roadmap review complete."),
                            missing_common_skills=parsed.get("missing_common_skills", [])[:5],
                            niche_or_low_priority=parsed.get("niche_or_low_priority", [])[:4],
                            project_ideas=parsed.get("project_ideas", [])[:4],
                            is_llm_powered=True,
                            is_cached=False,
                            model_used=try_model,
                        )
                        existing_cache = (
                            db.query(AICache)
                            .filter(
                                AICache.user_id == user_id,
                                AICache.cache_type == "roadmap_review",
                                AICache.content_hash == content_hash,
                                AICache.model_used == model_name,
                            )
                            .first()
                        )
                        if existing_cache:
                            existing_cache.response_json = result.model_dump_json()
                        else:
                            db.add(
                                AICache(
                                    user_id=user_id,
                                    cache_type="roadmap_review",
                                    content_hash=content_hash,
                                    model_used=model_name,
                                    response_json=result.model_dump_json(),
                                )
                            )
                        db.commit()
                        return result
                elif resp.status_code not in (404, 503, 429):
                    break
            except Exception:
                continue

    return RoadmapReviewResponse(
        summary=(
            f"Checked {len(roadmap_items)} roadmap item(s) against {len(jobs)} target role(s) locally."
            if roadmap_items
            else f"Your roadmap is empty. Compare against {len(jobs)} role(s) in Skill Explorer to pick your first goals."
        ),
        missing_common_skills=missing_common,
        niche_or_low_priority=niche_items,
        project_ideas=[
            f"Build a small end-to-end sample demonstrating {missing_common[0].split(' (')[0]}."
        ]
        if missing_common
        else [],
        is_llm_powered=False,
        is_cached=False,
        model_used="offline-deterministic",
    )
