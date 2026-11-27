import hashlib
import json
import re
from typing import Dict, List, Optional, Tuple
import numpy as np
import requests
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import check_ai_rate_limit
from app.core.config import settings
from app.models.entities import (
    AICache,
    ExperienceChunk,
    ExperienceEntry,
    JobListing,
    JobSkill,
    ResumeDocument,
    Skill,
    UserJobAIScore,
    utcnow,
)
from app.models.schemas import (
    DashboardSummaryResponse,
    ExperienceEntryCreate,
    ExperienceEntryOut,
    ExperienceEntryUpdate,
    PerJobComparison,
    RetrievedChunkPreview,
    TopJobMatch,
    VaultCompareResponse,
)
from app.services.analytics_service import compute_skill_coverage
from app.services.llm_matcher import rank_top_jobs_for_resume
from app.services.taxonomy_service import resolve_or_create_canonical_skill


def redact_pii(text: str) -> str:
    """Scrubs emails, phone numbers, and personal URLs before sending text to external AI APIs."""
    if not text:
        return ""
    scrubbed = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL]", text)
    scrubbed = re.sub(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)", "[PHONE]", scrubbed)
    scrubbed = re.sub(r"https?://(?:www\.)?(?:linkedin\.com|github\.com|kaggle\.com)/\S+", "[PROFILE_URL]", scrubbed)
    return scrubbed


def _chunk_text(text: str, max_chars: int = 750) -> List[str]:
    """Splits narrative into clean paragraph/sentence chunks for Mini-RAG retrieval."""
    clean = (text or "").strip()
    if not clean:
        return []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", clean) if p.strip()]
    chunks: List[str] = []
    current = ""
    for p in paragraphs:
        if len(current) + len(p) + 2 <= max_chars:
            current = f"{current}\n\n{p}".strip() if current else p
        else:
            if current:
                chunks.append(current)
            if len(p) <= max_chars:
                current = p
            else:
                # Split oversized paragraph on sentence boundaries
                sentences = re.split(r"(?<=[.!?])\s+", p)
                buf = ""
                for s in sentences:
                    if len(buf) + len(s) + 1 <= max_chars:
                        buf = f"{buf} {s}".strip() if buf else s
                    else:
                        if buf:
                            chunks.append(buf)
                        buf = s[:max_chars]
                current = buf
    if current:
        chunks.append(current)
    return chunks


def _batch_embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """Calls Gemini batchEmbedContents (gemini-embedding-001) once for uncached chunks."""
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key or not texts:
        return None
    model = settings.GEMINI_EMBEDDING_MODEL or "gemini-embedding-001"
    model_path = f"models/{model}"
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_path}:batchEmbedContents?key={api_key}"
    payload = {
        "requests": [
            {
                "model": model_path,
                "content": {"parts": [{"text": redact_pii(t)[:6000]}]},
            }
            for t in texts
        ]
    }
    try:
        resp = requests.post(url, json=payload, timeout=20)
        if resp.status_code == 200:
            embeddings = resp.json().get("embeddings", [])
            if len(embeddings) == len(texts):
                return [e.get("values", []) for e in embeddings]
    except Exception:
        pass
    return None


