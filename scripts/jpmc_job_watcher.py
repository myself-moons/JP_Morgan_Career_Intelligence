#!/usr/bin/env python3
"""
JPMorgan Chase Career Intelligence - Automated Job Watcher & Alert Engine

Designed to run in GitHub Actions on a schedule (e.g. daily cron) or on-demand:
1. Queries JPMC's public Oracle Recruiting Cloud CE API for Mumbai/Goregaon roles.
2. Ingests and persists newly discovered jobs in SQLite.
3. Evaluates roles against the candidate's active resume.
4. Generates an executive briefing (HTML + Markdown).
5. Dispatches an email notification via SMTP (Gmail, SendGrid, etc.) if configured.
6. Writes GitHub Actions Step Summary for instant dashboard visibility.
"""

import argparse
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure repository root and backend are on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal, init_db
from app.models.entities import JobListing, ResumeDocument
from app.core.seed import seed_baseline_jobs
from app.services.job_sync import sync_jpmc_jobs
from app.services.llm_matcher import explainable_resume_match


def build_markdown_summary(
    active_resume: ResumeDocument,
    sync_stats: Dict[str, Any],
    top_matches: List[Dict[str, Any]],
    timestamp: str,
) -> str:
    """Builds a GitHub Actions Markdown Step Summary."""
    lines = [
        "# 🏛️ JPMorgan Chase Career Intelligence — Daily Sync & Match Briefing",
        f"**Run Timestamp:** `{timestamp} UTC` | **Active Resume:** `{active_resume.name}`",
        "",
        "### 📊 Ingestion & Sync Statistics",
        f"- **Total Remote Postings Evaluated (Mumbai/Goregaon Area):** `{sync_stats.get('total_found', 0)}`",
        f"- **New Postings Discovered:** `{sync_stats.get('added', 0)}`",
        f"- **Updated Postings:** `{sync_stats.get('updated', 0)}`",
        f"- **Unchanged Postings:** `{sync_stats.get('unchanged', 0)}`",
        f"- **Postings Flagged Stale:** `{sync_stats.get('stale', 0)}`",
        "",
        "### 🎯 Top Matching Roles for Active Profile",
    ]

    if not top_matches:
        lines.append("*No roles exceeded the minimum fit score threshold in this sync run.*")
    else:
        for idx, match in enumerate(top_matches, start=1):
            job = match["job"]
            eval_res = match["evaluation"]
            score = eval_res.overall_score
            verdict = eval_res.readiness_verdict
            req_id = job.external_job_id or f"ID-{job.id}"
            url = job.source_url or f"https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/{job.source_job_id}"

            badge = "🟢 Strong Fit" if score >= 80 else "🔵 Competitive Fit" if score >= 60 else "🟡 Development Candidate"

            lines.extend([
                f"#### {idx}. [{job.title}]({url})",
                f"- **Requisition ID:** `{req_id}` | **Role Family:** {job.role_family.split(':')[0]}",
                f"- **Location:** {job.location} | **Posted / Captured Date:** `{job.capture_date or 'Recent'}`",
                f"- **Match Fit Score:** **`{score}%`** ({badge}) | **Verdict:** `{verdict}`",
                f"- **AI Reasoning:** {eval_res.summary_reasoning}",
                f"- **Verified Competencies ({len(eval_res.verified_matched_skills)}):** " + (", ".join(eval_res.verified_matched_skills[:8]) if eval_res.verified_matched_skills else "None identified"),
                f"- **Critical Gaps ({len(eval_res.critical_missing_skills)}):** " + (", ".join(eval_res.critical_missing_skills[:6]) if eval_res.critical_missing_skills else "None identified"),
                f"- **[Direct Apply Link on JPMC Careers]({url})**",
                "",
            ])

    return "\n".join(lines)


