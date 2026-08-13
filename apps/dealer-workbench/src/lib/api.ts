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
  // 客户入口：手机验证码登录
  sendSms: (phone: string) =>
    apiFetch('/api/v2/auth/send-sms', { method: 'POST', body: JSON.stringify({ phone }) }),
  loginSms: (phone: string, smsCode: string) =>
    apiFetch('/api/v2/auth/login-sms', { method: 'POST', body: JSON.stringify({ phone, smsCode }) }),
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
  setRoles: (id: string, data: { roleIds: string[]; primaryRoleId?: string; scope?: { scopeType?: string; scopeDimension?: string | null; scopeRef?: string | null } }) =>
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
  businessUnits: () => apiFetch('/api/v2/auth/admin/business-units'),
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
  // 多模态生成：AI 文生图 → 落物料库（经 Tandem 图像网关）
  generateImage: (data: { prompt: string; title?: string; brandSlug?: string; channel?: string; size?: string; negativePrompt?: string }) =>
    apiFetch('/api/v2/growth/materials/generate-image', { method: 'POST', body: JSON.stringify(data) }),
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
  // GEO 第 7 层 · 闭环实验（探测→缺口→内容→复投→验证 lift）
  experiments: (query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/growth/geo/experiments${qs ? `?${qs}` : ''}`);
  },
  experiment: (id: string) =>
    apiFetch(`/api/v2/growth/geo/experiments/${encodeURIComponent(id)}`),
  startExperiment: (data: { brandSlug?: string; questionId?: string; question?: string; hypothesis?: string; killCriteria?: string; competitors?: string[] }) =>
    apiFetch('/api/v2/growth/geo/experiments', { method: 'POST', body: JSON.stringify(data) }),
  linkExperimentContent: (id: string, data: { copyAssetId?: string }) =>
    apiFetch(`/api/v2/growth/geo/experiments/${encodeURIComponent(id)}/link-content`, { method: 'POST', body: JSON.stringify(data) }),
  verifyExperiment: (id: string, data: { competitors?: string[] } = {}) =>
    apiFetch(`/api/v2/growth/geo/experiments/${encodeURIComponent(id)}/verify`, { method: 'POST', body: JSON.stringify(data) }),
  // 自进化策略权重（由实验 lift 反哺）
  strategyWeights: (brandSlug?: string) =>
    apiFetch(`/api/v2/growth/geo/strategy-weights${brandSlug ? `?brandSlug=${encodeURIComponent(brandSlug)}` : ''}`),
  // AI 视角 SWOT（由探测数据派生，可测而非自评）
  swot: (q: { brandSlug?: string; category?: string; windowDays?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiFetch(`/api/v2/growth/geo/swot${qs ? `?${qs}` : ''}`);
  },
  // 场景库 → prompt 簇（选题上游）
  scenarios: (q: { category?: string; brandSlug?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiFetch(`/api/v2/growth/geo/scenarios${qs ? `?${qs}` : ''}`);
  },
  seedScenarios: (data: {
    brandSlug: string; category: string;
    painPoints?: string[]; audiences?: string[]; maxScenarios?: number; dryRun?: boolean;
  }) => apiFetch('/api/v2/growth/geo/scenarios/seed', { method: 'POST', body: JSON.stringify(data) }),
  deriveScenario: (id: string, data: { brandSlug?: string; dryRun?: boolean } = {}) =>
    apiFetch(`/api/v2/growth/geo/scenarios/${encodeURIComponent(id)}/derive`, { method: 'POST', body: JSON.stringify(data) }),
  // 新品牌/品类启动序列（播种→派生选题→基线探测）
  bootstrap: (data: {
    brandSlug: string; category: string;
    painPoints?: string[]; audiences?: string[]; maxScenarios?: number;
    runBaseline?: boolean; dryRun?: boolean;
  }) => apiFetch('/api/v2/growth/geo/bootstrap', { method: 'POST', body: JSON.stringify(data) }),
  // 受治理动作引擎（Foundry 式）
  actions: () => apiFetch('/api/v2/growth/geo/actions'),
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

// L4 售前专业度：AI 问诊 → 选型计算 → 报价
export const presale = {
  detectPainpoints: (data: { description: string; area?: number; city?: string }) =>
    apiFetch('/api/v2/diagnosis/painpoints/detect', { method: 'POST', body: JSON.stringify(data) }),
  createProject: (data: { name: string; city?: string; area?: number }) =>
    apiFetch('/api/v2/design/projects', { method: 'POST', body: JSON.stringify(data) }),
  listProjects: () => apiFetch('/api/v2/design/projects'),
  calc: (projectId: string, data: Record<string, unknown>) =>
    apiFetch(`/api/v2/design/calc/${encodeURIComponent(projectId)}`, { method: 'POST', body: JSON.stringify(data) }),
  generateQuote: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/quotation/generate', { method: 'POST', body: JSON.stringify(data) }),
};

// 经销商专属工作台：我的线索/客户/报价历史/业绩（连 CRM + quotation 真数据）
export const dealerCrm = {
  pipeline: () => apiFetch('/api/v2/crm/pipeline'),
  customers: () => apiFetch('/api/v2/crm/customers'),
  customer: (id: string) => apiFetch(`/api/v2/crm/customers/${encodeURIComponent(id)}`),
  updateStage: (oppId: string, stage: string) =>
    apiFetch(`/api/v2/crm/opportunities/${encodeURIComponent(oppId)}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
  addInteraction: (data: { customerId: string; kind?: string; note?: string }) =>
    apiFetch('/api/v2/crm/interactions', { method: 'POST', body: JSON.stringify(data) }),
  quotations: (query?: Record<string, string>) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiFetch(`/api/v2/quotation${qs ? `?${qs}` : ''}`);
  },
  // 报价导出（后端 ExportEngine，默认 excel/可传 format）。返回导出产物，前端触发下载。
  exportQuote: (body: Record<string, unknown>) =>
    apiFetch('/api/v2/quotation/export', { method: 'POST', body: JSON.stringify(body) }),
};

