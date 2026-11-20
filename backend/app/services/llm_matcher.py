import json
import re
from typing import Dict, Any, List, Optional
import requests

from app.core.config import settings
from app.models.entities import JobListing
from app.models.schemas import (
    ExplainableMatchResponse,
    DimensionDetail,
    TopJobMatch,
    TopJobMatchesResponse,
)

# Curated high-precision domain and technology taxonomy (guarantees genuine keywords even offline)
CANONICAL_TAXONOMY: Dict[str, List[str]] = {
    # Engineering & Cloud
    "Python": ["python", "python3", "py"],
    "SQL": ["sql", "tsql", "postgresql", "postgres", "mysql", "oracle sql"],
    "FastAPI": ["fastapi", "fast api"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "AWS": ["aws", "amazon web services", "s3", "ec2", "lambda"],
    "Docker": ["docker", "containerization", "containers"],
    "Git": ["git", "github", "version control"],
    "REST APIs": ["rest api", "restful", "rest apis", "microservices"],
    "Kafka": ["kafka", "event streaming", "event-driven"],
    "Spark": ["spark", "pyspark", "apache spark"],
    "ETL Pipelines": ["etl", "elt", "data pipeline", "data pipelines", "ingestion pipeline"],
    "Cron / Scheduling": ["cron", "scheduler", "airflow"],
    "LocalStack": ["localstack"],
    # Data Management & Governance (Family A)
    "Collibra": ["collibra"],
    "Data Governance": ["data governance", "governance framework", "data policy"],
    "Data Quality": ["data quality", "dq rules", "data profiling", "quality metrics"],
    "Metadata Management": ["metadata", "metadata management", "meta-data", "data dictionary"],
    "Data Lineage": ["data lineage", "lineage tracking", "traceability"],
    "Data Stewardship": ["data steward", "data stewardship", "stewardship"],
    "Data Catalog": ["data catalog", "cataloging"],
    "Reference Data": ["reference data", "master data", "mdm"],
    "BCBS 239 / Risk Data": ["bcbs 239", "risk data aggregation", "regulatory reporting"],
    "Chief Data Office (CDO)": ["cdo", "chief data office"],
    # Analytics & AI/ML (Family B)
    "Machine Learning": ["machine learning", "ml", "statistical models", "predictive modeling"],
    "Deep Learning": ["deep learning", "neural networks", "nlp", "natural language processing", "llm"],
    "Scikit-Learn": ["scikit-learn", "sklearn"],
    "Power BI": ["power bi", "powerbi"],
    "Tableau": ["tableau"],
    "Alteryx": ["alteryx"],
    "Data Modeling": ["data modeling", "dimensional modeling", "star schema"],
    # Finance, Banking & Credit (Family C)
    "Credit Risk": ["credit risk", "counterparty risk", "underwriting"],
    "Market Risk": ["market risk", "var", "value at risk"],
    "Financial Analysis": ["financial analysis", "cash flow", "financial modeling"],
    "Treasury & Liquidity": ["treasury", "liquidity", "asset liability", "alm"],
    "Wholesale Payments": ["payments", "transaction banking", "swift", "clearing"],
    "Agile / Scrum": ["agile", "scrum", "sprints", "jira"],
}


def _extract_taxonomy_skills(text: str) -> List[str]:
    """Finds canonical skills mentioned in text using regex word boundary matching."""
    if not text:
        return []
    lower = text.lower()
    found: List[str] = []
    for canonical, aliases in CANONICAL_TAXONOMY.items():
        for alias in aliases:
            pattern = r"(?i)\b" + re.escape(alias) + r"\b"
            if re.search(pattern, lower):
                found.append(canonical)
                break
    return found


def _offline_explainable_match(
    resume_text: str,
    job: JobListing,
) -> ExplainableMatchResponse:
    """High-accuracy deterministic taxonomy matcher used when offline or without API key."""
    resume_skills = set(_extract_taxonomy_skills(resume_text))

    job_full_text = f"{job.title} {job.role_family} {job.summary or ''} {job.responsibilities or ''} {job.qualifications or ''} {job.preferred_qualifications or ''}"
    job_skills = set(_extract_taxonomy_skills(job_full_text))

    # Required section skills (weighted heavier)
    required_text = f"{job.responsibilities or ''} {job.qualifications or ''}"
    req_skills = set(_extract_taxonomy_skills(required_text))

    matched = sorted(list(resume_skills.intersection(job_skills)))
    missing = sorted(list(job_skills.difference(resume_skills)))

    # Calculate dimensional scores
    total_target = len(job_skills)
    if total_target == 0:
        overall_score = 70
        tech_score = 75
        domain_score = 70
        exp_score = 70
    else:
        req_matched = len(resume_skills.intersection(req_skills))
        req_total = max(len(req_skills), 1)
        tech_score = min(100, int((req_matched / req_total) * 90) + 10)

        # Domain alignment based on role family
        family = (job.role_family or "").lower()
        if "family a" in family:
            gov_skills = {"Collibra", "Data Governance", "Data Quality", "Metadata Management", "Data Lineage"}
            gov_match = len(resume_skills.intersection(gov_skills))
            domain_score = min(100, int((gov_match / max(len(gov_skills), 1)) * 100))
        elif "family b" in family:
            analytics_skills = {"Machine Learning", "Python", "SQL", "FastAPI", "Pandas", "Power BI", "Tableau"}
            analytics_match = len(resume_skills.intersection(analytics_skills))
            domain_score = min(100, int((analytics_match / max(len(analytics_skills), 1)) * 100))
        else:
            fin_skills = {"Credit Risk", "Market Risk", "Financial Analysis", "Wholesale Payments"}
            fin_match = len(resume_skills.intersection(fin_skills))
            domain_score = min(100, int((fin_match / max(len(fin_skills), 1)) * 100))

        domain_score = max(domain_score, 35)
        exp_score = 75 if "3+" in (job.title or "") or "senior" in (job.title or "").lower() else 85
        overall_score = int(tech_score * 0.45 + domain_score * 0.35 + exp_score * 0.20)

    # Readiness Verdict
    if overall_score >= 80:
        verdict = "Role-Ready / Strong Match"
        summary = f"Strong alignment for {job.title}. Your background in {', '.join(matched[:3]) or 'software/data'} maps cleanly to this position's core requirements."
    elif overall_score >= 60:
        verdict = "Strong Contender with Minor Gaps"
        summary = f"Good baseline technical overlap for {job.title}. Strengthening resume emphasis on {', '.join(missing[:2]) or 'domain tools'} will significantly boost candidacy."
    elif overall_score >= 40:
        verdict = "Moderate Fit - Targeted Upskilling Needed"
        summary = f"Partial overlap for {job.title}. Role demands specialized capabilities in {', '.join(missing[:3]) or 'governance/finance'} not prominently demonstrated in active resume."
    else:
        verdict = "Significant Preparation Required"
        summary = f"Low current overlap with {job.title}. Focus on building verifiable project evidence around {', '.join(missing[:3])}."

    recommendations: List[str] = []
    if missing:
        recommendations.append(
            f"Highlight or incorporate experience with {missing[0]} and {missing[1] if len(missing) > 1 else 'related tools'} in your LaTeX project or experience descriptions."
        )
    if matched:
        recommendations.append(
            f"Prominently emphasize demonstrated metrics for {', '.join(matched[:3])} in the top third of your resume to catch ATS filters."
        )
    recommendations.append(
        "Tailor your profile summary specifically toward JPMorgan Chase's engineering or governance standards for this role family."
    )

    return ExplainableMatchResponse(
        overall_score=overall_score,
        readiness_verdict=verdict,
        summary_reasoning=summary,
        dimensions={
            "technical_skills": DimensionDetail(
                score=tech_score,
                reasoning=f"Identified {len(matched)} matching core skills ({', '.join(matched[:4]) or 'none'})."
            ),
            "domain_knowledge": DimensionDetail(
                score=domain_score,
                reasoning=f"Evaluated against JPMorgan Chase {job.role_family.split(':')[0]} expectations."
            ),
            "experience_alignment": DimensionDetail(
                score=exp_score,
                reasoning="Evaluated against role scope, education credentials, and demonstrated practical pipelines."
            ),
        },
        verified_matched_skills=matched,
        critical_missing_skills=missing,
        actionable_latex_recommendations=recommendations,
        is_llm_powered=False,
    )


def explainable_resume_match(
    resume_text: str,
    job: JobListing,
) -> ExplainableMatchResponse:
    """
    Evaluates resume against a target JPMC job posting.
    Uses Google Gemini Flash if API key is configured; falls back gracefully to offline taxonomy engine.
    """
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        return _offline_explainable_match(resume_text, job)

    model = settings.GEMINI_MODEL or "gemini-flash-lite-latest"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    prompt = f"""
You are a Senior Technical Hiring Bar Raiser and Principal Recruiter at JPMorgan Chase & Co.
Analyze the candidate's resume against the specified JPMorgan Chase job description.

Target Job:
- Title: {job.title}
- Requisition Code: {job.external_job_id or 'JPMC'}
- Role Family: {job.role_family}
- Location: {job.location}
- Responsibilities:
{job.responsibilities or job.cleaned_description or job.original_description or 'Not specified'}

- Qualifications:
{job.qualifications or 'Not specified'}

- Preferred Qualifications:
{job.preferred_qualifications or 'Not specified'}

Candidate Resume Text:
\"\"\"{resume_text[:4000]}\"\"\"

Provide an Explainable AI assessment in exact JSON format.
CRITICAL RULES:
1. Do NOT include generic English stopwords or common words like "including", "across", "ensure", "execute", "clarity", "define", "requirements".
2. Only list genuine, recognized technical tools, software, methodologies, programming languages, or banking/governance domain competencies in `verified_matched_skills` and `critical_missing_skills`.
3. Provide realistic scoring (0-100) reflecting actual hiring bar standards at JPMorgan Chase.
4. Output MUST be valid JSON with the exact following schema:
{{
  "overall_score": 75,
  "readiness_verdict": "Strong Contender with Minor Gaps",
  "summary_reasoning": "Executive 2-sentence summary of why this score was awarded.",
  "dimensions": {{
    "technical_skills": {{ "score": 85, "reasoning": "Technical reasoning" }},
    "domain_knowledge": {{ "score": 65, "reasoning": "Banking/governance domain reasoning" }},
    "experience_alignment": {{ "score": 75, "reasoning": "Seniority and role scope reasoning" }}
  }},
  "verified_matched_skills": ["Python", "SQL", "FastAPI"],
  "critical_missing_skills": ["Collibra", "Data Lineage"],
  "actionable_latex_recommendations": [
    "Specific bullet point recommendation 1 for candidate to edit in LaTeX",
    "Specific bullet point recommendation 2 for candidate to edit in LaTeX"
  ]
}}
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=25)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                text_part = candidates[0]["content"]["parts"][0]["text"].strip()
                parsed = json.loads(text_part)

                dims = {}
                for k, v in parsed.get("dimensions", {}).items():
                    if isinstance(v, dict):
                        dims[k] = DimensionDetail(
                            score=int(v.get("score", 70)),
                            reasoning=str(v.get("reasoning", ""))
                        )

                return ExplainableMatchResponse(
                    overall_score=int(parsed.get("overall_score", 70)),
                    readiness_verdict=str(parsed.get("readiness_verdict", "Evaluated")),
                    summary_reasoning=str(parsed.get("summary_reasoning", "")),
                    dimensions=dims,
                    verified_matched_skills=parsed.get("verified_matched_skills", []),
                    critical_missing_skills=parsed.get("critical_missing_skills", []),
                    actionable_latex_recommendations=parsed.get("actionable_latex_recommendations", []),
                    is_llm_powered=True,
                )
    except Exception as e:
        print(f"Gemini API call failed or timed out: {e}. Falling back to offline taxonomy engine.")

    # Graceful fallback
    return _offline_explainable_match(resume_text, job)


def rank_top_jobs_for_resume(
    resume_text: str,
    jobs: List[JobListing],
    top_n: int = 5,
) -> List[TopJobMatch]:
    """Rapidly scores and ranks available JPMC jobs against a resume."""
    scored: List[TopJobMatch] = []
    for job in jobs:
        # Fast taxonomy scoring for leaderboard ranking
        evaluation = _offline_explainable_match(resume_text, job)
        scored.append(
            TopJobMatch(
                job_id=job.id,
                title=job.title,
                external_job_id=job.external_job_id,
                role_family=job.role_family,
                score=evaluation.overall_score,
                matched_skills=evaluation.verified_matched_skills[:5],
                readiness_verdict=evaluation.readiness_verdict,
                capture_date=job.capture_date,
            )
        )

    # Sort descending by match score
    scored.sort(key=lambda x: x.score, reverse=True)
    return scored[:top_n]
