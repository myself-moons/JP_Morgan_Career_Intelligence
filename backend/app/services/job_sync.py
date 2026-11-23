import re
from datetime import date
from html.parser import HTMLParser
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import quote
import requests
from sqlalchemy.orm import Session

from app.models.entities import JobListing, Company, utcnow
from app.services.jd_parser import parse_job_sections, extract_job_metadata

BASE_URL = "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest"
SITE_NUMBER = "CX_1001"
GOREGAON_LOCATION_ID = "300000081149310"
JOB_PAGE_URL = "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/{id}"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

LIST_EXPAND = (
    "requisitionList.workLocation,requisitionList.otherWorkLocations,"
    "requisitionList.secondaryLocations,flexFieldsFacet.values,"
    "requisitionList.requisitionFlexFields"
)
FACETS = "WORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS%3BLOCATIONS"


class _HTMLToPlainText(HTMLParser):
    BLOCK_TAGS = {"p", "div", "br", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}

    def __init__(self):
        super().__init__()
        self.parts: List[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "li":
            self.parts.append("\n- ")
        elif tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_clean_text(html: str) -> str:
    """Converts HTML snippet to readable plain text with preserved lists and spacing."""
    if not html:
        return ""
    parser = _HTMLToPlainText()
    parser.feed(html)
    text = "".join(parser.parts)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def is_mumbai_or_goregaon(job: Dict[str, Any]) -> bool:
    """
    Checks PrimaryLocation, workLocation, otherWorkLocations, and secondaryLocations
    to determine if the job is available in Mumbai/Goregaon.
    """
    names: List[str] = [job.get("PrimaryLocation", "")]
    for loc in job.get("secondaryLocations") or []:
        if isinstance(loc, dict):
            names.append(loc.get("Name", ""))
    for key in ("workLocation", "otherWorkLocations"):
        for loc in job.get(key) or []:
            if isinstance(loc, dict):
                names.extend([loc.get("TownOrCity", ""), loc.get("AddressLine1", ""), loc.get("Name", "")])
    blob = " ".join(n for n in names if n).lower()
    return "goregaon" in blob or "mumbai" in blob


def get_next_job_code(db: Session) -> str:
    """Calculates the next numerical requisition code (e.g. JB-12)."""
    jobs = db.query(JobListing).all()
    max_num = 0
    for j in jobs:
        if j.external_job_id:
            m = re.match(r"^JB-(\d+)$", j.external_job_id.strip(), re.IGNORECASE)
            if m:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
    return f"JB-{max_num + 1}"


def fetch_oracle_job_list(
    session: requests.Session,
    limit: int = 25,
    offset: int = 0,
    location_id: str = GOREGAON_LOCATION_ID,
    radius: int = 50,
) -> Tuple[List[Dict[str, Any]], int]:
    """Fetches job listings page from Oracle Recruiting Cloud API."""
    finder = (
        f"findReqs;siteNumber={SITE_NUMBER},facetsList={FACETS},"
        f"limit={limit},offset={offset},locationId={location_id},radius={radius},"
        f"radiusUnit=MI,sortBy=DISTANCE_ASC"
    )
    url = f"{BASE_URL}/recruitingCEJobRequisitions?onlyData=true&expand={LIST_EXPAND}&finder={finder}"
    r = session.get(url, headers=DEFAULT_HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    items = data.get("items", [])
    if not items:
        return [], 0
    block = items[0]
    reqs = block.get("requisitionList") or []
    total = block.get("TotalJobsCount", 0)
    return reqs, total


def fetch_oracle_job_detail(session: requests.Session, job_id: str) -> Optional[Dict[str, Any]]:
    """Fetches full job requisition detail by Job ID."""
    url = (
        f"{BASE_URL}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true"
        f"&finder=ById;Id=%22{job_id}%22,siteNumber={SITE_NUMBER}"
    )
    r = session.get(url, headers=DEFAULT_HEADERS, timeout=30)
    if r.status_code != 200:
        return None
    data = r.json()
    items = data.get("items", [])
    if not items:
        return None
    return items[0]


def extract_full_description(detail_data: Dict[str, Any]) -> str:
    """
    Extracts text from Oracle detail payload.
    The actual JD is in ExternalDescriptionStr (HTML).
    """
    parts = []
    short_desc = (detail_data.get("ShortDescriptionStr") or "").strip()
    if short_desc:
        parts.append(f"Summary: {short_desc}")
    body = detail_data.get("ExternalDescriptionStr") or ""
    if body.strip():
        parts.append(html_to_clean_text(body))
    return "\n\n".join(parts)


def sync_jpmc_jobs(
    db: Session,
    limit: int = 25,
    dry_run: bool = False,
    session: Optional[requests.Session] = None,
    mock_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Synchronizes job postings from JPMorgan Chase's public Oracle Cloud endpoints.
    - Preserves existing baseline counts (new jobs enter as 'Discovered').
    - Immutable original_description (BR-12).
    - Deduplicates by source_job_id and title.
    - Flags vanished jobs as 'Stale'.
    """
    req_session = session or requests.Session()
    today_str = date.today().isoformat()

    # Ensure JPMorgan Chase company exists
    company = db.query(Company).filter(Company.name == "JPMorgan Chase").first()
    if not company:
        company = Company(name="JPMorgan Chase")
        db.add(company)
        db.flush()

    # Fetch listings (either from mock_data in tests or from live Oracle API)
    live_jobs: List[Dict[str, Any]] = []
    total_remote_count = 0

    if mock_data:
        live_jobs = mock_data.get("requisitionList", [])
        total_remote_count = mock_data.get("TotalJobsCount", len(live_jobs))
    else:
        try:
            live_jobs, total_remote_count = fetch_oracle_job_list(req_session, limit=limit)
        except Exception as e:
            return {
                "total_found": 0,
                "added": 0,
                "updated": 0,
                "unchanged": 0,
                "stale": 0,
                "jobs": [],
                "message": f"Sync failed: {str(e)}",
            }

    # Filter for Goregaon / Mumbai
    mumbai_jobs = [j for j in live_jobs if is_mumbai_or_goregaon(j)]

    existing_jobs = db.query(JobListing).filter(JobListing.company_id == company.id).all()
    by_source_id: Dict[str, JobListing] = {
        j.source_job_id: j for j in existing_jobs if j.source_job_id
    }
    by_title_lower: Dict[str, JobListing] = {
        j.title.strip().lower(): j for j in existing_jobs if j.title
    }

    added_jobs: List[JobListing] = []
    updated_jobs: List[JobListing] = []
    unchanged_jobs: List[JobListing] = []
    seen_source_ids: set = set()

    for job_summary in mumbai_jobs:
        job_id = str(job_summary.get("Id", "")).strip()
        if not job_id:
            continue
        seen_source_ids.add(job_id)

        title = (job_summary.get("Title") or "Untitled Job").strip()
        norm_title = title.lower()
        public_url = JOB_PAGE_URL.format(id=job_id)

        # Check existing by source_job_id or title
        existing = by_source_id.get(job_id) or by_title_lower.get(norm_title)

        if existing:
            # Backfill source_job_id and source_url if missing
            changed = False
            if not existing.source_job_id:
                existing.source_job_id = job_id
                by_source_id[job_id] = existing
                changed = True
            if not existing.source_url:
                existing.source_url = public_url
                changed = True
            if not existing.capture_date:
                posted_date_raw = job_summary.get("PostedDate")
                if posted_date_raw:
                    existing.capture_date = str(posted_date_raw)[:10]
                    changed = True
            if existing.status == "Stale":
                existing.status = "Discovered"
                changed = True

            if changed:
                existing.updated_at = utcnow()
                updated_jobs.append(existing)
            else:
                unchanged_jobs.append(existing)
            continue

        # New Job: Fetch detail description
        desc_text = ""
        if mock_data and "details" in mock_data and job_id in mock_data["details"]:
            desc_text = extract_full_description(mock_data["details"][job_id])
        elif not mock_data:
            try:
                detail = fetch_oracle_job_detail(req_session, job_id)
                if detail:
                    desc_text = extract_full_description(detail)
            except Exception as e:
                print(f"Error fetching detail for job {job_id}: {e}")

        if not desc_text:
            desc_text = job_summary.get("ShortDescriptionStr") or title

        # Parse sections
        sections = parse_job_sections(desc_text)
        metadata = extract_job_metadata(desc_text, filename=None)
        inferred_family = metadata.get("role_family") or "Family B: Analytics and Automation Solutions"

        posted_date_raw = job_summary.get("PostedDate") or (detail.get("ExternalPostedStartDate") if 'detail' in locals() and detail else None)
        job_posted_date = str(posted_date_raw)[:10] if posted_date_raw else today_str

        next_code = get_next_job_code(db)

        new_job = JobListing(
            company_id=company.id,
            title=title,
            external_job_id=next_code,
            source_job_id=job_id,
            location="Goregaon, Mumbai",
            source_url=public_url,
            capture_date=job_posted_date,
            role_family=inferred_family,
            status="Discovered",  # Discovered ensures N=10 available count is unchanged
            original_description=desc_text,
            summary=sections.get("summary"),
            responsibilities=sections.get("responsibilities"),
            qualifications=sections.get("qualifications"),
            preferred_qualifications=sections.get("preferred_qualifications"),
            context_note=(
                f"Discovered via JPMC Careers live sync on {today_str}. "
                f"Inferred role family: {inferred_family}."
            ),
        )

        db.add(new_job)
        db.flush()
        by_source_id[job_id] = new_job
        by_title_lower[norm_title] = new_job
        added_jobs.append(new_job)

    # Stale detection: Check jobs previously synced with source_job_id that are now missing from feed
    stale_jobs: List[JobListing] = []
    for s_id, job_rec in by_source_id.items():
        if s_id not in seen_source_ids:
            if job_rec.status in ("Discovered", "Available"):
                job_rec.status = "Stale"
                job_rec.context_note = (
                    f"{job_rec.context_note or ''}\n[Sync Note] Requisition no longer active in careers feed as of {today_str}."
                ).strip()
                job_rec.updated_at = utcnow()
                stale_jobs.append(job_rec)

    if not dry_run:
        db.commit()
    else:
        db.rollback()

    all_affected = added_jobs + updated_jobs + unchanged_jobs

    return {
        "total_found": len(mumbai_jobs),
        "total_remote": total_remote_count,
        "added": len(added_jobs),
        "updated": len(updated_jobs),
        "unchanged": len(unchanged_jobs),
        "stale": len(stale_jobs),
        "jobs": all_affected,
        "message": (
            f"Sync complete: {len(added_jobs)} new jobs discovered, "
            f"{len(updated_jobs)} backfilled/updated, {len(unchanged_jobs)} verified unchanged, "
            f"{len(stale_jobs)} flagged as stale."
        ),
    }
