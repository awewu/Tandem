'use client';

/**
 * /admin/company-brain · CompanyBrain 智能迭代看板 (CA-1 + CA-13)
 *
 * 4 个区块:
 *   1. 头部 — Persona 元数据 / 训练数据规模 / 路由配置
 *   2. Metrics — 采纳率 / 推翻率 / 平均成本 / 平均延迟 + byContext + byBrainVersion + 趋势
 *   3. Recent Decisions — 最近 20 条 CompanyBrain 输出
 *   4. Failure Patterns — Top 10 推翻原因关键词
 *
 * 数据源:
 *   GET /api/admin/company-brain               (CA-1 元数据)
 *   GET /api/admin/company-brain/metrics       (CA-13 度量)
 *   GET /api/admin/company-brain/decisions     (CA-13 历史)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Check,
  X,
  Target,
  ThumbsUp,
  Pencil,
  ThumbsDown,
} from 'lucide-react';

interface BrainHead {
  userId: string;
  personaId: string;
  persona: { name: string; stage: string };
  trainingData: { companyMemoryCount: number; sampleTitles: string[] };
  routing: { defaultScenario: string; primaryProvider?: string; fallbacks: string[]; registeredProviders: string[] };
  capabilities: Record<string, boolean>;
}

interface Bucket {
  total: number;
  adopted: number;
  modified: number;
  overruled: number;
  ignored: number;
  pending: number;
  adoptionRate: number;
  overruleRate: number;
  avgCostMicroUsd: number;
  avgLatencyMs: number;
  avgCostUsd: number;
}

interface MetricsReport {
  windowStart: string;
  windowEnd: string;
  overall: Bucket;
  byContext: Record<string, Bucket>;
  byBrainVersion: Record<string, Bucket>;
  dailyTrend: Array<{ date: string; total: number; adoptionRate: number; overruleRate: number }>;
  topFailurePatterns: Array<{ keyword: string; count: number; sampleDecisionIds: string[] }>;
  recentOverrules: Array<{ id: string; context: string; outputSummary: string; feedback: { reason?: string } }>;
}

interface DecisionLite {
  id: string;
  createdAt: string;
  context: string;
  inputSummary: string;
  outputSummary: string;
  modelUsed: string;
  costMicroUsd: number;
  latencyMs: number;
  feedback: { outcome: string; feedbackBy?: string; reason?: string };
  brainVersion: number;
}

const CTX_LABEL: Record<string, string> = {
  im_reply: 'IM 召唤',
  boss_ai_reply: 'BossAI 浮窗',
  baseline_arbitration: '灰区仲裁',
  meeting_advice: '议事建议',
  retrospective_draft: '7天后复盘',
  document_review: '文档评审',
  memory_promotion: 'Memory 升级',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function usd(microUsd: number): string {
  const u = microUsd / 10_000;
  return u < 0.01 ? `$${u.toFixed(4)}` : u < 1 ? `$${u.toFixed(3)}` : `$${u.toFixed(2)}`;
}

export default function CompanyBrainAdminPage() {
  const [head, setHead] = useState<BrainHead | null>(null);
  const [metrics, setMetrics] = useState<MetricsReport | null>(null);
  const [decisions, setDecisions] = useState<DecisionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, m, d] = await Promise.all([
          fetch('/api/admin/company-brain', { credentials: 'include' }).then((r) => r.json()),
          fetch('/api/admin/company-brain/metrics?windowDays=30', { credentials: 'include' }).then((r) => r.json()),
          fetch('/api/admin/company-brain/decisions?limit=20', { credentials: 'include' }).then((r) => r.json()),
        ]);
        setHead(h);
        setMetrics(m);
        setDecisions(d.decisions ?? []);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // §CA-13 补漏 (2026-06-09): admin 可在详情页直接给 pending 决策赋 feedback.
  //   最能受益的是 baseline_arbitration 记录 (无端用户 UI, 不靠 admin 手动就永远 pending).
  async function submitFeedback(decisionId: string, outcome: 'adopted' | 'modified' | 'overruled'): Promise<void> {
    const prev = decisions;
    // 乐观更新
    setDecisions(prev.map((d) => d.id === decisionId ? { ...d, feedback: { ...d.feedback, outcome } } : d));
    try {
      const res = await fetch('/api/company-brain/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decisionId, outcome }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // 回滚
      setDecisions(prev);
      setErr(`反馈失败: ${(e as Error).message}`);
      setTimeout(() => setErr(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载 CompanyBrain 看板...
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-8 text-rose-700">
        <AlertTriangle className="inline h-5 w-5" /> 加载失败: {err}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* 头部 */}
      <header className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50/40 p-6 ring-1 ring-violet-200/80">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-soft">
            <Brain className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-headline font-bold text-violet-900">
              🏛️ CompanyBrain · 中央 AI 看板
            </h1>
            <p className="mt-1 text-[12.5px] text-violet-700/80">
              {head?.persona.name} · 阶段 {head?.persona.stage} · {head?.trainingData.companyMemoryCount} 条公司层 Memory ·{' '}
              路由 <code className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-[11px]">{head?.routing.primaryProvider}</code>
              {head?.routing.fallbacks?.length ? ` → ${head.routing.fallbacks.join(' / ')}` : ''}
            </p>
            <p className="mt-1.5 text-[11px] text-violet-600/70">
              架构文档: <Link className="underline" href="/docs/CENTRAL-AI-ARCHITECTURE.md">CENTRAL-AI-ARCHITECTURE.md</Link> · 灵魂层:{' '}
              <Link className="underline" href="/docs/OKR-DRIVEN-ARCHITECTURE.md">OKR-DRIVEN-ARCHITECTURE.md</Link>
            </p>
          </div>
        </div>
      </header>

      {/* Overall KPIs */}
      {metrics && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="总输出" value={metrics.overall.total.toString()} hint="近 30 天" tone="slate" />
          <KpiCard
            label="采纳率"
            value={pct(metrics.overall.adoptionRate)}
            hint={`${metrics.overall.adopted + metrics.overall.modified} / ${metrics.overall.total - metrics.overall.pending}`}
            tone="emerald"
          />
          <KpiCard label="推翻率" value={pct(metrics.overall.overruleRate)} hint={`${metrics.overall.overruled} 条`} tone="rose" />
          <KpiCard label="待反馈" value={metrics.overall.pending.toString()} hint="7 天后自动 ignored" tone="amber" />
          <KpiCard label="平均成本" value={usd(metrics.overall.avgCostMicroUsd)} hint="单次调用" tone="indigo" />
          <KpiCard label="平均延迟" value={`${metrics.overall.avgLatencyMs} ms`} hint="单次调用" tone="indigo" />
        </section>
      )}

      {/* byContext */}
      {metrics && Object.keys(metrics.byContext).length > 0 && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-3 flex items-center gap-2 text-caption font-bold text-slate-800">
            <TrendingUp className="h-4 w-4 text-violet-600" /> 按场景分桶
          </h2>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-1.5 font-medium">场景</th>
                <th className="font-medium">总数</th>
                <th className="font-medium">采纳率</th>
                <th className="font-medium">推翻率</th>
                <th className="font-medium">平均成本</th>
                <th className="font-medium">平均延迟</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byContext).map(([ctx, b]) => (
                <tr key={ctx} className={`border-b last:border-0 ${b.total === 0 ? 'opacity-40' : ''}`}>
                  <td className="py-1.5 font-medium text-slate-700">{CTX_LABEL[ctx] ?? ctx}</td>
                  <td className="text-slate-600">{b.total}</td>
                  <td className="text-emerald-700">{pct(b.adoptionRate)}</td>
                  <td className="text-rose-700">{pct(b.overruleRate)}</td>
                  <td className="text-slate-600">{usd(b.avgCostMicroUsd)}</td>
                  <td className="text-slate-600">{b.avgLatencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* byBrainVersion + dailyTrend  */}
      {metrics && (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <h2 className="mb-3 text-caption font-bold text-slate-800">按版本对比</h2>
            {Object.keys(metrics.byBrainVersion).length === 0 ? (
              <p className="text-[12px] text-slate-400">暂无数据</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-1.5 font-medium">版本</th>
                    <th className="font-medium">总数</th>
                    <th className="font-medium">采纳率</th>
                    <th className="font-medium">推翻率</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.byBrainVersion).map(([v, b]) => (
                    <tr key={v} className="border-b last:border-0">
                      <td className="py-1.5 font-mono text-slate-700">{v}</td>
                      <td className="text-slate-600">{b.total}</td>
                      <td className="text-emerald-700">{pct(b.adoptionRate)}</td>
                      <td className="text-rose-700">{pct(b.overruleRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <h2 className="mb-3 text-caption font-bold text-slate-800">近 30 天采纳率趋势</h2>
            <div className="flex h-24 items-end gap-[2px]">
              {metrics.dailyTrend.map((d, i) => {
                const h = d.total > 0 ? Math.max(6, d.adoptionRate * 100) : 4;
                return (
                  <div
                    key={d.date}
                    className={`flex-1 rounded-t ${d.total > 0 ? 'bg-emerald-400' : 'bg-slate-100'}`}
                    style={{ height: `${h}%` }}
                    title={`${d.date} · 总 ${d.total} · 采纳率 ${pct(d.adoptionRate)} · 推翻率 ${pct(d.overruleRate)}`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{metrics.dailyTrend[0]?.date}</span>
              <span>{metrics.dailyTrend[metrics.dailyTrend.length - 1]?.date}</span>
            </div>
          </section>
        </div>
      )}

      {/* topFailurePatterns */}
      {metrics && metrics.topFailurePatterns.length > 0 && (
        <section className="rounded-2xl bg-warning/5/40 p-5 ring-1 ring-warning/20/60">
          <h2 className="mb-3 flex items-center gap-2 text-caption font-bold text-warning">
            <AlertTriangle className="h-4 w-4" /> Top 推翻原因关键词
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {metrics.topFailurePatterns.map((p) => (
              <span
                key={p.keyword}
                className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-warning ring-1 ring-warning/30/80"
                title={`样本: ${p.sampleDecisionIds.join(', ')}`}
              >
                {p.keyword} <span className="text-warning">×{p.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Recent Decisions */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <h2 className="mb-3 text-caption font-bold text-slate-800">最近 20 条决策</h2>
        {decisions.length === 0 ? (
          <p className="text-[12px] text-slate-400">
            暂无数据. 在 IM 里 @CompanyBrain 触发首次记录.
          </p>
        ) : (
          <ul className="divide-y">
            {decisions.map((d) => (
              <li key={d.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-violet-700">
                        {CTX_LABEL[d.context] ?? d.context}
                      </span>
                      <span>·</span>
                      <span>{new Date(d.createdAt).toLocaleString('zh-CN')}</span>
                      <span>·</span>
                      <span className="font-mono text-[10.5px] text-slate-400">{d.modelUsed}</span>
                      <span>·</span>
                      <span className="text-slate-500">{usd(d.costMicroUsd)} / {d.latencyMs}ms</span>
                    </div>
                    <p className="mt-1 truncate text-[12.5px] text-slate-700">
                      <span className="text-slate-400">Q:</span> {d.inputSummary}
                    </p>
                    <p className="truncate text-[12.5px] text-slate-600">
                      <span className="text-slate-400">A:</span> {d.outputSummary}
                    </p>
                    {d.feedback.reason && (
                      <p className="mt-1 truncate text-[11.5px] italic text-rose-600">
                        反馈: {d.feedback.reason}
                      </p>
                    )}
                    {d.feedback.outcome === 'pending' && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void submitFeedback(d.id, 'adopted')}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-emerald-700 ring-1 ring-emerald-300/60 hover:bg-emerald-50"
                        >
                          <ThumbsUp className="h-2.5 w-2.5" /> 采纳
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitFeedback(d.id, 'modified')}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-warning ring-1 ring-warning/30/60 hover:bg-warning/5"
                        >
                          <Pencil className="h-2.5 w-2.5" /> 修改
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitFeedback(d.id, 'overruled')}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-rose-700 ring-1 ring-rose-300/60 hover:bg-rose-50"
                        >
                          <ThumbsDown className="h-2.5 w-2.5" /> 推翻
                        </button>
                      </div>
                    )}
                  </div>
                  <OutcomeBadge outcome={d.feedback.outcome} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* CA-13 + ON-3 · 月度反思报告 (生成 / 签批 / OKR 优化提议处置) */}
      <ReflectionSection />

      <footer className="pt-2 text-center text-[10.5px] text-slate-400">
        §CA-13 (CENTRAL-AI-ARCHITECTURE.md) · 灵魂层第6条 闭环互动相互赋能 · {metrics?.windowStart.slice(0, 10)} → {metrics?.windowEnd.slice(0, 10)}
      </footer>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'slate' | 'emerald' | 'rose' | 'amber' | 'indigo';
}) {
  const toneClass = {
    slate: 'bg-white text-slate-800 ring-slate-200',
    emerald: 'bg-emerald-50/50 text-emerald-900 ring-emerald-200',
    rose: 'bg-rose-50/50 text-rose-900 ring-rose-200',
    amber: 'bg-warning/5/50 text-warning ring-warning/20',
    indigo: 'bg-indigo-50/50 text-indigo-900 ring-indigo-200',
  }[tone];

  return (
    <div className={`rounded-2xl p-4 ring-1 ${toneClass}`}>
      <div className="text-[10.5px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-headline font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10.5px] opacity-60">{hint}</div>
    </div>
  );
}

interface OptimizationProposal {
  id: string;
  kind: string;
  title: string;
  targetType: string;
  targetId: string;
  metrics: { progressPct: number; confidence: string };
  recommendation: string;
  rationale: string;
  status: 'pending' | 'acknowledged' | 'dismissed';
  promotionRequestId?: string;
}

interface ReflectionReport {
  id: string;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  metricsSummary: { decisionsCount: number; adoptionRate: number; overruleRate: number };
  strengths: string[];
  failurePatterns: Array<{ pattern: string; suggestedFix: string }>;
  proposedChanges: {
    rationale: string;
    baselineThresholdsDiff?: { hardBlock?: number; softWarn?: number };
    topKMemoriesInjectedDiff?: number;
  };
  optimizationProposals?: OptimizationProposal[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalBy?: string;
  resultingVersionId?: string;
}

function confidenceTone(c: string): string {
  if (c === 'off-track') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (c === 'at-risk') return 'bg-warning/10 text-warning ring-warning/30';
  return 'bg-slate-50 text-slate-600 ring-slate-200';
}

function ReflectionSection() {
  const [reports, setReports] = useState<ReflectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/admin/company-brain/reflection?limit=10', {
        credentials: 'include',
      }).then((r) => r.json());
      setReports(res.reports ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function upsert(report: ReflectionReport) {
    setReports((prev) => {
      const next = prev.filter((r) => r.id !== report.id);
      return [report, ...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  async function generate() {
    setBusy('generate');
    setErr(null);
    try {
      const res = await fetch('/api/admin/company-brain/reflection', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ useLlm: false }),
      }).then((r) => r.json());
      if (res.ok && res.report) upsert(res.report);
      else setErr(res.reason ?? '生成失败 (窗口内可能无决策)');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function approve(reportId: string, ok: boolean) {
    setBusy(`approve_${reportId}`);
    try {
      const res = await fetch('/api/admin/company-brain/reflection', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId, approve: ok }),
      }).then((r) => r.json());
      if (res.ok && res.report) upsert(res.report);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disposeProposal(
    reportId: string,
    proposalId: string,
    status: 'acknowledged' | 'dismissed',
  ) {
    setBusy(`prop_${proposalId}`);
    try {
      const res = await fetch('/api/admin/company-brain/reflection/proposal', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId, proposalId, status }),
      }).then((r) => r.json());
      if (res.ok && res.report) upsert(res.report);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-caption font-bold text-slate-800">
          <Sparkles className="h-4 w-4 text-violet-600" /> 月度反思 · 优化提议
          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
            CA-13 + ON-3
          </span>
        </h2>
        <button
          onClick={generate}
          disabled={busy === 'generate'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {busy === 'generate' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          生成反思
        </button>
      </div>

      <p className="mb-3 text-[11px] text-slate-500">
        中央 AI 以<strong>参谋</strong>身份产出建议: 一类调<em>自身配置</em>(签批后即生效为新版本),
        一类是<em>组织 OKR 优化方向</em>(仅供治理决策, 处置<strong>绝不</strong>自动改 OKR)。
      </p>

      {err && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">{err}</p>
      )}

      {loading ? (
        <p className="text-[12px] text-slate-400">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> 加载反思报告...
        </p>
      ) : reports.length === 0 ? (
        <p className="text-[12px] text-slate-400">
          暂无反思报告. 点「生成反思」基于近 30 天决策 + OKR 健康生成一份.
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl bg-slate-50/60 p-4 ring-1 ring-slate-200/60">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  <span className="font-mono">{r.id}</span> ·{' '}
                  {new Date(r.createdAt).toLocaleString('zh-CN')} · 决策{' '}
                  {r.metricsSummary.decisionsCount} · 采纳 {pct(r.metricsSummary.adoptionRate)} · 推翻{' '}
                  {pct(r.metricsSummary.overruleRate)}
                </div>
                <ApprovalBadge status={r.approvalStatus} />
              </div>

              {/* 配置调整建议 (调 AI 自己) */}
              {r.proposedChanges.rationale && (
                <div className="mt-2 rounded-lg bg-white p-3 text-[11.5px] ring-1 ring-slate-200/70">
                  <div className="mb-1 font-semibold text-slate-700">自身配置调整建议</div>
                  <p className="whitespace-pre-wrap text-slate-600">{r.proposedChanges.rationale}</p>
                  {(r.proposedChanges.baselineThresholdsDiff ||
                    typeof r.proposedChanges.topKMemoriesInjectedDiff === 'number') && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.proposedChanges.baselineThresholdsDiff?.hardBlock !== undefined && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10.5px] text-indigo-700">
                          hardBlock → {r.proposedChanges.baselineThresholdsDiff.hardBlock}
                        </span>
                      )}
                      {typeof r.proposedChanges.topKMemoriesInjectedDiff === 'number' && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10.5px] text-indigo-700">
                          topK → {r.proposedChanges.topKMemoriesInjectedDiff}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ON-3 · OKR 优化方向提议 (组织层, advisory) */}
              {r.optimizationProposals && r.optimizationProposals.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-700">
                    <Target className="h-3.5 w-3.5 text-rose-500" /> OKR 优化方向提议 (参谋建议 · 不自动改 OKR)
                  </div>
                  <ul className="space-y-2">
                    {r.optimizationProposals.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-lg bg-white p-3 text-[11.5px] ring-1 ring-slate-200/70"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-800">{p.title}</span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${confidenceTone(
                                  p.metrics.confidence,
                                )}`}
                              >
                                {p.metrics.confidence} · {p.metrics.progressPct}%
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600">{p.recommendation}</p>
                            <p className="mt-0.5 text-[10.5px] text-slate-400">{p.rationale}</p>
                            {p.promotionRequestId && (
                              <a
                                href="/admin/steward"
                                className="mt-1 inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200/70 hover:bg-violet-100"
                                title={`Memory 升级签批 ${p.promotionRequestId}`}
                              >
                                <ExternalLink className="h-2.5 w-2.5" /> 已发起 Memory 沉淀 · 去三级签批台账
                              </a>
                            )}
                          </div>
                          {p.status === 'pending' ? (
                            <div className="flex shrink-0 gap-1">
                              <button
                                onClick={() => disposeProposal(r.id, p.id, 'acknowledged')}
                                disabled={busy === `prop_${p.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Check className="h-3 w-3" /> 采纳关注
                              </button>
                              <button
                                onClick={() => disposeProposal(r.id, p.id, 'dismissed')}
                                disabled={busy === `prop_${p.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-[10.5px] font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                              >
                                <X className="h-3 w-3" /> 不予处理
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                p.status === 'acknowledged'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {p.status === 'acknowledged' ? '已采纳关注' : '已不予处理'}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 报告签批 (自身配置类) */}
              {r.approvalStatus === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => approve(r.id, true)}
                    disabled={busy === `approve_${r.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> 签批通过 (应用配置)
                  </button>
                  <button
                    onClick={() => approve(r.id, false)}
                    disabled={busy === `approve_${r.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> 拒绝
                  </button>
                </div>
              )}
              {r.resultingVersionId && (
                <p className="mt-2 text-[10.5px] text-emerald-700">
                  已生成新版本: <span className="font-mono">{r.resultingVersionId}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApprovalBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const map = {
    pending: { bg: 'bg-warning/10', text: 'text-warning', label: '待签批' },
    approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '已签批' },
    rejected: { bg: 'bg-slate-100', text: 'text-slate-500', label: '已拒绝' },
  }[status];
  return (
    <span className={`shrink-0 rounded-full ${map.bg} px-2 py-0.5 text-[10.5px] font-semibold ${map.text}`}>
      {map.label}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-slate-100', text: 'text-slate-600', label: '待反馈' },
    adopted: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '采纳' },
    modified: { bg: 'bg-warning/10', text: 'text-warning', label: '修改' },
    overruled: { bg: 'bg-rose-100', text: 'text-rose-800', label: '推翻' },
    ignored: { bg: 'bg-slate-100', text: 'text-slate-500', label: '忽略' },
  };
  const c = map[outcome] ?? map.pending;
  return (
    <span className={`shrink-0 rounded-full ${c.bg} px-2 py-0.5 text-[10.5px] font-semibold ${c.text}`}>
      {c.label}
    </span>
  );
}
