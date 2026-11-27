from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import LearningResource, User
from app.models.schemas import (
    LearningProgressResponse,
    LearningProgressUpdate,
    LearningRecommendationsResponse,
    LearningResourceCreate,
    LearningResourceOut,
)
from app.services.learning_service import (
    create_learning_resource,
    get_gap_recommendations,
    list_learning_resources,
    update_learning_progress,
)

router = APIRouter(prefix="/learning", tags=["Learning Intelligence & Gap Tracker (M6)"])


def _require_legacy_local_access(current_user: User = Depends(get_current_user)) -> User:
    """Blocks shared un-isolated legacy v2 endpoints for multi-user Google sessions."""
    if settings.AUTH_REQUIRED and not current_user.is_local_dev:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Legacy v2 learning endpoint is disabled in multi-user mode. Use My Roadmap instead.",
        )
    return current_user


@router.get("/resources", response_model=List[LearningResourceOut], summary="List learning resources and study progress (FR-22, FR-24)")
def get_resources(
    cost_status: Optional[str] = Query(None, description="Filter by cost status: Free, Paid, Freemium, Unknown"),
    progress_status: Optional[str] = Query(None, description="Filter by progress: Not started, In progress, Completed, Paused"),
    skill: Optional[str] = Query(None, description="Filter by canonical skill addressed"),
    search: Optional[str] = Query(None, description="Search title, provider, or skill"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_legacy_local_access),
):
    return list_learning_resources(
        db,
        cost_status=cost_status,
        progress_status=progress_status,
        skill=skill,
        search=search,
    )


@router.post("/resources", response_model=LearningResourceOut, status_code=status.HTTP_201_CREATED, summary="Add a learning resource to the catalogue (FR-22, BR-11)")
def add_resource(
    payload: LearningResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_legacy_local_access),
):
    return create_learning_resource(db, payload)


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a custom learning resource")
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_legacy_local_access),
):
    res = db.query(LearningResource).filter(LearningResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Learning resource not found")
    db.delete(res)
    db.commit()


@router.put("/resources/{resource_id}/progress", response_model=LearningProgressResponse, summary="Update study progress without auto-upgrading skill evidence (FR-24, BR-09, TC-14)")
def set_progress(
    resource_id: int,
    payload: LearningProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_legacy_local_access),
):
    result = update_learning_progress(db, resource_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Learning resource not found")
    return result


@router.get("/recommendations", response_model=LearningRecommendationsResponse, summary="Get gap-driven learning recommendations (FR-23, BR-10)")
def get_recommendations(
    job_id: Optional[int] = Query(None, description="Optional target job ID to prioritize gaps"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_legacy_local_access),
):
    return get_gap_recommendations(db, job_id=job_id)
