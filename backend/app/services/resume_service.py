import re
from pathlib import Path
from typing import List, Optional
import pymupdf
from sqlalchemy.orm import Session
from app.models.entities import ResumeDocument, utcnow

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
RESUMES_DIR = PROJECT_ROOT / "resumes"


def get_resumes_dir() -> Path:
    RESUMES_DIR.mkdir(parents=True, exist_ok=True)
    return RESUMES_DIR


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extracts raw text from a PDF file using PyMuPDF."""
    if not pdf_path.exists():
        return ""
    try:
        doc = pymupdf.open(str(pdf_path))
        text_parts = [page.get_text() for page in doc]
        return "\n".join(text_parts).strip()
    except Exception as e:
        print(f"Error extracting text from {pdf_path}: {e}")
        return ""


def clean_latex_to_text(latex_code: str) -> str:
    """Strips common LaTeX tags to generate readable plain text."""
    if not latex_code:
        return ""
    # Remove comments
    text = re.sub(r"(?m)^%.*$", "", latex_code)
    # Remove commands like \textbf{...}, \textit{...}, etc.
    text = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}", r"\1", text)
    # Remove standalone commands like \\, \newpage, \item
    text = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?", " ", text)
    # Replace special escaped characters
    text = text.replace(r"\%", "%").replace(r"\&", "&").replace(r"\$", "$").replace(r"\_", "_")
    # Clean whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def seed_resumes(db: Session) -> List[ResumeDocument]:
    """
    Scans resumes/ folder, reads existing PDF and TeX files, and inserts/updates DB records.
    Ensures at least one active resume exists.
    """
    resumes_dir = get_resumes_dir()
    if not resumes_dir.exists():
        return []

    # Map by stem: e.g. "Manthan_Fintech_Resume_19_11_2026"
    discovered: List[ResumeDocument] = []
    tex_files = {f.stem: f for f in resumes_dir.glob("*.tex")}
    pdf_files = {f.stem: f for f in resumes_dir.glob("*.pdf")}
    all_stems = sorted(set(tex_files.keys()).union(pdf_files.keys()))

    for stem in all_stems:
        tex_path = tex_files.get(stem)
        pdf_path = pdf_files.get(stem)

        display_name = stem.replace("_", " ").title()

        latex_source = None
        if tex_path and tex_path.exists():
            try:
                latex_source = tex_path.read_text(encoding="utf-8")
            except Exception:
                pass

        raw_text = None
        if pdf_path and pdf_path.exists():
            raw_text = extract_text_from_pdf(pdf_path)
        elif latex_source:
            raw_text = clean_latex_to_text(latex_source)

        pdf_filename = pdf_path.name if pdf_path else None
        latex_filename = tex_path.name if tex_path else None

        existing = db.query(ResumeDocument).filter(
            (ResumeDocument.pdf_filename == pdf_filename) |
            (ResumeDocument.latex_filename == latex_filename) |
            (ResumeDocument.name == display_name)
        ).first()

        if not existing:
            # First discovered resume gets marked active by default
            is_active = 1 if (db.query(ResumeDocument).count() == 0 and len(discovered) == 0) else 0
            resume = ResumeDocument(
                name=display_name,
                pdf_filename=pdf_filename,
                latex_filename=latex_filename,
                raw_text=raw_text,
                latex_source=latex_source,
                is_active=is_active,
            )
            db.add(resume)
            discovered.append(resume)
        else:
            # Update source code and text if missing
            if latex_source and not existing.latex_source:
                existing.latex_source = latex_source
            if raw_text and not existing.raw_text:
                existing.raw_text = raw_text
            if pdf_filename:
                existing.pdf_filename = pdf_filename
            if latex_filename:
                existing.latex_filename = latex_filename
            discovered.append(existing)

    db.commit()

    # Ensure exactly one resume is active if any exist
    active = db.query(ResumeDocument).filter(ResumeDocument.is_active == 1).first()
    if not active:
        first = db.query(ResumeDocument).first()
        if first:
            first.is_active = 1
            db.commit()

    return db.query(ResumeDocument).all()


def get_all_resumes(db: Session) -> List[ResumeDocument]:
    return db.query(ResumeDocument).order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.asc()).all()


def get_resume_by_id(db: Session, resume_id: int) -> Optional[ResumeDocument]:
    return db.query(ResumeDocument).filter(ResumeDocument.id == resume_id).first()


def activate_resume(db: Session, resume_id: int) -> Optional[ResumeDocument]:
    target = get_resume_by_id(db, resume_id)
    if not target:
        return None
    # Deactivate all others
    db.query(ResumeDocument).update({"is_active": 0})
    target.is_active = 1
    db.commit()
    db.refresh(target)
    return target


def update_resume_latex(
    db: Session, resume_id: int, new_latex: str, save_to_disk: bool = True
) -> Optional[ResumeDocument]:
    target = get_resume_by_id(db, resume_id)
    if not target:
        return None

    target.latex_source = new_latex
    target.raw_text = clean_latex_to_text(new_latex)
    target.updated_at = utcnow()

    if save_to_disk and target.latex_filename:
        tex_path = get_resumes_dir() / target.latex_filename
        try:
            tex_path.write_text(new_latex, encoding="utf-8")
        except Exception as e:
            print(f"Warning: could not write LaTeX to disk at {tex_path}: {e}")

    db.commit()
    db.refresh(target)
    return target


def get_pdf_path(db: Session, resume_id: int) -> Optional[Path]:
    target = get_resume_by_id(db, resume_id)
    if not target or not target.pdf_filename:
        return None
    pdf_path = get_resumes_dir() / target.pdf_filename
    if pdf_path.exists():
        return pdf_path
    return None
