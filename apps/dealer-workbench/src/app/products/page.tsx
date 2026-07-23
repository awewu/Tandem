'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Archive, Boxes, CheckCircle2, Edit3, FileText, Package, Plus, Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { PageHeader } from '@rhautt/ui';
import { auth, products } from '../../lib/api';
import { canWriteBrandProducts } from '../../lib/brand-product-adapter';
import { CATEGORIES, PRODUCTS, SYSTEM_PACKS, type CatKey, type Product } from '../../lib/products-data';

type ProductModule = 'catalog' | 'materials' | 'base';
type ProductStock = Product['stock'];
type BrandFilter = 'all' | 'rheem' | 'ruud' | 'everhot';
type ProductBrand = Exclude<BrandFilter, 'all'>;
type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';
type CreateProductDraft = {
  brand: ProductBrand | '';
  name: string;
  skuSeed: string;
  category: CatKey | '';
  system: string;
};
type EditProductDraft = {
  name: string;
  model: string;
  category: string;
  system: string;
  publicSlug: string;
  series: string;
  tagline: string;
  websiteCategory: string;
  displayOrder: string;
  badges: string;
  officialEnglishName: string;
};
type RowActionState = {
  dirty: boolean;
  saving: boolean;
  success: string;
  error: string;
};
type NormalizedProduct = Product & {
  sku: string;
  status: string;
  system: string;
  marginRate: number;
  raw?: Record<string, any>;
};

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((category) => category.key));
const BRAND_OPTIONS: Array<{ value: BrandFilter; label: string }> = [
  { value: 'all', label: '全部品牌' },
  { value: 'rheem', label: '瑞美 Rheem' },
  { value: 'ruud', label: '瑞德 Ruud' },
  { value: 'everhot', label: '恒热 Everhot' },
];
const CREATE_BRAND_OPTIONS: Array<{ value: ProductBrand; label: string }> = [
  { value: 'rheem', label: '瑞美 Rheem' },
  { value: 'ruud', label: '瑞德 Ruud' },
  { value: 'everhot', label: '恒热 Everhot' },
];
const SUPPORTED_PRODUCT_BRANDS: ProductBrand[] = ['rheem', 'ruud', 'everhot'];
const BRAND_PRODUCT_TENANTS: Record<ProductBrand, string | undefined> = {
  rheem: process.env.NEXT_PUBLIC_RHEEM_TENANT_ID || '4aee0000-0000-4000-8000-000000000001',
  ruud: process.env.NEXT_PUBLIC_RUUD_TENANT_ID || '7aad0000-0000-4000-8000-000000000001',
  everhot: process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001',
};
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '上架' },
  { value: 'inactive', label: '停用' },
  { value: 'archived', label: '已归档' },
];
const STOCK: Record<ProductStock, { label: string; className: string; tone: string }> = {
  in: { label: '现货', className: 'badge-success', tone: 'var(--success)' },
  low: { label: '低库存', className: 'badge-warning', tone: 'var(--warning)' },
  order: { label: '需订货', className: 'badge-danger', tone: 'var(--danger)' },
};

const fmt = (value: number) => `￥${Math.round(value || 0).toLocaleString('zh-CN')}`;
const pct = (value: number) => `${Math.round(value || 0)}%`;

function normalizeModule(value: unknown): ProductModule {
  return value === 'materials' || value === 'base' ? value : 'catalog';
}

function normalizeCategory(value: unknown): CatKey {
  return typeof value === 'string' && CATEGORY_KEYS.has(value) ? (value as CatKey) : 'heat_pump';
}

