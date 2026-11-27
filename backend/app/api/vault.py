from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.entities import User
from app.models.schemas import (
    DashboardSummaryResponse,
    ExperienceEntryCreate,
    ExperienceEntryOut,
    ExperienceEntryUpdate,
    VaultCompareRequest,
    VaultCompareResponse,
)
from app.services.vault_service import (
    build_dashboard_summary,
    compare_vault_with_jobs_ai,
    create_experience_entry,
    delete_experience_entry,
    list_experience_entries,
    update_experience_entry,
)

router = APIRouter(prefix="/vault", tags=["Experience Vault & Mini-RAG (v3.0)"])


@router.get("/dashboard-summary", response_model=DashboardSummaryResponse, summary="Minimalist Dashboard with 3-tier fallback (Vault -> Resume -> Empty Prompt)")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_dashboard_summary(db, user_id=current_user.id)


@router.get("/entries", response_model=List[ExperienceEntryOut], summary="List user's Experience Vault entries")
def get_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_experience_entries(db, user_id=current_user.id)


@router.post("/entries", response_model=ExperienceEntryOut, status_code=status.HTTP_201_CREATED, summary="Add Experience Vault entry with global skill tag resolution")
def add_entry(
    payload: ExperienceEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_experience_entry(db, user_id=current_user.id, payload=payload)


@router.put("/entries/{entry_id}", response_model=ExperienceEntryOut, summary="Update an Experience Vault entry")
def edit_entry(
    entry_id: int,
    payload: ExperienceEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = update_experience_entry(db, user_id=current_user.id, entry_id=entry_id, payload=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Experience entry not found")
    return updated


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an Experience Vault entry")
def remove_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = delete_experience_entry(db, user_id=current_user.id, entry_id=entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Experience entry not found")


@router.post("/compare-ai", response_model=VaultCompareResponse, summary="Explicit user-triggered Mini-RAG comparison (Compare with AI / Refresh AI)")
def compare_with_ai(
    payload: VaultCompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return compare_vault_with_jobs_ai(
            db=db,
            user_id=current_user.id,
            job_ids=payload.job_ids,
            model_mode=payload.model_mode,
            force_refresh=payload.force_refresh,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