def _sync_entry_chunks(db: Session, entry: ExperienceEntry, embed_if_configured: bool = False) -> None:
    """Rebuilds chunks for an ExperienceEntry while reusing cached embeddings for identical hashes."""
    full_block = (
        f"Title: {entry.title}\n"
        f"Context: {entry.organization_or_project or 'Personal / Academic'}\n"
        f"Role: {entry.contribution_note or 'Not specified'}\n"
        f"Narrative: {entry.detailed_narrative}"
    )
    chunk_texts = _chunk_text(full_block)
    model_name = settings.GEMINI_EMBEDDING_MODEL or "gemini-embedding-001"

    # Reuse existing embeddings for unchanged chunk hashes
    existing_chunks = db.query(ExperienceChunk).filter(ExperienceChunk.entry_id == entry.id).all()
    hash_to_vec: Dict[str, str] = {
        c.content_hash: c.embedding_json
        for c in existing_chunks
        if c.embedding_json and c.embedding_model == model_name
    }

    # Delete old chunks cleanly while keeping SQLAlchemy identity map synced
    db.query(ExperienceChunk).filter(ExperienceChunk.entry_id == entry.id).delete(synchronize_session="fetch")
    db.flush()
    db.expire(entry, ["chunks"])

    new_chunks: List[ExperienceChunk] = []
    missing_indices: List[int] = []
    missing_texts: List[str] = []

    for idx, ctext in enumerate(chunk_texts):
        chash = hashlib.sha256(f"{model_name}:{ctext}".encode("utf-8")).hexdigest()
        cached_vec = hash_to_vec.get(chash)
        chunk = ExperienceChunk(
            user_id=entry.user_id,
            entry_id=entry.id,
            chunk_index=idx,
            chunk_text=ctext,
            content_hash=chash,
            embedding_json=cached_vec,
            embedding_model=model_name if cached_vec else None,
        )
        new_chunks.append(chunk)
        if not cached_vec:
            missing_indices.append(idx)
            missing_texts.append(ctext)

    if embed_if_configured and missing_texts:
        vectors = _batch_embed_texts(missing_texts)
        if vectors:
            for list_pos, chunk_idx in enumerate(missing_indices):
                vec = vectors[list_pos]
                if vec:
                    new_chunks[chunk_idx].embedding_json = json.dumps(vec)
                    new_chunks[chunk_idx].embedding_model = model_name

    for ch in new_chunks:
        db.add(ch)
    db.commit()


def _parse_tags(raw: str) -> List[str]:
    try:
        data = json.loads(raw or "[]")
        if isinstance(data, list):
            return [str(x) for x in data]
    except Exception:
        pass
    return []


def _resolve_tags(db: Session, tags: List[str]) -> List[str]:
    resolved: List[str] = []
    seen = set()
    for t in tags:
        clean = (t or "").strip()
        if not clean:
            continue
        try:
            skill, _, _ = resolve_or_create_canonical_skill(clean, db)
            if skill.canonical_name not in seen:
                seen.add(skill.canonical_name)
                resolved.append(skill.canonical_name)
        except ValueError:
            continue
    return resolved


