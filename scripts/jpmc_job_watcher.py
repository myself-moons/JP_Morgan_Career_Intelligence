#!/usr/bin/env python3
"""
JCI Career Studio (v3.0) - Automated Multi-User Job Watcher

Designed to run in GitHub Actions on a daily cron ($0 cost):
1. Queries JPMC's public Oracle Recruiting Cloud CE API for Mumbai/Goregaon roles.
2. Syncs newly discovered jobs into PostgreSQL (shared baseline) and extracts canonical skills.
3. For every registered user with email alerts enabled, computes deterministic match scores
   against their private Experience Vault (or active Resume fallback) — zero LLM API cost.
4. Sends each matched user a personalized HTML digest email via SMTP (e.g. free Gmail SMTP).
5. Writes an anonymized aggregate briefing to GitHub Actions Step Summary.
"""

import argparse
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Ensure repository root and backend are on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.models.entities import ExperienceEntry, JobListing, ResumeDocument, User
from app.models.schemas import TopJobMatch
from app.services.job_sync import sync_jpmc_jobs
from app.services.llm_matcher import rank_top_jobs_for_resume
from app.services.taxonomy_service import batch_extract_all_jobs, seed_taxonomy_if_empty


def _build_user_profile_text(db, user: User) -> Tuple[str, str]:
    """Builds candidate text using v3 priority: Experience Vault -> Active Resume."""
    entries = (
        db.query(ExperienceEntry)
        .filter(ExperienceEntry.user_id == user.id)
        .order_by(ExperienceEntry.updated_at.desc())
        .all()
    )
    if entries:
        parts = []
        for e in entries:
            parts.append(f"{e.title} ({e.organization_or_project or ''})\n{e.detailed_narrative}")
        return "\n\n".join(parts), "Experience Vault"

    resumes = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == user.id)
        .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.desc())
        .all()
    )
    if resumes:
        active = next((r for r in resumes if r.is_active == 1), resumes[0])
        if active.raw_text:
            return active.raw_text, f"Resume ({active.name})"

    return "", "None"


def build_markdown_summary(
    sync_stats: Dict[str, Any],
    users_evaluated: int,
    emails_sent: int,
    timestamp: str,
) -> str:
    """Builds an anonymized GitHub Actions Markdown Step Summary (no PII leaked)."""
    lines = [
        "# JCI Career Studio (v3.0) — Daily Sync Briefing",
        f"**Run Timestamp:** `{timestamp} UTC`",
        "",
        "### Sync Statistics",
        f"- **Total Remote Postings Evaluated (Mumbai/Goregaon):** `{sync_stats.get('total_found', 0)}`",
        f"- **New Postings Discovered:** `{sync_stats.get('added', 0)}`",
        f"- **Updated Postings:** `{sync_stats.get('updated', 0)}`",
        f"- **Unchanged Postings:** `{sync_stats.get('unchanged', 0)}`",
        f"- **Postings Flagged Stale:** `{sync_stats.get('stale', 0)}`",
        "",
        "### Multi-User Alert Dispatch",
        f"- **Registered Users Evaluated:** `{users_evaluated}`",
        f"- **Personalized Digests Sent:** `{emails_sent}`",
    ]
    return "\n".join(lines)