function normalizeBrand(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function displayBrand(value: string): string {
  if (value === 'rheem') return '瑞美 Rheem';
  if (value === 'ruud') return '瑞德 Ruud';
  if (value === 'everhot') return '恒热 Everhot';
  return value || '未绑定';
}

function statusLabel(status: string): string {
  if (status === 'active') return '上架';
  if (status === 'inactive') return '停用';
  if (status === 'archived') return '已归档';
  return status || '未知';
}

function statusClassName(status: string): string {
  if (status === 'active') return 'badge-success';
  if (status === 'inactive') return 'badge-warning';
  if (status === 'archived') return 'badge-grey';
  return 'badge-info';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function skeletonSku(brand: ProductBrand, seed: string): string {
  const suffix = slug(seed || `${brand}-${Date.now()}`).replace(/-/g, '').slice(0, 24) || String(Date.now());
  return `${brand.toUpperCase()}-${suffix.toUpperCase()}`;
}

function emptyCreateDraft(): CreateProductDraft {
  return { brand: '', name: '', skuSeed: '', category: '', system: '' };
}

function editDraftFromProduct(product: NormalizedProduct): EditProductDraft {
  const brandMeta = productBrandMeta(product);
  return {
    name: text(product.name),
    model: text(product.model),
    category: text(product.category),
    system: text(product.system),
    publicSlug: text(brandMeta.slug) || slug(text(product.sku)),
    series: text(brandMeta.series),
    tagline: text(brandMeta.tagline),
    websiteCategory: text(brandMeta.websiteCategory || brandMeta.websiteMenuCategory || brandMeta.cat),
    displayOrder: String(nonNegativeInt(brandMeta.displayOrder ?? brandMeta.sortOrder)),
    badges: Array.isArray(brandMeta.badges) ? brandMeta.badges.map(text).filter(Boolean).join(', ') : '',
    officialEnglishName: text(brandMeta.en || brandMeta.officialEnglishName),
  };
}

function tenantIdForProduct(product: NormalizedProduct): string {
  return text(product.raw?.tenantId);
}

function productBrandMeta(product: NormalizedProduct): Record<string, any> {
  const meta = objectOrEmpty(product.raw?.meta);
  return objectOrEmpty(meta[normalizeBrand(product.brand)]);
}

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function splitBadges(value: string): string[] {
  return value
    .split(/[,，\n]/g)
    .map(text)
    .filter(Boolean);
}

function productUpdatePayload(
  product: NormalizedProduct,
  draft: EditProductDraft,
  status?: 'active' | 'inactive',
): Record<string, unknown> {
  const name = text(draft.name);
  const model = text(draft.model);
  const category = text(draft.category);
  const system = text(draft.system);
  if (!name) throw new Error('请填写产品名称。');
  if (!model) throw new Error('请填写产品型号。');
  if (!category) throw new Error('请选择分类。');
  if (!system) throw new Error('请填写系统。');
  const previousSpec = objectOrEmpty(product.raw?.spec);
  const brand = normalizeBrand(product.brand);
  const previousMeta = objectOrEmpty(product.raw?.meta);
  const previousBrandMeta = objectOrEmpty(previousMeta[brand]);
  const publicSlug = slug(draft.publicSlug);
  const websiteCategory = text(draft.websiteCategory);
  const displayOrder = nonNegativeInt(draft.displayOrder);
  const tenantId = tenantIdForProduct(product);
  return {
    ...(tenantId ? { tenantId } : {}),
    name,
    category,
    ...(status ? { status } : {}),
    spec: {
      ...previousSpec,
      officialModel: model,
      model,
      system,
    },
    meta: {
      ...previousMeta,
      [brand]: {
        ...previousBrandMeta,
        slug: publicSlug,
        name,
        model,
        cat: websiteCategory || category,
        websiteCategory,
        websiteMenuCategory: websiteCategory,
        sys: system,
        displayOrder,
        sortOrder: displayOrder,
        series: text(draft.series),
        tagline: text(draft.tagline),
        en: text(draft.officialEnglishName),
        badges: splitBadges(draft.badges),
      },
    },
  };
}

function productStatusPayload(
  product: NormalizedProduct,
  status: 'active' | 'inactive',
): Record<string, unknown> {
  const tenantId = tenantIdForProduct(product);
  return { status, ...(tenantId ? { tenantId } : {}) };
}

function createProductPayload(draft: CreateProductDraft): Record<string, unknown> {
  if (!draft.brand) throw new Error('请选择产品品牌。');
  const tenantId = BRAND_PRODUCT_TENANTS[draft.brand];
  if (!tenantId) throw new Error(`缺少 ${displayBrand(draft.brand)} 品牌租户 ID 配置。`);
  const name = text(draft.name);
  const skuSeed = text(draft.skuSeed);
  const category = text(draft.category);
  const system = text(draft.system);
  if (!name) throw new Error('请填写产品名称。');
  if (!skuSeed) throw new Error('请填写型号或编码种子。');
  if (!category) throw new Error('请选择分类。');
  if (!system) throw new Error('请填写系统。');
  const sku = skeletonSku(draft.brand, skuSeed);
  return {
    tenantId,
    sku,
    name,
    brand: draft.brand,
    category,
    status: 'active',
    spec: {
      officialModel: skuSeed,
      model: skuSeed,
      system,
    },
    meta: {
      [draft.brand]: {
        slug: slug(skuSeed) || slug(sku),
        name,
        model: skuSeed,
        cat: category,
        websiteMenuCategory: category,
        sys: system,
        displayOrder: 0,
        sortOrder: 0,
        badges: [],
      },
    },
  };
}

function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function productModel(item: Record<string, any>): string {
  const spec = objectOrEmpty(item.spec);
  const meta = objectOrEmpty(item.meta);
  const brandMeta = objectOrEmpty(meta[normalizeBrand(item.brand)]);
  return (
    text(item.model) ||
    text(spec.officialModel) ||
    text(spec.model) ||
    text(brandMeta.model) ||
    text(item.sku)
  );
}

function productSystem(item: Record<string, any>): string {
  const spec = objectOrEmpty(item.spec);
  const meta = objectOrEmpty(item.meta);
  const brandMeta = objectOrEmpty(meta[normalizeBrand(item.brand)]);
  return text(item.systemFamily) || text(item.system) || text(spec.system) || text(brandMeta.sys);
}

function normalizeStock(value: unknown): ProductStock {
  if (value === 'low' || value === 'order') return value;
  if (typeof value === 'string') {
    const text = value.toLowerCase();
    if (text.includes('low') || text.includes('缺') || text.includes('少')) return 'low';
    if (text.includes('order') || text.includes('订') || text.includes('期货')) return 'order';
  }
  return 'in';
}

function getProductItems(apiData: any): any[] {
  const payload = apiData?.data ?? apiData;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.devices)) return payload.devices;
  return [];
}

function getProductTotal(apiData: any): number {
  const payload = apiData?.data ?? apiData;
  return Number(payload?.total ?? getProductItems(apiData).length);
}

function mergeCatalogResponses(responses: any[]): { items: any[]; total: number } {
  const byId = new Map<string, any>();
  for (const response of responses) {
    for (const item of getProductItems(response)) {
      const key = text(item?.id || item?._id || `${item?.tenantId || ''}:${item?.sku || item?.model || item?.name || ''}`);
      if (key) byId.set(key, item);
    }
  }
  const items = Array.from(byId.values());
  return {
    items,
    total: responses.reduce((sum, response) => sum + getProductTotal(response), 0),
  };
}

