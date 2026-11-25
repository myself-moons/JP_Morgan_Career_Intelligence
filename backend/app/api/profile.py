from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import ProfileEvidence
from app.models.schemas import (
    ProfileEvidenceCreate,
    ProfileEvidenceOut,
    ProfileEvidenceUpdate,
    ProfileJobMatchResponse,
    ProfileOverviewResponse,
    UserProfileOut,
    UserProfileUpdate,
)
from app.services.profile_service import (
    evaluate_profile_vs_job,
    get_profile_overview,
    update_user_profile,
    upsert_profile_evidence,
    _to_evidence_out,
)

router = APIRouter(prefix="/profile", tags=["Profile Evidence & Matching (M5)"])


@router.get("", response_model=ProfileOverviewResponse, summary="Get user profile and CardLyze-attributed skill evidence")
def get_profile(db: Session = Depends(get_db)):
    return get_profile_overview(db)


@router.put("", response_model=UserProfileOut, summary="Update user profile summary, education, and experience")
def update_profile(payload: UserProfileUpdate, db: Session = Depends(get_db)):
    return update_user_profile(db, payload)


@router.post("/evidence", response_model=ProfileEvidenceOut, status_code=status.HTTP_201_CREATED, summary="Create or update skill evidence & contribution split (FR-18, FR-19)")
def create_or_update_evidence(payload: ProfileEvidenceCreate, db: Session = Depends(get_db)):
    return upsert_profile_evidence(
        db=db,
        skill_id=payload.skill_id,
        evidence_status=payload.evidence_status,
        contribution_type=payload.contribution_type,
        source_project=payload.source_project,
        evidence_description=payload.evidence_description,
        recorded_date=payload.recorded_date,
    )


@router.put("/evidence/{evidence_id}", response_model=ProfileEvidenceOut, summary="Update an existing skill evidence entry")
def update_evidence(evidence_id: int, payload: ProfileEvidenceUpdate, db: Session = Depends(get_db)):
    ev = db.query(ProfileEvidence).filter(ProfileEvidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Profile evidence entry not found")
    return upsert_profile_evidence(
        db=db,
        skill_id=ev.skill_id,
        evidence_status=payload.evidence_status or ev.evidence_status,
        contribution_type=payload.contribution_type or ev.contribution_type,
        source_project=payload.source_project if payload.source_project is not None else ev.source_project,
        evidence_description=payload.evidence_description if payload.evidence_description is not None else ev.evidence_description,
        recorded_date=payload.recorded_date or ev.recorded_date,
    )


@router.delete("/evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a profile evidence record")
def delete_evidence(evidence_id: int, db: Session = Depends(get_db)):
    ev = db.query(ProfileEvidence).filter(ProfileEvidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Profile evidence entry not found")
    db.delete(ev)
    db.commit()


@router.get("/match-job/{job_id}", response_model=ProfileJobMatchResponse, summary="Deterministic multi-dimensional profile & resume audit vs JD (FR-20, FR-21, FR-38 to FR-40)")
def match_profile_to_job(
    job_id: int,
    resume_id: Optional[int] = Query(None, description="Optional resume ID (defaults to active resume)"),
    db: Session = Depends(get_db),
):
    result = evaluate_profile_vs_job(db, job_id=job_id, resume_id=resume_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job listing not found")
    return result