def _to_entry_out(entry: ExperienceEntry) -> ExperienceEntryOut:
    chunks = entry.chunks or []
    return ExperienceEntryOut(
        id=entry.id,
        title=entry.title,
        organization_or_project=entry.organization_or_project,
        contribution_note=entry.contribution_note,
        detailed_narrative=entry.detailed_narrative,
        skill_tags=_parse_tags(entry.skill_tags),
        chunk_count=len(chunks),
        has_embeddings=any(bool(c.embedding_json) for c in chunks),
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def list_experience_entries(db: Session, user_id: int) -> List[ExperienceEntryOut]:
    entries = (
        db.query(ExperienceEntry)
        .filter(ExperienceEntry.user_id == user_id)
        .order_by(ExperienceEntry.updated_at.desc(), ExperienceEntry.id.desc())
        .all()
    )
    return [_to_entry_out(e) for e in entries]


def create_experience_entry(db: Session, user_id: int, payload: ExperienceEntryCreate) -> ExperienceEntryOut:
    resolved_tags = _resolve_tags(db, payload.skill_tags)
    entry = ExperienceEntry(
        user_id=user_id,
        title=payload.title.strip(),
        organization_or_project=payload.organization_or_project.strip() if payload.organization_or_project else None,
        contribution_note=payload.contribution_note.strip() if payload.contribution_note else None,
        detailed_narrative=payload.detailed_narrative.strip(),
        skill_tags=json.dumps(resolved_tags),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    # Chunk immediately locally (0 API calls unless AI comparison is triggered)
    _sync_entry_chunks(db, entry, embed_if_configured=False)
    db.refresh(entry)
    return _to_entry_out(entry)


def update_experience_entry(
    db: Session,
    user_id: int,
    entry_id: int,
    payload: ExperienceEntryUpdate,
) -> Optional[ExperienceEntryOut]:
    entry = (
        db.query(ExperienceEntry)
        .filter(ExperienceEntry.id == entry_id, ExperienceEntry.user_id == user_id)
        .first()
    )
    if not entry:
        return None
    if payload.title is not None:
        entry.title = payload.title.strip()
    if payload.organization_or_project is not None:
        entry.organization_or_project = payload.organization_or_project.strip() or None
    if payload.contribution_note is not None:
        entry.contribution_note = payload.contribution_note.strip() or None
    if payload.detailed_narrative is not None:
        entry.detailed_narrative = payload.detailed_narrative.strip()
    if payload.skill_tags is not None:
        entry.skill_tags = json.dumps(_resolve_tags(db, payload.skill_tags))
    entry.updated_at = utcnow()
    db.commit()
    db.refresh(entry)
    _sync_entry_chunks(db, entry, embed_if_configured=False)
    db.refresh(entry)
    return _to_entry_out(entry)


def delete_experience_entry(db: Session, user_id: int, entry_id: int) -> bool:
    entry = (
        db.query(ExperienceEntry)
        .filter(ExperienceEntry.id == entry_id, ExperienceEntry.user_id == user_id)
        .first()
    )
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


def _retrieve_relevant_chunks(
    db: Session,
    user_id: int,
    query_text: str,
    top_k: int = 6,
    use_embeddings: bool = True,
) -> List[RetrievedChunkPreview]:
    """Retrieves top-K Experience Vault chunks using cosine similarity or keyword overlap fallback."""
    entries = db.query(ExperienceEntry).filter(ExperienceEntry.user_id == user_id).all()
    if not entries:
        return []

    entry_by_id = {e.id: e for e in entries}
    for e in entries:
        if not e.chunks:
            _sync_entry_chunks(db, e, embed_if_configured=use_embeddings)
        elif use_embeddings and any(not c.embedding_json for c in e.chunks):
            _sync_entry_chunks(db, e, embed_if_configured=True)

    chunks = db.query(ExperienceChunk).filter(ExperienceChunk.user_id == user_id).all()
    if not chunks:
        return []

    # Vector similarity path (gemini-embedding-001)
    if use_embeddings and settings.GEMINI_API_KEY.strip():
        vec_chunks = [c for c in chunks if c.embedding_json]
        if vec_chunks:
            q_vecs = _batch_embed_texts([query_text])
            if q_vecs and q_vecs[0]:
                q_arr = np.array(q_vecs[0], dtype=np.float32)
                q_norm = np.linalg.norm(q_arr) + 1e-9
                scored: List[Tuple[float, ExperienceChunk]] = []
                for c in vec_chunks:
                    try:
                        c_arr = np.array(json.loads(c.embedding_json), dtype=np.float32)
                        sim = float(np.dot(q_arr, c_arr) / (q_norm * (np.linalg.norm(c_arr) + 1e-9)))
                        scored.append((sim, c))
                    except Exception:
                        continue
                if scored:
                    scored.sort(key=lambda x: -x[0])
                    return [
                        RetrievedChunkPreview(
                            entry_title=entry_by_id[c.entry_id].title if c.entry_id in entry_by_id else "Experience",
                            chunk_text=c.chunk_text,
                            similarity=round(sim, 3),
                        )
                        for sim, c in scored[:top_k]
                    ]

    # Deterministic keyword overlap fallback (0 API calls)
    q_tokens = set(re.findall(r"[a-z0-9]{2,}", query_text.lower()))
    kw_scored: List[Tuple[float, ExperienceChunk]] = []
    for c in chunks:
        c_tokens = set(re.findall(r"[a-z0-9]{2,}", c.chunk_text.lower()))
        overlap = len(q_tokens.intersection(c_tokens))
        sim = round(overlap / max(len(q_tokens), 1), 3)
        kw_scored.append((sim, c))
    kw_scored.sort(key=lambda x: -x[0])
    return [
        RetrievedChunkPreview(
            entry_title=entry_by_id[c.entry_id].title if c.entry_id in entry_by_id else "Experience",
            chunk_text=c.chunk_text,
            similarity=sim,
        )
        for sim, c in kw_scored[:top_k]
    ]


def _compute_profile_hash(
    user_id: int,
    entries: List[ExperienceEntry],
    active_resume: Optional[ResumeDocument],
) -> str:
    vault_fp = "|".join(f"{e.id}:{e.updated_at.isoformat()}:{e.detailed_narrative}" for e in entries)
    resume_fp = f"{active_resume.id}:{len(active_resume.raw_text or '')}" if active_resume else "no_resume"
    return hashlib.sha256(f"{user_id}|{vault_fp}|{resume_fp}".encode("utf-8")).hexdigest()


def _upsert_ai_job_scores(
    db: Session,
    user_id: int,
    profile_hash: str,
    model_used: str,
    per_job_list: List[PerJobComparison],
) -> None:
    """Persists AI-evaluated fit scores per user+job for Dashboard display."""
    changed = False
    for pj in per_job_list:
        if not pj.is_ai_score or pj.fit_score is None:
            continue
        existing = (
            db.query(UserJobAIScore)
            .filter(UserJobAIScore.user_id == user_id, UserJobAIScore.job_id == pj.job_id)
            .first()
        )
        if existing:
            existing.fit_score = pj.fit_score
            existing.profile_hash = profile_hash
            existing.model_used = model_used
            existing.summary = pj.summary
        else:
            db.add(
                UserJobAIScore(
                    user_id=user_id,
                    job_id=pj.job_id,
                    fit_score=pj.fit_score,
                    profile_hash=profile_hash,
                    model_used=model_used,
                    summary=pj.summary,
                )
            )
        changed = True
    if changed:
        db.commit()


def _extract_skill_names_for_jobs(db: Session, job_ids: List[int]) -> List[str]:
    rows = (
        db.query(Skill.canonical_name)
        .join(JobSkill, JobSkill.skill_id == Skill.id)
        .filter(JobSkill.job_id.in_(job_ids), JobSkill.review_status != "Rejected")
        .distinct()
        .all()
    )
    return sorted([r[0] for r in rows])


def compare_vault_with_jobs_ai(
    db: Session,
    user_id: int,
    job_ids: List[int],
    model_mode: str = "flash",
    force_refresh: bool = False,
) -> VaultCompareResponse:
    """
    Mini-RAG comparison of user's Experience Vault (+ fallback resume) against selected job(s).
    Strictly checks SHA-256 SQLite cache BEFORE making any Gemini request, enforces rate limit,
    redacts PII, and degrades cleanly offline.
    """
    jobs = (
        db.query(JobListing)
        .filter(JobListing.id.in_(job_ids[:3]))
        .filter(or_(JobListing.user_id.is_(None), JobListing.user_id == user_id))
        .all()
    )
    if not jobs:
        raise ValueError("No accessible job listings found for comparison.")

    # Preserve caller selection order (up to 3 roles)
    job_by_id = {j.id: j for j in jobs}
    jobs = [job_by_id[jid] for jid in job_ids[:3] if jid in job_by_id]

    entries = db.query(ExperienceEntry).filter(ExperienceEntry.user_id == user_id).all()
    active_resume = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == user_id)
        .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.asc())
        .first()
    )

    if model_mode == "pro":
        model_name = settings.GEMINI_DEEP_MODEL or "gemini-pro-latest"
    elif model_mode == "flash":
        model_name = settings.GEMINI_MODEL or "gemini-3.8-flash"
    else:
        model_name = model_mode.strip() or settings.GEMINI_MODEL or "gemini-3.8-flash"

    # Fingerprint all inputs for SHA-256 anti-hoarding cache
    profile_hash = _compute_profile_hash(user_id, entries, active_resume)
    jobs_fp = "|".join(f"{j.id}:{j.updated_at.isoformat()}" for j in jobs)
    content_hash = hashlib.sha256(f"{profile_hash}|{jobs_fp}".encode("utf-8")).hexdigest()

    if not force_refresh:
        cached = (
            db.query(AICache)
            .filter(
                AICache.user_id == user_id,
                AICache.cache_type == "vault_compare",
                AICache.content_hash == content_hash,
                AICache.model_used == model_name,
            )
            .first()
        )
        if cached:
            data = json.loads(cached.response_json)
            data["is_cached"] = True
            resp_obj = VaultCompareResponse(**data)
            if resp_obj.is_llm_powered and resp_obj.per_job_results:
                _upsert_ai_job_scores(db, user_id, profile_hash, resp_obj.model_used, resp_obj.per_job_results)
            return resp_obj

    # Build job query text for retrieval
    jd_query = "\n".join(
        f"{j.title} ({j.role_family}): {j.responsibilities or ''} {j.qualifications or ''} {j.preferred_qualifications or ''}"
        for j in jobs
    )
    api_key = settings.GEMINI_API_KEY.strip()
    retrieved = _retrieve_relevant_chunks(db, user_id, jd_query, top_k=6, use_embeddings=bool(api_key))

    jd_skills = _extract_skill_names_for_jobs(db, [j.id for j in jobs])
    vault_text_blob = " ".join(
        f"{e.title} {e.detailed_narrative} {' '.join(_parse_tags(e.skill_tags))}"
        for e in entries
    )
    resume_text_blob = (active_resume.raw_text or "") if active_resume else ""
    combined_user_text = f"{vault_text_blob} {resume_text_blob}".lower()

    # Deterministic fallback insights (always ready even without API key)
    covered = [s for s in jd_skills if s.lower() in combined_user_text]
    missing = [s for s in jd_skills if s.lower() not in combined_user_text]

    if api_key and (entries or active_resume):
        check_ai_rate_limit(user_id)
        vault_context_str = "\n\n".join(
            f"[{c.entry_title} | match={c.similarity}]\n{redact_pii(c.chunk_text)}"
            for c in retrieved
        ) or "No Experience Vault entries yet."

        resume_snippet = redact_pii(resume_text_blob[:3000]) if resume_text_blob else "No resume uploaded."
        jobs_snippet = "\n\n".join(
            f"JOB_ID={j.id} | TITLE={j.title} ({j.role_family})\n"
            f"Qualifications: {(j.qualifications or '')[:1200]}\n"
            f"Responsibilities: {(j.responsibilities or j.original_description or '')[:1200]}"
            for j in jobs
        )

        prompt = f"""
You are a practical technical career advisor. Compare the candidate's detailed Experience Vault history and resume INDIVIDUALLY against EACH target job listed below (do NOT merge multiple jobs into one generic answer).

Retrieved Experience Vault Details:
{vault_context_str}

Active Resume Text (redacted):
{resume_snippet}

Target Jobs:
{jobs_snippet}

Return strictly valid JSON with plain-text bullet points (NO LaTeX commands, NO exaggerated claims), containing one entry in `per_job_results` for EACH target job:
{{
  "summary": "1-2 sentence high-level takeaway across the selected roles.",
  "per_job_results": [
    {{
      "job_id": 1,
      "job_title": "Exact job title",
      "fit_score": 72,
      "summary": "2-sentence honest fit assessment specifically for THIS job.",
      "strengths_from_history": ["Strength backed by Vault/resume for THIS job"],
      "gaps": ["Missing skill or qualification specifically for THIS job"],
      "resume_suggestions": ["Plain-text bullet or wording tweak for Overleaf tailored to THIS job"]
    }}
  ]
}}

Scoring rule for `fit_score` (integer 0-100):
- Factor in required technical skills, specialized domain background, and seniority/years of experience.
- Be realistic and honest: 20-55 if key domain background or senior years (e.g. Vice President 7+ yrs vs early-career) are missing; 56-75 if core tools match with moderate gaps; 76-92 if strong alignment on skills, domain, and level.
"""
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.2},
        }
        candidate_models = []
        for m in [model_name, "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"]:
            if m and m not in candidate_models:
                candidate_models.append(m)

        last_err_note = None
        for try_model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{try_model}:generateContent?key={api_key}"
            try:
                resp = requests.post(url, json=payload, timeout=30)
                if resp.status_code == 200:
                    candidates = resp.json().get("candidates", [])
                    if candidates:
                        raw_json = candidates[0]["content"]["parts"][0]["text"].strip()
                        parsed = json.loads(raw_json)
                        raw_per_job = parsed.get("per_job_results", [])
                        per_job_list: List[PerJobComparison] = []
                        for j in jobs:
                            matched_pj = next(
                                (p for p in raw_per_job if int(p.get("job_id", -1)) == j.id),
                                None,
                            )
                            if matched_pj:
                                raw_fit = matched_pj.get("fit_score")
                                parsed_fit: Optional[int] = None
                                if raw_fit is not None:
                                    try:
                                        parsed_fit = max(0, min(100, int(round(float(raw_fit)))))
                                    except (TypeError, ValueError):
                                        parsed_fit = None
                                per_job_list.append(
                                    PerJobComparison(
                                        job_id=j.id,
                                        job_title=j.title,
                                        external_job_id=j.external_job_id,
                                        fit_score=parsed_fit,
                                        is_ai_score=parsed_fit is not None,
                                        summary=matched_pj.get("summary", ""),
                                        strengths_from_history=matched_pj.get("strengths_from_history", [])[:5],
                                        gaps=matched_pj.get("gaps", [])[:5],
                                        resume_suggestions=matched_pj.get("resume_suggestions", [])[:5],
                                    )
                                )
                        first_pj = per_job_list[0] if per_job_list else None
                        result = VaultCompareResponse(
                            job_ids=[j.id for j in jobs],
                            job_titles=[j.title for j in jobs],
                            strengths_from_history=(
                                first_pj.strengths_from_history if first_pj else parsed.get("strengths_from_history", [])[:5]
                            ),
                            gaps=(first_pj.gaps if first_pj else parsed.get("gaps", [])[:5]),
                            resume_suggestions=(
                                first_pj.resume_suggestions if first_pj else parsed.get("resume_suggestions", [])[:5]
                            ),
                            summary=parsed.get("summary", first_pj.summary if first_pj else "AI comparison complete."),
                            per_job_results=per_job_list,
                            retrieved_context=retrieved,
                            is_llm_powered=True,
                            is_cached=False,
                            model_used=try_model,
                            fallback_note=(
                                f"Requested {model_name} unavailable ({last_err_note}); used {try_model}."
                                if try_model != model_name and last_err_note
                                else None
                            ),
                        )
                        existing_cache = (
                            db.query(AICache)
                            .filter(
                                AICache.user_id == user_id,
                                AICache.cache_type == "vault_compare",
                                AICache.content_hash == content_hash,
                                AICache.model_used == model_name,
                            )
                            .first()
                        )
                        if existing_cache:
                            existing_cache.response_json = result.model_dump_json()
                        else:
                            db.add(
                                AICache(
                                    user_id=user_id,
                                    cache_type="vault_compare",
                                    content_hash=content_hash,
                                    model_used=model_name,
                                    response_json=result.model_dump_json(),
                                )
                            )
                        db.commit()
                        _upsert_ai_job_scores(db, user_id, profile_hash, try_model, per_job_list)
                        return result
                else:
                    last_err_note = f"Gemini HTTP {resp.status_code} on {try_model}"
                    if resp.status_code not in (404, 503, 429):
                        break
            except Exception as exc:
                last_err_note = f"Gemini request error ({type(exc).__name__})"

    # Clean offline / fallback response (per-job breakdown)
    per_job_offline: List[PerJobComparison] = []
    combined_for_score = f"{vault_text_blob}\n{resume_text_blob}"
    for j in jobs:
        j_skills = _extract_skill_names_for_jobs(db, [j.id])
        j_cov = [s for s in j_skills if s.lower() in combined_user_text]
        j_miss = [s for s in j_skills if s.lower() not in combined_user_text]
        offline_ranked = rank_top_jobs_for_resume(combined_for_score, [j], top_n=1, db=db)
        quick_score = offline_ranked[0].score if offline_ranked else 0
        if not entries and not active_resume:
            j_sum = "Add Experience Vault entries or a resume to evaluate this role."
            j_sugg = ["Add your past projects/work in Experience Vault or upload a resume."]
            quick_score = 0
        else:
            j_sum = f"{len(j_cov)} matched skill(s) and {len(j_miss)} gap(s) for {j.title}."
            j_sugg = [
                f"Highlight {', '.join(j_cov[:4])} in your resume." if j_cov else "Add measurable project metrics.",
                f"Address {', '.join(j_miss[:4])} if you have related experience." if j_miss else "Core extracted skills are covered.",
            ]
        per_job_offline.append(
            PerJobComparison(
                job_id=j.id,
                job_title=j.title,
                external_job_id=j.external_job_id,
                fit_score=quick_score if (entries or active_resume) else None,
                is_ai_score=False,
                summary=j_sum,
                strengths_from_history=j_cov[:6],
                gaps=j_miss[:6],
                resume_suggestions=j_sugg,
            )
        )

    if not entries and not active_resume:
        summary = "Add entries to your Experience Vault or upload a resume first to compare your background against these roles."
        suggestions = ["Add your past projects/work in Experience Vault or upload a PDF/DOCX resume."]
    else:
        prefix = f"AI unavailable ({last_err_note}) — showing local match: " if api_key and (entries or active_resume) and 'last_err_note' in locals() and last_err_note else "Local comparison: "
        summary = (
            f"{prefix}{len(covered)} matched skill(s) and {len(missing)} gap(s) across {len(jobs)} selected role(s)."
        )
        suggestions = [
            f"Highlight verified work for {', '.join(covered[:4])} in your resume." if covered else "Add measurable project outcomes to your resume.",
            f"Consider addressing {', '.join(missing[:4])} if you have related experience." if missing else "Your history covers the extracted skills.",
        ]

    return VaultCompareResponse(
        job_ids=[j.id for j in jobs],
        job_titles=[j.title for j in jobs],
        strengths_from_history=covered[:8],
        gaps=missing[:8],
        resume_suggestions=suggestions,
        summary=summary,
        per_job_results=per_job_offline,
        retrieved_context=retrieved,
        is_llm_powered=False,
        is_cached=False,
        model_used="offline-deterministic",
    )


