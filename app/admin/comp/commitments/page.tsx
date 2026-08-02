'use client';

/**
 * /admin/comp/commitments — 任务承诺档位管理
 *
 * 提交任务档位变更申请 (A-G) → 审批/驳回。
 * 审批通过自动更新员工 taskGear。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, TrendingUp, Plus, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommitmentRow {
  id: string;
  employeeId: string;
  familyId: string;
  cycle: string;
  commitmentType: string;
  fromGear: string | null;
  toGear: string;
  taskWageDelta: number;
  reason: string | null;
  status: string;
  proposedBy: string | null;
  approvedBy: string | null;
}

const STATUS_CLS: Record<string, string> = {
  proposed: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-success/10 text-success border-success/30',
  rejected: 'bg-danger/10 text-danger border-danger/30',
};

const GEARS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export default function CompCommitmentsPage() {
  const [rows, setRows] = useState<CommitmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // 表单
  const [employeeId, setEmployeeId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [cycle, setCycle] = useState('');
  const [commitmentType, setCommitmentType] = useState('annual');
  const [fromGear, setFromGear] = useState('D');
  const [toGear, setToGear] = useState('C');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/admin/commitments', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(j.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!employeeId || !familyId || !cycle) { setError('员工ID、岗族ID、周期必填'); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/comp/admin/commitments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId, familyId, cycle, commitmentType,
          fromGear, toGear, reason: reason || undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setShowForm(false);
      setEmployeeId(''); setFamilyId(''); setCycle(''); setReason('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    try {
      const r = await fetch('/api/comp/admin/commitments', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentId: id, action: 'approve' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reject(id: string) {
    try {
      const r = await fetch('/api/comp/admin/commitments', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentId: id, action: 'reject' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-[12px]';

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          任务承诺档位
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          员工承接任务档 A-G 升降留痕 · 审批通过自动更新 taskGear · 工资增量自动计算
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}

      {showForm ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-caption">提交承诺申请</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                员工ID
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-8 w-40 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                岗族ID
                <Input value={familyId} onChange={(e) => setFamilyId(e.target.value)} className="h-8 w-40 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                周期
                <Input value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="2026" className="h-8 w-24 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                承诺类型
                <select className={selCls} value={commitmentType} onChange={(e) => setCommitmentType(e.target.value)}>
                  <option value="annual">年度</option>
                  <option value="half_year">半年</option>
                  <option value="quarterly">季度</option>
                  <option value="special">专项</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                原档位
                <select className={selCls} value={fromGear} onChange={(e) => setFromGear(e.target.value)}>
                  {GEARS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                目标档位
                <select className={selCls} value={toGear} onChange={(e) => setToGear(e.target.value)}>
                  {GEARS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              变更理由
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如: 承接重大项目, 升档至B" className="h-8 w-full text-[12px]" />
            </label>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-[12px] gap-1" disabled={saving} onClick={submit}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />} 提交申请
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" className="h-8 text-[12px] gap-1" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> 提交申请
        </Button>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">承诺记录 ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">暂无承诺记录</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">员工</th>
                  <th className="text-left font-medium py-1.5">周期</th>
                  <th className="text-center font-medium py-1.5">类型</th>
                  <th className="text-center font-medium py-1.5">原档</th>
                  <th className="text-center font-medium py-1.5">目标档</th>
                  <th className="text-right font-medium py-1.5">工资增量</th>
                  <th className="text-left font-medium py-1.5">理由</th>
                  <th className="text-center font-medium py-1.5">状态</th>
                  <th className="text-center font-medium py-1.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1.5">{r.employeeId}</td>
                    <td className="py-1.5">{r.cycle}</td>
                    <td className="text-center py-1.5">{r.commitmentType}</td>
                    <td className="text-center py-1.5">{r.fromGear ?? '—'}</td>
                    <td className="text-center py-1.5 font-medium text-primary">{r.toGear}</td>
                    <td className={cn('text-right py-1.5 tabular-nums', r.taskWageDelta > 0 ? 'text-success' : r.taskWageDelta < 0 ? 'text-danger' : 'text-muted-foreground')}>
                      {r.taskWageDelta > 0 ? '+' : ''}{r.taskWageDelta.toLocaleString()}
                    </td>
                    <td className="py-1.5 max-w-[200px] truncate text-muted-foreground">{r.reason ?? '—'}</td>
                    <td className="text-center py-1.5">
                      <Badge variant="outline" className={cn('text-[9px] scale-90', STATUS_CLS[r.status] ?? '')}>{r.status}</Badge>
                    </td>
                    <td className="text-center py-1.5">
                      {r.status === 'proposed' && (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-success" onClick={() => approve(r.id)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-danger" onClick={() => reject(r.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
