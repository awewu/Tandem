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
import { Gauge, ScrollText, Target, Play, Loader2, RefreshCw } from 'lucide-react';

type Tab = 'traces' | 'attributions' | 'regression';

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
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => {
    if (tab === 'traces') void loadTraces();
    else if (tab === 'attributions') void loadAttributions();
  }, [tab]);

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

      <div className="flex gap-1 mb-4 border-b border-ink-tertiary/15">
        {([
          { id: 'traces', label: 'Traces', icon: ScrollText },
          { id: 'attributions', label: 'Attributions', icon: Target },
          { id: 'regression', label: 'Regression', icon: Gauge },
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
    </div>
  );
}
