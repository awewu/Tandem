'use client';

/**
 * /admin/eval · Trace-Grading 台 + #11 学习归因看板 (P0 · 2026-07-20)
 *
 * 与 /admin/evals (黄金集 suite runner) 互补:
 *   - 本页 = 线上 agent pass 的可观测 (trace + grader 评分) + hindsight 因果归因。
 *
 * 3 tab:
 *   1. Traces      — 近期 agent pass + grader 分数
 *   2. Attributions— #11 决策→KR 因果判定 (被 acknowledged 的 OKR 预警之后是否改善)
 *   3. Regression  — 对已采集 trace 回归跑分 (逐 grader 通过率)
 *
 * UI 完全 CHARTER-UI-V1 合规 (surface/ink tokens · text-{title-2/headline/body/caption/footnote} · semantic 色 · rounded-2xl · shadow-soft-*)。
 */

import { useEffect, useState } from 'react';
import { Gauge, ScrollText, Target, Play, Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { computeEvalSummary, type EvalSummary } from '@/lib/eval/summary';

type Tab = 'traces' | 'attributions' | 'regression' | 'reliability';

interface Grade {
  graderId: string;
  score: number;
  pass: boolean;
  rubric: string;
  notes?: string;
}
interface Trace {
  id: string;
  kind: string;
  actorUserId: string;
  inputSummary: string;
  finalOutputSummary: string;
  roundsExecuted: number;
  finishedNaturally?: boolean;
  tokensUsed: number;
  latencyMs: number;
  linkedDecisionId?: string;
  grades?: Grade[];
  createdAt: string;
}
interface Attribution {
  id: string;
  sourceType: string;
  targetType: string;
  targetId: string;
  windowDays: number;
  progressBefore: number;
  progressAfter: number;
  progressDelta: number;
  verdict: 'positive' | 'neutral' | 'negative' | 'insufficient_data';
  llmDiagnosis?: string;
  createdAt: string;
}
interface Regression {
  tracesEvaluated: number;
  overallPassRate: number;
  byGrader: Record<string, { pass: number; total: number; passRate: number; avgScore: number }>;
}
interface PassK {
  k: number;
  eligibleGroups: number;
  consistentGroups: number;
  passAtK: number | null;
  singlePassRate: number | null;
}
interface ReliabilityBucket {
  bucket: string;
  samples: number;
  passRate: number | null;
  gds: number | null;
  avgRounds: number;
}
interface Reliability {
  buckets: ReliabilityBucket[];
  declineSlope: number | null;
}

function pct(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(0)}%`;
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' | 'danger' | 'neutral' }) {
  const valueColor = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink-primary';
  return (
    <div className="rounded-2xl bg-surface-1 shadow-soft-sm p-3">
      <div className="text-footnote text-ink-tertiary">{label}</div>
      <div className={`text-headline mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-footnote text-ink-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

/** #11/#14 显影记分卡: 把 raw trace/attribution 汇成一眼可读的"AI 评分 + 归因胜率"故事. */
function SummaryScorecard({ s }: { s: EvalSummary }) {
  const winTone = s.attribNetWinRate === null ? 'neutral' : s.attribNetWinRate >= 0 ? 'success' : 'danger';
  const deltaTone = s.attribAvgDelta === null ? 'neutral' : s.attribAvgDelta >= 0 ? 'success' : 'danger';
  return (
    <div className="mb-5 space-y-2">
      <div className="flex items-center gap-1.5 text-caption text-ink-secondary">
        <ScrollText className="w-3.5 h-3.5 text-brand-600" /> #14 评估 (线上 trace 打分)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Grader 通过率" value={pct(s.gradePassRate)} sub={`${s.gradedTotal}/${s.traceTotal} trace 已评分`}
          tone={s.gradePassRate === null ? 'neutral' : s.gradePassRate >= 0.7 ? 'success' : 'danger'} />
        <StatCard label="平均评分" value={s.gradeAvgScore === null ? '—' : (s.gradeAvgScore * 100).toFixed(0)} />
        <StatCard label="Trace 总量" value={String(s.traceTotal)} />
        <StatCard label="近 7 天新增" value={String(s.traceLast7d)} sub="AI 活跃度" />
      </div>

      <div className="flex items-center gap-1.5 text-caption text-ink-secondary pt-1">
        <Target className="w-3.5 h-3.5 text-brand-600" /> #11 归因 (决策 → KR 是否真改善)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard
          label="净胜率 (正-负)/有效"
          value={pct(s.attribNetWinRate)}
          sub={`${s.attribPositive} 正 · ${s.attribNegative} 负`}
          tone={winTone}
        />
        <StatCard
          label="平均进度变化"
          value={s.attribAvgDelta === null ? '—' : `${s.attribAvgDelta >= 0 ? '+' : ''}${(s.attribAvgDelta * 100).toFixed(0)}pt`}
          tone={deltaTone}
        />
        <StatCard label="归因总数" value={String(s.attribTotal)} sub={`${s.attribNeutral} 中性`} />
        <StatCard label="数据不足" value={String(s.attribInsufficient)} sub="待更多 check-in" tone="neutral" />
      </div>

      {s.attribNetWinRate !== null && (
        <div className={`flex items-center gap-1.5 text-footnote ${winTone === 'success' ? 'text-success' : winTone === 'danger' ? 'text-danger' : 'text-ink-tertiary'}`}>
          {winTone === 'success' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {winTone === 'success'
            ? '中央 AI 的建议在被采纳后, 相关 KR 整体呈正向改善 — 飞轮在转。'
            : winTone === 'danger'
              ? '被采纳建议后 KR 整体未改善, 需回看归因诊断定位失效环节。'
              : '正负相抵, 样本仍小。'}
        </div>
      )}
    </div>
  );
}

function verdictClass(v: Attribution['verdict']): string {
  if (v === 'positive') return 'bg-success/10 text-success';
  if (v === 'negative') return 'bg-danger/10 text-danger';
  if (v === 'insufficient_data') return 'bg-warning/10 text-warning';
  return 'bg-surface-3 text-ink-tertiary';
}

function gradeClass(pass: boolean): string {
  return pass ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger';
}

export default function EvalTracePage() {
  const [tab, setTab] = useState<Tab>('traces');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [attribs, setAttribs] = useState<Attribution[]>([]);
  const [regression, setRegression] = useState<Regression | null>(null);
  const [passK, setPassK] = useState<PassK | null>(null);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<EvalSummary | null>(null);

  async function loadSummary() {
    try {
      const [tr, ar] = await Promise.all([
        fetch('/api/admin/eval/traces?limit=200', { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : { traces: [] })),
        fetch('/api/admin/eval/attributions?limit=200', { credentials: 'include', cache: 'no-store' }).then((r) => (r.ok ? r.json() : { attributions: [] })),
      ]);
      setSummary(
        computeEvalSummary(
          Array.isArray(tr.traces) ? tr.traces : [],
          Array.isArray(ar.attributions) ? ar.attributions : [],
        ),
      );
    } catch {
      /* 记分卡加载失败静默 (下方列表仍可用) */
    }
  }

  async function loadTraces() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/eval/traces?limit=100', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTraces(Array.isArray(data.traces) ? data.traces : []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttributions() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/eval/attributions?limit=100', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAttribs(Array.isArray(data.attributions) ? data.attributions : []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runRegression() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/eval/regression', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRegression(data.result ?? null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function loadReliability() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/eval/reliability', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: 3, limit: 500 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPassK(data.passK ?? null);
      setReliability(data.reliability ?? null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (tab === 'traces') void loadTraces();
    else if (tab === 'attributions') void loadAttributions();
  }, [tab]);

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
          <Gauge className="w-5 h-5 text-brand-600" />
          Trace 评估台 · #11 学习归因
        </h1>
        <p className="text-footnote text-ink-tertiary mt-1">
          线上 agent pass 的可观测 (trace + grader 评分) 与 hindsight 因果归因 (被采纳的 OKR 预警之后 KR 是否改善)。只读只记, 不改任何 OKR/配置。
        </p>
      </header>

      {summary && <SummaryScorecard s={summary} />}

      <div className="flex gap-1 mb-4 border-b border-ink-tertiary/15">
        {([
          { id: 'traces', label: 'Traces', icon: ScrollText },
          { id: 'attributions', label: 'Attributions', icon: Target },
          { id: 'regression', label: 'Regression', icon: Gauge },
          { id: 'reliability', label: 'Reliability', icon: TrendingDown },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-body flex items-center gap-1.5 border-b-2 -mb-px ${
              tab === t.id ? 'border-brand-600 text-ink-primary' : 'border-transparent text-ink-tertiary'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-4 rounded-2xl bg-danger/10 text-danger px-4 py-3 text-caption">加载失败: {err}</div>
      )}

      {tab === 'traces' && (
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-caption text-ink-tertiary">共 {traces.length} 条</span>
            <button
              onClick={() => void loadTraces()}
              className="text-caption text-ink-secondary flex items-center gap-1 px-2 py-1 rounded-2xl hover:bg-surface-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 刷新
            </button>
          </div>
          {loading && <div className="text-caption text-ink-tertiary flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 加载中…</div>}
          {!loading && traces.length === 0 && (
            <div className="text-caption text-ink-tertiary py-8 text-center">暂无 trace (中央 AI 感知/推理/决策 或搭子 act pass 运行后自动采集)。</div>
          )}
          {traces.map((t) => (
            <article key={t.id} className="rounded-2xl bg-surface-1 shadow-soft-sm p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-caption font-medium text-ink-primary">{t.kind}</span>
                <span className="text-footnote text-ink-tertiary">{new Date(t.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-caption text-ink-secondary mt-1 line-clamp-2">{t.inputSummary}</p>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {(t.grades ?? []).map((g) => (
                  <span key={g.graderId} className={`text-footnote px-2 py-0.5 rounded-2xl ${gradeClass(g.pass)}`} title={g.notes}>
                    {g.graderId}: {(g.score * 100).toFixed(0)}
                  </span>
                ))}
                <span className="text-footnote text-ink-tertiary">rounds {t.roundsExecuted} · {t.tokensUsed} tok · {t.latencyMs}ms</span>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'attributions' && (
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-caption text-ink-tertiary">共 {attribs.length} 条 · 归因由月度反思 pass 生成</span>
            <button
              onClick={() => void loadAttributions()}
              className="text-caption text-ink-secondary flex items-center gap-1 px-2 py-1 rounded-2xl hover:bg-surface-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 刷新
            </button>
          </div>
          {loading && <div className="text-caption text-ink-tertiary flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 加载中…</div>}
          {!loading && attribs.length === 0 && (
            <div className="text-caption text-ink-tertiary py-8 text-center">暂无归因 (需先有被治理 acknowledged 的 OKR 优化提议, 且窗口内有 check-in)。</div>
          )}
          {attribs.map((a) => (
            <article key={a.id} className="rounded-2xl bg-surface-1 shadow-soft-sm p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-footnote px-2 py-0.5 rounded-2xl ${verdictClass(a.verdict)}`}>{a.verdict}</span>
                <span className="text-footnote text-ink-tertiary">{a.targetType} · {a.targetId}</span>
              </div>
              <div className="text-caption text-ink-secondary mt-2">
                进度 {(a.progressBefore * 100).toFixed(0)}% → {(a.progressAfter * 100).toFixed(0)}%
                <span className={a.progressDelta >= 0 ? 'text-success ml-1' : 'text-danger ml-1'}>
                  ({a.progressDelta >= 0 ? '+' : ''}{(a.progressDelta * 100).toFixed(0)}pt)
                </span>
                <span className="text-ink-tertiary ml-2">窗口 {a.windowDays}d</span>
              </div>
              {a.llmDiagnosis && <p className="text-footnote text-ink-tertiary mt-1 italic">诊断: {a.llmDiagnosis}</p>}
            </article>
          ))}
        </section>
      )}

      {tab === 'regression' && (
        <section className="space-y-3">
          <button
            onClick={() => void runRegression()}
            disabled={running}
            className="text-body flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-600 text-white shadow-soft-sm disabled:opacity-60"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            跑回归 (近 100 条 trace)
          </button>
          {regression && (
            <div className="rounded-2xl bg-surface-1 shadow-soft-sm p-4">
              <div className="text-headline text-ink-primary mb-2">
                总体通过率 {(regression.overallPassRate * 100).toFixed(0)}%
                <span className="text-caption text-ink-tertiary ml-2">({regression.tracesEvaluated} 条 trace)</span>
              </div>
              <div className="space-y-1">
                {Object.entries(regression.byGrader).map(([id, b]) => (
                  <div key={id} className="flex items-center justify-between text-caption">
                    <span className="text-ink-secondary">{id}</span>
                    <span className="text-ink-tertiary">
                      {b.pass}/{b.total} 通过 ({(b.passRate * 100).toFixed(0)}%) · 均分 {(b.avgScore * 100).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'reliability' && (
        <section className="space-y-3">
          <button
            onClick={() => void loadReliability()}
            disabled={running}
            className="text-body flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-600 text-white shadow-soft-sm disabled:opacity-60"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            算一致性 + 衰退曲线 (近 500 条 trace)
          </button>
          <p className="text-footnote text-ink-tertiary">
            Pass^3 一致性 = 同一类问题连续 3 次是否都通过 (衡量 flaky 程度); 可靠性衰退曲线 = 任务轮次越多, 通过率降多快 (斜率越大越脆)。
          </p>

          {passK && (
            <div className="rounded-2xl bg-surface-1 shadow-soft-sm p-4">
              <div className="text-caption text-ink-secondary mb-2 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-brand-600" /> Pass^{passK.k} 一致性
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <StatCard
                  label={`Pass^${passK.k}`}
                  value={pct(passK.passAtK)}
                  sub={`${passK.consistentGroups}/${passK.eligibleGroups} 组全过`}
                  tone={passK.passAtK === null ? 'neutral' : passK.passAtK >= 0.7 ? 'success' : 'danger'}
                />
                <StatCard label="单次通过率" value={pct(passK.singlePassRate)} sub="对照 flaky 程度" />
                <StatCard label="合格分组" value={String(passK.eligibleGroups)} sub={`≥${passK.k} 条样本`} />
              </div>
              {passK.eligibleGroups === 0 && (
                <p className="text-footnote text-ink-tertiary mt-2">
                  暂无合格分组: 需同一类问题 (kind + 归一化输入) 累计 ≥{passK.k} 条 trace。
                </p>
              )}
            </div>
          )}

          {reliability && (
            <div className="rounded-2xl bg-surface-1 shadow-soft-sm p-4">
              <div className="text-caption text-ink-secondary mb-2 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-brand-600" /> 可靠性衰退曲线 (RDC)
                {reliability.declineSlope !== null && (
                  <span className={`ml-2 text-footnote px-2 py-0.5 rounded-2xl ${reliability.declineSlope > 0.2 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                    衰退斜率 {(reliability.declineSlope * 100).toFixed(0)}pt
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {reliability.buckets.map((b) => (
                  <div key={b.bucket} className="flex items-center justify-between text-caption">
                    <span className="text-ink-secondary">{b.bucket}</span>
                    <span className="text-ink-tertiary">
                      {b.samples} 条 · 通过 {pct(b.passRate)} · GDS {b.gds === null ? '—' : (b.gds * 100).toFixed(0)} · 均 {b.avgRounds.toFixed(1)} 轮
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
