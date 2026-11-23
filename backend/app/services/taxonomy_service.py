import re
import json
import requests
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Skill, SkillAlias, JobSkill, JobListing


# Baseline Canonical Skills and Aliases for Enterprise JPMC Roles
BASELINE_TAXONOMY = [
    # Engineering & Cloud (Technical)
    {
        "name": "Python",
        "category": "Technical",
        "description": "General purpose programming language for data engineering, scripting, and analytics.",
        "aliases": ["python", "python3", "py", "python scripting"],
    },
    {
        "name": "SQL",
        "category": "Technical",
        "description": "Structured Query Language for relational database querying, schema design, and manipulation.",
        "aliases": ["sql", "tsql", "t-sql", "postgresql", "postgres", "mysql", "oracle sql", "pl/sql", "ansi sql"],
    },
    {
        "name": "FastAPI",
        "category": "Technical",
        "description": "Modern, high-performance web framework for building APIs with Python.",
        "aliases": ["fastapi", "fast api"],
    },
    {
        "name": "Pandas",
        "category": "Technical",
        "description": "Python data analysis and manipulation library.",
        "aliases": ["pandas", "pandas dataframe"],
    },
    {
        "name": "NumPy",
        "category": "Technical",
        "description": "Python fundamental package for scientific computing with multi-dimensional arrays.",
        "aliases": ["numpy"],
    },
    {
        "name": "AWS",
        "category": "Technical",
        "description": "Amazon Web Services cloud computing platform.",
        "aliases": ["aws", "amazon web services", "s3", "ec2", "aws lambda", "cloud infrastructure"],
    },
    {
        "name": "Docker",
        "category": "Technical",
        "description": "Platform for developing, shipping, and running applications in containers.",
        "aliases": ["docker", "containerization", "containers", "dockerfile"],
    },
    {
        "name": "Git",
        "category": "Technical",
        "description": "Distributed version control system.",
        "aliases": ["git", "github", "gitlab", "version control"],
    },
    {
        "name": "REST APIs",
        "category": "Technical",
        "description": "Representational State Transfer web APIs and microservice architecture.",
        "aliases": ["rest api", "restful", "rest apis", "restful services", "web services", "microservices"],
    },
    {
        "name": "Kafka",
        "category": "Technical",
        "description": "Distributed event store and stream-processing platform.",
        "aliases": ["kafka", "apache kafka", "event streaming", "event-driven"],
    },
    {
        "name": "Spark",
        "category": "Technical",
        "description": "Unified analytics engine for large-scale data processing.",
        "aliases": ["spark", "pyspark", "apache spark"],
    },
    {
        "name": "ETL Pipelines",
        "category": "Technical",
        "description": "Extract, Transform, Load data integration workflows and pipelines.",
        "aliases": ["etl", "elt", "data pipeline", "data pipelines", "ingestion pipeline", "data integration"],
    },
    {
        "name": "Cron / Scheduling",
        "category": "Technical",
        "description": "Automated task scheduling and job coordination.",
        "aliases": ["cron", "scheduler", "airflow", "scheduled jobs", "task scheduler"],
    },
    {
        "name": "LocalStack",
        "category": "Technical",
        "description": "Fully functional local cloud emulator for AWS services.",
        "aliases": ["localstack"],
    },

    # Data Management & Governance (Family A)
    {
        "name": "Collibra",
        "category": "Governance & Quality",
        "description": "Enterprise data governance, catalog, and stewardship software platform.",
        "aliases": ["collibra", "collibra data intelligence", "collibra dgc"],
    },
    {
        "name": "Data Governance",
        "category": "Governance & Quality",
        "description": "Principled framework and standards for enterprise data lifecycle and compliance.",
        "aliases": ["data governance", "governance framework", "data policies", "governance", "data management framework"],
    },
    {
        "name": "Data Quality",
        "category": "Governance & Quality",
        "description": "Assessment, validation rules, profiling, and remediation of data integrity.",
        "aliases": ["data quality", "dq rules", "data profiling", "quality metrics", "data cleansing", "quality controls"],
    },
    {
        "name": "Metadata Management",
        "category": "Governance & Quality",
        "description": "Managing data about data including business glossaries and technical data dictionaries.",
        "aliases": ["metadata", "metadata management", "meta-data", "data dictionary", "business glossary"],
    },
    {
        "name": "Data Lineage",
        "category": "Governance & Quality",
        "description": "Tracking data provenance, transformations, and origin across system hops.",
        "aliases": ["data lineage", "lineage tracking", "traceability", "end-to-end lineage"],
    },
    {
        "name": "Data Stewardship",
        "category": "Governance & Quality",
        "description": "Accountability and oversight of operational data assets and business definitions.",
        "aliases": ["data steward", "data stewardship", "stewardship", "data owner"],
    },
    {
        "name": "Data Catalog",
        "category": "Governance & Quality",
        "description": "Organized inventory of data assets in an enterprise.",
        "aliases": ["data catalog", "cataloging", "data marketplace"],
    },
    {
        "name": "Reference Data",
        "category": "Governance & Quality",
        "description": "Classification and identification standards across systems (e.g. currencies, countries, legal entities).",
        "aliases": ["reference data", "master data", "mdm", "master data management"],
    },
    {
        "name": "BCBS 239 / Risk Data",
        "category": "Governance & Quality",
        "description": "Basel Committee standards for effective risk data aggregation and risk reporting.",
        "aliases": ["bcbs 239", "risk data aggregation", "regulatory reporting", "regulatory data"],
    },
    {
        "name": "Chief Data Office (CDO)",
        "category": "Governance & Quality",
        "description": "Enterprise organizational group dedicated to data strategy, quality, and governance.",
        "aliases": ["cdo", "chief data office", "data office"],
    },

    # Analytics & AI/ML (Family B)
    {
        "name": "Machine Learning",
        "category": "Analytics & AI",
        "description": "Algorithms and statistical models for predictive analytics and classification.",
        "aliases": ["machine learning", "ml", "statistical models", "predictive modeling", "supervised learning"],
    },
    {
        "name": "Deep Learning / GenAI",
        "category": "Analytics & AI",
        "description": "Deep neural networks, natural language processing, and Generative AI / LLMs.",
        "aliases": ["deep learning", "neural networks", "nlp", "natural language processing", "generative ai", "genai", "llm", "large language models"],
    },
    {
        "name": "Scikit-Learn",
        "category": "Analytics & AI",
        "description": "Python library for machine learning and data preprocessing.",
        "aliases": ["scikit-learn", "sklearn"],
    },
    {
        "name": "Power BI",
        "category": "Analytics & AI",
        "description": "Microsoft business analytics and visualization service.",
        "aliases": ["power bi", "powerbi", "pbi", "power bi desktop", "dax"],
    },
    {
        "name": "Tableau",
        "category": "Analytics & AI",
        "description": "Interactive data visualization software.",
        "aliases": ["tableau", "tableau desktop", "tableau server"],
    },
    {
        "name": "Alteryx",
        "category": "Analytics & AI",
        "description": "Automated data blending and preparation software.",
        "aliases": ["alteryx", "alteryx designer"],
    },
    {
        "name": "Data Modeling",
        "category": "Analytics & AI",
        "description": "Conceptual, logical, and physical data modeling for relational and analytics systems.",
        "aliases": ["data modeling", "dimensional modeling", "star schema", "entity relationship"],
    },

    # Finance, Banking & Risk (Family C)
    {
        "name": "Credit Risk",
        "category": "Finance & Risk",
        "description": "Evaluation of counterparty default risk, financial covenants, and underwriting.",
        "aliases": ["credit risk", "counterparty risk", "underwriting", "credit analysis", "credit assessment"],
    },
    {
        "name": "Market Risk",
        "category": "Finance & Risk",
        "description": "Assessment of financial losses resulting from movements in market prices and interest rates.",
        "aliases": ["market risk", "var", "value at risk", "stress testing"],
    },
    {
        "name": "Financial Analysis",
        "category": "Finance & Risk",
        "description": "Assessment of profitability, solvency, liquid assets, and corporate financial health.",
        "aliases": ["financial analysis", "fp&a", "financial planning", "cash flow", "financial modeling", "variance analysis"],
    },
    {
        "name": "Treasury & Liquidity",
        "category": "Finance & Risk",
        "description": "Management of cash, funding, interest rates, and liquidity requirements.",
        "aliases": ["treasury", "liquidity", "asset liability", "alm", "cash and liquidity"],
    },
    {
        "name": "Wholesale Payments",
        "category": "Finance & Risk",
        "description": "Corporate cash handling, wire transfers, transaction banking, and clearing networks.",
        "aliases": ["wholesale payments", "payments", "transaction banking", "swift", "clearing", "cash management"],
    },
    {
        "name": "Compliance & AML",
        "category": "Finance & Risk",
        "description": "Anti-money laundering, know-your-customer (KYC), and regulatory compliance.",
        "aliases": ["aml", "kyc", "anti-money laundering", "compliance", "regulatory compliance"],
    },

    # Core Competencies
    {
        "name": "Agile / Scrum",
        "category": "Core Competency",
        "description": "Iterative project management and software development lifecycle methodology.",
        "aliases": ["agile", "scrum", "sprints", "jira", "kanban"],
    },
    {
        "name": "Stakeholder Management",
        "category": "Core Competency",
        "description": "Collaborating effectively with business, technology, and executive leaders.",
        "aliases": ["stakeholder management", "stakeholders", "cross-functional", "client-facing"],
    },
    {
        "name": "Problem Solving",
        "category": "Core Competency",
        "description": "Analytical problem formulation, root cause analysis, and quantitative reasoning.",
        "aliases": ["problem solving", "analytical thinking", "critical thinking", "root cause analysis"],
    },
]


