'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRightPane } from '@/components/right-pane';
import { LATEST_NEWS } from '@/lib/intranet/featured';
import {
  Sparkles,
  Target,
  Clock3,
  Brain,
  ArrowRight,
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
  FileText,
  CalendarDays,
  HardDrive,
  Search,
  Bell,
  Megaphone,
} from 'lucide-react';
import { InsightsWidget } from '@/components/insights/insights-widget';
import { PendingRetrosCard } from '@/components/dashboard/pending-retros-card';
import { WorkbenchAgentView } from '@/components/dashboard/workbench-agent-view';
import { useBossAi } from '@/components/boss-ai';
import type { LaunchpadAppWithBadge, LaunchpadCategory as LpCategory } from '@/lib/types/launchpad';

/**
 * Homepage — 3-section layout (企业内网 已迁出为左侧独立模块 /intranet):
 *   1. 我的工作台 (Workbench, real data from /api/dashboard/stats)
 *   2. 快速跳板 (Launchpad)
 *   3. IM 摘要 / 议事预告 (real recent decisions)
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
  const [launchpadApps, setLaunchpadApps] = useState<LaunchpadAppWithBadge[]>([]);
  const router = useRouter();
  const { open: openRightPane, close: closeRightPane } = useRightPane();
  const { askAbout: askBossAbout } = useBossAi();

  function previewDecision(d: DashboardStats['recentDecisions'][number]) {
    openRightPane({
      title: d.title,
      subtitle: `议事室 · ${d.state}`,
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <DecisionStateIcon state={d.state} />
            <div>
              <p className="text-callout font-semibold text-ink-primary">
                状态 · {d.state}
              </p>
              <p className="text-footnote text-ink-tertiary">
                创建于 {fmtDateTime(d.createdAt)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-2/40 p-3 text-caption">
            <div>
              <dt className="text-ink-tertiary">用时</dt>
              <dd className="mt-0.5 text-ink-primary font-medium">
                {fmtDuration(d.elapsedSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-tertiary">选项</dt>
              <dd className="mt-0.5 text-ink-primary font-medium">
                {d.selected ?? '—'}
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-footnote text-ink-tertiary mb-1.5">议题</p>
            <p className="text-body text-ink-primary leading-relaxed">
              {d.title}
            </p>
          </div>

          <p className="text-footnote text-ink-tertiary">
            按 <kbd className="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[10px]">Esc</kbd> 关闭, 或点底部按钮查看完整议事记录.
          </p>
        </div>
      ),
      footer: (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={closeRightPane}
            className="rounded-md px-3 py-1.5 text-caption text-ink-secondary hover:bg-surface-3 hover:text-ink-primary surface-interactive"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={() => {
              closeRightPane();
              askBossAbout(`这个议题该锚到哪个 OKR? 议题: ${d.title}`, {
                task: `议事: ${d.title} (当前状态 ${d.state})`,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--brand-300))] bg-[rgb(var(--brand-50))] px-3 py-1.5 text-caption font-medium text-[rgb(var(--brand-700))] hover:bg-[rgb(var(--brand-100))] surface-interactive"
          >
            <Sparkles className="h-3.5 w-3.5" /> 问老板
          </button>
          <button
            type="button"
            onClick={() => {
              closeRightPane();
              router.push(`/convergence/${d.id}`);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-500))] px-3 py-1.5 text-caption font-medium text-white hover:bg-[rgb(var(--brand-600))] surface-interactive"
          >
            查看完整记录 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/launchpad')
      .then((r) => (r.ok ? r.json() : { apps: [] }))
      .then((d) => {
        if (!cancelled) setLaunchpadApps(d.apps ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) return; // 401/5xx — keep stats=null, UI shows "加载中..."
        const data = await res.json();
        // Shape guard: only accept full DashboardStats payloads.
        if (!data || typeof data !== 'object' || !data.okr || !data.decisionCards) return;
        if (!cancelled) setStats(data as DashboardStats);
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
      <div className="page-container py-4 md:py-8 space-y-6 md:space-y-10">
        {/* ──────────── 顶部公告 tagline (单一入口指向 /intranet) ──────────── */}
        <LatestAnnouncementTagline />

        {/* ──────────── §1 工作台 hero · 4 WorkbenchCards (左 2/3) + Launchpad (右 1/3) 等高并排 ──────────── */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3 lg:items-stretch">
          <section className="space-y-3 md:space-y-4 lg:col-span-2 flex flex-col">
            <SectionHeader
              title="我的工作台"
              subtitle="今日待办 · KR 进度 · 议事 · 日报"
            />
            <div className="grid gap-4 md:grid-cols-2 flex-1 auto-rows-fr">
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
          </section>

          {/* 快速跳板 (右 1/3, 与 4 张 WorkbenchCard 等高) · mobile 隐藏 (跳板入口交给 drawer) */}
          <div className="hidden md:block lg:col-span-1">
            <LaunchpadSection apps={launchpadApps} maxTiles={9} narrow />
          </div>
        </div>

        {/* ──────────── §1.5 工作台扩展 (全宽, 移出 hero 以让 Launchpad 不被拉高) ──────────── */}
        <section className="space-y-4">
          {/* EVO-10 · 多线工作 (Waiting 优先, 仅我可见) */}
          <WorkbenchAgentView />

          {/* Quick actions · mobile 仅三个核心 (议事/日报/KR), md+ 全量 */}
          <div className="flex flex-wrap items-center gap-2">
            <QuickAction href="/convergence" icon={Sparkles}>
              发起议事
            </QuickAction>
            <QuickAction href="/report" icon={Clock3} muted>
              写 5min 日报
            </QuickAction>
            <QuickAction href="/okr" icon={Target} muted>
              查我的 KR
            </QuickAction>
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <QuickAction href="/im" icon={MessagesSquare} muted>
                IM 协同
              </QuickAction>
              <QuickAction href="/documents" icon={FileText} muted>
                文档
              </QuickAction>
              <QuickAction href="/calendar" icon={CalendarDays} muted>
                日程
              </QuickAction>
              <QuickAction href="/drive" icon={HardDrive} muted>
                云盘
              </QuickAction>
              <QuickAction href="/search" icon={Search} muted>
                搜索
              </QuickAction>
              <QuickAction href="/notifications" icon={Bell} muted>
                通知
              </QuickAction>
            </div>
          </div>
        </section>

        {/* ──────────── AI 信号 (2026-05-10 跨模块联动) ──────────── */}
        <section className="space-y-3">
          <InsightsWidget />
        </section>

        {/* §2 企业内网 已移出首页 → 左侧导航独立模块 (/intranet) */}
        {/* §3 快速跳板 已上移到 Hero 右侧 */}

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
                    <button
                      type="button"
                      onClick={() => previewDecision(d)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors duration-fast text-left surface-interactive"
                      aria-label={`预览议事室决议: ${d.title}`}
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* EVO-1 · 决议节奏护栏: 仅在用户有"已 COMMIT 但未复盘"的决议时显示, 无数据自动隐藏 */}
          <PendingRetrosCard />
        </section>

        {/* §5 公司动态 strip 已退役 — 入口由顶部 LatestAnnouncementTagline 承担 */}

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

// ──────────── Launchpad section (real data) ────────────

const LP_CATEGORY_META: Record<LpCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  business: { label: '业务系统', icon: Briefcase },
  comm: { label: '通讯协同', icon: MessagesSquare },
  learning: { label: '学习工具', icon: GraduationCap },
  custom: { label: '自定义', icon: LayoutGrid },
};

