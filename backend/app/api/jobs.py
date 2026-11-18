from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.models.entities import Company, JobListing
from app.models.schemas import (
    JobCreate,
    JobUpdate,
    JobOut,
    JobListResponse,
    UploadResponse,
)
from app.services.document_parser import parse_document

router = APIRouter(prefix="/jobs", tags=["Job Ingestion & Library"])


def get_or_create_company(db: Session, company_name: str) -> Company:
    name = company_name.strip()
    company = db.query(Company).filter(func.lower(Company.name) == name.lower()).first()
    if not company:
        company = Company(name=name)
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


def build_job_out(job: JobListing) -> JobOut:
    return JobOut(
        id=job.id,
        company_id=job.company_id,
        company_name=job.company.name if job.company else "Unknown",
        title=job.title,
        external_job_id=job.external_job_id,
        location=job.location,
        source_url=job.source_url,
        capture_date=job.capture_date,
        role_family=job.role_family,
        status=job.status,
        original_description=job.original_description,
        cleaned_description=job.cleaned_description,
        context_note=job.context_note,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED, summary="Create a new job listing")
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    """Ingest a new job listing via paste or manual entry (FR-01, BR-01)."""
    # BR-01 validation: Description required unless status is 'JD unavailable'
    is_unavailable = payload.status.strip().lower() == "jd unavailable"
    desc = (payload.original_description or "").strip()
    if not is_unavailable and not desc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description text is required unless listing status is 'JD unavailable'.",
        )

    company = get_or_create_company(db, payload.company_name)

    # TC-06: Duplicate external_job_id check
    if payload.external_job_id:
        existing = (
            db.query(JobListing)
            .filter(
                JobListing.company_id == company.id,
                JobListing.external_job_id == payload.external_job_id.strip(),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Job with external requisition ID '{payload.external_job_id}' already exists for {company.name} (Job ID {existing.id}: '{existing.title}').",
            )

    job = JobListing(
        company_id=company.id,
        title=payload.title.strip(),
        external_job_id=payload.external_job_id.strip() if payload.external_job_id else None,
        location=payload.location.strip(),
        source_url=payload.source_url.strip() if payload.source_url else None,
        capture_date=payload.capture_date.strip(),
        role_family=payload.role_family.strip(),
        status=payload.status.strip(),
        original_description=desc if desc else None,
        context_note=payload.context_note.strip() if payload.context_note else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return build_job_out(job)


@router.post("/upload", response_model=UploadResponse, summary="Extract text from uploaded PDF/DOCX")
async def upload_job_document(file: UploadFile = File(...)):
    """Extract and preview text from uploaded PDF or DOCX file (FR-02, TC-02..TC-05)."""
    try:
        content = await file.read()
        extracted_text, char_count, line_count = parse_document(file.filename, content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing uploaded document: {str(e)}",
        )

    return UploadResponse(
        filename=file.filename,
        extracted_text=extracted_text,
        preview=extracted_text[:600] + ("..." if len(extracted_text) > 600 else ""),
        char_count=char_count,
        line_count=line_count,
    )


@router.get("", response_model=JobListResponse, summary="Retrieve all job listings with filters")
def get_jobs(
    role_family: Optional[str] = Query(None, description="Filter by role family (Family A, Family B, Family C)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by listing status"),
    location: Optional[str] = Query(None, description="Filter by location"),
    search: Optional[str] = Query(None, description="Free text search in title or description"),
    db: Session = Depends(get_db),
):
    """Retrieve job listings with counts, denominators, and multi-dimensional filters (FR-04)."""
    query = db.query(JobListing)

    if role_family:
        query = query.filter(JobListing.role_family.ilike(f"%{role_family.strip()}%"))

    if status_filter:
        query = query.filter(JobListing.status.ilike(status_filter.strip()))

    if location:
        query = query.filter(JobListing.location.ilike(f"%{location.strip()}%"))

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                JobListing.title.ilike(s),
                JobListing.original_description.ilike(s),
                JobListing.external_job_id.ilike(s),
            )
        )

    jobs = query.order_by(JobListing.id.asc()).all()

    # Aggregate total and analysable counts across full collection
    all_jobs = db.query(JobListing).all()
    total_count = len(all_jobs)
    analysable_count = sum(1 for j in all_jobs if j.status.lower() == "available")

    family_counts: Dict[str, int] = {}
    status_counts: Dict[str, int] = {}
    for j in all_jobs:
        family_counts[j.role_family] = family_counts.get(j.role_family, 0) + 1
        status_counts[j.status] = status_counts.get(j.status, 0) + 1

    return JobListResponse(
        jobs=[build_job_out(j) for j in jobs],
        total_count=total_count,
        analysable_count=analysable_count,
        role_family_counts=family_counts,
        status_counts=status_counts,
    )


@router.get("/{job_id}", response_model=JobOut, summary="Get single job details")
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Retrieve a single job record including immutable original description (FR-03)."""
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job record with ID {job_id} not found.",
        )
    return build_job_out(job)


@router.put("/{job_id}", response_model=JobOut, summary="Update job metadata or description")
def update_job(job_id: int, payload: JobUpdate, db: Session = Depends(get_db)):
    """Update job metadata and description with last-modified timestamp tracking (FR-05)."""
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job record with ID {job_id} not found.",
        )

    if payload.title is not None:
        job.title = payload.title.strip()
    if payload.location is not None:
        job.location = payload.location.strip()
    if payload.source_url is not None:
        job.source_url = payload.source_url.strip() if payload.source_url else None
    if payload.capture_date is not None:
        job.capture_date = payload.capture_date.strip()
    if payload.role_family is not None:
        job.role_family = payload.role_family.strip()
    if payload.status is not None:
        job.status = payload.status.strip()
    if payload.original_description is not None:
        job.original_description = payload.original_description
    if payload.context_note is not None:
        job.context_note = payload.context_note

    db.commit()
    db.refresh(job)
    return build_job_out(job)


@router.delete("/{job_id}", summary="Delete job listing")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    """Delete a job record and cascade dependent requirements (FR-06)."""
    job = db.query(JobListing).filter(JobListing.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job record with ID {job_id} not found.",
        )
    deleted_title = job.title
    db.delete(job)
    db.commit()
    return {"status": "deleted", "id": job_id, "title": deleted_title}


@router.post("/seed", summary="Seed 11 baseline JPMorgan Chase jobs")
def seed_jobs(db: Session = Depends(get_db)):
    """Seed the 11 JPMorgan Chase research jobs into SQLite database."""
    from app.core.seed import seed_baseline_jobs
    count = seed_baseline_jobs(db)
    return {"status": "success", "seeded_count": count}
