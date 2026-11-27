from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict


class JobBase(BaseModel):
    title: str = Field(..., min_length=2, description="Job title")
    company_name: str = Field(default="JPMorgan Chase", description="Company or institution name")
    external_job_id: Optional[str] = Field(None, description="External requisition or job ID")
    source_job_id: Optional[str] = Field(None, description="Oracle Cloud Requisition ID")
    location: str = Field(default="Goregaon, Mumbai", description="Job location")
    source_url: Optional[str] = Field(None, description="Posting URL")
    capture_date: str = Field(default="2026-11-17", description="Capture date (YYYY-MM-DD)")
    role_family: str = Field(..., description="Role family (e.g. Family A, Family B, Family C)")
    status: str = Field(default="Available", description="Listing status: Available, JD unavailable, etc.")
    original_description: Optional[str] = Field(None, description="Verbatim captured JD text")
    summary: Optional[str] = Field(None, description="Role overview or summary")
    responsibilities: Optional[str] = Field(None, description="Extracted responsibilities")
    qualifications: Optional[str] = Field(None, description="Extracted required qualifications")
    preferred_qualifications: Optional[str] = Field(None, description="Extracted preferred qualifications")
    context_note: Optional[str] = Field(None, description="Supplementary context or research notes")


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    source_url: Optional[str] = None
    capture_date: Optional[str] = None
    role_family: Optional[str] = None
    status: Optional[str] = None
    original_description: Optional[str] = None
    summary: Optional[str] = None
    responsibilities: Optional[str] = None
    qualifications: Optional[str] = None
    preferred_qualifications: Optional[str] = None
    context_note: Optional[str] = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    company_name: str
    title: str
    external_job_id: Optional[str] = None
    source_job_id: Optional[str] = None
    location: str
    source_url: Optional[str] = None
    capture_date: str
    role_family: str
    status: str
    original_description: Optional[str] = None
    cleaned_description: Optional[str] = None
    summary: Optional[str] = None
    responsibilities: Optional[str] = None
    qualifications: Optional[str] = None
    preferred_qualifications: Optional[str] = None
    context_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class JobListResponse(BaseModel):
    jobs: List[JobOut]
    total_count: int
    analysable_count: int  # Jobs where status == 'Available'
    role_family_counts: Dict[str, int]
    status_counts: Dict[str, int]


class ParsedFields(BaseModel):
    title: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    role_family: Optional[str] = None
    status: Optional[str] = None
    extracted_req_id: Optional[str] = None
    summary: Optional[str] = None
    responsibilities: Optional[str] = None
    qualifications: Optional[str] = None
    preferred_qualifications: Optional[str] = None
    warnings: Dict[str, str] = Field(default_factory=dict)


class UploadResponse(BaseModel):
    filename: str
    extracted_text: str
    preview: str
    char_count: int
    line_count: int
    parsed_fields: ParsedFields
    suggested_code: str


class ParseTextRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw text to extract fields from")
    filename: Optional[str] = None


class NextCodeResponse(BaseModel):
    next_code: str = Field(..., description="Auto-incremented numerical requisition code, e.g. JB-1")


class SyncRequest(BaseModel):
    limit: int = Field(default=25, ge=1, le=100)
    dry_run: bool = False


class SyncResponse(BaseModel):
    total_found: int
    added: int
    updated: int
    unchanged: int
    stale: int
    jobs: List[JobOut]
    message: str


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    pdf_filename: Optional[str] = None
    latex_filename: Optional[str] = None
    raw_text: Optional[str] = None
    latex_source: Optional[str] = None
    is_active: int
    created_at: datetime
    updated_at: datetime


class ResumeLatexUpdate(BaseModel):
    latex_source: str = Field(..., description="Updated LaTeX source code")


class DimensionDetail(BaseModel):
    score: int = Field(..., ge=0, le=100)
    reasoning: str


class ExplainableMatchResponse(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    readiness_verdict: str
    summary_reasoning: str
    dimensions: Dict[str, DimensionDetail] = Field(default_factory=dict)
    verified_matched_skills: List[str] = Field(default_factory=list)
    critical_missing_skills: List[str] = Field(default_factory=list)
    actionable_latex_recommendations: List[str] = Field(default_factory=list)
    is_llm_powered: bool = False
    is_cached: bool = False


class TopJobMatch(BaseModel):
    job_id: int
    title: str
    external_job_id: Optional[str] = None
    role_family: str
    score: int
    is_ai_score: bool = False
    score_source: str = "Quick Estimate"
    model_used: Optional[str] = None
    matched_skills: List[str]
    readiness_verdict: str
    capture_date: Optional[str] = None
    source_url: Optional[str] = None


class TopJobMatchesResponse(BaseModel):
    active_resume_id: int
    active_resume_name: str
    top_matches: List[TopJobMatch]


# --- M3: Taxonomy & Skill Review Schemas ---

class SkillAliasOut(BaseModel):
    id: int
    alias_text: str


class SkillCreate(BaseModel):
    canonical_name: str
    category: str = "Technical"
    description: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)


