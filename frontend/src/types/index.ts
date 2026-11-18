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

export type JobStatus = 'Available' | 'JD unavailable' | 'Stale' | 'Archived';
export type SkillType = 'Technical' | 'Soft' | 'Domain' | 'Tool';
export type RequirementLevel = 'Required' | 'Preferred';

export interface Job {
  id: number;
  company_id: number;
  company_name: string;
  title: string;
  external_job_id?: string | null;
  location: string;
  source_url?: string | null;
  capture_date: string;
  role_family: string;
  status: string;
  original_description?: string | null;
  cleaned_description?: string | null;
  context_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListResponse {
  jobs: Job[];
  total_count: int;
  analysable_count: int;
  role_family_counts: Record<string, int>;
  status_counts: Record<string, int>;
}

export interface UploadResponse {
  filename: string;
  extracted_text: string;
  preview: string;
  char_count: number;
  line_count: number;
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

export type ActiveTab =
  | 'dashboard'
  | 'jobs'
  | 'skills'
  | 'profile'
  | 'learning'
  | 'db_console';