function normalizeProduct(item: any): NormalizedProduct {
  const marketPrice = Number(item.marketPrice ?? item.listPrice ?? item.retailPrice ?? item.msrp ?? 0);
  const dealerPrice = Number(item.dealerPrice ?? item.costPrice ?? item.tradePrice ?? item.price ?? 0);
  const safeMarketPrice = marketPrice || dealerPrice;
  const safeDealerPrice = dealerPrice || marketPrice;
  const marginRate = safeMarketPrice
    ? ((safeMarketPrice - safeDealerPrice) / safeMarketPrice) * 100
    : 0;

  return {
    id: String(item.id || item._id || item.sku || item.model || item.name),
    category: normalizeCategory(item.category || item.systemFamily || item.family),
    brand: normalizeBrand(item.brand || item.manufacturer || 'rhautt'),
    sku: text(item.sku),
    model: productModel(item),
    name: item.name || item.productName || item.title || '未命名产品',
    spec:
      (typeof item.spec === 'string' ? item.spec : item.spec?.text) ||
      item.description ||
      item.summary ||
      '',
    system: productSystem(item),
    status: text(item.status) || 'active',
    marketPrice: safeMarketPrice,
    dealerPrice: safeDealerPrice,
    stock: normalizeStock(item.stock || item.meta?.stock || item.availability),
    isNew: Boolean(item.isNew ?? item.meta?.isNew ?? item.tags?.includes?.('new')),
    marginRate,
    raw: item,
  };
}

