/**
 * PMS · 经销商档案 (只读)
 * 主数据由 YS 供应商档案实时读取, PMS 侧只读展示档案与联系信息。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Mail, MapPin, Phone, RefreshCw } from 'lucide-react';

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
  vendorClassName?: string;
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

export default function PmsDealerOrgsPage() {
  const [profiles, setProfiles] = useState<DealerProfile[]>([]);
  const [page, setPage] = useState<DealerProfilePageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const controller = new AbortController();
    let timer: number | undefined;
    try {
      setLoading(true);
      setError(null);
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
          controller.abort();
          reject(new Error('YS 供应商档案读取超时，请稍后刷新重试'));
        }, 20_000);
      });
      const res = await Promise.race([
        fetch('/api/pms/dealer-orgs?source=ys&pageIndex=1&pageSize=50', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setProfiles(data.profiles || []);
      setPage(data.page || null);
    } catch (err: any) {
      setError(err.name === 'AbortError' ? 'YS 供应商档案读取超时，请稍后刷新重试' : err.message);
    } finally {
      if (timer) window.clearTimeout(timer);
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <Building2 className="w-6 h-6 text-brand-500" />
          经销商档案
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-body text-ink-secondary">
          <span>主数据由 YS 供应商档案实时读取 · 只读展示</span>
          {page && (
            <span className="text-caption text-ink-tertiary">
              共 {page.recordCount} 条 · 第 {page.pageIndex}/{Math.max(page.pageCount, 1)} 页
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 text-caption text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
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
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无 YS 供应商档案数据</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-headline font-semibold text-ink-primary">{p.name || p.orgId}</h3>
                    <p className="mt-1 text-caption text-ink-tertiary">
                      {p.code ? `编码 ${p.code}` : `YS ID ${p.orgId}`}
                      {p.vendorClassName ? ` · ${p.vendorClassName}` : ''}
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
    </div>
  );
}
