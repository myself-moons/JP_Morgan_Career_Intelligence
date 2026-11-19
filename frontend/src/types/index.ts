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

export type ActiveTab =
  | 'dashboard'
  | 'jobs'
  | 'resumes'
  | 'skills'
  | 'profile'
  | 'learning'
  | 'db_console';
