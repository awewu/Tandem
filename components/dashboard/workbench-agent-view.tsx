'use client';

/**
 * EVO-10 · Workbench Agent View
 *
 * 设计取自 Claude Code Agent View (2026-04-30 Anthropic 官方 multi-session 仪表盘):
 *   - Waiting (阻塞我的) 永远排第一
 *   - 一行一个待办 · 一眼看状态 · 一键直达
 *   - 永远以 "我" 视角, 永不显示给上级或同事
 *
 * Tandem 化:
 *   - 聚合 6 类待办 (1on1 / 议事 / OKR / 复盘 / Memory 签字 / Persona 升阶)
 *   - 全部来自现有 endpoints, 0 schema 改动
 *   - 严守 MANIFESTO §13: 这是"提示我做主"的表, 不是"老板看下属"的表
 *
 * 与 /api/me/dashboard + /api/me/retro-pending 关系:
 *   - 现有端点保持不变
 *   - 此组件做客户端聚合 + 重排
 *   - 失败静默 (任一端点挂掉不影响其他类)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Target,
  Stamp,
  Clock,
  History,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';

// ===========================================================================
// 类型
// ===========================================================================

type RowState = 'waiting' | 'running' | 'done';

type RowKind =
  | 'memory-signature'
  | 'persona-upgrade'
  | 'kr-at-risk'
  | 'tti-progress'
  | 'veto-window'
  | 'retro-pending';

interface AgentRow {
  /** 稳定 key */
  id: string;
  kind: RowKind;
  state: RowState;
  /** 行标题 (≤ 36 字, 祈使句优先) */
  title: string;
  /** 一行 context (说为什么需要我) */
  preview: string;
  /** 上次活动 / 剩余时间 */
  meta?: string;
  /** 跳转目标 */
  href: string;
  /** 行动按钮文案 */
  actionLabel: string;
  /** 排序权重 (越小越靠前) */
  weight: number;
}

// ===========================================================================
// 数据契约 (镜像现有 /api/me/dashboard 响应字段)
// ===========================================================================

interface MeDashboard {
  todos: {
    promotionsAwaitingMySignature: Array<{
      id: string;
      title: string;
      level: string;
      slaDeadline?: string | null;
      overdue: boolean;
    }>;
    personaUpgradeAvailable: {
      fromStage: string;
      toStage: string;
      bossCaptureScore: number;
    } | null;
    myKrAtRisk: Array<{
      id: string;
      title: string;
      riskStatus: string;
      progress: number;
    }>;
    myTtiInProgress: Array<{ id: string; title: string; completionRate: number }>;
    myRecentCommitsInVetoWindow: Array<{
      id: string;
      title: string;
      remainingMs: number;
    }>;
    totalCount: number;
  };
}

interface PendingRetros {
  items: Array<{
    decisionId: string;
    title: string;
    decisionClass: string;
    daysSinceCommit: number;
    urgency: 'due' | 'overdue';
  }>;
  total: number;
}

// ===========================================================================
// 渲染辅助
// ===========================================================================

const KIND_ICON: Record<RowKind, { icon: typeof Sparkles; tint: string }> = {
  'memory-signature': { icon: Stamp, tint: 'text-purple-600' },
  'persona-upgrade': { icon: TrendingUp, tint: 'text-brand-600' },
  'kr-at-risk': { icon: AlertCircle, tint: 'text-rose-600' },
  'tti-progress': { icon: Target, tint: 'text-blue-600' },
  'veto-window': { icon: Clock, tint: 'text-amber-600' },
  'retro-pending': { icon: History, tint: 'text-emerald-600' },
};

const STATE_BADGE: Record<
  RowState,
  { label: string; cls: string; dot: string }
> = {
  waiting: {
    label: 'Waiting',
    cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30',
    dot: 'bg-rose-500',
  },
  running: {
    label: 'Running',
    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30',
    dot: 'bg-amber-500 animate-pulse',
  },
  done: {
    label: 'Done',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30',
    dot: 'bg-emerald-500',
  },
};

