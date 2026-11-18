import re
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
    ParsedFields,
    ParseTextRequest,
    NextCodeResponse,
)
from app.services.document_parser import parse_document
from app.services.jd_parser import extract_job_metadata, parse_job_sections

router = APIRouter(prefix="/jobs", tags=["Job Ingestion & Library"])


def compute_next_job_code(db: Session) -> str:
    """Finds all existing JB-N requisition codes and returns next sequential code, e.g. JB-1, JB-2."""
    all_codes = db.query(JobListing.external_job_id).filter(JobListing.external_job_id.isnot(None)).all()
    jb_nums = []
    for (code,) in all_codes:
        if code:
            m = re.match(r"^JB-(\d+)$", code.strip(), re.IGNORECASE)
            if m:
                jb_nums.append(int(m.group(1)))
    next_num = max(jb_nums) + 1 if jb_nums else 1
    return f"JB-{next_num}"


def get_or_create_company(db: Session, company_name: str) -> Company:
    name = (company_name or "JPMorgan Chase").strip()
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
        summary=getattr(job, "summary", None),
        responsibilities=getattr(job, "responsibilities", None),
        qualifications=getattr(job, "qualifications", None),
        preferred_qualifications=getattr(job, "preferred_qualifications", None),
        context_note=job.context_note,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/next-code", response_model=NextCodeResponse, summary="Get auto-incremented numerical requisition code")
def get_next_job_code(db: Session = Depends(get_db)):
    """Generates the next sequential numerical job code (e.g. JB-1, JB-2)."""
    next_code = compute_next_job_code(db)
    return NextCodeResponse(next_code=next_code)


@router.post("/parse-text", response_model=ParsedFields, summary="Extract structured fields from raw text")
def parse_raw_text(payload: ParseTextRequest, db: Session = Depends(get_db)):
    """Extracts job title, company, location, role family, and structured sections from text."""
    parsed = extract_job_metadata(payload.text, payload.filename)
    suggested_code = compute_next_job_code(db)
    return ParsedFields(
        title=parsed["title"],
        company_name=parsed["company_name"],
        location=parsed["location"],
        role_family=parsed["role_family"],
        status=parsed["status"],
        extracted_req_id=parsed["extracted_req_id"] or suggested_code,
        summary=parsed["summary"],
        responsibilities=parsed["responsibilities"],
        qualifications=parsed["qualifications"],
        preferred_qualifications=parsed["preferred_qualifications"],
        warnings=parsed["warnings"],
    )


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED, summary="Create a new job listing")
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    """Ingest a new job listing with structured sections and auto-code assignment (FR-01, BR-01)."""
    # BR-01 validation: Description required unless status is 'JD unavailable'
    is_unavailable = payload.status.strip().lower() == "jd unavailable"
    desc = (payload.original_description or "").strip()

    # If original_description was not supplied but sections were, assemble a readable description
    if not desc and (payload.responsibilities or payload.qualifications):
        parts = []
        if payload.summary:
            parts.append(payload.summary.strip())
        if payload.responsibilities:
            parts.append("### Job Responsibilities\n" + payload.responsibilities.strip())
        if payload.qualifications:
            parts.append("### Required Qualifications\n" + payload.qualifications.strip())
        if payload.preferred_qualifications:
            parts.append("### Preferred Qualifications\n" + payload.preferred_qualifications.strip())
        desc = "\n\n".join(parts)

    if not is_unavailable and not desc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description text is required unless listing status is 'JD unavailable'.",
        )

    company = get_or_create_company(db, payload.company_name)

    # Auto-generate requisition ID if not provided
    req_id = payload.external_job_id.strip() if payload.external_job_id else compute_next_job_code(db)

    # TC-06: Duplicate external_job_id check
    if req_id:
        existing = (
            db.query(JobListing)
            .filter(
                JobListing.company_id == company.id,
                JobListing.external_job_id == req_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Job with external requisition ID '{req_id}' already exists for {company.name} (Job ID {existing.id}: '{existing.title}').",
            )

    # Auto-extract sections if not provided explicitly
    summary = payload.summary
    responsibilities = payload.responsibilities
    qualifications = payload.qualifications
    preferred_qualifications = payload.preferred_qualifications

    if desc and not (responsibilities or qualifications):
        parsed_secs = parse_job_sections(desc)
        summary = summary or parsed_secs.get("summary")
        responsibilities = responsibilities or parsed_secs.get("responsibilities")
        qualifications = qualifications or parsed_secs.get("qualifications")
        preferred_qualifications = preferred_qualifications or parsed_secs.get("preferred_qualifications")

    job = JobListing(
        company_id=company.id,
        title=payload.title.strip(),
        external_job_id=req_id,
        location=payload.location.strip(),
        source_url=payload.source_url.strip() if payload.source_url else None,
        capture_date=payload.capture_date.strip(),
        role_family=payload.role_family.strip(),
        status=payload.status.strip(),
        original_description=desc if desc else None,
        summary=summary.strip() if summary else None,
        responsibilities=responsibilities.strip() if responsibilities else None,
        qualifications=qualifications.strip() if qualifications else None,
        preferred_qualifications=preferred_qualifications.strip() if preferred_qualifications else None,
        context_note=payload.context_note.strip() if payload.context_note else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return build_job_out(job)


@router.post("/upload", response_model=UploadResponse, summary="Extract text and auto-populate fields from uploaded PDF/DOCX")
async def upload_job_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Extract, parse sections, and auto-populate metadata from uploaded document (FR-02, TC-02..TC-05)."""
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

    parsed = extract_job_metadata(extracted_text, file.filename)
    suggested_code = compute_next_job_code(db)

    parsed_fields = ParsedFields(
        title=parsed["title"],
        company_name=parsed["company_name"],
        location=parsed["location"],
        role_family=parsed["role_family"],
        status=parsed["status"],
        extracted_req_id=parsed["extracted_req_id"] or suggested_code,
        summary=parsed["summary"],
        responsibilities=parsed["responsibilities"],
        qualifications=parsed["qualifications"],
        preferred_qualifications=parsed["preferred_qualifications"],
        warnings=parsed["warnings"],
    )

    return UploadResponse(
        filename=file.filename,
        extracted_text=extracted_text,
        preview=extracted_text[:600] + ("..." if len(extracted_text) > 600 else ""),
        char_count=char_count,
        line_count=line_count,
        parsed_fields=parsed_fields,
        suggested_code=suggested_code,
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
    if payload.summary is not None:
        job.summary = payload.summary
    if payload.responsibilities is not None:
        job.responsibilities = payload.responsibilities
    if payload.qualifications is not None:
        job.qualifications = payload.qualifications
    if payload.preferred_qualifications is not None:
        job.preferred_qualifications = payload.preferred_qualifications
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
