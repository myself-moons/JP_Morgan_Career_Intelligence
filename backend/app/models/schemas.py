from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict


class JobBase(BaseModel):
    title: str = Field(..., min_length=2, description="Job title")
    company_name: str = Field(default="JPMorgan Chase", description="Company or institution name")
    external_job_id: Optional[str] = Field(None, description="External requisition or job ID")
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
