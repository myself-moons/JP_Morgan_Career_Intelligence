from unittest.mock import MagicMock, patch
import json
from fastapi.testclient import TestClient

from app.core.auth import create_session_token, get_current_user
from app.core.config import _normalize_database_url, settings
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.main import app
from app.models.entities import (
    ExperienceEntry,
    JobListing,
    ResumeDocument,
    RoadmapItem,
    SavedResource,
    User,
    UserJobAIScore,
)
from app.services.llm_matcher import rank_top_jobs_for_resume
from app.services.taxonomy_service import batch_extract_all_jobs, seed_taxonomy_if_empty
from app.services.vault_service import redact_pii


def test_postgresql_url_normalization():
    """Verify postgres:// and postgresql:// normalize to psycopg v3 dialect."""
    assert _normalize_database_url("postgres://u:p@host:5432/db") == "postgresql+psycopg://u:p@host:5432/db"
    assert _normalize_database_url("postgresql://u:p@host:5432/db") == "postgresql+psycopg://u:p@host:5432/db"
    assert _normalize_database_url("sqlite:///./data/jci.db") == "sqlite:///./data/jci.db"


def test_google_auth_enforcement_and_user_isolation():
    """
    Verify:
    1. Unauthenticated requests return 401 when AUTH_REQUIRED=True.
    2. Google Login sets HttpOnly cookie and enforces strict per-user data isolation.
    """
    init_db()
    orig_override = app.dependency_overrides.pop(get_current_user, None)
    orig_auth_req = settings.AUTH_REQUIRED
    orig_client_id = settings.GOOGLE_CLIENT_ID
    try:
        settings.AUTH_REQUIRED = True
        settings.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"

        unauth_client = TestClient(app)
        assert unauth_client.get("/api/vault/entries").status_code == 401
        assert unauth_client.get("/api/roadmap/items").status_code == 401
        assert unauth_client.get("/api/auth/config").status_code == 200

        # Sign in as User A
        with patch("app.core.auth.google_id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "iss": "accounts.google.com",
                "sub": "google-user-a-sub",
                "email": "usera@example.com",
                "name": "User Alpha",
            }
            client_a = TestClient(app)
            login_resp = client_a.post("/api/auth/google", json={"credential": "valid-mock-token-string"})
            assert login_resp.status_code == 200
            assert "jci_session" in login_resp.cookies

            # User A creates a private Experience Vault entry & Roadmap item
            va_resp = client_a.post(
                "/api/vault/entries",
                json={
                    "title": "Alpha Secret Project",
                    "detailed_narrative": "Built SQL and Python pipelines for reconciliation.",
                    "skill_tags": ["SQL", "Python"],
                },
            )
            assert va_resp.status_code == 201
            va_id = va_resp.json()["id"]

        # Sign in as User B -> MUST NOT see or delete User A's data
        with patch("app.core.auth.google_id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "iss": "https://accounts.google.com",
                "sub": "google-user-b-sub",
                "email": "userb@example.com",
                "name": "User Beta",
            }
            client_b = TestClient(app)
            assert client_b.post("/api/auth/google", json={"credential": "valid-mock-token-b"}).status_code == 200
            b_entries = client_b.get("/api/vault/entries").json()
            assert not any(e["id"] == va_id for e in b_entries)
            assert client_b.delete(f"/api/vault/entries/{va_id}").status_code == 404

        # Clean up User A and User B test records
        db = SessionLocal()
        db.query(ExperienceEntry).filter(ExperienceEntry.id == va_id).delete()
        db.query(User).filter(User.google_sub.in_(["google-user-a-sub", "google-user-b-sub"])).delete(synchronize_session=False)
        db.commit()
        db.close()
    finally:
        settings.AUTH_REQUIRED = orig_auth_req
        settings.GOOGLE_CLIENT_ID = orig_client_id
        if orig_override is not None:
            app.dependency_overrides[get_current_user] = orig_override


def test_skill_autocomplete_and_deduplication():
    """Verify live typeahead suggestions and alias deduplication preventing duplicate wordings."""
    init_db()
    db = SessionLocal()
    seed_taxonomy_if_empty(db)
    db.close()

    client = TestClient(app)
    sugg = client.get("/api/taxonomy/suggest?q=col").json()
    assert any(item["canonical_name"] == "Collibra" for item in sugg)

    # Alternate wording 'PostgreSQL' resolves to canonical 'SQL' without creating duplicate
    res1 = client.post("/api/taxonomy/resolve-or-create", json={"raw_name": "PostgreSQL"})
    assert res1.status_code == 200
    assert res1.json()["canonical_name"] == "SQL"
    assert res1.json()["created_new"] is False

    # Strips filler prefix 'Learn '
    res2 = client.post("/api/taxonomy/resolve-or-create", json={"raw_name": "Learn Collibra"})
    assert res2.status_code == 200
    assert res2.json()["canonical_name"] == "Collibra"
    assert res2.json()["created_new"] is False


