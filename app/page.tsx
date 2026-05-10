'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Target,
  Clock3,
  Brain,
  ArrowRight,
  Megaphone,
  FileLock,
  PartyPopper,
  Gift,
  LayoutGrid,
  Briefcase,
  MessagesSquare,
  GraduationCap,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';

/**
 * Homepage — 4-section layout per UI-IA §2:
 *   1. 我的工作台 (Workbench, real data from /api/dashboard/stats)
 *   2. 企业内网 (Intranet, M3 placeholder)
 *   3. 快速跳板 (Launchpad, M2 placeholder)
 *   4. IM 摘要 / 议事预告 (real recent decisions)
 *
 * Design: Apple/MS aesthetic — generous whitespace, soft shadows,
 * semantic motion, system font stack, glass surfaces.
 */

interface DashboardStats {
  decisionCards: {
    total: number;
    committed: number;
    escalated: number;
    vetoed: number;
    inTimeRate: number;
    dRate: number;
  };
  memories: { total: number; byType: { sop: number; case: number; redline: number; value: number } };
  okr: { objectives: number; keyResults: number; keyResultsOnTrack: number; ttis: number };
  personas: { total: number; byStage: Record<string, number> };
  recentDecisions: Array<{
    id: string;
    title: string;
    state: string;
    elapsedSeconds: number;
    selected?: string;
    createdAt: string;
  }>;
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 15000);
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  const greeting = greetingForHour(now.getHours());
  const weekday = now.toLocaleDateString('zh-CN', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

  const krOnTrackRate =
    stats && stats.okr.keyResults > 0
      ? Math.round((stats.okr.keyResultsOnTrack / stats.okr.keyResults) * 100)
      : null;

  const inTimePct = stats ? Math.round(stats.decisionCards.inTimeRate * 100) : null;

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-surface-1 to-surface-2/50">
      <div className="page-container py-10 space-y-12">
        {/* ──────────── Header ──────────── */}
        <header className="animate-fade-in-up">
          <p className="text-caption text-ink-tertiary">
            {dateStr} · {weekday}
          </p>
          <h1 className="mt-1 text-title-1 text-ink-primary">
            {greeting}
          </h1>
          <p className="mt-2 text-body text-ink-secondary">
            Tandem 牛马搭子 · 17 分钟达成共识. 今天专注 1-2 件真正重要的事就好.
          </p>
        </header>

        {/* ──────────── §1 我的工作台 ──────────── */}
        <section className="space-y-4">
          <SectionHeader
            title="我的工作台"
            subtitle="今日待办 · KR 进度 · 议事 · 日报"
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <WorkbenchCard
              icon={Sparkles}
              tone="brand"
              label="议事室决议"
              value={stats?.decisionCards.total ?? '—'}
              hint={
                stats
                  ? `${stats.decisionCards.committed} 已成 · ${stats.decisionCards.escalated} 升级`
                  : '加载中...'
              }
              href="/convergence"
            />
            <WorkbenchCard
              icon={Clock3}
              tone="success"
              label="17 分钟达成率"
              value={inTimePct !== null ? `${inTimePct}%` : '—'}
              hint={`目标 ≥ 70% · D 选项 ${stats ? Math.round(stats.decisionCards.dRate * 100) : 0}%`}
              href="/convergence"
            />
            <WorkbenchCard
              icon={Target}
              tone="info"
              label="KR 健康"
              value={krOnTrackRate !== null ? `${krOnTrackRate}%` : '—'}
              hint={
                stats
                  ? `${stats.okr.keyResultsOnTrack} / ${stats.okr.keyResults} 在轨 · ${stats.okr.objectives} O`
                  : '加载中...'
              }
              href="/okr"
            />
            <WorkbenchCard
              icon={Brain}
              tone="persona"
              label="Memory 知识"
              value={stats?.memories.total ?? '—'}
              hint={
                stats
                  ? `${stats.memories.byType.sop} SOP · ${stats.memories.byType.case} 案例 · ${stats.memories.byType.redline} 红线`
                  : '加载中...'
              }
              href="/memories"
            />
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <QuickAction href="/convergence" icon={Sparkles}>
              发起议事
            </QuickAction>
            <QuickAction href="/report" icon={Clock3} muted>
              写 5min 日报
            </QuickAction>
            <QuickAction href="/okr" icon={Target} muted>
              查我的 KR
            </QuickAction>
            <QuickAction href="/im" icon={MessagesSquare} muted>
              IM 协同
            </QuickAction>
          </div>
        </section>

        {/* ──────────── §2 企业内网 (M3 placeholder) ──────────── */}
        <section className="space-y-4">
          <SectionHeader
            title="企业内网"
            subtitle="公告 · 政策 · 大事记 · 福利"
            badge="M3 上线"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <IntranetPlaceholder
              icon={Megaphone}
              title="公告"
              desc="CEO/HR 发布 · AI 摘要 · 关联 OKR"
              tone="brand"
            />
            <IntranetPlaceholder
              icon={FileLock}
              title="政策"
              desc="员工手册 / AI 红线 · 强制已读 · 版本管理"
              tone="warning"
            />
            <IntranetPlaceholder
              icon={PartyPopper}
              title="大事记"
              desc="融资 · 客户里程碑 · 团队荣誉"
              tone="success"
            />
            <IntranetPlaceholder
              icon={Gift}
              title="福利 / 活动"
              desc="节日 · 团建 · 培训 · 体检"
              tone="info"
            />
          </div>
        </section>

        {/* ──────────── §3 快速跳板 (M2 placeholder) ──────────── */}
        <section className="space-y-4">
          <SectionHeader
            title="快速跳板"
            subtitle="ERP / CRM / 通讯 / 学习 — 一键切到外部系统"
            badge="M2 上线"
          />
          <div className="grid gap-4 md:grid-cols-3">
            <LaunchpadCategory
              icon={Briefcase}
              title="业务系统"
              examples={['CRM', 'ERP', '财务', '报销', 'Jira', 'GitLab']}
            />
            <LaunchpadCategory
              icon={MessagesSquare}
              title="通讯协同"
              examples={['钉钉', '企微', '飞书', '腾讯会议']}
            />
            <LaunchpadCategory
              icon={GraduationCap}
              title="学习工具"
              examples={['Wiki', 'OA', 'HR', '培训']}
            />
          </div>
        </section>

        {/* ──────────── §4 议事 + IM 摘要 ──────────── */}
        <section className="space-y-4">
          <SectionHeader
            title="最近议事"
            subtitle="议事室进行中 · 已成 · 否决"
            actionHref="/convergence"
            actionLabel="查看全部"
          />
          <div className="card-elevated overflow-hidden">
            {!stats ? (
              <div className="p-12 text-center text-caption text-ink-tertiary">加载中...</div>
            ) : stats.recentDecisions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-body text-ink-secondary">暂无议事记录</p>
                <Link
                  href="/convergence"
                  className="mt-4 inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
                >
                  发起第一个议事 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {stats.recentDecisions.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/convergence/${d.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors duration-fast"
                    >
                      <DecisionStateIcon state={d.state} />
                      <div className="flex-1 min-w-0">
                        <p className="text-body text-ink-primary truncate">{d.title}</p>
                        <p className="mt-0.5 text-footnote text-ink-tertiary">
                          {fmtDateTime(d.createdAt)}
                          {' · '}
                          用时 {fmtDuration(d.elapsedSeconds)}
                          {d.selected && ` · 选 ${d.selected}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-tertiary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Footer hint */}
        <footer className="pt-6 pb-4 text-center text-footnote text-ink-tertiary">
          按 <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd> 打开命令面板 · 按
          <kbd className="ml-1 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">?</kbd> 查看快捷键
        </footer>
      </div>
    </div>
  );
}

// ──────────── Sub-components ────────────

function SectionHeader({
  title,
  subtitle,
  badge,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-title-3 text-ink-primary">
          {title}
          {badge && (
            <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 align-middle text-[10px] font-mono font-semibold text-brand-700">
              {badge}
            </span>
          )}
        </h2>
        {subtitle && <p className="mt-0.5 text-caption text-ink-secondary">{subtitle}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="text-caption text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
        >
          {actionLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function WorkbenchCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'info' | 'persona';
  label: string;
  value: number | string;
  hint?: string;
  href: string;
}) {
  const toneMap = {
    brand:   'bg-brand-50 text-brand-600',
    success: 'bg-success/10 text-success',
    info:    'bg-info/10 text-info',
    persona: 'bg-persona-assistant/30 text-info',
  };
  return (
    <Link href={href} className="block surface-interactive">
      <div className="card-elevated p-5 h-full">
        <div className="flex items-start justify-between">
          <span className="text-caption text-ink-secondary">{label}</span>
          <span className={`rounded-md p-1.5 ${toneMap[tone]}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-3 text-title-1 font-bold text-ink-primary tabular-nums">{value}</div>
        {hint && <p className="mt-1 text-footnote text-ink-tertiary">{hint}</p>}
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  children,
  muted = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        muted
          ? 'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2 surface-interactive'
          : 'inline-flex items-center gap-1.5 rounded-md bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-caption font-semibold text-white shadow-soft-sm surface-interactive'
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

function IntranetPlaceholder({
  icon: Icon,
  title,
  desc,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tone: 'brand' | 'success' | 'warning' | 'info';
}) {
  const toneMap = {
    brand:   'bg-brand-50 text-brand-600',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info:    'bg-info/10 text-info',
  };
  return (
    <div className="card-elevated p-5 opacity-70">
      <div className="flex items-start gap-3">
        <span className={`rounded-md p-2 ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="text-headline text-ink-primary">{title}</h3>
          <p className="mt-1 text-caption text-ink-tertiary">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function LaunchpadCategory({
  icon: Icon,
  title,
  examples,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  examples: string[];
}) {
  return (
    <div className="card-elevated p-5 opacity-70">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-600" />
        <h3 className="text-headline text-ink-primary">{title}</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {examples.map((e) => (
          <span
            key={e}
            className="rounded bg-surface-3 px-2 py-0.5 text-footnote text-ink-secondary"
          >
            {e}
          </span>
        ))}
        <span className="rounded border border-dashed border-border px-2 py-0.5 text-footnote text-ink-tertiary inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> 添加
        </span>
      </div>
    </div>
  );
}

function DecisionStateIcon({ state }: { state: string }) {
  const map: Record<string, { icon: React.ReactNode; tone: string }> = {
    COMMIT:       { icon: <CheckCircle2 className="h-4 w-4" />, tone: 'text-success bg-success/10' },
    ESCALATED:    { icon: <AlertCircle className="h-4 w-4" />,  tone: 'text-warning bg-warning/10' },
    VETOED:       { icon: <XCircle className="h-4 w-4" />,      tone: 'text-danger bg-danger/10' },
    DELIBERATION: { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
    CONVERGE:     { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
    DIVERGE:      { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
    FRAME:        { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
    ALIGN:        { icon: <Clock className="h-4 w-4" />,        tone: 'text-info bg-info/10' },
  };
  const m = map[state] ?? { icon: <Clock className="h-4 w-4" />, tone: 'text-ink-tertiary bg-surface-3' };
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.tone}`}>
      {m.icon}
    </span>
  );
}

// ──────────── Helpers ────────────

function greetingForHour(h: number): string {
  if (h < 6) return '深夜好, 早点休息';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  if (h < 22) return '晚上好';
  return '深夜好';
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