def build_html_email(
    display_name: str,
    source_label: str,
    sync_stats: Dict[str, Any],
    top_matches: List[TopJobMatch],
    timestamp: str,
    app_url: str,
) -> str:
    """Builds a clean, mobile-friendly HTML email for an individual user."""
    match_cards = ""
    for match in top_matches:
        score = match.score
        url = match.source_url or app_url
        score_color = "#10b981" if score >= 80 else "#3b82f6" if score >= 60 else "#f59e0b"

        matched_skills_html = "".join(
            f'<span style="display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;margin:2px;">{s}</span>'
            for s in match.matched_skills[:6]
        )

        match_cards += f"""
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div>
                    <span style="font-family:monospace;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;">
                        {match.external_job_id or 'JPMC-REQ'}
                    </span>
                    <h3 style="margin:6px 0 4px 0;font-size:15px;color:#0f172a;font-weight:700;">
                        {match.title}
                    </h3>
                    <p style="margin:0;font-size:12px;color:#64748b;">
                        {match.role_family.split(':')[0]} &bull; {match.capture_date or 'Recent'}
                    </p>
                </div>
                <div style="text-align:right;white-space:nowrap;">
                    <div style="font-size:22px;font-weight:900;color:{score_color};line-height:1;">
                        {score}%
                    </div>
                    <span style="font-size:11px;font-weight:600;color:#475569;">
                        {match.readiness_verdict}
                    </span>
                </div>
            </div>
            <div style="margin-top:10px;">
                {matched_skills_html if matched_skills_html else '<span style="font-size:12px;color:#94a3b8;">Matches your profile keywords</span>'}
            </div>
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;text-align:right;">
                <a href="{url}" style="display:inline-block;background:#005ea6;color:#ffffff;text-decoration:none;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:700;">
                    View Role &rarr;
                </a>
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>JCI Career Studio Daily Match Briefing</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0f172a;margin:0;padding:16px;color:#0f172a;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#005ea6 100%);padding:24px;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:0.85;font-weight:700;">
                JCI Career Studio v3.0
            </div>
            <h1 style="margin:6px 0 4px 0;font-size:20px;font-weight:800;">
                Hi {display_name}, here are your top role matches
            </h1>
            <p style="margin:0;font-size:12px;opacity:0.9;">
                {sync_stats.get('added', 0)} new postings discovered &bull; Ranked from {source_label} &bull; {timestamp} UTC
            </p>
        </div>

        <div style="padding:20px;">
            {match_cards}
            <div style="text-align:center;margin-top:16px;">
                <a href="{app_url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;">
                    Open JCI Career Studio
                </a>
            </div>
        </div>

        <div style="background:#f8fafc;padding:14px 20px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;">
            Sent by JCI Career Studio &bull; Zero-cost automated match digest.<br>
            You can turn off daily alerts anytime from the bell icon in the app header.
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
    """Sends an HTML email notification via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"JCI Career Studio <{smtp_user}>"
    msg["To"] = recipient
    msg.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [recipient], msg.as_string())


