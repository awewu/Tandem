'use client';

/**
 * /admin/comp/budget-pools — 部门预算池管理
 *
 * 按周期查看/创建/删除部门预算池 (LIP/MIP/SIP)。
 * 状态流转: draft → active → frozen/closed。
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Wallet, Plus, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PoolRow {
  id: string;
  departmentId: string;
  period: string;
  poolType: string;
  baseAmount: number;
  hardCliff: boolean;
  budgetCeiling: number | null;
  qualityCoefficient: number;
  attendanceBasis: string | null;
  status: string;
}

const POOL_TYPE_LABEL: Record<string, string> = { lip: 'LIP', mip: 'MIP', sip: 'SIP' };
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-warning/10 text-warning border-warning/30',
  active: 'bg-success/10 text-success border-success/30',
  frozen: 'bg-info/10 text-info border-info/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CompBudgetPoolsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // 新建表单
  const [dept, setDept] = useState('');
  const [poolType, setPoolType] = useState('lip');
  const [baseAmount, setBaseAmount] = useState('');
  const [ceiling, setCeiling] = useState('');
  const [hardCliff, setHardCliff] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/comp/admin/budget-pools?period=${encodeURIComponent(period)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRows(j.rows ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!dept || !baseAmount) { setError('部门和基数必填'); return; }
    setSaving(true); setError(null); setMsg(null);
    try {
      const r = await fetch('/api/comp/admin/budget-pools', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: dept,
          period,
          poolType,
          baseAmount: Number(baseAmount),
          hardCliff,
          budgetCeiling: ceiling ? Number(ceiling) : null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setMsg('预算池已保存');
      setDept(''); setBaseAmount(''); setCeiling('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: 'draft' | 'active' | 'frozen' | 'closed') {
    try {
      const r = await fetch('/api/comp/admin/budget-pools', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: id, status }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      const r = await fetch('/api/comp/admin/budget-pools', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const selCls = 'h-8 rounded-md border border-border bg-background px-2 text-[12px]';

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          预算池管理
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          部门 × 周期 × 池类型 (LIP/MIP/SIP) · 硬上限管控 · 状态流转
        </p>
      </header>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}
      {msg && <Card className="border-success/30 bg-success/5"><CardContent className="py-2 text-caption text-success">{msg}</CardContent></Card>}

      {/* 创建表单 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">新建 / 更新预算池</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              周期
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 w-28 text-[12px] tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              部门ID
              <Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="如: sales" className="h-8 w-32 text-[12px]" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              池类型
              <select className={selCls} value={poolType} onChange={(e) => setPoolType(e.target.value)}>
                <option value="lip">LIP</option>
                <option value="mip">MIP</option>
                <option value="sip">SIP</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              基数 (元)
              <Input type="number" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} placeholder="如: 500000" className="h-8 w-32 text-[12px] tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              上限 (可选)
              <Input type="number" value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="如: 600000" className="h-8 w-28 text-[12px] tabular-nums" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={hardCliff} onChange={(e) => setHardCliff(e.target.checked)} className="rounded border-border" />
              硬上限
            </label>
            <Button size="sm" className="h-8 text-[12px] gap-1" disabled={saving} onClick={create}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} 保存
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={load} disabled={loading}>刷新</Button>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-caption">预算池 ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">{period} 无预算池</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-1.5">部门</th>
                  <th className="text-center font-medium py-1.5">池类型</th>
                  <th className="text-right font-medium py-1.5">基数</th>
                  <th className="text-right font-medium py-1.5">上限</th>
                  <th className="text-center font-medium py-1.5">硬限</th>
                  <th className="text-center font-medium py-1.5">状态</th>
                  <th className="text-center font-medium py-1.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1.5">{r.departmentId}</td>
                    <td className="text-center py-1.5"><Badge variant="outline" className="text-[9px] scale-90">{POOL_TYPE_LABEL[r.poolType] ?? r.poolType}</Badge></td>
                    <td className="text-right py-1.5 tabular-nums">{r.baseAmount.toLocaleString()}</td>
                    <td className="text-right py-1.5 tabular-nums text-muted-foreground">{r.budgetCeiling ? r.budgetCeiling.toLocaleString() : '—'}</td>
                    <td className="text-center py-1.5">{r.hardCliff ? <Check className="w-3 h-3 text-success inline" /> : '—'}</td>
                    <td className="text-center py-1.5">
                      <Badge variant="outline" className={cn('text-[9px] scale-90', STATUS_CLS[r.status] ?? '')}>{r.status}</Badge>
                    </td>
                    <td className="text-center py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        {r.status === 'draft' && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateStatus(r.id, 'active')}>激活</Button>
                        )}
                        {r.status === 'active' && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateStatus(r.id, 'frozen')}>冻结</Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] text-danger" onClick={() => remove(r.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
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
