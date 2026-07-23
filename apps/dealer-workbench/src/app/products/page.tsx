'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Boxes, Package, Search, SlidersHorizontal } from 'lucide-react';
import useSWR from 'swr';
import { PageHeader } from '@rhautt/ui';
import { products } from '../../lib/api';
import { CATEGORIES, PRODUCTS, SYSTEM_PACKS, type CatKey, type Product } from '../../lib/products-data';

type ViewMode = 'products' | 'packs';
type ProductStock = Product['stock'];
type NormalizedProduct = Product & { marginRate: number };

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((category) => category.key));
const STOCK: Record<ProductStock, { label: string; className: string; tone: string }> = {
  in: { label: '现货', className: 'badge-success', tone: 'var(--success)' },
  low: { label: '低库存', className: 'badge-warning', tone: 'var(--warning)' },
  order: { label: '需订货', className: 'badge-danger', tone: 'var(--danger)' },
};

const fmt = (value: number) => `￥${Math.round(value || 0).toLocaleString('zh-CN')}`;
const pct = (value: number) => `${Math.round(value || 0)}%`;

function normalizeCategory(value: unknown): CatKey {
  return typeof value === 'string' && CATEGORY_KEYS.has(value) ? (value as CatKey) : 'heat_pump';
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
    brand: item.brand || item.manufacturer || 'Rhautt',
    model: item.model || item.sku || '',
    name: item.name || item.productName || item.title || '未命名产品',
    spec:
      (typeof item.spec === 'string' ? item.spec : item.spec?.text) ||
      item.description ||
      item.summary ||
      '',
    marketPrice: safeMarketPrice,
    dealerPrice: safeDealerPrice,
    stock: normalizeStock(item.stock || item.meta?.stock || item.availability),
    isNew: Boolean(item.isNew ?? item.meta?.isNew ?? item.tags?.includes?.('new')),
    marginRate,
  };
}

function normalizeFallbackProduct(item: Product): NormalizedProduct {
  return {
    ...item,
    marginRate: item.marketPrice ? ((item.marketPrice - item.dealerPrice) / item.marketPrice) * 100 : 0,
  };
}

export default function ProductsPage() {
  const [category, setCategory] = useState<CatKey | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('products');
  const [keyword, setKeyword] = useState('');

  const { data: apiData, error, isLoading } = useSWR(
    '/api/v2/product-catalog/devices',
    () => products.list(),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    const nextModule = new URLSearchParams(window.location.search).get('module');
    if (nextModule === 'base') setViewMode('packs');
  }, []);

  const productList = useMemo(() => {
    const liveProducts = getProductItems(apiData).map(normalizeProduct).filter((item) => item.id);
    return liveProducts.length ? liveProducts : PRODUCTS.map(normalizeFallbackProduct);
  }, [apiData]);

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

  const productByModel = useMemo(() => {
    const map = new Map<string, NormalizedProduct>();
    PRODUCTS.map(normalizeFallbackProduct).forEach((product) => map.set(product.model, product));
    productList.forEach((product) => {
      if (product.model) map.set(product.model, product);
    });
    return map;
  }, [productList]);

  const stats = useMemo(() => {
    const total = productList.length;
    const stock = productList.filter((product) => product.stock === 'in').length;
    const newest = productList.filter((product) => product.isNew).length;
    const avgMargin = total
      ? productList.reduce((sum, product) => sum + product.marginRate, 0) / total
      : 0;
    return { total, stock, newest, avgMargin };
  }, [productList]);

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
                display: 'inline-flex',
                gap: 3,
                padding: 3,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                background: 'var(--surface-1)',
                boxShadow: 'var(--sh-xs)',
              }}
            >
              <ModeButton active={viewMode === 'products'} onClick={() => setViewMode('products')}>
                <Package size={14} />
                单品
              </ModeButton>
              <ModeButton active={viewMode === 'packs'} onClick={() => setViewMode('packs')}>
                <Boxes size={14} />
                系统方案包
              </ModeButton>
            </div>
          }
        />

        <section className="g4" style={{ gap: 12 }}>
          <Metric label="产品 SKU" value={String(stats.total)} hint="目录可售单品" />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px' }}>
              <Search size={16} style={{ color: 'var(--t-tertiary)', flexShrink: 0 }} />
              <input
                className="input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索型号、品牌、名称或参数"
                style={{ maxWidth: 420 }}
              />
            </div>
            <span
              className={error ? 'badge badge-warning' : 'badge badge-success'}
              title={error ? String(error.message || error) : undefined}
            >
              {error ? '使用本地目录' : isLoading ? '同步中' : '已连接产品 API'}
            </span>
          </div>

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

        {viewMode === 'products' ? (
          <ProductGrid products={visibleProducts} onReset={() => setCategory('all')} />
        ) : (
          <PackGrid productByModel={productByModel} />
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