def build_html_email(
    active_resume: ResumeDocument,
    sync_stats: Dict[str, Any],
    top_matches: List[Dict[str, Any]],
    timestamp: str,
) -> str:
    """Builds a clean, executive HTML email with JPMorgan Chase styling."""
    match_cards = ""
    for idx, match in enumerate(top_matches, start=1):
        job = match["job"]
        eval_res = match["evaluation"]
        score = eval_res.overall_score
        verdict = eval_res.readiness_verdict
        url = job.source_url or f"https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/{job.source_job_id}"
        score_color = "#10b981" if score >= 80 else "#0ea5e9" if score >= 60 else "#f59e0b"

        matched_skills_html = "".join(
            f'<span style="display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:2px;">{s}</span>'
            for s in eval_res.verified_matched_skills[:6]
        )
        gaps_html = "".join(
            f'<span style="display:inline-block;background:#fffbeb;color:#92400e;border:1px solid #fde68a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:2px;">{g}</span>'
            for g in eval_res.critical_missing_skills[:5]
        )

        match_cards += f"""
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                    <span style="font-family:monospace;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;">
                        {job.external_job_id or 'JPMC-REQ'}
                    </span>
                    <h3 style="margin:6px 0 2px 0;font-size:16px;color:#0f172a;font-weight:700;">
                        {job.title}
                    </h3>
                    <p style="margin:0;font-size:12px;color:#64748b;">
                        {job.role_family.split(':')[0]} &bull; {job.location} &bull; <strong>Posted:</strong> {job.capture_date or 'Recent'}
                    </p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:24px;font-weight:900;color:{score_color};line-height:1;">
                        {score}%
                    </div>
                    <span style="font-size:11px;font-weight:bold;color:#475569;">
                        {verdict}
                    </span>
                </div>
            </div>

            <p style="font-size:13px;color:#334155;line-height:1.5;margin:10px 0;background:#f8fafc;padding:10px 12px;border-radius:6px;border-left:3px solid {score_color};">
                {eval_res.summary_reasoning}
            </p>

            <div style="margin-top:12px;">
                <div style="font-size:11px;font-weight:700;color:#065f46;text-transform:uppercase;margin-bottom:4px;">
                    Verified Competencies
                </div>
                <div>{matched_skills_html if matched_skills_html else '<span style="font-size:12px;color:#94a3b8;">None identified</span>'}</div>
            </div>

            <div style="margin-top:10px;">
                <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px;">
                    Critical Gaps to Prepare
                </div>
                <div>{gaps_html if gaps_html else '<span style="font-size:12px;color:#94a3b8;">None identified</span>'}</div>
            </div>

            <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;text-align:right;">
                <a href="{url}" style="display:inline-block;background:#003366;color:#ffffff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;">
                    View &amp; Apply on JPMC Careers &rarr;
                </a>
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>JPMorgan Chase Career Intelligence Briefing</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:24px;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background:#003366;background:linear-gradient(135deg, #001f3f 0%, #003366 100%);padding:28px 24px;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.8;font-weight:700;">
                Autonomous Career Agent
            </div>
            <h1 style="margin:4px 0 8px 0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                JPMorgan Chase Career Intelligence
            </h1>
            <p style="margin:0;font-size:13px;opacity:0.9;">
                Daily Requisition Sync &amp; Profile Alignment Briefing &bull; {timestamp} UTC
            </p>
        </div>

        <!-- Metric Bar -->
        <div style="background:#f1f5f9;padding:14px 24px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:12px;color:#475569;">
            <div><strong>Active Resume:</strong> {active_resume.name}</div>
            <div><strong>New Postings:</strong> {sync_stats.get('added', 0)}</div>
            <div><strong>Total Ingested:</strong> {sync_stats.get('total_found', 0)}</div>
        </div>

        <!-- Content Area -->
        <div style="padding:24px;">
            <h2 style="font-size:16px;font-weight:700;color:#0f172a;margin-top:0;margin-bottom:16px;">
                Top Matched Positions ({len(top_matches)})
            </h2>
            {match_cards if top_matches else '<p style="color:#64748b;font-size:14px;">No positions exceeded the alignment threshold in this run.</p>'}
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
            Generated automatically by JPMorgan Career Intelligence (JCI) via GitHub Actions &bull; Local-first &bull; 0 Cloud Cost
        </div>
    </div>
</body>
</html>"""


