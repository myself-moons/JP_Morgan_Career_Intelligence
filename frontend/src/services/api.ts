import {
  AuthConfig,
  AuthUser,
  DashboardSummary,
  ExperienceEntry,
  HealthStatus,
  Job,
  JobListResponse,
  ParsedFields,
  ResumeDocument,
  RoadmapItem,
  RoadmapReviewResponse,
  SavedResource,
  SkillEvidenceResponse,
  SkillExplorerResponse,
  SkillResolveResult,
  SkillSuggestion,
  SyncResult,
  TaxonomySkill,
  UploadResponse,
  VaultCompareResponse,
} from '../types';

const API_BASE = '/api';

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

// --- Auth & Health ---

export async function fetchAuthConfig(): Promise<AuthConfig> {
  return apiFetch<AuthConfig>(`${API_BASE}/auth/config`);
}

export async function loginWithGoogle(credential: string): Promise<AuthUser> {
  return apiFetch<AuthUser>(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const data = await apiFetch<{ authenticated: boolean; user: AuthUser | null }>(
    `${API_BASE}/auth/session`
  );
  return data.user;
}

export async function logoutUser(): Promise<void> {
  await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
}

export async function updateEmailAlerts(enabled: boolean): Promise<AuthUser> {
  return apiFetch<AuthUser>(`${API_BASE}/auth/alerts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_alerts_enabled: enabled }),
  });
}

export async function checkHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>(`${API_BASE}/health`);
}

// --- Dashboard (v3.0 3-tier fallback) ---

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(`${API_BASE}/analytics/dashboard`);
}

export async function fetchSkillEvidence(
  skillId: number,
  status: string = 'Available'
): Promise<SkillEvidenceResponse> {
  return apiFetch<SkillEvidenceResponse>(
    `${API_BASE}/analytics/skills/${skillId}/evidence?status=${encodeURIComponent(status)}`
  );
}

// --- Job Library ---

export async function fetchJobs(params?: {
  role_family?: string;
  status?: string;
  location?: string;
  search?: string;
}): Promise<JobListResponse> {
  const query = new URLSearchParams();
  if (params?.role_family && params.role_family !== 'All') query.append('role_family', params.role_family);
  if (params?.status && params.status !== 'All') query.append('status', params.status);
  if (params?.location) query.append('location', params.location);
  if (params?.search) query.append('search', params.search);
  return apiFetch<JobListResponse>(`${API_BASE}/jobs${query.toString() ? `?${query.toString()}` : ''}`);
}

export async function fetchJobById(jobId: number): Promise<Job> {
  return apiFetch<Job>(`${API_BASE}/jobs/${jobId}`);
}

export async function fetchNextJobCode(): Promise<string> {
  const data = await apiFetch<{ next_code?: string }>(`${API_BASE}/jobs/next-code`).catch(() => ({ next_code: 'JB-1' }));
  return data.next_code || 'JB-1';
}

export async function parseRawText(text: string, filename?: string): Promise<ParsedFields> {
  return apiFetch<ParsedFields>(`${API_BASE}/jobs/parse-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename }),
  });
}

