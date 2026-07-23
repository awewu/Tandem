import { getToken } from '@rhautt/shared-auth';

// API base — 默认空串 = 同源相对路径，由 next.config.js 的 rewrites 服务端转发到
// NestJS(3300，前缀 /api/v2)。避免浏览器跨域 CORS 与 token 跨源泄露。
// 需要指向远端时用 NEXT_PUBLIC_API_URL 覆盖（须自带 scheme+host）。
const API = process.env.NEXT_PUBLIC_API_URL || '';

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
    const error = new Error(json.message || json.error || '请求失败') as Error & {
      details?: Record<string, unknown>;
    };
    error.details = json;
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

// 管理员账号管理（后端 @Roles: platform_admin / hq_admin / dealer_admin）
export const adminUsers = {
  list: (q?: Record<string, string>) =>
    apiFetch('/api/v2/auth/admin/users?' + new URLSearchParams(q || {}).toString()),
  create: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/auth/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, patch: Record<string, unknown>) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
  resetPassword: (id: string, newPassword: string) =>
    apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id) + '/reset-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
};

export const crm = {
  listCustomers: (query?: Record<string, string>) =>
    apiFetch('/api/v2/crm/customers?' + new URLSearchParams(query || {}).toString()),
  createLead: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  // 漏斗看板：一次拉全部商机 + 客户摘要
  pipeline: () => apiFetch('/api/v2/crm/pipeline'),
  // 客户 360：客户 + 商机 + 跟进记录
  customer360: (id: string) => apiFetch('/api/v2/crm/customers/' + encodeURIComponent(id)),
  // 拖拽换阶段（轻量）
  updateStage: (id: string, stage: string) =>
    apiFetch('/api/v2/crm/opportunities/' + encodeURIComponent(id) + '/stage', {
      method: 'PUT', body: JSON.stringify({ stage }),
    }),
  // 编辑商机字段（金额/概率/下一步/丢单原因/阶段）
  updateOpportunity: (id: string, data: Record<string, unknown>) =>
    apiFetch('/api/v2/crm/opportunities/' + encodeURIComponent(id), {
      method: 'PUT', body: JSON.stringify(data),
    }),
  // 新增跟进记录
  addInteraction: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/crm/interactions', { method: 'POST', body: JSON.stringify(data) }),
  // 签单：标记 signed + 自动触发 BIM 承接（原子）
  sign: (opportunityId: string, quotationId: string) =>
    apiFetch(`/api/v2/crm/opportunities/${encodeURIComponent(opportunityId)}/sign`, {
      method: 'POST', body: JSON.stringify({ quotationId }),
    }),
};

export const design = {
  saveFloorPlan: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/design/floor-plans', { method: 'POST', body: JSON.stringify(data) }),
  listProjects: () =>
    apiFetch('/api/v2/design/projects'),
  getLatestPlan: (projectId: string) =>
    apiFetch(`/api/v2/design/projects/${encodeURIComponent(projectId)}/floor-plan`),
  createFromOpportunity: (data: {
    opportunityId: string; customerId: string; name?: string;
    area?: number; city?: string; systems?: string[]; painPoints?: string[];
  }) => apiFetch('/api/v2/design/projects/from-opportunity', { method: 'POST', body: JSON.stringify(data) }),
};

