import sys
import re
from pathlib import Path
from sqlalchemy.orm import Session

# Ensure backend root is on sys.path
CURRENT_DIR = Path(__file__).resolve().parent.parent.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from app.core.config import settings
from app.core.database import engine, SessionLocal, Base, init_db
from app.models.entities import Company, JobListing
from app.services.jd_parser import parse_job_sections


def find_job_listings_file() -> Path:
    candidates = [
        settings.BASE_DIR / ".docs" / "Job_Listings.md",
        settings.BASE_DIR / "Job_Listings.md",
        Path(".docs/Job_Listings.md"),
        Path("Job_Listings.md"),
    ]
    for path in candidates:
        if path.exists():
            return path.resolve()
    raise FileNotFoundError("Could not find Job_Listings.md research dataset.")


def parse_job_listings_md(file_path: Path):
    text = file_path.read_text(encoding="utf-8")
    chunks = re.split(r"\n## (\d+)\.\s*", text)
    jobs_data = []

    for i in range(1, len(chunks), 2):
        num_str = chunks[i]
        num = int(num_str)
        body = chunks[i + 1]
        raw_lines = body.splitlines()
        title = raw_lines[0].strip()

        fam_match = re.search(r"\*\*Role Family:\*\*\s*(.+)", body)
        status_match = re.search(r"\*\*Status:\*\*\s*`?([^`\r\n]+)`?", body)
        note_match = re.search(r"\*\*Context Note:\*\*\s*(.+)", body)

        role_family = (
            fam_match.group(1).replace("  ", "").strip()
            if fam_match
            else "Family A: Data Management, Quality and Governance"
        )
        status = (
            status_match.group(1).replace("`", "").strip()
            if status_match
            else "Available"
        )
        context_note = note_match.group(1).strip() if note_match else None

        # Clean description by extracting everything non-blockquote
        desc_lines = [l for l in raw_lines[1:] if not l.strip().startswith(">")]
        desc = "\n".join(desc_lines).strip()
        if status.lower() == "jd unavailable":
            desc = None

        # Infer location
        title_lower = title.lower()
        if "santa cruz" in title_lower:
            location = "Santa Cruz, Mumbai"
        elif "goregaon" in title_lower:
            location = "Goregaon, Mumbai"
        else:
            location = "Mumbai"

        # Parse structured sections from description
        sections = parse_job_sections(desc) if desc else {}

        jobs_data.append(
            {
                "num": num,
                "title": title,
                "external_job_id": f"JPMC-REQ-{num:02d}",
                "role_family": role_family,
                "status": status,
                "location": location,
                "context_note": context_note,
                "original_description": desc,
                "summary": sections.get("summary"),
                "responsibilities": sections.get("responsibilities"),
                "qualifications": sections.get("qualifications"),
                "preferred_qualifications": sections.get("preferred_qualifications"),
                "capture_date": "2026-11-17",
            }
        )

    return jobs_data


def seed_baseline_jobs(db: Session = None) -> int:
    """Populates SQLite database with the 11 baseline JPMorgan Chase jobs."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        # Ensure database tables and columns exist
        init_db()

        # Ensure default company exists
        company = (
            db.query(Company)
            .filter(Company.name == "JPMorgan Chase")
            .first()
        )
        if not company:
            company = Company(name="JPMorgan Chase")
            db.add(company)
            db.commit()
            db.refresh(company)

        # Parse listings
        listings_file = find_job_listings_file()
        jobs_data = parse_job_listings_md(listings_file)

        seeded_count = 0
        for item in jobs_data:
            existing = (
                db.query(JobListing)
                .filter(
                    JobListing.company_id == company.id,
                    JobListing.external_job_id == item["external_job_id"],
                )
                .first()
            )

            if existing:
                # Update existing record
                existing.title = item["title"]
                existing.role_family = item["role_family"]
                existing.status = item["status"]
                existing.location = item["location"]
                existing.context_note = item["context_note"]
                existing.original_description = item["original_description"]
                existing.summary = item["summary"]
                existing.responsibilities = item["responsibilities"]
                existing.qualifications = item["qualifications"]
                existing.preferred_qualifications = item["preferred_qualifications"]
                existing.capture_date = item["capture_date"]
            else:
                # Insert new record
                new_job = JobListing(
                    company_id=company.id,
                    title=item["title"],
                    external_job_id=item["external_job_id"],
                    role_family=item["role_family"],
                    status=item["status"],
                    location=item["location"],
                    context_note=item["context_note"],
                    original_description=item["original_description"],
                    summary=item["summary"],
                    responsibilities=item["responsibilities"],
                    qualifications=item["qualifications"],
                    preferred_qualifications=item["preferred_qualifications"],
                    capture_date=item["capture_date"],
                )
                db.add(new_job)
            seeded_count += 1

        db.commit()
        return seeded_count
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    count = seed_baseline_jobs()
    print(f"Successfully seeded {count} baseline JPMorgan Chase job listings into SQLite.")
