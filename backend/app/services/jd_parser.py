import re
from typing import Dict, Any, Optional, Tuple, List


# Regex patterns for section boundaries
RESPONSIBILITIES_PATTERNS = [
    r"(?i)(?:^|\n)\s*(?:###?\s*)?(?:[0-9]+\.\s*)?(?:job\s+)?(?:key\s+|core\s+|essential\s+)?(?:responsibilities|duties|functions|accountabilities|what\s+you(?:'ll|\s+will)\s+do|in\s+this\s+role)\b[^\n]*",
]

QUALIFICATIONS_PATTERNS = [
    r"(?i)(?:^|\n)\s*(?:###?\s*)?(?:[0-9]+\.\s*)?(?:required|basic|minimum|must\s+have)?\s*(?:qualifications|requirements|capabilities(?:\s*,\s*capabilities)?\s*(?:and|&)?\s*skills|skills(?:\s+and\s+experience)?|eligibility|competencies|who\s+you\s+are|what\s+we(?:'re|\s+are)\s+looking\s+for)\b[^\n]*",
]

PREFERRED_PATTERNS = [
    r"(?i)(?:^|\n)\s*(?:###?\s*)?(?:[0-9]+\.\s*)?(?:preferred|desired|nice\s+to\s+have|bonus|additional)\s*(?:qualifications|capabilities(?:\s*,\s*capabilities)?\s*(?:and|&)?\s*skills|skills|experience)\b[^\n]*",
]

TITLE_KEYWORDS = [
    "developer", "engineer", "associate", "analyst", "specialist",
    "manager", "lead", "architect", "officer", "vice president",
    "director", "consultant", "scientist", "administrator"
]

FAMILY_A_KEYWORDS = [
    "data management", "data governance", "data quality", "metadata",
    "collibra", "informatica", "lineage", "stewardship", "data catalog",
    "data risk", "cdo", "chief data office", "reference data", "data stewardship"
]

FAMILY_B_KEYWORDS = [
    "analytics", "automation", "ai", "artificial intelligence", "machine learning",
    "full stack", "developer", "software engineer", "python", "alteryx", "tableau",
    "power bi", "data science", "nlp", "llm", "backend", "frontend", "engineering",
    "sql", "etl", "data pipeline"
]

FAMILY_C_KEYWORDS = [
    "finance", "credit", "credit risk", "underwriting", "portfolio",
    "banking", "corporate sales", "treasury", "accounting", "payment",
    "investment banking", "markets", "liquidity", "capital", "lending"
]


def _find_headings(text: str) -> List[Tuple[int, int, str, str]]:
    """
    Finds section heading locations (start_idx, end_idx, section_type, heading_text).
    Sorted by start index in document.
    """
    headings: List[Tuple[int, int, str, str]] = []

    # 1. Preferred Qualifications (check first to avoid clash with general qualifications)
    for pat in PREFERRED_PATTERNS:
        for m in re.finditer(pat, text):
            headings.append((m.start(), m.end(), "preferred_qualifications", m.group(0).strip()))

    # 2. Responsibilities
    for pat in RESPONSIBILITIES_PATTERNS:
        for m in re.finditer(pat, text):
            # Ensure not already captured
            if not any(abs(m.start() - h[0]) < 10 for h in headings):
                headings.append((m.start(), m.end(), "responsibilities", m.group(0).strip()))

    # 3. Qualifications (Required)
    for pat in QUALIFICATIONS_PATTERNS:
        for m in re.finditer(pat, text):
            # Skip if this matched a preferred heading
            if any(abs(m.start() - h[0]) < 15 for h in headings if h[2] == "preferred_qualifications"):
                continue
            if not any(abs(m.start() - h[0]) < 10 for h in headings):
                headings.append((m.start(), m.end(), "qualifications", m.group(0).strip()))

    headings.sort(key=lambda x: x[0])
    return headings


