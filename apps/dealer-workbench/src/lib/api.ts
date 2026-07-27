import { clearToken, getToken } from '@rhautt/shared-auth';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const AUTH_LOGIN_PATH = '/api/v2/auth/login';
const authExpiredMessages = [
  '\u7f3a\u5c11\u8bbf\u95ee\u4ee4\u724c',
  '\u8bbf\u95ee\u4ee4\u724c\u65e0\u6548',
  'token\u5df2\u8fc7\u671f',
  '\u65e0\u6548\u7684token',
  '\u672a\u63d0\u4f9b\u8ba4\u8bc1token',
  'Unauthorized',
  'jwt expired',
  'invalid token',
  'TokenExpiredError',
];

function isAuthExpired(status: number, details: any): boolean {
  if (status === 401) return true;
  const message = String(details?.message || details?.error || '').toLowerCase();
  return status === 403 && authExpiredMessages.some((item) => message.includes(item.toLowerCase()));
}

function redirectToLogin(path: string, status: number, details: any) {
  if (path === AUTH_LOGIN_PATH || typeof window === 'undefined' || !isAuthExpired(status, details)) return;
  if (window.location.pathname === '/') return;

  clearToken();
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.href = `/?returnUrl=${encodeURIComponent(returnUrl)}`;
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
  const hasBody = opts.body !== undefined && opts.body !== null;
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }
  if (!res.ok) {
    redirectToLogin(path, res.status, json);
    const error = new Error(json.message || json.error || 'Request failed') as Error & {
      details?: Record<string, unknown>;
      status?: number;
    };
    error.details = json;
    error.status = res.status;
    throw error;
  }
  return json.data ?? json;
}

export const auth = {
  login: (phone: string, password: string) =>
    apiFetch('/api/v2/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  me: () => apiFetch('/api/v2/auth/me'),
  logout: () => apiFetch('/api/v2/auth/logout', { method: 'POST' }),
};

export const adminUsers = {
  list: (q?: Record<string, string>) =>
    apiFetch('/api/v2/auth/admin/users?' + new URLSearchParams(q || {}).toString()),
  create: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/auth/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, patch: Record<string, unknown>) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
  resetPassword: (id: string, newPassword: string) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id) + '/reset-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
  remove: (id: string) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id), { method: 'DELETE' }),
};

export const products = {
  list: (query?: Record<string, string>) =>
    apiFetch('/api/v2/product-catalog/devices?' + new URLSearchParams(query || {}).toString()),
  get: (id: string, query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/product-catalog/devices/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`);
  },
  taxonomy: () => apiFetch('/api/v2/product-catalog/taxonomy'),
  create: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/product-catalog/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/product-catalog/devices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  archive: (id: string, tenantId?: string) => {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return apiFetch(`/api/v2/product-catalog/devices/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
    });
  },
};

export const brandProductCategories = {
  list: (query: { brandCode: string; parentId?: string; metrics?: string }) =>
    apiFetch('/api/v2/brand-product-categories?' + new URLSearchParams(query).toString()),
  create: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/brand-product-categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-product-categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiFetch(`/api/v2/brand-product-categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  usage: (id: string) =>
    apiFetch(`/api/v2/brand-product-categories/${encodeURIComponent(id)}/usage`),
};

export const fileArtifacts = {
  uploadBase64: (data: {
    entityType?: string;
    entityId?: string;
    filename: string;
    mimeType?: string;
    dataBase64: string;
  }) =>
    apiFetch('/api/v2/file-artifact/upload-base64', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiFetch(`/api/v2/file-artifact/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const brand = {
  data: () => apiFetch('/api/v2/brand'),
  sync: () => apiFetch('/api/v2/brand/sync', { method: 'POST' }),
};

export const brandSites = {
  list: (query?: { includeDeleted?: boolean }) => {
    const q = new URLSearchParams();
    if (query?.includeDeleted) q.set('includeDeleted', 'true');
    const qs = q.toString();
    return apiFetch(`/api/v2/brand-sites${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}`),
  create: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/brand-sites', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restore: (id: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  publish: (id: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  logo: (id: string, opts?: RequestInit) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}/logo`, opts),
  uploadLogo: (
    id: string,
    data: { filename?: string; mimeType?: string; dataBase64?: string }
  ) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}/logo`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const siteProductAssignments = {
  list: (siteCode: string, query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments${qs ? `?${qs}` : ''}`);
  },
  create: (siteCode: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (siteCode: string, assignmentId: string, data: Record<string, unknown>) =>
    apiFetch(
      `/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  publish: (siteCode: string, assignmentId: string) =>
    apiFetch(
      `/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments/${encodeURIComponent(assignmentId)}/publish`,
      { method: 'POST' }
    ),
  batchPublish: (siteCode: string, items: Array<Record<string, unknown>>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments/batch/publish`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  batchHide: (siteCode: string, items: Array<Record<string, unknown>>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments/batch/hide`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  hide: (siteCode: string, assignmentId: string) =>
    apiFetch(
      `/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments/${encodeURIComponent(assignmentId)}/hide`,
      { method: 'POST' }
    ),
  archive: (siteCode: string, assignmentId: string) =>
    apiFetch(
      `/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'DELETE' }
    ),
};

export const siteMaterials = {
  list: (brandCode: string) =>
    apiFetch(`/local-site-materials/${encodeURIComponent(brandCode)}`),
  upload: (
    brandCode: string,
    data: { key: string; filename: string; mimeType: string; dataBase64: string }
  ) =>
    apiFetch(`/local-site-materials/${encodeURIComponent(brandCode)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
