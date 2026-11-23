import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.models.entities import Skill, SkillAlias, JobListing, JobSkill
from app.core.seed import seed_baseline_jobs
from app.services.taxonomy_service import seed_taxonomy_if_empty, extract_and_save_job_skills


@pytest.fixture(scope="module", autouse=True)
def setup_taxonomy_db():
    init_db()
    db = SessionLocal()
    seed_baseline_jobs(db)
    seed_taxonomy_if_empty(db)
    db.close()


def test_taxonomy_seeded():
    """Verify that the canonical taxonomy and aliases are seeded on startup."""
    db = SessionLocal()
    skill_count = db.query(Skill).count()
    alias_count = db.query(SkillAlias).count()
    db.close()

    assert skill_count >= 30, f"Expected at least 30 canonical skills, got {skill_count}"
    assert alias_count >= 50, f"Expected at least 50 aliases, got {alias_count}"


def test_list_skills_api():
    """GET /api/taxonomy/skills returns list of canonical skills with aliases."""
    client = TestClient(app)
    resp = client.get("/api/taxonomy/skills")
    assert resp.status_code == 200
    skills = resp.json()
    assert len(skills) >= 30

    # Verify Python, SQL, Collibra exist
    names = {s["canonical_name"] for s in skills}
    assert "Python" in names
    assert "SQL" in names
    assert "Collibra" in names
    assert "Data Governance" in names


def test_create_skill_and_alias():
    """POST /api/taxonomy/skills creates a new canonical skill, and alias mapping works (TC-09)."""
    # Clean up any existing TestGraphQL from previous test runs
    db = SessionLocal()
    existing = db.query(Skill).filter(Skill.canonical_name == "TestGraphQL").first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    client = TestClient(app)
    payload = {
        "canonical_name": "TestGraphQL",
        "category": "Technical",
        "description": "GraphQL query language for APIs",
        "aliases": ["graphql", "gql"],
    }
    resp = client.post("/api/taxonomy/skills", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["canonical_name"] == "TestGraphQL"
    skill_id = data["id"]

    # Add another alias
    alias_resp = client.post(f"/api/taxonomy/skills/{skill_id}/aliases", json={"alias_text": "apollo-graphql"})
    assert alias_resp.status_code == 200

    # Verify duplicate alias on another skill is rejected
    alias_dup_resp = client.post("/api/taxonomy/skills/1/aliases", json={"alias_text": "graphql"})
    assert alias_dup_resp.status_code == 400


def test_tc08_deterministic_skill_extraction():
    """TC-08: Run deterministic extraction on a job and verify evidence snippets and review status."""
    db = SessionLocal()
    job = db.query(JobListing).filter(JobListing.status == "Available").first()
    assert job is not None, "At least one available job is required"
    job_id = job.id
    db.close()

    client = TestClient(app)
    resp = client.post(f"/api/taxonomy/jobs/{job_id}/extract-skills")
    assert resp.status_code == 200
    extractions = resp.json()
    assert len(extractions) > 0

    first = extractions[0]
    assert "canonical_name" in first
    assert "evidence_snippet" in first
    assert len(first["evidence_snippet"]) >= 10
    assert first["review_status"] in ("Proposed", "Accepted", "Edited")
    assert first["requirement_type"] in ("Required", "Preferred")


def test_tc10_tc22_ai_disambiguation():
    """TC-10 & TC-22: Ambiguous alias disambiguation with graceful fallback."""
    client = TestClient(app)
    payload = {
        "phrase": "authoring relational database queries and stored procedures",
        "context": "Seeking an associate with 3+ years in data extraction.",
    }
    resp = client.post("/api/taxonomy/ai-disambiguate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "suggested_canonical_name" in data
    assert "confidence" in data
    assert "rationale" in data
    # Should resolve to SQL or Data Management
    assert data["suggested_canonical_name"] in ("SQL", "Data Governance", "Python", "Data Modeling")


def test_tc13_review_and_edit_job_skill():
    """TC-13: Human review edits (accept, reject, edit) persist across requests."""
    db = SessionLocal()
    job = db.query(JobListing).filter(JobListing.status == "Available").first()
    job_id = job.id
    # Ensure extraction
    extract_and_save_job_skills(job, db)
    job_skill = db.query(JobSkill).filter(JobSkill.job_id == job_id).first()
    job_skill_id = job_skill.id
    db.close()

    client = TestClient(app)
    # Approve / Accept the skill
    edit_payload = {
        "review_status": "Accepted",
        "requirement_type": "Preferred",
        "evidence_snippet": "Verified during human review: Preferred requirement.",
    }
    resp = client.put(f"/api/taxonomy/jobs/{job_id}/skills/{job_skill_id}", json=edit_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_status"] == "Accepted"
    assert data["requirement_type"] == "Preferred"
    assert "Verified during human review" in data["evidence_snippet"]

    # Re-verify persistence via DB session
    fresh_db = SessionLocal()
    persisted = fresh_db.query(JobSkill).filter(JobSkill.id == job_skill_id).first()
    assert persisted.review_status == "Accepted"
    assert persisted.requirement_type == "Preferred"
    fresh_db.close()
