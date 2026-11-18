import { HealthStatus, Job, JobListResponse, UploadResponse } from '../types';

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