// 北极星驾驶舱（Phase 1）
export const cockpit = {
  northStar: (period?: string) =>
    apiFetch(`/api/v2/growth/cockpit/north-star${period ? `?period=${encodeURIComponent(period)}` : ''}`),
  dealerSuccess: (period?: string) =>
    apiFetch(`/api/v2/growth/cockpit/dealer-success${period ? `?period=${encodeURIComponent(period)}` : ''}`),
  brandHealth: (period?: string) =>
    apiFetch(`/api/v2/growth/cockpit/brand-health${period ? `?period=${encodeURIComponent(period)}` : ''}`),
  aarrrFunnel: (period?: string) =>
    apiFetch(`/api/v2/growth/cockpit/aarrr-funnel${period ? `?period=${encodeURIComponent(period)}` : ''}`),
  geoLoop: () => apiFetch('/api/v2/growth/cockpit/geo-loop'),
  leadRouting: () => apiFetch('/api/v2/growth/cockpit/lead-routing'),
  trends: (metric: string, days = 30) =>
    apiFetch(`/api/v2/growth/cockpit/trends?metric=${encodeURIComponent(metric)}&days=${days}`),
  recompute: (data: { dealerId: string; amount: number; period?: string }) =>
    apiFetch('/api/v2/growth/cockpit/recompute', { method: 'POST', body: JSON.stringify(data) }),
  cmo: (q: { period?: string; buType?: string; buId?: string } = {}) =>
    apiFetch('/api/v2/growth/cockpit/cmo?' + new URLSearchParams(Object.fromEntries(Object.entries(q).filter(([, v]) => v))).toString()),
};

