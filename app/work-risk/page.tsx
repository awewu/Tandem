'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Lock,
  MessageSquare,
  ShieldAlert,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import type { WorkRiskBoard, WorkRiskScope, WorkRiskSignal, WorkRiskSource } from '@/lib/work-risk/types';

const SCOPE_LABEL: Record<WorkRiskScope, string> = {
  self: '我自己',
  team: '我的团队',
  organization: '可见全部人员',
};

const SOURCE_ICON: Record<WorkRiskSource, typeof Target> = {
  okr: Target,
  calendar: CalendarDays,
  approval: Workflow,
  im: MessageSquare,
};

const SEVERITY_LABEL = {
  high: '高风险',
  medium: '预警',
  low: '关注',
} as const;

export default function WorkRiskPage() {
  return (
    <Suspense fallback={null}>
      <WorkRiskInner />
    </Suspense>
  );
}

function WorkRiskInner() {
  const searchParams = useSearchParams();
  const requestedScope = searchParams.get('scope') as WorkRiskScope | null;
  const initialScope =
    requestedScope === 'team' || requestedScope === 'organization' || requestedScope === 'self'
      ? requestedScope
      : 'self';
  const [scope, setScope] = useState<WorkRiskScope>(initialScope);
  const [board, setBoard] = useState<WorkRiskBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/work-risk?scope=${scope}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !data.ok) throw new Error(data?.error ?? '加载失败');
        setBoard(data.board);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const allowedScopes = board?.allowedScopes ?? ['self'];
  const groupedSignals = useMemo(() => {
    const groups = new Map<string, WorkRiskSignal[]>();
    for (const signal of board?.signals ?? []) {
      const key = signal.subjectUserId;
      groups.set(key, [...(groups.get(key) ?? []), signal]);
    }
    return Array.from(groups.entries()).map(([userId, signals]) => ({
      userId,
      name: signals[0]?.subjectName ?? userId,
      signals,
    }));
  }, [board]);

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-title-3 font-semibold text-ink-primary">
              <ShieldAlert className="h-6 w-6 text-warning" />
              AI 工作风险看板
            </h1>
            <p className="mt-1 text-caption text-ink-tertiary">
              按当前账号可见范围聚合 OKR、日程、流程审批、IM 工作安排风险
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-white p-1 shadow-soft-xs">
            {allowedScopes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`rounded-md px-3 py-1.5 text-caption transition ${
                  scope === item
                    ? 'bg-[rgb(var(--brand-500))] text-white'
                    : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
                }`}
              >
                {SCOPE_LABEL[item]}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-caption text-danger">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          <SummaryCard label="可见人员" value={board?.summary.peopleCount} icon={Users} />
          <SummaryCard label="风险事项" value={board?.summary.signalCount} icon={ShieldAlert} />
          <SummaryCard label="高风险" value={board?.summary.high} tone="danger" icon={AlertTriangle} />
          <SummaryCard label="预警" value={board?.summary.medium} tone="warning" icon={AlertTriangle} />
          <SummaryCard label="证据受限" value={board?.summary.restrictedEvidence} icon={Lock} />
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {(board?.sources ?? []).map((source) => {
            const Icon = SOURCE_ICON[source.source];
            return (
              <div key={source.source} className="rounded-lg border border-border bg-white p-4 shadow-soft-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-caption font-medium text-ink-primary">
                    <Icon className="h-4 w-4 text-ink-tertiary" />
                    {source.label}
                  </div>
                  <span className={`text-footnote ${source.enabled ? 'text-success' : 'text-ink-tertiary'}`}>
                    {source.enabled ? '已接入' : '待接入'}
                  </span>
                </div>
                <div className="mt-3 text-title-3 font-semibold text-ink-primary">{source.signalCount}</div>
                <p className="mt-1 text-footnote text-ink-tertiary">
                  {source.restrictedCount > 0 ? `${source.restrictedCount} 条证据受限` : '无受限证据'}
                </p>
              </div>
            );
          })}
        </section>

        <section className="rounded-lg border border-border bg-white shadow-soft-xs">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-headline text-ink-primary">风险明细</h2>
              <p className="text-footnote text-ink-tertiary">
                {board ? `${SCOPE_LABEL[board.scope]} · ${new Date(board.generatedAt).toLocaleString('zh-CN')}` : '加载中'}
              </p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="h-14 rounded-md bg-surface-2 animate-pulse" />
              <div className="h-14 rounded-md bg-surface-2 animate-pulse" />
            </div>
          ) : groupedSignals.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-10 text-caption text-ink-tertiary">
              <CheckCircle2 className="h-4 w-4 text-success" />
              当前可见范围内暂无风险信号。
            </div>
          ) : (
            <div className="divide-y divide-border">
              {groupedSignals.map((group) => (
                <div key={group.userId} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-caption font-medium text-ink-primary">{group.name}</div>
                    <div className="text-footnote text-ink-tertiary">{group.signals.length} 条</div>
                  </div>
                  <div className="space-y-2">
                    {group.signals.map((signal) => (
                      <RiskRow key={signal.id} signal={signal} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value?: number;
  icon: typeof Users;
  tone?: 'neutral' | 'danger' | 'warning';
}) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink-tertiary';
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-soft-xs">
      <div className="flex items-center justify-between">
        <p className="text-footnote text-ink-tertiary">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`mt-3 text-title-3 font-semibold ${tone === 'neutral' ? 'text-ink-primary' : color}`}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function RiskRow({ signal }: { signal: WorkRiskSignal }) {
  const Icon = SOURCE_ICON[signal.source];
  const severityClass =
    signal.severity === 'high'
      ? 'text-danger bg-danger/5 border-danger/20'
      : signal.severity === 'medium'
      ? 'text-warning bg-warning/5 border-warning/20'
      : 'text-ink-secondary bg-surface-2 border-border';
  const content = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">
        <Icon className="h-4 w-4 text-ink-tertiary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityClass}`}>
            {SEVERITY_LABEL[signal.severity]}
          </span>
          {signal.evidence.visibility === 'restricted' && (
            <span className="inline-flex items-center gap-1 text-footnote text-ink-tertiary">
              <Lock className="h-3 w-3" />
              证据受限
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-caption font-medium text-ink-primary">{signal.title}</p>
        <p className="mt-0.5 text-footnote text-ink-tertiary">{signal.detail}</p>
      </div>
    </div>
  );

  if (!signal.href) {
    return <div className="flex items-start gap-3 rounded-md border border-border bg-surface-1 p-3">{content}</div>;
  }

  return (
    <Link
      href={signal.href}
      className="flex items-start gap-3 rounded-md border border-border bg-surface-1 p-3 hover:border-[rgb(var(--brand-300))] hover:bg-surface-2 surface-interactive"
    >
      {content}
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-tertiary" />
    </Link>
  );
}
