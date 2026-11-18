import { HealthStatus } from '../types';

const API_BASE = '/api';

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}
