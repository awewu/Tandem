'use client';

/**
 * /tandem — 搭子 · 个人工作台 (1 主舞台 + 2 召唤侧栏)
 *
 * 心智模型 (2026-05-29 与 Owner 对齐):
 *   - 主舞台 = 我和「我的搭子 (Persona)」的协作区
 *     - 默认: 欢迎搭子, 提供启动协作的选项
 *     - 带任务: URL ?card=xxx 加载对应任务面板
 *   - 左召唤 (身份栏) = 切换「我」与「搭子」的状态
 *     - 我的分身 / Memory / 技能 / 通用 AI 沙盒 / 成长
 *   - 右召唤 (行动栏) = 交付搭子的产出
 *     - 交付 / 待办 / AI 推荐
 *   - Tandem AI (中央智囊) 在右下 FAB, 独立于本页, 不在召唤栏内
 *
 * 决议来源: docs/PLATFORM-ARCHITECTURE-2026-05-29.md
 *
 * UI 铁律 (CHARTER-UI-V1):
 *   - 只用 surface-* / shadow-soft-* / .text-title-* / pill-* token
 *   - 卡片 rounded-2xl, Hero rounded-3xl
 *   - 不出现 bg-slate-* / shadow-soft-sm 等 raw tailwind
 */

import Link from 'next/link';
import { Suspense, createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBossAi } from '@/components/boss-ai/use-boss-ai';
import { ThreePlusOneSelector } from '@/components/decision-layer/ThreePlusOneSelector';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Compass,
  Cpu,
  ExternalLink,
  FileText,
  History,
  Inbox,
  Megaphone,
  MessageSquare,
  Palette,
  Send,
  Sparkles,
  Stamp,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────
// 右侧行动坞 (Dock) tabs · 交付 / 我的分身 / Memory / 通用 AI
// 今日待办 + AI 推荐已提到左侧常驻驾驶舱 (CockpitRail), 不在此重复.
// 议事室、IM 是全局 rail 模块, 不在坞内重复.
// ────────────────────────────────────────────────────────────────
const DOCK_TABS = [
  { id: 'deliver',   label: '交付',     icon: Send,     hint: '主舞台产出 → 议事室 / IM / 邮件 / Memory' },
  { id: 'persona',   label: '我的分身',  icon: Bot,      hint: '分身名片 / 技能模式 / 代行权限' },
  { id: 'memory',    label: 'Memory',    icon: Brain,    hint: '我签名的决议 / 复盘 / 灵感' },
  { id: 'sandbox',   label: '通用 AI',   icon: Sparkles, hint: '不入公司 Memory 的个人沙盒' },
] as const;

type DockTabId = (typeof DOCK_TABS)[number]['id'];

// ────────────────────────────────────────────────────────────────
// 任务卡 · ?card=xxx 加载对应主舞台界面
// ────────────────────────────────────────────────────────────────
const CARD_REGISTRY = {
  decision:  {
    title: '起新决策卡',
    desc: '与搭子一起起草决议·选项·取舍',
    icon: Target,
    deepLink: { href: '/convergence',    label: '到议事室列表' },
  },
  document: {
    title: '起草文档',
    desc: '搭子代笔起草, 我审定',
    icon: FileText,
    deepLink: { href: '/documents',      label: '去文档中心' },
  },
  dialog: {
    title: '与搭子对话',
    desc: '问搭子·帮我梳理思路 / 起草回复',
    icon: MessageSquare,
    deepLink: { href: '/persona',        label: '去主分身工作台' },
  },
  portfolio: {
    title: '我的代表作',
    desc: '日报 / 复盘 / 议事发言, 自动聚合 + 标星沉淀',
    icon: Sparkles,
    deepLink: { href: '/portfolio',      label: '去代表作中心' },
  },
  panel: {
    title: '召唤专家团',
    desc: '一个议题, 设计/PM/技术/营销/战略分身并行起草, 你合稿',
    icon: Cpu,
    deepLink: { href: '/persona',        label: '去主分身工作台' },
  },
} as const;
type CardId = keyof typeof CARD_REGISTRY;

// ────────────────────────────────────────────────────────────────
// /api/me/dashboard + /api/me/retro-pending 聚合 hook
// ────────────────────────────────────────────────────────────────
interface MeDashboardData {
  todos: {
    promotionsAwaitingMySignature: Array<{
      id: string; title: string; level: string;
      slaDeadline?: string | null; overdue: boolean;
    }>;
    personaUpgradeAvailable: {
      fromStage: string; toStage: string; bossCaptureScore: number;
    } | null;
    myKrAtRisk: Array<{ id: string; title: string; riskStatus: string; progress: number }>;
    myTtiInProgress: Array<{ id: string; title: string; completionRate: number }>;
    myRecentCommitsInVetoWindow: Array<{ id: string; title: string; remainingMs: number }>;
    totalCount: number;
  };
  creation: {
    persona: { id: string; stage: string; bossCaptureScore: number; learningActive: boolean } | null;
    myMemoryContributions: { total: number; pending: number; rejected: number };
    myRecentDecisions: Array<{ id: string; title: string; state: string; selected?: boolean; createdAt: string }>;
  };
}
interface RetroPendingData {
  items: Array<{
    decisionId: string; title: string; decisionClass: string;
    daysSinceCommit: number; urgency: 'due' | 'overdue';
  }>;
  total: number;
}

interface DashboardCtx {
  loading: boolean;
  dashboard: MeDashboardData | null;
  retros: RetroPendingData | null;
}
const DashboardContext = createContext<DashboardCtx>({ loading: true, dashboard: null, retros: null });
const useTandemDashboard = () => useContext(DashboardContext);

// ── 交付草稿桥 · 主舞台/对话产出 → 交付卡自动带入 (P2/P3) ──────────────
interface TandemDraft { title: string; body: string; nonce: number }
interface DraftCtx {
  draft: TandemDraft | null;
  /** 主舞台/对话产出推送到交付卡 (自动展开行动坞的交付页) */
  pushDraft: (d: { title: string; body: string }) => void;
}
const DraftContext = createContext<DraftCtx>({ draft: null, pushDraft: () => {} });
const useTandemDraft = () => useContext(DraftContext);

function useDashboardFetch(): DashboardCtx {
  const [state, setState] = useState<DashboardCtx>({ loading: true, dashboard: null, retros: null });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/me/dashboard').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/me/retro-pending').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, r]) => {
      if (cancelled) return;
      setState({ loading: false, dashboard: d as MeDashboardData | null, retros: r as RetroPendingData | null });
    });
    return () => { cancelled = true; };
  }, []);
  return state;
}

