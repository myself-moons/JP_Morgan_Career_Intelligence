import {
  HealthStatus,
  Job,
  JobListResponse,
  UploadResponse,
  ResumeDocument,
  SyncResult,
  ExplainableMatch,
  TopJobMatchesResponse,
  TaxonomySkill,
  JobSkillRecord,
  DisambiguateResult,
  CoverageResponse,
  CrossRoleMatrixResponse,
  SkillEvidenceResponse,
} from '../types';

const API_BASE = '/api';

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchJobs(params?: {
  role_family?: string;
  status?: string;
  location?: string;
  search?: string;
}): Promise<JobListResponse> {
  const query = new URLSearchParams();
  if (params?.role_family && params.role_family !== 'All') {
    query.append('role_family', params.role_family);
  }
  if (params?.status && params.status !== 'All') {
    query.append('status', params.status);
  }
  if (params?.location) {
    query.append('location', params.location);
  }
  if (params?.search) {
    query.append('search', params.search);
  }

  const url = `${API_BASE}/jobs${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchJobById(jobId: number): Promise<Job> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch job details: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchNextJobCode(): Promise<string> {
  const response = await fetch(`${API_BASE}/jobs/next-code`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    return 'JB-1';
  }
  const data = await response.json();
  return data.next_code || 'JB-1';
}

export async function parseRawText(
  text: string,
  filename?: string
): Promise<import('../types').ParsedFields> {
  const response = await fetch(`${API_BASE}/jobs/parse-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ text, filename }),
  });
  if (!response.ok) {
    throw new Error('Failed to parse text fields');
  }
  return response.json();
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
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create job (${response.status})`);
  }
  return response.json();
}

export async function uploadJobDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/jobs/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `File upload failed (${response.status})`);
  }
  return response.json();
}

export async function deleteJob(jobId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete job (${response.status})`);
  }
}

export async function seedBaselineJobs(): Promise<{ status: string; seeded_count: number }> {
  const response = await fetch(`${API_BASE}/jobs/seed`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to seed jobs (${response.status})`);
  }
  return response.json();
}

export async function syncJpmcJobs(limit: number = 25, dryRun: boolean = false): Promise<SyncResult> {
  const response = await fetch(`${API_BASE}/jobs/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ limit, dry_run: dryRun }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `JPMC Sync failed (${response.status})`);
  }
  return response.json();
}

export async function updateJob(
  jobId: number,
  payload: Partial<Job>
): Promise<Job> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update job (${response.status})`);
  }
  return response.json();
}

export async function fetchResumes(): Promise<ResumeDocument[]> {
  const response = await fetch(`${API_BASE}/resumes`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch resumes: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchActiveResume(): Promise<ResumeDocument | null> {
  const response = await fetch(`${API_BASE}/resumes/active`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function activateResume(resumeId: number): Promise<ResumeDocument> {
  const response = await fetch(`${API_BASE}/resumes/${resumeId}/activate`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to activate resume: ${response.statusText}`);
  }
  return response.json();
}

export async function updateResumeLatex(resumeId: number, latex_source: string): Promise<ResumeDocument> {
  const response = await fetch(`${API_BASE}/resumes/${resumeId}/latex`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ latex_source }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to save LaTeX (${response.status})`);
  }
  return response.json();
}

export function getResumePdfUrl(resumeId: number): string {
  return `${API_BASE}/resumes/${resumeId}/pdf`;
}

export function getResumeTexUrl(resumeId: number): string {
  return `${API_BASE}/resumes/${resumeId}/export-tex`;
}

export async function uploadResumeFile(name: string, file: File): Promise<ResumeDocument> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/resumes/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Resume upload failed (${response.status})`);
  }
  return response.json();
}

export async function fetchCachedJobMatch(
  resumeId: number,
  jobId: number
): Promise<ExplainableMatch | null> {
  try {
    const response = await fetch(`${API_BASE}/resumes/${resumeId}/match-job/${jobId}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function evaluateResumeAgainstJob(
  resumeId: number,
  jobId: number,
  forceRefresh: boolean = false
): Promise<ExplainableMatch> {
  const url = `${API_BASE}/resumes/${resumeId}/match-job/${jobId}${forceRefresh ? '?force_refresh=true' : ''
    }`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Evaluation failed (${response.status})`);
  }
  return response.json();
}

