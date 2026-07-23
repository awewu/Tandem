export interface Positioning {
  targetSegments: string[];
  channels: string[];
  userPersonas: string[];
  markets: string[];
  valueProposition: string;
  painPoints: string[];
  scenarios: string[];
  applicationScenarios?: string[];
}

export interface AssetRef {
  role: string;
  artifactId: string;
  objectKey?: string;
  filename?: string;
  mimeType?: string;
}

export interface ProductRecord {
  id?: string;
  tenantId?: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  spec?: Record<string, unknown>;
  positioning?: Partial<Positioning>;
  assetRefs?: AssetRef[];
  listPrice?: number;
  costPrice?: number;
  currency?: string;
  status?: string;
  meta?: Record<string, any>;
  updatedAt?: string;
}

export interface ProductFacet {
  value: string;
  count: number;
}

export interface ProductFacets {
  brands?: ProductFacet[];
  categories?: ProductFacet[];
  statuses?: ProductFacet[];
}

export interface TenantOption {
  id: string;
  code?: string;
  name?: string;
  status?: string;
  settings?: Record<string, any>;
}

export interface TaxonomyTerm {
  code: string;
  label: string;
}

export type Taxonomy = Record<string, TaxonomyTerm[]>;

export interface SessionUser {
  userId?: string;
  tenantId?: string;
  role?: string;
}

export const EMPTY_POSITIONING: Positioning = {
  targetSegments: [],
  channels: [],
  userPersonas: [],
  markets: [],
  valueProposition: '',
  painPoints: [],
  scenarios: [],
  applicationScenarios: [],
};

export interface ProductWorkspaceOptions {
  tenantId?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  category?: string;
  status?: string;
  brand?: string;
}

export async function requestJson(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, {
    headers,
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `请求失败 HTTP ${response.status}`);
  }
  return payload.data ?? payload;
}

function unwrapItems(payload: any): ProductRecord[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

function unwrapListMeta(payload: any) {
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  return {
    total: Number(data?.total || 0),
    page: Number(data?.page || 1),
    pageSize: Number(data?.pageSize || 50),
    pages: Number(data?.pages || 1),
    facets: (data?.facets || {}) as ProductFacets,
  };
}

function unwrapTenants(payload: any): TenantOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
  return rows.filter((tenant: TenantOption) => {
    const brand = String(tenant?.settings?.brand || tenant?.code || '').toLowerCase();
    return ['rheem', 'ruud', 'everhot'].includes(brand);
  });
}

export function tenantBrand(tenant?: TenantOption | null) {
  return String(tenant?.settings?.brand || tenant?.code || '').toLowerCase();
}

export async function loadTenantOptions(user?: SessionUser | null) {
  if (user?.role === 'platform_admin' || user?.role === 'hq_admin') {
    return unwrapTenants(await requestJson('/api/tenants?status=active'));
  }
  if (!user?.tenantId) return [];
  return [{ id: user.tenantId, name: user.tenantId, code: user.tenantId, status: 'active' }];
}

export async function loadProductWorkspace(options: ProductWorkspaceOptions = {}) {
  const sessionResult = await requestJson('/api/session');
  const user = (sessionResult.user || null) as SessionUser | null;
  const tenants = await loadTenantOptions(user);
  const tenantId = options.tenantId || tenants[0]?.id || user?.tenantId || '';
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.q?.trim()) params.set('q', options.q.trim());
  if (options.category && options.category !== 'all') params.set('category', options.category);
  if (options.status && options.status !== 'all') params.set('status', options.status);
  if (options.brand && options.brand !== 'all') params.set('brand', options.brand);

  const [catalog, taxonomy] = await Promise.all([
    requestJson(`/api/product-catalog/devices?${params.toString()}`),
    requestJson('/api/product-catalog/taxonomy').catch(() => ({})),
  ]);
  const products = unwrapItems(catalog);
  const unique = new Map(products.map((product) => [`${product.tenantId}:${product.sku}`, product]));
  return {
    user,
    tenantId,
    tenants,
    products: Array.from(unique.values()),
    taxonomy: taxonomy as Taxonomy,
    ...unwrapListMeta(catalog),
  };
}

export function isEditableProduct(product: ProductRecord, tenantId: string) {
  return Boolean(tenantId && tenantId !== 'rhautt_shared' && product.tenantId === tenantId);
}

export function formatMoney(value: unknown, currency = 'CNY') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function updateProductDevice(id: string, body: Record<string, unknown>) {
  return requestJson(`/api/product-catalog/devices/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function archiveProductDevice(id: string, tenantId: string) {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  return requestJson(`/api/product-catalog/devices/${encodeURIComponent(id)}${query}`, {
    method: 'DELETE',
  });
}

export function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
