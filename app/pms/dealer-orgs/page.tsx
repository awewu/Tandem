/**
 * PMS · 经销商档案 (只读)
 * 主数据由 YS 客户档案实时读取, PMS 侧只读展示档案与联系信息。
 */

'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Mail, MapPin, Phone, RefreshCw, Search } from 'lucide-react';

interface DealerProfile {
  id: string;
  orgId: string;
  code?: string;
  name?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
  registeredCapital?: number;
  establishedDate?: string;
  coverageRegions?: string[];
  source?: 'ys';
  status?: 'active' | 'stopped';
  customerClassName?: string;
  address?: string;
  legalBody?: string;
  sourceUpdatedAt?: string;
}

interface DealerProfilePageInfo {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  recordCount: number;
  pubts?: string;
}

interface CustomerCategory {
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  order?: number;
  level: number;
  isEnabled: boolean;
  orgId?: string;
}

export default function PmsDealerOrgsPage() {
  const [profiles, setProfiles] = useState<DealerProfile[]>([]);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [appliedProfileQuery, setAppliedProfileQuery] = useState('');
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
  const [showDisabledCategories, setShowDisabledCategories] = useState(false);
  const [page, setPage] = useState<DealerProfilePageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [selectedCategoryCode, includeSubcategories, showDisabledCategories, appliedProfileQuery]);

  const visibleCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const source = categories.filter((category) => showDisabledCategories || category.isEnabled);
    const knownKeys = new Set(source.flatMap((category) => [category.id, category.code].filter(Boolean) as string[]));
    const byParent = new Map<string, CustomerCategory[]>();
    const roots: CustomerCategory[] = [];
    const sortCategories = (items: CustomerCategory[]) => items.sort((a, b) => {
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

    const rows: Array<{ category: CustomerCategory; depth: number }> = [];
    const visited = new Set<string>();
    const visit = (category: CustomerCategory, depth: number) => {
      if (visited.has(category.id)) return;
      visited.add(category.id);
      const matches = (
        !query ||
        category.name.toLowerCase().includes(query) ||
        (category.code ?? '').toLowerCase().includes(query)
      );
      if (matches) rows.push({ category, depth });
      const children = [
        ...(byParent.get(category.id) ?? []),
        ...(category.code ? byParent.get(category.code) ?? [] : []),
      ];
      sortCategories(children).forEach((child) => visit(child, depth + 1));
    };

    sortCategories(roots).forEach((category) => visit(category, Math.max(category.level - 1, 0)));
    return rows;
  }, [categories, categorySearch, showDisabledCategories]);

  const selectedCategoryCodes = useMemo(() => {
    if (!selectedCategoryCode) return [];
    const selected = categories.find((category) => category.code === selectedCategoryCode || category.id === selectedCategoryCode);
    if (!selected) return [selectedCategoryCode];
    const codes: string[] = [];
    const visited = new Set<string>();
    const byParent = new Map<string, CustomerCategory[]>();
    categories
      .filter((category) => showDisabledCategories || category.isEnabled)
      .forEach((category) => {
        if (!category.parentId) return;
        byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
      });
    const visit = (category: CustomerCategory) => {
      if (visited.has(category.id)) return;
      visited.add(category.id);
      codes.push(category.code ?? category.id);
      if (!includeSubcategories) return;
      [
        ...(byParent.get(category.id) ?? []),
        ...(category.code ? byParent.get(category.code) ?? [] : []),
      ].forEach(visit);
    };
    visit(selected);
    return Array.from(new Set(codes));
  }, [categories, includeSubcategories, selectedCategoryCode, showDisabledCategories]);

  const visibleProfiles = useMemo(() => (
    showDisabledCategories ? profiles : profiles.filter((profile) => profile.status !== 'stopped')
  ), [profiles, showDisabledCategories]);

  async function load() {
    const controller = new AbortController();
    let timer: number | undefined;
    try {
      setLoading(true);
      setError(null);
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          controller.abort();
          reject(new Error('YS 客户档案读取超时，请稍后刷新重试'));
        }, 20_000);
      });
      const url = new URL('/api/pms/dealer-orgs', window.location.origin);
      url.searchParams.set('source', 'ys');
      url.searchParams.set('pageIndex', '1');
      url.searchParams.set('pageSize', '50');
      if (appliedProfileQuery.trim()) url.searchParams.set('q', appliedProfileQuery.trim());
      if (showDisabledCategories) url.searchParams.set('includeStopped', '1');
      if (selectedCategoryCode) {
        if (includeSubcategories && selectedCategoryCodes.length > 1) {
          url.searchParams.set('customerClassCodes', selectedCategoryCodes.join(','));
        } else {
          url.searchParams.set('customerClassCode', selectedCategoryCodes[0] ?? selectedCategoryCode);
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
      setProfiles(data.profiles || []);
      setCategories(data.categories || []);
      setPage(data.page || null);
    } catch (err: any) {
      setError(err.name === 'AbortError' ? 'YS 客户档案读取超时，请稍后刷新重试' : err.message);
    } finally {
      if (timer) window.clearTimeout(timer);
      setLoading(false);
    }
  }

  function handleProfileSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = profileSearch.trim();
    if (nextQuery === appliedProfileQuery) {
      load();
      return;
    }
    setAppliedProfileQuery(nextQuery);
  }

  function resetProfileSearch() {
    setProfileSearch('');
    if (!appliedProfileQuery) {
      load();
      return;
    }
    setAppliedProfileQuery('');
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col bg-surface-1 md:flex-row">
      <aside className="flex max-h-80 w-full shrink-0 flex-col border-b border-border bg-surface-1 p-4 md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="mb-3">
          <label className="text-caption font-semibold text-ink-secondary">客户分类</label>
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
          <button
            type="button"
            onClick={() => setSelectedCategoryCode(null)}
            className={`flex w-full items-center border-l-2 px-2 py-2 text-left text-caption transition-colors ${
              selectedCategoryCode === null
                ? 'border-brand-500 bg-surface-2 font-semibold text-ink-primary'
                : 'border-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
            }`}
          >
            全部
          </button>
          {visibleCategories.map(({ category, depth }) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategoryCode(category.code ?? category.id)}
              className={`flex w-full items-center justify-between border-l-2 py-1.5 pr-2 text-left text-caption transition-colors ${
                selectedCategoryCode === (category.code ?? category.id)
                  ? 'border-brand-500 bg-surface-2 font-semibold text-ink-primary'
                : 'border-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
              }`}
              style={{ paddingLeft: `${10 + depth * 16}px` }}
            >
              <span className="truncate">{category.code ? `${category.code} ${category.name}` : category.name}</span>
              {!category.isEnabled && <span className="ml-2 shrink-0 text-[10px] text-ink-tertiary">停用</span>}
            </button>
          ))}
          {!loading && visibleCategories.length === 0 && (
            <div className="px-2 py-6 text-center text-caption text-ink-tertiary">暂无分类</div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-caption text-ink-secondary">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSubcategories}
              onChange={(event) => setIncludeSubcategories(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            包含下级
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDisabledCategories}
              onChange={(event) => setShowDisabledCategories(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            显示停用
          </label>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-500" />
            经销商档案
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-body text-ink-secondary">
            <span>主数据由 YS 客户档案实时读取 · 只读展示</span>
            {page && (
              <span className="text-caption text-ink-tertiary">
                共 {page.recordCount} 条 · 第 {page.pageIndex}/{Math.max(page.pageCount, 1)} 页
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
            <form onSubmit={handleProfileSearch} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
                <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
                <input
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  placeholder="客户名称/编码"
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
              {(profileSearch || appliedProfileQuery) && (
                <button
                  type="button"
                  onClick={resetProfileSearch}
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
        ) : visibleProfiles.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-ink-secondary">暂无 YS 客户档案数据</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {visibleProfiles.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-headline font-semibold text-ink-primary">{p.name || p.orgId}</h3>
                      <p className="mt-1 text-caption text-ink-tertiary">
                        {p.code ? `编码 ${p.code}` : `YS ID ${p.orgId}`}
                        {p.customerClassName ? ` · ${p.customerClassName}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-caption ${p.status === 'stopped' ? 'bg-surface-2 text-ink-tertiary' : 'bg-success/10 text-success'}`}>
                      {p.status === 'stopped' ? '停用' : '启用'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    {p.contactName && <span className="text-body text-ink-secondary">{p.contactName}</span>}
                    {p.contactPhone && (
                      <span className="inline-flex items-center gap-1 text-caption text-ink-tertiary">
                        <Phone className="w-3 h-3" />
                        {p.contactPhone}
                      </span>
                    )}
                    {p.contactEmail && (
                      <span className="inline-flex items-center gap-1 text-caption text-ink-tertiary">
                        <Mail className="w-3 h-3" />
                        {p.contactEmail}
                      </span>
                    )}
                  </div>
                  {p.address && (
                    <p className="mt-3 inline-flex items-center gap-1 text-caption text-ink-tertiary">
                      <MapPin className="h-3 w-3" />
                      {p.address}
                    </p>
                  )}
                  {p.coverageRegions && p.coverageRegions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {p.coverageRegions.map((r) => (
                        <span key={r} className="inline-flex px-2 py-0.5 rounded-full text-caption bg-surface-2 text-ink-secondary">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  {(p.businessLicense || p.establishedDate) && (
                    <p className="text-caption text-ink-tertiary mt-2">
                      {p.businessLicense ? `执照 ${p.businessLicense}` : ''}
                      {p.establishedDate ? ` · 成立 ${p.establishedDate}` : ''}
                      {p.legalBody ? ` · 法人 ${p.legalBody}` : ''}
                    </p>
                  )}
                  {p.sourceUpdatedAt && (
                    <p className="mt-2 text-caption text-ink-tertiary">YS 更新时间 {p.sourceUpdatedAt}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