def test_dashboard_three_tier_fallback():
    """Verify Dashboard ranks from Vault -> Resume fallback -> Empty prompt."""
    init_db()
    db = SessionLocal()
    seed_baseline_jobs(db)
    seed_taxonomy_if_empty(db)
    batch_extract_all_jobs(db)
    # Clear local-dev vault & resumes cleanly for test
    local_user = db.query(User).filter(User.google_sub == "local-dev").first()
    if local_user:
        db.query(ExperienceEntry).filter(ExperienceEntry.user_id == local_user.id).delete()
        db.query(ResumeDocument).filter(ResumeDocument.user_id == local_user.id).delete()
        db.commit()
    db.close()

    client = TestClient(app)

    # Tier 3: Neither Vault nor Resume
    d3 = client.get("/api/analytics/dashboard").json()
    assert d3["ranking_source"] == "none"
    assert d3["empty_prompt"] is not None
    assert d3["top_matches"] == []

    # Tier 2: Upload text resume -> automatic fallback
    res = client.post(
        "/api/resumes/text",
        json={
            "name": "Fallback Resume",
            "raw_text": "Experienced with Python, SQL, Pandas, Power BI, and Data Quality controls.",
        },
    ).json()
    d2 = client.get("/api/analytics/dashboard").json()
    assert d2["ranking_source"] == "resume"
    assert len(d2["top_matches"]) >= 1

    # Tier 1: Add Experience Vault -> prioritizes Vault
    entry = client.post(
        "/api/vault/entries",
        json={
            "title": "Data Governance & Python Pipeline",
            "detailed_narrative": "Built Python and SQL data quality and lineage workflows for banking datasets.",
            "skill_tags": ["Python", "SQL", "Data Quality", "Data Lineage"],
        },
    ).json()
    d1 = client.get("/api/analytics/dashboard").json()
    assert d1["ranking_source"] == "experience_vault"
    assert len(d1["top_matches"]) >= 1

    # Clean up
    client.delete(f"/api/vault/entries/{entry['id']}")
    client.delete(f"/api/resumes/{res['id']}")


def test_skill_explorer_vault_compare_and_roadmap_flow():
    """Verify Skill Explorer buckets, PII redaction, Mini-RAG offline fallback, and My Roadmap CRUD."""
    assert "[EMAIL]" in redact_pii("Contact john.doe@example.com or +1 555-123-4567")
    assert "[PHONE]" in redact_pii("Call +91 98765 43210 today")

    client = TestClient(app)
    exp = client.get("/api/explorer/compare").json()
    assert exp["total_selected_jobs"] >= 1
    assert "common_core" in exp and "role_specific" in exp

    # Create Experience Vault entry & compare offline
    entry = client.post(
        "/api/vault/entries",
        json={
            "title": "Transaction Monitoring Workflow",
            "detailed_narrative": "Engineered FastAPI and SQL reconciliation pipelines with Pytest validation.",
            "skill_tags": ["FastAPI", "SQL"],
        },
    ).json()

    job_id = exp["available_jobs"][0]["job_id"]
    with patch("app.services.vault_service.settings.GEMINI_API_KEY", ""):
        comp = client.post("/api/vault/compare-ai", json={"job_ids": [job_id]}).json()
        assert comp["is_llm_powered"] is False
        assert len(comp["retrieved_context"]) >= 1

    # Create Roadmap item + Saved Resource & Review offline
    rm = client.post(
        "/api/roadmap/items",
        json={
            "skill_name": "PostgreSQL",  # resolves to 'SQL'
            "goal_note": "Window functions practice",
            "priority": "High",
            "status": "To Learn",
        },
    ).json()
    assert rm["skill_name"] == "SQL"

    # Spam-clicking same skill ('SQL' or 'T-SQL') MUST NOT create duplicate roadmap rows
    rm_dup = client.post(
        "/api/roadmap/items",
        json={"skill_name": "SQL", "priority": "High", "status": "To Learn"},
    ).json()
    assert rm_dup["id"] == rm["id"]

    sr = client.post(
        "/api/roadmap/resources",
        json={
            "roadmap_item_id": rm["id"],
            "title": "Postgres Docs",
            "url": "https://www.postgresql.org/docs/",
            "resource_type": "Docs",
            "skill_name": "SQL",
        },
    ).json()
    assert sr["roadmap_item_id"] == rm["id"]

    with patch("app.services.roadmap_service.settings.GEMINI_API_KEY", ""):
        rev = client.post("/api/roadmap/review-ai", json={"job_ids": [job_id]}).json()
        assert rev["is_llm_powered"] is False
        assert "summary" in rev

    # Clean up
    client.delete(f"/api/roadmap/resources/{sr['id']}")
    client.delete(f"/api/roadmap/items/{rm['id']}")
    client.delete(f"/api/vault/entries/{entry['id']}")


