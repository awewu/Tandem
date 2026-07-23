import { getToken } from '@rhautt/shared-auth';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || '请求失败');
  return json.data ?? json;
}

export const products = {
  list: (query?: Record<string, string>) =>
    apiFetch('/api/v2/product-catalog/devices?' + new URLSearchParams(query || {}).toString()),
};
