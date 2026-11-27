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
