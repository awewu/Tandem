'use client';

/**
 * 目标修订签批流 · KPI 详情 Drawer 内嵌面板
 *
 * targetsLockedAt 后 targetValue 锁死, 唯一合法变更通道: 提交修订申请 → owner/admin 审批。
 * 见 app/api/kpi/target-amendments/route.ts + [id]/route.ts。
 */

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { FileEdit, Check, X as XIcon, Clock } from 'lucide-react';
import type { KpiTargetAmendment } from '@/lib/types/kpi';

interface Props {
  kpiId: string;
  currentTargetValue: number;
  unit?: string;
  /** 周期已锁定 (draft 状态下应直接走 PATCH /api/kpi/[id], 不需要走签批流) */
  cycleLocked: boolean;
  canRequest: boolean;
  canApprove: boolean;
  onApplied?: () => void;
}

export function TargetAmendmentPanel({ kpiId, currentTargetValue, unit, cycleLocked, canRequest, canApprove, onApplied }: Props) {
  const [amendments, setAmendments] = useState<KpiTargetAmendment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toValue, setToValue] = useState('');
  const [reason, setReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kpi/target-amendments?kpiId=${kpiId}`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAmendments(data.amendments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => { load(); }, [load]);

  if (!cycleLocked) return null;

  const pending = amendments.find((a) => a.status === 'pending');

  const submit = async () => {
    setError(null);
    const v = Number(toValue);
    if (!toValue || Number.isNaN(v)) { setError('请输入有效的目标值'); return; }
    if (!reason.trim()) { setError('请填写修订理由'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/kpi/target-amendments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpiId, toTargetValue: v, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '提交失败'); return; }
      setShowForm(false);
      setToValue('');
      setReason('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const review = async (decision: 'approve' | 'reject') => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kpi/target-amendments/${pending.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNote: reviewNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '审批失败'); return; }
      setReviewNote('');
      await load();
      onApplied?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-2/50 rounded-lg p-4 border border-border space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-footnote font-bold text-ink-primary flex items-center gap-1.5">
          <FileEdit className="h-3.5 w-3.5" /> 目标修订签批
        </h4>
        {!pending && canRequest && !showForm && (
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setShowForm(true)}>
            申请修订
          </Button>
        )}
      </div>

      {loading && <p className="text-[10px] text-muted-foreground">加载中…</p>}

      {!pending && !showForm && !loading && (
        <p className="text-[10px] text-muted-foreground">
          目标已锁定 (当前 {currentTargetValue} {unit ?? ''})。如需修订, 提交申请并经 CEO(owner/admin) 审批后方可生效。
        </p>
      )}

      {showForm && (
        <div className="space-y-2 pt-1">
          <Input
            type="number"
            placeholder={`新目标值 (当前 ${currentTargetValue} ${unit ?? ''})`}
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
            className="h-8 text-footnote"
          />
          <Textarea
            placeholder="修订理由 (必填, 将进入审批记录)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="text-footnote min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-[10px]" disabled={busy} onClick={submit}>提交申请</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      )}

      {pending && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-warning">
            <Clock className="h-3 w-3" /> 待审批: {pending.fromTargetValue} → {pending.toTargetValue} {unit ?? ''}
          </div>
          <p className="text-[10px] text-ink-tertiary">理由: {pending.reason}</p>
          {canApprove && (
            <div className="space-y-2">
              <Textarea
                placeholder="审批备注 (可选)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="text-footnote min-h-[44px]"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-[10px] bg-success hover:bg-success/90" disabled={busy} onClick={() => review('approve')}>
                  <Check className="h-3 w-3 mr-1" /> 批准
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-[10px]" disabled={busy} onClick={() => review('reject')}>
                  <XIcon className="h-3 w-3 mr-1" /> 驳回
                </Button>
              </div>
            </div>
          )}
          {!canApprove && <p className="text-[10px] text-muted-foreground">等待 owner/admin 审批。</p>}
        </div>
      )}

      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  );
}