def parse_job_sections(text: str) -> Dict[str, Optional[str]]:
    """
    Splits job description text into structured sections:
    - summary: Introductory narrative before the first structured section.
    - responsibilities: What the candidate will do.
    - qualifications: Required skills, capabilities, education, and experience.
    - preferred_qualifications: Nice-to-have or preferred capabilities.
    """
    if not text or not text.strip():
        return {
            "summary": None,
            "responsibilities": None,
            "qualifications": None,
            "preferred_qualifications": None,
        }

    clean_text = text.replace("\r\n", "\n").strip()
    headings = _find_headings(clean_text)

    if not headings:
        # No headings detected: entire text is treated as summary/description
        return {
            "summary": clean_text,
            "responsibilities": None,
            "qualifications": None,
            "preferred_qualifications": None,
        }

    # Extract summary (everything before the first heading)
    first_heading_start = headings[0][0]
    summary_raw = clean_text[:first_heading_start].strip()
    # Clean out potential metadata lines in summary
    summary = summary_raw if summary_raw else None

    sections: Dict[str, Optional[str]] = {
        "summary": summary,
        "responsibilities": None,
        "qualifications": None,
        "preferred_qualifications": None,
    }

    for i, (start, end, sec_type, heading_text) in enumerate(headings):
        next_start = headings[i + 1][0] if i + 1 < len(headings) else len(clean_text)
        content = clean_text[end:next_start].strip()
        # Clean leading colon or dashes if any
        content = re.sub(r"^[ \t]*:?[ \t]*\n", "", content).strip()
        if content:
            if sections[sec_type]:
                sections[sec_type] += "\n\n" + content
            else:
                sections[sec_type] = content

    return sections