class SkillOut(BaseModel):
    id: int
    canonical_name: str
    category: str
    description: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    job_count: int = 0


class AddAliasRequest(BaseModel):
    alias_text: str


class JobSkillOut(BaseModel):
    id: int
    job_id: int
    skill_id: int
    canonical_name: str
    category: str
    matched_alias: Optional[str] = None
    requirement_type: str  # Required, Preferred, Unspecified
    extraction_method: str
    review_status: str  # Proposed, Accepted, Rejected, Edited
    evidence_snippet: Optional[str] = None
    confidence: int


class JobSkillUpdate(BaseModel):
    requirement_type: Optional[str] = None
    review_status: Optional[str] = None
    evidence_snippet: Optional[str] = None
    skill_id: Optional[int] = None


class JobSkillCreate(BaseModel):
    skill_id: int
    requirement_type: str = "Required"
    evidence_snippet: Optional[str] = None


class DisambiguateRequest(BaseModel):
    phrase: str
    context: Optional[str] = None


class DisambiguateResponse(BaseModel):
    phrase: str
    suggested_canonical_name: str
    suggested_skill_id: Optional[int] = None
    confidence: int
    rationale: str
    is_llm_powered: bool


# --- M4: Comparative Analytics & Matrix Schemas ---

class SkillCoverageItem(BaseModel):
    skill_id: int
    canonical_name: str
    category: str
    distinct_job_count: int
    coverage_percentage: float
    required_count: int
    preferred_count: int
    family_a_count: int
    family_b_count: int
    family_c_count: int


class CoverageResponse(BaseModel):
    total_jobs: int
    analysable_count: int  # Denominator N
    role_family_counts: Dict[str, int]
    active_family_filter: Optional[str] = None
    skills: List[SkillCoverageItem]


class MatrixJobInfo(BaseModel):
    job_id: int
    external_job_id: Optional[str] = None
    title: str
    role_family: str
    status: str


class CrossRoleMatrixResponse(BaseModel):
    total_analysable_jobs: int
    family_counts: Dict[str, int]
    jobs: List[MatrixJobInfo]
    skills: List[SkillCoverageItem]
    # skill_id -> { job_id -> "required" | "preferred" | "none" }
    matrix: Dict[int, Dict[int, str]]


class SkillEvidenceItem(BaseModel):
    job_id: int
    job_title: str
    external_job_id: Optional[str] = None
    role_family: str
    requirement_type: str
    review_status: str
    evidence_snippet: str


class SkillEvidenceResponse(BaseModel):
    skill_id: int
    canonical_name: str
    category: str
    distinct_jobs_count: int
    items: List[SkillEvidenceItem]


# --- M5-CardLyze: Profile Evidence & Multi-Dimensional Audit Schemas ---

class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    highest_degree: str
    education_summary: Optional[str] = None
    years_experience: str
    experience_summary: Optional[str] = None
    projects_summary: Optional[str] = None
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    highest_degree: Optional[str] = None
    education_summary: Optional[str] = None
    years_experience: Optional[str] = None
    experience_summary: Optional[str] = None
    projects_summary: Optional[str] = None


class ProfileEvidenceCreate(BaseModel):
    skill_id: int
    evidence_status: str = Field(default="Demonstrated", description="Demonstrated, Partial, Learning, Not demonstrated")
    contribution_type: str = Field(default="Independent", description="Comma-separated contribution types")
    source_project: Optional[str] = None
    evidence_description: Optional[str] = None
    recorded_date: Optional[str] = None


class ProfileEvidenceUpdate(BaseModel):
    evidence_status: Optional[str] = None
    contribution_type: Optional[str] = None
    source_project: Optional[str] = None
    evidence_description: Optional[str] = None
    recorded_date: Optional[str] = None


class ProfileEvidenceOut(BaseModel):
    id: int
    skill_id: int
    canonical_name: str
    category: str
    evidence_status: str
    contribution_type: str
    source_project: Optional[str] = None
    evidence_description: Optional[str] = None
    recorded_date: str
    updated_at: datetime