function fmtRemainingMs(ms: number): string {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h${m}min 内可撤回`;
  return `${m}min 内可撤回`;
}

// ===========================================================================
// 聚合: 多个 API → AgentRow[]
// ===========================================================================

function aggregate(
  dash: MeDashboard | null,
  retros: PendingRetros | null,
): AgentRow[] {
  const rows: AgentRow[] = [];
  if (!dash) return rows;
  const t = dash.todos;

  // 1) Memory 签字 (Waiting · 高优)
  for (const p of t.promotionsAwaitingMySignature) {
    rows.push({
      id: `mem-${p.id}`,
      kind: 'memory-signature',
      state: 'waiting',
      title: `签字 · ${p.title}`,
      preview: `Memory 提升至 ${p.level}, 等你签字`,
      meta: p.overdue ? 'SLA 已逾期' : p.slaDeadline ? `SLA 到 ${new Date(p.slaDeadline).toLocaleDateString('zh-CN')}` : undefined,
      href: `/memories?id=${p.id}`,
      actionLabel: '去签字',
      weight: p.overdue ? 0 : 5,
    });
  }

  // 2) Persona 升阶 (Waiting · 个人成长)
  if (t.personaUpgradeAvailable) {
    rows.push({
      id: 'persona-upgrade',
      kind: 'persona-upgrade',
      state: 'waiting',
      title: `搭子升级 · ${t.personaUpgradeAvailable.fromStage} → ${t.personaUpgradeAvailable.toStage}`,
      preview: `拿捏老板分 ${t.personaUpgradeAvailable.bossCaptureScore} · 你确认是否升阶`,
      href: '/persona',
      actionLabel: '确认',
      weight: 10,
    });
  }

  // 3) 复盘待办 (EVO-1) — Waiting
  if (retros) {
    for (const r of retros.items) {
      rows.push({
        id: `retro-${r.decisionId}`,
        kind: 'retro-pending',
        state: 'waiting',
        title: `复盘 · ${r.title}`,
        preview: `决议落地 ${r.daysSinceCommit} 天 · 还没复盘`,
        meta: r.urgency === 'overdue' ? '建议尽快' : '到节奏窗口',
        href: `/convergence/${r.decisionId}`,
        actionLabel: '写复盘',
        weight: r.urgency === 'overdue' ? 3 : 12,
      });
    }
  }

  // 4) 否决窗口 (Running · 时效性强)
  for (const v of t.myRecentCommitsInVetoWindow) {
    rows.push({
      id: `veto-${v.id}`,
      kind: 'veto-window',
      state: 'running',
      title: `撤回窗 · ${v.title}`,
      preview: '决议刚提交, 你有 24h 否决权',
      meta: fmtRemainingMs(v.remainingMs),
      href: `/convergence/${v.id}`,
      actionLabel: '查看',
      weight: 20,
    });
  }

  // 5) KR at risk (Running · 跟踪)
  for (const k of t.myKrAtRisk) {
    rows.push({
      id: `kr-${k.id}`,
      kind: 'kr-at-risk',
      state: 'running',
      title: `KR · ${k.title}`,
      preview: `进度 ${Math.round(k.progress * 100)}% · 风险 ${k.riskStatus}`,
      href: `/okr?kr=${k.id}`,
      actionLabel: '去 Check-in',
      weight: 25,
    });
  }

  // 6) TTI 进行中 (Running · 跟踪)
  for (const tti of t.myTtiInProgress) {
    rows.push({
      id: `tti-${tti.id}`,
      kind: 'tti-progress',
      state: 'running',
      title: `TTI · ${tti.title}`,
      preview: `推进 ${Math.round(tti.completionRate * 100)}% · 持续跟进`,
      href: '/okr',
      actionLabel: '查看',
      weight: 30,
    });
  }

  return rows.sort((a, b) => {
    // state 优先级: waiting > running > done
    const stateOrder = { waiting: 0, running: 1, done: 2 };
    if (a.state !== b.state) return stateOrder[a.state] - stateOrder[b.state];
    return a.weight - b.weight;
  });
}

// ===========================================================================
// 组件
// ===========================================================================

export function WorkbenchAgentView() {
  const userId = useCurrentUserId();
  const [dash, setDash] = useState<MeDashboard | null>(null);
  const [retros, setRetros] = useState<PendingRetros | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/me/dashboard?userId=${encodeURIComponent(userId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/me/retro-pending')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([d, r]) => {
      if (cancelled) return;
      setDash(d);
      setRetros(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const rows = useMemo(() => aggregate(dash, retros), [dash, retros]);
  const waitingCount = rows.filter((r) => r.state === 'waiting').length;
  const runningCount = rows.filter((r) => r.state === 'running').length;

  if (loading) {
    return (
      <div className="card-elevated p-6 text-center text-caption text-ink-tertiary">
        加载我的工作流...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card-elevated p-8 text-center space-y-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="text-body text-ink-primary font-medium">
          没有 Waiting · 没有 Running
        </p>
        <p className="text-footnote text-ink-tertiary">
          所有工作流都在轨上. 享受这一刻的清静.
        </p>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      {/* 头部统计 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface-2/40">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <h3 className="text-callout text-ink-primary font-medium">
          我的多线工作
        </h3>
        <span className="text-footnote text-ink-tertiary">
          {waitingCount > 0 && (
            <span className="text-rose-700">{waitingCount} Waiting</span>
          )}
          {waitingCount > 0 && runningCount > 0 && <span> · </span>}
          {runningCount > 0 && (
            <span className="text-amber-700">{runningCount} Running</span>
          )}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-ink-tertiary font-mono uppercase tracking-wider">
          EVO-10
        </span>
      </div>

      {/* 行列表 */}
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const meta = KIND_ICON[r.kind];
          const badge = STATE_BADGE[r.state];
          const Icon = meta.icon;
          return (
            <li key={r.id}>
              <Link
                href={r.href}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors duration-fast group"
              >
                {/* 状态徽标 */}
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>

                {/* 类型 icon */}
                <Icon className={`h-4 w-4 shrink-0 ${meta.tint}`} />

                {/* 主体 */}
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-primary truncate">
                    {r.title}
                  </p>
                  <p className="mt-0.5 text-footnote text-ink-tertiary truncate">
                    {r.preview}
                    {r.meta && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{r.meta}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* 行动按钮 */}
                <span className="shrink-0 inline-flex items-center gap-1 text-caption text-brand-600 group-hover:text-brand-700 font-medium opacity-90 group-hover:opacity-100">
                  {r.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 脚注 */}
      <div className="px-5 py-2 text-footnote text-ink-tertiary bg-surface-2/30 flex items-center gap-1.5">
        <CircleDot className="h-3 w-3" />
        永远以你的视角. 同事和上级看不到这张表.
      </div>
    </div>
  );
}
