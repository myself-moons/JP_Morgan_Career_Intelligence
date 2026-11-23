from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import (
    CoverageResponse,
    CrossRoleMatrixResponse,
    SkillEvidenceResponse,
)
from app.services.analytics_service import (
    compute_skill_coverage,
    compute_cross_role_matrix,
    get_skill_evidence,
)

router = APIRouter(prefix="/analytics", tags=["Comparative Analytics & Matrix"])


@router.get("/coverage", response_model=CoverageResponse, summary="Get skill coverage across active jobs (FR-15, BR-06, TC-11, TC-12)")
def get_coverage(
    role_family: Optional[str] = Query(None, description="Filter by role family (Family A, Family B, Family C)"),
    category: Optional[str] = Query(None, description="Filter by skill category"),
    search: Optional[str] = Query(None, description="Search canonical skill name"),
    db: Session = Depends(get_db),
):
    return compute_skill_coverage(db, role_family=role_family, category=category, search=search)


@router.get("/matrix", response_model=CrossRoleMatrixResponse, summary="Get cross-role skill comparison matrix (FR-16)")
def get_matrix(db: Session = Depends(get_db)):
    return compute_cross_role_matrix(db)


@router.get("/skills/{skill_id}/evidence", response_model=SkillEvidenceResponse, summary="Get verbatim evidence snippets across jobs for a skill (FR-15)")
def get_evidence(
    skill_id: int,
    status: Optional[str] = Query("Available", description="Filter by job status (default 'Available')"),
    db: Session = Depends(get_db),
):
    return get_skill_evidence(skill_id, db, status_filter=status)
