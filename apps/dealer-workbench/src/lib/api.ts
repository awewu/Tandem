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
  setRoles: (id: string, data: { roleIds: string[]; primaryRoleId?: string }) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id) + '/roles', { method: 'PUT', body: JSON.stringify(data) }),
  effectivePermissions: (id: string) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id) + '/effective-permissions'),
};

export const adminRbac = {
  permissions: () => apiFetch('/api/v2/auth/admin/permissions'),
  roles: () => apiFetch('/api/v2/auth/admin/roles'),
  createRole: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/auth/admin/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: Record<string, unknown>) =>
    apiFetch('/api/v2/auth/admin/roles/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }),
  setRolePermissions: (id: string, permissions: string[]) =>
    apiFetch('/api/v2/auth/admin/roles/' + encodeURIComponent(id) + '/permissions', { method: 'PUT', body: JSON.stringify({ permissions }) }),
};

export const auditLogs = {
  list: (query?: Record<string, string>) =>
    apiFetch('/api/v2/audit-logs?' + new URLSearchParams(query || {}).toString()),
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
  listContent: (id: string, query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/product-catalog/devices/${encodeURIComponent(id)}/content${qs ? `?${qs}` : ''}`);
  },
  upsertContent: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/product-catalog/devices/${encodeURIComponent(id)}/content`, {
      method: 'POST',
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
  getBase64: (id: string) =>
    apiFetch(`/api/v2/file-artifact/${encodeURIComponent(id)}/base64`),
  remove: (id: string) =>
    apiFetch(`/api/v2/file-artifact/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const brand = {
  data: () => apiFetch('/api/v2/brand'),
  sync: () => apiFetch('/api/v2/brand/sync', { method: 'POST' }),
};

export const wechatPublishing = {
  accounts: () => apiFetch('/api/v2/marketing/wechat/accounts'),
  createAccount: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/marketing/wechat/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/marketing/wechat/accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateSecret: (id: string, appSecret: string) =>
    apiFetch(`/api/v2/marketing/wechat/accounts/${encodeURIComponent(id)}/secret`, {
      method: 'PATCH',
      body: JSON.stringify({ appSecret }),
    }),
  updateStatus: (id: string, status: 'enabled' | 'disabled') =>
    apiFetch(`/api/v2/marketing/wechat/accounts/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  testConnection: (id: string) =>
    apiFetch(`/api/v2/marketing/wechat/accounts/${encodeURIComponent(id)}/test-connection`, { method: 'POST' }),
  availableAccounts: (brandId: string) =>
    apiFetch(`/api/v2/marketing/wechat/accounts/available?brandId=${encodeURIComponent(brandId)}`),
  createReviewVersion: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/marketing/content-review-versions', { method: 'POST', body: JSON.stringify(data) }),
  pendingReviews: (query?: Record<string, string>) =>
    apiFetch('/api/v2/marketing/content-review-versions/pending?' + new URLSearchParams(query || {}).toString()),
  reviewDetail: (id: string) =>
    apiFetch(`/api/v2/marketing/content-review-versions/${encodeURIComponent(id)}`),
  approveReview: (id: string, comment?: string) =>
    apiFetch(`/api/v2/marketing/content-review-versions/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  requestChanges: (id: string, reason: string) =>
    apiFetch(`/api/v2/marketing/content-review-versions/${encodeURIComponent(id)}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  voidReview: (id: string, reason: string) =>
    apiFetch(`/api/v2/marketing/content-review-versions/${encodeURIComponent(id)}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  tasks: () => apiFetch('/api/v2/marketing/wechat/draft-sync-tasks'),
  taskDetail: (id: string) =>
    apiFetch(`/api/v2/marketing/wechat/draft-sync-tasks/${encodeURIComponent(id)}`),
  addTaskNote: (id: string, note: string) =>
    apiFetch(`/api/v2/marketing/wechat/draft-sync-tasks/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  processQueuedTasks: () =>
    apiFetch('/api/v2/marketing/wechat/draft-sync-tasks/process', { method: 'POST' }),
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

export const siteBasicSettings = {
  get: (siteCode: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/basic-settings`),
  update: (siteCode: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/basic-settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateSection: (siteCode: string, section: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/basic-settings/${encodeURIComponent(section)}`, {
      method: 'PUT',
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

export const siteNews = {
  list: (siteCode: string, query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/news${qs ? `?${qs}` : ''}`);
  },
  create: (siteCode: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/news`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (siteCode: string, articleId: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/news/${encodeURIComponent(articleId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  publish: (siteCode: string, articleId: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/news/${encodeURIComponent(articleId)}/publish`, {
      method: 'POST',
    }),
  hide: (siteCode: string, articleId: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/news/${encodeURIComponent(articleId)}/hide`, {
      method: 'POST',
    }),
  archive: (siteCode: string, articleId: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/news/${encodeURIComponent(articleId)}`, {
      method: 'DELETE',
    }),
};

export const siteInquiries = {
  list: (siteCode: string, query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/inquiries${qs ? `?${qs}` : ''}`);
  },
  remove: (siteCode: string, inquiryId: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/inquiries/${encodeURIComponent(inquiryId)}`, {
      method: 'DELETE',
    }),
};

export const siteMaterials = {
  list: (brandCode: string) =>
    apiFetch(`/api/v2/site-materials/${encodeURIComponent(brandCode)}`),
  upload: (
    brandCode: string,
    data: { key: string; filename: string; mimeType: string; dataBase64: string }
  ) =>
    apiFetch(`/api/v2/site-materials/${encodeURIComponent(brandCode)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  uploadCarousel: (
    brandCode: string,
    files: Array<{ filename: string; mimeType: string; dataBase64: string; linkUrl?: string }>
  ) =>
    apiFetch(`/api/v2/site-materials/${encodeURIComponent(brandCode)}`, {
      method: 'POST',
      body: JSON.stringify({ key: 'home-hero-carousel', files }),
    }),
  saveCarousel: (brandCode: string, items: Array<Record<string, unknown>>) =>
    apiFetch(`/api/v2/site-materials/${encodeURIComponent(brandCode)}`, {
      method: 'PUT',
      body: JSON.stringify({ key: 'home-hero-carousel', items }),
    }),
  saveModule: (brandCode: string, key: string, items: Array<Record<string, unknown>>) =>
    apiFetch(`/api/v2/site-materials/${encodeURIComponent(brandCode)}`, {
      method: 'PUT',
      body: JSON.stringify({ key, items }),
    }),
  resetDefault: (brandCode: string, key: string) =>
    apiFetch(`/api/v2/site-materials/${encodeURIComponent(brandCode)}`, {
      method: 'PUT',
      body: JSON.stringify({ key, resetDefault: true }),
    }),
};

export const growthMaterials = {
  list: (query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/growth/materials${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}`),
  create: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/growth/materials', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  approve: (id: string, data?: Record<string, unknown>) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  publish: (id: string) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  recordDownload: (id: string) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}/download`, { method: 'POST' }),
  archive: (id: string) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
  remove: (id: string) =>
    apiFetch(`/api/v2/growth/materials/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const growthGeo = {
  visibility: () => apiFetch('/api/v2/growth/geo/visibility'),
  onsiteReadiness: () => apiFetch('/api/v2/growth/geo/onsite-readiness'),
  engines: () => apiFetch('/api/v2/growth/geo/engines'),
  questionSet: (data: { brandSlug?: string; category?: string; stage?: string }) =>
    apiFetch('/api/v2/growth/geo/question-set', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createQuestion: (data: {
    brandSlug: string;
    category: string;
    stage: 'pre' | 'mid' | 'post' | 'followup';
    question: string;
    priority?: number;
    enabled?: boolean;
  }) =>
    apiFetch('/api/v2/growth/geo/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateQuestion: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/growth/geo/questions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  disableQuestion: (id: string) =>
    apiFetch(`/api/v2/growth/geo/questions/${encodeURIComponent(id)}/disable`, { method: 'POST' }),
  removeQuestion: (id: string) =>
    apiFetch(`/api/v2/growth/geo/questions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveGeneratedQuestions: (data: { brandSlug?: string; category?: string; questions?: Array<Record<string, unknown>> }) =>
    apiFetch('/api/v2/growth/geo/question-set/save-generated', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  probeWorklist: (data: { brandSlug?: string; category?: string; stage?: string; engines?: string[] }) =>
    apiFetch('/api/v2/growth/geo/probe-worklist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  probe: (data: {
    question: string;
    engine: string;
    answerSnapshot?: string;
    competitors?: string[];
    brandSlug?: string;
    weCited?: boolean;
    citationRank?: number;
    competitorsCited?: string[];
  }) =>
    apiFetch('/api/v2/growth/geo/probe', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  runProbeJob: (data: {
    question: string;
    engine?: string;
    brandSlug?: string;
    competitors?: string[];
  }) =>
    apiFetch('/api/v2/growth/geo/probe-jobs/run', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  streamProbeJob: async (
    data: { question: string; engine?: string; brandSlug?: string; competitors?: string[] },
    onEvent: (event: Record<string, any>) => void,
  ) => {
    const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    const res = await fetch(`${API}/api/v2/growth/geo/probe-jobs/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(text || '流式探测失败');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          onEvent(JSON.parse(payload));
        }
      }
    }
  },
  probeJobs: () => apiFetch('/api/v2/growth/geo/probe-jobs'),
  probeJob: (id: string) =>
    apiFetch(`/api/v2/growth/geo/probe-jobs/${encodeURIComponent(id)}`),
  runProbeBatch: (data: { brandSlug?: string; category?: string; stage?: string; questionIds?: string[]; competitors?: string[] }) =>
    apiFetch('/api/v2/growth/geo/probe-batches/run', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  probeBatches: (query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/growth/geo/probe-batches${qs ? `?${qs}` : ''}`);
  },
  probeBatch: (id: string) =>
    apiFetch(`/api/v2/growth/geo/probe-batches/${encodeURIComponent(id)}`),
  structuredData: (data: { brandSlug?: string }) =>
    apiFetch('/api/v2/growth/geo/structured-data', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  optimizationContent: (data: {
    kind: 'faq' | 'comparison' | 'topic';
    probeJobId?: string;
    question: string;
    category?: string;
    answerPreview?: string;
    brandSlug?: string;
    competitors?: string[];
    contentGaps?: Array<Record<string, unknown>>;
    sources?: Array<Record<string, unknown>>;
  }) =>
    apiFetch('/api/v2/growth/geo/optimization-content', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  streamOptimizationContent: async (
    data: {
      kind: 'faq' | 'comparison' | 'topic';
      probeJobId?: string;
      question: string;
      category?: string;
      answerPreview?: string;
      brandSlug?: string;
      competitors?: string[];
      contentGaps?: Array<Record<string, unknown>>;
      sources?: Array<Record<string, unknown>>;
    },
    onEvent: (event: Record<string, any>) => void,
  ) => {
    const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    const res = await fetch(`${API}/api/v2/growth/geo/optimization-content/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(text || '生成优化内容失败');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          onEvent(JSON.parse(payload));
        }
      }
    }
  },
};

export const growthCopy = {
  list: (query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/growth/copy${qs ? `?${qs}` : ''}`);
  },
  generate: (data: { channel: string; prompt: string; brandSlug?: string }) =>
    apiFetch('/api/v2/growth/copy/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { draft?: string }) =>
    apiFetch(`/api/v2/growth/copy/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  approve: (id: string) =>
    apiFetch(`/api/v2/growth/copy/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    }),
  reject: (id: string) =>
    apiFetch(`/api/v2/growth/copy/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
    }),
  remove: (id: string) =>
    apiFetch(`/api/v2/growth/copy/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

export const growthOpinion = {
  connectors: () => apiFetch('/api/v2/growth/opinion/connectors'),
  mentions: () => apiFetch('/api/v2/growth/opinion/mentions'),
  alerts: () => apiFetch('/api/v2/growth/opinion/alerts'),
  ingest: (data: {
    source: string;
    content: string;
    url?: string;
    authorHash?: string;
    entities?: string[];
  }) =>
    apiFetch('/api/v2/growth/opinion/mentions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  pull: (data: { source: string; query: string; limit?: number }) =>
    apiFetch('/api/v2/growth/opinion/pull', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAlertStatus: (id: string, status: 'open' | 'ack' | 'resolved') =>
    apiFetch(`/api/v2/growth/opinion/alerts/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
};

export const growthCampaigns = {
  list: () => apiFetch('/api/v2/growth/campaigns'),
  roiBoard: () => apiFetch('/api/v2/growth/campaigns/roi-board'),
  create: (data: {
    name: string;
    channel: string;
    budget?: number;
    utm?: Record<string, unknown>;
  }) =>
    apiFetch('/api/v2/growth/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recordMetric: (data: {
    campaignId: string;
    impressions?: number;
    clicks?: number;
    leads?: number;
    signed?: number;
    cac?: number;
    roi?: number;
    period?: string;
  }) =>
    apiFetch('/api/v2/growth/campaigns/metrics', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