function fmtRemainingMs(ms: number): string {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h${m}min 内可撤回`;
  return `${m}min 内可撤回`;
}

// ════════════════════════════════════════════════════════════════
// 页面入口
// ════════════════════════════════════════════════════════════════
export default function TandemPage() {
  return (
    <Suspense fallback={<div className="flex h-full w-full surface-2" aria-busy="true" />}>
      <TandemPageInner />
    </Suspense>
  );
}

function TandemPageInner() {
  // 右侧行动坞默认开在「交付」(常驻产出); 左侧今日驾驶舱默认常驻展开
  const [dockTab, setDockTab] = useState<DockTabId | null>('deliver');
  const [cockpitOpen, setCockpitOpen] = useState(true);
  // 移动端: 'cockpit' / 某个 dock tab / null
  const [mobileSheet, setMobileSheet] = useState<'cockpit' | DockTabId | null>(null);
  // 交付草稿桥: 主舞台/对话产出 → 交付卡
  const [draft, setDraft] = useState<TandemDraft | null>(null);
  const pushDraft = (d: { title: string; body: string }) => {
    setDraft({ ...d, nonce: Date.now() });
    setDockTab('deliver');
    setMobileSheet('deliver');
  };

  const sp = useSearchParams();
  const cardParam = sp?.get('card');
  const activeCard: CardId | null =
    cardParam && Object.prototype.hasOwnProperty.call(CARD_REGISTRY, cardParam)
      ? (cardParam as CardId)
      : null;

  const dashCtx = useDashboardFetch();

  return (
   <DashboardContext.Provider value={dashCtx}>
   <DraftContext.Provider value={{ draft, pushDraft }}>
    <div className="relative flex h-full w-full surface-2">
      {/* ───────── 左: 今日驾驶舱 (常驻) · 桌面 ───────── */}
      <CockpitRail open={cockpitOpen} onToggle={() => setCockpitOpen((v) => !v)} />

      {/* ───────── 主舞台 ───────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {activeCard ? (
          <div className="flex-1 overflow-y-auto pb-14 md:pb-0">
            <CardStage card={activeCard} />
          </div>
        ) : (
          <HomeStage
            onSummonPersona={() => setDockTab('persona')}
            onSummonDeliver={() => setDockTab('deliver')}
          />
        )}
      </main>

      {/* ───────── 右: 行动坞 (折叠) · 桌面 ───────── */}
      <div className="hidden md:contents">
        <SummonPanel
          side="right"
          tab={DOCK_TABS.find((t) => t.id === dockTab) ?? null}
          onClose={() => setDockTab(null)}
        />
        <SummonRail
          side="right"
          tabs={DOCK_TABS}
          activeId={dockTab}
          onToggle={(id) => setDockTab((cur) => (cur === id ? null : id))}
        />
      </div>

      {/* ───────── 移动端: 底部召唤条 + 弹起 sheet ───────── */}
      <MobileSummonBar
        active={mobileSheet}
        onPick={(id) => setMobileSheet((cur) => (cur === id ? null : id))}
      />
      <MobileSheet which={mobileSheet} onClose={() => setMobileSheet(null)} />
    </div>
   </DraftContext.Provider>
   </DashboardContext.Provider>
  );
}

// ════════════════════════════════════════════════════════════════
// 左: 今日驾驶舱 (常驻 260px, 可折叠到 48px) · 桌面
//   = 今日待办 (InboxCard) + 搭子推荐 (RecommendCard)
//   第一屏直接呈现「今天的战场」, 不再藏折叠栏.
// ════════════════════════════════════════════════════════════════
function CockpitRail({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { dashboard, retros } = useTandemDashboard();
  const total = (dashboard?.todos.totalCount ?? 0) + (retros?.items.length ?? 0);

  if (!open) {
    return (
      <nav
        aria-label="今日驾驶舱 (已折叠)"
        className="hidden md:flex w-12 shrink-0 flex-col items-center gap-1 py-3 surface-1 border-r"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <button
          type="button"
          onClick={onToggle}
          title="展开今日驾驶舱"
          aria-label="展开今日驾驶舱"
          className="flex h-10 w-10 items-center justify-center rounded-md text-tertiary hover:bg-[rgb(var(--surface-3))] hover:text-primary surface-interactive"
        >
          <ChevronRight className="h-[18px] w-[18px]" />
        </button>
        <div className="relative flex h-10 w-10 items-center justify-center rounded-md text-tertiary">
          <Inbox className="h-[18px] w-[18px]" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgb(var(--brand-500))] px-1 text-[10px] font-medium text-white">
              {total}
            </span>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md text-tertiary">
          <Compass className="h-[18px] w-[18px]" />
        </div>
      </nav>
    );
  }

  return (
    <aside
      aria-label="今日驾驶舱"
      className="hidden md:flex w-[260px] shrink-0 flex-col overflow-hidden surface-1 border-r"
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Inbox className="h-4 w-4 shrink-0 text-[rgb(var(--brand-500))]" />
          <h2 className="text-headline text-primary truncate">今日驾驶舱</h2>
          {total > 0 && <span className="pill-neutral text-footnote">{total}</span>}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="收起今日驾驶舱"
          className="rounded-md p-1 text-tertiary hover:bg-[rgb(var(--surface-3))] hover:text-primary surface-interactive"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section>
          <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">今日待办</p>
          <InboxCard />
        </section>
        <section>
          <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">搭子推荐</p>
          <RecommendCard />
        </section>
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════
// 召唤栏 (图标条, 48px)
// ════════════════════════════════════════════════════════════════
interface SummonRailProps<T extends string> {
  side: 'left' | 'right';
  tabs: ReadonlyArray<{ id: T; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }>;
  activeId: T | null;
  onToggle: (id: T) => void;
}

function SummonRail<T extends string>({ side, tabs, activeId, onToggle }: SummonRailProps<T>) {
  return (
    <nav
      aria-label={side === 'left' ? '身份召唤栏' : '行动召唤栏'}
      className={cn(
        'hidden md:flex w-12 shrink-0 flex-col items-center gap-1 py-3 surface-1',
        side === 'left' ? 'border-r' : 'border-l',
      )}
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            title={`${t.label} — ${t.hint}`}
            aria-pressed={active}
            className={cn(
              'group relative flex h-10 w-10 items-center justify-center rounded-md surface-interactive',
              'transition-colors duration-fast ease-standard',
              active
                ? 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]'
                : 'text-tertiary hover:bg-[rgb(var(--surface-3))] hover:text-primary',
            )}
          >
            {active && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[rgb(var(--brand-500))]',
                  side === 'left' ? '-left-1' : '-right-1',
                )}
              />
            )}
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════
// 召唤面板 (桌面, 280px)
// ════════════════════════════════════════════════════════════════
interface SummonTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}
interface SummonPanelProps {
  side: 'left' | 'right';
  tab: SummonTab | null;
  onClose: () => void;
}

function SummonPanel({ side, tab, onClose }: SummonPanelProps) {
  if (!tab) return null;
  const Icon = tab.icon;
  const CloseIcon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <aside
      aria-label={`${tab.label} 召唤面板`}
      className={cn(
        'hidden md:flex w-[280px] shrink-0 flex-col overflow-hidden surface-1',
        side === 'left' ? 'border-r' : 'border-l',
      )}
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-[rgb(var(--brand-500))]" />
          <h2 className="text-headline text-primary truncate">{tab.label}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="收起召唤面板"
          className="rounded-md p-1 text-tertiary hover:bg-[rgb(var(--surface-3))] hover:text-primary surface-interactive"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-caption text-tertiary mb-3">{tab.hint}</p>
        <SummonPanelContent id={tab.id} side={side} />
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════
// 召唤面板内容 · 按 tab.id 分发 (P1 = 我的分身 + 交付 真实占位, 其它 = 通用 stub)
// ════════════════════════════════════════════════════════════════
function SummonPanelContent({ id, side }: { id: string; side: 'left' | 'right' }) {
  if (id === 'deliver') return <DeliverDock />;
  if (id === 'persona') return <PersonaCard />;
  if (id === 'memory')  return <MemoryCard />;
  if (id === 'sandbox') return <SandboxCard />;
  return <StubCard id={id} side={side} />;
}

function PersonaCard() {
  const { dashboard, loading } = useTandemDashboard();
  const persona = dashboard?.creation.persona ?? null;
  const modes = [
    { id: 'design',    label: '🎨 设计模式', icon: Palette },
    { id: 'pm',        label: '📦 PM 模式', icon: ClipboardCheck },
    { id: 'tech',      label: '💻 技术模式', icon: Cpu },
    { id: 'marketing', label: '📣 营销模式', icon: Megaphone },
    { id: 'strategy',  label: '🎯 战略模式', icon: Target },
  ];
  return (
    <div className="space-y-3">
      <div className="surface-card rounded-2xl p-4 shadow-soft-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-headline text-primary truncate">我的搭子</p>
            <p className="text-footnote text-tertiary">
              {loading ? '加载中…' : persona
                ? <>阶段 <span className="text-primary">{persona.stage}</span> · 拿捏 {persona.bossCaptureScore}{persona.learningActive ? ' · 学习中' : ''}</>
                : '尚未召唤 · 去主分身页激活'}
            </p>
          </div>
        </div>
        <Link
          href="/persona"
          className="mt-3 inline-flex items-center gap-1 text-caption text-[rgb(var(--brand-600))] hover:underline"
        >
          打开主分身工作台 <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div>
        <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">技能模式</p>
        <div className="grid grid-cols-1 gap-1">
          {modes.map((m) => (
            <Link
              key={m.id}
              href={`/persona?mode=${m.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-caption text-secondary hover:bg-[rgb(var(--surface-3))] hover:text-primary surface-interactive"
            >
              <span>{m.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">治理</p>
        <Link
          href="/persona/me/proxy-actions"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-caption text-secondary hover:bg-[rgb(var(--surface-3))] hover:text-primary surface-interactive"
        >
          代行审计
        </Link>
      </div>
    </div>
  );
}

type DeliverTarget = 'decision' | 'memory' | 'im' | 'mail';

const DELIVER_TARGETS: Array<{ id: DeliverTarget; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'decision', label: '议事室',  icon: Target },
  { id: 'memory',   label: 'Memory',  icon: Brain },
  { id: 'im',       label: 'IM',      icon: MessageSquare },
  { id: 'mail',     label: '邮件',    icon: Send },
];

