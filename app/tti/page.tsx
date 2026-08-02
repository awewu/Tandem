'use client';

/**
 * /tti · TTI 四要素工作台 (员工自主填报视角)
 *
 * CHARTER-KPI-TTI §3.1 + §3.2 + §3.3
 *
 * 设计核心:
 *   1. 一站式引导填报 4 要素 (改进实现 / 推进事项 / 关键障碍 / 预期目标值 / 实际进度)
 *   2. "记录, 不审批" 信任叙事 (Banner + 措辞)
 *   3. 仅展示自己拥有 (ownerId === me) 的 KR — 主管要看下属去 /okr (只读)
 *   4. CheckIn 提交走 /api/okr/checkins POST (后端 owner-only 守卫)
 *   5. 60-70% 健康区间, >90% 提示"目标定低了"
 *
 * 与 /okr (power user 视图) 的关系:
 *   - /okr 是完整 OKR 三件套 (Objective/KR/Initiative/CheckIn) 的密集工作台
 *   - /tti 是简化引导视图, 每个 KR 一张"四要素卡"
 *   - 同源数据, 两个视图互为镜像 (改一处, 另一处自动反映)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser, useCurrentUserId } from '@/lib/hooks/use-current-user';
import {
  Sparkles,
  Target,
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Compass,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { TrustBanner } from '@/components/trust-banner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Confidence = 'on-track' | 'at-risk' | 'off-track';

interface Objective {
  id: string;
  title: string;
  description?: string;
  cycleId: string;
  ownerId: string;
  status: string;
}

interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  ownerId: string;
  coOwnerIds?: string[];
  type: 'numeric' | 'percentage' | 'milestone' | 'binary';
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  weight: number;
  confidence: Confidence;
  status: string;
}

interface ServerKeyResult extends Omit<KeyResult, 'type'> {
  type?: KeyResult['type'];
  measureType?: KeyResult['type'];
}

interface ServerObjective extends Objective {
  keyResults?: ServerKeyResult[];
}

interface CheckIn {
  id: string;
  scope: 'objective' | 'kr';
  scopeId: string;
  authorId: string;
  progressBefore: number;
  progressAfter: number;
  confidenceBefore: Confidence;
  confidenceAfter: Confidence;
  achievements?: string;
  blockers?: string;
  nextSteps?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIDENCE_META: Record<Confidence, { label: string; color: string }> = {
  'on-track': { label: '正常', color: 'bg-success/10 text-success border-success/30' },
  'at-risk': { label: '有风险', color: 'bg-warning/5 text-warning border-warning/20' },
  'off-track': { label: '严重偏离', color: 'bg-danger/5 text-danger border-danger/30' },
};

const HISTORY_PAGE_SIZE = 5;

/** TTI 健康度: 60-70% 健康, >90% 警告"目标定低了". 与 KPI 完全不同. */
function ttiHealth(progressPct: number): {
  label: string;
  color: string;
  hint: string;
} {
  if (progressPct >= 90) {
    return {
      label: '过高',
      color: 'bg-warning/5 text-warning border-warning/20',
      hint: '> 90% 通常说明目标设定偏低. 下个周期可设更有挑战的 stretch goal.',
    };
  }
  if (progressPct >= 60) {
    return {
      label: '健康',
      color: 'bg-success/10 text-success border-success/30',
      hint: '60-70% 是 TTI 的"健康区间" — 说明目标有合理挑战且在推进.',
    };
  }
  if (progressPct >= 40) {
    return {
      label: '需关注',
      color: 'bg-info/10 text-info border-info/30',
      hint: '进度不达 60% — 检查是否需要调整推进事项或求助.',
    };
  }
  return {
    label: '滞后',
    color: 'bg-danger/5 text-danger border-danger/30',
    hint: 'TTI 是软目标, 不发奖金. 但若长期滞后, 可考虑下个周期重设方向.',
  };
}

function progressOf(kr: KeyResult): number {
  if (kr.targetValue === kr.startValue) {
    return kr.currentValue >= kr.targetValue ? 100 : 0;
  }
  const r = (kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue);
  return Math.round(Math.max(0, Math.min(1.5, r)) * 100);
}

function currentValueFromProgress(kr: KeyResult, progressPct: number): string {
  if (kr.targetValue === kr.startValue) {
    return (progressPct >= 100 ? kr.targetValue : kr.startValue).toString();
  }
  const value = kr.startValue + (progressPct / 100) * (kr.targetValue - kr.startValue);
  return Number.isInteger(value) ? value.toString() : Number(value.toFixed(2)).toString();
}

function sanitizeProgressValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed.startsWith('-')) return trimmed === '-' ? '' : '0';
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric < 0 ? '0' : value;
}

// ---------------------------------------------------------------------------
// Per-KR form state
// ---------------------------------------------------------------------------

interface FormState {
  checkInId?: string | null;
  progressBefore?: number | null;
  confidenceBefore?: Confidence | null;
  currentValue: string;
  confidenceAfter: Confidence;
  achievements: string;
  blockers: string;
  nextSteps: string;
  submitting: boolean;
  error: string | null;
  ok: string | null;
}

const EMPTY_FORM: FormState = {
  checkInId: null,
  progressBefore: null,
  confidenceBefore: null,
  currentValue: '',
  confidenceAfter: 'on-track',
  achievements: '',
  blockers: '',
  nextSteps: '',
  submitting: false,
  error: null,
  ok: null,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TtiPage() {
  const me = useCurrentUserId();
  const { user } = useCurrentUser();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [krs, setKrs] = useState<KeyResult[]>([]);
  const [checkInsByKr, setCheckInsByKr] = useState<Record<string, CheckIn[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [deletingCheckInId, setDeletingCheckInId] = useState<string | null>(null);
  const [historyExpandedByKr, setHistoryExpandedByKr] = useState<Record<string, boolean>>({});
  const [historyPageByKr, setHistoryPageByKr] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/tandem-okr', {
        cache: 'no-store',
        credentials: 'include',
      });
      const jo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(jo.error ?? `HTTP ${r.status}`);

      const ownerIds = new Set([me, user?.id].filter(Boolean));
      const serverObjs = (jo.objectives ?? []) as ServerObjective[];
      const allKrs: KeyResult[] = serverObjs
        .flatMap((o) => o.keyResults ?? [])
        .map((k) => ({
          ...k,
          type: k.type ?? k.measureType ?? 'numeric',
        }));
      const myKrs = allKrs.filter(
        (k) => ownerIds.has(k.ownerId) || (k.coOwnerIds ?? []).some((id) => ownerIds.has(id)),
      );
      const myObjectiveIds = new Set(myKrs.map((k) => k.objectiveId));
      const objs: Objective[] = serverObjs.filter(
        (o) => ownerIds.has(o.ownerId) || myObjectiveIds.has(o.id),
      );
      setObjectives(objs);
      setKrs(myKrs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [me, user?.id]);

  const loadCheckIns = useCallback(async (krId: string) => {
    try {
      const r = await fetch(`/api/okr/checkins?scope=kr&scopeId=${krId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setCheckInsByKr((prev) => ({ ...prev, [krId]: j.checkIns ?? [] }));
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    for (const k of krs) {
      if (!checkInsByKr[k.id]) void loadCheckIns(k.id);
    }
  }, [krs, checkInsByKr, loadCheckIns]);

  // ---------------------------------------------------------------------------
  // Form ops
  // ---------------------------------------------------------------------------

  const emptyFormFor = (krId: string): FormState => ({
    ...EMPTY_FORM,
    confidenceAfter: krs.find((kr) => kr.id === krId)?.confidence ?? 'on-track',
  });
  const getForm = (krId: string): FormState => forms[krId] ?? emptyFormFor(krId);
  const setForm = (krId: string, patch: Partial<FormState>) =>
    setForms((prev) => ({
      ...prev,
      [krId]: { ...(prev[krId] ?? emptyFormFor(krId)), ...patch },
    }));

  const submitCheckIn = async (kr: KeyResult) => {
    const f = getForm(kr.id);
    const achievements = f.achievements.trim();
    if (!achievements) {
      setForm(kr.id, { error: '请填写推进事项' });
      return;
    }
    const enteredValue = f.currentValue.trim();
    const newVal = enteredValue === '' ? kr.currentValue : Number(enteredValue);
    if (!Number.isFinite(newVal)) {
      setForm(kr.id, { error: '请填写实际进度数值' });
      return;
    }
    if (newVal < 0) {
      setForm(kr.id, { currentValue: '0', error: '实际进度不能小于 0' });
      return;
    }
    setForm(kr.id, { submitting: true, error: null, ok: null });
    try {
      const isEditing = Boolean(f.checkInId);
      const beforeProgress = f.progressBefore ?? progressOf(kr);
      const afterProgress = (() => {
        if (kr.targetValue === kr.startValue) return newVal >= kr.targetValue ? 100 : 0;
        const r = (newVal - kr.startValue) / (kr.targetValue - kr.startValue);
        return Math.round(Math.max(0, Math.min(1.5, r)) * 100);
      })();
      const r = await fetch('/api/okr/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'kr',
          scopeId: kr.id,
          checkInId: f.checkInId ?? undefined,
          progressBefore: beforeProgress,
          progressAfter: afterProgress,
          confidenceBefore: f.confidenceBefore ?? kr.confidence,
          confidenceAfter: f.confidenceAfter,
          achievements,
          blockers: f.blockers.trim() || undefined,
          nextSteps: f.nextSteps.trim() || undefined,
          currentValue: enteredValue === '' ? undefined : newVal,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setForm(kr.id, {
        ...EMPTY_FORM,
        confidenceAfter: f.confidenceAfter,
        ok: isEditing ? '已更新 · 不需要审批' : '已记录 · 不需要审批',
      });
      setHistoryExpandedByKr((prev) => ({ ...prev, [kr.id]: true }));
      setHistoryPageByKr((prev) => ({ ...prev, [kr.id]: 1 }));
      // refresh
      await load();
      await loadCheckIns(kr.id);
    } catch (e) {
      setForm(kr.id, { submitting: false, error: (e as Error).message });
    }
  };

  const deleteCheckIn = async (kr: KeyResult, checkIn: CheckIn) => {
    if (deletingCheckInId) return;
    if (!confirm('确认删除这条 TTI 填报记录？删除后会按剩余最近记录回算当前进度。')) return;
    setDeletingCheckInId(checkIn.id);
    setForm(kr.id, { error: null, ok: null });
    try {
      const r = await fetch(`/api/okr/checkins?id=${encodeURIComponent(checkIn.id)}`, {
        method: 'DELETE',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const isEditingDeleted = getForm(kr.id).checkInId === checkIn.id;
      setForm(kr.id, isEditingDeleted
        ? { ...EMPTY_FORM, confidenceAfter: kr.confidence, ok: '已删除填报记录' }
        : { ok: '已删除填报记录' });
      setHistoryPageByKr((prev) => ({ ...prev, [kr.id]: 1 }));
      await load();
      await loadCheckIns(kr.id);
    } catch (e) {
      setForm(kr.id, { error: (e as Error).message });
    } finally {
      setDeletingCheckInId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const krsByObjective = useMemo(() => {
    const m = new Map<string, KeyResult[]>();
    for (const k of krs) {
      const arr = m.get(k.objectiveId) ?? [];
      arr.push(k);
      m.set(k.objectiveId, arr);
    }
    return m;
  }, [krs]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          我的 TTI · 四要素填报
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          战略成长空间 · 与奖金完全分离 · 60-70% 是健康区间
          <span className="ml-2 text-footnote">CHARTER-KPI-TTI §3</span>
        </p>
        {/* 三入口互链: 澄清"在哪写进展" (对标审计 P1-1 迷路问题) */}
        <nav className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-muted-foreground">
          <span className="font-medium text-foreground">当前: 四要素填报</span>
          <a href="/okr" className="hover:text-primary hover:underline">目标与对齐 → OKR</a>
          <a href="/report" className="hover:text-primary hover:underline">写今日进展 → 日报</a>
        </nav>
      </header>

      <TrustBanner tone="trust" charter="CHARTER §3.2">
        主管可以看到你的填报, 但 <strong>不会驳回</strong> 也 <strong>不会因此扣奖金</strong>.
        TTI 是为了让你 / 主管 / 公司一起看清你的成长方向, 不是用来考核的.
      </TrustBanner>

      <div className="flex items-center justify-between">
        <div className="text-caption text-muted-foreground">
          属于你的 Objective: <strong>{objectives.length}</strong> · KR: <strong>{krs.length}</strong>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-caption text-danger flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-caption text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : krs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-caption text-muted-foreground">
            你还没有 KR (TTI). 去{' '}
            <a href="/okr" className="text-primary underline">
              /okr
            </a>{' '}
            页创建一个 Objective + KR 开始.
          </CardContent>
        </Card>
      ) : (
        objectives.map((obj) => {
          const objKrs = krsByObjective.get(obj.id) ?? [];
          if (objKrs.length === 0) return null;
          return (
            <Card key={obj.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-body flex items-start gap-2">
                  <Compass className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <div className="space-y-0.5">
                    <div>{obj.title}</div>
                    {obj.description && (
                      <div className="text-footnote text-muted-foreground font-normal">
                        <span className="font-medium">改进实现:</span> {obj.description}
                      </div>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {objKrs.map((kr) => {
                  const f = getForm(kr.id);
                  const progress = progressOf(kr);
                  const health = ttiHealth(progress);
                  const conf = CONFIDENCE_META[kr.confidence];
                  const recent = checkInsByKr[kr.id] ?? [];
                  const historyTotalPages = Math.max(1, Math.ceil(recent.length / HISTORY_PAGE_SIZE));
                  const requestedHistoryPage = historyPageByKr[kr.id] ?? 1;
                  const historyPage = Math.min(Math.max(requestedHistoryPage, 1), historyTotalPages);
                  const historyExpanded = historyExpandedByKr[kr.id] ?? recent.length <= HISTORY_PAGE_SIZE;
                  const pagedRecent = recent.slice(
                    (historyPage - 1) * HISTORY_PAGE_SIZE,
                    historyPage * HISTORY_PAGE_SIZE,
                  );
                  return (
                    <div key={kr.id} className="border rounded-lg p-4 space-y-4">
                      {/* KR 头部 + 进度 */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            {kr.title}
                          </div>
                          <div className="text-footnote text-muted-foreground mt-1 tabular-nums">
                            起 {kr.startValue.toLocaleString()} → 目标{' '}
                            <strong>{kr.targetValue.toLocaleString()}</strong>
                            {kr.unit && <span> {kr.unit}</span>} · 当前{' '}
                            <strong>{kr.currentValue.toLocaleString()}</strong>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className={health.color}>
                            {health.label} {progress}%
                          </Badge>
                          <Badge variant="outline" className={`${conf.color} text-footnote`}>
                            {conf.label}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={Math.min(100, progress)} className="h-2" />
                      <p className="text-footnote text-muted-foreground italic">{health.hint}</p>

                      {/* 四要素引导表单 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                        {/* 推进事项 (本期取得了什么) */}
                        <div className="space-y-1.5">
                          <Label className="text-footnote flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-success" />
                            推进事项 · 本期取得了什么
                            <span className="text-danger">*</span>
                          </Label>
                          <Textarea
                            required
                            rows={3}
                            value={f.achievements}
                            onChange={(e) =>
                              setForm(kr.id, { achievements: e.target.value, error: null })
                            }
                            placeholder="例: 完成了 3 次客户访谈, 拿到了 2 个内部 align"
                          />
                        </div>

                        {/* 关键障碍 */}
                        <div className="space-y-1.5">
                          <Label className="text-footnote flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            关键障碍 · 在阻挠你的是什么
                          </Label>
                          <Textarea
                            rows={3}
                            value={f.blockers}
                            onChange={(e) => setForm(kr.id, { blockers: e.target.value })}
                            placeholder="例: 部门 A 还没给数据 / 客户暂时无法配合"
                          />
                        </div>

                        {/* 实际进度 */}
                        <div className="space-y-1.5">
                          <Label className="text-footnote flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-info" />
                            实际进度 · 当前数值
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={f.currentValue}
                            onKeyDown={(e) => {
                              if (e.key === '-') e.preventDefault();
                            }}
                            onChange={(e) => {
                              const value = sanitizeProgressValue(e.currentTarget.value);
                              if (value !== e.currentTarget.value) e.currentTarget.value = value;
                              setForm(kr.id, { currentValue: value, error: null });
                            }}
                            onBlur={(e) => {
                              const value = sanitizeProgressValue(e.currentTarget.value);
                              if (value !== f.currentValue) setForm(kr.id, { currentValue: value });
                            }}
                            placeholder={kr.currentValue.toString()}
                          />
                        </div>

                        {/* 信心度 */}
                        <div className="space-y-1.5">
                          <Label className="text-footnote flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-brand-700" />
                            信心度
                          </Label>
                          <Select
                            value={f.confidenceAfter}
                            onValueChange={(v) =>
                              setForm(kr.id, { confidenceAfter: v as Confidence })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on-track">正常 · 按计划推进</SelectItem>
                              <SelectItem value="at-risk">有风险 · 可能延期</SelectItem>
                              <SelectItem value="off-track">严重偏离 · 需要帮助</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 推进事项 - 下一步 (推进事项 第二维) */}
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-footnote flex items-center gap-1.5">
                            <Compass className="h-3.5 w-3.5 text-primary" />
                            推进事项 · 下一步做什么
                          </Label>
                          <Textarea
                            rows={2}
                            value={f.nextSteps}
                            onChange={(e) => setForm(kr.id, { nextSteps: e.target.value })}
                            placeholder="例: 周二前出方案 PPT, 周四对齐部门 B"
                          />
                        </div>
                      </div>

                      {f.error && (
                        <div className="text-caption text-danger bg-danger/5 px-3 py-2 rounded-md flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          {f.error}
                        </div>
                      )}
                      {f.ok && (
                        <div className="text-caption text-success bg-success/10 px-3 py-2 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          {f.ok}
                        </div>
                      )}
                      {f.checkInId && (
                        <div className="text-caption text-info bg-info/10 px-3 py-2 rounded-md flex items-center gap-2">
                          <Pencil className="h-4 w-4" />
                          正在修改已填报记录
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 px-2 text-info hover:text-info"
                            onClick={() =>
                              setForm(kr.id, {
                                ...EMPTY_FORM,
                                confidenceAfter: kr.confidence,
                              })
                            }
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            取消修改
                          </Button>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          onClick={() => void submitCheckIn(kr)}
                          disabled={f.submitting}
                        >
                          {f.submitting ? '记录中…' : '记录本期进展'}
                        </Button>
                      </div>

                      {/* 历史 check-in：默认收纳, 每页 5 条 */}
                      {recent.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="mb-2 flex items-center gap-2">
                            <button
                              type="button"
                              className="flex min-w-0 items-center gap-1.5 text-footnote text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setHistoryExpandedByKr((prev) => ({
                                  ...prev,
                                  [kr.id]: !(prev[kr.id] ?? recent.length <= HISTORY_PAGE_SIZE),
                                }))
                              }
                            >
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${historyExpanded ? '' : '-rotate-90'}`}
                              />
                              <span>近期填报 · {recent.length} 次</span>
                              {recent.length > HISTORY_PAGE_SIZE && historyExpanded && (
                                <span className="text-[11px] text-muted-foreground">
                                  第 {historyPage} / {historyTotalPages} 页
                                </span>
                              )}
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-7 px-2 text-footnote"
                              onClick={() =>
                                setHistoryExpandedByKr((prev) => ({
                                  ...prev,
                                  [kr.id]: !(prev[kr.id] ?? recent.length <= HISTORY_PAGE_SIZE),
                                }))
                              }
                            >
                              {historyExpanded ? '收起' : '展开'}
                            </Button>
                          </div>
                          {historyExpanded && (
                            <>
                              <ul className="space-y-2">
                                {pagedRecent.map((c) => (
                                  <li
                                    key={c.id}
                                    className="text-footnote text-muted-foreground border-l-2 pl-3 py-1"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="tabular-nums">
                                        {c.progressBefore}% → <strong>{c.progressAfter}%</strong>
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`${CONFIDENCE_META[c.confidenceAfter].color} text-footnote`}
                                      >
                                        {CONFIDENCE_META[c.confidenceAfter].label}
                                      </Badge>
                                      <span className="ml-auto">
                                        {new Date(c.createdAt).toLocaleDateString()}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() =>
                                          setForm(kr.id, {
                                            checkInId: c.id,
                                            progressBefore: c.progressBefore,
                                            confidenceBefore: c.confidenceBefore,
                                            currentValue: currentValueFromProgress(kr, c.progressAfter),
                                            confidenceAfter: c.confidenceAfter,
                                            achievements: c.achievements ?? '',
                                            blockers: c.blockers ?? '',
                                            nextSteps: c.nextSteps ?? '',
                                            error: null,
                                            ok: null,
                                          })
                                        }
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-1" />
                                        修改
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-danger hover:text-danger"
                                        disabled={deletingCheckInId === c.id}
                                        onClick={() => void deleteCheckIn(kr, c)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        {deletingCheckInId === c.id ? '删除中…' : '删除'}
                                      </Button>
                                    </div>
                                    {c.achievements && (
                                      <div className="mt-1">
                                        <span className="text-success">取得:</span> {c.achievements}
                                      </div>
                                    )}
                                    {c.blockers && (
                                      <div className="mt-0.5">
                                        <span className="text-warning">障碍:</span> {c.blockers}
                                      </div>
                                    )}
                                    {c.nextSteps && (
                                      <div className="mt-0.5">
                                        <span className="text-primary">下一步:</span> {c.nextSteps}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {recent.length > HISTORY_PAGE_SIZE && (
                                <div className="mt-3 flex items-center justify-end gap-2 text-footnote text-muted-foreground">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={historyPage <= 1}
                                    onClick={() =>
                                      setHistoryPageByKr((prev) => ({
                                        ...prev,
                                        [kr.id]: Math.max(1, historyPage - 1),
                                      }))
                                    }
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                    上一页
                                  </Button>
                                  <span className="tabular-nums">
                                    {historyPage} / {historyTotalPages}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={historyPage >= historyTotalPages}
                                    onClick={() =>
                                      setHistoryPageByKr((prev) => ({
                                        ...prev,
                                        [kr.id]: Math.min(historyTotalPages, historyPage + 1),
                                      }))
                                    }
                                  >
                                    下一页
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
