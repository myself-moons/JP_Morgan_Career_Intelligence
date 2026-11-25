import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.models.entities import ProfileEvidence, Skill
from app.services.learning_service import seed_learning_resources_if_empty
from app.services.profile_service import seed_profile_if_empty
from app.services.taxonomy_service import seed_taxonomy_if_empty, batch_extract_all_jobs


@pytest.fixture(scope="module", autouse=True)
def setup_m6_data():
    init_db()
    db = SessionLocal()
    seed_baseline_jobs(db)
    seed_taxonomy_if_empty(db)
    batch_extract_all_jobs(db)
    seed_profile_if_empty(db)
    seed_learning_resources_if_empty(db)
    db.close()


def test_learning_catalogue_seeded_and_filtered():
    """Verify FR-22 learning catalogue seeding and filters."""
    client = TestClient(app)
    resp = client.get("/api/learning/resources")
    assert resp.status_code == 200
    resources = resp.json()
    assert len(resources) >= 10

    free_resp = client.get("/api/learning/resources?cost_status=Free")
    assert free_resp.status_code == 200
    assert all(r["cost_status"] == "Free" for r in free_resp.json())


def test_gap_driven_recommendations_cite_reasons():
    """Verify FR-23 & BR-10: recommendations map to gaps and explain why."""
    client = TestClient(app)
    resp = client.get("/api/learning/recommendations")
    assert resp.status_code == 200
    data = resp.json()

    assert data["analysable_jobs_count"] >= 1
    assert len(data["recommendations"]) >= 1
    first = data["recommendations"][0]
    assert len(first["addressed_gaps"]) >= 1
    assert "Addresses" in first["gap_reason"]


def test_tc14_course_completion_does_not_auto_upgrade_profile_evidence():
    """
    TC-14 / BR-09: Completing a course in Learning Tracker updates progress to Completed,
    but MUST NOT automatically upgrade ProfileEvidence to Demonstrated.
    """
    client = TestClient(app)
    # Pick the Collibra resource
    res_resp = client.get("/api/learning/resources?skill=Collibra")
    assert res_resp.status_code == 200
    collibra_courses = res_resp.json()
    assert len(collibra_courses) >= 1
    course = collibra_courses[0]

    # Ensure Collibra currently has NO Demonstrated profile evidence
    db = SessionLocal()
    collibra_skill = db.query(Skill).filter(Skill.canonical_name == "Collibra").first()
    assert collibra_skill is not None
    before_ev = db.query(ProfileEvidence).filter(ProfileEvidence.skill_id == collibra_skill.id).first()
    db.close()
    assert before_ev is None or before_ev.evidence_status != "Demonstrated"

    # Mark course Completed
    upd_resp = client.put(
        f"/api/learning/resources/{course['id']}/progress",
        json={"status": "Completed", "notes": "Finished modules and quiz"},
    )
    assert upd_resp.status_code == 200
    upd_data = upd_resp.json()
    assert upd_data["resource"]["progress_status"] == "Completed"
    assert upd_data["profile_evidence_auto_upgraded"] is False
    assert "BR-09" in upd_data["policy_notice"]

    # Verify DB ProfileEvidence for Collibra was NOT upgraded to Demonstrated
    db = SessionLocal()
    after_ev = db.query(ProfileEvidence).filter(ProfileEvidence.skill_id == collibra_skill.id).first()
    db.close()
    assert after_ev is None or after_ev.evidence_status != "Demonstrated"

    # Reset back to Not started
    client.put(
        f"/api/learning/resources/{course['id']}/progress",
        json={"status": "Not started", "notes": ""},
    )


def test_add_custom_learning_resource_unknown_cost_default():
    """Verify FR-22 & BR-11: custom resources can be added and unknown cost handled."""
    client = TestClient(app)
    resp = client.post(
        "/api/learning/resources",
        json={
            "provider": "Custom Academy",
            "title": "Enterprise Metadata Testing Workshop",
            "skills_addressed": ["Metadata Management"],
            "cost_status": "Unknown",
            "has_certificate": False,
        },
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["cost_status"] == "Unknown"
    assert created["is_custom"] is True

    # Clean up
    del_resp = client.delete(f"/api/learning/resources/{created['id']}")
    assert del_resp.status_code == 204