function LaunchpadSection({
  apps,
  maxTiles,
  narrow = false,
}: {
  apps: LaunchpadAppWithBadge[];
  maxTiles?: number;
  /** When true, render in 3-col compact grid sized for half-width column next to Hero. */
  narrow?: boolean;
}) {
  const recommended = apps.filter((a) => a.recommendScore && a.recommendScore > 0).slice(0, 3);

  if (apps.length === 0) {
    return (
      <section className="space-y-4">
        <SectionHeader title="快速跳板" subtitle="ERP / CRM / 通讯 / 学习 — 一键切到外部系统" />
        <div className="card-elevated p-12 text-center">
          <LayoutGrid className="h-10 w-10 mx-auto text-ink-tertiary mb-3" />
          <p className="text-body text-ink-secondary">尚未配置跳板卡片</p>
          <Link
            href="/admin/launchpad"
            className="mt-3 inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
          >
            去配置 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  // 把推荐的 app 排在最前；其余按 category 顺序铺开 (统一红色卡片墙).
  const recommendedIds = new Set(recommended.map((a) => a.id));
  const rest = apps.filter((a) => !recommendedIds.has(a.id));
  const orderedRest = (['business', 'comm', 'learning', 'custom'] as LpCategory[]).flatMap((cat) =>
    rest.filter((a) => a.category === cat),
  );
  const allTiles = [...recommended, ...orderedRest];
  const tiles = maxTiles ? allTiles.slice(0, maxTiles) : allTiles;
  const more = maxTiles ? Math.max(0, allTiles.length - maxTiles) : 0;

  return (
    <section className={narrow ? 'flex flex-col gap-4 h-full' : 'space-y-4'}>
      <SectionHeader
        title="快速跳板"
        subtitle={
          narrow
            ? `${tiles.length}/${apps.length} 个常用${recommended.length > 0 ? ` · ${recommended.length} 个 AI 推荐` : ''}`
            : `${apps.length} 个系统${recommended.length > 0 ? ` · ${recommended.length} 个 AI 推荐` : ''}`
        }
        actionHref="/admin/launchpad"
        actionLabel={more > 0 ? `+${more} 个` : '管理'}
      />
      <div
        className={
          narrow
            ? 'grid gap-2.5 grid-cols-3 flex-1 auto-rows-fr launchpad-narrow'
            : 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        }
      >
        {tiles.map((a) => (
          <LaunchpadTile key={a.id} app={a} recommended={recommendedIds.has(a.id)} />
        ))}
      </div>
    </section>
  );
}

function LaunchpadTile({ app, recommended }: { app: LaunchpadAppWithBadge; recommended?: boolean }) {
  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    try {
      const r = await fetch(`/api/launchpad/${app.id}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: recommended ? 'recommendation' : 'home' }),
      });
      if (r.ok) {
        const d = await r.json();
        window.open(d.url ?? app.url, '_blank', 'noopener');
        return;
      }
    } catch {
      /* fall through */
    }
    window.open(app.url, '_blank', 'noopener');
  }

  const CategoryIcon = LP_CATEGORY_META[app.category]?.icon ?? LayoutGrid;
  const unread = app.unreadCount ?? 0;

  return (
    <a
      href={app.url}
      onClick={handleClick}
      className="rheem-tile group"
      title={app.description || app.name}
    >
      {/* Recommended sparkle indicator (top-left corner) */}
      {recommended && (
        <span
          className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-[9px] font-bold text-white/90"
          title={app.recommendReason || 'AI 推荐'}
        >
          <Sparkles className="h-3 w-3" />
          AI
        </span>
      )}

      {/* Unread badge (top-right) */}
      {unread > 0 && (
        <span className="rheem-tile-badge">{unread > 99 ? '99+' : unread}</span>
      )}

      {/* Icon: app's iconUrl if present, else category fallback */}
      {app.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={app.iconUrl}
          alt={app.name}
          className="w-7 h-7 object-contain brightness-0 invert opacity-95"
        />
      ) : (
        <CategoryIcon className="rheem-tile-icon" />
      )}

      <span className="rheem-tile-label line-clamp-2">{app.name}</span>
    </a>
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

// ──────────── LatestAnnouncementTagline ────────────
// 首页顶部 1 行公告 tagline · 单一入口指向 /intranet (选项 B 「真正分工」).
// 不复制 carousel; 依靠 lib/intranet/featured.LATEST_NEWS[0] 作为头条.

function LatestAnnouncementTagline() {
  const top = LATEST_NEWS[0];
  if (!top) return null;
  return (
    <Link
      href={`/intranet/posts/${top.id}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-2.5 surface-interactive hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--brand-500))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shrink-0">
        <Megaphone className="h-3 w-3" />
        公告
      </span>
      <span className="text-caption text-ink-primary truncate flex-1">
        {top.title}
      </span>
      <span className="text-footnote text-ink-tertiary shrink-0 hidden sm:inline">
        {top.publishedAt} · {top.author}
      </span>
      <span className="inline-flex items-center gap-1 text-caption text-brand-600 group-hover:text-brand-700 font-medium shrink-0">
        进公司门户 <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
