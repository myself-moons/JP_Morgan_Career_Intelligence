import json
import math
import re
from collections import Counter
from typing import Dict, Any, List, Optional, Set, Tuple
import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import JobListing, JobSkill, Skill
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


_DOMAIN_STOPWORDS: Set[str] = {
    "the", "and", "for", "with", "that", "this", "from", "are", "you", "your", "will", "have",
    "has", "our", "who", "all", "any", "not", "but", "can", "into", "more", "other", "such",
    "within", "across", "using", "based", "including", "related", "strong", "ability", "skills",
    "skill", "experience", "years", "year", "work", "working", "team", "teams", "role", "roles",
    "business", "jpmorgan", "chase", "jpmc", "firm", "global", "client", "clients", "support",
    "manage", "management", "ensure", "deliver", "develop", "build", "create", "required",
    "preferred", "qualifications", "responsibilities", "degree", "bachelor", "bachelors",
    "master", "masters", "knowledge", "understanding", "excellent", "communication",
    "environment", "solutions", "processes", "process", "projects", "project", "data",
}


def _tokenize_meaningful(text: str) -> List[str]:
    tokens = re.findall(r"[a-z][a-z0-9+#/-]{1,}", (text or "").lower())
    return [t for t in tokens if len(t) >= 3 and t not in _DOMAIN_STOPWORDS]


def _extract_candidate_level(resume_text: str) -> int:
    """Infers candidate career level: 1=Entry/Analyst (0-2y), 2=Mid/Associate (3-5y), 3=Senior/Lead (5-7y), 4=VP/Director (7+y)."""
    lower = (resume_text or "").lower()
    year_matches = [int(y) for y in re.findall(r"(\d+)\+?\s*(?:years?|yrs?)", lower)]
    max_years = max(year_matches) if year_matches else 0
    has_early_signals = any(
        kw in lower for kw in ("intern", "internship", "pursuing", "b.sc", "m.sc", "student", "entry")
    )
    if any(kw in lower for kw in ("vice president", "managing director", "executive director")) or max_years >= 7:
        return 4
    if any(kw in lower for kw in ("senior ", "lead ", "principal ", "staff ")) or max_years >= 5:
        return 3
    if max_years >= 3 and not has_early_signals:
        return 2
    return 1


def _extract_job_level(job: JobListing) -> Tuple[int, str]:
    """Infers job seniority level (1..4) and readable tier label."""
    title_l = (job.title or "").lower()
    req_l = f"{job.qualifications or ''} {job.responsibilities or ''}".lower()
    year_matches = [int(y) for y in re.findall(r"(\d+)\+?\s*(?:to\s*\d+\s*)?(?:years?|yrs?)", f"{title_l} {req_l}")]
    req_years = max(year_matches) if year_matches else 0

    level = 1
    if any(kw in title_l for kw in ("vice president", "executive director", "managing director")) or re.search(r"\bvp\b", title_l):
        level = 4
    elif any(kw in title_l for kw in ("lead ", "principal", "senior", "sr.", "manager")):
        level = 3
    elif "associate" in title_l or "specialist" in title_l:
        level = 2

    if req_years >= 7:
        level = max(level, 4)
    elif req_years >= 5:
        level = max(level, 3)
    elif req_years >= 3:
        level = max(level, 2)

    labels = {1: "Early Career / Analyst", 2: "Mid-Level / Associate", 3: "Senior / Lead", 4: "Executive / VP"}
    return level, labels[level]


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


def _extract_all_skills_with_patterns(
    text: str,
    skill_patterns: Dict[str, List[re.Pattern]],
) -> Set[str]:
    if not text:
        return set()
    lower = text.lower()
    found: Set[str] = set()
    for canonical, patterns in skill_patterns.items():
        if any(p.search(lower) for p in patterns):
            found.add(canonical)
    return found


