'use client';

/**
 * /admin/comp/settlements — HR 月度结算管理台
 *
 * 1. 输入周期 (YYYY-MM) → 查询已生成结算行
 * 2. 批量生成 (POST /api/comp/admin/settle) — 可选考勤/绩效系数/安全否决
 * 3. 状态流转: draft → reviewed → paid (PATCH)
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Calculator, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface SettlementRow {
  id: string;
  employeeId: string;
  period: string;
  baseWage: number;
  skillWage: number;
  taskWage: number;
  performance: number;
  attendance: string;
  coefficient: string;
  status: string;
  gateFlags: Record<string, unknown>;
  basisSnapshot: Record<string, unknown>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '待审',
  reviewed: '已审',
  paid: '已发',
};

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-warning/10 text-warning border-warning/30',
  reviewed: 'bg-info/10 text-info border-info/30',
  paid: 'bg-success/10 text-success border-success/30',
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CompSettlementsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<string | null>(null);

  // 生成参数
  const [attendance, setAttendance] = useState('1');
  const [coefficient, setCoefficient] = useState('1');
  const [safetyVeto, setSafetyVeto] = useState(false);
  const [autoCoefficient, setAutoCoefficient] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/comp/admin/settle?period=${encodeURIComponent(period)}`, {
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/comp/admin/assignments', { credentials: 'include', cache: 'no-store' });
        const j = await r.json();
        const m: Record<string, string> = {};
        for (const g of j.grades ?? []) m[g.employeeId] = g.name;
        for (const e of j.employees ?? []) if (!m[e.id]) m[e.id] = e.name;
        setNameMap(m);
      } catch { /* noop */ }
    })();
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    setGenResult(null);
    try {
      const r = await fetch('/api/comp/admin/settle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          attendance: Number(attendance) || 1,
          coefficient: autoCoefficient ? undefined : Number(coefficient) || 1,
          autoCoefficient,
          gateFlags: safetyVeto ? { safety_veto: true } : {},
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      const res = j.result;
      setGenResult(`生成 ${res.generated} 行 · 跳过 ${res.skipped} 行 (已存在)`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(id: string, status: 'draft' | 'reviewed' | 'paid') {
    try {
      const r = await fetch('/api/comp/admin/settle', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId: id, status }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // --- 发放确认弹窗 ---
  const [payTarget, setPayTarget] = useState<{ id: string; name: string; total: number } | null>(null);

  function confirmPay() {
    if (!payTarget) return;
    void updateStatus(payTarget.id, 'paid');
    setPayTarget(null);
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.base += r.baseWage;
      acc.skill += r.skillWage;
      acc.task += r.taskWage;
      acc.perf += r.performance;
      acc.total += r.baseWage + r.skillWage + r.taskWage + r.performance;
      return acc;
    },
    { base: 0, skill: 0, task: 0, perf: 0, total: 0 },
  );

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          月度结算
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          批量生成 comp_monthly_settlement · 三段合成 + 考勤系数 + 绩效系数(上界1.3) · 安全一票否决
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
          绩效系数可从 KPI 达成率自动派生 (勾选「KPI 自动派生系数」) · 系数封顶 1.3 确保超额有界 · 安全一票否决不可绕过
        </p>
      </header>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-2 text-caption text-danger">{error}</CardContent>
        </Card>
      )}
      {genResult && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="py-2 text-caption text-success">{genResult}</CardContent>
        </Card>
      )}

      {/* 生成控制 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption">生成结算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              周期 (YYYY-MM)
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-07"
                className="h-8 w-28 text-[12px] tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              考勤系数
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={attendance}
                onChange={(e) => setAttendance(e.target.value)}
                className="h-8 w-20 text-[12px] tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              绩效系数 (≤1.3)
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1.3"
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
                disabled={autoCoefficient}
                className="h-8 w-20 text-[12px] tabular-nums"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoCoefficient}
                onChange={(e) => setAutoCoefficient(e.target.checked)}
                className="rounded border-border"
              />
              KPI 自动派生系数
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={safetyVeto}
                onChange={(e) => setSafetyVeto(e.target.checked)}
                className="rounded border-border"
              />
              <AlertTriangle className="w-3 h-3 text-danger" />
              安全一票否决 (绩效归零)
            </label>
            <Button size="sm" className="h-8 text-[12px] gap-1" disabled={generating || !period} onClick={generate}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calculator className="h-3 w-3" />}
              生成结算
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={load} disabled={loading}>
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结算列表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center justify-between">
            <span>结算明细 ({rows.length})</span>
            {rows.length > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                合计 {totals.total.toLocaleString()} 元
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-caption py-10">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-caption py-10">
              {period} 无结算记录，点击「生成结算」
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium py-1.5 pr-2 min-w-[100px]">员工</th>
                    <th className="text-right font-medium py-1.5 px-2 w-20">基本</th>
                    <th className="text-right font-medium py-1.5 px-2 w-20">技能</th>
                    <th className="text-right font-medium py-1.5 px-2 w-20">任务</th>
                    <th className="text-right font-medium py-1.5 px-2 w-20">绩效</th>
                    <th className="text-right font-medium py-1.5 px-2 w-24">应发合计</th>
                    <th className="text-center font-medium py-1.5 px-1 w-16">考勤</th>
                    <th className="text-center font-medium py-1.5 px-1 w-16">系数</th>
                    <th className="text-center font-medium py-1.5 px-2 w-20">状态</th>
                    <th className="text-center font-medium py-1.5 px-2 w-28">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const total = r.baseWage + r.skillWage + r.taskWage + r.performance;
                    const vetoed = !!(r.gateFlags as Record<string, unknown>).safety_veto;
                    return (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-surface-1/50">
                        <td className="py-1 pr-2 text-ink-primary truncate max-w-[120px]" title={r.employeeId}>
                          {nameMap[r.employeeId] ?? r.employeeId}
                          {vetoed && <AlertTriangle className="w-3 h-3 text-danger inline ml-1" />}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums">{r.baseWage.toLocaleString()}</td>
                        <td className="text-right py-1 px-2 tabular-nums">{r.skillWage.toLocaleString()}</td>
                        <td className="text-right py-1 px-2 tabular-nums">{r.taskWage.toLocaleString()}</td>
                        <td className="text-right py-1 px-2 tabular-nums">
                          {r.performance === 0 && vetoed ? (
                            <span className="text-danger">否决</span>
                          ) : r.performance > 0 ? (
                            `+${r.performance.toLocaleString()}`
                          ) : '—'}
                        </td>
                        <td className="text-right py-1 px-2 tabular-nums font-medium text-ink-primary">
                          {total.toLocaleString()}
                        </td>
                        <td className="text-center py-1 px-1 tabular-nums text-muted-foreground">
                          {Number(r.attendance).toFixed(2)}
                        </td>
                        <td className="text-center py-1 px-1 tabular-nums text-muted-foreground">
                          {Number(r.coefficient).toFixed(2)}
                        </td>
                        <td className="text-center py-1 px-2">
                          <Badge variant="outline" className={cn('text-[9px] scale-90', STATUS_CLS[r.status] ?? '')}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </td>
                        <td className="text-center py-1 px-2">
                          {r.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => updateStatus(r.id, 'reviewed')}
                            >
                              审核
                            </Button>
                          )}
                          {r.status === 'reviewed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => {
                                const total = r.baseWage + r.skillWage + r.taskWage + r.performance;
                                setPayTarget({ id: r.id, name: nameMap[r.employeeId] ?? r.employeeId, total });
                              }}
                            >
                              <Check className="w-3 h-3 mr-0.5" /> 发放
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold text-primary bg-primary/5">
                      <td className="py-1.5 pr-2">合计</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{totals.base.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{totals.skill.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{totals.task.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{totals.perf.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{totals.total.toLocaleString()}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 发放确认弹窗 */}
      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              确认发放
            </DialogTitle>
            <DialogDescription>
              确认向 <span className="font-medium text-ink-primary">{payTarget?.name}</span> 发放结算
              <span className="font-medium text-success tabular-nums"> {payTarget?.total.toLocaleString()} </span>元？
              此操作不可逆。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPayTarget(null)}>取消</Button>
            <Button size="sm" className="gap-1" onClick={confirmPay}>
              <Check className="h-3 w-3" /> 确认发放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