def seed_taxonomy_if_empty(db: Session) -> int:
    """Seeds the canonical skills and aliases into SQLite if table is empty."""
    count = db.query(Skill).count()
    if count > 0:
        return count

    added_count = 0
    seen_global_aliases = set()

    # Pre-populate with existing aliases in DB if any
    for existing_alias in db.query(SkillAlias.alias_text).all():
        seen_global_aliases.add(existing_alias[0].lower())

    for item in BASELINE_TAXONOMY:
        skill = Skill(
            canonical_name=item["name"],
            category=item["category"],
            description=item.get("description"),
        )
        db.add(skill)
        db.flush()  # Populates skill.id

        # Add aliases
        for alias in item.get("aliases", []):
            norm_alias = alias.strip().lower()
            if norm_alias and norm_alias not in seen_global_aliases:
                seen_global_aliases.add(norm_alias)
                db.add(SkillAlias(skill_id=skill.id, alias_text=norm_alias))

        added_count += 1

    db.commit()
    return added_count


def _split_into_sentences(text: str) -> List[str]:
    """Splits a body of text into clean sentence snippets."""
    if not text:
        return []
    # Split on newlines or sentence terminators (. ! ?)
    raw_splits = re.split(r"(?<=[.!?\n])\s+", text)
    sentences = []
    for s in raw_splits:
        clean = s.strip()
        # Skip bullet markers
        clean = re.sub(r"^[\s•\-\*\d\.\)]+", "", clean).strip()
        if len(clean) >= 10:
            sentences.append(clean)
    return sentences


