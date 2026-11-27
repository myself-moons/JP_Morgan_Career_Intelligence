from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.entities import User
from app.models.schemas import SkillExplorerResponse
from app.services.explorer_service import compare_selected_jobs_skills

router = APIRouter(prefix="/explorer", tags=["Skill Explorer (v3.0)"])


@router.get("/compare", response_model=SkillExplorerResponse, summary="Compare Common Core vs Role-Specific skills across chosen jobs")
def explore_skills(
    job_ids: Optional[str] = Query(None, description="Comma-separated job IDs to compare"),
    role_family: Optional[str] = Query(None, description="Optional Role Family filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    parsed_ids: Optional[List[int]] = None
    if job_ids and job_ids.strip():
        parsed_ids = [int(x.strip()) for x in job_ids.split(",") if x.strip().isdigit()]

    return compare_selected_jobs_skills(
        db=db,
        user_id=current_user.id,
        job_ids=parsed_ids,
        role_family=role_family,
    )
