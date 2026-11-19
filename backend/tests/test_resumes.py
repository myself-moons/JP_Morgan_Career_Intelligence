import pytest
import httpx
from app.main import app
from app.core.database import SessionLocal
from app.services.resume_service import seed_resumes, get_all_resumes


@pytest.fixture(scope="module", autouse=True)
def setup_resumes():
    db = SessionLocal()
    try:
        seed_resumes(db)
    finally:
        db.close()
    yield


@pytest.mark.asyncio
async def test_list_resumes():
    """Verify that GET /api/resumes lists all available resume documents."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/resumes")
        assert response.status_code == 200
        resumes = response.json()
        assert len(resumes) >= 2
        names = [r["name"] for r in resumes]
        assert any("Manthan Fintech Resume" in n for n in names)
        assert any("Pretty Resume" in n for n in names)


@pytest.mark.asyncio
async def test_get_active_resume_and_activate():
    """Verify that an active resume can be fetched and switched."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        # Get active
        response = await client.get("/api/resumes/active")
        assert response.status_code == 200
        active_resume = response.json()
        assert active_resume is not None
        assert active_resume["is_active"] == 1

        # List all to pick another
        list_resp = await client.get("/api/resumes")
        all_resumes = list_resp.json()
        target = next((r for r in all_resumes if r["id"] != active_resume["id"]), None)
        if target:
            # Activate target
            act_resp = await client.post(f"/api/resumes/{target['id']}/activate")
            assert act_resp.status_code == 200
            assert act_resp.json()["is_active"] == 1

            # Verify active changed
            new_active_resp = await client.get("/api/resumes/active")
            assert new_active_resp.json()["id"] == target["id"]

            # Switch back to original
            await client.post(f"/api/resumes/{active_resume['id']}/activate")


@pytest.mark.asyncio
async def test_stream_resume_pdf():
    """Verify that GET /api/resumes/{id}/pdf streams a valid PDF."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        list_resp = await client.get("/api/resumes")
        resumes = list_resp.json()
        pdf_resume = next((r for r in resumes if r.get("pdf_filename")), None)
        assert pdf_resume is not None

        pdf_resp = await client.get(f"/api/resumes/{pdf_resume['id']}/pdf")
        assert pdf_resp.status_code == 200
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert len(pdf_resp.content) > 1000


@pytest.mark.asyncio
async def test_update_latex_and_export():
    """Verify that LaTeX source can be updated and exported."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        list_resp = await client.get("/api/resumes")
        resumes = list_resp.json()
        tex_resume = next((r for r in resumes if r.get("latex_source")), None)
        assert tex_resume is not None

        original_latex = tex_resume["latex_source"]
        test_latex = original_latex + "\n% JCI Automated Test Comment"

        update_resp = await client.put(
            f"/api/resumes/{tex_resume['id']}/latex",
            json={"latex_source": test_latex}
        )
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert "% JCI Automated Test Comment" in data["latex_source"]

        # Test export
        export_resp = await client.get(f"/api/resumes/{tex_resume['id']}/export-tex")
        assert export_resp.status_code == 200
        assert "% JCI Automated Test Comment" in export_resp.text

        # Restore original
        await client.put(
            f"/api/resumes/{tex_resume['id']}/latex",
            json={"latex_source": original_latex}
        )


@pytest.mark.asyncio
async def test_top_matches_endpoint():
    """Verify GET /api/resumes/active/top-matches returns top 5 ranked jobs."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        resp = await client.get("/api/resumes/active/top-matches")
        assert resp.status_code == 200
        data = resp.json()
        assert "active_resume_name" in data
        assert "top_matches" in data
        assert len(data["top_matches"]) <= 5
        if data["top_matches"]:
            top = data["top_matches"][0]
            assert "score" in top
            assert "matched_skills" in top
            assert "readiness_verdict" in top


@pytest.mark.asyncio
async def test_explainable_match_endpoint():
    """Verify POST /api/resumes/{resume_id}/match-job/{job_id} generates explainable evaluation."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        # Get active resume
        act_resp = await client.get("/api/resumes/active")
        assert act_resp.status_code == 200
        resume_id = act_resp.json()["id"]

        # Get first job
        jobs_resp = await client.get("/api/jobs")
        assert jobs_resp.status_code == 200
        job_id = jobs_resp.json()["jobs"][0]["id"]

        eval_resp = await client.post(f"/api/resumes/{resume_id}/match-job/{job_id}")
        assert eval_resp.status_code == 200
        eval_data = eval_resp.json()
        assert "overall_score" in eval_data
        assert "readiness_verdict" in eval_data
        assert "summary_reasoning" in eval_data
        assert "dimensions" in eval_data
        assert "verified_matched_skills" in eval_data
        assert "critical_missing_skills" in eval_data
        assert "actionable_latex_recommendations" in eval_data

        # Verify persistent caching in SQLite: GET cached evaluation
        get_cached = await client.get(f"/api/resumes/{resume_id}/match-job/{job_id}")
        assert get_cached.status_code == 200
        cached_data = get_cached.json()
        assert cached_data is not None
        assert cached_data["is_cached"] is True
        assert cached_data["overall_score"] == eval_data["overall_score"]

        # Calling POST again without force_refresh loads from cache (0 API calls)
        repeat_post = await client.post(f"/api/resumes/{resume_id}/match-job/{job_id}")
        assert repeat_post.status_code == 200
        assert repeat_post.json()["is_cached"] is True

