from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import ResumeOut, ResumeLatexUpdate
from app.services import resume_service

router = APIRouter(prefix="/resumes", tags=["Resumes"])


@router.get("", response_model=List[ResumeOut])
def list_resumes(db: Session = Depends(get_db)):
    """List all available resumes in the repository."""
    # Ensure folder resumes are seeded if DB is empty
    resumes = resume_service.get_all_resumes(db)
    if not resumes:
        resumes = resume_service.seed_resumes(db)
    return resumes


@router.post("/seed", response_model=List[ResumeOut])
def refresh_seed_resumes(db: Session = Depends(get_db)):
    """Scans the resumes/ directory and syncs all files into the database."""
    return resume_service.seed_resumes(db)


@router.get("/active", response_model=Optional[ResumeOut])
def get_active_resume(db: Session = Depends(get_db)):
    """Returns the currently selected active resume for intelligence matching."""
    resumes = resume_service.get_all_resumes(db)
    active = next((r for r in resumes if r.is_active == 1), None)
    if not active and resumes:
        active = resume_service.activate_resume(db, resumes[0].id)
    return active


@router.get("/{resume_id}", response_model=ResumeOut)
def get_resume(resume_id: int, db: Session = Depends(get_db)):
    """Retrieve full resume record including extracted text and LaTeX source."""
    resume = resume_service.get_resume_by_id(db, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.get("/{resume_id}/pdf")
def stream_resume_pdf(resume_id: int, db: Session = Depends(get_db)):
    """Streams the resume PDF for in-browser iframe preview."""
    pdf_path = resume_service.get_pdf_path(db, resume_id)
    if not pdf_path or not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found for this resume")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=pdf_path.name,
        headers={"Content-Disposition": f'inline; filename="{pdf_path.name}"'}
    )


@router.get("/{resume_id}/export-tex")
def export_resume_tex(resume_id: int, db: Session = Depends(get_db)):
    """Downloads the resume LaTeX source file."""
    resume = resume_service.get_resume_by_id(db, resume_id)
    if not resume or not resume.latex_source:
        raise HTTPException(status_code=404, detail="LaTeX source not found for this resume")
    filename = resume.latex_filename or f"resume_{resume.id}.tex"
    return Response(
        content=resume.latex_source,
        media_type="application/x-tex; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.put("/{resume_id}/latex", response_model=ResumeOut)
def update_latex(resume_id: int, payload: ResumeLatexUpdate, db: Session = Depends(get_db)):
    """Saves updated LaTeX source code and refreshes extracted plain text."""
    updated = resume_service.update_resume_latex(db, resume_id, payload.latex_source)
    if not updated:
        raise HTTPException(status_code=404, detail="Resume not found")
    return updated


@router.post("/{resume_id}/activate", response_model=ResumeOut)
def activate_resume(resume_id: int, db: Session = Depends(get_db)):
    """Designates this resume as the active version for job matching."""
    activated = resume_service.activate_resume(db, resume_id)
    if not activated:
        raise HTTPException(status_code=404, detail="Resume not found")
    return activated


@router.post("/upload", response_model=ResumeOut)
async def upload_resume(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a new PDF or TeX resume file."""
    filename = file.filename or "uploaded_resume"
    ext = Path(filename).suffix.lower()
    if ext not in [".pdf", ".tex"]:
        raise HTTPException(
            status_code=400,
            detail="Only .pdf and .tex files are supported for resume management"
        )

    resumes_dir = resume_service.get_resumes_dir()
    save_path = resumes_dir / filename
    contents = await file.read()
    save_path.write_bytes(contents)

    latex_source = None
    raw_text = None
    pdf_filename = None
    latex_filename = None

    if ext == ".pdf":
        pdf_filename = filename
        raw_text = resume_service.extract_text_from_pdf(save_path)
    elif ext == ".tex":
        latex_filename = filename
        latex_source = contents.decode("utf-8", errors="replace")
        raw_text = resume_service.clean_latex_to_text(latex_source)

    # Check if a record exists
    existing = db.query(resume_service.ResumeDocument).filter(
        resume_service.ResumeDocument.name == name
    ).first()

    if existing:
        if ext == ".pdf":
            existing.pdf_filename = pdf_filename
            existing.raw_text = raw_text
        elif ext == ".tex":
            existing.latex_filename = latex_filename
            existing.latex_source = latex_source
            if not existing.raw_text:
                existing.raw_text = raw_text
        existing.updated_at = resume_service.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        is_active = 1 if db.query(resume_service.ResumeDocument).count() == 0 else 0
        new_resume = resume_service.ResumeDocument(
            name=name,
            pdf_filename=pdf_filename,
            latex_filename=latex_filename,
            raw_text=raw_text,
            latex_source=latex_source,
            is_active=is_active,
        )
        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)
        return new_resume