// 产品管理（4.4/4.5/4.10/4.17）
export const productMgmt = {
  setLifecycle: (id: string, stage: string) =>
    apiFetch(`/api/v2/product-catalog/devices/${encodeURIComponent(id)}/lifecycle`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  listLaunches: () => apiFetch('/api/v2/product-catalog/launches'),
  createLaunch: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/product-catalog/launches', { method: 'POST', body: JSON.stringify(data) }),
  updateLaunch: (id: string, status: string) =>
    apiFetch(`/api/v2/product-catalog/launches/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  listSellingPoints: (productId?: string) =>
    apiFetch('/api/v2/product-catalog/selling-points' + (productId ? `?productId=${encodeURIComponent(productId)}` : '')),
  addSellingPoint: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/product-catalog/selling-points', { method: 'POST', body: JSON.stringify(data) }),
  listPricing: () => apiFetch('/api/v2/product-catalog/pricing-policies'),
  submitPricing: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/product-catalog/pricing-policies', { method: 'POST', body: JSON.stringify(data) }),
  decidePricing: (id: string, decision: 'approved' | 'rejected', note?: string) =>
    apiFetch(`/api/v2/product-catalog/pricing-policies/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision, note }) }),
};

// 内容工厂（模块8）
export const content = {
  list: (q: Record<string, string> = {}) => apiFetch('/api/v2/content?' + new URLSearchParams(q).toString()),
  create: (data: Record<string, unknown>) => apiFetch('/api/v2/content', { method: 'POST', body: JSON.stringify(data) }),
  submit: (id: string) => apiFetch('/api/v2/content/' + encodeURIComponent(id) + '/submit', { method: 'POST' }),
  decide: (id: string, decision: 'approved' | 'rejected') => apiFetch('/api/v2/content/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: JSON.stringify({ decision }) }),
  publish: (id: string) => apiFetch('/api/v2/content/' + encodeURIComponent(id) + '/publish', { method: 'POST' }),
};

// 战役/预算 MROI + OKR（模块7/10）
export const gtmplan = {
  listCampaigns: () => apiFetch('/api/v2/gtmplan/campaigns'),
  createCampaign: (data: Record<string, unknown>) => apiFetch('/api/v2/gtmplan/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  updateCampaign: (id: string, patch: Record<string, unknown>) => apiFetch('/api/v2/gtmplan/campaigns/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
  mroi: () => apiFetch('/api/v2/gtmplan/mroi'),
  listOkrs: (level?: string) => apiFetch('/api/v2/gtmplan/okrs' + (level ? '?level=' + level : '')),
  upsertOkr: (data: Record<string, unknown>) => apiFetch('/api/v2/gtmplan/okrs', { method: 'POST', body: JSON.stringify(data) }),
  okrSummary: () => apiFetch('/api/v2/gtmplan/okr-summary'),
};

// 活动运营（模块5）
export const activation = {
  list: (q: Record<string, string> = {}) => apiFetch('/api/v2/activation/activities?' + new URLSearchParams(q).toString()),
  create: (data: Record<string, unknown>) => apiFetch('/api/v2/activation/activities', { method: 'POST', body: JSON.stringify(data) }),
  setStatus: (id: string, status: string) => apiFetch('/api/v2/activation/activities/' + encodeURIComponent(id) + '/status', { method: 'POST', body: JSON.stringify({ status }) }),
};

// 度量中台（读模型 + 多触点归因）
export const metrics = {
  refresh: (period?: string, model?: string) => apiFetch('/api/v2/metrics/refresh', { method: 'POST', body: JSON.stringify({ period, model }) }),
  daily: (from?: string, to?: string) => apiFetch('/api/v2/metrics/daily?' + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()),
  attribution: (period: string, model = 'position') => apiFetch('/api/v2/metrics/attribution?period=' + encodeURIComponent(period) + '&model=' + model),
};

// 竞品情报（模块1·按品类）
export const insight = {
  listByCategory: (category: string, dimension?: string) =>
    apiFetch('/api/v2/insight/competitor?category=' + encodeURIComponent(category) + (dimension ? '&dimension=' + dimension : '')),
  sov: (category: string) => apiFetch('/api/v2/insight/sov?category=' + encodeURIComponent(category)),
  // 竞争格局：HHI 集中度 + 动量 + 头部差距 + 威胁评分（需 GEO 探测时序数据）
  landscape: (category: string, windowDays?: number) =>
    apiFetch('/api/v2/insight/landscape?category=' + encodeURIComponent(category)
      + (windowDays ? '&windowDays=' + windowDays : '')),
  recordCompetitor: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/insight/competitor', { method: 'POST', body: JSON.stringify(data) }),
  listSignals: (q: Record<string, string> = {}) =>
    apiFetch('/api/v2/insight/signal?' + new URLSearchParams(q).toString()),
  recordSignal: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/insight/signal', { method: 'POST', body: JSON.stringify(data) }),
};

// 渠道与伙伴营销（模块6）
export const channel = {
  listPartners: (q: Record<string, string> = {}) =>
    apiFetch('/api/v2/channel/partners?' + new URLSearchParams(q).toString()),
  recruit: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/channel/partners', { method: 'POST', body: JSON.stringify(data) }),
  updatePartner: (id: string, patch: Record<string, unknown>) =>
    apiFetch('/api/v2/channel/partners/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
  listRebates: () => apiFetch('/api/v2/channel/rebates'),
  submitRebate: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/channel/rebates', { method: 'POST', body: JSON.stringify(data) }),
  decideRebate: (id: string, decision: string) =>
    apiFetch('/api/v2/channel/rebates/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: JSON.stringify({ decision }) }),
  health: () => apiFetch('/api/v2/channel/health'),
};

// 品牌定位 messaging house（模块2）
export const positioning = {
  listHouses: (brandCode?: string) =>
    apiFetch('/api/v2/positioning/houses' + (brandCode ? '?brandCode=' + encodeURIComponent(brandCode) : '')),
  upsertHouse: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/positioning/house', { method: 'POST', body: JSON.stringify(data) }),
  setStatus: (id: string, status: string) =>
    apiFetch('/api/v2/positioning/house/' + encodeURIComponent(id) + '/status', { method: 'POST', body: JSON.stringify({ status }) }),
};

// AgenticGEO 自主闭环 + GEO 进化(借鉴分众智投)
export const agenticGeo = {
  plan: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/growth/geo/agentic/plan', { method: 'POST', body: JSON.stringify(data) }),
  approve: (actionId: string, input: unknown) =>
    apiFetch('/api/v2/growth/geo/agentic/approve', { method: 'POST', body: JSON.stringify({ actionId, input }) }),
  status: () => apiFetch('/api/v2/growth/geo/agentic/status'),
  ignite: (category: string, segment?: string, limit?: number) =>
    apiFetch('/api/v2/growth/geo/agentic/ignite', { method: 'POST', body: JSON.stringify({ category, segment, limit }) }),
};

// GEO 选点 / 千问千面 / 认知资产漏斗（分众式进化）
export const geoFocus = {
  listTargets: (category?: string) =>
    apiFetch('/api/v2/growth/geo/focus/targets' + (category ? '?category=' + encodeURIComponent(category) : '')),
  upsertTarget: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/growth/geo/focus/targets', { method: 'POST', body: JSON.stringify(data) }),
  select: (category: string, segment?: string, limit?: number) =>
    apiFetch('/api/v2/growth/geo/focus/select?category=' + encodeURIComponent(category) + (segment ? '&segment=' + encodeURIComponent(segment) : '') + (limit ? '&limit=' + limit : '')),
  recordCognition: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/growth/geo/focus/cognition', { method: 'POST', body: JSON.stringify(data) }),
  cognitionFunnel: (category?: string) =>
    apiFetch('/api/v2/growth/geo/focus/cognition' + (category ? '?category=' + encodeURIComponent(category) : '')),
  reallocate: (adjustments: Array<{ id: string; deltaPriority: number }>) =>
    apiFetch('/api/v2/growth/geo/focus/reallocate', { method: 'POST', body: JSON.stringify({ adjustments }) }),
};
