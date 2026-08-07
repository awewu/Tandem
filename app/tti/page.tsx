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
  Target,
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Compass,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  Pin,
  PinOff,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useOKRStore, type Initiative as StoreInitiative } from '@/lib/store';
import { bucketByWeekOf, startOfWeek, type WorkHorizon } from '@/lib/okr/work-method';
import {
  hydrateOkrFromApi,
  persistCreateInitiative,
  persistDeleteInitiative,
  persistUpdateInitiative,
} from '@/lib/store/okr-sync';

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
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WORK_METHOD_QUADRANT_CLASS = 'flex h-[18rem] min-h-0 flex-col overflow-hidden rounded-lg border bg-background p-3';
const WORK_METHOD_QUADRANT_BODY_CLASS = 'mt-3 min-h-0 flex-1 overflow-y-auto pr-1';

const INITIATIVE_STATUS_META: Record<StoreInitiative['status'], { label: string; className: string }> = {
  todo: { label: '待办', className: 'text-muted-foreground' },
  'in-progress': { label: '进行中', className: 'text-info' },
  blocked: { label: '阻塞', className: 'text-danger' },
  done: { label: '完成', className: 'text-success' },
  cancelled: { label: '取消', className: 'text-muted-foreground' },
};

function isClosedInitiative(i: StoreInitiative): boolean {
  return i.status === 'done' || i.status === 'cancelled';
}

function splitKrInitiatives(items: StoreInitiative[], now: number): {
  buckets: Record<WorkHorizon, StoreInitiative[]>;
  thisWeek: StoreInitiative[];
  planning: StoreInitiative[];
} {
  const buckets: Record<WorkHorizon, StoreInitiative[]> = {
    overdue: [],
    'this-week': [],
    'next-4-weeks': [],
    later: [],
    backlog: [],
  };
  for (const item of items) {
    let bucket = bucketByWeekOf(item.weekOf, now);
    if (bucket === 'overdue' && isClosedInitiative(item)) bucket = 'this-week';
    buckets[bucket].push(item);
  }
  return {
    buckets,
    thisWeek: [...buckets.overdue, ...buckets['this-week']],
    planning: [
      ...buckets['next-4-weeks'],
      ...buckets.later,
      ...buckets.backlog,
    ],
  };
}

