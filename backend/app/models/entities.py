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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    google_sub = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), index=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    avatar_url = Column(Text, nullable=True)
    is_local_dev = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_login_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    jobs = relationship("JobListing", back_populates="company", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Company(id={self.id}, name='{self.name}')>"


class JobListing(Base):
    __tablename__ = "job_listings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
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

    __table_args__ = (
        UniqueConstraint("company_id", "external_job_id", name="uq_company_job_id"),
    )

    company = relationship("Company", back_populates="jobs")

    def __repr__(self):
        return f"<JobListing(id={self.id}, title='{self.title}', family='{self.role_family}', status='{self.status}')>"


class ResumeDocument(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    pdf_filename = Column(String(255), nullable=True)
    stored_filename = Column(String(255), nullable=True)
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    content_hash = Column(String(64), nullable=False, index=True)
    evaluation_json = Column(Text, nullable=False)
    is_llm_powered = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class AICache(Base):
    """Generic SHA-256 response cache for Mini-RAG comparisons and Roadmap AI reviews."""
    __tablename__ = "ai_cache"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cache_type = Column(String(50), nullable=False, index=True)  # vault_compare, roadmap_review
    content_hash = Column(String(64), nullable=False, index=True)
    model_used = Column(String(100), nullable=False)
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "cache_type", "content_hash", "model_used", name="uq_ai_cache_key"),
    )


class UserJobAIScore(Base):
    """Persisted per-user, per-job fit score generated by Vault Compare with AI."""
    __tablename__ = "user_job_ai_scores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    fit_score = Column(Integer, nullable=False)
    profile_hash = Column(String(64), nullable=False, index=True)
    model_used = Column(String(100), nullable=False)
    summary = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_user_job_ai_score"),
    )


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    canonical_name = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False, default="Technical")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

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

    skill = relationship("Skill", back_populates="aliases")

    def __repr__(self):
        return f"<SkillAlias(id={self.id}, alias='{self.alias_text}')>"


class JobSkill(Base):
    __tablename__ = "job_skills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True)
    matched_alias = Column(String(100), nullable=True)
    requirement_type = Column(String(50), nullable=False, default="Required", index=True)
    extraction_method = Column(String(50), nullable=False, default="dictionary")
    review_status = Column(String(50), nullable=False, default="Proposed", index=True)
    evidence_snippet = Column(Text, nullable=True)
    confidence = Column(Integer, default=90, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("job_id", "skill_id", name="uq_job_skill"),
    )

    job = relationship("JobListing", backref="extracted_skills")
    skill = relationship("Skill", back_populates="job_skills")


# --- v3.0: Experience Vault & Mini-RAG ---

class ExperienceEntry(Base):
    __tablename__ = "experience_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    organization_or_project = Column(String(255), nullable=True)
    contribution_note = Column(String(255), nullable=True)
    detailed_narrative = Column(Text, nullable=False)
    skill_tags = Column(Text, nullable=False, default="[]")  # JSON list of canonical skill names
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    chunks = relationship("ExperienceChunk", back_populates="entry", cascade="all, delete-orphan")


class ExperienceChunk(Base):
    __tablename__ = "experience_chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_id = Column(Integer, ForeignKey("experience_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    chunk_text = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False, index=True)
    embedding_json = Column(Text, nullable=True)
    embedding_model = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    entry = relationship("ExperienceEntry", back_populates="chunks")


# --- v3.0: User-Owned Roadmap & Saved Resources ---

class RoadmapItem(Base):
    __tablename__ = "roadmap_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="SET NULL"), nullable=True, index=True)
    skill_name = Column(String(100), nullable=False, index=True)
    goal_note = Column(String(255), nullable=True)
    target_job_id = Column(Integer, ForeignKey("job_listings.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String(30), nullable=False, default="Medium")  # High, Medium, Low
    status = Column(String(30), nullable=False, default="To Learn")  # To Learn, In Progress, Done
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    resources = relationship("SavedResource", back_populates="roadmap_item")


class SavedResource(Base):
    __tablename__ = "saved_resources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    roadmap_item_id = Column(Integer, ForeignKey("roadmap_items.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    resource_type = Column(String(50), nullable=False, default="Course")  # Course, Certification, Docs, Video, Article, Other
    skill_name = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    roadmap_item = relationship("RoadmapItem", back_populates="resources")


# --- Legacy v2 Compatibility Models (kept for existing tests/migrations) ---

class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False, default="User")
    highest_degree = Column(String(255), nullable=False, default="")
    education_summary = Column(Text, nullable=True)
    years_experience = Column(String(100), nullable=False, default="")
    experience_summary = Column(Text, nullable=True)
    projects_summary = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class ProfileEvidence(Base):
    __tablename__ = "profile_evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    evidence_status = Column(String(50), nullable=False, default="Not demonstrated", index=True)
    contribution_type = Column(String(150), nullable=False, default="Independent")
    source_project = Column(String(255), nullable=True)
    evidence_description = Column(Text, nullable=True)
    recorded_date = Column(String(50), nullable=False, default="2026-11-26")
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    skill = relationship("Skill")


class LearningResource(Base):
    __tablename__ = "learning_resources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    provider = Column(String(120), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    url = Column(Text, nullable=True)
    skills_addressed = Column(Text, nullable=False, default="[]")
    cost_status = Column(String(50), nullable=False, default="Unknown", index=True)
    has_certificate = Column(Integer, nullable=False, default=0)
    duration = Column(String(100), nullable=True)
    verification_date = Column(String(50), nullable=False, default="2026-11-26")
    description = Column(Text, nullable=True)
    is_custom = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    progress = relationship("LearningProgress", back_populates="resource", uselist=False, cascade="all, delete-orphan")


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("learning_resources.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Not started", index=True)
    started_at = Column(String(50), nullable=True)
    completed_at = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    resource = relationship("LearningResource", back_populates="progress")
