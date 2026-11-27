export interface HealthStatus {
  status: string;
  version: string;
  app: string;
  environment: string;
  database: string;
  database_path?: string;
  db_console_url?: string;
}

export interface AuthConfig {
  google_client_id: string;
  auth_required: boolean;
  version: string;
}

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  is_local_dev: number;
}

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

export interface SyncResult {
  total_found: number;
  added: number;
  updated: number;
  unchanged: number;
  stale: number;
  jobs: Job[];
  message: string;
}

export interface ResumeDocument {
  id: number;
  name: string;
  pdf_filename?: string | null;
  raw_text?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
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

export interface TopJobMatch {
  job_id: number;
  title: string;
  external_job_id?: string | null;
  role_family: string;
  score: number;
  is_ai_score?: boolean;
  score_source?: string;
  model_used?: string | null;
  matched_skills: string[];
  readiness_verdict: string;
  capture_date?: string | null;
  source_url?: string | null;
}

export interface DashboardSummary {
  ranking_source: 'experience_vault' | 'resume' | 'none' | string;
  source_label: string;
  empty_prompt?: string | null;
  analysable_jobs_count: number;
  top_matches: TopJobMatch[];
  skills_in_demand: SkillCoverageItem[];
}

export interface SkillSuggestion {
  id: number;
  canonical_name: string;
  category: string;
  matched_alias?: string | null;
  job_count: number;
}

export interface SkillResolveResult {
  id: number;
  canonical_name: string;
  category: string;
  created_new: boolean;
  matched_via: string;
}

export interface TaxonomySkill {
  id: number;
  canonical_name: string;
  category: string;
  description?: string | null;
  aliases: string[];
  job_count: number;
}

export interface MatrixJobInfo {
  job_id: number;
  external_job_id?: string | null;
  title: string;
  role_family: string;
  status: string;
}

export interface ExplorerJobEvidence {
  job_id: number;
  job_title: string;
  external_job_id?: string | null;
  role_family: string;
  requirement_type: string;
  evidence_snippet?: string | null;
}

export interface ExplorerSkillItem {
  skill_id: number;
  canonical_name: string;
  category: string;
  selected_job_count: number;
  total_selected_jobs: number;
  bucket: 'common_core' | 'shared' | 'role_specific' | string;
  required_count: number;
  preferred_count: number;
  evidences: ExplorerJobEvidence[];
}

export interface SkillExplorerResponse {
  selected_job_ids: number[];
  total_selected_jobs: number;
  available_jobs: MatrixJobInfo[];
  common_core: ExplorerSkillItem[];
  shared: ExplorerSkillItem[];
  role_specific: ExplorerSkillItem[];
}

export interface ExperienceEntry {
  id: number;
  title: string;
  organization_or_project?: string | null;
  contribution_note?: string | null;
  detailed_narrative: string;
  skill_tags: string[];
  chunk_count: number;
  has_embeddings: boolean;
  created_at: string;
  updated_at: string;
}

export interface RetrievedChunkPreview {
  entry_title: string;
  chunk_text: string;
  similarity: number;
}

export interface PerJobComparison {
  job_id: number;
  job_title: string;
  external_job_id?: string | null;
  fit_score?: number | null;
  is_ai_score?: boolean;
  summary: string;
  strengths_from_history: string[];
  gaps: string[];
  resume_suggestions: string[];
}

export interface VaultCompareResponse {
  job_ids: number[];
  job_titles: string[];
  strengths_from_history: string[];
  gaps: string[];
  resume_suggestions: string[];
  summary: string;
  per_job_results?: PerJobComparison[];
  retrieved_context: RetrievedChunkPreview[];
  is_llm_powered: boolean;
  is_cached: boolean;
  model_used: string;
  fallback_note?: string | null;
}

export interface SavedResource {
  id: number;
  roadmap_item_id?: number | null;
  title: string;
  url: string;
  resource_type: string;
  skill_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface RoadmapItem {
  id: number;
  skill_id?: number | null;
  skill_name: string;
  goal_note?: string | null;
  target_job_id?: number | null;
  target_job_title?: string | null;
  priority: 'High' | 'Medium' | 'Low' | string;
  status: 'To Learn' | 'In Progress' | 'Done' | string;
  sort_order: number;
  resources: SavedResource[];
  created_at: string;
  updated_at: string;
}

export interface RoadmapReviewResponse {
  summary: string;
  missing_common_skills: string[];
  niche_or_low_priority: string[];
  project_ideas: string[];
  is_llm_powered: boolean;
  is_cached: boolean;
  model_used: string;
  fallback_note?: string | null;
}

export type ActiveTab = 'dashboard' | 'jobs' | 'explorer' | 'vault' | 'roadmap';