class ProfileOverviewResponse(BaseModel):
    profile: UserProfileOut
    evidence_items: List[ProfileEvidenceOut]
    status_counts: Dict[str, int]
    contribution_counts: Dict[str, int]


class ResumeParseCheck(BaseModel):
    status: str  # Healthy, Warning, Empty
    char_count: int
    line_count: int
    warnings: List[str] = Field(default_factory=list)


class SkillCoverageComparisonRow(BaseModel):
    skill_id: int
    canonical_name: str
    category: str
    requirement_type: str  # Required, Preferred, Unspecified
    mentioned_in_resume: bool
    jd_evidence_snippet: Optional[str] = None
    resume_matching_line: Optional[str] = None
    profile_evidence_status: str  # Demonstrated, Partial, Learning, Not demonstrated
    contribution_type: Optional[str] = None
    source_project: Optional[str] = None


class ClaimedUnsupportedItem(BaseModel):
    skill_id: int
    canonical_name: str
    category: str
    resume_matching_line: str
    current_evidence_status: str
    warning_message: str


class DimensionEvaluation(BaseModel):
    dimension_key: str
    dimension_label: str
    status_badge: str  # Strong, Partial, Gap, Eligibility Gap, Review Needed
    summary: str
    matched_items: List[str] = Field(default_factory=list)
    gap_items: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class ProfileJobMatchResponse(BaseModel):
    job_id: int
    job_title: str
    external_job_id: Optional[str] = None
    role_family: str
    resume_id: Optional[int] = None
    resume_name: Optional[str] = None
    parse_check: ResumeParseCheck
    dimensions: List[DimensionEvaluation]
    skill_coverage: List[SkillCoverageComparisonRow]
    claimed_unsupported: List[ClaimedUnsupportedItem]
    education_requirements: List[str] = Field(default_factory=list)
    experience_requirements: List[str] = Field(default_factory=list)


# --- M6: Learning Intelligence & Gap Tracker Schemas ---

class LearningResourceCreate(BaseModel):
    provider: str = Field(..., min_length=1)
    title: str = Field(..., min_length=2)
    url: Optional[str] = None
    skills_addressed: List[str] = Field(default_factory=list)
    cost_status: str = Field(default="Unknown")
    has_certificate: bool = False
    duration: Optional[str] = None
    verification_date: Optional[str] = None
    description: Optional[str] = None


class LearningProgressUpdate(BaseModel):
    status: str = Field(..., description="Not started, In progress, Completed, Paused")
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None


class LearningResourceOut(BaseModel):
    id: int
    provider: str
    title: str
    url: Optional[str] = None
    skills_addressed: List[str]
    cost_status: str
    has_certificate: bool
    duration: Optional[str] = None
    verification_date: str
    description: Optional[str] = None
    is_custom: bool
    progress_status: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    updated_at: datetime


class LearningProgressResponse(BaseModel):
    resource: LearningResourceOut
    profile_evidence_auto_upgraded: bool = False
    policy_notice: str


class LearningRecommendationItem(BaseModel):
    resource: LearningResourceOut
    addressed_gaps: List[str]
    max_jd_coverage_count: int
    gap_reason: str
    pricing_warning: Optional[str] = None


class LearningRecommendationsResponse(BaseModel):
    analysable_jobs_count: int
    target_job_id: Optional[int] = None
    target_job_title: Optional[str] = None
    priority_gap_skills: List[str]
    recommendations: List[LearningRecommendationItem]


# --- v3.0: Google Auth & Multi-User Schemas ---

class AuthConfigOut(BaseModel):
    google_client_id: str
    auth_required: bool
    version: str


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=10)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    is_local_dev: int = 0


# --- v3.0: Global Skill Autocomplete & Deduplication ---

class SkillSuggestOut(BaseModel):
    id: int
    canonical_name: str
    category: str
    matched_alias: Optional[str] = None
    job_count: int = 0


class SkillResolveRequest(BaseModel):
    raw_name: str = Field(..., min_length=1, max_length=80)
    category: str = "Technical"


class SkillResolveResponse(BaseModel):
    id: int
    canonical_name: str
    category: str
    created_new: bool
    matched_via: str


# --- v3.0: Skill Explorer (Common vs Role-Specific) ---

class ExplorerJobEvidence(BaseModel):
    job_id: int
    job_title: str
    external_job_id: Optional[str] = None
    role_family: str
    requirement_type: str
    evidence_snippet: Optional[str] = None


class ExplorerSkillItem(BaseModel):
    skill_id: int
    canonical_name: str
    category: str
    selected_job_count: int
    total_selected_jobs: int
    bucket: str  # common_core, shared, role_specific
    required_count: int
    preferred_count: int
    evidences: List[ExplorerJobEvidence] = Field(default_factory=list)


