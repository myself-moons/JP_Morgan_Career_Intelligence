import io
from typing import Dict, List, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.entities import JobListing
from app.services.analytics_service import compute_cross_role_matrix, compute_skill_coverage
from app.services.learning_service import list_learning_resources


def _rows_to_bytes(rows: List[Dict], sheet_name: str, fmt: str) -> Tuple[bytes, str, str]:
    """Serializes list of dicts into CSV or XLSX bytes with proper media type and extension."""
    df = pd.DataFrame(rows)
    fmt_clean = (fmt or "csv").lower().strip()

    if fmt_clean in ("xlsx", "excel"):
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name[:31])
            ws = writer.sheets[sheet_name[:31]]
            for col_cells in ws.columns:
                max_len = max((len(str(c.value or "")) for c in col_cells), default=10)
                col_letter = col_cells[0].column_letter
                ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 55)
        return (
            buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsx",
        )

    csv_bytes = df.to_csv(index=False).encode("utf-8-sig")
    return csv_bytes, "text/csv; charset=utf-8", "csv"


def export_jobs_data(
    db: Session,
    fmt: str = "csv",
    role_family: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[bytes, str, str]:
    query = db.query(JobListing)
    if role_family and role_family != "All":
        query = query.filter(JobListing.role_family.ilike(f"%{role_family.split(':')[0].strip()}%"))
    if status and status != "All":
        query = query.filter(JobListing.status == status)
    if search and search.strip():
        q = f"%{search.strip()}%"
        query = query.filter(
            or_(
                JobListing.title.ilike(q),
                JobListing.external_job_id.ilike(q),
                JobListing.location.ilike(q),
            )
        )
    jobs = query.order_by(JobListing.id.asc()).all()

    rows = [
        {
            "ID": j.id,
            "Requisition Code": j.external_job_id or "",
            "Source Job ID": j.source_job_id or "",
            "Title": j.title,
            "Company": j.company.name if j.company else "JPMorgan Chase",
            "Role Family": j.role_family,
            "Location": j.location,
            "Status": j.status,
            "Capture Date": j.capture_date,
            "Source URL": j.source_url or "",
            "Summary": j.summary or "",
        }
        for j in jobs
    ]
    if not rows:
        rows = [{"ID": "", "Title": "No matching jobs", "Status": status or "All"}]
    return _rows_to_bytes(rows, "JCI_Job_Library", fmt)


def export_coverage_data(
    db: Session,
    fmt: str = "csv",
    role_family: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[bytes, str, str]:
    cov = compute_skill_coverage(db, role_family=role_family, category=category, search=search)
    rows = [
        {
            "Canonical Skill": s.canonical_name,
            "Category": s.category,
            "Distinct Jobs Mentioning": s.distinct_job_count,
            "Denominator (N)": cov.analysable_count,
            "Coverage %": s.coverage_percentage,
            "Required Count": s.required_count,
            "Preferred Count": s.preferred_count,
            "Family A Count": s.family_a_count,
            "Family B Count": s.family_b_count,
            "Family C Count": s.family_c_count,
            "Active Filter": cov.active_family_filter or "All",
        }
        for s in cov.skills
    ]
    if not rows:
        rows = [{"Canonical Skill": "No matching skills", "Active Filter": role_family or "All"}]
    return _rows_to_bytes(rows, "JCI_Skill_Coverage", fmt)


def export_matrix_data(db: Session, fmt: str = "csv") -> Tuple[bytes, str, str]:
    mat = compute_cross_role_matrix(db)
    rows: List[Dict] = []
    for skill in mat.skills:
        row: Dict[str, object] = {
            "Canonical Skill": skill.canonical_name,
            "Category": skill.category,
            "Coverage %": skill.coverage_percentage,
        }
        skill_cells = mat.matrix.get(skill.skill_id, {})
        for job in mat.jobs:
            col_label = f"{job.external_job_id or job.job_id} - {job.title[:28]}"
            cell = skill_cells.get(job.job_id, "none")
            row[col_label] = cell.capitalize() if cell != "none" else "-"
        rows.append(row)
    return _rows_to_bytes(rows, "JCI_Cross_Role_Matrix", fmt)


def export_learning_data(db: Session, fmt: str = "csv") -> Tuple[bytes, str, str]:
    resources = list_learning_resources(db)
    rows = [
        {
            "ID": r.id,
            "Provider": r.provider,
            "Title": r.title,
            "Skills Addressed": ", ".join(r.skills_addressed),
            "Cost Status": r.cost_status,
            "Certificate": "Yes" if r.has_certificate else "No",
            "Duration": r.duration or "",
            "Progress Status": r.progress_status,
            "Started Date": r.started_at or "",
            "Completed Date": r.completed_at or "",
            "Verification Date": r.verification_date,
            "Notes": r.notes or "",
            "URL": r.url or "",
        }
        for r in resources
    ]
    return _rows_to_bytes(rows, "JCI_Learning_Tracker", fmt)