export async function fetchTopJobMatches(): Promise<TopJobMatchesResponse> {
  const response = await fetch(`${API_BASE}/resumes/active/top-matches`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch top job matches (${response.status})`);
  }
  return response.json();
}

// --- M3: Taxonomy & Skill Review API ---

export async function fetchTaxonomySkills(params?: {
  category?: string;
  search?: string;
}): Promise<TaxonomySkill[]> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'All') {
    query.append('category', params.category);
  }
  if (params?.search) {
    query.append('search', params.search);
  }
  const url = `${API_BASE}/taxonomy/skills${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch canonical skills: ${response.statusText}`);
  }
  return response.json();
}

export async function createCanonicalSkill(payload: {
  canonical_name: string;
  category: string;
  description?: string;
  aliases?: string[];
}): Promise<TaxonomySkill> {
  const response = await fetch(`${API_BASE}/taxonomy/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create canonical skill');
  }
  return response.json();
}

export async function addSkillAlias(skillId: number, aliasText: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/taxonomy/skills/${skillId}/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ alias_text: aliasText }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to add alias');
  }
  return response.json();
}

export async function disambiguateSkill(phrase: string, context?: string): Promise<DisambiguateResult> {
  const response = await fetch(`${API_BASE}/taxonomy/ai-disambiguate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phrase, context }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Disambiguation failed');
  }
  return response.json();
}

export async function fetchJobSkills(jobId: number): Promise<JobSkillRecord[]> {
  const response = await fetch(`${API_BASE}/taxonomy/jobs/${jobId}/skills`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch job skills: ${response.statusText}`);
  }
  return response.json();
}

export async function extractJobSkills(jobId: number): Promise<JobSkillRecord[]> {
  const response = await fetch(`${API_BASE}/taxonomy/jobs/${jobId}/extract-skills`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Extraction failed');
  }
  return response.json();
}

export async function batchExtractSkills(): Promise<{ jobs_processed: number; total_extractions: number; message: string }> {
  const response = await fetch(`${API_BASE}/taxonomy/jobs/batch-extract-skills`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Batch extraction failed');
  }
  return response.json();
}

export async function updateJobSkill(
  jobId: number,
  jobSkillId: number,
  payload: {
    requirement_type?: string;
    review_status?: string;
    evidence_snippet?: string;
    skill_id?: number;
  }
): Promise<JobSkillRecord> {
  const response = await fetch(`${API_BASE}/taxonomy/jobs/${jobId}/skills/${jobSkillId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update job skill review');
  }
  return response.json();
}

export async function createManualJobSkill(
  jobId: number,
  payload: {
    skill_id: number;
    requirement_type?: string;
    evidence_snippet?: string;
  }
): Promise<JobSkillRecord> {
  const response = await fetch(`${API_BASE}/taxonomy/jobs/${jobId}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to add skill to job');
  }
  return response.json();
}

// --- M4: Comparative Analytics & Matrix API ---

export async function fetchSkillCoverage(params?: {
  role_family?: string;
  category?: string;
  search?: string;
}): Promise<CoverageResponse> {
  const query = new URLSearchParams();
  if (params?.role_family && params.role_family !== 'All') {
    query.append('role_family', params.role_family);
  }
  if (params?.category && params.category !== 'All') {
    query.append('category', params.category);
  }
  if (params?.search) {
    query.append('search', params.search);
  }
  const url = `${API_BASE}/analytics/coverage${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch skill coverage: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchCrossRoleMatrix(): Promise<CrossRoleMatrixResponse> {
  const response = await fetch(`${API_BASE}/analytics/matrix`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch cross-role matrix: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSkillEvidence(
  skillId: number,
  status: string = 'Available'
): Promise<SkillEvidenceResponse> {
  const url = `${API_BASE}/analytics/skills/${skillId}/evidence?status=${encodeURIComponent(status)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch skill evidence: ${response.statusText}`);
  }
  return response.json();
}



