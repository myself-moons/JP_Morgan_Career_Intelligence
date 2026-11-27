import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import ResumeDocument, User, utcnow
from app.models.schemas import ResumeOut
from app.services.document_parser import parse_document

router = APIRouter(prefix="/resumes", tags=["Resumes (v3.0)"])


class ResumeTextCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    raw_text: str = Field(..., min_length=20)


def _user_upload_dir(user_id: int) -> Path:
    d = settings.UPLOADS_DIR / f"user_{user_id}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _validate_upload_magic(ext: str, content: bytes) -> None:
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > settings.MAX_UPLOAD_BYTES:
        mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {mb} MB.")
    if ext == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF file header.")
    if ext == ".docx" and not content.startswith(b"PK\x03\x04"):
        raise HTTPException(status_code=400, detail="Invalid DOCX archive header.")


@router.get("", response_model=List[ResumeOut], summary="List resumes belonging to the signed-in user")
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == current_user.id)
        .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.desc())
        .all()
    )


@router.get("/active", response_model=Optional[ResumeOut], summary="Get active resume for the current user")
def get_active_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resumes = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == current_user.id)
        .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.desc())
        .all()
    )
    if not resumes:
        return None
    active = next((r for r in resumes if r.is_active == 1), None)
    if not active:
        active = resumes[0]
        active.is_active = 1
        db.commit()
        db.refresh(active)
    return active


@router.post("/upload", response_model=ResumeOut, status_code=status.HTTP_201_CREATED, summary="Upload PDF, DOCX, or TXT resume securely")
async def upload_resume(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orig_name = Path(file.filename or "resume.pdf").name
    ext = Path(orig_name).suffix.lower()
    if ext not in (".pdf", ".docx", ".txt"):
        raise HTTPException(
            status_code=400,
            detail="Only .pdf, .docx, and .txt files are supported. Use Overleaf externally for LaTeX editing.",
        )

    contents = await file.read()
    _validate_upload_magic(ext, contents)

    if ext == ".txt":
        raw_text = contents.decode("utf-8", errors="replace").strip()
    else:
        try:
            raw_text, _, _ = parse_document(orig_name, contents)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    if not raw_text or len(raw_text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Could not extract readable text from this file.")

    # Save binary safely with UUID filename inside user-isolated uploads directory
    safe_stored_name = f"{uuid.uuid4().hex}{ext}"
    save_path = _user_upload_dir(current_user.id) / safe_stored_name
    save_path.write_bytes(contents)

    # Mark new upload active by default
    db.query(ResumeDocument).filter(ResumeDocument.user_id == current_user.id).update({"is_active": 0})

    resume = ResumeDocument(
        user_id=current_user.id,
        name=name.strip() or Path(orig_name).stem,
        pdf_filename=orig_name if ext == ".pdf" else None,
        stored_filename=safe_stored_name,
        pdf_data=contents if ext == ".pdf" else None,
        raw_text=raw_text.strip(),
        is_active=1,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/text", response_model=ResumeOut, status_code=status.HTTP_201_CREATED, summary="Save pasted resume text")
def create_text_resume(
    payload: ResumeTextCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(ResumeDocument).filter(ResumeDocument.user_id == current_user.id).update({"is_active": 0})
    resume = ResumeDocument(
        user_id=current_user.id,
        name=payload.name.strip(),
        raw_text=payload.raw_text.strip(),
        is_active=1,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/{resume_id}/activate", response_model=ResumeOut, summary="Set a resume as active")
def activate_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.id == resume_id, ResumeDocument.user_id == current_user.id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Resume not found")
    db.query(ResumeDocument).filter(ResumeDocument.user_id == current_user.id).update({"is_active": 0})
    target.is_active = 1
    target.updated_at = utcnow()
    db.commit()
    db.refresh(target)
    return target


@router.get("/{resume_id}/pdf", summary="Stream uploaded PDF resume for preview")
def stream_resume_pdf(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.id == resume_id, ResumeDocument.user_id == current_user.id)
        .first()
    )
    if not target or not (target.pdf_filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=404, detail="PDF file not found for this resume")
    if target.stored_filename:
        file_path = _user_upload_dir(current_user.id) / Path(target.stored_filename).name
        if file_path.exists():
            return FileResponse(
                path=str(file_path),
                media_type="application/pdf",
                filename=target.pdf_filename or "resume.pdf",
                headers={"Content-Disposition": f'inline; filename="{target.pdf_filename or "resume.pdf"}"'},
            )
    if target.pdf_data:
        return Response(
            content=target.pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{target.pdf_filename or "resume.pdf"}"'},
        )
    raise HTTPException(status_code=404, detail="Stored PDF file not found")


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user resume")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.id == resume_id, ResumeDocument.user_id == current_user.id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Resume not found")
    if target.stored_filename:
        file_path = _user_upload_dir(current_user.id) / Path(target.stored_filename).name
        if file_path.exists():
            file_path.unlink(missing_ok=True)
    db.delete(target)
    db.commit()