class SkillExplorerResponse(BaseModel):
    selected_job_ids: List[int]
    total_selected_jobs: int
    available_jobs: List[MatrixJobInfo]
    common_core: List[ExplorerSkillItem]
    shared: List[ExplorerSkillItem]
    role_specific: List[ExplorerSkillItem]


# --- v3.0: Experience Vault & Mini-RAG ---

class ExperienceEntryCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    organization_or_project: Optional[str] = None
    contribution_note: Optional[str] = None
    detailed_narrative: str = Field(..., min_length=10)
    skill_tags: List[str] = Field(default_factory=list)


class ExperienceEntryUpdate(BaseModel):
    title: Optional[str] = None
    organization_or_project: Optional[str] = None
    contribution_note: Optional[str] = None
    detailed_narrative: Optional[str] = None
    skill_tags: Optional[List[str]] = None


class ExperienceEntryOut(BaseModel):
    id: int
    title: str
    organization_or_project: Optional[str] = None
    contribution_note: Optional[str] = None
    detailed_narrative: str
    skill_tags: List[str]
    chunk_count: int = 0
    has_embeddings: bool = False
    created_at: datetime
    updated_at: datetime


class VaultCompareRequest(BaseModel):
    job_ids: List[int] = Field(..., min_length=1, max_length=3)
    model_mode: str = Field(default="flash", description="flash or pro")
    force_refresh: bool = False


class RetrievedChunkPreview(BaseModel):
    entry_title: str
    chunk_text: str
    similarity: float


class PerJobComparison(BaseModel):
    job_id: int
    job_title: str
    external_job_id: Optional[str] = None
    fit_score: Optional[int] = Field(default=None, ge=0, le=100)
    is_ai_score: bool = False
    summary: str
    strengths_from_history: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    resume_suggestions: List[str] = Field(default_factory=list)


class VaultCompareResponse(BaseModel):
    job_ids: List[int]
    job_titles: List[str]
    strengths_from_history: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    resume_suggestions: List[str] = Field(default_factory=list)
    summary: str
    per_job_results: List[PerJobComparison] = Field(default_factory=list)
    retrieved_context: List[RetrievedChunkPreview] = Field(default_factory=list)
    is_llm_powered: bool = False
    is_cached: bool = False
    model_used: str
    fallback_note: Optional[str] = None


# --- v3.0: User-Owned Roadmap & Saved Resources ---

class RoadmapItemCreate(BaseModel):
    skill_name: str = Field(..., min_length=1, max_length=80)
    goal_note: Optional[str] = Field(None, max_length=255)
    target_job_id: Optional[int] = None
    priority: str = "Medium"
    status: str = "To Learn"


class RoadmapItemUpdate(BaseModel):
    skill_name: Optional[str] = None
    goal_note: Optional[str] = None
    target_job_id: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None


class SavedResourceCreate(BaseModel):
    roadmap_item_id: Optional[int] = None
    title: str = Field(..., min_length=2, max_length=255)
    url: str = Field(..., min_length=4)
    resource_type: str = "Course"
    skill_name: Optional[str] = None
    notes: Optional[str] = None


class SavedResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    roadmap_item_id: Optional[int] = None
    title: str
    url: str
    resource_type: str
    skill_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class RoadmapItemOut(BaseModel):
    id: int
    skill_id: Optional[int] = None
    skill_name: str
    goal_note: Optional[str] = None
    target_job_id: Optional[int] = None
    target_job_title: Optional[str] = None
    priority: str
    status: str
    sort_order: int
    resources: List[SavedResourceOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class RoadmapReviewRequest(BaseModel):
    job_ids: List[int] = Field(default_factory=list)
    model_mode: str = "flash"
    force_refresh: bool = False


class RoadmapReviewResponse(BaseModel):
    summary: str
    missing_common_skills: List[str] = Field(default_factory=list)
    niche_or_low_priority: List[str] = Field(default_factory=list)
    project_ideas: List[str] = Field(default_factory=list)
    is_llm_powered: bool = False
    is_cached: bool = False
    model_used: str
    fallback_note: Optional[str] = None


# --- v3.0: Dashboard 3-Tier Fallback Response ---

class DashboardSummaryResponse(BaseModel):
    ranking_source: str  # experience_vault, resume, none
    source_label: str
    empty_prompt: Optional[str] = None
    analysable_jobs_count: int
    top_matches: List[TopJobMatch] = Field(default_factory=list)
    skills_in_demand: List[SkillCoverageItem] = Field(default_factory=list)




