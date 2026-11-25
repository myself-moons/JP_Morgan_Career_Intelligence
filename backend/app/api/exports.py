from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.export_service import (
    export_coverage_data,
    export_jobs_data,
    export_learning_data,
    export_matrix_data,
)

router = APIRouter(prefix="/exports", tags=["CSV & Excel Exports (M7)"])


@router.get("/jobs", summary="Export filtered job listings to CSV or Excel (FR-26)")
def export_jobs(
    format: str = Query("csv", description="Export format: csv or xlsx"),
    role_family: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    content, media_type, ext = export_jobs_data(
        db, fmt=format, role_family=role_family, status=status, search=search
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
):
    content, media_type, ext = export_matrix_data(db, fmt=format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="jci_cross_role_matrix.{ext}"'},
    )


@router.get("/learning", summary="Export learning tracker & progress to CSV or Excel (FR-26)")
def export_learning(
    format: str = Query("csv", description="Export format: csv or xlsx"),
    db: Session = Depends(get_db),
):
    content, media_type, ext = export_learning_data(db, fmt=format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="jci_learning_tracker.{ext}"'},
    )