def _offline_explainable_match(
    resume_text: str,
    job: JobListing,
    resume_skills_override: Optional[Set[str]] = None,
    job_req_skills_override: Optional[Set[str]] = None,
    job_pref_skills_override: Optional[Set[str]] = None,
    text_similarity_score: Optional[int] = None,
    candidate_level_override: Optional[int] = None,
) -> ExplainableMatchResponse:
    """
    Deterministic skill + full-text domain + seniority matcher used for Quick Estimates
    when offline or before running Vault AI comparison.
    """
    resume_skills = (
        resume_skills_override
        if resume_skills_override is not None
        else set(_extract_taxonomy_skills(resume_text))
    )

    if job_req_skills_override is not None or job_pref_skills_override is not None:
        req_skills = set(job_req_skills_override or set())
        pref_skills = set(job_pref_skills_override or set()) - req_skills
        job_skills = req_skills | pref_skills
    else:
        job_full_text = f"{job.title} {job.role_family} {job.summary or ''} {job.responsibilities or ''} {job.qualifications or ''} {job.preferred_qualifications or ''}"
        job_skills = set(_extract_taxonomy_skills(job_full_text))
        required_text = f"{job.responsibilities or ''} {job.qualifications or ''}"
        req_skills = set(_extract_taxonomy_skills(required_text)) or job_skills
        pref_skills = job_skills - req_skills

    matched = sorted(list(resume_skills.intersection(job_skills)))
    missing = sorted(list(job_skills.difference(resume_skills)))

    # 1. Weighted skill coverage with breadth smoothing (prevents thin 1/1 JDs hitting 100%)
    if not job_skills:
        tech_score = 35
    else:
        matched_weight = sum(2.0 for s in req_skills if s in resume_skills) + sum(
            1.0 for s in pref_skills if s in resume_skills
        )
        total_weight = (len(req_skills) * 2.0) + (len(pref_skills) * 1.0)
        # Prior smoothing (+4.0 weight) rewards multi-skill engineering matches over 1-keyword JDs
        smoothed_ratio = matched_weight / (total_weight + 4.0)
        tech_score = min(98, max(12, int(round(smoothed_ratio * 105))))

    # 2. Job-specific domain / JD text alignment (never ignores actual JD content)
    if text_similarity_score is not None:
        domain_score = text_similarity_score
    else:
        r_toks = set(_tokenize_meaningful(resume_text))
        j_toks = set(_tokenize_meaningful(
            f"{job.title} {job.summary or ''} {job.responsibilities or ''} {job.qualifications or ''}"
        ))
        if j_toks:
            cov_ratio = len(r_toks.intersection(j_toks)) / max(min(len(j_toks), 35), 1)
            domain_score = min(95, max(15, int(round(cov_ratio * 115))))
        else:
            domain_score = 40

    # 3. Seniority & years-of-experience alignment
    cand_level = candidate_level_override if candidate_level_override is not None else _extract_candidate_level(resume_text)
    job_level, job_level_label = _extract_job_level(job)
    level_gap = job_level - cand_level
    if level_gap <= 0:
        exp_score = 90
    elif level_gap == 1:
        exp_score = 62
    elif level_gap == 2:
        exp_score = 35
    else:
        exp_score = 15

    raw_overall = int(round(tech_score * 0.50 + domain_score * 0.25 + exp_score * 0.25))
    # Cap score when a candidate faces a steep seniority barrier (e.g., Analyst -> VP)
    if level_gap >= 3:
        overall_score = min(raw_overall, 48)
    elif level_gap == 2:
        overall_score = min(raw_overall, 64)
    else:
        overall_score = max(5, min(98, raw_overall))

    # Readiness Verdict
    if overall_score >= 80:
        verdict = "Role-Ready / Strong Match"
        summary = f"Strong alignment for {job.title}. Your background in {', '.join(matched[:3]) or 'software/data'} maps cleanly to this position's core requirements."
    elif overall_score >= 60:
        verdict = "Strong Contender with Minor Gaps"
        summary = f"Good baseline overlap for {job.title}. Strengthening emphasis on {', '.join(missing[:2]) or 'role domain depth'} will boost readiness."
    elif overall_score >= 40:
        verdict = "Moderate Fit - Targeted Upskilling Needed"
        summary = f"Partial overlap for {job.title} ({job_level_label}). Role expects capabilities in {', '.join(missing[:3]) or 'specialized domain/seniority'} not yet prominent in your profile."
    else:
        verdict = "Significant Preparation Required"
        summary = f"Low current overlap with {job.title} ({job_level_label}). Focus on building verifiable project evidence around {', '.join(missing[:3]) or 'core role skills'}."

    recommendations: List[str] = []
    if missing:
        recommendations.append(
            f"Highlight or incorporate experience with {missing[0]} and {missing[1] if len(missing) > 1 else 'related tools'} in your project or experience descriptions."
        )
    if matched:
        recommendations.append(
            f"Prominently emphasize demonstrated metrics for {', '.join(matched[:3])} in the top third of your resume."
        )
    recommendations.append(
        "Tailor your profile summary specifically toward JPMorgan Chase's expectations for this role family."
    )

    return ExplainableMatchResponse(
        overall_score=overall_score,
        readiness_verdict=verdict,
        summary_reasoning=summary,
        dimensions={
            "technical_skills": DimensionDetail(
                score=tech_score,
                reasoning=f"Matched {len(matched)} of {len(job_skills)} extracted role skills ({', '.join(matched[:4]) or 'none'})."
            ),
            "domain_knowledge": DimensionDetail(
                score=domain_score,
                reasoning=f"Evaluated JD terminology overlap against JPMorgan Chase {job.role_family.split(':')[0]} expectations."
            ),
            "experience_alignment": DimensionDetail(
                score=exp_score,
                reasoning=f"Compared profile seniority against {job_level_label} scope."
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


def _score_to_verdict(score: int) -> str:
    if score >= 80:
        return "Role-Ready / Strong Match"
    if score >= 60:
        return "Strong Contender with Minor Gaps"
    if score >= 40:
        return "Moderate Fit - Targeted Upskilling Needed"
    return "Significant Preparation Required"


def rank_top_jobs_for_resume(
    resume_text: str,
    jobs: List[JobListing],
    top_n: Optional[int] = 5,
    db: Optional[Session] = None,
    ai_scores: Optional[Dict[int, Tuple[int, str]]] = None,
) -> List[TopJobMatch]:
    """
    Rapidly scores and ranks available JPMC jobs against a candidate profile.
    Uses DB Skill/JobSkill + TF-IDF text overlap + seniority checks for local Quick Estimates,
    and automatically overrides with saved Vault AI scores when available.
    """
    if not jobs:
        return []

    resume_skill_set: Optional[Set[str]] = None
    job_req_map: Dict[int, Set[str]] = {}
    job_pref_map: Dict[int, Set[str]] = {}

    if db is not None:
        all_skills = db.query(Skill).all()
        skill_patterns: Dict[str, List[re.Pattern]] = {}
        for sk in all_skills:
            terms = [sk.canonical_name] + [al.alias_text for al in sk.aliases]
            skill_patterns[sk.canonical_name] = [
                re.compile(r"(?i)\b" + re.escape(t.lower()) + r"\b")
                for t in terms
                if t and t.strip()
            ]
        resume_skill_set = _extract_all_skills_with_patterns(resume_text, skill_patterns)

        job_ids = [j.id for j in jobs]
        js_rows = (
            db.query(JobSkill.job_id, Skill.canonical_name, JobSkill.requirement_type)
            .join(Skill, JobSkill.skill_id == Skill.id)
            .filter(JobSkill.job_id.in_(job_ids), JobSkill.review_status != "Rejected")
            .all()
        )
        for jid, sname, rtype in js_rows:
            if (rtype or "").lower() == "preferred":
                job_pref_map.setdefault(jid, set()).add(sname)
            else:
                job_req_map.setdefault(jid, set()).add(sname)

    # Precompute corpus IDF across jobs for accurate domain text alignment
    cand_tokens = _tokenize_meaningful(resume_text)
    cand_token_set = set(cand_tokens)
    cand_level = _extract_candidate_level(resume_text)

    job_token_sets: Dict[int, Set[str]] = {}
    df_counts: Counter = Counter()
    for job in jobs:
        j_text = f"{job.title} {job.title} {job.summary or ''} {job.responsibilities or ''} {job.qualifications or ''}"
        toks = set(_tokenize_meaningful(j_text))
        job_token_sets[job.id] = toks
        for t in toks:
            df_counts[t] += 1

    num_jobs = max(len(jobs), 1)
    scored: List[TopJobMatch] = []
    for job in jobs:
        j_toks = job_token_sets[job.id]
        if j_toks:
            total_idf = sum(math.log((num_jobs + 1) / (df_counts[t] + 1)) + 1.0 for t in j_toks)
            overlap_idf = sum(
                math.log((num_jobs + 1) / (df_counts[t] + 1)) + 1.0
                for t in j_toks.intersection(cand_token_set)
            )
            text_sim = min(96, max(12, int(round((overlap_idf / max(total_idf, 1e-6)) * 220))))
        else:
            text_sim = 35

        evaluation = _offline_explainable_match(
            resume_text,
            job,
            resume_skills_override=resume_skill_set,
            job_req_skills_override=job_req_map.get(job.id) if db is not None else None,
            job_pref_skills_override=job_pref_map.get(job.id) if db is not None else None,
            text_similarity_score=text_sim,
            candidate_level_override=cand_level,
        )

        final_score = evaluation.overall_score
        is_ai = False
        score_source = "Quick Estimate"
        model_used = None
        verdict = evaluation.readiness_verdict

        if ai_scores and job.id in ai_scores:
            ai_val, ai_model = ai_scores[job.id]
            final_score = max(0, min(100, int(ai_val)))
            is_ai = True
            score_source = "AI Score"
            model_used = ai_model
            verdict = _score_to_verdict(final_score)

        scored.append(
            TopJobMatch(
                job_id=job.id,
                title=job.title,
                external_job_id=job.external_job_id,
                role_family=job.role_family,
                score=final_score,
                is_ai_score=is_ai,
                score_source=score_source,
                model_used=model_used,
                matched_skills=evaluation.verified_matched_skills[:5],
                readiness_verdict=verdict,
                capture_date=job.capture_date,
                source_url=job.source_url,
            )
        )

    # Sort descending by score (preferring AI-verified scores & richer matched skills on ties)
    scored.sort(key=lambda x: (x.score, 1 if x.is_ai_score else 0, len(x.matched_skills)), reverse=True)
    return scored[:top_n] if top_n is not None else scored
