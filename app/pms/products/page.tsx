/**
 * PMS · 产品目录 (只读)
 * 主数据由 YS 物料档案实时读取, PMS 侧只读展示成品信息。
 */

'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package, RefreshCw, Search } from 'lucide-react';

const PRODUCT_PAGE_SIZE = 20;
const PRODUCT_REQUEST_TIMEOUT_MS = 45_000;

interface Product {
  id: string;
  series: string;
  seriesCode?: string;
  model: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  minPrice?: number;
  status: 'active' | 'stopped';
  source?: 'ys';
  sourceUpdatedAt?: string;
  attributes?: Record<string, string>;
}

interface ProductPageInfo {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  recordCount: number;
  pubts?: string;
}

interface MaterialCategory {
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  order?: number;
  level: number;
  isEnabled: boolean;
  orgId?: string;
}

export default function PmsProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [rootCategoryCodes, setRootCategoryCodes] = useState<string[]>(['G']);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string | null>(null);
  const [defaultCategoryCode, setDefaultCategoryCode] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [appliedProductQuery, setAppliedProductQuery] = useState('');
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
  const [showDisabled, setShowDisabled] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [page, setPage] = useState<ProductPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [selectedCategoryCode, includeSubcategories, showDisabled, appliedProductQuery, currentPage]);

  const categoryRows = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const source = categories.filter((category) => showDisabled || category.isEnabled);
    const knownKeys = new Set(source.flatMap((category) => [category.id, category.code].filter(Boolean) as string[]));
    const byParent = new Map<string, MaterialCategory[]>();
    const roots: MaterialCategory[] = [];
    const sortCategories = (items: MaterialCategory[]) => items.sort((a, b) => {
      if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    source.forEach((category) => {
      if (!category.parentId || !knownKeys.has(category.parentId)) {
        roots.push(category);
        return;
      }
      byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
    });

    const rootKeys = new Set(rootCategoryCodes);
    const visibleRoots = rootKeys.size
      ? roots.filter((category) => rootKeys.has(category.code ?? '') || rootKeys.has(category.id))
      : roots;
    const rows: Array<{ category: MaterialCategory; depth: number }> = [];
    const visited = new Set<string>();
    const childrenOf = (category: MaterialCategory) => [
      ...(byParent.get(category.id) ?? []),
      ...(category.code ? byParent.get(category.code) ?? [] : []),
    ];
    const visit = (category: MaterialCategory, depth: number) => {
      if (visited.has(category.id)) return;
      visited.add(category.id);
      const matches = (
        !query ||
        category.name.toLowerCase().includes(query) ||
        (category.code ?? '').toLowerCase().includes(query)
      );
      if (matches) rows.push({ category, depth });
      sortCategories(childrenOf(category)).forEach((child) => visit(child, depth + 1));
    };

    sortCategories(visibleRoots).forEach((category) => {
      sortCategories(childrenOf(category)).forEach((child) => visit(child, 0));
    });
    return rows;
  }, [categories, categorySearch, rootCategoryCodes, showDisabled]);

  const effectiveSelectedCategoryCode = selectedCategoryCode ?? defaultCategoryCode;

  const selectedCategoryCodes = useMemo(() => {
    if (!effectiveSelectedCategoryCode) return [];
    const activeCodes = effectiveSelectedCategoryCode ? [effectiveSelectedCategoryCode] : rootCategoryCodes;
    if (!includeSubcategories) return activeCodes;
    const byParent = new Map<string, MaterialCategory[]>();
    categories
      .filter((category) => showDisabled || category.isEnabled)
      .forEach((category) => {
        if (!category.parentId) return;
        byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
      });
    const codes: string[] = [];
    const visited = new Set<string>();
    const visit = (key: string) => {
      if (visited.has(key)) return;
      visited.add(key);
      const category = categories.find((item) => item.code === key || item.id === key);
      if (!category) {
        codes.push(key);
        return;
      }
      codes.push(category.code ?? category.id);
      [
        ...(byParent.get(category.id) ?? []),
        ...(category.code ? byParent.get(category.code) ?? [] : []),
      ].forEach((child) => visit(child.code ?? child.id));
    };
    activeCodes.forEach(visit);
    return Array.from(new Set(codes));
  }, [categories, effectiveSelectedCategoryCode, includeSubcategories, rootCategoryCodes, showDisabled]);

  const visibleProducts = useMemo(() => (
    showDisabled ? products : products.filter((product) => product.status !== 'stopped')
  ), [products, showDisabled]);

  const totalPages = Math.max(page?.pageCount ?? 1, 1);

  function applyCategory(categoryCode: string) {
    setCurrentPage(1);
    setSelectedCategoryCode(categoryCode);
  }

  async function load() {
    const controller = new AbortController();
    let timer: number | undefined;
    try {
      setLoading(true);
      setError(null);
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          controller.abort();
          reject(new Error('YS 物料档案读取超时，请稍后刷新重试'));
        }, PRODUCT_REQUEST_TIMEOUT_MS);
      });
      const url = new URL('/api/pms/products', window.location.origin);
      url.searchParams.set('type', 'products');
      url.searchParams.set('source', 'ys');
      url.searchParams.set('pageIndex', String(currentPage));
      url.searchParams.set('pageSize', String(PRODUCT_PAGE_SIZE));
      if (appliedProductQuery.trim()) url.searchParams.set('q', appliedProductQuery.trim());
      if (showDisabled) url.searchParams.set('includeStopped', '1');
      if (selectedCategoryCodes.length) {
        if (includeSubcategories && selectedCategoryCodes.length > 1) {
          url.searchParams.set('categoryCodes', selectedCategoryCodes.join(','));
        } else {
          url.searchParams.set('categoryCode', selectedCategoryCodes[0]);
        }
      }
      const res = await Promise.race([
        fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setDefaultCategoryCode(data.selectedCategoryCode || null);
      setRootCategoryCodes(data.rootCategoryCodes?.length ? data.rootCategoryCodes : ['G']);
      setPage(data.page || null);
    } catch (err: any) {
      setError(err.name === 'AbortError' ? 'YS 物料档案读取超时，请稍后刷新重试' : err.message);
    } finally {
      if (timer) window.clearTimeout(timer);
      setLoading(false);
    }
  }

  function handleProductSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = productSearch.trim();
    if (nextQuery === appliedProductQuery) {
      load();
      return;
    }
    setCurrentPage(1);
    setAppliedProductQuery(nextQuery);
  }

  function resetProductSearch() {
    setProductSearch('');
    setCurrentPage(1);
    if (!appliedProductQuery) {
      load();
      return;
    }
    setAppliedProductQuery('');
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col bg-surface-1 md:flex-row">
      <aside className="flex max-h-80 w-full shrink-0 flex-col border-b border-border bg-surface-1 p-4 md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="mb-3">
          <label className="text-caption font-semibold text-ink-secondary">物料分类</label>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
            <Search className="h-4 w-4 text-ink-tertiary" />
            <input
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              placeholder="编码/名称"
              className="min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-ink-tertiary"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {categoryRows.map(({ category, depth }) => (
            <button
              key={category.id}
              type="button"
              onClick={() => applyCategory(category.code ?? category.id)}
              className={`flex w-full items-center justify-between rounded-md py-1.5 pr-3 text-left text-caption transition-colors focus:outline-none ${
                effectiveSelectedCategoryCode === (category.code ?? category.id)
                  ? 'bg-brand-50 font-semibold text-brand-700 shadow-[inset_3px_0_0_rgb(var(--brand-500))]'
                  : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
              }`}
              style={{ paddingLeft: `${12 + depth * 14}px` }}
            >
              <span className="truncate">{category.code ? `${category.code} ${category.name}` : category.name}</span>
              {!category.isEnabled && <span className="ml-2 shrink-0 text-[10px] text-ink-tertiary">停用</span>}
            </button>
          ))}
          {!loading && categoryRows.length === 0 && (
            <div className="px-2 py-6 text-center text-caption text-ink-tertiary">暂无分类</div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-caption text-ink-secondary">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSubcategories}
              onChange={(event) => {
                setCurrentPage(1);
                setIncludeSubcategories(event.target.checked);
              }}
              className="h-4 w-4 rounded border-border"
            />
            包含下级
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(event) => {
                setCurrentPage(1);
                setShowDisabled(event.target.checked);
              }}
              className="h-4 w-4 rounded border-border"
            />
            显示停用
          </label>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-500" />
            产品目录
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-body text-ink-secondary">
            <span>主数据由 YS 物料档案实时读取 · 成品只读展示</span>
            {page && (
              <span className="text-caption text-ink-tertiary">
                共 {page.recordCount} 条 · 第 {page.pageIndex}/{totalPages} 页
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-caption text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <form onSubmit={handleProductSearch} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
                <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="物料名称/编码"
                  className="min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-ink-tertiary"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-brand-600 px-3 text-caption font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                查询
              </button>
              {(productSearch || appliedProductQuery) && (
                <button
                  type="button"
                  onClick={resetProductSearch}
                  disabled={loading}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 px-3 text-caption text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
                >
                  重置
                </button>
              )}
            </form>
          </div>
        </div>

        {error && (
          <Card className="mb-4 border-danger/30">
            <CardContent className="p-4 text-danger">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
          </div>
        ) : visibleProducts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-ink-secondary">暂无 YS 成品物料数据</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {visibleProducts.map((product) => (
              <Card key={product.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-secondary">
                          {product.series}
                        </span>
                        {product.category && <span className="text-caption text-ink-tertiary">{product.category}</span>}
                      </div>
                      <h3 className="text-headline font-semibold text-ink-primary">{product.model}</h3>
                      <p className="mt-1 text-caption text-ink-tertiary">
                        {product.modelCode ? `编码 ${product.modelCode}` : `YS ID ${product.id}`}
                        {product.specification ? ` · ${product.specification}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-caption ${product.status === 'stopped' ? 'bg-surface-2 text-ink-tertiary' : 'bg-success/10 text-success'}`}>
                      {product.status === 'stopped' ? '停用' : '启用'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {product.unit && (
                      <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-secondary">
                        单位 {product.unit}
                      </span>
                    )}
                    {product.attributes?.categoryCode && (
                      <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-secondary">
                        {product.attributes.categoryCode}
                      </span>
                    )}
                    {product.attributes?.brand && (
                      <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-secondary">
                        {product.attributes.brand}
                      </span>
                    )}
                  </div>
                  {product.listPrice != null && (
                    <p className="mt-3 text-headline font-bold text-brand-500">
                      ¥{product.listPrice.toLocaleString('zh-CN')}
                      {product.unit ? <span className="text-caption text-ink-tertiary">/{product.unit}</span> : null}
                    </p>
                  )}
                  {product.sourceUpdatedAt && (
                    <p className="mt-2 text-caption text-ink-tertiary">YS 更新时间 {product.sourceUpdatedAt}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {page && !loading && (
          <div className="mt-5 flex items-center justify-end gap-2 text-caption text-ink-secondary">
            <span>每页 {page.pageSize || PRODUCT_PAGE_SIZE} 条</span>
            <button
              type="button"
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              disabled={loading || currentPage <= 1}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface-1 px-3 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            <span className="min-w-16 text-center">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
              disabled={loading || currentPage >= totalPages}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface-1 px-3 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