interface ImChannelLite { id: string; name: string }

function DeliverCard() {
  const router = useRouter();
  const { draft } = useTandemDraft();
  const [target, setTarget] = useState<DeliverTarget>('decision');
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk]   = useState<string | null>(null);
  // IM 频道选择 (真直送需指定频道)
  const [channels, setChannels] = useState<ImChannelLite[] | null>(null);
  const [channelId, setChannelId] = useState('');
  // 邮件收件人
  const [mailTo, setMailTo] = useState('');

  // 主舞台/对话产出 → 自动带入 (nonce 变化即覆盖)
  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setBody(draft.body);
    setOk(null); setErr(null);
  }, [draft]);

  // 选 IM 时按需拉取我的频道列表
  useEffect(() => {
    if (target !== 'im' || channels !== null) return;
    let cancelled = false;
    fetch('/api/im/channels')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list: ImChannelLite[] = (d?.channels ?? []).map(
          (c: { id: string; name?: string }) => ({ id: c.id, name: c.name ?? c.id }),
        );
        setChannels(list);
        if (list.length > 0) setChannelId((cur) => cur || list[0].id);
      })
      .catch(() => { if (!cancelled) setChannels([]); });
    return () => { cancelled = true; };
  }, [target, channels]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true); setErr(null); setOk(null);
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (target === 'decision') {
        const res = await fetch('/api/convergence', {
          method: 'POST', headers,
          body: JSON.stringify({
            title: title.trim(),
            description: body.trim(),
            noKrReason: '从 Tandem 个人工作台快速发起, 进议事室后绑定 KR',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setOk('已发起议事 · 跳转中…');
        setTimeout(() => router.push(`/convergence/${data.cardId}`), 400);
      } else if (target === 'memory') {
        // 真直送: 提交 Memory 升级提议, 进三级签批
        const text = body.trim() ? `${title.trim()}\n\n${body.trim()}` : title.trim();
        const res = await fetch('/api/memories/promote-text', {
          method: 'POST', headers,
          body: JSON.stringify({ body: text, title: title.trim(), source: 'tandem:deliver' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setOk('已提交 Memory 升级提议 · 进三级签批');
      } else if (target === 'im') {
        // 真直送: 发到选定频道
        if (!channelId) throw new Error('请选择频道');
        const text = body.trim() ? `**${title.trim()}**\n${body.trim()}` : title.trim();
        const res = await fetch(`/api/im/channels/${channelId}/messages`, {
          method: 'POST', headers, body: JSON.stringify({ body: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setOk('已发送到频道');
      } else if (target === 'mail') {
        // 真直送: 经 SMTP 发出 (未配置 SMTP 会回 503)
        if (!mailTo.trim()) throw new Error('请填收件人邮箱');
        const res = await fetch('/api/mail/send', {
          method: 'POST', headers,
          body: JSON.stringify({ to: mailTo.trim(), subject: title.trim(), text: body.trim() || title.trim() }),
        });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setOk('邮件已发送');
      }
    } catch (e) {
      setErr((e as Error).message ?? '送出失败');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-md border bg-[rgb(var(--surface-2))] px-2 py-1.5 text-caption text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]';

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-caption text-secondary leading-relaxed">
        把主舞台和搭子的协作产出一键送出 · 直送到目标模块。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DELIVER_TARGETS.map((t) => {
          const Icon = t.icon;
          const active = target === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTarget(t.id); setOk(null); setErr(null); }}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-footnote surface-interactive',
                active
                  ? 'border-[rgb(var(--brand-500))] bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]'
                  : 'text-secondary hover:bg-[rgb(var(--surface-3))]',
              )}
              style={!active ? { borderColor: 'rgb(var(--border-subtle))' } : undefined}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* IM: 频道选择 */}
      {target === 'im' && (
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className={inputCls}
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        >
          {channels === null && <option value="">频道加载中…</option>}
          {channels !== null && channels.length === 0 && <option value="">无可用频道</option>}
          {channels?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {/* 邮件: 收件人 */}
      {target === 'mail' && (
        <input
          value={mailTo}
          onChange={(e) => setMailTo(e.target.value)}
          placeholder="收件人邮箱 (逗号分隔可多个)"
          type="text"
          className={inputCls}
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        />
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={target === 'mail' ? '邮件主题' : '标题'}
        maxLength={200}
        className={inputCls}
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={target === 'memory' ? '沉淀正文' : '说明 / 正文'}
        rows={3}
        maxLength={4000}
        className={cn(inputCls, 'resize-none')}
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      />
      <button
        type="submit"
        disabled={!title.trim() || submitting}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] px-3 py-1.5 text-caption font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
      >
        <Send className="h-3.5 w-3.5" />
        {submitting ? '送出中…' : `送到${DELIVER_TARGETS.find((t) => t.id === target)?.label}`}
      </button>
      {err && <p className="text-footnote text-[rgb(var(--semantic-danger))]">{err}</p>}
      {ok  && <p className="text-footnote text-[rgb(var(--semantic-success))]">{ok}</p>}
      <p className="text-footnote text-tertiary leading-relaxed">
        {target === 'decision' && '会立即创建议事室; KR 绑定在议事页内完成。'}
        {target === 'memory'   && '直送: 提交 Memory 升级提议, 走三级签批。'}
        {target === 'im'       && '直送: 发到选定频道。'}
        {target === 'mail'     && '直送: 经 SMTP 发出 (未配置 SMTP 会提示)。'}
      </p>
    </form>
  );
}

// ── P4 治理可见化: 代行待否决轨迹卡 (zone + 24h 否决窗 + 确认/否决) ──────
interface PendingProxyAction {
  id: string;
  kind: string;
  zone: 'green' | 'yellow' | 'red';
  status: string;
  title: string;
  vetoUntil?: string;
  refType?: string;
}

function zoneLabel(zone: PendingProxyAction['zone']): { text: string; tone: string } {
  if (zone === 'red')   return { text: '红线', tone: 'text-[rgb(var(--semantic-danger))]' };
  if (zone === 'yellow') return { text: '黄区 · 24h 否决', tone: 'text-[rgb(var(--semantic-warning))]' };
  return { text: '绿区 · 留痕', tone: 'text-[rgb(var(--semantic-success))]' };
}

function GovernanceCard({ compact }: { compact?: boolean }) {
  const [actions, setActions] = useState<PendingProxyAction[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // 拉全量后客户端筛 pending (drafted=搭子草稿待确认 / awaiting_veto=否决窗内)
    fetch('/api/persona/proxy-actions?limit=40', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const all: PendingProxyAction[] = j?.ok ? (j.actions ?? []) : [];
        setActions(all.filter((a) => a.status === 'drafted' || a.status === 'awaiting_veto'));
      })
      .catch(() => { if (!cancelled) setActions([]); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  async function act(id: string, kind: 'confirm' | 'veto') {
    if (busyId) return;
    let reason: string | null = '';
    if (kind === 'veto') {
      reason = window.prompt('否决理由 (可选, 用于审计)');
      if (reason === null) return;
    } else if (!window.confirm('确认立即执行该代行 (不再等待 24h 否决窗)?')) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/persona/proxy-actions/${id}/${kind}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: kind === 'veto' ? JSON.stringify({ reason }) : undefined,
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? '操作失败');
      setReloadKey((k) => k + 1);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (actions === null) return compact ? null : <SkeletonRows />;
  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-footnote text-tertiary uppercase tracking-wider">搭子代行 · 待你处理</p>
      )}
      {actions.map((a) => {
        const z = zoneLabel(a.zone);
        const isDraft = a.status === 'drafted';
        const remain = a.vetoUntil ? new Date(a.vetoUntil).getTime() - Date.now() : 0;
        return (
          <div key={a.id} className="surface-card rounded-2xl p-3 shadow-soft-xs space-y-2">
            <div className="flex items-start gap-2">
              {isDraft
                ? <FileText className="h-4 w-4 shrink-0 text-[rgb(var(--brand-500))] mt-0.5" />
                : <Stamp className="h-4 w-4 shrink-0 text-[rgb(var(--brand-500))] mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-caption text-primary leading-snug">{a.title}</p>
                <p className="mt-0.5 text-footnote">
                  {isDraft
                    ? <span className="text-[rgb(var(--brand-600))]">搭子草稿 · 待确认</span>
                    : <span className={z.tone}>{z.text}</span>}
                  {a.vetoUntil && (
                    <span className="text-tertiary"> · {fmtRemainingMs(remain)}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => act(a.id, 'confirm')}
                className="flex-1 rounded-full bg-[rgb(var(--brand-500))] px-2.5 py-1 text-footnote font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
              >
                {isDraft ? '采用' : '确认执行'}
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => act(a.id, 'veto')}
                className="flex-1 rounded-full border px-2.5 py-1 text-footnote text-secondary hover:bg-[rgb(var(--surface-2))] disabled:opacity-40 surface-interactive"
                style={{ borderColor: 'rgb(var(--border-subtle))' }}
              >
                {isDraft ? '弃用' : '否决'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 右产出坞 = 交付 + 治理 (代行待否决)
function DeliverDock() {
  return (
    <div className="space-y-5">
      <DeliverCard />
      <GovernanceCard />
    </div>
  );
}

function StubCard({ id, side }: { id: string; side: 'left' | 'right' }) {
  return (
    <div className="surface-card-soft rounded-2xl p-4 shadow-soft-xs">
      <div className="text-caption text-secondary leading-relaxed">
        <span className="pill-neutral mb-2">P1 骨架</span>
        <p className="mt-2">
          {side === 'left' ? '身份' : '行动'}召唤 · <code className="text-primary">{id}</code> 面板待接入。
        </p>
      </div>
    </div>
  );
}

// ── Sandbox: 通用 AI 沙盒 (不入公司 Memory) ─────────────────────────
function SandboxCard() {
  return (
    <div className="space-y-2">
      <p className="text-caption text-secondary leading-relaxed">
        独立的 AI 聊天区 · 不沉淀公司 Memory · 用于个人探索。
      </p>
      <Link
        href="/chat"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <Sparkles className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        新开通用沙盒会话
      </Link>
      <Link
        href="/agents"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <Bot className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        Agent 超市
      </Link>
      <p className="text-footnote text-tertiary leading-relaxed">
        想要进公司 Memory? 用议事室或主分身页。
      </p>
    </div>
  );
}

// ── Memory: 我最近的决议 + Memory 贡献统计 ──────────────────────────
function MemoryCard() {
  const { dashboard, loading } = useTandemDashboard();
  if (loading) return <SkeletonRows />;
  const decisions = dashboard?.creation.myRecentDecisions ?? [];
  const contrib = dashboard?.creation.myMemoryContributions;
  return (
    <div className="space-y-3">
      {contrib && (
        <div className="surface-card rounded-2xl p-3 shadow-soft-xs">
          <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">我的 Memory 贡献</p>
          <div className="flex items-center gap-3 text-caption">
            <span className="text-primary"><strong>{contrib.total}</strong> 已上库</span>
            <span className="text-tertiary">·</span>
            <span className="text-tertiary">待签 {contrib.pending}</span>
          </div>
        </div>
      )}
      <div>
        <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">我最近的决议</p>
        {decisions.length === 0 ? (
          <p className="text-caption text-tertiary">暂无决议 · 去议事室创建</p>
        ) : (
          <div className="space-y-1.5">
            {decisions.slice(0, 5).map((d) => (
              <Link
                key={d.id}
                href={`/decisions/${d.id}`}
                className="block rounded-md px-2 py-1.5 text-caption text-primary hover:bg-[rgb(var(--surface-3))] surface-interactive"
              >
                <span className="truncate block">{d.title}</span>
                <span className="text-footnote text-tertiary">{d.state}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Link
        href="/memories"
        className="inline-flex items-center gap-1 text-caption text-[rgb(var(--brand-600))] hover:underline"
      >
        打开 Memory 中心 <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ── Inbox: 我的待办 (KR / TTI / 签字 / 否决窗口 / 复盘) ─────────────
function InboxCard() {
  const { dashboard, retros, loading } = useTandemDashboard();
  if (loading) return <SkeletonRows />;
  if (!dashboard) return <p className="text-caption text-tertiary">无数据</p>;
  const t = dashboard.todos;
  const empty = t.totalCount === 0 && (!retros || retros.items.length === 0);
  if (empty) {
    return (
      <div className="surface-card-soft rounded-2xl p-4 shadow-soft-xs text-caption text-secondary">
        <Sparkles className="inline h-4 w-4 text-[rgb(var(--brand-500))] mr-1" />
        清空了。今天可以做点新东西。
      </div>
    );
  }
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
      {t.personaUpgradeAvailable && (
        <InboxRow
          icon={TrendingUp}
          tone="brand"
          title={`搭子升级 · ${t.personaUpgradeAvailable.fromStage} → ${t.personaUpgradeAvailable.toStage}`}
          meta={`拿捏分 ${t.personaUpgradeAvailable.bossCaptureScore}`}
          href="/persona"
        />
      )}
      {t.promotionsAwaitingMySignature.map((p) => (
        <InboxRow
          key={`mem-${p.id}`}
          icon={Stamp}
          tone={p.overdue ? 'danger' : 'warning'}
          title={`签字 · ${p.title}`}
          meta={p.overdue ? 'SLA 已逾期' : `Memory → ${p.level}`}
          href={`/memories?id=${p.id}`}
        />
      ))}
      {t.myKrAtRisk.slice(0, 3).map((k) => (
        <InboxRow
          key={`kr-${k.id}`}
          icon={AlertCircle}
          tone="danger"
          title={k.title}
          meta={`KR 风险 · ${Math.round(k.progress * 100)}%`}
          href={`/okr?kr=${k.id}`}
        />
      ))}
      {t.myTtiInProgress.slice(0, 3).map((tti) => (
        <InboxRow
          key={`tti-${tti.id}`}
          icon={Target}
          tone="info"
          title={tti.title}
          meta={`TTI 进行中 · ${Math.round(tti.completionRate * 100)}%`}
          href={`/okr?tti=${tti.id}`}
        />
      ))}
      {t.myRecentCommitsInVetoWindow.map((d) => (
        <InboxRow
          key={`veto-${d.id}`}
          icon={Clock}
          tone="warning"
          title={d.title}
          meta={fmtRemainingMs(d.remainingMs)}
          href={`/decisions/${d.id}`}
        />
      ))}
      {retros?.items.map((r) => (
        <InboxRow
          key={`retro-${r.decisionId}`}
          icon={History}
          tone={r.urgency === 'overdue' ? 'danger' : 'warning'}
          title={`复盘 · ${r.title}`}
          meta={`${r.daysSinceCommit}d 未复盘`}
          href={`/decisions/${r.decisionId}?tab=retro`}
        />
      ))}
    </div>
  );
}

// ── Recommend: 搭子基于当前信号给 3+1 建议 (MANIFESTO §2 通用化) ────
//
// 双模式渲染:
//   - 默认 = 启发式快速建议 (buildRecommendations, 客户端本地算)
//   - "请搭子细想" = 调 /api/me/brief-options 走 ThreePlusOneEngine (LLM)
//
// 设计原则: 快速 (≤50ms 本地) 与 深思 (3-8s LLM) 并行存在, 用户挑.
function RecommendCard() {
  const { dashboard, retros, loading } = useTandemDashboard();
  const [briefOpts, setBriefOpts] = useState<import('@/lib/types/decision-card').DecisionOption[] | null>(null);
  const [briefWarns, setBriefWarns] = useState<string[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  // D 经营回顾 pre-read
  const [preread, setPreread] = useState<Array<{ id: string; kind: string; title: string; recommendation: string }> | null>(null);
  const [prereadLoading, setPrereadLoading] = useState(false);
  const [prereadErr, setPrereadErr] = useState<string | null>(null);

  async function loadPreread() {
    if (prereadLoading) return;
    setPrereadLoading(true); setPrereadErr(null);
    try {
      const res = await fetch('/api/me/okr-health');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setPreread(data.items ?? []);
    } catch (e) {
      setPrereadErr((e as Error).message ?? '加载失败');
    } finally {
      setPrereadLoading(false);
    }
  }

  async function loadBrief() {
    if (briefLoading) return;
    setBriefLoading(true); setBriefErr(null);
    try {
      const res = await fetch('/api/me/brief-options');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (data.empty) {
        setBriefErr('没有强信号 · 你可以自己决定');
      } else {
        setBriefOpts(data.options ?? []);
        setBriefWarns(data.warnings ?? []);
      }
    } catch (e) {
      setBriefErr((e as Error).message ?? '加载失败');
    } finally {
      setBriefLoading(false);
    }
  }

  if (loading) return <SkeletonRows />;
  const recs = buildRecommendations(dashboard, retros);

  // 走完整 3+1 流程时, 渲染 Selector
  if (briefOpts && briefOpts.length === 4) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { setBriefOpts(null); setBriefWarns([]); setBriefErr(null); }}
          className="text-footnote text-tertiary hover:text-primary surface-interactive"
        >
          ← 回快速建议
        </button>
        <ThreePlusOneSelector
          options={briefOpts}
          warnings={briefWarns}
          scenario="persona_brief"
          compact
          onChoose={async ({ option, novelInsight }) => {
            // 落 audit + 跳到匹配信号 (启发式映射: id A/B/C → 第 1/2/3 个 rec, D → 不跳, 留给用户自由)
            try {
              await fetch('/api/audit/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'persona_brief.option_picked',
                  metadata: { optionId: option.id, optionType: option.type, novelInsight: novelInsight ?? null },
                }),
              }).catch(() => {});
            } catch {}
            const idx = option.id === 'A' ? 0 : option.id === 'B' ? 1 : option.id === 'C' ? 2 : -1;
            if (idx >= 0 && recs[idx]) {
              window.location.href = recs[idx].href;
            }
          }}
        />
      </div>
    );
  }

  // D 经营回顾 pre-read 视图
  if (preread) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { setPreread(null); setPrereadErr(null); }}
          className="text-footnote text-tertiary hover:text-primary surface-interactive"
        >
          ← 回快速建议
        </button>
        <p className="text-footnote text-tertiary uppercase tracking-wider">经营回顾 pre-read · OKR 承压信号</p>
        {preread.length === 0 ? (
          <div className="surface-card-soft rounded-2xl p-4 shadow-soft-xs text-caption text-secondary">
            当前 active 周期公司/团队层 OKR 无显著承压信号。
          </div>
        ) : (
          preread.map((p) => (
            <div key={p.id} className="surface-card rounded-2xl p-3 shadow-soft-xs">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 shrink-0 text-[rgb(var(--semantic-warning))] mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-caption text-primary leading-snug">{p.title}</p>
                  <p className="mt-0.5 text-footnote text-tertiary">{p.recommendation}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <p className="text-footnote text-tertiary leading-relaxed">
          只读参谋视角 (复用 analyzeOkrHealth) · 须人工处置 (进议事室 / 复盘), 中央 AI 不自动调 OKR。
        </p>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="space-y-2">
        <div className="surface-card-soft rounded-2xl p-4 shadow-soft-xs text-caption text-secondary">
          没有强信号。试试问搭子「下半天我应该聚焦什么？」或看经营回顾。
        </div>
        <button
          type="button"
          onClick={loadPreread}
          disabled={prereadLoading}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-footnote text-secondary hover:bg-[rgb(var(--surface-2))] surface-interactive disabled:opacity-40"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        >
          <TrendingUp className="h-3 w-3 text-[rgb(var(--semantic-warning))]" />
          {prereadLoading ? '生成中…' : '经营回顾 pre-read'}
        </button>
        {prereadErr && <p className="text-footnote text-tertiary">{prereadErr}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {recs.map((r, i) => (
        <Link
          key={i}
          href={r.href}
          className="block surface-card rounded-2xl p-3 shadow-soft-xs surface-interactive hover:shadow-soft-sm"
        >
          <div className="flex items-start gap-2">
            <Compass className="h-4 w-4 shrink-0 text-[rgb(var(--brand-500))] mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-primary leading-snug">{r.title}</p>
              <p className="mt-0.5 text-footnote text-tertiary">{r.reason}</p>
            </div>
          </div>
        </Link>
      ))}
      <button
        type="button"
        onClick={loadBrief}
        disabled={briefLoading}
        className="w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-footnote text-secondary hover:bg-[rgb(var(--surface-2))] surface-interactive disabled:opacity-40"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <Sparkles className="h-3 w-3 text-[rgb(var(--brand-500))]" />
        {briefLoading ? '搭子细想中…' : '请搭子细想 · 给 3+1'}
      </button>
      <button
        type="button"
        onClick={loadPreread}
        disabled={prereadLoading}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-footnote text-secondary hover:bg-[rgb(var(--surface-2))] surface-interactive disabled:opacity-40"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <TrendingUp className="h-3 w-3 text-[rgb(var(--semantic-warning))]" />
        {prereadLoading ? '生成中…' : '经营回顾 pre-read'}
      </button>
      {briefErr && <p className="text-footnote text-tertiary">{briefErr}</p>}
      {prereadErr && <p className="text-footnote text-tertiary">{prereadErr}</p>}
    </div>
  );
}

function buildRecommendations(
  dash: MeDashboardData | null,
  retros: RetroPendingData | null,
): Array<{ title: string; reason: string; href: string }> {
  if (!dash) return [];
  const recs: Array<{ title: string; reason: string; href: string }> = [];
  if (dash.todos.myKrAtRisk.length > 0) {
    const kr = dash.todos.myKrAtRisk[0];
    recs.push({
      title: '先救一个 KR',
      reason: `${kr.title} · ${kr.riskStatus}, 进度 ${Math.round(kr.progress * 100)}%`,
      href: `/okr?kr=${kr.id}`,
    });
  }
  // D 信号源扩面: 卡住的执行项 (TTI 低完成度)
  const stalledTti = dash.todos.myTtiInProgress.find((t) => t.completionRate < 0.34);
  if (stalledTti) {
    recs.push({
      title: '推进卡住的执行项',
      reason: `${stalledTti.title} · 仅 ${Math.round(stalledTti.completionRate * 100)}%`,
      href: `/okr?tti=${stalledTti.id}`,
    });
  }
  if (retros && retros.items.some((r) => r.urgency === 'overdue')) {
    const r = retros.items.find((x) => x.urgency === 'overdue')!;
    recs.push({
      title: '补一个复盘',
      reason: `${r.title} · ${r.daysSinceCommit}d 未复盘`,
      href: `/decisions/${r.decisionId}?tab=retro`,
    });
  }
  if (dash.todos.personaUpgradeAvailable) {
    const u = dash.todos.personaUpgradeAvailable;
    recs.push({
      title: '确认搭子升级',
      reason: `${u.fromStage} → ${u.toStage} · 拿捏分 ${u.bossCaptureScore}`,
      href: '/persona',
    });
  }
  if (dash.todos.promotionsAwaitingMySignature.length > 0) {
    recs.push({
      title: '清掉 Memory 签字',
      reason: `${dash.todos.promotionsAwaitingMySignature.length} 条等你`,
      href: '/memories?filter=mine-pending',
    });
  }
  return recs.slice(0, 4);
}

// ── 行级条目 ────────────────────────────────────────────────────────
function InboxRow({
  icon: Icon,
  tone,
  title,
  meta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'warning' | 'danger' | 'info';
  title: string;
  meta?: string;
  href: string;
}) {
  const toneClass = {
    brand:   'text-[rgb(var(--brand-600))]',
    warning: 'text-[rgb(var(--semantic-warning))]',
    danger:  'text-[rgb(var(--semantic-danger))]',
    info:    'text-[rgb(var(--semantic-info))]',
  }[tone];
  return (
    <Link
      href={href}
      className="flex items-start gap-2 rounded-md border px-3 py-2 hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', toneClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-caption text-primary truncate">{title}</p>
        {meta && <p className="text-footnote text-tertiary">{meta}</p>}
      </div>
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 rounded-md surface-3 animate-pulse-soft" />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 主舞台 · Home = 对话即主舞台 (P3)
//   - 无消息: 欢迎页 (Hero + 快捷入口)
//   - 有消息: 内嵌对话流 (与右下 Tandem AI FAB 共享同一会话)
//   - 底部: 常驻指令框 (说一句话立即起对话)
// ════════════════════════════════════════════════════════════════
function HomeStage({
  onSummonPersona,
  onSummonDeliver,
}: {
  onSummonPersona: () => void;
  onSummonDeliver: () => void;
}) {
  const { messages } = useBossAi();
  const conversing = messages.length > 0;
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {conversing ? (
          <ConversationStream />
        ) : (
          <WelcomeStage onSummonPersona={onSummonPersona} onSummonDeliver={onSummonDeliver} />
        )}
      </div>
      <CommandBox />
    </>
  );
}

// 从一段产出文本派生标题 (首行 / 截断)
function deriveTitle(text: string): string {
  const firstLine = (text.split('\n').find((l) => l.trim().length > 0) ?? '').trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine || '搭子产出';
}

// ── 内嵌对话流 ──────────────────────────────────────────────────────
function ConversationStream() {
  const { messages, streaming } = useBossAi();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);
  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center gap-2 text-caption text-tertiary">
        <Sparkles className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        <span>与搭子 / Tandem AI 的协作</span>
      </div>
      <GovernanceCard compact />
      {messages.map((m, i) => (
        <MessageBubble key={`${m.createdAt}-${i}`} m={m} />
      ))}
      {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
        <p className="text-footnote text-tertiary">搭子思考中…</p>
      )}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ m }: { m: import('@/components/boss-ai/use-boss-ai').BossAiMessage }) {
  const { pushDraft } = useTandemDraft();
  const { submitFeedback } = useBossAi();
  const isUser = m.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-[rgb(var(--brand-500))] px-4 py-2.5 text-caption text-white whitespace-pre-wrap">
          {m.content}
        </div>
      </div>
    );
  }
  const done = !m.streaming && m.content.trim().length > 0;
  // E 回灌组织 IQ: 中央 AI 回复有 decisionId → 暴露采纳/改用/推翻反馈 (进 CA-13 飞轮)
  const fbOptions: Array<{ outcome: 'adopted' | 'modified' | 'overruled'; label: string }> = [
    { outcome: 'adopted', label: '采纳' },
    { outcome: 'modified', label: '改用' },
    { outcome: 'overruled', label: '推翻' },
  ];
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="surface-card rounded-2xl px-4 py-3 shadow-soft-xs">
          {m.status && !m.content && (
            <p className="text-footnote text-tertiary">{m.status}</p>
          )}
          <div className="text-caption text-primary whitespace-pre-wrap leading-relaxed">
            {m.content}
            {m.streaming && <span className="ml-0.5 animate-pulse-soft">▋</span>}
          </div>
        </div>
        {done && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => pushDraft({ title: deriveTitle(m.content), body: m.content })}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-footnote text-secondary hover:bg-[rgb(var(--surface-2))] surface-interactive"
              style={{ borderColor: 'rgb(var(--border-subtle))' }}
            >
              <Send className="h-3 w-3 text-[rgb(var(--brand-500))]" /> 交付这段
            </button>
            {m.decisionId && (
              <>
                <span className="text-footnote text-tertiary">·</span>
                {m.feedbackOutcome && m.feedbackOutcome !== 'pending' ? (
                  <span className="text-footnote text-[rgb(var(--brand-600))]">
                    已反馈: {fbOptions.find((o) => o.outcome === m.feedbackOutcome)?.label ?? m.feedbackOutcome}
                  </span>
                ) : (
                  fbOptions.map((o) => (
                    <button
                      key={o.outcome}
                      type="button"
                      disabled={m.feedbackSubmitting}
                      onClick={() => { void submitFeedback(m.createdAt, o.outcome); }}
                      className="rounded-full border px-2 py-0.5 text-footnote text-tertiary hover:bg-[rgb(var(--surface-2))] hover:text-primary surface-interactive disabled:opacity-40"
                      style={{ borderColor: 'rgb(var(--border-subtle))' }}
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 常驻指令框 ──────────────────────────────────────────────────────
function CommandBox() {
  const { send, streaming, messages, newSession } = useBossAi();
  const [input, setInput] = useState('');

  function submit() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void send(text, { currentPath: '/tandem' });
  }

  return (
    <div
      className="shrink-0 border-t px-4 md:px-6 py-3 surface-1 pb-[calc(0.75rem+3.5rem)] md:pb-3"
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      <div className="mx-auto max-w-3xl">
        {messages.length > 0 && (
          <div className="mb-1.5 flex justify-end">
            <button
              type="button"
              onClick={newSession}
              className="text-footnote text-tertiary hover:text-primary surface-interactive"
            >
              新对话
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="跟搭子说一句话, 立即开干 · Enter 发送 / Shift+Enter 换行"
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none rounded-2xl border bg-[rgb(var(--surface-2))] px-4 py-2.5 text-caption text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))] max-h-32"
            style={{ borderColor: 'rgb(var(--border-subtle))' }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || streaming}
            aria-label="发送"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--brand-500))] text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 主舞台 · 欢迎状态 = 「搭子, 今天我们干什么?」
// ════════════════════════════════════════════════════════════════
function WelcomeStage({
  onSummonPersona,
  onSummonDeliver,
}: {
  onSummonPersona: () => void;
  onSummonDeliver: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Hero · 欢迎我的搭子 */}
      <section className="hero-ink rounded-3xl p-6 md:p-8 shadow-soft-lg">
        <div className="flex items-center gap-2 text-white/70 text-caption mb-3">
          <Sparkles className="h-4 w-4" />
          <span>搭子 · 个人工作台</span>
        </div>
        <h1 className="text-title-1 text-white">
          搭子, 今天我们干什么?
        </h1>
        <p className="mt-3 text-body text-white/75 max-w-2xl">
          这里是你和「我的搭子」(你的 AI 分身) 的协作主舞台。<br />
          选一件事开始 — 搭子陪你, Tandem AI (中央智囊) 兜底。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSummonPersona}
            className="inline-flex items-center gap-2 rounded-full bg-white text-[rgb(var(--rheem-ink-black))] px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/90"
          >
            <Bot className="h-4 w-4" /> 召唤主分身
          </button>
          <button
            type="button"
            onClick={onSummonDeliver}
            className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/10"
          >
            <Send className="h-4 w-4" /> 交付产出
          </button>
          <Link
            href="/okr?owner=me"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/10"
          >
            <Target className="h-4 w-4" /> 我的 OKR
          </Link>
        </div>
      </section>

      {/* 启动协作 · 入口卡, 进入后通过 ?card= 在本舞台展开 */}
      <section>
        <h2 className="text-headline text-primary mb-3">今天先做点什么</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(CARD_REGISTRY) as CardId[]).map((id) => {
            const c = CARD_REGISTRY[id];
            const Icon = c.icon;
            return (
              <Link
                key={id}
                href={`/tandem?card=${id}`}
                className="group surface-card rounded-2xl p-4 shadow-soft-xs surface-interactive hover:shadow-soft-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-[rgb(var(--brand-50))] p-2 text-[rgb(var(--brand-600))]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-title-3 text-primary group-hover:text-[rgb(var(--brand-700))]">{c.title}</h3>
                    <p className="mt-1 text-caption text-secondary">{c.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="text-footnote text-tertiary text-center pt-2">
        搭子 · 个人工作台 · 今日驾驶舱 + 主舞台 + 行动坞 · 你 ↔ 搭子 ↔ Tandem AI 三层协作
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 主舞台 · 带任务进入 (?card=xxx)
// ════════════════════════════════════════════════════════════════
function CardStage({ card }: { card: CardId }) {
  const meta = CARD_REGISTRY[card];
  const Icon = meta.icon;
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/tandem"
          className="inline-flex items-center gap-1.5 text-caption text-tertiary hover:text-primary surface-interactive"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 回欢迎
        </Link>
        <span className="pill-neutral text-footnote">主舞台 · 任务模式</span>
      </div>

      <header className="surface-card rounded-2xl p-5 shadow-soft-xs">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-[rgb(var(--brand-50))] p-2 text-[rgb(var(--brand-600))]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-title-2 text-primary">{meta.title}</h1>
            <p className="mt-1 text-caption text-secondary">{meta.desc}</p>
          </div>
        </div>
      </header>

      {card === 'decision'  && <DecisionDraftStage />}
      {card === 'dialog'    && <DialogStage />}
      {card === 'panel'     && <ExpertPanelStage />}
      {(card === 'document' || card === 'portfolio') && (
        <section className="surface-card-soft rounded-2xl p-6 shadow-soft-xs min-h-[200px]">
          <div className="flex items-center gap-2 text-caption text-tertiary mb-3">
            <Bot className="h-4 w-4" />
            <span>搭子在线 · 等你开始</span>
          </div>
          <p className="text-body text-secondary leading-relaxed">
            「{meta.title}」协作界面将在此展开。<br />
            <span className="text-tertiary">P2 接入编辑器 / 聚合视图。当前先去对应模块继续。</span>
          </p>
          <Link
            href={meta.deepLink.href}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-[rgb(var(--brand-600))]"
          >
            {meta.deepLink.label} <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}
    </div>
  );
}

// ── /tandem?card=decision · 内嵌议事室起草表单 ─────────────────────
function DecisionDraftStage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [desc, setDesc]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true); setErr(null);
    try {
      const res = await fetch('/api/convergence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim(),
          noKrReason: '从 Tandem 主舞台快速发起, 进议事室后绑定 KR',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.push(`/convergence/${data.cardId}`);
    } catch (e) {
      setErr((e as Error).message ?? '提交失败');
      setSubmitting(false);
    }
  }

  return (
    <section className="surface-card rounded-2xl p-5 md:p-6 shadow-soft-xs">
      <div className="flex items-center gap-2 text-caption text-tertiary mb-4">
        <Bot className="h-4 w-4" />
        <span>搭子陪你起草 · 提交即创建议事室</span>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="议题标题 · 一句话说清要决什么"
          maxLength={200}
          className="w-full rounded-md border bg-[rgb(var(--surface-2))] px-3 py-2 text-body text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="背景 / 选项 / 取舍 (可空, 进议事室再补)"
          rows={6}
          maxLength={4000}
          className="w-full resize-y rounded-md border bg-[rgb(var(--surface-2))] px-3 py-2 text-body text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-footnote text-tertiary">
            提交后将创建议事室 · 自动生成 3+1 选项 · KR 进议事页内绑定
          </p>
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] px-4 py-2 text-caption font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? '创建中…' : '创建议事室'}
          </button>
        </div>
        {err && <p className="text-caption text-[rgb(var(--semantic-danger))]">{err}</p>}
      </form>
    </section>
  );
}

// ── /tandem?card=dialog · 与搭子对话 (拉起 Tandem AI / 跳主分身) ─────
function DialogStage() {
  const { askAbout } = useBossAi();
  const [prompt, setPrompt] = useState('');

  function ask() {
    const text = prompt.trim() || '搭子, 帮我梳理今天的优先级';
    askAbout(text, { autoSend: false });
  }

  return (
    <section className="surface-card rounded-2xl p-5 md:p-6 shadow-soft-xs">
      <div className="flex items-center gap-2 text-caption text-tertiary mb-4">
        <Bot className="h-4 w-4" />
        <span>问搭子 · 或问中央 (Tandem AI)</span>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="你想问什么? · 例: 这个迭代要怎么排期 / 帮我起草给老王的回复"
        rows={4}
        maxLength={2000}
        className="w-full resize-y rounded-md border bg-[rgb(var(--surface-2))] px-3 py-2 text-body text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={ask}
          className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] text-white px-4 py-2 text-caption font-medium hover:bg-[rgb(var(--brand-600))] surface-interactive"
        >
          <Sparkles className="h-3.5 w-3.5" />
          问 Tandem AI (中央智囊)
        </button>
        <Link
          href="/persona"
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-caption font-medium text-primary hover:bg-[rgb(var(--surface-2))] surface-interactive"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        >
          <Bot className="h-3.5 w-3.5 text-[rgb(var(--brand-500))]" />
          打开主分身工作台
        </Link>
      </div>
      <p className="mt-3 text-footnote text-tertiary leading-relaxed">
        搭子 = 你的 AI 分身, 在「主分身工作台」里成长。<br />
        Tandem AI = 公司中央智囊, 给你方向 / 优先级 / 判断框架, 不替你签字。
      </p>
    </section>
  );
}

// ── /tandem?card=panel · 专家团: 多视角并行起草 + 合稿交付 (C) ────────
const PANEL_EXPERTS: Array<{ id: string; label: string }> = [
  { id: 'design', label: '设计' },
  { id: 'pm', label: 'PM' },
  { id: 'tech', label: '技术' },
  { id: 'marketing', label: '营销' },
  { id: 'strategy', label: '战略' },
];

interface PanelDraft { mode: string; label: string; ok: boolean; draft: string; error?: string }

function ExpertPanelStage() {
  const { pushDraft } = useTandemDraft();
  const [topic, setTopic] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set(['pm', 'tech', 'strategy']));
  const [drafts, setDrafts] = useState<PanelDraft[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelected(mode: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(mode) ? next.delete(mode) : next.add(mode);
      return next;
    });
  }

  async function run() {
    const t = topic.trim();
    if (!t || picked.size === 0 || loading) return;
    setLoading(true); setErr(null); setDrafts(null); setSelected(new Set());
    try {
      const res = await fetch('/api/me/expert-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, modes: Array.from(picked) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const ds: PanelDraft[] = data.drafts ?? [];
      setDrafts(ds);
      setSelected(new Set(ds.filter((d) => d.ok).map((d) => d.mode)));
    } catch (e) {
      setErr((e as Error).message ?? '召唤失败');
    } finally {
      setLoading(false);
    }
  }

  function combineDeliver() {
    if (!drafts) return;
    const chosen = drafts.filter((d) => d.ok && selected.has(d.mode));
    if (chosen.length === 0) return;
    const body = chosen.map((d) => `## ${d.label}视角\n\n${d.draft}`).join('\n\n---\n\n');
    pushDraft({ title: topic.trim() || '专家团合稿', body });
  }

  return (
    <section className="surface-card rounded-2xl p-5 md:p-6 shadow-soft-xs space-y-4">
      <div className="flex items-center gap-2 text-caption text-tertiary">
        <Cpu className="h-4 w-4" />
        <span>受控专家团 · 各分身只起草供你合稿 (不替你拍板/对外)</span>
      </div>

      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="议题 · 例: 北区渠道下季度是否加大投入, 给我多视角草稿"
        rows={3}
        maxLength={2000}
        className="w-full resize-y rounded-md border bg-[rgb(var(--surface-2))] px-3 py-2 text-body text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      />

      <div className="flex flex-wrap gap-1.5">
        {PANEL_EXPERTS.map((e) => {
          const on = picked.has(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-footnote surface-interactive',
                on
                  ? 'border-[rgb(var(--brand-500))] bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]'
                  : 'text-secondary hover:bg-[rgb(var(--surface-3))]',
              )}
              style={!on ? { borderColor: 'rgb(var(--border-subtle))' } : undefined}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={run}
        disabled={!topic.trim() || picked.size === 0 || loading}
        className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] px-4 py-2 text-caption font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
      >
        <Cpu className="h-3.5 w-3.5" />
        {loading ? `${picked.size} 个分身并行起草中…` : `并行起草 (${picked.size} 个视角)`}
      </button>
      {err && <p className="text-footnote text-[rgb(var(--semantic-danger))]">{err}</p>}

      {drafts && (
        <div className="space-y-3 pt-1">
          {drafts.map((d) => (
            <div key={d.mode} className="surface-card-soft rounded-2xl p-4 shadow-soft-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {d.ok && (
                    <input
                      type="checkbox"
                      checked={selected.has(d.mode)}
                      onChange={() => toggleSelected(d.mode)}
                      aria-label={`合稿选择 ${d.label}`}
                    />
                  )}
                  <span className="text-headline text-primary">{d.label}视角</span>
                </div>
                {d.ok ? (
                  <button
                    type="button"
                    onClick={() => pushDraft({ title: `${topic.trim()} · ${d.label}`, body: d.draft })}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-footnote text-secondary hover:bg-[rgb(var(--surface-2))] surface-interactive"
                    style={{ borderColor: 'rgb(var(--border-subtle))' }}
                  >
                    <Send className="h-3 w-3 text-[rgb(var(--brand-500))]" /> 单独交付
                  </button>
                ) : (
                  <span className="text-footnote text-[rgb(var(--semantic-danger))]">起草失败</span>
                )}
              </div>
              {d.ok ? (
                <div className="text-caption text-secondary whitespace-pre-wrap leading-relaxed">{d.draft}</div>
              ) : (
                <p className="text-footnote text-tertiary">{d.error}</p>
              )}
            </div>
          ))}

          {drafts.some((d) => d.ok) && (
            <button
              type="button"
              onClick={combineDeliver}
              disabled={selected.size === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] px-4 py-2 text-caption font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
            >
              <Send className="h-3.5 w-3.5" />
              合稿交付 ({selected.size} 份 → 交付坞)
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════════
// 移动端: 底部召唤条 (固定, 56px) + 全屏 sheet
// ════════════════════════════════════════════════════════════════
type MobileSheetId = 'cockpit' | DockTabId;

function MobileSummonBar({
  active,
  onPick,
}: {
  active: MobileSheetId | null;
  onPick: (id: MobileSheetId) => void;
}) {
  const items: Array<{ id: MobileSheetId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'cockpit', label: '待办', icon: Inbox },
    ...DOCK_TABS.map((t) => ({ id: t.id as MobileSheetId, label: t.label, icon: t.icon })),
  ];
  return (
    <nav
      aria-label="移动端召唤栏"
      className="fixed inset-x-0 bottom-0 z-40 flex md:hidden h-14 items-center justify-around border-t surface-1"
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      {items.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 surface-interactive',
              isActive ? 'text-[rgb(var(--brand-600))]' : 'text-tertiary',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[10px]">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileSheet({
  which,
  onClose,
}: {
  which: MobileSheetId | null;
  onClose: () => void;
}) {
  if (!which) return null;
  const isCockpit = which === 'cockpit';
  const tab = isCockpit ? null : DOCK_TABS.find((t) => t.id === which) ?? null;
  if (!isCockpit && !tab) return null;
  const Icon = isCockpit ? Inbox : tab!.icon;
  const label = isCockpit ? '今日驾驶舱' : tab!.label;
  const hint = isCockpit ? '今日待办 · 搭子推荐' : tab!.hint;
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
      />
      <aside
        role="dialog"
        aria-label={`${label} 面板`}
        className="fixed inset-x-0 bottom-14 z-50 md:hidden max-h-[70vh] overflow-y-auto rounded-t-2xl surface-1 shadow-soft-xl"
      >
        <header className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-[rgb(var(--brand-500))]" />
            <h2 className="text-headline text-primary">{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-tertiary hover:bg-[rgb(var(--surface-3))] hover:text-primary surface-interactive"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4">
          <p className="text-caption text-tertiary mb-3">{hint}</p>
          {isCockpit ? (
            <div className="space-y-5">
              <section>
                <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">今日待办</p>
                <InboxCard />
              </section>
              <section>
                <p className="text-footnote text-tertiary uppercase tracking-wider mb-2">搭子推荐</p>
                <RecommendCard />
              </section>
            </div>
          ) : (
            <SummonPanelContent id={which} side="right" />
          )}
        </div>
      </aside>
    </>
  );
}
