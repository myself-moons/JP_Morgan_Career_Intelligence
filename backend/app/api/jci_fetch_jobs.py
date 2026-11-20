#!/usr/bin/env python3
"""
JCI job fetcher: pulls JPMorgan Chase job listings from the public Oracle
Recruiting Cloud JSON endpoints that the careers site itself uses.

Two steps:
  1. LIST   recruitingCEJobRequisitions        -> job IDs + basic fields (paged)
  2. DETAIL recruitingCEJobRequisitionDetails  -> full description for each ID

Usage examples:
  python jci_fetch_jobs.py                          # Goregaon area, all jobs
  python jci_fetch_jobs.py --keyword data           # keyword search
  python jci_fetch_jobs.py --keyword "data quality" --max-jobs 20
  python jci_fetch_jobs.py --no-details             # list only (fast test)

Output (under ./jci_data by default):
  raw/<jobid>.json    full detail response, untouched (source of truth)
  text/<jobid>.txt    clean readable text of the job description
  index.csv           one row per job (id, title, location, posted date, url)
  removed.txt         IDs that were in the previous index but are gone now

Personal use only. Keep the delay polite and respect the site's terms.
"""
import argparse
import csv
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote

import requests

BASE = "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest"
SITE = "CX_1001"
GOREGAON_LOCATION_ID = "300000081149310"  # from your Network tab
JOB_URL = "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/{id}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (JCI personal research script)",
    "Accept": "application/json",
}

LIST_EXPAND = (
    "requisitionList.workLocation,requisitionList.otherWorkLocations,"
    "requisitionList.secondaryLocations,flexFieldsFacet.values,"
    "requisitionList.requisitionFlexFields"
)
FACETS = "WORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS%3BLOCATIONS"


# ---------- HTML -> text ----------
class _TextExtractor(HTMLParser):
    BLOCK = {"p", "div", "br", "li", "ul", "ol", "h1", "h2", "h3", "h4", "tr"}

    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "li":
            self.parts.append("\n- ")
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_text(html: str) -> str:
    p = _TextExtractor()
    p.feed(html)
    text = "".join(p.parts)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


# ---------- HTTP ----------
def get_json(session, url, retries=3):
    for attempt in range(1, retries + 1):
        try:
            r = session.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r.json()
            print(f"  HTTP {r.status_code} for {url[:120]}...", file=sys.stderr)
        except requests.RequestException as e:
            print(f"  request error: {e}", file=sys.stderr)
        time.sleep(2 * attempt)
    return None


def list_url(offset, limit, keyword, location_id, radius):
    finder = f"findReqs;siteNumber={SITE},facetsList={FACETS},limit={limit},offset={offset}"
    if keyword:
        finder += f",keyword={quote(keyword)}"
    if location_id:
        finder += f",locationId={location_id},radius={radius},radiusUnit=MI,sortBy=DISTANCE_ASC"
    else:
        finder += ",sortBy=POSTING_DATES_DESC"
    return f"{BASE}/recruitingCEJobRequisitions?onlyData=true&expand={LIST_EXPAND}&finder={finder}"


def detail_url(job_id):
    return (
        f"{BASE}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true"
        f"&finder=ById;Id=%22{job_id}%22,siteNumber={SITE}"
    )


# ---------- Main steps ----------
def fetch_list(session, keyword, location_id, radius, limit, max_jobs, delay):
    jobs, offset = [], 0
    while True:
        data = get_json(session, list_url(offset, limit, keyword, location_id, radius))
        if not data or not data.get("items"):
            break
        block = data["items"][0]
        reqs = block.get("requisitionList") or []
        total = block.get("TotalJobsCount", 0)
        jobs.extend(reqs)
        print(f"  list: got {len(reqs)} (running {len(jobs)} / total {total})")
        offset += limit
        if not reqs or offset >= total or (max_jobs and len(jobs) >= max_jobs):
            break
        time.sleep(delay)
    return jobs[:max_jobs] if max_jobs else jobs