export const quotation = {
  generate: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/quotation/generate', { method: 'POST', body: JSON.stringify(data) }),
  econetPremium: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/quotation/econet-premium', { method: 'POST', body: JSON.stringify(data) }),
  loadCalc: (area: number, city: string) =>
    apiFetch('/api/v2/quotation/load-calc', { method: 'POST', body: JSON.stringify({ area, city }) }),
  list: (query?: Record<string, string>) =>
    apiFetch('/api/v2/quotation?' + new URLSearchParams(query || {}).toString()),
  lock: (id: string) =>
    apiFetch(`/api/v2/quotation/${encodeURIComponent(id)}/lock`, { method: 'POST' }),
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

export const bim = {
  stats: () => apiFetch('/api/v2/bim/stats'),

  list: (query?: Record<string, string>) =>
    apiFetch('/api/v2/bim?' + new URLSearchParams(query || {}).toString()),
  get: (id: string) => apiFetch(`/api/v2/bim/${encodeURIComponent(id)}`),
  inherit: (quotationId: string) =>
    apiFetch(`/api/v2/bim/inherit/${encodeURIComponent(quotationId)}`, { method: 'POST' }),
  advance: (id: string) =>
    apiFetch(`/api/v2/bim/${encodeURIComponent(id)}/advance`, { method: 'PUT' }),
  assign: (id: string, assignedTo: string) =>
    apiFetch(`/api/v2/bim/${encodeURIComponent(id)}/assign`, { method: 'POST', body: JSON.stringify({ assignedTo }) }),
  updateDrawing: (id: string, drawingUrl: string) =>
    apiFetch(`/api/v2/bim/${encodeURIComponent(id)}/drawing`, { method: 'PUT', body: JSON.stringify({ drawingUrl }) }),
  checkItem: (id: string, index: number, done: boolean) =>
    apiFetch(`/api/v2/bim/${encodeURIComponent(id)}/acceptance/${index}`, { method: 'PUT', body: JSON.stringify({ done }) }),
  iotPackage: (id: string) => apiFetch(`/api/v2/bim/${encodeURIComponent(id)}/iot-package`),
  updatePaid: (id: string, paidValue: number) =>
    apiFetch(`/api/v2/bim/${encodeURIComponent(id)}/paid`, { method: 'PUT', body: JSON.stringify({ paidValue }) }),
  exportBom: async (id: string, filename: string): Promise<void> => {
    const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    const res = await fetch(`${API}/api/v2/bim/${encodeURIComponent(id)}/bom/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};

export const deepening = {
  projects: (q = '') => apiFetch(`/api/v2/rysnova-bim/projects${q}`),
  stats: () => apiFetch('/api/v2/rysnova-bim/projects/stats'),
  project: (id: string) => apiFetch(`/api/v2/rysnova-bim/projects/${encodeURIComponent(id)}`),
  advance: (id: string) => apiFetch(`/api/v2/rysnova-bim/projects/${encodeURIComponent(id)}/advance`, { method: 'POST' }),
  deepeningPackage: (projectId: string) =>
    apiFetch(`/api/v2/rysnova-bim/projects/${encodeURIComponent(projectId)}/deepening-package`),
  generateVisual: (projectId: string, body: Record<string, unknown> = {}) =>
    apiFetch(`/api/v2/rysnova-bim/projects/${encodeURIComponent(projectId)}/visual-artifacts`, { method: 'POST', body: JSON.stringify(body) }),
  generateDeliverable: (projectId: string, body: Record<string, unknown> = {}) =>
    apiFetch(`/api/v2/rysnova-bim/projects/${encodeURIComponent(projectId)}/deliverable-artifacts`, { method: 'POST', body: JSON.stringify(body) }),
  artifacts: (q = '') => apiFetch(`/api/v2/rysnova-bim/artifacts${q}`),
  approveArtifact: (artifactId: string, body: Record<string, unknown> = {}) =>
    apiFetch(`/api/v2/rysnova-bim/artifacts/${encodeURIComponent(artifactId)}/approval`, { method: 'POST', body: JSON.stringify(body) }),
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
  logo: (id: string) => apiFetch(`/api/v2/brand-sites/${encodeURIComponent(id)}/logo`),
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
  list: (siteCode: string) =>
    apiFetch(`/api/v2/brand-sites/${encodeURIComponent(siteCode)}/product-assignments`),
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

// ── 售后服务 API ────────────────────────────────────────────────────────────
// 售后域已原生化：NestJS /api/v2/aftersales（工单 + 保修台账，RLS 租户隔离）。
export const aftersales = {
  // 工单列表（返回 { items, total }）
  listTickets:  (query?: Record<string, string>) =>
    apiFetch('/api/v2/aftersales/tickets?' + new URLSearchParams(query || {}).toString()),
  // 创建工单
  createTicket: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/aftersales/tickets', { method: 'POST', body: JSON.stringify(data) }),
  // 派工
  dispatch:     (id: string, assignedTo: string) =>
    apiFetch(`/api/v2/aftersales/tickets/${encodeURIComponent(id)}/assign`, { method: 'PUT', body: JSON.stringify({ assignedTo }) }),
  // 更新工单状态
  updateStatus: (id: string, status: string) =>
    apiFetch(`/api/v2/aftersales/tickets/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  // 关闭工单
  close:        (id: string, resolution: string) =>
    apiFetch(`/api/v2/aftersales/tickets/${encodeURIComponent(id)}/close`, { method: 'POST', body: JSON.stringify({ resolution }) }),
  // 保修台账（返回 { items, total }）
  listWarranties: () => apiFetch('/api/v2/aftersales/warranties'),
  // 登记保修
  createWarranty: (data: Record<string, unknown>) =>
    apiFetch('/api/v2/aftersales/warranties', { method: 'POST', body: JSON.stringify(data) }),
};