def test_quick_estimate_discriminates_skills_and_seniority():
    """
    Verify Quick Estimate scoring does not inflate 1-skill or VP 7+ yr roles to 91%
    and ranks a genuinely matching multi-skill Analyst role higher.
    """
    init_db()
    db = SessionLocal()
    try:
        analyst_py = JobListing(
            id=9101,
            company_id=1,
            title="Analyst - Python Developer",
            role_family="Family B: Analytics, Automation and AI",
            status="Available",
            responsibilities="Build FastAPI REST APIs, PostgreSQL queries, Pytest automation, ETL pipelines.",
            qualifications="0-2 years experience with Python, SQL, FastAPI, Git, REST APIs, Pandas.",
        )
        vp_quant = JobListing(
            id=9102,
            company_id=1,
            title="Quant Model Risk Vice President",
            role_family="Family B: Analytics, Automation and AI",
            status="Available",
            responsibilities="Lead quantitative model risk reviews for derivatives pricing engines.",
            qualifications="7+ years front-office quant experience, stochastic processes, PDEs, Python.",
        )
        comp_assoc = JobListing(
            id=9103,
            company_id=1,
            title="Associate - Compensation & Benefits",
            role_family="Family B: Analytics, Automation and AI",
            status="Available",
            responsibilities="Manage employee payroll, salary benchmarking, and benefits administration.",
            qualifications="3+ years HR compensation experience and Data Quality audits.",
        )
        candidate_text = (
            "Software Engineering Intern pursuing M.Sc. Data Science. "
            "Built FastAPI REST APIs, PostgreSQL reconciliation schemas, Pytest suites, "
            "Pandas/NumPy analytics, and Git CI workflows (1 year internship experience)."
        )
        ranked = rank_top_jobs_for_resume(
            candidate_text, [vp_quant, comp_assoc, analyst_py], top_n=3
        )
        scores_by_title = {r.title: r for r in ranked}
        assert scores_by_title["Analyst - Python Developer"].score > scores_by_title["Quant Model Risk Vice President"].score
        assert scores_by_title["Analyst - Python Developer"].score > scores_by_title["Associate - Compensation & Benefits"].score
        assert scores_by_title["Quant Model Risk Vice President"].score <= 55
        assert all(r.is_ai_score is False and r.score_source == "Quick Estimate" for r in ranked)
    finally:
        db.close()


def test_vault_ai_score_persists_to_dashboard_and_invalidates_on_edit():
    """
    Verify Compare with AI saves per-job fit_score to UserJobAIScore, Dashboard displays it as Green AI Score,
    and editing the Experience Vault reverts stale AI scores back to Orange Quick Estimate.
    """
    init_db()
    client = TestClient(app)

    entry = client.post(
        "/api/vault/entries",
        json={
            "title": "Python Risk Pipeline Intern",
            "detailed_narrative": "Built FastAPI and SQL reconciliation pipelines with Pytest.",
            "skill_tags": ["Python", "FastAPI", "SQL"],
        },
    ).json()

    jobs = client.get("/api/jobs").json()["jobs"]
    target_job = next(j for j in jobs if j["status"] != "JD unavailable")

    fake_ai_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps(
                                {
                                    "summary": "Solid backend fit for this target role.",
                                    "per_job_results": [
                                        {
                                            "job_id": target_job["id"],
                                            "job_title": target_job["title"],
                                            "fit_score": 88,
                                            "summary": "Good match on Python and SQL delivery.",
                                            "strengths_from_history": ["FastAPI and SQL pipelines"],
                                            "gaps": ["More production scale exposure"],
                                            "resume_suggestions": ["Quantify reconciliation throughput."],
                                        }
                                    ],
                                }
                            )
                        }
                    ]
                }
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_ai_payload

    with patch("app.services.vault_service.settings.GEMINI_API_KEY", "test-fake-key"), patch(
        "app.services.vault_service.requests.post", return_value=mock_resp
    ):
        comp = client.post(
            "/api/vault/compare-ai",
            json={"job_ids": [target_job["id"]], "model_mode": "gemini-flash-lite-latest"},
        ).json()
        assert comp["is_llm_powered"] is True
        assert comp["per_job_results"][0]["fit_score"] == 88
        assert comp["per_job_results"][0]["is_ai_score"] is True

    dash = client.get("/api/analytics/dashboard").json()
    ai_match = next((m for m in dash["top_matches"] if m["job_id"] == target_job["id"]), None)
    assert ai_match is not None
    assert ai_match["score"] == 88
    assert ai_match["is_ai_score"] is True
    assert ai_match["score_source"] == "AI Score"

    # Updating Vault narrative invalidates profile hash -> reverts to Quick Estimate
    client.put(
        f"/api/vault/entries/{entry['id']}",
        json={
            "detailed_narrative": "Built FastAPI, SQL, and Docker batch jobs with unit testing."
        },
    )
    dash_after = client.get("/api/analytics/dashboard").json()
    reverted = next((m for m in dash_after["top_matches"] if m["job_id"] == target_job["id"]), None)
    if reverted is not None:
        assert reverted["is_ai_score"] is False
        assert reverted["score_source"] == "Quick Estimate"

    # Clean up
    db = SessionLocal()
    try:
        db.query(UserJobAIScore).filter(UserJobAIScore.job_id == target_job["id"]).delete()
        db.commit()
    finally:
        db.close()
    client.delete(f"/api/vault/entries/{entry['id']}")