def extract_and_save_job_skills(job: JobListing, db: Session) -> List[JobSkill]:
    """
    Extracts skills for a job description using the canonical taxonomy and alias map.
    Attaches exact sentence evidence snippets and classifies as Required vs Preferred.
    Enforces the single-count constraint per job (BR-07).
    Preserves existing user-approved/edited reviews (FR-14).
    """
    seed_taxonomy_if_empty(db)

    # Load all canonical skills and aliases into memory for fast matching
    skills = db.query(Skill).all()
    aliases = db.query(SkillAlias).all()

    # Build alias map: lowercase_alias -> (skill_id, canonical_name, category)
    alias_map: Dict[str, Tuple[int, str, str]] = {}
    for a in aliases:
        skill = next((s for s in skills if s.id == a.skill_id), None)
        if skill:
            alias_map[a.alias_text.lower()] = (skill.id, skill.canonical_name, skill.category)

    # Also map canonical names directly
    for s in skills:
        alias_map[s.canonical_name.lower()] = (s.id, s.canonical_name, s.category)

    # Sort aliases by descending length so multi-word aliases match before substrings
    sorted_aliases = sorted(alias_map.keys(), key=lambda x: len(x), reverse=True)

    # Sections to inspect with their default requirement type
    sections: List[Tuple[str, str]] = []
    if job.qualifications:
        sections.append((job.qualifications, "Required"))
    if job.responsibilities:
        sections.append((job.responsibilities, "Required"))
    if job.preferred_qualifications:
        sections.append((job.preferred_qualifications, "Preferred"))
    if job.summary:
        sections.append((job.summary, "Required"))

    # Fallback to original description if structured sections are empty
    if not sections and job.original_description:
        sections.append((job.original_description, "Required"))

    # Existing extracted records for this job
    existing_records = db.query(JobSkill).filter(JobSkill.job_id == job.id).all()
    existing_by_skill_id: Dict[int, JobSkill] = {r.skill_id: r for r in existing_records}

    detected_skills: Dict[int, Dict[str, Any]] = {}

    for text_content, default_req_type in sections:
        sentences = _split_into_sentences(text_content)
        for sentence in sentences:
            sentence_lower = sentence.lower()
            for alias in sorted_aliases:
                pattern = r"(?i)\b" + re.escape(alias) + r"\b"
                if re.search(pattern, sentence_lower):
                    skill_id, canonical_name, category = alias_map[alias]

                    # Contextual modal check: does the sentence indicate preferred/bonus?
                    req_type = default_req_type
                    if re.search(r"(?i)\b(preferred|nice to have|plus|bonus|optional|advantageous)\b", sentence):
                        req_type = "Preferred"
                    elif re.search(r"(?i)\b(required|must have|minimum|mandatory|essential|experience in)\b", sentence):
                        req_type = "Required"

                    # If already detected in this job:
                    if skill_id in detected_skills:
                        # Required overrides Preferred
                        if req_type == "Required":
                            detected_skills[skill_id]["requirement_type"] = "Required"
                            detected_skills[skill_id]["evidence_snippet"] = sentence
                    else:
                        detected_skills[skill_id] = {
                            "skill_id": skill_id,
                            "matched_alias": alias,
                            "requirement_type": req_type,
                            "evidence_snippet": sentence,
                            "confidence": 95 if req_type == "Required" else 85,
                        }

    # Save to database
    saved_records: List[JobSkill] = []
    for skill_id, data in detected_skills.items():
        existing = existing_by_skill_id.get(skill_id)
        if existing:
            # If user already approved or edited, preserve their review
            if existing.review_status in ("Accepted", "Edited"):
                saved_records.append(existing)
                continue
            # Otherwise update snippet and requirement type
            existing.matched_alias = data["matched_alias"]
            existing.requirement_type = data["requirement_type"]
            existing.evidence_snippet = data["evidence_snippet"]
            existing.confidence = data["confidence"]
            saved_records.append(existing)
        else:
            new_record = JobSkill(
                job_id=job.id,
                skill_id=skill_id,
                matched_alias=data["matched_alias"],
                requirement_type=data["requirement_type"],
                extraction_method="dictionary",
                review_status="Proposed",
                evidence_snippet=data["evidence_snippet"],
                confidence=data["confidence"],
            )
            db.add(new_record)
            saved_records.append(new_record)

    db.commit()
    return saved_records


