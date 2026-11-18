import io
import sys
import uuid
from pathlib import Path
import pytest
import httpx
import pymupdf
import docx

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.core.database import SessionLocal
from app.models.entities import JobListing, Company
from app.core.seed import seed_baseline_jobs


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Ensure baseline jobs are seeded once before running ingestion tests."""
    db = SessionLocal()
    try:
        seed_baseline_jobs(db)
        yield
        # Teardown: Clean up test records
        db.query(JobListing).filter(JobListing.external_job_id.like("TEST-%")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


@pytest.mark.asyncio
async def test_tc01_paste_valid_job():
    """TC-01: Paste a valid job description and verify persistence."""
    unique_id = f"TEST-TC01-{uuid.uuid4().hex[:6]}"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        payload = {
            "title": "Software Engineer - Payments Technology",
            "company_name": "JPMorgan Chase",
            "external_job_id": unique_id,
            "location": "Goregaon, Mumbai",
            "source_url": "https://careers.jpmorgan.com/test-01",
            "capture_date": "2026-11-18",
            "role_family": "Family A: Data Management, Quality and Governance",
            "status": "Available",
            "original_description": "We are seeking a Software Engineer to design high-throughput microservices using Python, FastAPI, and PostgreSQL.",
            "context_note": "Test paste entry",
        }
        response = await client.post("/api/jobs", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == payload["title"]
        assert data["external_job_id"] == unique_id
        assert "microservices using Python" in data["original_description"]
        assert data["status"] == "Available"


@pytest.mark.asyncio
async def test_tc02_upload_text_based_pdf():
    """TC-02: Upload a text-based PDF, verify text extraction and preview."""
    doc = pymupdf.open()
    page = doc.new_page()
    sample_text = (
        "JPMorgan Chase & Co.\n"
        "Position: Lead Data Platform Engineer\n"
        "Responsibilities: Architect real-time analytics with Kafka, Spark, and AWS.\n"
        "Requirements: 5+ years experience with Distributed Systems and Python."
    )
    page.insert_text((50, 72), sample_text)
    pdf_bytes = doc.tobytes()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        files = {"file": ("sample_job.pdf", pdf_bytes, "application/pdf")}
        response = await client.post("/api/jobs/upload", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "sample_job.pdf"
        assert "Lead Data Platform Engineer" in data["extracted_text"]
        assert "Kafka, Spark, and AWS" in data["extracted_text"]
        assert data["char_count"] > 100


@pytest.mark.asyncio
async def test_tc03_upload_text_based_docx():
    """TC-03: Upload a text-based DOCX, verify text extraction."""
    doc = docx.Document()
    doc.add_heading("JPMorgan Chase Risk Analytics Analyst", level=1)
    doc.add_paragraph("Qualifications: Bachelor's in Finance or Economics.")
    doc.add_paragraph("Technical skills: Advanced SQL, Python, Excel modeling.")
    bio = io.BytesIO()
    doc.save(bio)
    docx_bytes = bio.getvalue()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        files = {"file": ("sample_job.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        response = await client.post("/api/jobs/upload", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "sample_job.docx"
        assert "Risk Analytics Analyst" in data["extracted_text"]
        assert "Advanced SQL, Python" in data["extracted_text"]


@pytest.mark.asyncio
async def test_tc04_upload_unsupported_file_type():
    """TC-04: Upload unsupported file type and verify rejection."""
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        files = {"file": ("malicious_payload.exe", fake_exe, "application/x-msdownload")}
        response = await client.post("/api/jobs/upload", files=files)
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_tc05_upload_empty_pdf():
    """TC-05: Upload empty or image-only PDF with no text layer and verify warning."""
    doc = pymupdf.open()
    doc.new_page()
    blank_pdf = doc.tobytes()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        files = {"file": ("empty_scanned.pdf", blank_pdf, "application/pdf")}
        response = await client.post("/api/jobs/upload", files=files)
        assert response.status_code == 400
        assert "no extractable text layer" in response.json()["detail"]


@pytest.mark.asyncio
async def test_tc06_duplicate_external_job_id():
    """TC-06: Add duplicate external job ID and verify 409 Conflict rejection."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        payload = {
            "title": "Duplicate Target Listing",
            "company_name": "JPMorgan Chase",
            "external_job_id": "JPMC-REQ-01",  # Baseline job ID
            "role_family": "Family A: Data Management, Quality and Governance",
            "status": "Available",
            "original_description": "Duplicate test description.",
        }
        response = await client.post("/api/jobs", json=payload)
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_tc07_jd_unavailable_listing():
    """TC-07: Ingest listing with status 'JD unavailable' and verify denominator handling."""
    unique_id = f"TEST-TC07-{uuid.uuid4().hex[:6]}"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        payload = {
            "title": "Unavailable Archival Role",
            "company_name": "JPMorgan Chase",
            "external_job_id": unique_id,
            "role_family": "Family B: Analytics, Automation and AI",
            "status": "JD unavailable",
            "original_description": None,
            "context_note": "Posting expired before full JD was captured.",
        }
        response = await client.post("/api/jobs", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "JD unavailable"
        assert data["original_description"] is None

        # Check /api/jobs denominator
        list_res = await client.get("/api/jobs")
        assert list_res.status_code == 200
        list_data = list_res.json()
        available_in_list = [j for j in list_data["jobs"] if j["status"].lower() == "available"]
        assert list_data["analysable_count"] == len(available_in_list)
        assert list_data["total_count"] > list_data["analysable_count"]


@pytest.mark.asyncio
async def test_baseline_dataset_11_jobs():
    """Verify all 11 baseline JPMorgan Chase jobs are present and correctly classified."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/jobs")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 11

        jobs_by_req = {j["external_job_id"]: j for j in data["jobs"] if j["external_job_id"]}
        assert "JPMC-REQ-06" in jobs_by_req
        job6 = jobs_by_req["JPMC-REQ-06"]
        assert job6["status"] == "JD unavailable"
        assert "Data Governance" in job6["title"]

        assert "JPMC-REQ-07" in jobs_by_req
        job7 = jobs_by_req["JPMC-REQ-07"]
        assert job7["status"] == "Available"
        assert "Reference Data" in job7["title"]


def test_tc17_sqlite_persistence_reload():
    """TC-17: Verify stored SQLite records persist intact across session reload."""
    db = SessionLocal()
    try:
        jobs = db.query(JobListing).all()
        assert len(jobs) >= 11

        for job in jobs[:5]:
            assert job.company is not None
            assert job.company.name == "JPMorgan Chase"
            assert job.created_at is not None
            # Also verify structured sections populated by seeder
            if job.status == "Available":
                assert job.responsibilities is not None
                assert job.qualifications is not None
    finally:
        db.close()


@pytest.mark.asyncio
async def test_auto_increment_next_code():
    """Verify GET /api/jobs/next-code returns auto-incremented numerical code (JB-1, JB-2, etc.)."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/api/jobs/next-code")
        assert response.status_code == 200
        data = response.json()
        assert "next_code" in data
        assert data["next_code"].startswith("JB-")
        num = int(data["next_code"].split("-")[1])
        assert num >= 1


@pytest.mark.asyncio
async def test_parse_raw_text_and_sections():
    """Verify POST /api/jobs/parse-text extracts metadata, sections, and warnings."""
    sample_text = """
    NORTHSTAR DIGITAL SOLUTIONS | CAREERS
    Full Stack Software Developer
    Company: Northstar Digital Solutions
    Location: Goregaon, Mumbai

    Job Responsibilities:
    - Build scalable React and FastAPI applications.
    - Write robust unit tests.

    Required Qualifications:
    - 3+ years experience with Python and TypeScript.
    - Strong SQL capabilities.
    """
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/api/jobs/parse-text",
            json={"text": sample_text, "filename": "sample.txt"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "Full Stack Software Developer" in data["title"]
        assert "Northstar" in data["company_name"]
        assert "Goregaon, Mumbai" in data["location"]
        assert "Family B" in data["role_family"]
        assert data["responsibilities"] is not None
        assert "Build scalable React" in data["responsibilities"]
        assert data["qualifications"] is not None
        assert "3+ years experience" in data["qualifications"]
        # Preferred qualifications was absent, so warning should be present
        assert "preferred_qualifications" in data["warnings"]

