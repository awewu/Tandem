/**
 * PMS · 返利管理
 * 返利政策 (费率卡) + 返利计提。写操作仅内部 (渠道财务)。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins } from 'lucide-react';

interface Policy {
  id: string;
  name: string;
  productLine?: string;
  effectiveDate: string;
  expiryDate?: string;
  status: string;
}

interface Accrual {
  id: string;
  dealerOrgId: string;
  policyId: string;
  period: string;
  salesAmount: number;
  rebateAmount: number;
  status: string;
}

export default function PmsRebatesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [accruals, setAccruals] = useState<Accrual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [pRes, aRes] = await Promise.all([
        fetch('/api/pms/rebates?type=policies', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/pms/rebates?type=accruals', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (!pRes.ok) throw new Error((await pRes.json()).error || '加载政策失败');
      setPolicies((await pRes.json()).policies || []);
      // 计提对外部需 dealerOrgId, 失败时静默 (内部可看全量)
      if (aRes.ok) setAccruals((await aRes.json()).accruals || []);
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
          <Coins className="w-6 h-6 text-brand-500" />
          返利管理
        </h1>
        <p className="text-body text-ink-secondary mt-1">阶梯费率政策 · 计提结算</p>
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
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-headline">返利政策</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {policies.length === 0 ? (
                <p className="text-ink-tertiary text-caption">暂无政策</p>
              ) : (
                policies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-body font-medium text-ink-primary">{p.name}</p>
                      <p className="text-caption text-ink-tertiary">
                        {p.productLine || '全线'} · {p.effectiveDate}
                        {p.expiryDate ? ` ~ ${p.expiryDate}` : ''}
                      </p>
                    </div>
                    <span className="text-caption text-ink-secondary">{p.status}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-headline">返利计提</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {accruals.length === 0 ? (
                <p className="text-ink-tertiary text-caption">暂无计提记录</p>
              ) : (
                accruals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-body font-medium text-ink-primary">{a.dealerOrgId}</p>
                      <p className="text-caption text-ink-tertiary">
                        {a.period} · 销售额 ¥{a.salesAmount?.toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-body font-bold text-brand-500">¥{a.rebateAmount?.toLocaleString('zh-CN')}</p>
                      <p className="text-caption text-ink-tertiary">{a.status}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
