'use client';

/**
 * /admin/kpi/bonus-payout · 绩效奖金计算与下发工作台
 *
 * CHARTER-KPI-TTI §5 M3
 *
 * 流程:
 *   1. HR 选周期 (status=active 或 closed)
 *   2. 系统列出所有 bonus scope KPI 的 assignee
 *   3. HR 输入每人 baseBonus (可批量复制)
 *   4. "试算" 按钮 → POST 不带 commit=true, 返回预估
 *   5. 复核 → "正式下发" 按钮 → POST commit=true, 落库 + audit
 *   6. 全员下发完成后, "年终关闭" 按钮可用 → POST /close
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calculator,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Send,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { TrustBanner } from '@/components/trust-banner';
import type { KpiBonusPayout, KpiCycle } from '@/lib/types/kpi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Kpi {
  id: string;
  cycleId: string;
  subjectId: string;
  scope: 'bonus' | 'monitor';
  assigneeId: string;
  title: string;
  weight: number;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KpiBonusPayoutPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [payouts, setPayouts] = useState<KpiBonusPayout[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 每人的 baseBonus 输入 */
  const [baseBonuses, setBaseBonuses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [userMap, setUserMap] = useState<Record<string, { name?: string; email?: string }>>({});

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const loadCycles = useCallback(async () => {
    const r = await fetch('/api/kpi/cycles', { cache: 'no-store' });
    if (!r.ok) throw new Error(`cycles HTTP ${r.status}`);
    const j = await r.json();
    const list = (j.cycles ?? []) as KpiCycle[];
    setCycles(list);
    if (!activeCycleId && list.length > 0) {
      const sorted = [...list].sort((a, b) => b.fiscalYear - a.fiscalYear);
      const pref = sorted.find((c) => c.status === 'active') ?? sorted[0];
      setActiveCycleId(pref.id);
    }
  }, [activeCycleId]);

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/org/users', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const m: Record<string, { name?: string; email?: string }> = {};
      for (const u of (j.users ?? []) as { id: string; name?: string; email?: string }[]) {
        m[u.id] = { name: u.name, email: u.email };
      }
      setUserMap(m);
    } catch {
      /* noop */
    }
  }, []);

  const loadCycleData = useCallback(async () => {
    if (!activeCycleId) {
      setKpis([]);
      setPayouts([]);
      return;
    }
    const [rk, rp] = await Promise.all([
      fetch(`/api/kpi?cycleId=${activeCycleId}&scope=bonus`, { cache: 'no-store' }),
      fetch(`/api/kpi/cycles/${activeCycleId}/bonus`, { cache: 'no-store' }),
    ]);
    if (!rk.ok || !rp.ok) throw new Error('load failed');
    const [jk, jp] = await Promise.all([rk.json(), rp.json()]);
    setKpis(jk.kpis ?? []);
    setPayouts(jp.payouts ?? []);
    // 把已有 payouts 的 baseBonus 回填到表单
    const filled: Record<string, string> = {};
    for (const p of jp.payouts ?? []) {
      filled[p.assigneeId] = String(p.baseBonus);
    }
    setBaseBonuses((prev) => ({ ...filled, ...prev }));
  }, [activeCycleId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCycles(), loadUsers()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadCycles, loadUsers]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCycleData().catch((e) => setError((e as Error).message));
  }, [loadCycleData]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeCycle = useMemo(
    () => cycles.find((c) => c.id === activeCycleId) ?? null,
    [cycles, activeCycleId],
  );

  const kpisByAssignee = useMemo(() => {
    const m = new Map<string, Kpi[]>();
    for (const k of kpis) {
      const arr = m.get(k.assigneeId) ?? [];
      arr.push(k);
      m.set(k.assigneeId, arr);
    }
    return m;
  }, [kpis]);

  const payoutByAssignee = useMemo(() => {
    const m = new Map<string, KpiBonusPayout>();
    for (const p of payouts) m.set(p.assigneeId, p);
    return m;
  }, [payouts]);

  const assignees = useMemo(() => {
    return Array.from(kpisByAssignee.keys()).sort();
  }, [kpisByAssignee]);

  const summary = useMemo(() => {
    const total = payouts.length;
    const committed = payouts.filter((p) => p.committed).length;
    const totalFinalBonus = payouts.reduce((s, p) => s + p.finalBonus, 0);
    const allCommitted = total > 0 && committed === assignees.length;
    return { total, committed, totalFinalBonus, allCommitted };
  }, [payouts, assignees]);

  // ---------------------------------------------------------------------------
  // Ops
  // ---------------------------------------------------------------------------

  const calculate = async (commit: boolean) => {
    if (!activeCycleId) return;
    setBusy(true);
    setBusyAction(commit ? '正式下发中…' : '试算中…');
    setError(null);
    try {
      const payload: Record<string, unknown> = { commit };
      const baseBonusesParsed: Record<string, number> = {};
      for (const a of assignees) {
        const v = parseFloat(baseBonuses[a] ?? '0');
        baseBonusesParsed[a] = Number.isFinite(v) ? v : 0;
      }
      payload.baseBonuses = baseBonusesParsed;
      const r = await fetch(`/api/kpi/cycles/${activeCycleId}/bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await loadCycleData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const closeCycle = async (force = false) => {
    if (!activeCycle) return;
    if (
      !confirm(
        force
          ? `强制关闭周期 "${activeCycle.name}" (跳过奖金下发校验) ?`
          : `年终关闭周期 "${activeCycle.name}" (所有 KPI 数据封档, 不可逆) ?`,
      )
    )
      return;
    setBusy(true);
    setBusyAction('年终关闭中…');
    setError(null);
    try {
      const r = await fetch(`/api/kpi/cycles/${activeCycle.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.missingAssignees) {
          throw new Error(
            `还有 ${j.missingAssignees.length} 人未下发奖金: ${j.missingAssignees.slice(0, 3).join(', ')}${j.missingAssignees.length > 3 ? ' …' : ''}`,
          );
        }
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      await loadCycles();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const toggleExpand = (a: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isLocked = activeCycle?.status === 'closed';

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4 md:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            KPI 绩效奖金下发
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            按 scope=bonus KPI 加权完成率计算 · 试算预览 → 正式下发 → 年终关闭
            <span className="ml-2 text-footnote">CHARTER §5 M3</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      <TrustBanner tone="audit" title="奖金计算铁律" charter="CHARTER §2.0">
        奖金 = baseBonus × min(1.5, 加权完成率). 仅 <strong>scope=bonus</strong> KPI 参与计算,
        monitor 永不进. 一旦正式下发, 不可撤销 (需新建工单).
      </TrustBanner>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* 周期 + 摘要 */}
      <Card>
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          <div className="min-w-[280px]">
            <Select value={activeCycleId ?? ''} onValueChange={setActiveCycleId}>
              <SelectTrigger>
                <SelectValue placeholder="选择周期" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · FY{c.fiscalYear} · {c.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeCycle && (
            <Badge
              variant="outline"
              className={
                activeCycle.status === 'closed'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }
            >
              {activeCycle.status === 'closed' && <Lock className="h-3 w-3 mr-1" />}
              {activeCycle.status}
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-3 text-caption">
            <span className="text-muted-foreground">
              人员 <strong>{assignees.length}</strong>
            </span>
            <span className="text-muted-foreground">
              已下发 <strong>{summary.committed}</strong>
            </span>
            {summary.totalFinalBonus > 0 && (
              <span className="text-foreground">
                总奖金{' '}
                <strong>¥ {summary.totalFinalBonus.toLocaleString()}</strong>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 操作栏 */}
      {activeCycle && assignees.length > 0 && (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void calculate(false)}
            disabled={busy || isLocked}
          >
            <Calculator className="h-4 w-4 mr-1" />
            试算 (草稿)
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (confirm(`正式下发 ${assignees.length} 人奖金 (不可撤销) ?`)) {
                void calculate(true);
              }
            }}
            disabled={busy || isLocked}
          >
            <Send className="h-4 w-4 mr-1" />
            正式下发
          </Button>
          {!isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void closeCycle(false)}
              disabled={busy || !summary.allCommitted}
              title={summary.allCommitted ? '' : '请先全员正式下发奖金'}
            >
              <Lock className="h-4 w-4 mr-1" />
              年终关闭
            </Button>
          )}
        </div>
      )}

      {busy && busyAction && (
        <div className="text-caption text-muted-foreground text-center">{busyAction}</div>
      )}

      {/* 表格 */}
      {assignees.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-10 text-center text-caption text-muted-foreground">
            {activeCycle
              ? '本周期没有 scope=bonus 的 KPI · 无人需要算奖金'
              : '请选择一个周期'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-body">奖金明细</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-caption">
              <thead className="border-b bg-muted/40 text-footnote uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium w-8"></th>
                  <th className="px-4 py-2 text-left font-medium">承担人</th>
                  <th className="px-4 py-2 text-right font-medium w-16">KPI 数</th>
                  <th className="px-4 py-2 text-right font-medium w-28">加权完成率</th>
                  <th className="px-4 py-2 text-right font-medium w-32">基础奖金 ¥</th>
                  <th className="px-4 py-2 text-right font-medium w-32">最终奖金 ¥</th>
                  <th className="px-4 py-2 text-left font-medium w-24">状态</th>
                </tr>
              </thead>
              <tbody>
                {assignees.map((a) => {
                  const myKpis = kpisByAssignee.get(a) ?? [];
                  const p = payoutByAssignee.get(a);
                  const isOpen = expanded.has(a);
                  const wc = p?.weightedCompletion ?? 0;
                  const wcPct = Math.round(wc * 100);
                  const wcColor =
                    wc >= 1.0
                      ? 'text-emerald-700'
                      : wc >= 0.85
                      ? 'text-warning'
                      : 'text-rose-700';
                  return (
                    <Fragment key={a}>
                      <tr className="border-b">
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(a)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-caption">
                              {userMap[a]?.name ?? userMap[a]?.email ?? (
                                <span className="font-mono text-muted-foreground">{a}</span>
                              )}
                            </span>
                            {(userMap[a]?.name || userMap[a]?.email) && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {a}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-footnote">{myKpis.length}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${wcColor}`}>
                          {p ? `${wcPct}%` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Input
                            type="number"
                            value={baseBonuses[a] ?? ''}
                            onChange={(e) =>
                              setBaseBonuses((prev) => ({ ...prev, [a]: e.target.value }))
                            }
                            disabled={busy || isLocked || p?.committed}
                            className="h-8 text-right tabular-nums"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          {p ? `¥ ${p.finalBonus.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {!p && (
                            <Badge variant="outline" className="text-footnote">
                              未计算
                            </Badge>
                          )}
                          {p && !p.committed && (
                            <Badge
                              variant="outline"
                              className="bg-warning/5 text-warning border-warning/20 text-footnote"
                            >
                              草稿
                            </Badge>
                          )}
                          {p?.committed && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-footnote"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              已下发
                            </Badge>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td colSpan={7} className="px-8 py-3">
                            <div className="text-footnote text-muted-foreground mb-2">
                              KPI 贡献明细
                            </div>
                            <table className="w-full text-footnote">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left py-1">标题</th>
                                  <th className="text-right py-1 w-20">权重</th>
                                  <th className="text-right py-1 w-24">完成率</th>
                                  <th className="text-right py-1 w-28">起 → 当 / 目标</th>
                                  <th className="text-right py-1 w-24">加权得分</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(p?.contributions ?? myKpis.map((k) => {
                                  const completion =
                                    k.targetValue === k.startValue
                                      ? k.currentValue >= k.targetValue
                                        ? 1
                                        : 0
                                      : Math.max(
                                          0,
                                          Math.min(
                                            1.5,
                                            (k.currentValue - k.startValue) /
                                              (k.targetValue - k.startValue),
                                          ),
                                        );
                                  return {
                                    kpiId: k.id,
                                    subjectCode: '',
                                    title: k.title,
                                    weight: k.weight,
                                    completion,
                                    weightedScore: k.weight * completion,
                                  };
                                })).map((c) => (
                                  <tr key={c.kpiId} className="border-t border-muted/40">
                                    <td className="py-1.5">{c.title}</td>
                                    <td className="text-right tabular-nums">{c.weight}</td>
                                    <td className="text-right tabular-nums">
                                      {Math.round(c.completion * 100)}%
                                    </td>
                                    <td className="text-right tabular-nums">
                                      {myKpis.find((k) => k.id === c.kpiId)
                                        ? `${myKpis.find((k) => k.id === c.kpiId)!.startValue} → ${myKpis.find((k) => k.id === c.kpiId)!.currentValue} / ${myKpis.find((k) => k.id === c.kpiId)!.targetValue}`
                                        : '—'}
                                    </td>
                                    <td className="text-right tabular-nums">
                                      {c.weightedScore.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
