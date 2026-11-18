export interface HealthStatus {
  status: string;
  version: string;
  app: string;
  environment: string;
  database: string;
  database_path?: string;
  db_console_url?: string;
}

export type RoleFamily = 'A' | 'B' | 'C';
export type JobStatus = 'Available' | 'JD unavailable';
export type SkillType = 'Technical' | 'Soft' | 'Domain' | 'Tool';
export type RequirementLevel = 'Required' | 'Preferred';

export interface Job {
  id: string;
  external_job_id: string;
  title: string;
  role_family: RoleFamily;
  location: string;
  company: string;
  source_url?: string;
  status: JobStatus;
  raw_text: string;
  capture_date: string;
  created_at: string;
  updated_at: string;
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
  job_id: string;
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