function formatShortDate(ms?: number | null): string {
  if (ms == null) return '未排期';
  return new Date(ms).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

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

function objectiveTtiProgress(krs: KeyResult[]): number {
  if (krs.length === 0) return 0;
  const positiveWeight = krs.reduce((sum, kr) => sum + Math.max(0, kr.weight || 0), 0);
  if (positiveWeight > 0) {
    return Math.round(
      krs.reduce((sum, kr) => sum + progressOf(kr) * Math.max(0, kr.weight || 0), 0) / positiveWeight,
    );
  }
  return Math.round(krs.reduce((sum, kr) => sum + progressOf(kr), 0) / krs.length);
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
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');

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
    void hydrateOkrFromApi();
    const onFocus = () => { void hydrateOkrFromApi(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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
      await hydrateOkrFromApi(true);
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

  useEffect(() => {
    if (objectives.length === 0) {
      if (selectedObjectiveId) setSelectedObjectiveId('');
      return;
    }
    if (objectives.some((obj) => obj.id === selectedObjectiveId)) return;
    const firstWithKr = objectives.find((obj) => (krsByObjective.get(obj.id) ?? []).length > 0);
    setSelectedObjectiveId((firstWithKr ?? objectives[0]).id);
  }, [objectives, krsByObjective, selectedObjectiveId]);

  const selectedObjective = useMemo(
    () => objectives.find((obj) => obj.id === selectedObjectiveId) ?? objectives[0],
    [objectives, selectedObjectiveId],
  );

  const selectedObjectiveKrs = useMemo(
    () => (selectedObjective ? krsByObjective.get(selectedObjective.id) ?? [] : []),
    [krsByObjective, selectedObjective],
  );

  const selectedObjectiveCheckIns = useMemo(() => {
    const krIds = new Set(selectedObjectiveKrs.map((kr) => kr.id));
    return Object.values(checkInsByKr)
      .flat()
      .filter((item) => krIds.has(item.scopeId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [checkInsByKr, selectedObjectiveKrs]);

  const selectedObjectiveProgress = objectiveTtiProgress(selectedObjectiveKrs);
  const selectedObjectiveHealth = ttiHealth(selectedObjectiveProgress);
  const selectedRiskCount = selectedObjectiveKrs.filter((kr) => kr.confidence !== 'on-track').length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-primary" />
          OKR·四象限驾驶舱
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          先完成 TTI 四要素填报，再拆成本周工作、未来计划和当前进展
          <span className="ml-2 text-footnote">CHARTER-KPI-TTI §3</span>
        </p>
        {/* 三入口互链: 澄清"在哪写进展" (对标审计 P1-1 迷路问题) */}
        <nav className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-muted-foreground">
          <span className="font-medium text-foreground">当前: OKR·四象限驾驶舱</span>
          <a href="/okr" className="hover:text-primary hover:underline">目标与对齐 → OKR</a>
          <a href="/report" className="hover:text-primary hover:underline">写今日进展 → 日报</a>
        </nav>
      </header>

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
      ) : objectives.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-caption text-muted-foreground">
            你还没有 Objective. 去{' '}
            <a href="/okr" className="text-primary underline">
              /okr
            </a>{' '}
            页创建一个 Objective + KR 开始.
          </CardContent>
        </Card>
      ) : selectedObjective ? (
        <>
          <section className="rounded-lg border bg-card p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-footnote font-medium text-muted-foreground">
                <Compass className="h-4 w-4 text-primary" />
                Objective · {objectives.length} O · {krs.length} KR
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {objectives.map((obj) => {
                const active = obj.id === selectedObjective.id;
                const objKrs = krsByObjective.get(obj.id) ?? [];
                const pct = objectiveTtiProgress(objKrs);
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => setSelectedObjectiveId(obj.id)}
                    className={`inline-flex max-w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-caption transition ${
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                        : 'border-border bg-background text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span className="truncate font-medium">{obj.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {objKrs.length} KR · {pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border bg-card px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary">
                TTI
              </Badge>
              <Badge variant="outline" className={selectedObjectiveHealth.color}>
                {selectedObjectiveHealth.label} {selectedObjectiveProgress}%
              </Badge>
              {selectedRiskCount > 0 && (
                <Badge variant="outline" className="border-warning/20 bg-warning/5 text-warning">
                  {selectedRiskCount} 个 KR 有风险
                </Badge>
              )}
              <h2 className="min-w-0 max-w-xl truncate text-body font-semibold text-foreground">
                {selectedObjective.title}
              </h2>
              <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
                60-70% 健康 · 与奖金分离 · 四要素: 改进 / 推进 / 障碍 / 目标 / 进度 / 信心
              </span>
            </div>
            {selectedObjective.description && (
              <p className="mt-1 truncate text-footnote text-muted-foreground">
                {selectedObjective.description}
              </p>
            )}

            {selectedObjectiveKrs.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed p-4 text-center text-caption text-muted-foreground">
                当前 Objective 下还没有 KR，先去 <a href="/okr" className="text-primary underline">/okr</a> 补齐 TTI。
              </div>
            ) : (
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                {selectedObjectiveKrs.map((kr) => {
                  const progress = progressOf(kr);
                  const conf = CONFIDENCE_META[kr.confidence];
                  return (
                    <div key={kr.id} className="min-w-0 rounded-md border bg-background p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-footnote font-medium text-foreground">{kr.title}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                            {kr.currentValue.toLocaleString()} / {kr.targetValue.toLocaleString()}
                            {kr.unit && <span> {kr.unit}</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className={`${conf.color} shrink-0 text-[11px]`}>
                          {conf.label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={Math.min(100, progress)} className="h-1.5" />
                        <span className="shrink-0 text-[11px] text-muted-foreground">{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <ObjectiveWorkMethod
            objective={selectedObjective}
            krs={selectedObjectiveKrs}
            recent={selectedObjectiveCheckIns}
          />
        </>
      ) : null}
    </div>
  );
}

function ObjectiveWorkMethod({
  objective,
  krs,
  recent,
}: {
  objective: Objective;
  krs: KeyResult[];
  recent: CheckIn[];
}) {
  const krIds = useMemo(() => new Set(krs.map((kr) => kr.id)), [krs]);
  const initiatives = useOKRStore((s) =>
    s.initiatives.filter((i) => i.scope === 'kr' && krIds.has(i.scopeId)),
  );
  const updateInitiative = useOKRStore((s) => s.updateInitiative);
  const deleteInitiative = useOKRStore((s) => s.deleteInitiative);
  const [now, setNow] = useState<number | null>(null);
  const [addingTo, setAddingTo] = useState<'this-week' | 'future' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [selectedKrId, setSelectedKrId] = useState(krs[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNow(Date.now()), []);
  useEffect(() => {
    if (krs.some((kr) => kr.id === selectedKrId)) return;
    setSelectedKrId(krs[0]?.id ?? '');
  }, [krs, selectedKrId]);

  const view = useMemo(() => (now == null ? null : splitKrInitiatives(initiatives, now)), [initiatives, now]);
  const thisWeekStart = now == null ? null : startOfWeek(now);
  const futureStart = thisWeekStart == null ? null : thisWeekStart + WEEK_MS;
  const krOptions = useMemo(() => krs.map((kr) => ({ id: kr.id, title: kr.title })), [krs]);
  const objectiveProgress = objectiveTtiProgress(krs);
  const objectiveHealth = ttiHealth(objectiveProgress);

  async function createPlan() {
    if (now == null || !draftTitle.trim() || !addingTo || !selectedKrId) return;
    const kr = krs.find((item) => item.id === selectedKrId);
    if (!kr) return;
    setSaving(true);
    setError(null);
    try {
      const weekOf = addingTo === 'this-week' ? thisWeekStart : futureStart;
      await persistCreateInitiative({
        keyResultId: kr.id,
        title: draftTitle.trim(),
        ownerId: kr.ownerId,
        status: 'todo',
        weekOf: weekOf ?? undefined,
      });
      setDraftTitle('');
      setAddingTo(null);
      await hydrateOkrFromApi(true);
    } catch (e) {
      setError(`新增失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function updatePlan(
    item: StoreInitiative,
    patch: { weekOf?: number | null; status?: StoreInitiative['status'] },
  ) {
    const localPatch: Partial<StoreInitiative> = {};
    if ('weekOf' in patch) localPatch.weekOf = patch.weekOf ?? undefined;
    if (patch.status) localPatch.status = patch.status;
    updateInitiative(item.id, localPatch);
    setError(null);
    try {
      await persistUpdateInitiative(item.id, patch);
      await hydrateOkrFromApi(true);
    } catch (e) {
      setError(`保存失败：${(e as Error).message}`);
      await hydrateOkrFromApi(true);
    }
  }

  async function deletePlan(item: StoreInitiative) {
    if (!confirm(`确认删除工作项「${item.title}」？`)) return;
    deleteInitiative(item.id);
    setError(null);
    try {
      await persistDeleteInitiative(item.id);
      await hydrateOkrFromApi(true);
    } catch (e) {
      setError(`删除失败：${(e as Error).message}`);
      await hydrateOkrFromApi(true);
    }
  }

  if (now == null || !view) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-footnote text-muted-foreground">
        加载 OKR·四象限驾驶舱…
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            OKR·四象限驾驶舱
          </h3>
          <p className="mt-1 text-footnote text-muted-foreground">
            选中 Objective 后，把它下面的 KR 拆成本周工作、未来计划和当前进展。
          </p>
        </div>
        <Badge variant="outline" className="bg-background text-footnote">
          本周 {view.thisWeek.length} 项 · 未来/待规划 {view.planning.length} 项
        </Badge>
      </div>

      {error && (
        <div className="rounded-md bg-danger/5 px-3 py-2 text-caption text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:grid-rows-[18rem_18rem]">
        <PlanQuadrant
          icon={CalendarCheck}
          title="本周工作"
          hint="遗留 + 本周"
          items={view.thisWeek}
          adding={addingTo === 'this-week'}
          draftTitle={draftTitle}
          saving={saving}
          onAdd={() => {
            setAddingTo('this-week');
            setDraftTitle('');
            setSelectedKrId(krs[0]?.id ?? '');
          }}
          onDraftTitle={setDraftTitle}
          onSubmit={() => void createPlan()}
          onCancel={() => {
            setAddingTo(null);
            setDraftTitle('');
          }}
          krOptions={krOptions}
          selectedKrId={selectedKrId}
          onSelectedKrId={setSelectedKrId}
          actionIcon={PinOff}
          actionLabel="移出本周"
          onAction={(item) => void updatePlan(item, { weekOf: null })}
          onStatus={(item, status) => void updatePlan(item, { status })}
          onDelete={(item) => void deletePlan(item)}
        />

        <section className={WORK_METHOD_QUADRANT_CLASS}>
          <QuadrantTitle icon={Target} title="OKR" hint={`${krs.length} KR · ${objectiveProgress}%`} />
          <div className={WORK_METHOD_QUADRANT_BODY_CLASS}>
            <div>
              <div className="font-medium text-foreground">{objective.title}</div>
              {objective.description && (
                <div className="mt-1 line-clamp-2 text-footnote text-muted-foreground">
                  {objective.description}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className={objectiveHealth.color}>
                  {objectiveHealth.label} {objectiveProgress}%
                </Badge>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {krs.map((kr, index) => {
                const progress = progressOf(kr);
                const conf = CONFIDENCE_META[kr.confidence];
                return (
                  <li key={kr.id} className="rounded-md border bg-muted/20 p-2 text-footnote">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground line-clamp-2">
                          KR{index + 1} {kr.title}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                          {kr.currentValue.toLocaleString()} / {kr.targetValue.toLocaleString()}
                          {kr.unit && <span> {kr.unit}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className={`${conf.color} shrink-0 text-footnote`}>
                        {conf.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={Math.min(100, progress)} className="h-1.5" />
                      <span className="shrink-0 text-[11px] text-muted-foreground">{progress}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <PlanQuadrant
          icon={CalendarRange}
          title="未来四周 / 待规划"
          hint="下一步排程"
          items={view.planning}
          adding={addingTo === 'future'}
          draftTitle={draftTitle}
          saving={saving}
          onAdd={() => {
            setAddingTo('future');
            setDraftTitle('');
            setSelectedKrId(krs[0]?.id ?? '');
          }}
          onDraftTitle={setDraftTitle}
          onSubmit={() => void createPlan()}
          onCancel={() => {
            setAddingTo(null);
            setDraftTitle('');
          }}
          krOptions={krOptions}
          selectedKrId={selectedKrId}
          onSelectedKrId={setSelectedKrId}
          actionIcon={Pin}
          actionLabel="钉到本周"
          onAction={(item) => void updatePlan(item, { weekOf: thisWeekStart })}
          onStatus={(item, status) => void updatePlan(item, { status })}
          onDelete={(item) => void deletePlan(item)}
        />

        <section className={WORK_METHOD_QUADRANT_CLASS}>
          <QuadrantTitle icon={ClipboardCheck} title="当前进展" hint={`最近 ${Math.min(5, recent.length)} / ${recent.length} 条`} />
          <div className={WORK_METHOD_QUADRANT_BODY_CLASS}>
            {recent.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-footnote text-muted-foreground">
                暂无进展记录
              </div>
            ) : (
              <ul className="space-y-2">
                {recent.slice(0, 5).map((item) => {
                  const kr = krs.find((candidate) => candidate.id === item.scopeId);
                  return (
                    <li key={item.id} className="rounded-md border bg-muted/20 p-2 text-footnote">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {kr?.title ?? '关键成果'}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {item.progressBefore}% → <strong>{item.progressAfter}%</strong>
                        </span>
                      </div>
                      {item.achievements && <div className="mt-1 line-clamp-2">推进：{item.achievements}</div>}
                      {item.blockers && <div className="mt-0.5 line-clamp-1 text-warning">障碍：{item.blockers}</div>}
                      {item.nextSteps && <div className="mt-0.5 line-clamp-1 text-primary">下一步：{item.nextSteps}</div>}
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function TtiWorkMethodGate({
  unlocked,
  objective,
  kr,
  recent,
}: {
  unlocked: boolean;
  objective: Objective;
  kr: KeyResult;
  recent: CheckIn[];
}) {
  if (!unlocked) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-footnote text-muted-foreground">
        完成本期 TTI 填报后，会在这里展开「OKR·四象限驾驶舱」：把这个 KR 拆成本周工作、未来计划和后续进展。
      </div>
    );
  }
  return <InlineWorkMethod objective={objective} kr={kr} recent={recent} />;
}

function InlineWorkMethod({
  objective,
  kr,
  recent,
}: {
  objective: Objective;
  kr: KeyResult;
  recent: CheckIn[];
}) {
  const initiatives = useOKRStore((s) =>
    s.initiatives.filter((i) => i.scope === 'kr' && i.scopeId === kr.id),
  );
  const updateInitiative = useOKRStore((s) => s.updateInitiative);
  const deleteInitiative = useOKRStore((s) => s.deleteInitiative);
  const [now, setNow] = useState<number | null>(null);
  const [addingTo, setAddingTo] = useState<'this-week' | 'future' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNow(Date.now()), []);

  const view = useMemo(() => (now == null ? null : splitKrInitiatives(initiatives, now)), [initiatives, now]);
  const thisWeekStart = now == null ? null : startOfWeek(now);
  const futureStart = thisWeekStart == null ? null : thisWeekStart + WEEK_MS;

  async function createPlan() {
    if (now == null || !draftTitle.trim() || !addingTo) return;
    setSaving(true);
    setError(null);
    try {
      const weekOf = addingTo === 'this-week' ? thisWeekStart : futureStart;
      await persistCreateInitiative({
        keyResultId: kr.id,
        title: draftTitle.trim(),
        ownerId: kr.ownerId,
        status: 'todo',
        weekOf: weekOf ?? undefined,
      });
      setDraftTitle('');
      setAddingTo(null);
      await hydrateOkrFromApi(true);
    } catch (e) {
      setError(`新增失败：${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function updatePlan(
    item: StoreInitiative,
    patch: { weekOf?: number | null; status?: StoreInitiative['status'] },
  ) {
    const localPatch: Partial<StoreInitiative> = {};
    if ('weekOf' in patch) localPatch.weekOf = patch.weekOf ?? undefined;
    if (patch.status) localPatch.status = patch.status;
    updateInitiative(item.id, localPatch);
    setError(null);
    try {
      await persistUpdateInitiative(item.id, patch);
      await hydrateOkrFromApi(true);
    } catch (e) {
      setError(`保存失败：${(e as Error).message}`);
      await hydrateOkrFromApi(true);
    }
  }

  async function deletePlan(item: StoreInitiative) {
    if (!confirm(`确认删除工作项「${item.title}」？`)) return;
    deleteInitiative(item.id);
    setError(null);
    try {
      await persistDeleteInitiative(item.id);
      await hydrateOkrFromApi(true);
    } catch (e) {
      setError(`删除失败：${(e as Error).message}`);
      await hydrateOkrFromApi(true);
    }
  }

  if (now == null || !view) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-footnote text-muted-foreground">
        加载 OKR·四象限驾驶舱…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            OKR·四象限驾驶舱
          </h3>
          <p className="mt-1 text-footnote text-muted-foreground">
            TTI 已完成填报，继续把这个 KR 拆到周计划和进展跟踪。
          </p>
        </div>
        <Badge variant="outline" className="bg-background text-footnote">
          本周 {view.thisWeek.length} 项 · 未来/待规划 {view.planning.length} 项
        </Badge>
      </div>

      {error && (
        <div className="rounded-md bg-danger/5 px-3 py-2 text-caption text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-background p-3">
          <QuadrantTitle icon={Target} title="OKR / TTI" hint="目标摘要" />
          <div className="mt-3 space-y-2 text-footnote">
            <div>
              <div className="text-muted-foreground">Objective</div>
              <div className="font-medium text-foreground">{objective.title}</div>
            </div>
            <div>
              <div className="text-muted-foreground">KR</div>
              <div className="font-medium text-foreground">{kr.title}</div>
            </div>
            <div className="tabular-nums text-muted-foreground">
              当前 {kr.currentValue.toLocaleString()} / 目标 {kr.targetValue.toLocaleString()}
              {kr.unit && <span> {kr.unit}</span>}
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-background p-3">
          <QuadrantTitle icon={ClipboardCheck} title="当前进展" hint="最近填报" />
          {recent.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed p-4 text-center text-footnote text-muted-foreground">
              暂无进展记录
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.slice(0, 3).map((item) => (
                <li key={item.id} className="rounded-md border bg-muted/20 p-2 text-footnote">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      {item.progressBefore}% → <strong>{item.progressAfter}%</strong>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {item.achievements && <div className="mt-1 line-clamp-1">推进：{item.achievements}</div>}
                  {item.blockers && <div className="mt-0.5 line-clamp-1 text-warning">障碍：{item.blockers}</div>}
                  {item.nextSteps && <div className="mt-0.5 line-clamp-1 text-primary">下一步：{item.nextSteps}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <PlanQuadrant
          icon={CalendarCheck}
          title="本周工作"
          hint="遗留 + 本周"
          items={view.thisWeek}
          adding={addingTo === 'this-week'}
          draftTitle={draftTitle}
          saving={saving}
          onAdd={() => {
            setAddingTo('this-week');
            setDraftTitle('');
          }}
          onDraftTitle={setDraftTitle}
          onSubmit={() => void createPlan()}
          onCancel={() => {
            setAddingTo(null);
            setDraftTitle('');
          }}
          actionIcon={PinOff}
          actionLabel="移出本周"
          onAction={(item) => void updatePlan(item, { weekOf: null })}
          onStatus={(item, status) => void updatePlan(item, { status })}
          onDelete={(item) => void deletePlan(item)}
        />

        <PlanQuadrant
          icon={CalendarRange}
          title="未来四周 / 待规划"
          hint="下一步排程"
          items={view.planning}
          adding={addingTo === 'future'}
          draftTitle={draftTitle}
          saving={saving}
          onAdd={() => {
            setAddingTo('future');
            setDraftTitle('');
          }}
          onDraftTitle={setDraftTitle}
          onSubmit={() => void createPlan()}
          onCancel={() => {
            setAddingTo(null);
            setDraftTitle('');
          }}
          actionIcon={Pin}
          actionLabel="钉到本周"
          onAction={(item) => void updatePlan(item, { weekOf: thisWeekStart })}
          onStatus={(item, status) => void updatePlan(item, { status })}
          onDelete={(item) => void deletePlan(item)}
        />
      </div>
    </div>
  );
}

function QuadrantTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-caption font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  );
}

function PlanQuadrant({
  icon,
  title,
  hint,
  items,
  adding,
  draftTitle,
  saving,
  onAdd,
  onDraftTitle,
  onSubmit,
  onCancel,
  krOptions,
  selectedKrId,
  onSelectedKrId,
  actionIcon: ActionIcon,
  actionLabel,
  onAction,
  onStatus,
  onDelete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  items: StoreInitiative[];
  adding: boolean;
  draftTitle: string;
  saving: boolean;
  onAdd: () => void;
  onDraftTitle: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  krOptions?: Array<{ id: string; title: string }>;
  selectedKrId?: string;
  onSelectedKrId?: (value: string) => void;
  actionIcon: React.ComponentType<{ className?: string }>;
  actionLabel: string;
  onAction: (item: StoreInitiative) => void;
  onStatus: (item: StoreInitiative, status: StoreInitiative['status']) => void;
  onDelete: (item: StoreInitiative) => void;
}) {
  return (
    <section className={WORK_METHOD_QUADRANT_CLASS}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <QuadrantTitle icon={icon} title={title} hint={`${items.length} 项 · ${hint}`} />
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-footnote text-primary hover:bg-primary/5"
        >
          <Plus className="h-3.5 w-3.5" />
          新增
        </button>
      </div>

      <div className={WORK_METHOD_QUADRANT_BODY_CLASS}>
        {adding && (
          <div className="rounded-md border bg-muted/20 p-2">
            {krOptions && krOptions.length > 1 && onSelectedKrId && (
              <select
                value={selectedKrId ?? ''}
                onChange={(e) => onSelectedKrId(e.currentTarget.value)}
                className="mb-2 w-full rounded-md border bg-background px-2 py-1.5 text-footnote text-foreground"
                title="归属 KR"
              >
                {krOptions.map((kr) => (
                  <option key={kr.id} value={kr.id}>
                    {kr.title}
                  </option>
                ))}
              </select>
            )}
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => onDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmit();
                if (e.key === 'Escape') onCancel();
              }}
              placeholder="输入要推进的具体工作"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                取消
              </Button>
              <Button type="button" size="sm" onClick={onSubmit} disabled={saving || !draftTitle.trim()}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        )}

        {items.length === 0 && !adding ? (
          <div className="rounded-md border border-dashed p-4 text-center text-footnote text-muted-foreground">
            暂无工作项
          </div>
        ) : (
          <ul className={`${adding ? 'mt-3' : ''} space-y-2`}>
            {items.map((item) => {
              const meta = INITIATIVE_STATUS_META[item.status];
              return (
                <li key={item.id} className="rounded-md border bg-muted/20 p-2 text-footnote">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground line-clamp-2">{item.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatShortDate(item.weekOf)} · {item.dueDate ? `截止 ${formatShortDate(item.dueDate)}` : '未设截止'}
                      </div>
                    </div>
                    <select
                      value={item.status}
                      onChange={(e) => onStatus(item, e.currentTarget.value as StoreInitiative['status'])}
                      className={`shrink-0 rounded-md border bg-background px-1.5 py-1 text-[11px] ${meta.className}`}
                      title="状态"
                    >
                      {Object.entries(INITIATIVE_STATUS_META).map(([value, option]) => (
                        <option key={value} value={value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onAction(item)}>
                      <ActionIcon className="h-3.5 w-3.5 mr-1" />
                      {actionLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-danger hover:text-danger"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      删除
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
