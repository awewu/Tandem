/**
 * PMS · 经销商档案 (只读)
 * 主数据由 ERP 接口同步导入, PMS 侧只读展示档案与联系信息。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Phone, Mail } from 'lucide-react';

interface DealerProfile {
  id: string;
  orgId: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
  registeredCapital?: number;
  establishedDate?: string;
  coverageRegions?: string[];
}

export default function PmsDealerOrgsPage() {
  const [profiles, setProfiles] = useState<DealerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/dealer-orgs', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
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
        <p className="text-body text-ink-secondary mt-1">主数据由 ERP 同步 · 资质与覆盖区域</p>
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
          <CardContent className="p-12 text-center text-ink-secondary">暂无经销商档案 (待 ERP 同步)</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <h3 className="text-headline font-semibold text-ink-primary">{p.orgId}</h3>
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
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
