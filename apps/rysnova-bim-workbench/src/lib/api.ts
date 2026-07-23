import { getToken } from '@rhautt/shared-auth';

function authHeaders(): Record<string, string> {
  const token = getToken() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 统一 envelope 解包：后端多为 { success, data } 或直接对象。 */
function unwrap<T = any>(json: any): T {
  if (json && typeof json === 'object' && 'data' in json && ('success' in json || 'ok' in json)) return json.data as T;
  return json as T;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`/api/v2${path}`, { headers: { ...authHeaders() }, credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return unwrap<T>(json);
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v2${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return unwrap<T>(json);
}

// ── rysnova-bim 领域端点 ────────────────────────────────────────────────
export const bim = {
  projects: (q = '') => apiGet(`/rysnova-bim/projects${q}`),
  stats: () => apiGet('/rysnova-bim/projects/stats'),
  project: (id: string) => apiGet(`/rysnova-bim/projects/${id}`),
  advance: (id: string) => apiPost(`/rysnova-bim/projects/${id}/advance`),
  deepeningPackage: (projectId: string) => apiGet(`/rysnova-bim/projects/${projectId}/deepening-package`),
  generateVisual: (projectId: string, body: unknown = {}) => apiPost(`/rysnova-bim/projects/${projectId}/visual-artifacts`, body),
  generateDeliverable: (projectId: string, body: unknown = {}) => apiPost(`/rysnova-bim/projects/${projectId}/deliverable-artifacts`, body),
  artifacts: (q = '') => apiGet(`/rysnova-bim/artifacts${q}`),
  approveArtifact: (artifactId: string, body: unknown = {}) => apiPost(`/rysnova-bim/artifacts/${artifactId}/approval`, body),
  me: () => apiGet('/auth/me'),
};
