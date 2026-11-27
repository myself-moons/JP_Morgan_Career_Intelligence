from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.entities import User
from app.models.schemas import (
    CoverageResponse,
    CrossRoleMatrixResponse,
    DashboardSummaryResponse,
    SkillEvidenceResponse,
)
from app.services.analytics_service import (
    compute_cross_role_matrix,
    compute_skill_coverage,
    get_skill_evidence,
)
from app.services.vault_service import build_dashboard_summary

router = APIRouter(prefix="/analytics", tags=["Comparative Analytics & Dashboard"])


@router.get("/dashboard", response_model=DashboardSummaryResponse, summary="Minimalist Dashboard with 3-tier fallback (Vault -> Resume -> Empty Prompt)")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_dashboard_summary(db, user_id=current_user.id)


@router.get("/coverage", response_model=CoverageResponse, summary="Get skill coverage across active jobs")
def get_coverage(
    role_family: Optional[str] = Query(None, description="Filter by role family (Family A, Family B, Family C)"),
    category: Optional[str] = Query(None, description="Filter by skill category"),
    search: Optional[str] = Query(None, description="Search canonical skill name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_skill_coverage(db, role_family=role_family, category=category, search=search)


@router.get("/matrix", response_model=CrossRoleMatrixResponse, summary="Get cross-role skill comparison matrix")
def get_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_cross_role_matrix(db)


@router.get("/skills/{skill_id}/evidence", response_model=SkillEvidenceResponse, summary="Get verbatim evidence snippets across jobs for a skill")
def get_evidence(
    skill_id: int,
    status: Optional[str] = Query("Available", description="Filter by job status (default 'Available')"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_skill_evidence(skill_id, db, status_filter=status)
