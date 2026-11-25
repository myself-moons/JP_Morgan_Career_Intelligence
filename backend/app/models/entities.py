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


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    canonical_name = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False, default="Technical")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    aliases = relationship("SkillAlias", back_populates="skill", cascade="all, delete-orphan")
    job_skills = relationship("JobSkill", back_populates="skill", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Skill(id={self.id}, name='{self.canonical_name}', category='{self.category}')>"


class SkillAlias(Base):
    __tablename__ = "skill_aliases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True)
    alias_text = Column(String(100), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    # Relationships
    skill = relationship("Skill", back_populates="aliases")

    def __repr__(self):
        return f"<SkillAlias(id={self.id}, alias='{self.alias_text}')>"


class JobSkill(Base):
    __tablename__ = "job_skills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True)
    matched_alias = Column(String(100), nullable=True)
    requirement_type = Column(String(50), nullable=False, default="Required", index=True)  # Required, Preferred, Unspecified
    extraction_method = Column(String(50), nullable=False, default="dictionary")  # dictionary, contextual_rule, manual
    review_status = Column(String(50), nullable=False, default="Proposed", index=True)  # Proposed, Accepted, Rejected, Edited
    evidence_snippet = Column(Text, nullable=True)
    confidence = Column(Integer, default=90, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("job_id", "skill_id", name="uq_job_skill"),
    )

    # Relationships
    job = relationship("JobListing", backref="extracted_skills")
    skill = relationship("Skill", back_populates="job_skills")

    def __repr__(self):
        return f"<JobSkill(id={self.id}, job_id={self.job_id}, skill_id={self.skill_id}, status='{self.review_status}')>"


class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False, default="Manthan Waghela")
    highest_degree = Column(String(255), nullable=False, default="M.Sc. in Data Science (Pursuing) / B.Sc. in IT")
    education_summary = Column(Text, nullable=True)
    years_experience = Column(String(100), nullable=False, default="0.5 - 1 year (Internships & Teaching)")
    experience_summary = Column(Text, nullable=True)
    projects_summary = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def __repr__(self):
        return f"<UserProfile(id={self.id}, full_name='{self.full_name}')>"


class ProfileEvidence(Base):
    __tablename__ = "profile_evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    evidence_status = Column(String(50), nullable=False, default="Not demonstrated", index=True)  # Demonstrated, Partial, Learning, Not demonstrated
    contribution_type = Column(String(150), nullable=False, default="Independent")  # Comma-separated: Independent, AI-assisted, Supervised, Collaborative, Tested, Validated
    source_project = Column(String(255), nullable=True)
    evidence_description = Column(Text, nullable=True)
    recorded_date = Column(String(50), nullable=False, default="2026-11-25")
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    skill = relationship("Skill")

    def __repr__(self):
        return f"<ProfileEvidence(id={self.id}, skill_id={self.skill_id}, status='{self.evidence_status}')>"


class LearningResource(Base):
    __tablename__ = "learning_resources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    provider = Column(String(120), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    url = Column(Text, nullable=True)
    skills_addressed = Column(Text, nullable=False, default="[]")  # JSON array of canonical skill names
    cost_status = Column(String(50), nullable=False, default="Unknown", index=True)  # Free, Paid, Freemium, Unknown
    has_certificate = Column(Integer, nullable=False, default=0)
    duration = Column(String(100), nullable=True)
    verification_date = Column(String(50), nullable=False, default="2026-11-25")
    description = Column(Text, nullable=True)
    is_custom = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    progress = relationship("LearningProgress", back_populates="resource", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<LearningResource(id={self.id}, provider='{self.provider}', title='{self.title}')>"


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("learning_resources.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Not started", index=True)  # Not started, In progress, Completed, Paused
    started_at = Column(String(50), nullable=True)
    completed_at = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    resource = relationship("LearningResource", back_populates="progress")

    def __repr__(self):
        return f"<LearningProgress(id={self.id}, resource_id={self.resource_id}, status='{self.status}')>"