def extract_job_metadata(text: str, filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyzes job description text to extract metadata:
    - title
    - company_name
    - location
    - role_family
    - status
    - requisition_id (if found in text)
    - sections (summary, responsibilities, qualifications, preferred_qualifications)
    - warnings (dict of field -> warning message when inference is uncertain)
    """
    if not text:
        text = ""

    clean_text = text.replace("\r\n", "\n")
    lines = [line.strip() for line in clean_text.splitlines() if line.strip()]

    warnings: Dict[str, str] = {}

    # 1. Title Extraction
    title = None
    # Check explicit label
    title_match = re.search(r"(?i)(?:job\s+)?title\s*[:\-]\s*(.+)", clean_text)
    if title_match:
        cand = title_match.group(1).strip()
        if len(cand) > 3 and not cand.lower().startswith("sample"):
            title = cand

    if not title:
        # Search lines before responsibilities/sections
        # Look for explicit lines following "CAREERS / SAMPLE VACANCY" or similar
        for i, line in enumerate(lines[:15]):
            # If line matches "CAREERS / VACANCY", the NEXT line is often the job title
            if re.search(r"(?i)career[s]?\s*[/|\-]\s*.*vacanc", line) and i + 1 < len(lines):
                title = lines[i + 1]
                break

            # If line has job title keywords and is not too long or too short
            lower = line.lower()
            if any(k in lower for k in TITLE_KEYWORDS) and 4 < len(line) < 100:
                # Avoid matching header lines like "NORTHSTAR DIGITAL SOLUTIONS | SAMPLE JOB LISTING"
                if not re.search(r"(?i)(?:sample\s+job\s+listing|job\s+description|page\s+\d+)", line):
                    title = line
                    break

    if not title and filename:
        # Fallback to cleaned filename
        title = re.sub(r"\.[^/.]+$", "", filename).replace("-", " ").replace("_", " ").title()
        warnings["title"] = "Title could not be extracted from document; suggested from filename."
    elif not title:
        title = "Job Listing"
        warnings["title"] = "Title could not be detected; please enter a title."

    # 2. Company Name Extraction
    company_name = None
    comp_match = re.search(r"(?i)company\s*[:\-]?\s*\n?\s*([A-Za-z0-9&., ]+)", clean_text)
    if comp_match:
        c_cand = comp_match.group(1).splitlines()[0].strip()
        if len(c_cand) > 2 and not any(k in c_cand.lower() for k in ["location", "description", "overview"]):
            company_name = c_cand

    if not company_name:
        if "jpmorgan" in clean_text.lower() or "jpmc" in clean_text.lower() or "chase" in clean_text.lower():
            company_name = "JPMorgan Chase"
        else:
            # Check the first 3 lines for company name before pipe or dash
            first_line = lines[0] if lines else ""
            if "|" in first_line:
                company_name = first_line.split("|")[0].strip()
            elif " - " in first_line:
                company_name = first_line.split(" - ")[0].strip()
            else:
                company_name = "JPMorgan Chase"
                warnings["company_name"] = "Company not explicitly identified; defaulted to JPMorgan Chase."

    # 3. Location Extraction
    location = None
    loc_match = re.search(r"(?i)location\s*[:\-]?\s*\n?\s*([A-Za-z0-9&., \-]+)", clean_text)
    if loc_match:
        l_cand = loc_match.group(1).splitlines()[0].strip()
        if len(l_cand) > 2 and not any(k in l_cand.lower() for k in ["responsibilities", "qualification", "overview"]):
            location = l_cand

    if not location:
        # Check standard known locations
        lower_all = clean_text.lower()
        if "goregaon" in lower_all:
            location = "Goregaon, Mumbai"
        elif "santa cruz" in lower_all:
            location = "Santa Cruz, Mumbai"
        elif "mumbai" in lower_all:
            location = "Mumbai"
        elif "bengaluru" in lower_all or "bangalore" in lower_all:
            location = "Bengaluru"
        elif "hyderabad" in lower_all:
            location = "Hyderabad"
        elif "delhi" in lower_all or "noida" in lower_all or "gurgaon" in lower_all:
            location = "Delhi NCR"
        elif "london" in lower_all:
            location = "London, UK"
        elif "new york" in lower_all:
            location = "New York, NY"
        else:
            location = "Goregaon, Mumbai"
            warnings["location"] = "Location was not detected in document text; defaulted to Goregaon, Mumbai."

    # 4. Role Family Inference
    lower_all = clean_text.lower()
    score_a = sum(1 for k in FAMILY_A_KEYWORDS if k in lower_all)
    score_b = sum(1 for k in FAMILY_B_KEYWORDS if k in lower_all)
    score_c = sum(1 for k in FAMILY_C_KEYWORDS if k in lower_all)

    # Boost title keywords
    lower_title = title.lower()
    if any(k in lower_title for k in ["developer", "software", "engineer", "full stack", "ai", "machine learning"]):
        score_b += 5
    if any(k in lower_title for k in ["data quality", "data governance", "data management", "steward"]):
        score_a += 5
    if any(k in lower_title for k in ["finance", "credit", "sales", "underwriting", "banking"]):
        score_c += 5

    if score_a > score_b and score_a > score_c:
        role_family = "Family A: Data Management, Quality and Governance"
    elif score_c > score_a and score_c > score_b:
        role_family = "Family C: Finance, Credit and Operations"
    elif score_b > 0:
        role_family = "Family B: Analytics, Automation and AI"
    else:
        role_family = "Family A: Data Management, Quality and Governance"
        warnings["role_family"] = "Role family could not be determined with high confidence; please verify."

    # 5. Status Inference
    status = "Available"
    if "closed" in lower_all or "no longer accepting" in lower_all:
        status = "Closed"
    elif "unavailable" in lower_all:
        status = "JD unavailable"

    # 6. Requisition ID in text
    extracted_req_id = None
    req_match = re.search(r"(?i)(?:requisition|job\s*id|req\s*#?)\s*[:\-]?\s*([A-Za-z0-9\-]+)", clean_text)
    if req_match:
        cand_id = req_match.group(1).strip()
        if len(cand_id) >= 3 and not cand_id.lower().startswith("e.g"):
            extracted_req_id = cand_id

    # 7. Section parsing
    sections = parse_job_sections(clean_text)

    if not sections.get("responsibilities"):
        warnings["responsibilities"] = "Job Responsibilities section was not clearly recognized in document."
    if not sections.get("qualifications"):
        warnings["qualifications"] = "Required Qualifications section was not clearly recognized in document."
    if not sections.get("preferred_qualifications"):
        warnings["preferred_qualifications"] = "Preferred Qualifications section was not found in document (may be optional)."

    return {
        "title": title,
        "company_name": company_name,
        "location": location,
        "role_family": role_family,
        "status": status,
        "extracted_req_id": extracted_req_id,
        "summary": sections.get("summary"),
        "responsibilities": sections.get("responsibilities"),
        "qualifications": sections.get("qualifications"),
        "preferred_qualifications": sections.get("preferred_qualifications"),
        "warnings": warnings,
    }
