import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.models.entities import JobListing, Skill
from app.services.profile_service import seed_profile_if_empty, validate_resume_parse
from app.services.resume_service import seed_resumes
from app.services.taxonomy_service import seed_taxonomy_if_empty, batch_extract_all_jobs


@pytest.fixture(scope="module", autouse=True)
def setup_m5_data():
    init_db()
    db = SessionLocal()
    seed_baseline_jobs(db)
    seed_resumes(db)
    seed_taxonomy_if_empty(db)
    batch_extract_all_jobs(db)
    seed_profile_if_empty(db)
    db.close()


def test_tc15_cardlyze_profile_attribution_seeded():
    """
    TC-15: Evaluate profile seeded with CardLyze attribution.
    - Independent items (e.g. Data Modeling, Pandas) are Demonstrated with Independent attribution.
    - AI-assisted items (e.g. Docker) reflect AI-assisted status and Partial where appropriate.
    """
    client = TestClient(app)
    resp = client.get("/api/profile")
    assert resp.status_code == 200
    data = resp.json()

    assert data["profile"]["full_name"] == "Manthan Waghela"
    items = data["evidence_items"]
    assert len(items) >= 15

    by_name = {item["canonical_name"]: item for item in items}
    assert "Data Modeling" in by_name
    assert by_name["Data Modeling"]["evidence_status"] == "Demonstrated"
    assert "Independent" in by_name["Data Modeling"]["contribution_type"]
    assert "CardLyze" in (by_name["Data Modeling"]["source_project"] or "")

    assert "Docker" in by_name
    assert by_name["Docker"]["evidence_status"] == "Partial"
    assert "AI-assisted" in by_name["Docker"]["contribution_type"]


def test_create_and_update_profile_evidence():
    """Verify FR-18 and FR-19 CRUD for profile evidence and multi-contribution tags."""
    client = TestClient(app)
    db = SessionLocal()
    collibra = db.query(Skill).filter(Skill.canonical_name == "Collibra").first()
    db.close()
    assert collibra is not None

    # Add temporary evidence
    create_resp = client.post(
        "/api/profile/evidence",
        json={
            "skill_id": collibra.id,
            "evidence_status": "Learning",
            "contribution_type": "Supervised, Tested",
            "source_project": "Sandbox Collibra Lab",
            "evidence_description": "Testing metadata glossary mapping.",
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["canonical_name"] == "Collibra"
    assert created["evidence_status"] == "Learning"
    assert "Supervised" in created["contribution_type"]

    # Clean up so baseline gap remains intact for subsequent tests
    del_resp = client.delete(f"/api/profile/evidence/{created['id']}")
    assert del_resp.status_code == 204


def test_tc19_tc20_resume_coverage_and_claimed_unsupported():
    """
    TC-19 & TC-20: Side-by-side resume vs JD coverage (FR-38) and
    Claimed in resume, unsupported by profile evidence (FR-40, BR-13).
    """
    client = TestClient(app)
    db = SessionLocal()
    job = db.query(JobListing).filter(JobListing.status == "Available").first()
    db.close()
    assert job is not None

    resp = client.get(f"/api/profile/match-job/{job.id}")
    assert resp.status_code == 200
    data = resp.json()

    # Must present 6 separate dimensions, never a single composite ATS score (FR-21, FR-38)
    assert len(data["dimensions"]) == 6
    assert "overall_score" not in data
    assert "parse_check" in data
    assert data["parse_check"]["status"] == "Healthy"

    # Active resume includes Forage GenAI simulation (Deep Learning / GenAI) whose status is Learning
    unsupported_names = [u["canonical_name"] for u in data["claimed_unsupported"]]
    assert "Deep Learning / GenAI" in unsupported_names
    genai_flag = next(u for u in data["claimed_unsupported"] if u["canonical_name"] == "Deep Learning / GenAI")
    assert "Claimed in resume, unsupported by profile evidence" in genai_flag["warning_message"]


def test_tc21_reference_data_education_eligibility_separation():
    """
    TC-21 / BR-15: Reference Data Analyst postgraduate finance requirement
    must be evaluated strictly under Education & Eligibility dimension.
    """
    client = TestClient(app)
    db = SessionLocal()
    ref_job = (
        db.query(JobListing)
        .filter(JobListing.title.ilike("%Reference Data%"))
        .first()
    )
    if not ref_job:
        ref_job = JobListing(
            title="Reference Data Analyst - Finance & Control",
            external_job_id="TEST-REF-01",
            role_family="Family C: Finance, Credit and Operations",
            status="Available",
            qualifications="Postgraduate degree in Finance, MBA or CFA required with strong SQL.",
        )
        db.add(ref_job)
        db.commit()
        db.refresh(ref_job)
    job_id = ref_job.id
    db.close()

    resp = client.get(f"/api/profile/match-job/{job_id}")
    assert resp.status_code == 200
    data = resp.json()

    edu_dim = next((d for d in data["dimensions"] if d["dimension_key"] == "education_eligibility"), None)
    assert edu_dim is not None
    assert edu_dim["status_badge"] == "Eligibility Gap"
    assert len(edu_dim["gap_items"]) >= 1

    # Education requirement should NOT appear in Technical Skills gaps
    tech_dim = next((d for d in data["dimensions"] if d["dimension_key"] == "technical_skills"), None)
    assert tech_dim is not None
    assert not any("postgraduate" in g.lower() for g in tech_dim["gap_items"])


def test_fr39_resume_parse_check_warnings():
    """FR-39: Validate empty and scrambled multi-column parse checks."""
    empty_check = validate_resume_parse("")
    assert empty_check.status == "Empty"
    assert len(empty_check.warnings) >= 1

    scrambled = "\n".join(["ab"] * 20)
    warn_check = validate_resume_parse(scrambled)
    assert warn_check.status == "Warning"
    assert len(warn_check.warnings) >= 1
