from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    jobs = relationship("JobListing", back_populates="company", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Company(id={self.id}, name='{self.name}')>"


class JobListing(Base):
    __tablename__ = "job_listings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False, index=True)
    external_job_id = Column(String(100), nullable=True, index=True)
    source_job_id = Column(String(100), nullable=True, index=True)
    location = Column(String(255), nullable=False, default="Goregaon, Mumbai")
    source_url = Column(Text, nullable=True)
    capture_date = Column(String(50), nullable=False, default="2026-11-17")
    role_family = Column(String(150), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Available", index=True)
    original_description = Column(Text, nullable=True)
    cleaned_description = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    responsibilities = Column(Text, nullable=True)
    qualifications = Column(Text, nullable=True)
    preferred_qualifications = Column(Text, nullable=True)
    context_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Unique constraint per company and external requisition id (when present)
    __table_args__ = (
        UniqueConstraint("company_id", "external_job_id", name="uq_company_job_id"),
    )

    # Relationships
    company = relationship("Company", back_populates="jobs")

    def __repr__(self):
        return f"<JobListing(id={self.id}, title='{self.title}', family='{self.role_family}', status='{self.status}')>"


class ResumeDocument(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    pdf_filename = Column(String(255), nullable=True)
    latex_filename = Column(String(255), nullable=True)
    raw_text = Column(Text, nullable=True)
    latex_source = Column(Text, nullable=True)
    is_active = Column(Integer, default=0, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def __repr__(self):
        return f"<ResumeDocument(id={self.id}, name='{self.name}', active={self.is_active})>"


class LLMEvaluation(Base):
    __tablename__ = "llm_evaluations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    content_hash = Column(String(64), nullable=False, index=True)
    evaluation_json = Column(Text, nullable=False)
    is_llm_powered = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def __repr__(self):
        return f"<LLMEvaluation(id={self.id}, resume_id={self.resume_id}, job_id={self.job_id})>"


