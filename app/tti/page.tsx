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
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
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
  type: 'numeric' | 'percentage' | 'milestone' | 'binary';
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  weight: number;
  confidence: Confidence;
  status: string;
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
  'on-track': { label: '正常', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'at-risk': { label: '有风险', color: 'bg-warning/5 text-warning border-warning/20' },
  'off-track': { label: '严重偏离', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

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
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hint: '60-70% 是 TTI 的"健康区间" — 说明目标有合理挑战且在推进.',
    };
  }
  if (progressPct >= 40) {
    return {
      label: '需关注',
      color: 'bg-sky-50 text-sky-700 border-sky-200',
      hint: '进度不达 60% — 检查是否需要调整推进事项或求助.',
    };
  }
  return {
    label: '滞后',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
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

// ---------------------------------------------------------------------------
// Per-KR form state
// ---------------------------------------------------------------------------

interface FormState {
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
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [krs, setKrs] = useState<KeyResult[]>([]);
  const [checkInsByKr, setCheckInsByKr] = useState<Record<string, CheckIn[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, FormState>>({});

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    setError(null);
    try {
      const [ro, rk] = await Promise.all([
        fetch('/api/okr/objectives', { cache: 'no-store' }),
        fetch('/api/okr/keyresults', { cache: 'no-store' }),
      ]);
      // /api/okr/keyresults may not exist; fall back to filtering all KRs through objective endpoint
      const [jo, jk] = await Promise.all([ro.json().catch(() => ({})), rk.ok ? rk.json() : Promise.resolve({})]);
      const objs: Objective[] = (jo.objectives ?? []).filter((o: Objective) => o.ownerId === me);
      let allKrs: KeyResult[] = jk.keyResults ?? [];
      if (allKrs.length === 0) {
        // Fallback: server may embed KRs in objectives response
        allKrs = (jo.objectives ?? []).flatMap((o: { keyResults?: KeyResult[] }) => o.keyResults ?? []);
      }
      const myKrs = allKrs.filter((k) => k.ownerId === me);
      setObjectives(objs);
      setKrs(myKrs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [me]);

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

  const getForm = (krId: string): FormState => forms[krId] ?? EMPTY_FORM;
  const setForm = (krId: string, patch: Partial<FormState>) =>
    setForms((prev) => ({ ...prev, [krId]: { ...(prev[krId] ?? EMPTY_FORM), ...patch } }));

  const submitCheckIn = async (kr: KeyResult) => {
    const f = getForm(kr.id);
    const newVal = parseFloat(f.currentValue);
    if (Number.isNaN(newVal)) {
      setForm(kr.id, { error: '请填写实际进度数值' });
      return;
    }
    setForm(kr.id, { submitting: true, error: null, ok: null });
    try {
      const beforeProgress = progressOf(kr);
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
          progressBefore: beforeProgress,
          progressAfter: afterProgress,
          confidenceBefore: kr.confidence,
          confidenceAfter: f.confidenceAfter,
          achievements: f.achievements || undefined,
          blockers: f.blockers || undefined,
          nextSteps: f.nextSteps || undefined,
          currentValue: newVal,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setForm(kr.id, {
        ...EMPTY_FORM,
        ok: '已记录 · 不需要审批',
      });
      // refresh
      await load();
      await loadCheckIns(kr.id);
    } catch (e) {
      setForm(kr.id, { submitting: false, error: (e as Error).message });
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
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
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
                            <Zap className="h-3.5 w-3.5 text-emerald-600" />
                            推进事项 · 本期取得了什么
                          </Label>
                          <Textarea
                            rows={3}
                            value={f.achievements}
                            onChange={(e) =>
                              setForm(kr.id, { achievements: e.target.value })
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
                            <TrendingUp className="h-3.5 w-3.5 text-sky-600" />
                            实际进度 · 当前数值
                            <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            value={f.currentValue}
                            onChange={(e) => setForm(kr.id, { currentValue: e.target.value })}
                            placeholder={kr.currentValue.toString()}
                          />
                        </div>

                        {/* 信心度 */}
                        <div className="space-y-1.5">
                          <Label className="text-footnote flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-violet-600" />
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
                        <div className="text-caption text-rose-600 bg-rose-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" />
                          {f.error}
                        </div>
                      )}
                      {f.ok && (
                        <div className="text-caption text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          {f.ok}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          onClick={() => void submitCheckIn(kr)}
                          disabled={f.submitting || !f.currentValue}
                        >
                          {f.submitting ? '记录中…' : '记录本期进展'}
                        </Button>
                      </div>

                      {/* 历史 check-in (近 3 次) */}
                      {recent.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="text-footnote text-muted-foreground mb-2">
                            近期填报 · {recent.length} 次
                          </div>
                          <ul className="space-y-2">
                            {recent.slice(0, 3).map((c) => (
                              <li
                                key={c.id}
                                className="text-footnote text-muted-foreground border-l-2 pl-3 py-1"
                              >
                                <div className="flex items-center gap-2">
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
                                </div>
                                {c.achievements && (
                                  <div className="mt-1">
                                    <span className="text-emerald-700">取得:</span> {c.achievements}
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
