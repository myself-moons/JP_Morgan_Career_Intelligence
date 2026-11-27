from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Skill, SkillAlias, JobSkill, JobListing
from app.models.schemas import (
    SkillOut,
    SkillCreate,
    AddAliasRequest,
    JobSkillOut,
    JobSkillUpdate,
    JobSkillCreate,
    DisambiguateRequest,
    DisambiguateResponse,
    SkillSuggestOut,
    SkillResolveRequest,
    SkillResolveResponse,
)
from app.services.taxonomy_service import (
    seed_taxonomy_if_empty,
    extract_and_save_job_skills,
    batch_extract_all_jobs,
    ai_disambiguate_skill,
    suggest_canonical_skills,
    resolve_or_create_canonical_skill,
)

router = APIRouter(prefix="/taxonomy", tags=["Taxonomy & Skill Review"])


@router.get("/suggest", response_model=List[SkillSuggestOut], summary="Typeahead autocomplete across canonical skills & aliases (v3.0)")
def suggest_skills(
    q: str = Query("", description="Prefix or substring typed by user"),
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return suggest_canonical_skills(db, query=q, limit=limit)


@router.post("/resolve-or-create", response_model=SkillResolveResponse, summary="Resolve alternate wording or register a new short canonical skill (v3.0)")
def resolve_or_create_skill(payload: SkillResolveRequest, db: Session = Depends(get_db)):
    try:
        skill, created_new, matched_via = resolve_or_create_canonical_skill(
            raw_name=payload.raw_name,
            db=db,
            category=payload.category,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return SkillResolveResponse(
        id=skill.id,
        canonical_name=skill.canonical_name,
        category=skill.category,
        created_new=created_new,
        matched_via=matched_via,
    )


@router.get("/skills", response_model=List[SkillOut], summary="List all canonical skills and aliases")
def list_skills(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search canonical name or alias"),
    db: Session = Depends(get_db),
):
    seed_taxonomy_if_empty(db)
    query = db.query(Skill)

    if category and category != "All":
        query = query.filter(Skill.category == category)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(Skill.canonical_name.ilike(search_term))

    skills = query.order_by(Skill.canonical_name).all()

    # Pre-fetch job counts
    results: List[SkillOut] = []
    for s in skills:
        job_count = (
            db.query(JobSkill.job_id)
            .filter(JobSkill.skill_id == s.id)
            .filter(JobSkill.review_status != "Rejected")
            .distinct()
            .count()
        )
        aliases = [a.alias_text for a in s.aliases]
        results.append(
            SkillOut(
                id=s.id,
                canonical_name=s.canonical_name,
                category=s.category,
                description=s.description,
                aliases=aliases,
                job_count=job_count,
            )
        )
    return results


@router.post("/skills", response_model=SkillOut, status_code=status.HTTP_201_CREATED, summary="Add new canonical skill")
def create_skill(payload: SkillCreate, db: Session = Depends(get_db)):
    seed_taxonomy_if_empty(db)
    norm_name = payload.canonical_name.strip()
    existing = db.query(Skill).filter(Skill.canonical_name.ilike(norm_name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Canonical skill '{norm_name}' already exists with ID {existing.id}."
        )

    new_skill = Skill(
        canonical_name=norm_name,
        category=payload.category,
        description=payload.description,
    )
    db.add(new_skill)
    db.flush()

    # Add initial aliases
    added_aliases: List[str] = []
    for a in payload.aliases:
        alias_norm = a.strip().lower()
        if alias_norm and not db.query(SkillAlias).filter(SkillAlias.alias_text == alias_norm).first():
            db.add(SkillAlias(skill_id=new_skill.id, alias_text=alias_norm))
            added_aliases.append(alias_norm)

    db.commit()
    db.refresh(new_skill)

    return SkillOut(
        id=new_skill.id,
        canonical_name=new_skill.canonical_name,
        category=new_skill.category,
        description=new_skill.description,
        aliases=added_aliases,
        job_count=0,
    )


@router.post("/skills/{skill_id}/aliases", summary="Add alias to canonical skill")
def add_alias(skill_id: int, payload: AddAliasRequest, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Canonical skill not found.")

    alias_norm = payload.alias_text.strip().lower()
    if not alias_norm:
        raise HTTPException(status_code=400, detail="Alias text cannot be empty.")

    existing = db.query(SkillAlias).filter(SkillAlias.alias_text == alias_norm).first()
    if existing:
        if existing.skill_id == skill_id:
            return {"message": f"Alias '{alias_norm}' already linked to '{skill.canonical_name}'."}
        raise HTTPException(
            status_code=400,
            detail=f"Alias '{alias_norm}' is already mapped to skill ID {existing.skill_id} ({existing.skill.canonical_name})."
        )

    db.add(SkillAlias(skill_id=skill.id, alias_text=alias_norm))
    db.commit()
    return {"message": f"Alias '{alias_norm}' successfully mapped to canonical skill '{skill.canonical_name}'."}


@router.post("/ai-disambiguate", response_model=DisambiguateResponse, summary="AI-assisted semantic taxonomy disambiguation (FR-42, TC-22)")
def disambiguate_phrase(payload: DisambiguateRequest, db: Session = Depends(get_db)):
    if not payload.phrase or not payload.phrase.strip():
        raise HTTPException(status_code=400, detail="Phrase is required for disambiguation.")
    result = ai_disambiguate_skill(payload.phrase, payload.context, db)
    return DisambiguateResponse(**result)


# --- Job Skill Review Endpoints (FR-14) ---

@router.get("/jobs/{job_id}/skills", response_model=List[JobSkillOut], summary="List extracted skills for a job")
def get_job_skills(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")

    records = (
        db.query(JobSkill)
        .filter(JobSkill.job_id == job_id)
        .order_by(JobSkill.requirement_type, JobSkill.id)
        .all()
    )

    out: List[JobSkillOut] = []
    for r in records:
        out.append(
            JobSkillOut(
                id=r.id,
                job_id=r.job_id,
                skill_id=r.skill_id,
                canonical_name=r.skill.canonical_name,
                category=r.skill.category,
                matched_alias=r.matched_alias,
                requirement_type=r.requirement_type,
                extraction_method=r.extraction_method,
                review_status=r.review_status,
                evidence_snippet=r.evidence_snippet,
                confidence=r.confidence,
            )
        )
    return out


@router.post("/jobs/{job_id}/extract-skills", response_model=List[JobSkillOut], summary="Run skill extraction on a job")
def extract_job_skills(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")

    saved = extract_and_save_job_skills(job, db)
    out: List[JobSkillOut] = []
    for r in saved:
        out.append(
            JobSkillOut(
                id=r.id,
                job_id=r.job_id,
                skill_id=r.skill_id,
                canonical_name=r.skill.canonical_name,
                category=r.skill.category,
                matched_alias=r.matched_alias,
                requirement_type=r.requirement_type,
                extraction_method=r.extraction_method,
                review_status=r.review_status,
                evidence_snippet=r.evidence_snippet,
                confidence=r.confidence,
            )
        )
    return out


@router.post("/jobs/batch-extract-skills", summary="Run extraction across all jobs in library")
def batch_extract(db: Session = Depends(get_db)):
    return batch_extract_all_jobs(db)


@router.put("/jobs/{job_id}/skills/{job_skill_id}", response_model=JobSkillOut, summary="Human review and edit for extracted skill (FR-14, TC-13)")
def update_job_skill(
    job_id: int,
    job_skill_id: int,
    payload: JobSkillUpdate,
    db: Session = Depends(get_db),
):
    record = (
        db.query(JobSkill)
        .filter(JobSkill.id == job_skill_id, JobSkill.job_id == job_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Extracted skill record not found.")

    if payload.requirement_type:
        record.requirement_type = payload.requirement_type
    if payload.review_status:
        record.review_status = payload.review_status
    if payload.evidence_snippet is not None:
        record.evidence_snippet = payload.evidence_snippet
    if payload.skill_id:
        target_skill = db.query(Skill).filter(Skill.id == payload.skill_id).first()
        if not target_skill:
            raise HTTPException(status_code=400, detail="Target canonical skill not found.")
        record.skill_id = payload.skill_id
        record.review_status = "Edited"

    db.commit()
    db.refresh(record)

    return JobSkillOut(
        id=record.id,
        job_id=record.job_id,
        skill_id=record.skill_id,
        canonical_name=record.skill.canonical_name,
        category=record.skill.category,
        matched_alias=record.matched_alias,
        requirement_type=record.requirement_type,
        extraction_method=record.extraction_method,
        review_status=record.review_status,
        evidence_snippet=record.evidence_snippet,
        confidence=record.confidence,
    )


@router.post("/jobs/{job_id}/skills", response_model=JobSkillOut, status_code=status.HTTP_201_CREATED, summary="Manually add skill to a job")
def add_manual_job_skill(
    job_id: int,
    payload: JobSkillCreate,
    db: Session = Depends(get_db),
):
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")
    skill = db.query(Skill).filter(Skill.id == payload.skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Canonical skill not found.")

    existing = db.query(JobSkill).filter(JobSkill.job_id == job_id, JobSkill.skill_id == skill.id).first()
    if existing:
        existing.requirement_type = payload.requirement_type
        existing.review_status = "Accepted"
        if payload.evidence_snippet:
            existing.evidence_snippet = payload.evidence_snippet
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        new_record = JobSkill(
            job_id=job_id,
            skill_id=skill.id,
            matched_alias=skill.canonical_name,
            requirement_type=payload.requirement_type,
            extraction_method="manual",
            review_status="Accepted",
            evidence_snippet=payload.evidence_snippet or f"Manually verified for {job.title}",
            confidence=100,
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        target = new_record

    return JobSkillOut(
        id=target.id,
        job_id=target.job_id,
        skill_id=target.skill_id,
        canonical_name=target.skill.canonical_name,
        category=target.skill.category,
        matched_alias=target.matched_alias,
        requirement_type=target.requirement_type,
        extraction_method=target.extraction_method,
        review_status=target.review_status,
        evidence_snippet=target.evidence_snippet,
        confidence=target.confidence,
    )