def build_dashboard_summary(db: Session, user_id: int) -> DashboardSummaryResponse:
    """
    v3.0 Minimalist Dashboard with 3-Tier Ranking Source Fallback:
    1. Experience Vault entries (if user has added detailed history)
    2. Uploaded / active Resume (automatic fallback if Vault is empty)
    3. Empty prompt (if neither Vault nor Resume exists)
    Zero AI API calls! Runs 100% deterministically.
    """
    available_jobs = (
        db.query(JobListing)
        .filter(JobListing.status != "JD unavailable")
        .filter(or_(JobListing.user_id.is_(None), JobListing.user_id == user_id))
        .all()
    )
    cov = compute_skill_coverage(db)
    skills_in_demand = [s for s in cov.skills if s.distinct_job_count > 0][:15]

    entries = db.query(ExperienceEntry).filter(ExperienceEntry.user_id == user_id).all()
    active_resume = (
        db.query(ResumeDocument)
        .filter(ResumeDocument.user_id == user_id)
        .order_by(ResumeDocument.is_active.desc(), ResumeDocument.id.asc())
        .first()
    )

    profile_hash = _compute_profile_hash(user_id, entries, active_resume)
    ai_score_rows = (
        db.query(UserJobAIScore)
        .filter(UserJobAIScore.user_id == user_id, UserJobAIScore.profile_hash == profile_hash)
        .all()
    )
    ai_scores = {row.job_id: (row.fit_score, row.model_used) for row in ai_score_rows}

    if entries:
        vault_blob = "\n".join(
            f"{e.title} {e.organization_or_project or ''} {' '.join(_parse_tags(e.skill_tags))} {e.detailed_narrative}"
            for e in entries
        )
        if active_resume and active_resume.raw_text:
            vault_blob = f"{vault_blob}\n{active_resume.raw_text}"
        top_matches = rank_top_jobs_for_resume(
            vault_blob, available_jobs, top_n=5, db=db, ai_scores=ai_scores
        )
        return DashboardSummaryResponse(
            ranking_source="experience_vault",
            source_label=f"Ranked from your Experience Vault ({len(entries)} entries)",
            empty_prompt=None,
            analysable_jobs_count=cov.analysable_count,
            top_matches=top_matches,
            skills_in_demand=skills_in_demand,
        )

    if active_resume and (active_resume.raw_text or "").strip():
        top_matches = rank_top_jobs_for_resume(
            active_resume.raw_text or "", available_jobs, top_n=5, db=db, ai_scores=ai_scores
        )
        return DashboardSummaryResponse(
            ranking_source="resume",
            source_label=f"Fallback: Ranked from Resume ({active_resume.name})",
            empty_prompt=None,
            analysable_jobs_count=cov.analysable_count,
            top_matches=top_matches,
            skills_in_demand=skills_in_demand,
        )

    return DashboardSummaryResponse(
        ranking_source="none",
        source_label="No experience history or resume added yet",
        empty_prompt="Add your work/academic history in Experience Vault or upload a resume to see tailored role rankings.",
        analysable_jobs_count=cov.analysable_count,
        top_matches=[],
        skills_in_demand=skills_in_demand,
    )