def send_email_alert(
    subject: str,
    html_content: str,
    recipient: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_pass: str,
):
    """Sends an email notification via standard SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"JCI Career Intelligence <{smtp_user}>"
    msg["To"] = recipient

    part = MIMEText(html_content, "html")
    msg.attach(part)

    print(f"Connecting to SMTP server {smtp_host}:{smtp_port}...")
    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [recipient], msg.as_string())
    print(f"Email successfully delivered to {recipient}!")


def main():
    parser = argparse.ArgumentParser(description="JCI Daily Job Watcher & Alert Engine")
    parser.add_argument("--limit", type=int, default=25, help="Max jobs to query from Oracle Cloud")
    parser.add_argument("--min-score", type=int, default=50, help="Min score to include in alert (0-100)")
    parser.add_argument("--dry-run", action="store_true", help="Sync without persisting changes")
    parser.add_argument("--force-email", action="store_true", help="Send email even if no new jobs")
    parser.add_argument("--output-summary", type=str, default="", help="Path to write GitHub Step Summary markdown")
    args = parser.parse_args()

    print("=" * 60)
    print("JPMorgan Career Intelligence - Daily Job Watcher")
    print("=" * 60)

    # 1. Initialize Database & Seed Baseline if fresh
    init_db()
    db = SessionLocal()

    try:
        # Fetch active resume stored in database
        resumes = (
            db.query(ResumeDocument)
            .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.desc())
            .all()
        )
        if not resumes:
            print("No uploaded resumes found in database; skipping resume evaluation.")
            return

        active_resume = next((r for r in resumes if r.is_active == 1), resumes[0])
        print(f"Active Resume: {active_resume.name} (ID: {active_resume.id})")

        # 2. Synchronize from Oracle Cloud CE endpoint
        print(f"Synchronizing latest JPMC jobs from Oracle Cloud (limit={args.limit}, dry_run={args.dry_run})...")
        sync_stats = sync_jpmc_jobs(db, limit=args.limit, dry_run=args.dry_run)
        print(f"Sync Results: Added: {sync_stats.get('added')}, Updated: {sync_stats.get('updated')}, Unchanged: {sync_stats.get('unchanged')}, Stale: {sync_stats.get('stale')}")

        # 3. Fetch jobs for evaluation
        # We consider newly added jobs, plus all status="Discovered" or "Available"
        jobs_to_eval: List[JobListing] = []
        if sync_stats.get("jobs"):
            jobs_to_eval = sync_stats["jobs"]
        else:
            jobs_to_eval = db.query(JobListing).filter(JobListing.status.in_(["Discovered", "Available"])).all()

        resume_text = active_resume.raw_text or ""

        # 4. Evaluate each role against active resume
        print(f"Evaluating {len(jobs_to_eval)} jobs against active resume profile...")
        scored_matches: List[Dict[str, Any]] = []

        for job in jobs_to_eval:
            try:
                evaluation = explainable_resume_match(resume_text, job)
                if evaluation.overall_score >= args.min_score:
                    scored_matches.append({
                        "job": job,
                        "evaluation": evaluation,
                    })
            except Exception as e:
                print(f"Warning: Failed to evaluate job {job.title}: {e}")

        # Sort descending by overall match score
        scored_matches.sort(key=lambda m: m["evaluation"].overall_score, reverse=True)
        top_matches = scored_matches[:5]
        print(f"Identified {len(top_matches)} high-alignment roles (score >= {args.min_score}%).")

        # 5. Format Summaries
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        md_summary = build_markdown_summary(active_resume, sync_stats, top_matches, now_str)
        html_email = build_html_email(active_resume, sync_stats, top_matches, now_str)

        # Write GitHub Actions Step Summary if requested
        summary_path = args.output_summary or os.getenv("GITHUB_STEP_SUMMARY", "")
        if summary_path:
            try:
                with open(summary_path, "a", encoding="utf-8") as f:
                    f.write("\n" + md_summary + "\n")
                print(f"Step summary successfully appended to {summary_path}")
            except Exception as e:
                print(f"Note: Could not write step summary to {summary_path}: {e}")

        # 6. Dispatch Email Notification if configured
        smtp_user = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME") or os.getenv("GMAIL_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD") or os.getenv("GMAIL_APP_PASSWORD") or os.getenv("EMAIL_PASSWORD")
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        recipient = os.getenv("ALERT_EMAIL") or os.getenv("ALERT_RECIPIENT_EMAIL") or smtp_user

        should_email = args.force_email or (sync_stats.get("added", 0) > 0 and len(top_matches) > 0)

        if smtp_user and smtp_pass and recipient:
            if should_email or args.force_email:
                subject = f"🏛️ JPMC Career Intelligence: {len(top_matches)} Target Roles Matched ({now_str} UTC)"
                print(f"Sending email notification to {recipient}...")
                try:
                    send_email_alert(
                        subject=subject,
                        html_content=html_email,
                        recipient=recipient,
                        smtp_host=smtp_host,
                        smtp_port=smtp_port,
                        smtp_user=smtp_user,
                        smtp_pass=smtp_pass,
                    )
                except Exception as e:
                    print(f"Email delivery error: {e}")
            else:
                print("No new jobs discovered and force-email not specified; skipping email delivery.")
        else:
            print("Note: SMTP credentials not set in environment (SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL). Email delivery skipped.")

        print("Sync and evaluation run completed successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    main()
