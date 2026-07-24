/**
 * PMS · 合同管理
 * 列出合同, 支持审批生效 (自动生成交付工单) / 驳回。仅内部可审批。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';

interface Contract {
  id: string;
  opportunityId: string;
  contractNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  effectiveDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  draft: { badge: 'bg-surface-2 text-ink-secondary', label: '草稿' },
  pending: { badge: 'bg-warning/10 text-warning', label: '待审批' },
  approved: { badge: 'bg-success/10 text-success', label: '已生效' },
  rejected: { badge: 'bg-danger/10 text-danger', label: '已驳回' },
};

export default function PmsContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/contracts', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function decide(contractId: string, action: 'approve' | 'reject') {
    try {
      setActing(contractId + action);
      setError(null);
      const res = await fetch('/api/pms/contracts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, contractId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '操作失败');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-500" />
          合同管理
        </h1>
        <p className="text-body text-ink-secondary mt-1">签约 · 审批生效 · 自动生成交付工单</p>
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
      ) : contracts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无合同</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {contracts.map((c) => {
            const s = STATUS_STYLE[c.status] || STATUS_STYLE.draft;
            const canDecide = c.status === 'draft' || c.status === 'pending';
            return (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-caption ${s.badge}`}>{s.label}</span>
                      <span className="text-caption text-ink-tertiary font-mono">{c.contractNumber}</span>
                    </div>
                    <h3 className="text-headline font-semibold text-ink-primary">{c.customerName}</h3>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {c.effectiveDate ? `生效 ${c.effectiveDate} · ` : ''}
                      创建 {new Date(c.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-headline font-bold text-brand-500 mb-2">
                      ¥{c.totalAmount?.toLocaleString('zh-CN')}
                    </p>
                    {canDecide && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-2xl text-danger border-danger/30"
                          disabled={acting === c.id + 'reject'}
                          onClick={() => decide(c.id, 'reject')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          驳回
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-2xl bg-brand-500 hover:bg-brand-600"
                          disabled={acting === c.id + 'approve'}
                          onClick={() => decide(c.id, 'approve')}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {acting === c.id + 'approve' ? '生效中...' : '审批生效'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