def description_text(detail_json):
    """Real detail payload (confirmed): the JD lives in ExternalDescriptionStr (HTML).
    ExternalResponsibilitiesStr / ExternalQualificationsStr are empty strings, and
    Corporate/OrganizationDescriptionStr are company boilerplate, so we skip those."""
    items = (detail_json or {}).get("items") or []
    if not items:
        return ""
    item = items[0]
    parts = []
    short = (item.get("ShortDescriptionStr") or "").strip()
    if short:
        parts.append(f"Summary: {short}")
    body = item.get("ExternalDescriptionStr") or ""
    if body.strip():
        parts.append(html_to_text(body))
    return "\n\n".join(parts)


def is_goregaon_or_mumbai(job):
    """A job can list Bengaluru as primary but also carry Goregaon in
    otherWorkLocations/secondaryLocations, which is why the radius search returns it."""
    names = [job.get("PrimaryLocation", "")]
    names += [l.get("Name", "") for l in job.get("secondaryLocations") or []]
    for key in ("workLocation", "otherWorkLocations"):
        for l in job.get(key) or []:
            names += [l.get("TownOrCity", ""), l.get("AddressLine1", "")]
    blob = " ".join(n for n in names if n).lower()
    return "goregaon" in blob or "mumbai" in blob


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keyword", default="")
    ap.add_argument("--location-id", default=GOREGAON_LOCATION_ID,
                    help="Oracle locationId; pass '' to search all locations")
    ap.add_argument("--radius", type=int, default=50)
    ap.add_argument("--limit", type=int, default=25, help="page size")
    ap.add_argument("--max-jobs", type=int, default=0, help="0 = no cap")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    ap.add_argument("--out", default="jci_data")
    ap.add_argument("--no-details", action="store_true")
    ap.add_argument("--mumbai-only", action="store_true",
                    help="keep only jobs with Goregaon/Mumbai in any of their locations")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "raw").mkdir(parents=True, exist_ok=True)
    (out / "text").mkdir(parents=True, exist_ok=True)
    index_path = out / "index.csv"

    previous_ids = set()
    if index_path.exists():
        with index_path.open(newline="", encoding="utf-8") as f:
            previous_ids = {row["id"] for row in csv.DictReader(f)}

    s = requests.Session()
    print("Fetching job list...")
    jobs = fetch_list(s, args.keyword, args.location_id, args.radius,
                      args.limit, args.max_jobs, args.delay)
    if not jobs:
        print("No jobs returned. Check the URL pattern / network.", file=sys.stderr)
        sys.exit(1)

    if args.mumbai_only:
        before = len(jobs)
        jobs = [j for j in jobs if is_goregaon_or_mumbai(j)]
        print(f"Location filter kept {len(jobs)} of {before} jobs")

    rows = []
    for i, j in enumerate(jobs, 1):
        job_id = str(j.get("Id"))
        row = {
            "id": job_id,
            "title": j.get("Title", ""),
            "location": j.get("PrimaryLocation", ""),
            "posted_date": j.get("PostedDate", ""),
            "url": JOB_URL.format(id=job_id),
        }
        rows.append(row)
        if args.no_details:
            continue
        raw_path = out / "raw" / f"{job_id}.json"
        if raw_path.exists():
            continue  # already downloaded; delete the file to refresh
        print(f"[{i}/{len(jobs)}] detail {job_id} - {row['title']}")
        detail = get_json(s, detail_url(job_id))
        if detail is None:
            print(f"  skipped {job_id} (no response)", file=sys.stderr)
            continue
        raw_path.write_text(json.dumps(detail, indent=2, ensure_ascii=False), encoding="utf-8")
        header = f"{row['title']}\n{row['location']}\nPosted: {row['posted_date']}\n{row['url']}\n\n"
        (out / "text" / f"{job_id}.txt").write_text(
            header + description_text(detail), encoding="utf-8")
        time.sleep(args.delay)

    with index_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "title", "location", "posted_date", "url"])
        w.writeheader()
        w.writerows(rows)

    current_ids = {r["id"] for r in rows}
    removed = sorted(previous_ids - current_ids)
    if removed:
        (out / "removed.txt").write_text("\n".join(removed), encoding="utf-8")
        print(f"{len(removed)} job(s) from the previous run are no longer listed (see removed.txt)")
    print(f"Done. {len(rows)} jobs indexed in {index_path}")


if __name__ == "__main__":
    main()