export async function createJob(payload: {
  title: string;
  company_name?: string;
  external_job_id?: string;
  location?: string;
  source_url?: string;
  capture_date?: string;
  role_family: string;
  status?: string;
  original_description?: string;
  summary?: string;
  responsibilities?: string;
  qualifications?: string;
  preferred_qualifications?: string;
  context_note?: string;
}): Promise<Job> {
  return apiFetch<Job>(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateJob(jobId: number, payload: Partial<Job>): Promise<Job> {
  return apiFetch<Job>(`${API_BASE}/jobs/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteJob(jobId: number): Promise<void> {
  await apiFetch(`${API_BASE}/jobs/${jobId}`, { method: 'DELETE' });
}

export async function uploadJobDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadResponse>(`${API_BASE}/jobs/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function seedBaselineJobs(): Promise<{ status: string; seeded_count: number }> {
  return apiFetch(`${API_BASE}/jobs/seed`, { method: 'POST' });
}

export async function syncJpmcJobs(limit: number = 25, dryRun: boolean = false): Promise<SyncResult> {
  return apiFetch<SyncResult>(`${API_BASE}/jobs/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit, dry_run: dryRun }),
  });
}

// --- Global Canonical Skills & Skill Explorer ---

export async function suggestSkills(q: string, limit: number = 12): Promise<SkillSuggestion[]> {
  return apiFetch<SkillSuggestion[]>(
    `${API_BASE}/taxonomy/suggest?q=${encodeURIComponent(q)}&limit=${limit}`
  );
}

export async function resolveOrCreateSkill(rawName: string, category: string = 'Technical'): Promise<SkillResolveResult> {
  return apiFetch<SkillResolveResult>(`${API_BASE}/taxonomy/resolve-or-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_name: rawName, category }),
  });
}

export async function fetchTaxonomySkills(search?: string): Promise<TaxonomySkill[]> {
  const url = `${API_BASE}/taxonomy/skills${search ? `?search=${encodeURIComponent(search)}` : ''}`;
  return apiFetch<TaxonomySkill[]>(url);
}

export async function addSkillAlias(skillId: number, aliasText: string): Promise<{ message: string }> {
  return apiFetch(`${API_BASE}/taxonomy/skills/${skillId}/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias_text: aliasText }),
  });
}

export async function fetchSkillExplorer(params?: {
  job_ids?: number[];
  role_family?: string;
}): Promise<SkillExplorerResponse> {
  const query = new URLSearchParams();
  if (params?.job_ids && params.job_ids.length > 0) {
    query.append('job_ids', params.job_ids.join(','));
  }
  if (params?.role_family && params.role_family !== 'All') {
    query.append('role_family', params.role_family);
  }
  const url = `${API_BASE}/explorer/compare${query.toString() ? `?${query.toString()}` : ''}`;
  return apiFetch<SkillExplorerResponse>(url);
}

// --- Experience Vault & Mini-RAG + Resumes (No LaTeX) ---

export async function fetchVaultEntries(): Promise<ExperienceEntry[]> {
  return apiFetch<ExperienceEntry[]>(`${API_BASE}/vault/entries`);
}

export async function createVaultEntry(payload: {
  title: string;
  organization_or_project?: string;
  contribution_note?: string;
  detailed_narrative: string;
  skill_tags: string[];
}): Promise<ExperienceEntry> {
  return apiFetch<ExperienceEntry>(`${API_BASE}/vault/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateVaultEntry(
  entryId: number,
  payload: Partial<{
    title: string;
    organization_or_project: string;
    contribution_note: string;
    detailed_narrative: string;
    skill_tags: string[];
  }>
): Promise<ExperienceEntry> {
  return apiFetch<ExperienceEntry>(`${API_BASE}/vault/entries/${entryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteVaultEntry(entryId: number): Promise<void> {
  await apiFetch(`${API_BASE}/vault/entries/${entryId}`, { method: 'DELETE' });
}

export async function compareVaultWithAI(payload: {
  job_ids: number[];
  model_mode?: string;
  force_refresh?: boolean;
}): Promise<VaultCompareResponse> {
  return apiFetch<VaultCompareResponse>(`${API_BASE}/vault/compare-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchResumes(): Promise<ResumeDocument[]> {
  return apiFetch<ResumeDocument[]>(`${API_BASE}/resumes`);
}

export async function uploadResumeFile(name: string, file: File): Promise<ResumeDocument> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);
  return apiFetch<ResumeDocument>(`${API_BASE}/resumes/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function createTextResume(name: string, raw_text: string): Promise<ResumeDocument> {
  return apiFetch<ResumeDocument>(`${API_BASE}/resumes/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, raw_text }),
  });
}

export async function activateResume(resumeId: number): Promise<ResumeDocument> {
  return apiFetch<ResumeDocument>(`${API_BASE}/resumes/${resumeId}/activate`, { method: 'POST' });
}

export async function deleteResume(resumeId: number): Promise<void> {
  await apiFetch(`${API_BASE}/resumes/${resumeId}`, { method: 'DELETE' });
}

export function getResumePdfUrl(resumeId: number): string {
  return `${API_BASE}/resumes/${resumeId}/pdf`;
}

// --- User-Owned Roadmap & Saved Resources ---

export async function fetchRoadmapItems(): Promise<RoadmapItem[]> {
  return apiFetch<RoadmapItem[]>(`${API_BASE}/roadmap/items`);
}

export async function createRoadmapItem(payload: {
  skill_name: string;
  goal_note?: string;
  target_job_id?: number;
  priority?: string;
  status?: string;
}): Promise<RoadmapItem> {
  return apiFetch<RoadmapItem>(`${API_BASE}/roadmap/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateRoadmapItem(
  itemId: number,
  payload: Partial<{
    skill_name: string;
    goal_note: string;
    priority: string;
    status: string;
  }>
): Promise<RoadmapItem> {
  return apiFetch<RoadmapItem>(`${API_BASE}/roadmap/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteRoadmapItem(itemId: number): Promise<void> {
  await apiFetch(`${API_BASE}/roadmap/items/${itemId}`, { method: 'DELETE' });
}

export async function fetchSavedResources(): Promise<SavedResource[]> {
  return apiFetch<SavedResource[]>(`${API_BASE}/roadmap/resources`);
}

export async function createSavedResource(payload: {
  roadmap_item_id?: number;
  title: string;
  url: string;
  resource_type: string;
  skill_name?: string;
  notes?: string;
}): Promise<SavedResource> {
  return apiFetch<SavedResource>(`${API_BASE}/roadmap/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedResource(resourceId: number): Promise<void> {
  await apiFetch(`${API_BASE}/roadmap/resources/${resourceId}`, { method: 'DELETE' });
}

export async function reviewRoadmapWithAI(payload: {
  job_ids: number[];
  model_mode?: 'flash' | 'pro';
  force_refresh?: boolean;
}): Promise<RoadmapReviewResponse> {
  return apiFetch<RoadmapReviewResponse>(`${API_BASE}/roadmap/review-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// --- Exports ---

export function getExportCoverageUrl(format: 'csv' | 'xlsx' = 'csv'): string {
  return `${API_BASE}/exports/coverage?format=${format}`;
}

export function getExportJobsUrl(params?: {
  format?: 'csv' | 'xlsx';
  role_family?: string;
  status?: string;
  search?: string;
}): string {
  const query = new URLSearchParams();
  query.append('format', params?.format || 'csv');
  if (params?.role_family && params.role_family !== 'All') query.append('role_family', params.role_family);
  if (params?.status && params.status !== 'All') query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  return `${API_BASE}/exports/jobs?${query.toString()}`;
}
