from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.entities import User
from app.models.schemas import (
    RoadmapItemCreate,
    RoadmapItemOut,
    RoadmapItemUpdate,
    RoadmapReviewRequest,
    RoadmapReviewResponse,
    SavedResourceCreate,
    SavedResourceOut,
)
from app.services.roadmap_service import (
    create_roadmap_item,
    create_saved_resource,
    delete_roadmap_item,
    delete_saved_resource,
    list_roadmap,
    list_saved_resources,
    review_roadmap_with_ai,
    update_roadmap_item,
)

router = APIRouter(prefix="/roadmap", tags=["My Roadmap & Saved Resources (v3.0)"])


@router.get("/items", response_model=List[RoadmapItemOut], summary="List user's roadmap goals and attached resources")
def get_roadmap_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_roadmap(db, user_id=current_user.id)


@router.post("/items", response_model=RoadmapItemOut, status_code=status.HTTP_201_CREATED, summary="Add a short canonical skill goal to My Roadmap")
def add_roadmap_item(
    payload: RoadmapItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_roadmap_item(db, user_id=current_user.id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/items/{item_id}", response_model=RoadmapItemOut, summary="Update a roadmap item")
def edit_roadmap_item(
    item_id: int,
    payload: RoadmapItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = update_roadmap_item(db, user_id=current_user.id, item_id=item_id, payload=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    return updated


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a roadmap item")
def remove_roadmap_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not delete_roadmap_item(db, user_id=current_user.id, item_id=item_id):
        raise HTTPException(status_code=404, detail="Roadmap item not found")


@router.get("/resources", response_model=List[SavedResourceOut], summary="List user's saved course/certification links")
def get_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_saved_resources(db, user_id=current_user.id)


@router.post("/resources", response_model=SavedResourceOut, status_code=status.HTTP_201_CREATED, summary="Save a URL, certification, or resource note")
def add_resource(
    payload: SavedResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_saved_resource(db, user_id=current_user.id, payload=payload)


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a saved resource")
def remove_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not delete_saved_resource(db, user_id=current_user.id, resource_id=resource_id):
        raise HTTPException(status_code=404, detail="Saved resource not found")


@router.post("/review-ai", response_model=RoadmapReviewResponse, summary="Explicit AI roadmap check (Review with AI)")
def review_with_ai(
    payload: RoadmapReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return review_roadmap_with_ai(
        db=db,
        user_id=current_user.id,
        job_ids=payload.job_ids,
        model_mode=payload.model_mode,
        force_refresh=payload.force_refresh,
    )
