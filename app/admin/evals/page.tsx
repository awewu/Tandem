'use client';

/**
 * /admin/evals · Production Evals 看板 + on-demand run
 *
 * §SELF-USE-FIRST · Owner 一键跑评估, 看 CompanyBrain 输出质量.
 *
 * UI 完全 CHARTER-UI-V1 合规:
 *   - surface tokens (surface-1/2/3, ink-primary/secondary/tertiary)
 *   - shadow-soft-* (无 raw Tailwind shadow)
 *   - text-{title-2/headline/body/caption/footnote}
 *   - rounded-2xl cards
 *   - success/warning/danger 走 Tailwind semantic
 */

import { useEffect, useState } from 'react';
import { Sparkles, Play, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';

interface CaseResult {
  caseId: string;
  pass: boolean;
  score: number;
  reasoning: string;
  actualOutput: string;
  latencyMs: number;
  error?: string;
}

interface SuiteReport {
  suiteName: string;
  ranAt: string;
  durationMs: number;
  total: number;
  passed: number;
  avgScore: number;
  results: CaseResult[];
  failures: CaseResult[];
  meta: { runner: string; judge: string };
}

export default function EvalsPage() {
  const [report, setReport] = useState<SuiteReport | null>(null);
  const [lastRanAt, setLastRanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadLast() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/evals', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data.lastReport);
      setLastRanAt(data.lastRanAt);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/evals', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data.report);
      setLastRanAt(data.report?.ranAt ?? new Date().toISOString());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadLast();
  }, []);

  const passRate = report && report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
  const scorePct = report ? (report.avgScore * 100).toFixed(1) : '—';

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
      {/* Hero */}
      <section className="hero-ink p-6 sm:p-8">
        <div className="flex items-center gap-2 text-white/70 text-caption mb-3">
          <Sparkles className="h-4 w-4" />
          <span>Production Evals · LLM 输出质量看板</span>
        </div>
        <h1 className="text-title-1 text-white">CompanyBrain 评估</h1>
        <p className="mt-3 text-body" style={{ color: 'rgba(255,255,255,0.75)' }}>
          5 个 case 验证 BossAI 回答必含 OKR 锚点、不替员工签字、简洁、红区拒绝。
          一键跑, 看分数, 不绿就回头改 Persona / Memory。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className={
              'inline-flex items-center gap-2 rounded-full bg-white text-ink-primary ' +
              'px-4 py-2 text-caption font-semibold surface-interactive ' +
              'hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed'
            }
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 正在跑 evals...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> 立即跑 (耗时约 30s)
              </>
            )}
          </button>
          {lastRanAt && (
            <span className="text-footnote inline-flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <Clock className="h-3 w-3" />
              上次: {new Date(lastRanAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </section>

      {/* 错误条 */}
      {err && (
        <div className="rounded-2xl border-l-4 border-danger bg-danger/5 px-4 py-3 shadow-soft-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-danger mt-0.5" />
            <div className="min-w-0">
              <p className="text-headline text-ink-primary">出错</p>
              <p className="mt-1 text-caption text-ink-secondary">{err}</p>
            </div>
          </div>
        </div>
      )}

      {/* 总览 */}
      {loading && !report && (
        <div className="text-caption text-ink-tertiary">加载中...</div>
      )}

      {report && (
        <>
          {/* 总分卡 */}
          <section className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="通过率"
              value={`${passRate}%`}
              hint={`${report.passed} / ${report.total}`}
              tone={passRate >= 80 ? 'success' : passRate >= 60 ? 'warning' : 'danger'}
            />
            <KpiCard
              label="平均得分"
              value={`${scorePct}`}
              hint="0-100"
              tone={report.avgScore >= 0.8 ? 'success' : report.avgScore >= 0.6 ? 'warning' : 'danger'}
            />
            <KpiCard
              label="耗时"
              value={`${(report.durationMs / 1000).toFixed(1)}s`}
              hint={report.meta.judge}
              tone="info"
            />
          </section>

          {/* Case 列表 */}
          <section className="surface-card rounded-2xl shadow-soft-xs overflow-hidden">
            <header className="border-b px-5 py-3" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
              <h2 className="text-headline text-ink-primary">{report.suiteName}</h2>
              <p className="text-footnote text-ink-tertiary mt-0.5">{report.meta.runner}</p>
            </header>
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
              {report.results.map((r) => (
                <CaseRow key={r.caseId} r={r} />
              ))}
            </ul>
          </section>
        </>
      )}

      {!loading && !report && !err && (
        <div className="surface-card-soft rounded-2xl p-8 text-center shadow-soft-xs">
          <Sparkles className="h-8 w-8 mx-auto text-ink-tertiary mb-2" />
          <p className="text-body text-ink-secondary">还没跑过 evals</p>
          <p className="mt-1 text-caption text-ink-tertiary">点上面「立即跑」开始第一次</p>
        </div>
      )}
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
// 子组件
// ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneClass = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
  }[tone];
  return (
    <div className="surface-card rounded-2xl p-5 shadow-soft-xs">
      <div className="text-caption text-ink-secondary">{label}</div>
      <div className={`mt-2 text-title-1 tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-footnote text-ink-tertiary">{hint}</div>}
    </div>
  );
}

function CaseRow({ r }: { r: CaseResult }) {
  const [open, setOpen] = useState(false);
  const scoreColor = r.pass
    ? 'text-success'
    : r.score >= 0.5
      ? 'text-warning'
      : 'text-danger';
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-surface-2 surface-interactive"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background: r.pass
                  ? 'rgb(var(--semantic-success) / 0.1)'
                  : 'rgb(var(--semantic-danger) / 0.1)',
              }}>
          {r.pass ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-danger" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-body text-ink-primary font-medium truncate">{r.caseId}</p>
          <p className="mt-0.5 text-caption text-ink-secondary line-clamp-1">{r.reasoning}</p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-headline font-mono ${scoreColor}`}>
            {(r.score * 100).toFixed(0)}
          </div>
          <div className="text-footnote text-ink-tertiary">{r.latencyMs}ms</div>
        </div>
      </button>
      {open && (
        <div className="border-t bg-surface-2 px-5 py-3 text-caption space-y-2"
             style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <div>
            <span className="text-ink-tertiary">理由:</span>
            <span className="ml-2 text-ink-primary">{r.reasoning}</span>
          </div>
          <div>
            <span className="text-ink-tertiary">实际输出:</span>
            <pre className="mt-1 rounded-md bg-surface-1 p-2 text-footnote text-ink-primary whitespace-pre-wrap break-words"
                 style={{ border: '1px solid rgb(var(--border-subtle))' }}>
              {r.actualOutput || '(空)'}
            </pre>
          </div>
          {r.error && (
            <div className="rounded-md bg-danger/5 px-2 py-1 text-danger">
              异常: {r.error}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
