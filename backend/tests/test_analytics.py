import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.models.entities import JobListing, Skill
from app.core.seed import seed_baseline_jobs
from app.services.taxonomy_service import seed_taxonomy_if_empty, batch_extract_all_jobs
from app.services.analytics_service import compute_skill_coverage, compute_cross_role_matrix


@pytest.fixture(scope="module", autouse=True)
def setup_analytics_data():
    init_db()
    db = SessionLocal()
    seed_baseline_jobs(db)
    seed_taxonomy_if_empty(db)
    batch_extract_all_jobs(db)
    db.close()


def test_tc11_distinct_job_coverage_calculation():
    """
    TC-11: Count skill across multiple jobs.
    - Coverage % = (distinct available jobs mentioning skill / N) * 100.
    - Unavailable jobs (status == 'JD unavailable') are excluded from denominator N (BR-06).
    - Single job contributes at most 1 to skill count (BR-07).
    """
    db = SessionLocal()
    available_jobs_count = db.query(JobListing).filter(JobListing.status == "Available").count()
    db.close()

    client = TestClient(app)
    resp = client.get("/api/analytics/coverage")
    assert resp.status_code == 200
    data = resp.json()

    assert data["analysable_count"] == available_jobs_count, (
        f"Denominator N should be count of Available jobs ({available_jobs_count}), got {data['analysable_count']}"
    )

    skills = data["skills"]
    assert len(skills) > 0

    for s in skills:
        count = s["distinct_job_count"]
        pct = s["coverage_percentage"]
        if available_jobs_count > 0:
            expected_pct = round((count / available_jobs_count) * 100, 1)
            assert pct == expected_pct, f"Skill {s['canonical_name']} pct mismatch: got {pct}, expected {expected_pct}"
        assert count <= available_jobs_count


def test_tc12_role_family_filtering():
    """
    TC-12: Filter by role family recalculates denominator N and coverage strictly for that family.
    """
    client = TestClient(app)

    # Family A
    resp_a = client.get("/api/analytics/coverage?role_family=Family+A")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["active_family_filter"] == "Family A"
    n_a = data_a["analysable_count"]

    # Verify that each skill's coverage is calculated against n_a
    for s in data_a["skills"]:
        if n_a > 0:
            expected = round((s["distinct_job_count"] / n_a) * 100, 1)
            assert s["coverage_percentage"] == expected

    # Family B
    resp_b = client.get("/api/analytics/coverage?role_family=Family+B")
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["active_family_filter"] == "Family B"


def test_cross_role_matrix_structure():
    """Verify FR-16 Cross-role comparative matrix format and grid mapping."""
    client = TestClient(app)
    resp = client.get("/api/analytics/matrix")
    assert resp.status_code == 200
    data = resp.json()

    assert "total_analysable_jobs" in data
    assert "jobs" in data
    assert "skills" in data
    assert "matrix" in data

    jobs = data["jobs"]
    assert len(jobs) == data["total_analysable_jobs"]

    # Verify matrix cells have status 'required', 'preferred', or 'none'
    matrix = data["matrix"]
    job_ids = [str(j["job_id"]) for j in jobs]
    for skill_id_str, row in matrix.items():
        for j_id in job_ids:
            if j_id in row:
                assert row[j_id] in ("required", "preferred", "none")


def test_skill_evidence_snippets():
    """Verify FR-15 / FR-25: Click-to-inspect evidence snippets for a skill."""
    client = TestClient(app)
    # Get first skill with distinct_job_count > 0
    cov_resp = client.get("/api/analytics/coverage")
    skills = cov_resp.json()["skills"]
    active_skill = next((s for s in skills if s["distinct_job_count"] > 0), None)
    assert active_skill is not None

    evidence_resp = client.get(f"/api/analytics/skills/{active_skill['skill_id']}/evidence")
    assert evidence_resp.status_code == 200
    ev_data = evidence_resp.json()

    assert ev_data["canonical_name"] == active_skill["canonical_name"]
    assert len(ev_data["items"]) == active_skill["distinct_job_count"]
    for item in ev_data["items"]:
        assert "evidence_snippet" in item
        assert "job_title" in item
        assert "role_family" in item
