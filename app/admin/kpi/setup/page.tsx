'use client';

/**
 * /admin/kpi/setup · KPI 周期管理 + 三层 cascade 设置工作台
 *
 * CHARTER-KPI-TTI §2.1 通道 A: HR/高管设置 target/weight/scope
 *
 * 流程:
 *   1. 选择 (或创建) 一个 KpiCycle (财年)
 *   2. 在该周期 status=draft 时, 增删改 KPI 实例
 *   3. 周期激活 (draft → active) 锁死所有 target / scope
 *   4. 年终关闭 (active → closed)
 *
 * KPI 三层级:
 *   - company       公司级 (CEO/高管承诺)
 *   - department    部门级 (部门承诺, 父级 = 公司 KPI)
 *   - individual    个人级 (员工承诺, 父级 = 部门 KPI)
 *
 * 双 scope:
 *   - bonus         考核, 进 9-box + 奖金
 *   - monitor       监控, 仅健康度看板
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Plus,
  Target,
  Lock,
  Calendar,
  Trash2,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Layers,
  Coins,
  Activity,
} from 'lucide-react';
import type { Kpi, KpiCycle, KpiLevel, KpiScope, KpiSubject } from '@/lib/types/kpi';
import { ExcelImportExport } from '@/components/kpi/ExcelImportExport';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_LABEL: Record<KpiLevel, { label: string; color: string }> = {
  company: { label: '公司级', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  department: { label: '部门级', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  individual: { label: '个人级', color: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const SCOPE_LABEL: Record<KpiScope, { label: string; color: string; icon: typeof Coins }> = {
  bonus: { label: '考核', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Coins },
  monitor: { label: '监控', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: Activity },
};

const STATUS_LABEL: Record<KpiCycle['status'], { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
  active: { label: '已激活 (锁定)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: '已关闭', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface CycleFormState {
  fiscalYear: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface KpiFormState {
  id?: string;
  subjectId: string;
  level: KpiLevel;
  scope: KpiScope;
  parentKpiId?: string;
  assigneeId: string;
  departmentId: string;
  title: string;
  description: string;
  measureType: 'numeric' | 'percentage' | 'currency' | 'count';
  startValue: string;
  targetValue: string;
  unit: string;
  weight: string;
}

const EMPTY_KPI_FORM: KpiFormState = {
  subjectId: '',
  level: 'company',
  scope: 'bonus',
  assigneeId: '',
  departmentId: '',
  title: '',
  description: '',
  measureType: 'numeric',
  startValue: '0',
  targetValue: '',
  unit: '',
  weight: '0',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KpiSetupPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState<CycleFormState>({
    fiscalYear: new Date().getFullYear().toString(),
    name: '',
    startDate: '',
    endDate: '',
  });

  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [kpiForm, setKpiForm] = useState<KpiFormState>(EMPTY_KPI_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const refreshCycles = useCallback(async () => {
    const r = await fetch('/api/kpi/cycles', { cache: 'no-store' });
    if (!r.ok) throw new Error(`cycles HTTP ${r.status}`);
    const j = await r.json();
    setCycles(j.cycles ?? []);
    if (!activeCycleId && j.cycles?.length > 0) {
      // 默认选最近的 active 周期; 若无 active 则选最新创建
      const sorted = [...j.cycles].sort(
        (a: KpiCycle, b: KpiCycle) => b.fiscalYear - a.fiscalYear,
      );
      const preferred = sorted.find((c) => c.status === 'active') ?? sorted[0];
      setActiveCycleId(preferred?.id ?? null);
    }
  }, [activeCycleId]);

  const refreshSubjects = useCallback(async () => {
    const r = await fetch('/api/kpi/subjects?active=true', { cache: 'no-store' });
    if (!r.ok) throw new Error(`subjects HTTP ${r.status}`);
    const j = await r.json();
    setSubjects(j.subjects ?? []);
  }, []);

  const refreshKpis = useCallback(async () => {
    if (!activeCycleId) {
      setKpis([]);
      return;
    }
    const r = await fetch(`/api/kpi?cycleId=${activeCycleId}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`kpis HTTP ${r.status}`);
    const j = await r.json();
    setKpis(j.kpis ?? []);
  }, [activeCycleId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshCycles(), refreshSubjects()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refreshCycles, refreshSubjects]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshKpis();
  }, [refreshKpis]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeCycle = useMemo(
    () => cycles.find((c) => c.id === activeCycleId) ?? null,
    [cycles, activeCycleId],
  );

  const isLocked = activeCycle ? activeCycle.status !== 'draft' : true;

  const subjectName = useCallback(
    (id: string) => subjects.find((s) => s.id === id)?.name ?? id,
    [subjects],
  );
  const subjectCode = useCallback(
    (id: string) => subjects.find((s) => s.id === id)?.code ?? '',
    [subjects],
  );

  const kpiByLevel = useMemo(() => {
    const groups: Record<KpiLevel, Kpi[]> = { company: [], department: [], individual: [] };
    for (const k of kpis) groups[k.level].push(k);
    for (const arr of Object.values(groups)) {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    }
    return groups;
  }, [kpis]);

  // 父级 KPI 候选: parent.level 必须严格小于 current level
  const parentKpiOptions = useMemo(() => {
    const order: Record<KpiLevel, number> = { company: 1, department: 2, individual: 3 };
    return kpis.filter((k) => order[k.level] < order[kpiForm.level]);
  }, [kpis, kpiForm.level]);

  // ---------------------------------------------------------------------------
  // Cycle actions
  // ---------------------------------------------------------------------------

  const openCreateCycle = () => {
    const year = new Date().getFullYear();
    setCycleForm({
      fiscalYear: year.toString(),
      name: `FY${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
    setSubmitError(null);
    setCycleDialogOpen(true);
  };

  const submitCycle = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch('/api/kpi/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscalYear: parseInt(cycleForm.fiscalYear, 10),
          name: cycleForm.name,
          startDate: new Date(cycleForm.startDate).toISOString(),
          endDate: new Date(cycleForm.endDate).toISOString(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setCycleDialogOpen(false);
      setActiveCycleId(j.cycle?.id ?? null);
      await refreshCycles();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const transitionCycle = async (next: 'active' | 'closed') => {
    if (!activeCycle) return;
    const verb = next === 'active' ? '激活并锁定 target' : '关闭周期';
    if (!confirm(`确认${verb} "${activeCycle.name}" ?`)) return;
    try {
      const r = await fetch(`/api/kpi/cycles/${activeCycle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await refreshCycles();
    } catch (e) {
      alert(`${verb}失败: ${(e as Error).message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // KPI actions
  // ---------------------------------------------------------------------------

  const openCreateKpi = () => {
    setKpiForm(EMPTY_KPI_FORM);
    setSubmitError(null);
    setKpiDialogOpen(true);
  };

  const openEditKpi = (k: Kpi) => {
    setKpiForm({
      id: k.id,
      subjectId: k.subjectId,
      level: k.level,
      scope: k.scope,
      parentKpiId: k.parentKpiId,
      assigneeId: k.assigneeId,
      departmentId: k.departmentId ?? '',
      title: k.title,
      description: k.description ?? '',
      measureType: k.measureType,
      startValue: k.startValue.toString(),
      targetValue: k.targetValue.toString(),
      unit: k.unit ?? '',
      weight: k.weight.toString(),
    });
    setSubmitError(null);
    setKpiDialogOpen(true);
  };

  // 选 subject 时, 若 KPI 表单未填某些默认字段, 用 subject 默认值预填
  const onSubjectChange = (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId);
    setKpiForm((prev) => ({
      ...prev,
      subjectId,
      scope: subject?.defaultScope ?? prev.scope,
      measureType: subject?.defaultMeasureType ?? prev.measureType,
      unit: prev.unit || subject?.defaultUnit || '',
    }));
  };

  const submitKpi = async () => {
    if (!activeCycle) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const isEdit = !!kpiForm.id;
      const url = isEdit ? `/api/kpi/${kpiForm.id}` : '/api/kpi';
      const method = isEdit ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = {
        cycleId: activeCycle.id,
        subjectId: kpiForm.subjectId,
        level: kpiForm.level,
        scope: kpiForm.scope,
        parentKpiId: kpiForm.parentKpiId || undefined,
        assigneeId: kpiForm.assigneeId,
        departmentId: kpiForm.departmentId || undefined,
        title: kpiForm.title,
        description: kpiForm.description || undefined,
        measureType: kpiForm.measureType,
        startValue: parseFloat(kpiForm.startValue) || 0,
        targetValue: parseFloat(kpiForm.targetValue),
        unit: kpiForm.unit || undefined,
        weight: parseFloat(kpiForm.weight) || 0,
      };
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setKpiDialogOpen(false);
      await refreshKpis();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteKpi = async (k: Kpi) => {
    if (!confirm(`确认删除 KPI "${k.title}" ?`)) return;
    try {
      const r = await fetch(`/api/kpi/${k.id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await refreshKpis();
    } catch (e) {
      alert(`删除失败: ${(e as Error).message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const cycleCount = cycles.length;

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            KPI 设置工作台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            HR/高管 (kpi.write) 设置年度 KPI 目标 · 三层 cascade · 通道 A
            <span className="ml-2 text-xs">CHARTER-KPI-TTI §2.1</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={openCreateCycle}>
            <Plus className="h-4 w-4 mr-1" />
            新增周期
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            加载失败: {error}
          </CardContent>
        </Card>
      )}

      {/* 周期选择 + 状态 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            当前周期
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cycleCount === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              尚未创建任何 KPI 周期. 点击右上 &quot;新增周期&quot; 开始 — 一个财年 = 一个周期.
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-[280px]">
                <Select
                  value={activeCycleId ?? ''}
                  onValueChange={(v) => setActiveCycleId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择周期" />
                  </SelectTrigger>
                  <SelectContent>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · FY{c.fiscalYear} · {STATUS_LABEL[c.status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeCycle && (
                <>
                  <Badge variant="outline" className={STATUS_LABEL[activeCycle.status].color}>
                    {activeCycle.status !== 'draft' && <Lock className="h-3 w-3 mr-1" />}
                    {STATUS_LABEL[activeCycle.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {activeCycle.startDate.slice(0, 10)} → {activeCycle.endDate.slice(0, 10)}
                  </span>
                  {activeCycle.targetsLockedAt && (
                    <span className="text-xs text-muted-foreground">
                      锁定于 {activeCycle.targetsLockedAt.slice(0, 10)}
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {activeCycle.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void transitionCycle('active')}
                        disabled={kpis.length === 0}
                        title={kpis.length === 0 ? '请先添加 KPI' : '激活后 target 与 scope 锁死'}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        激活并锁定
                      </Button>
                    )}
                    {activeCycle.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void transitionCycle('closed')}
                      >
                        <Lock className="h-4 w-4 mr-1" />
                        年终关闭
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeCycle && isLocked && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" />
              周期已 {activeCycle.status === 'active' ? '激活' : '关闭'}: target / scope 不可修改, 不可新增/删除 KPI (CHARTER §2.3)
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI 列表 (分层级) */}
      {activeCycle && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Layers className="h-5 w-5" />
              本周期 KPI ({kpis.length})
            </h2>
            <div className="flex items-center gap-2">
              <ExcelImportExport
                label="KPI"
                exportUrl={`/api/kpi/export?cycleId=${activeCycle.id}`}
                importUrl={`/api/kpi/import?cycleId=${activeCycle.id}`}
                exportFilename={`kpi-${activeCycle.fiscalYear}-${new Date().toISOString().slice(0, 10)}.xlsx`}
                importDisabled={isLocked}
                importDisabledReason="周期已锁定, 仅 draft 可批量导入"
                onImported={() => void refreshKpis()}
              />
              <Button
                size="sm"
                onClick={openCreateKpi}
                disabled={isLocked || subjects.length === 0}
                title={
                  isLocked
                    ? '周期已锁定'
                    : subjects.length === 0
                    ? '请先去 /admin/kpi/subjects 创建科目'
                    : ''
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                新增 KPI
              </Button>
            </div>
          </div>

          {(['company', 'department', 'individual'] as KpiLevel[]).map((level) => {
            const list = kpiByLevel[level];
            const lvlInfo = LEVEL_LABEL[level];
            return (
              <Card key={level}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="outline" className={lvlInfo.color}>
                      {lvlInfo.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground font-normal">
                      ({list.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {list.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      暂无{lvlInfo.label} KPI
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">标题</th>
                          <th className="px-4 py-2 text-left font-medium w-32">科目</th>
                          <th className="px-4 py-2 text-left font-medium w-20">scope</th>
                          <th className="px-4 py-2 text-left font-medium w-32">承担人</th>
                          <th className="px-4 py-2 text-right font-medium w-32">起始 / 目标</th>
                          <th className="px-4 py-2 text-right font-medium w-20">权重</th>
                          <th className="px-4 py-2 text-right font-medium w-24">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((k) => {
                          const sc = SCOPE_LABEL[k.scope];
                          const ScopeIcon = sc.icon;
                          return (
                            <tr key={k.id} className="border-b last:border-0">
                              <td className="px-4 py-2.5">
                                <div className="font-medium">{k.title}</div>
                                {k.description && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {k.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                <span className="font-mono text-muted-foreground">
                                  {subjectCode(k.subjectId)}
                                </span>
                                <div className="text-xs">{subjectName(k.subjectId)}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge variant="outline" className={`${sc.color} text-xs`}>
                                  <ScopeIcon className="h-3 w-3 mr-1" />
                                  {sc.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                                {k.assigneeId}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {k.startValue.toLocaleString()} →{' '}
                                <span className="font-medium">
                                  {k.targetValue.toLocaleString()}
                                </span>
                                {k.unit && <span className="text-muted-foreground"> {k.unit}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {k.scope === 'bonus' ? (
                                  <span className="text-foreground">{k.weight}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditKpi(k)}
                                  disabled={isLocked && false /* 锁定后仅 target/scope 不能改, 其他可改 */}
                                  title="编辑"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void deleteKpi(k)}
                                  disabled={isLocked}
                                  title={isLocked ? '周期已锁定' : '删除'}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Cycle Dialog */}
      <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增 KPI 周期</DialogTitle>
            <DialogDescription>
              一个 KPI 周期 = 一个财年. 创建时为草稿, 添加 KPI 后再激活锁定.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fy">
                  财年 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="fy"
                  type="number"
                  value={cycleForm.fiscalYear}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCycleForm((s) => ({
                      ...s,
                      fiscalYear: v,
                      name: s.name || `FY${v}`,
                      startDate: s.startDate || `${v}-01-01`,
                      endDate: s.endDate || `${v}-12-31`,
                    }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cyc-name">名称</Label>
                <Input
                  id="cyc-name"
                  value={cycleForm.name}
                  onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">开始日期</Label>
                <Input
                  id="start"
                  type="date"
                  value={cycleForm.startDate}
                  onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">结束日期</Label>
                <Input
                  id="end"
                  type="date"
                  value={cycleForm.endDate}
                  onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })}
                />
              </div>
            </div>
            {submitError && (
              <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void submitCycle()} disabled={submitting}>
              {submitting ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Dialog */}
      <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{kpiForm.id ? '编辑 KPI' : '新增 KPI'}</DialogTitle>
            <DialogDescription>
              {kpiForm.id && isLocked
                ? '周期已锁定: target / scope 不可改, 其他字段照常'
                : '通道 A · HR/高管设置目标. currentValue 永远由通道 B (ERP) / C (人工补录) 写入.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  科目 <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={kpiForm.subjectId}
                  onValueChange={onSubjectChange}
                  disabled={!!kpiForm.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择科目" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Lv{s.level} · {s.code} {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  层级 <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={kpiForm.level}
                  onValueChange={(v) =>
                    setKpiForm({ ...kpiForm, level: v as KpiLevel, parentKpiId: undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">公司级</SelectItem>
                    <SelectItem value="department">部门级</SelectItem>
                    <SelectItem value="individual">个人级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                标题 <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={kpiForm.title}
                onChange={(e) => setKpiForm({ ...kpiForm, title: e.target.value })}
                placeholder="2026 年度营收"
              />
            </div>

            <div className="space-y-1.5">
              <Label>描述</Label>
              <Textarea
                rows={2}
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                placeholder="可选 · 解释口径或里程碑"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  scope <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={kpiForm.scope}
                  onValueChange={(v) => setKpiForm({ ...kpiForm, scope: v as KpiScope })}
                  disabled={!!kpiForm.id && isLocked}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">考核 (bonus, 进奖金)</SelectItem>
                    <SelectItem value="monitor">监控 (monitor, 不挂奖金)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>父级 KPI (cascade)</Label>
                <Select
                  value={kpiForm.parentKpiId ?? '__none__'}
                  onValueChange={(v) =>
                    setKpiForm({ ...kpiForm, parentKpiId: v === '__none__' ? undefined : v })
                  }
                  disabled={kpiForm.level === 'company' || parentKpiOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="无父级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">无父级</SelectItem>
                    {parentKpiOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {LEVEL_LABEL[p.level].label} · {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  承担人 (userId / deptId) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={kpiForm.assigneeId}
                  onChange={(e) => setKpiForm({ ...kpiForm, assigneeId: e.target.value })}
                  placeholder="u_alice / dept_finance / company"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>所属部门 (可选)</Label>
                <Input
                  value={kpiForm.departmentId}
                  onChange={(e) => setKpiForm({ ...kpiForm, departmentId: e.target.value })}
                  placeholder="dept_finance"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>度量类型</Label>
                <Select
                  value={kpiForm.measureType}
                  onValueChange={(v) =>
                    setKpiForm({ ...kpiForm, measureType: v as KpiFormState['measureType'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">数值</SelectItem>
                    <SelectItem value="percentage">百分比</SelectItem>
                    <SelectItem value="currency">金额</SelectItem>
                    <SelectItem value="count">次数</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>起始值</Label>
                <Input
                  type="number"
                  value={kpiForm.startValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, startValue: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  目标值 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={kpiForm.targetValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetValue: e.target.value })}
                  disabled={!!kpiForm.id && isLocked}
                />
              </div>
              <div className="space-y-1.5">
                <Label>单位</Label>
                <Input
                  value={kpiForm.unit}
                  onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                  placeholder="元 / %"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>权重 (仅 scope=bonus 生效, 0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={kpiForm.weight}
                onChange={(e) => setKpiForm({ ...kpiForm, weight: e.target.value })}
                disabled={kpiForm.scope === 'monitor'}
              />
            </div>

            {submitError && (
              <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiDialogOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button
              onClick={() => void submitKpi()}
              disabled={
                submitting ||
                !kpiForm.subjectId ||
                !kpiForm.title ||
                !kpiForm.assigneeId ||
                !kpiForm.targetValue
              }
            >
              {submitting ? '保存中…' : kpiForm.id ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
