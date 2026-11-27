import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_text_resume_upload_activate_and_delete():
    """Verify v3 text/PDF resume lifecycle without LaTeX clutter or personal auto-seeding."""
    client = TestClient(app)

    create_resp = client.post(
        "/api/resumes/text",
        json={
            "name": "Test Analytics Profile",
            "raw_text": "Built SQL and Python ETL pipelines using FastAPI, Pandas, and Data Quality validation rules.",
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == "Test Analytics Profile"
    assert created["is_active"] == 1
    rid = created["id"]

    # List resumes
    list_resp = client.get("/api/resumes")
    assert list_resp.status_code == 200
    assert any(r["id"] == rid for r in list_resp.json())

    # Active resume
    act_resp = client.get("/api/resumes/active")
    assert act_resp.status_code == 200
    assert act_resp.json()["id"] == rid

    # Delete cleanup
    del_resp = client.delete(f"/api/resumes/{rid}")
    assert del_resp.status_code == 204


def test_reject_latex_and_invalid_pdf_magic_bytes():
    """Verify v3 upload hardening: rejects .tex files and fake PDFs."""
    client = TestClient(app)

    tex_resp = client.post(
        "/api/resumes/upload",
        data={"name": "Fake Tex"},
        files={"file": ("resume.tex", b"\\documentclass{article}", "application/x-tex")},
    )
    assert tex_resp.status_code == 400
    assert "Overleaf" in tex_resp.json()["detail"]

    fake_pdf = client.post(
        "/api/resumes/upload",
        data={"name": "Fake PDF"},
        files={"file": ("../../evil.pdf", b"NOT_A_PDF_HEADER", "application/pdf")},
    )
    assert fake_pdf.status_code == 400
    assert "Invalid PDF" in fake_pdf.json()["detail"]


def test_pdf_preview_persists_in_database_after_disk_cleanup():
    """Verify PDF bytes stored in DB still stream after ephemeral disk cleanup (Cloud Run)."""
    import pymupdf
    from app.core.database import SessionLocal
    from app.core.config import settings
    from app.models.entities import ResumeDocument

    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 72), "Python SQL FastAPI Data Quality Portfolio Resume")
    pdf_bytes = doc.tobytes()

    client = TestClient(app)
    up_resp = client.post(
        "/api/resumes/upload",
        data={"name": "Persistent Cloud PDF"},
        files={"file": ("cloud_resume.pdf", pdf_bytes, "application/pdf")},
    )
    assert up_resp.status_code == 201
    rid = up_resp.json()["id"]

    # Simulate Cloud Run ephemeral container recycle by removing disk copy
    db = SessionLocal()
    rec = db.query(ResumeDocument).filter(ResumeDocument.id == rid).first()
    assert rec is not None and rec.pdf_data is not None
    if rec.stored_filename:
        disk_path = settings.UPLOADS_DIR / f"user_{rec.user_id}" / rec.stored_filename
        disk_path.unlink(missing_ok=True)
    db.close()

    stream_resp = client.get(f"/api/resumes/{rid}/pdf")
    assert stream_resp.status_code == 200
    assert stream_resp.headers["content-type"] == "application/pdf"
    assert stream_resp.content.startswith(b"%PDF-")

    assert client.delete(f"/api/resumes/{rid}").status_code == 204
