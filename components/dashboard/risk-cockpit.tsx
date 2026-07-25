'use client';

/**
 * <RiskCockpit /> — 首页置顶 AI 工作风险驾驶舱
 *
 * 入口展示当前账号可见范围内的风险摘要, 具体范围和证据粒度由 /api/work-risk 裁剪。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import type { WorkRiskBoard, WorkRiskScope } from '@/lib/work-risk/types';

const SCOPE_LABEL: Record<WorkRiskScope, string> = {
  self: '我自己',
  team: '我的团队',
  organization: '可见全部人员',
};

function broadestScope(scopes: WorkRiskScope[]): WorkRiskScope {
  if (scopes.includes('organization')) return 'organization';
  if (scopes.includes('team')) return 'team';
  return 'self';
}

export function RiskCockpit() {
  const [board, setBoard] = useState<WorkRiskBoard | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const first = await fetch('/api/work-risk?scope=self', { credentials: 'include', cache: 'no-store' });
        const firstData = await first.json();
        if (!first.ok || !firstData.ok) return;
        const preferred = broadestScope(firstData.board.allowedScopes);
        if (preferred === 'self') {
          if (!cancelled) setBoard(firstData.board);
          return;
        }
        const next = await fetch(`/api/work-risk?scope=${preferred}`, { credentials: 'include', cache: 'no-store' });
        const nextData = await next.json();
        if (!cancelled) setBoard(next.ok && nextData.ok ? nextData.board : firstData.board);
      } catch {
        if (!cancelled) setBoard(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!board || board.summary.peopleCount === 0) {
    return null;
  }

  if (board.summary.signalCount === 0) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 text-success shrink-0" />
        <span className="text-caption text-success">
          AI 工作风险扫描:{SCOPE_LABEL[board.scope]}暂无风险信号 · {board.summary.peopleCount} 人可见
        </span>
        <Link
          href={`/work-risk?scope=${board.scope}`}
          className="ml-auto text-footnote text-success hover:text-success inline-flex items-center gap-1 shrink-0"
        >
          工作风险看板 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card-elevated p-4 ring-1 ring-warning/20">
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-9 w-9 rounded-md bg-warning/10 flex items-center justify-center">
          <ShieldAlert className="h-4 w-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-headline text-ink-primary flex items-center gap-2">
              AI 风险扫描
              <span className="text-footnote font-normal text-ink-tertiary">
                · {SCOPE_LABEL[board.scope]} · {board.summary.peopleCount} 人可见
              </span>
            </div>
            <Link
              href={`/work-risk?scope=${board.scope}`}
              className="text-caption text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 shrink-0"
            >
              工作风险看板 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-2 flex items-center gap-x-5 gap-y-1.5 flex-wrap text-caption">
            <Metric value={board.summary.high} label="高风险" tone="danger" />
            <Metric value={board.summary.medium} label="预警" tone="warning" />
            <Metric value={board.sources.find((s) => s.source === 'okr')?.signalCount ?? 0} label="OKR/行动项" tone="warning" icon={Clock} />
            <span className="text-ink-tertiary">
              证据受限 <strong className="text-ink-secondary">{board.summary.restrictedEvidence}</strong>
            </span>
            <span className="text-ink-tertiary">
              已接入来源 <strong className="text-ink-secondary">{board.sources.filter((s) => s.enabled).length}</strong>
            </span>
          </div>

          {board.signals.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {board.signals.slice(0, 3).map((r) => (
                <li key={r.id} className="flex min-w-0 items-center gap-2 text-caption">
                  <AlertTriangle
                    className={`h-3.5 w-3.5 shrink-0 ${r.severity === 'high' ? 'text-danger' : 'text-warning'}`}
                  />
                  {r.href ? (
                    <Link href={r.href} className="text-ink-primary hover:text-brand-600 truncate">
                      {r.title}
                    </Link>
                  ) : (
                    <span className="text-ink-primary truncate">{r.title}</span>
                  )}
                  <span className="text-ink-tertiary shrink-0">· {r.subjectName}</span>
                  <span className="ml-auto text-footnote text-ink-tertiary shrink-0">
                    {r.evidence.visibility === 'restricted' ? '证据受限' : r.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  value, label, tone, icon: Icon,
}: {
  value: number;
  label: string;
  tone: 'danger' | 'warning';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const color = tone === 'danger' ? 'text-danger' : 'text-warning';
  return (
    <span className="inline-flex items-center gap-1 text-ink-tertiary">
      {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
      <strong className={`text-body font-semibold ${value > 0 ? color : 'text-ink-secondary'}`}>{value}</strong>
      {label}
    </span>
  );
}
