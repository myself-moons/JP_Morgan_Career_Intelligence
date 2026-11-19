import pytest
import httpx
from app.main import app
from app.core.database import SessionLocal
from app.models.entities import JobListing, Company
from app.services.job_sync import sync_jpmc_jobs, html_to_clean_text, is_mumbai_or_goregaon
from app.services.jd_parser import parse_job_sections


# Sample fixtures derived from JP_Morgan_API_Links.docx and live API schema
MOCK_ORACLE_LIST_DATA = {
    "TotalJobsCount": 2,
    "requisitionList": [
        {
            "Id": "999001",
            "Title": "Lead Software Engineer - Core Banking Platforms",
            "PrimaryLocation": "Goregaon, Mumbai, Maharashtra, India",
            "ShortDescriptionStr": "Leading fintech engineering teams in building robust microservices.",
            "workLocation": [
                {
                    "Id": "300000161082797",
                    "Name": "Nirlon Knowledge Park, Goregaon East",
                    "TownOrCity": "Mumbai",
                    "AddressLine1": "Off Western Express Highway",
                }
            ],
            "otherWorkLocations": [],
            "secondaryLocations": [],
        },
        {
            "Id": "999002",
            "Title": "Quantitative Researcher - Markets Execution",
            "PrimaryLocation": "Bengaluru, Karnataka, India",
            "ShortDescriptionStr": "Developing algorithmic pricing models.",
            "workLocation": [{"TownOrCity": "Bengaluru"}],
            "otherWorkLocations": [{"TownOrCity": "Mumbai", "AddressLine1": "Goregaon East"}],
            "secondaryLocations": [],
        },
    ],
    "details": {
        "999001": {
            "ShortDescriptionStr": "Lead fintech engineering team.",
            "ExternalDescriptionStr": """
                <p>JPMorgan Chase & Co. is seeking a Lead Software Engineer.</p>
                <h3>Job Responsibilities</h3>
                <ul>
                    <li>Architect and develop high-throughput transaction pipelines.</li>
                    <li>Mentor junior engineers and drive code reviews.</li>
                </ul>
                <h3>Required qualifications, capabilities and skills</h3>
                <ul>
                    <li>Proficiency in Python, FastAPI, and SQL.</li>
                    <li>Experience with AWS or cloud distributed architectures.</li>
                </ul>
                <h3>Required qualifications, capabilities and skills</h3>
                <ul>
                    <li>Familiarity with Kafka and real-time streaming.</li>
                </ul>
            """
        },
        "999002": {
            "ShortDescriptionStr": "Algorithmic execution models.",
            "ExternalDescriptionStr": """
                <p>Quantitative research role in automated market making.</p>
                <h3>Responsibilities</h3>
                <ul>
                    <li>Design statistical arbitrage and execution algorithms.</li>
                </ul>
                <h3>Qualifications</h3>
                <ul>
                    <li>Strong foundation in Python, NumPy, Pandas, and statistics.</li>
                </ul>
            """
        }
    }
}


@pytest.fixture(scope="module", autouse=True)
def clean_mock_jobs():
    db = SessionLocal()
    try:
        yield
        # Teardown: Remove test mock jobs
        db.query(JobListing).filter(
            JobListing.source_job_id.in_(["999001", "999002"])
        ).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_html_to_clean_text():
    html = "<p>Line 1</p><ul><li>Bullet A</li><li>Bullet B</li></ul>"
    text = html_to_clean_text(html)
    assert "Line 1" in text
    assert "- Bullet A" in text
    assert "- Bullet B" in text


def test_is_mumbai_or_goregaon():
    job1 = {"PrimaryLocation": "Goregaon, Mumbai"}
    assert is_mumbai_or_goregaon(job1) is True

    job2 = {
        "PrimaryLocation": "Bengaluru",
        "otherWorkLocations": [{"TownOrCity": "Mumbai"}]
    }
    assert is_mumbai_or_goregaon(job2) is True

    job3 = {"PrimaryLocation": "New York, NY", "otherWorkLocations": []}
    assert is_mumbai_or_goregaon(job3) is False


def test_parser_quirk_repeated_qualifications():
    """Parser quirk: handle second 'Required qualifications' heading as preferred_qualifications."""
    sample_text = """
    Intro narrative about role.

    Job Responsibilities:
    - Lead architecture design.

    Required qualifications, capabilities and skills:
    - 5+ years with Python.

    Required qualifications, capabilities and skills:
    - Nice to have experience with Kubernetes.
    """
    sections = parse_job_sections(sample_text)
    assert sections["responsibilities"] is not None
    assert "Lead architecture design" in sections["responsibilities"]
    assert sections["qualifications"] is not None
    assert "5+ years with Python" in sections["qualifications"]
    assert sections["preferred_qualifications"] is not None
    assert "Kubernetes" in sections["preferred_qualifications"]


def test_sync_jpmc_jobs_offline():
    """Verify offline sync: adds jobs with status 'Discovered', preserving N=10 available count."""
    db = SessionLocal()
    try:
        # Pre-check available count
        available_before = db.query(JobListing).filter(JobListing.status == "Available").count()

        # Run sync with mock data
        result = sync_jpmc_jobs(db, mock_data=MOCK_ORACLE_LIST_DATA)
        assert result["added"] == 2
        assert result["total_found"] == 2

        # Verify jobs in DB
        job_999001 = db.query(JobListing).filter(JobListing.source_job_id == "999001").first()
        assert job_999001 is not None
        assert job_999001.status == "Discovered"  # Must be Discovered!
        assert job_999001.source_url == "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/999001"
        assert job_999001.external_job_id.startswith("JB-")
        assert "Kafka" in (job_999001.preferred_qualifications or "")

        # Verify available denominator N has not changed
        available_after = db.query(JobListing).filter(JobListing.status == "Available").count()
        assert available_after == available_before

        # Test Stale detection: run sync again with only 999001 (999002 removed)
        partial_mock = {
            "TotalJobsCount": 1,
            "requisitionList": [MOCK_ORACLE_LIST_DATA["requisitionList"][0]],
            "details": {"999001": MOCK_ORACLE_LIST_DATA["details"]["999001"]}
        }
        res2 = sync_jpmc_jobs(db, mock_data=partial_mock)
        assert res2["unchanged"] == 1
        assert res2["stale"] == 1

        job_999002 = db.query(JobListing).filter(JobListing.source_job_id == "999002").first()
        assert job_999002.status == "Stale"

    finally:
        db.close()


@pytest.mark.asyncio
async def test_sync_api_dry_run():
    """Verify POST /api/jobs/sync responds correctly in dry_run mode."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.post("/api/jobs/sync", json={"limit": 10, "dry_run": True})
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "added" in data
        assert "updated" in data
