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


class TopJobMatch(BaseModel):
    job_id: int
    title: str
    external_job_id: Optional[str] = None
    role_family: str
    score: int
    matched_skills: List[str]
    readiness_verdict: str


class TopJobMatchesResponse(BaseModel):
    active_resume_id: int
    active_resume_name: str
    top_matches: List[TopJobMatch]


