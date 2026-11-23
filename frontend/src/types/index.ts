export interface HealthStatus {
  status: string;
  version: string;
  app: string;
  environment: string;
  database: string;
  database_path?: string;
  db_console_url?: string;
}

export type RoleFamily =
  | 'Family A: Data Management, Quality and Governance'
  | 'Family B: Analytics, Automation and AI'
  | 'Family C: Finance, Credit and Operations'
  | string;

export type JobStatus = 'Available' | 'JD unavailable' | 'Discovered' | 'Stale' | 'Archived';
export type SkillType = 'Technical' | 'Soft' | 'Domain' | 'Tool';
export type RequirementLevel = 'Required' | 'Preferred';

export interface Job {
  id: number;
  company_id: number;
  company_name: string;
  title: string;
  external_job_id?: string | null;
  source_job_id?: string | null;
  location: string;
  source_url?: string | null;
  capture_date: string;
  role_family: string;
  status: string;
  original_description?: string | null;
  cleaned_description?: string | null;
  summary?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  preferred_qualifications?: string | null;
  context_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListResponse {
  jobs: Job[];
  total_count: number;
  analysable_count: number;
  role_family_counts: Record<string, number>;
  status_counts: Record<string, number>;
}

export interface ParsedFields {
  title?: string | null;
  company_name?: string | null;
  location?: string | null;
  role_family?: string | null;
  status?: string | null;
  extracted_req_id?: string | null;
  summary?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  preferred_qualifications?: string | null;
  warnings: Record<string, string>;
}

export interface UploadResponse {
  filename: string;
  extracted_text: string;
  preview: string;
  char_count: number;
  line_count: number;
  parsed_fields: ParsedFields;
  suggested_code: string;
}

export interface NextCodeResponse {
  next_code: string;
}

export interface TaxonomySkill {
  id: number;
  canonical_name: string;
  category: string;
  description?: string | null;
  aliases: string[];
  job_count: number;
}

export interface JobSkillRecord {
  id: number;
  job_id: number;
  skill_id: number;
  canonical_name: string;
  category: string;
  matched_alias?: string | null;
  requirement_type: 'Required' | 'Preferred' | 'Unspecified';
  extraction_method: string;
  review_status: 'Proposed' | 'Accepted' | 'Rejected' | 'Edited';
  evidence_snippet?: string | null;
  confidence: number;
}

export interface DisambiguateResult {
  phrase: string;
  suggested_canonical_name: string;
  suggested_skill_id?: number | null;
  confidence: number;
  rationale: string;
  is_llm_powered: boolean;
}

export interface SkillCoverageItem {
  skill_id: number;
  canonical_name: string;
  category: string;
  distinct_job_count: number;
  coverage_percentage: number;
  required_count: number;
  preferred_count: number;
  family_a_count: number;
  family_b_count: number;
  family_c_count: number;
}

export interface CoverageResponse {
  total_jobs: number;
  analysable_count: number;
  role_family_counts: Record<string, number>;
  active_family_filter?: string | null;
  skills: SkillCoverageItem[];
}

export interface MatrixJobInfo {
  job_id: number;
  external_job_id?: string | null;
  title: string;
  role_family: string;
  status: string;
}

export interface CrossRoleMatrixResponse {
  total_analysable_jobs: number;
  family_counts: Record<string, number>;
  jobs: MatrixJobInfo[];
  skills: SkillCoverageItem[];
  matrix: Record<string, Record<string, string>>;
}

export interface SkillEvidenceItem {
  job_id: number;
  job_title: string;
  external_job_id?: string | null;
  role_family: string;
  requirement_type: string;
  review_status: string;
  evidence_snippet: string;
}

export interface SkillEvidenceResponse {
  skill_id: number;
  canonical_name: string;
  category: string;
  distinct_jobs_count: number;
  items: SkillEvidenceItem[];
}

export interface Skill {
  id: string;
  canonical_name: string;
  skill_type: SkillType;
  category?: string;
  aliases: string[];
}

export interface SkillExtraction {
  id: string;
  job_id: number;
  skill_id: string;
  canonical_name: string;
  requirement_level: RequirementLevel;
  confidence: number;
  snippet: string;
  is_verified: boolean;
}

export interface ProfileEvidence {
  id: string;
  skill_id: string;
  skill_name: string;
  source_type: 'Project' | 'CardLyze' | 'Role' | 'Certification';
  confidence_score: number;
  status: 'Demonstrated' | 'Partially Demonstrated' | 'Claimed Unsupported';
  evidence_text: string;
}

export interface ResumeDocument {
  id: number;
  name: string;
  pdf_filename?: string | null;
  latex_filename?: string | null;
  raw_text?: string | null;
  latex_source?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  total_found: number;
  added: number;
  updated: number;
  unchanged: number;
  stale: number;
  jobs: Job[];
  message: string;
}

export interface DimensionDetail {
  score: number;
  reasoning: string;
}

export interface ExplainableMatch {
  overall_score: number;
  readiness_verdict: string;
  summary_reasoning: string;
  dimensions: Record<string, DimensionDetail>;
  verified_matched_skills: string[];
  critical_missing_skills: string[];
  actionable_latex_recommendations: string[];
  is_llm_powered: boolean;
  is_cached?: boolean;
}

export interface TopJobMatch {
  job_id: number;
  title: string;
  external_job_id?: string | null;
  role_family: string;
  score: number;
  matched_skills: string[];
  readiness_verdict: string;
  capture_date?: string | null;
}

export interface TopJobMatchesResponse {
  active_resume_id: number;
  active_resume_name: string;
  top_matches: TopJobMatch[];
}


export type ActiveTab =
  | 'dashboard'
  | 'jobs'
  | 'resumes'
  | 'skills'
  | 'profile'
  | 'learning'
  | 'db_console';