def main():
    parser = argparse.ArgumentParser(description="JCI v3.0 Daily Job Watcher & Multi-User Alert Engine")
    parser.add_argument("--limit", type=int, default=25, help="Max jobs to query from Oracle Cloud")
    parser.add_argument("--min-score", type=int, default=50, help="Min score to include in alert (0-100)")
    parser.add_argument("--dry-run", action="store_true", help="Sync without persisting changes or emailing")
    parser.add_argument("--force-email", action="store_true", help="Send email even if no new jobs were added")
    parser.add_argument("--output-summary", type=str, default="", help="Path to write GitHub Step Summary markdown")
    args = parser.parse_args()

    print("=" * 60)
    print("JCI Career Studio v3.0 - Multi-User Job Watcher")
    print("=" * 60)

    init_db()
    db = SessionLocal()

    try:
        if db.query(JobListing).count() == 0:
            seed_baseline_jobs(db)
        seed_taxonomy_if_empty(db)

        print(f"Synchronizing live JPMC jobs (limit={args.limit}, dry_run={args.dry_run})...")
        sync_stats = sync_jpmc_jobs(db, limit=args.limit, dry_run=args.dry_run)
        print(
            f"Sync Results: Added={sync_stats.get('added')}, Updated={sync_stats.get('updated')}, "
            f"Unchanged={sync_stats.get('unchanged')}, Stale={sync_stats.get('stale')}"
        )

        if sync_stats.get("added", 0) > 0 and not args.dry_run:
            batch_extract_all_jobs(db)

        # Evaluate active/discovered shared jobs
        jobs_to_eval = (
            db.query(JobListing)
            .filter(
                JobListing.user_id.is_(None),
                JobListing.status.in_(["Discovered", "Available"]),
            )
            .all()
        )

        app_url = os.getenv("APP_URL", "https://jci-app-60056461331.asia-southeast1.run.app").strip()
        smtp_user = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME") or os.getenv("GMAIL_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD") or os.getenv("GMAIL_APP_PASSWORD") or os.getenv("EMAIL_PASSWORD")
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        fallback_recipient = os.getenv("ALERT_EMAIL") or os.getenv("ALERT_RECIPIENT_EMAIL")

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

        # Multi-user targets: all registered Google users who kept email alerts enabled
        registered_users = (
            db.query(User)
            .filter(User.is_local_dev == 0, User.email_alerts_enabled == 1)
            .all()
        )

        users_evaluated = 0
        emails_sent = 0
        should_notify = (not args.dry_run) and (args.force_email or sync_stats.get("added", 0) > 0)

        if registered_users:
            for user in registered_users:
                profile_text, source_label = _build_user_profile_text(db, user)
                if not profile_text.strip():
                    continue
                users_evaluated += 1
                matches = rank_top_jobs_for_resume(profile_text, jobs_to_eval, top_n=5)
                qualified = [m for m in matches if m.score >= args.min_score]
                if not qualified:
                    continue

                if should_notify and smtp_user and smtp_pass and user.email:
                    subject = f"JCI Career Studio: {len(qualified)} Top Role Match(es) ({now_str} UTC)"
                    html_email = build_html_email(
                        display_name=user.display_name,
                        source_label=source_label,
                        sync_stats=sync_stats,
                        top_matches=qualified,
                        timestamp=now_str,
                        app_url=app_url,
                    )
                    try:
                        send_email_alert(
                            subject=subject,
                            html_content=html_email,
                            recipient=user.email,
                            smtp_host=smtp_host,
                            smtp_port=smtp_port,
                            smtp_user=smtp_user,
                            smtp_pass=smtp_pass,
                        )
                        emails_sent += 1
                    except Exception as exc:
                        print(f"Email delivery error for user #{user.id}: {exc}")
        elif fallback_recipient:
            # Local single-user fallback if no Google users exist yet
            local_resume = (
                db.query(ResumeDocument)
                .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.desc())
                .first()
            )
            if local_resume and local_resume.raw_text:
                users_evaluated = 1
                matches = rank_top_jobs_for_resume(local_resume.raw_text, jobs_to_eval, top_n=5)
                qualified = [m for m in matches if m.score >= args.min_score]
                if qualified and should_notify and smtp_user and smtp_pass:
                    html_email = build_html_email(
                        display_name="Workspace User",
                        source_label=f"Resume ({local_resume.name})",
                        sync_stats=sync_stats,
                        top_matches=qualified,
                        timestamp=now_str,
                        app_url=app_url,
                    )
                    try:
                        send_email_alert(
                            subject=f"JCI Career Studio: {len(qualified)} Top Role Match(es)",
                            html_content=html_email,
                            recipient=fallback_recipient,
                            smtp_host=smtp_host,
                            smtp_port=smtp_port,
                            smtp_user=smtp_user,
                            smtp_pass=smtp_pass,
                        )
                        emails_sent = 1
                    except Exception as exc:
                        print(f"Fallback email error: {exc}")

        print(f"Evaluated {users_evaluated} user(s); dispatched {emails_sent} digest email(s).")

        summary_path = args.output_summary or os.getenv("GITHUB_STEP_SUMMARY", "")
        if summary_path:
            md_summary = build_markdown_summary(sync_stats, users_evaluated, emails_sent, now_str)
            try:
                with open(summary_path, "a", encoding="utf-8") as f:
                    f.write("\n" + md_summary + "\n")
            except Exception as exc:
                print(f"Note: could not write step summary: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
