from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.entities import User
from app.services.export_service import (
    export_coverage_data,
    export_jobs_data,
    export_matrix_data,
    export_roadmap_data,
)

router = APIRouter(prefix="/exports", tags=["CSV & Excel Exports"])


@router.get("/jobs", summary="Export filtered job listings to CSV or Excel (FR-26)")
def export_jobs(
    format: str = Query("csv", description="Export format: csv or xlsx"),
    role_family: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content, media_type, ext = export_jobs_data(
        db,
        fmt=format,
        role_family=role_family,
        status=status,
        search=search,
        user_id=current_user.id,
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="jci_jobs_export.{ext}"'},
    )


@router.get("/coverage", summary="Export filtered skill coverage table to CSV or Excel (FR-26, TC-18)")
def export_coverage(
    format: str = Query("csv", description="Export format: csv or xlsx"),
    role_family: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content, media_type, ext = export_coverage_data(
        db, fmt=format, role_family=role_family, category=category, search=search
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="jci_skill_coverage.{ext}"'},
    )


@router.get("/matrix", summary="Export cross-role skill matrix to CSV or Excel (FR-26)")
def export_matrix(
    format: str = Query("csv", description="Export format: csv or xlsx"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content, media_type, ext = export_matrix_data(db, fmt=format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="jci_cross_role_matrix.{ext}"'},
    )


@router.get("/roadmap", summary="Export user's My Roadmap & saved resources to CSV or Excel")
@router.get("/learning", summary="Export user's My Roadmap & saved resources to CSV or Excel (alias)")
def export_roadmap(
    format: str = Query("csv", description="Export format: csv or xlsx"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content, media_type, ext = export_roadmap_data(db, user_id=current_user.id, fmt=format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="jci_my_roadmap.{ext}"'},
    )