function normalizeFallbackProduct(item: Product): NormalizedProduct {
  return {
    ...item,
    sku: item.model,
    status: 'active',
    system: '',
    marginRate: item.marketPrice ? ((item.marketPrice - item.dealerPrice) / item.marketPrice) * 100 : 0,
  };
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeModule = normalizeModule(searchParams.get('module'));
  const [category, setCategory] = useState<CatKey | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [canWrite, setCanWrite] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const catalogQueries = useMemo(() => {
    const query: Record<string, string> = { page: '1', pageSize: '100' };
    const q = keyword.trim();
    if (q) query.q = q;
    if (brandFilter !== 'all') {
      query.brand = brandFilter;
      const tenantId = BRAND_PRODUCT_TENANTS[brandFilter];
      if (tenantId) query.tenantId = tenantId;
    }
    if (statusFilter !== 'all') query.status = statusFilter;
    if (category !== 'all') query.category = category;
    if (brandFilter !== 'all') return [query];
    return SUPPORTED_PRODUCT_BRANDS.map((brand) => ({
      ...query,
      brand,
      tenantId: BRAND_PRODUCT_TENANTS[brand] || '',
    }));
  }, [brandFilter, category, keyword, statusFilter]);

  const { data: apiData, error, isLoading, mutate } = useSWR(
    ['/api/v2/product-catalog/devices', catalogQueries],
    async () => {
      const responses = await Promise.all(catalogQueries.map((query) => products.list(query)));
      return responses.length === 1 ? responses[0] : mergeCatalogResponses(responses);
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then((me) => {
        if (!cancelled) setCanWrite(canWriteBrandProducts(me));
      })
      .catch(() => {
        if (!cancelled) setCanWrite(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setModule(nextModule: ProductModule) {
    router.push(nextModule === 'catalog' ? '/products?module=catalog' : `/products?module=${nextModule}`);
  }

  const liveProductList = useMemo(() => {
    return getProductItems(apiData).map(normalizeProduct).filter((item) => item.id);
  }, [apiData]);

  const productList = useMemo(() => {
    const liveProducts = liveProductList;
    return liveProducts.length ? liveProducts : PRODUCTS.map(normalizeFallbackProduct);
  }, [liveProductList]);

  const visibleProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return productList.filter((product) => {
      const categoryMatch = category === 'all' || product.category === category;
      if (!categoryMatch) return false;
      if (!query) return true;
      return [product.name, product.brand, product.model, product.spec]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [category, keyword, productList]);

  const visibleCatalogProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return liveProductList.filter((product) => {
      if (brandFilter !== 'all' && normalizeBrand(product.brand) !== brandFilter) return false;
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      if (category !== 'all' && product.category !== category) return false;
      if (!query) return true;
      return [product.sku, product.name, product.model].join(' ').toLowerCase().includes(query);
    });
  }, [brandFilter, category, keyword, liveProductList, statusFilter]);

  const productByModel = useMemo(() => {
    const map = new Map<string, NormalizedProduct>();
    PRODUCTS.map(normalizeFallbackProduct).forEach((product) => map.set(product.model, product));
    productList.forEach((product) => {
      if (product.model) map.set(product.model, product);
    });
    return map;
  }, [productList]);

  const statsProducts = activeModule === 'catalog' ? liveProductList : productList;
  const stats = useMemo(() => {
    const total = statsProducts.length;
    const stock = statsProducts.filter((product) => product.stock === 'in').length;
    const newest = statsProducts.filter((product) => product.isNew).length;
    const avgMargin = total
      ? statsProducts.reduce((sum, product) => sum + product.marginRate, 0) / total
      : 0;
    return { total, stock, newest, avgMargin };
  }, [statsProducts]);

  return (
    <div
      style={{
        background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)',
        minHeight: '100%',
      }}
    >
      <div className="page-container" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title="5000 原生产品库"
          subtitle="Rhautt Nexus 产品目录 · 单品、系统方案包、库存与经销价格"
          actions={
            <div
              style={{
                display: 'flex',
                gap: 3,
                padding: 3,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                background: 'var(--surface-1)',
                boxShadow: 'var(--sh-xs)',
                flexWrap: 'wrap',
                maxWidth: '100%',
              }}
            >
              <ModeButton active={activeModule === 'catalog'} onClick={() => setModule('catalog')}>
                <Package size={14} />
                单品
              </ModeButton>
              <ModeButton active={activeModule === 'materials'} onClick={() => setModule('materials')}>
                <FileText size={14} />
                产品资料
              </ModeButton>
              <ModeButton active={activeModule === 'base'} onClick={() => setModule('base')}>
                <Boxes size={14} />
                目录底座
              </ModeButton>
            </div>
          }
        />

        <section className="g4" style={{ gap: 12 }}>
          <Metric label="产品编码" value={String(stats.total)} hint="目录可售单品" />
          <Metric label="现货产品" value={String(stats.stock)} hint="可直接纳入报价" />
          <Metric label="新品" value={String(stats.newest)} hint="建议优先推荐" />
          <Metric label="平均毛利" value={pct(stats.avgMargin)} hint="按指导价估算" />
        </section>

        <section
          className="card-elevated"
          style={{
            padding: 14,
            display: 'grid',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px', minWidth: 0 }}>
              <Search size={16} style={{ color: 'var(--t-tertiary)', flexShrink: 0 }} />
              <input
                className="input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索型号、品牌、名称或参数"
                style={{ maxWidth: 420, minWidth: 0 }}
              />
            </div>
            <span
              className={error ? 'badge badge-warning' : 'badge badge-success'}
              title={error ? String(error.message || error) : undefined}
              style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}
            >
              {error ? '产品 API 加载失败' : isLoading ? '同步中' : '已连接产品 API'}
            </span>
          </div>

          {activeModule === 'catalog' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  color: 'var(--t-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  marginRight: 2,
                }}
              >
                品牌
              </span>
              {BRAND_OPTIONS.map((item) => (
                <CategoryChip
                  key={item.value}
                  active={brandFilter === item.value}
                  onClick={() => setBrandFilter(item.value)}
                >
                  {item.label}
                </CategoryChip>
              ))}
            </div>
          )}

          {activeModule === 'catalog' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  color: 'var(--t-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  marginRight: 2,
                }}
              >
                状态
              </span>
              {STATUS_OPTIONS.map((item) => (
                <CategoryChip
                  key={item.value}
                  active={statusFilter === item.value}
                  onClick={() => setStatusFilter(item.value)}
                >
                  {item.label}
                </CategoryChip>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: 'var(--t-secondary)',
                fontSize: 12,
                fontWeight: 600,
                marginRight: 2,
              }}
            >
              <SlidersHorizontal size={14} />
              分类
            </span>
            <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
              全部
            </CategoryChip>
            {CATEGORIES.map((item) => (
              <CategoryChip
                key={item.key}
                active={category === item.key}
                onClick={() => setCategory(item.key)}
              >
                {item.label}
              </CategoryChip>
            ))}
          </div>
        </section>

        {activeModule === 'catalog' ? (
          <ProductCatalogShell
            products={visibleCatalogProducts}
            total={Number((apiData as any)?.total ?? liveProductList.length)}
            isLoading={isLoading}
            error={error}
            canWrite={canWrite}
            actionNotice={actionNotice}
            onNotice={setActionNotice}
            onCreated={(brand) => {
              setBrandFilter(brand);
              setStatusFilter('active');
              setCategory('all');
              setKeyword('');
              return mutate();
            }}
            onChanged={() => mutate()}
            onReset={() => {
              setCategory('all');
              setBrandFilter('all');
              setStatusFilter('all');
              setKeyword('');
            }}
          />
        ) : activeModule === 'materials' ? (
          <ProductMaterialsView products={productList} />
        ) : (
          <ProductBaseView products={productList} productByModel={productByModel} />
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'btn btn-brand btn-sm' : 'btn btn-ghost btn-sm'}
      style={{
        borderRadius: 'var(--r-lg)',
        boxShadow: active ? 'var(--sh-xs)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'pill-brand' : 'pill-neutral'}
      style={{
        minHeight: 28,
        borderColor: active ? 'var(--brand-100)' : 'var(--border)',
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated" style={{ padding: '16px 18px' }}>
      <div className="t-label">{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 28,
          lineHeight: 1.1,
          fontWeight: 700,
          color: 'var(--t-strong)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <p style={{ marginTop: 4, fontSize: 12, color: 'var(--t-tertiary)' }}>{hint}</p>
    </div>
  );
}

function ProductCatalogShell({
  products: items,
  total,
  isLoading,
  error,
  canWrite,
  actionNotice,
  onNotice,
  onCreated,
  onChanged,
  onReset,
}: {
  products: NormalizedProduct[];
  total: number;
  isLoading: boolean;
  error: unknown;
  canWrite: boolean;
  actionNotice: string;
  onNotice: (text: string) => void;
  onCreated: (brand: ProductBrand) => Promise<unknown>;
  onChanged: () => Promise<unknown>;
  onReset: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateProductDraft>(() => emptyCreateDraft());
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const payload = createProductPayload(createDraft);
      await products.create(payload);
      setCreateDraft(emptyCreateDraft());
      setShowCreate(false);
      onNotice(`Created ${String(payload.name)} for ${displayBrand(String(payload.brand))}.`);
      await onCreated(payload.brand as ProductBrand);
    } catch (e) {
      const message = (e as Error)?.message || 'Create product failed.';
      setCreateError(message);
      onNotice(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="card-elevated" style={{ padding: 0, overflow: 'hidden', maxWidth: '100%' }}>
      <div
        style={{
          padding: 18,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <p className="t-label">产品目录 CRUD 工作台</p>
          <h2 className="t-headline" style={{ marginTop: 4 }}>
            真实产品主数据
          </h2>
          <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13, overflowWrap: 'anywhere' }}>
            当前列表来自 /api/v2/product-catalog/devices，编辑、状态切换与归档会写回同一份产品主数据。
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="btn btn-brand btn-sm"
            onClick={() => {
              setCreateError('');
              setShowCreate((value) => !value);
            }}
            style={{ flexShrink: 0 }}
          >
            <Plus size={14} />
            {showCreate ? '收起新增' : '新增产品'}
          </button>
        ) : (
          <span className="badge badge-grey" style={{ flexShrink: 0 }}>
            只读查看
          </span>
        )}
      </div>

      {canWrite && showCreate && (
        <CreateProductForm
          draft={createDraft}
          error={createError}
          submitting={creating}
          onChange={setCreateDraft}
          onCancel={() => {
            setCreateDraft(emptyCreateDraft());
            setCreateError('');
          }}
          onSubmit={submitCreate}
        />
      )}

      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'var(--t-secondary)', fontSize: 12, minWidth: 0 }}>
          {isLoading ? '正在加载真实产品...' : `显示 ${items.length} / ${total} 个产品`}
        </span>
        {actionNotice && (
          <span
            className="badge badge-info"
            role="status"
            style={{ maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'normal' }}
          >
            {actionNotice}
          </span>
        )}
      </div>

      {error ? (
        <EmptyCatalogState
          title="产品 API 暂不可用"
          description={String((error as Error)?.message || error)}
          onReset={onReset}
        />
      ) : !isLoading && !items.length ? (
        <EmptyCatalogState
          title="当前筛选下没有真实产品"
          description="可以清空筛选重新查看，或在后续写入表单补齐后创建新产品。"
          onReset={onReset}
        />
      ) : (
        <div style={{ display: 'grid', minWidth: 0 }}>
          {items.map((product) => (
            <ProductCatalogRow
              key={product.id}
              product={product}
              canWrite={canWrite}
              onNotice={onNotice}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CreateProductForm({
  draft,
  error,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: CreateProductDraft;
  error: string;
  submitting: boolean;
  onChange: (draft: CreateProductDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const patch = (next: Partial<CreateProductDraft>) => onChange({ ...draft, ...next });
  const tenantId = draft.brand ? BRAND_PRODUCT_TENANTS[draft.brand] : '';

  return (
    <form
      onSubmit={onSubmit}
      style={{
        padding: 18,
        borderBottom: '1px solid var(--border)',
        display: 'grid',
        gap: 14,
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">品牌</span>
          <select
            className="input"
            value={draft.brand}
            required
            onChange={(event) => patch({ brand: event.target.value as ProductBrand })}
          >
            <option value="">选择品牌</option>
            {CREATE_BRAND_OPTIONS.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {brand.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产品名称</span>
          <input
            className="input"
            value={draft.name}
            required
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Rheem heat pump 16kW"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">型号 / 编码种子</span>
          <input
            className="input"
            value={draft.skuSeed}
            required
            onChange={(event) => patch({ skuSeed: event.target.value })}
            placeholder="RP-16kW-INV"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">分类</span>
          <select
            className="input"
            value={draft.category}
            required
            onChange={(event) => patch({ category: event.target.value as CatKey })}
          >
            <option value="">选择分类</option>
            {CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">系统</span>
          <input
            className="input"
            value={draft.system}
            required
            onChange={(event) => patch({ system: event.target.value })}
            placeholder="air-source-heat-pump"
          />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span className={tenantId ? 'badge badge-success' : 'badge badge-warning'} style={{ maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
          {tenantId ? `tenantId: ${tenantId}` : '请选择品牌以匹配租户 tenantId'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={submitting}>
            重置
          </button>
          <button type="submit" className="btn btn-brand btn-sm" disabled={submitting}>
            <Plus size={14} />
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13, overflowWrap: 'anywhere' }}>
          {error}
        </p>
      )}
    </form>
  );
}

function ProductCatalogRow({
  product,
  canWrite,
  onNotice,
  onChanged,
}: {
  product: NormalizedProduct;
  canWrite: boolean;
  onNotice: (text: string) => void;
  onChanged: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditProductDraft>(() => editDraftFromProduct(product));
  const [rowState, setRowState] = useState<RowActionState>({
    dirty: false,
    saving: false,
    success: '',
    error: '',
  });

  useEffect(() => {
    setDraft(editDraftFromProduct(product));
    setRowState({ dirty: false, saving: false, success: '', error: '' });
  }, [product.id, product.name, product.model, product.category, product.system, product.status, product.raw?.meta]);

  function patchDraft(next: Partial<EditProductDraft>) {
    const updated = { ...draft, ...next };
    setDraft(updated);
    setRowState((state) => ({
      ...state,
      dirty: JSON.stringify(updated) !== JSON.stringify(editDraftFromProduct(product)),
      success: '',
      error: '',
    }));
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    setRowState((state) => ({ ...state, saving: true, error: '', success: '' }));
    try {
      await products.update(product.id, productUpdatePayload(product, draft));
      setEditing(false);
      setRowState({ dirty: false, saving: false, success: '已保存，刷新品牌页可见同步变化。', error: '' });
      onNotice(`已保存 ${product.sku || draft.name}。`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '保存产品失败。';
      setRowState((state) => ({ ...state, saving: false, error: message, success: '' }));
      onNotice(message);
    }
  }

  async function changeStatus(nextStatus: 'active' | 'inactive') {
    setRowState((state) => ({ ...state, saving: true, error: '', success: '' }));
    try {
      await products.update(product.id, productStatusPayload(product, nextStatus));
      setRowState({ dirty: false, saving: false, success: `状态已切换为${statusLabel(nextStatus)}。`, error: '' });
      onNotice(`状态已切换为${statusLabel(nextStatus)}：${product.sku || product.name}`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '状态切换失败。';
      setRowState((state) => ({ ...state, saving: false, error: message, success: '' }));
      onNotice(message);
    }
  }

  async function archiveProduct() {
    if (!window.confirm(`确认归档「${product.name}」？归档后会从默认产品列表移出，但不会物理删除。`)) return;
    setRowState((state) => ({ ...state, saving: true, error: '', success: '' }));
    try {
      await products.archive(product.id, tenantIdForProduct(product) || undefined);
      setRowState({ dirty: false, saving: false, success: '已归档，默认列表不再显示。', error: '' });
      onNotice(`已归档 ${product.sku || product.name}。`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '归档产品失败。';
      setRowState((state) => ({ ...state, saving: false, error: message, success: '' }));
      onNotice(message);
    }
  }

  const statusTarget = product.status === 'active' ? 'inactive' : 'active';
  const customCategory = draft.category && !CATEGORY_KEYS.has(draft.category);
  const brandMeta = productBrandMeta(product);
  const websiteCategory = text(brandMeta.websiteCategory || brandMeta.websiteMenuCategory || brandMeta.cat);

  return (
    <div style={{ borderBottom: '1px solid var(--border)', minWidth: 0 }}>
      <article
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
          gap: 12,
          alignItems: 'center',
          padding: '14px 18px',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              className="pill-neutral"
              style={{ maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            >
              {product.sku || '未生成编码'}
            </span>
            <span className="pill-brand" style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
              {displayBrand(product.brand)}
            </span>
            {rowState.dirty && <span className="badge badge-warning">有未保存修改</span>}
            {rowState.saving && <span className="badge badge-info">保存中...</span>}
          </div>
          <h3
            style={{
              marginTop: 8,
              color: 'var(--t-primary)',
              fontSize: 15,
              lineHeight: 1.35,
              fontWeight: 700,
              overflowWrap: 'anywhere',
            }}
          >
            {product.name}
          </h3>
          <p style={{ marginTop: 4, color: 'var(--t-tertiary)', fontSize: 12, overflowWrap: 'anywhere' }}>
            型号 {product.model || '待补齐'}
          </p>
        </div>

        <MetaBlock label="分类" value={product.category || '未分类'} />
        <MetaBlock label="系统" value={product.system || '待补齐'} />
        <MetaBlock label="官网公开路径" value={text(brandMeta.slug) || product.sku || '待补齐'} />
        <MetaBlock label="官网分类" value={websiteCategory || product.category || '待补齐'} />
        <span
          className={`badge ${statusClassName(product.status)}`}
          style={{ justifySelf: 'start', maxWidth: '100%', overflowWrap: 'anywhere' }}
        >
          {statusLabel(product.status)}
        </span>
        {canWrite ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              flexWrap: 'wrap',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setEditing((value) => !value)}
              disabled={rowState.saving}
              style={{ flex: '0 1 auto' }}
            >
              <Edit3 size={14} />
              {editing ? '收起' : '编辑'}
            </button>
            {product.status !== 'archived' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => changeStatus(statusTarget)}
                disabled={rowState.saving}
                style={{ flex: '0 1 auto' }}
              >
                {statusTarget === 'active' ? '启用' : '停用'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={archiveProduct}
              disabled={rowState.saving || product.status === 'archived'}
              style={{ flex: '0 1 auto' }}
            >
              <Archive size={14} />
              归档
            </button>
          </div>
        ) : (
          <span
            style={{
              justifySelf: 'end',
              color: 'var(--t-tertiary)',
              fontSize: 12,
              overflowWrap: 'anywhere',
            }}
          >
            无写入权限
          </span>
        )}
      </article>

      {(rowState.success || rowState.error) && (
        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {rowState.success && (
            <span className="badge badge-success" role="status" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              <CheckCircle2 size={13} />
              {rowState.success}
            </span>
          )}
          {rowState.error && (
            <span className="badge badge-warning" role="alert" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              <XCircle size={13} />
              {rowState.error}
            </span>
          )}
        </div>
      )}

      {canWrite && editing && (
        <form
          onSubmit={saveEdit}
          style={{
            padding: '0 18px 16px',
            display: 'grid',
            gap: 12,
            background: 'var(--surface-1)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">产品名称</span>
              <input
                className="input"
                value={draft.name}
                required
                onChange={(event) => patchDraft({ name: event.target.value })}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">型号</span>
              <input
                className="input"
                value={draft.model}
                required
                onChange={(event) => patchDraft({ model: event.target.value })}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">分类</span>
              <select
                className="input"
                value={draft.category}
                required
                onChange={(event) => patchDraft({ category: event.target.value })}
              >
                {customCategory && <option value={draft.category}>{draft.category}</option>}
                {CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">系统</span>
              <input
                className="input"
                value={draft.system}
                required
                onChange={(event) => patchDraft({ system: event.target.value })}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
            <div>
              <p className="t-label">品牌官网元数据</p>
              <p style={{ marginTop: 4, color: 'var(--t-tertiary)', fontSize: 12 }}>
                写入 {displayBrand(product.brand)} 的产品官网基础字段；官网货架覆盖项仍在货架页面维护。
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">公开路径</span>
                <input
                  className="input"
                  value={draft.publicSlug}
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => patchDraft({ publicSlug: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">系列</span>
                <input
                  className="input"
                  value={draft.series}
                  onChange={(event) => patchDraft({ series: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">宣传语</span>
                <input
                  className="input"
                  value={draft.tagline}
                  onChange={(event) => patchDraft({ tagline: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网分类</span>
                <input
                  className="input"
                  value={draft.websiteCategory}
                  onChange={(event) => patchDraft({ websiteCategory: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">展示排序</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="999999"
                  value={draft.displayOrder}
                  onChange={(event) => patchDraft({ displayOrder: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">标签</span>
                <input
                  className="input"
                  value={draft.badges}
                  onChange={(event) => patchDraft({ badges: event.target.value })}
                  placeholder="新品, 高端"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官方英文名</span>
                <input
                  className="input"
                  value={draft.officialEnglishName}
                  onChange={(event) => patchDraft({ officialEnglishName: event.target.value })}
                />
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span className={rowState.dirty ? 'badge badge-warning' : 'badge badge-grey'}>
              {rowState.dirty ? '有未保存修改' : '无未保存修改'}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(editDraftFromProduct(product));
                  setRowState({ dirty: false, saving: false, success: '', error: '' });
                }}
                disabled={rowState.saving}
              >
                重置
              </button>
              <button type="submit" className="btn btn-brand btn-sm" disabled={rowState.saving || !rowState.dirty}>
                {rowState.saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p className="t-label">{label}</p>
      <p style={{ marginTop: 4, color: 'var(--t-primary)', fontSize: 13, overflowWrap: 'anywhere' }}>
        {value}
      </p>
    </div>
  );
}

function EmptyCatalogState({
  title,
  description,
  onReset,
}: {
  title: string;
  description: string;
  onReset: () => void;
}) {
  return (
    <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--t-secondary)' }}>
      <p style={{ fontSize: 14, fontWeight: 700 }}>{title}</p>
      <p style={{ marginTop: 6, fontSize: 13 }}>{description}</p>
      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={onReset}>
        清空筛选
      </button>
    </div>
  );
}

function ProductGrid({
  products: items,
  onReset,
}: {
  products: NormalizedProduct[];
  onReset: () => void;
}) {
  if (!items.length) {
    return (
      <div
        className="card-elevated"
        style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--t-secondary)' }}
      >
        <p style={{ fontSize: 14, fontWeight: 600 }}>当前筛选下暂无产品</p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: 12 }}
          onClick={onReset}
        >
          查看全部产品
        </button>
      </div>
    );
  }

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}
    >
      {items.map((product) => {
        const stock = STOCK[product.stock];
        return (
          <article key={product.id} className="card-elevated" style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="pill-neutral">{product.brand}</span>
                  {product.isNew && <span className="pill-brand">新品</span>}
                </div>
                <h2
                  style={{
                    marginTop: 10,
                    color: 'var(--t-primary)',
                    fontSize: 16,
                    lineHeight: 1.35,
                    fontWeight: 700,
                  }}
                >
                  {product.name}
                </h2>
              </div>
              <span className={`badge ${stock.className}`} style={{ flexShrink: 0 }}>
                {stock.label}
              </span>
            </div>

            <div
              style={{
                marginTop: 8,
                minHeight: 56,
                color: 'var(--t-secondary)',
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              <p>{product.model || '标准型号'}</p>
              <p>{product.spec || '参数待同步'}</p>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color: 'var(--t-tertiary)',
                    fontSize: 11,
                    textDecoration: 'line-through',
                  }}
                >
                  指导价 {fmt(product.marketPrice)}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    color: 'var(--brand)',
                    fontSize: 22,
                    lineHeight: 1.1,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(product.dealerPrice)}
                </div>
              </div>
              <span
                style={{
                  color: 'var(--success)',
                  background: 'var(--success-bg)',
                  border: '1px solid rgba(120,157,74,0.22)',
                  borderRadius: 'var(--r-lg)',
                  padding: '4px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                毛利 {pct(product.marginRate)}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ProductMaterialsView({ products: items }: { products: NormalizedProduct[] }) {
  const rows = items.map((product) => {
    const raw = product.raw || {};
    const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    const positioning = raw.positioning && typeof raw.positioning === 'object' ? raw.positioning : {};
    const hasMainImage =
      assetRefs.some((ref: any) => ref?.role === 'main' || ref?.role === 'card') ||
      Boolean((meta as any).imageArtifactId);
    return {
      product,
      assetCount: assetRefs.length,
      hasMainImage,
      hasPositioning: Object.keys(positioning).length > 0,
      hasSeoBase: Boolean((meta as any).everhot?.slug || product.model),
    };
  });
  const withAssets = rows.filter((row) => row.assetCount > 0).length;
  const withMainImage = rows.filter((row) => row.hasMainImage).length;
  const withPositioning = rows.filter((row) => row.hasPositioning).length;

  return (
    <section className="card-elevated" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
        <p className="t-label">Product Materials</p>
        <h2 className="t-headline" style={{ marginTop: 4 }}>产品资料管理</h2>
        <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13 }}>
          管理每个产品编码的图片素材、定位资料和官网展示基础信息。
        </p>
      </div>
      <div className="g4" style={{ gap: 12, padding: 16 }}>
        <Metric label="已挂素材" value={`${withAssets}/${items.length}`} hint="assetRefs 或旧主图" />
        <Metric label="主图就绪" value={`${withMainImage}/${items.length}`} hint="官网卡片可展示" />
        <Metric label="定位资料" value={`${withPositioning}/${items.length}`} hint="人群/场景/卖点" />
        <Metric label="待补资料" value={String(Math.max(0, items.length - withMainImage))} hint="优先补主图与摘要" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>产品编码</th>
              <th>品牌</th>
              <th>素材</th>
              <th>主图</th>
              <th>定位</th>
              <th>官网基础</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product.id}>
                <td>
                  <strong>{row.product.name}</strong>
                  <div style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{row.product.model}</div>
                </td>
                <td>{row.product.brand}</td>
                <td>{row.assetCount} 个素材</td>
                <td><span className={row.hasMainImage ? 'badge badge-success' : 'badge badge-warning'}>{row.hasMainImage ? '已就绪' : '待补充'}</span></td>
                <td><span className={row.hasPositioning ? 'badge badge-success' : 'badge badge-warning'}>{row.hasPositioning ? '已填写' : '待填写'}</span></td>
                <td><span className={row.hasSeoBase ? 'badge badge-success' : 'badge badge-warning'}>{row.hasSeoBase ? '可生成' : '待完善'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductBaseView({
  products: items,
  productByModel,
}: {
  products: NormalizedProduct[];
  productByModel: Map<string, NormalizedProduct>;
}) {
  const categoryRows = CATEGORIES.map((category) => ({
    ...category,
    count: items.filter((product) => product.category === category.key).length,
  }));
  const keyed = items.filter((product) => product.raw?.productKey).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card-elevated" style={{ padding: 18 }}>
        <p className="t-label">Catalog Foundation</p>
        <h2 className="t-headline" style={{ marginTop: 4 }}>产品目录底座</h2>
        <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13 }}>
          维护分类底座、系统方案包和产品身份键，供报价、官网和设计模块复用。
        </p>
        <div className="g4" style={{ gap: 12, marginTop: 16 }}>
          <Metric label="分类数" value={String(CATEGORIES.length)} hint="目录筛选底座" />
          <Metric label="方案包" value={String(SYSTEM_PACKS.length)} hint="系统组合模板" />
          <Metric label="身份键覆盖" value={`${keyed}/${items.length}`} hint="productKey 去重基础" />
          <Metric label="可报价产品编码" value={String(items.filter((item) => item.marketPrice > 0).length)} hint="已有价格字段" />
        </div>
      </section>
      <section className="g2" style={{ gap: 16 }}>
        <div className="card-elevated" style={{ padding: 16 }}>
          <h3 className="t-headline">分类底座</h3>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {categoryRows.map((category) => (
              <div key={category.key} className="inset" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{category.label}</span>
                <strong>{category.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <PackGrid productByModel={productByModel} />
      </section>
    </div>
  );
}

function PackGrid({ productByModel }: { productByModel: Map<string, NormalizedProduct> }) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
      }}
    >
      {SYSTEM_PACKS.map((pack) => {
        const itemSum = pack.items.reduce((sum, item) => {
          const product = productByModel.get(item.model);
          return sum + (product ? product.marketPrice * item.qty : 0);
        }, 0);
        const save = Math.max(0, itemSum - pack.bundlePrice);
        const margin = itemSum ? (save / itemSum) * 100 : 0;

        return (
          <article
            key={pack.id}
            className="card-elevated"
            style={{
              padding: 18,
              borderTop: '3px solid var(--brand)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 className="t-headline">{pack.name}</h2>
                <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>{pack.desc}</p>
              </div>
              <span className="pill-brand" style={{ alignSelf: 'flex-start' }}>
                方案包
              </span>
            </div>

            <p style={{ marginTop: 8, color: 'var(--t-tertiary)', fontSize: 12 }}>
              适用场景：{pack.scenario}
            </p>

            <div className="inset" style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {pack.items.map((item) => {
                const product = productByModel.get(item.model);
                return (
                  <div
                    key={item.model}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--t-primary)',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={product?.name || item.model}
                    >
                      {product?.name || item.model}
                    </span>
                    <span style={{ color: 'var(--t-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                      x{item.qty}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color: 'var(--t-tertiary)',
                    fontSize: 11,
                    textDecoration: 'line-through',
                  }}
                >
                  单品合计 {fmt(itemSum)}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    color: 'var(--brand)',
                    fontSize: 26,
                    lineHeight: 1.05,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(pack.bundlePrice)}
                </div>
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                <span className="pill-brand">立省 {fmt(save)}</span>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>组合让利 {pct(margin)}</span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