def batch_extract_all_jobs(db: Session) -> Dict[str, Any]:
    """Runs extraction across all available jobs in the library."""
    seed_taxonomy_if_empty(db)
    jobs = db.query(JobListing).filter(JobListing.status != "JD unavailable").all()
    total_extractions = 0
    jobs_processed = 0

    for job in jobs:
        records = extract_and_save_job_skills(job, db)
        total_extractions += len(records)
        jobs_processed += 1

    return {
        "jobs_processed": jobs_processed,
        "total_extractions": total_extractions,
        "message": f"Successfully extracted skills across {jobs_processed} jobs ({total_extractions} total extractions).",
    }


def ai_disambiguate_skill(
    phrase: str,
    context: Optional[str],
    db: Session,
) -> Dict[str, Any]:
    """
    AI-assisted semantic taxonomy disambiguation (FR-42, TC-22).
    Suggests the best canonical skill mapping for an unmapped or complex phrase.
    """
    seed_taxonomy_if_empty(db)
    all_skills = db.query(Skill).all()
    canonical_names = [s.canonical_name for s in all_skills]

    # Try Google Gemini if configured
    if settings.GEMINI_API_KEY:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-flash-lite-latest:generateContent?key={settings.GEMINI_API_KEY}"
        )
        system_instruction = (
            "You are an expert HR and Financial Technology taxonomist at JPMorgan Chase. "
            "Given an ambiguous or complex skill phrase extracted from a job description, "
            "select the most appropriate canonical skill from the provided taxonomy list. "
            "Respond strictly in JSON matching this schema:\n"
            '{\n  "canonical_name": "<exact canonical name from list>",\n'
            '  "confidence": <integer between 50 and 99>,\n'
            '  "rationale": "<1-2 sentence explanation>"\n}'
        )
        user_prompt = (
            f"Ambiguous Phrase: \"{phrase}\"\n"
            f"Surrounding Context: \"{context or 'None provided'}\"\n\n"
            f"Canonical Skills Available:\n{json.dumps(canonical_names)}"
        )
        payload = {
            "contents": [{"parts": [{"text": user_prompt}]}],
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "generation_config": {"response_mime_type": "application/json", "temperature": 0.1},
        }

        try:
            resp = requests.post(url, json=payload, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    text_part = candidates[0]["content"]["parts"][0]["text"].strip()
                    parsed = json.loads(text_part)
                    matched_name = parsed.get("canonical_name")
                    matching_skill = next((s for s in all_skills if s.canonical_name.lower() == str(matched_name).lower()), None)
                    if matching_skill:
                        return {
                            "phrase": phrase,
                            "suggested_canonical_name": matching_skill.canonical_name,
                            "suggested_skill_id": matching_skill.id,
                            "confidence": int(parsed.get("confidence", 85)),
                            "rationale": str(parsed.get("rationale", "Matched via Gemini AI semantic disambiguation.")),
                            "is_llm_powered": True,
                        }
        except Exception as e:
            print(f"Gemini disambiguation failed: {e}. Falling back to deterministic matcher.")

    # Offline / Fallback heuristic matcher (TC-22 offline compliance)
    phrase_clean = phrase.lower().strip()
    best_skill: Optional[Skill] = None
    best_score = 0
    best_rationale = "Matched via token overlap with canonical dictionary."

    for s in all_skills:
        s_lower = s.canonical_name.lower()
        if s_lower in phrase_clean or phrase_clean in s_lower:
            best_skill = s
            best_score = 85
            best_rationale = f"Phrase directly contains canonical term '{s.canonical_name}'."
            break
        # Token overlap
        p_tokens = set(re.findall(r"\w+", phrase_clean))
        s_tokens = set(re.findall(r"\w+", s_lower))
        overlap = len(p_tokens.intersection(s_tokens))
        if overlap > best_score:
            best_score = overlap
            best_skill = s
            best_rationale = f"Semantic keyword overlap on {p_tokens.intersection(s_tokens)}."

    if not best_skill:
        # Default to Data Governance or Python if general
        best_skill = next((s for s in all_skills if s.canonical_name == "Data Governance"), all_skills[0])
        best_score = 60
        best_rationale = "General domain match based on JPMC core enterprise capabilities."

    return {
        "phrase": phrase,
        "suggested_canonical_name": best_skill.canonical_name,
        "suggested_skill_id": best_skill.id,
        "confidence": 75 if best_score > 0 else 60,
        "rationale": best_rationale,
        "is_llm_powered": False,
    }
