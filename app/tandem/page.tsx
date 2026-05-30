'use client';

/**
 * /tandem — Tandem 个人工作台 (1 主舞台 + 2 召唤侧栏)
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
 *   - 不出现 bg-slate-* / shadow-sm 等 raw tailwind
 */

import Link from 'next/link';
import { Suspense, createContext, useContext, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBossAi } from '@/components/boss-ai/use-boss-ai';
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
  GraduationCap,
  History,
  Inbox,
  Layers,
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
// 左召唤 (身份栏) tabs · 「我」与「搭子」的状态切换
// ────────────────────────────────────────────────────────────────
const LEFT_TABS = [
  { id: 'persona',   label: '我的分身',  icon: Bot,           hint: '分身名片 / 技能模式 / 代行权限' },
  { id: 'memory',    label: 'Memory',    icon: Brain,         hint: '我签名的决议 / 复盘 / 灵感' },
  { id: 'skills',    label: '我的技能',  icon: Layers,        hint: '技能库 + 进度' },
  { id: 'sandbox',   label: '通用 AI',   icon: Sparkles,      hint: '不入公司 Memory 的个人沙盒' },
  { id: 'growth',    label: '成长',      icon: GraduationCap, hint: '学习路径 · 9-box · 360°' },
] as const;

// ────────────────────────────────────────────────────────────────
// 右召唤 (行动栏) tabs · 交付 / 待办 / AI 推荐
// 议事室、IM 是全局 rail 模块, 不在召唤栏重复.
// ────────────────────────────────────────────────────────────────
const RIGHT_TABS = [
  { id: 'deliver',   label: '交付',     icon: Send,    hint: '主舞台产出 → 议事室 / IM / 邮件 / Memory' },
  { id: 'inbox',     label: '待办',     icon: Inbox,   hint: '议事回写 · 搭子提醒' },
  { id: 'recommend', label: 'AI 推荐',  icon: Compass, hint: '搭子基于当前工作建议下一步' },
] as const;

type LeftTabId  = (typeof LEFT_TABS)[number]['id'];
type RightTabId = (typeof RIGHT_TABS)[number]['id'];

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
  // 召唤是临时调出, 两侧默认折叠
  const [leftTab,  setLeftTab]  = useState<LeftTabId  | null>(null);
  const [rightTab, setRightTab] = useState<RightTabId | null>(null);

  const sp = useSearchParams();
  const cardParam = sp?.get('card');
  const activeCard: CardId | null =
    cardParam && Object.prototype.hasOwnProperty.call(CARD_REGISTRY, cardParam)
      ? (cardParam as CardId)
      : null;

  const dashCtx = useDashboardFetch();

  return (
   <DashboardContext.Provider value={dashCtx}>
    <div className="relative flex h-full w-full surface-2">
      {/* ───────── 左召唤栏 (身份) · 桌面 ───────── */}
      <div className="hidden md:contents">
        <SummonRail
          side="left"
          tabs={LEFT_TABS}
          activeId={leftTab}
          onToggle={(id) => setLeftTab((cur) => (cur === id ? null : id))}
        />
        <SummonPanel
          side="left"
          tab={LEFT_TABS.find((t) => t.id === leftTab) ?? null}
          onClose={() => setLeftTab(null)}
        />
      </div>

      {/* ───────── 主舞台 ───────── */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-14 md:pb-0">
        {activeCard ? (
          <CardStage card={activeCard} />
        ) : (
          <WelcomeStage
            onSummonPersona={() => setLeftTab('persona')}
            onSummonDeliver={() => setRightTab('deliver')}
          />
        )}
      </main>

      {/* ───────── 右召唤栏 (行动) · 桌面 ───────── */}
      <div className="hidden md:contents">
        <SummonPanel
          side="right"
          tab={RIGHT_TABS.find((t) => t.id === rightTab) ?? null}
          onClose={() => setRightTab(null)}
        />
        <SummonRail
          side="right"
          tabs={RIGHT_TABS}
          activeId={rightTab}
          onToggle={(id) => setRightTab((cur) => (cur === id ? null : id))}
        />
      </div>

      {/* ───────── 移动端: 底部召唤条 + 弹起 sheet ───────── */}
      <MobileSummonBar
        leftActive={leftTab}
        rightActive={rightTab}
        onPickLeft={(id) => setLeftTab((cur) => (cur === id ? null : id))}
        onPickRight={(id) => setRightTab((cur) => (cur === id ? null : id))}
      />
      <MobileSummonSheet
        tab={
          LEFT_TABS.find((t) => t.id === leftTab) ??
          RIGHT_TABS.find((t) => t.id === rightTab) ??
          null
        }
        side={leftTab ? 'left' : 'right'}
        onClose={() => { setLeftTab(null); setRightTab(null); }}
      />
    </div>
   </DashboardContext.Provider>
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
  if (side === 'left'  && id === 'persona')   return <PersonaCard />;
  if (side === 'left'  && id === 'memory')    return <MemoryCard />;
  if (side === 'left'  && id === 'skills')    return <SkillsCard />;
  if (side === 'left'  && id === 'sandbox')   return <SandboxCard />;
  if (side === 'left'  && id === 'growth')    return <GrowthCard />;
  if (side === 'right' && id === 'deliver')   return <DeliverCard />;
  if (side === 'right' && id === 'inbox')     return <InboxCard />;
  if (side === 'right' && id === 'recommend') return <RecommendCard />;
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

function DeliverCard() {
  const router = useRouter();
  const [target, setTarget] = useState<DeliverTarget>('decision');
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk]   = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true); setErr(null); setOk(null);
    try {
      if (target === 'decision') {
        // 创建议事室 (POST /api/convergence)
        const res = await fetch('/api/convergence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: body.trim(),
            // KR 软绑定守门: 走 noKrReason 通道, 后续在议事室页内绑 KR
            noKrReason: '从 Tandem 个人工作台快速发起, 进议事室后绑定 KR',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setOk('已发起议事 · 跳转中…');
        setTimeout(() => router.push(`/convergence/${data.cardId}`), 400);
      } else {
        // im / mail / memory: 写 sessionStorage 作为预填载荷, 由目标页消费
        const payload = { title: title.trim(), body: body.trim(), from: '/tandem' };
        try {
          sessionStorage.setItem(`tandem.handoff.${target}`, JSON.stringify(payload));
        } catch {}
        const dest = target === 'im' ? '/im' : target === 'mail' ? '/mail' : '/memories';
        setOk('已存草稿 · 跳转中…');
        setTimeout(() => router.push(dest), 400);
      }
    } catch (e) {
      setErr((e as Error).message ?? '送出失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-caption text-secondary leading-relaxed">
        把主舞台和搭子的协作产出送出去 · 进入对应模块继续完善。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DELIVER_TARGETS.map((t) => {
          const Icon = t.icon;
          const active = target === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTarget(t.id)}
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
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        maxLength={120}
        className="w-full rounded-md border bg-[rgb(var(--surface-2))] px-2 py-1.5 text-caption text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="说明 / 摘要 (可选)"
        rows={3}
        maxLength={1000}
        className="w-full resize-none rounded-md border bg-[rgb(var(--surface-2))] px-2 py-1.5 text-caption text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
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
        {target === 'memory'   && '草稿存到 sessionStorage, /memories 页消费 (P2 实装直送)。'}
        {target === 'im'       && '草稿存到 sessionStorage, /im 选频道发送 (P2 一键送)。'}
        {target === 'mail'     && '草稿存到 sessionStorage, /mail 写邮件 (P2 一键送)。'}
      </p>
    </form>
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

// ── Skills: 我的技能 (链接到主分身页 + Tandem-Skills 库) ────────────
function SkillsCard() {
  return (
    <div className="space-y-2">
      <p className="text-caption text-secondary leading-relaxed">
        搭子的能力随你的训练成长 · 技能树 / 进度 / 认证。
      </p>
      <Link
        href="/persona?tab=skills"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <Layers className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        我的搭子技能 + 进度
      </Link>
      <Link
        href="/admin/tandem-skills"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <ClipboardCheck className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        全公司技能库
      </Link>
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

// ── Growth: 学习 / 9-Box / 360 ────────────────────────────────────
function GrowthCard() {
  return (
    <div className="space-y-2">
      <p className="text-caption text-secondary leading-relaxed">
        我的成长地图 · 学习路径 / 9-Box 落点 / 360°反馈。
      </p>
      <Link
        href="/learning"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <GraduationCap className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        学习路径
      </Link>
      <Link
        href="/360"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <Compass className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        360° 反馈
      </Link>
      <Link
        href="/persona?tab=nine-box"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
        style={{ borderColor: 'rgb(var(--border-subtle))' }}
      >
        <TrendingUp className="h-4 w-4 text-[rgb(var(--brand-500))]" />
        9-Box 我的落点
      </Link>
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

// ── Recommend: 搭子基于当前信号建议下一步 ──────────────────────────
function RecommendCard() {
  const { dashboard, retros, loading } = useTandemDashboard();
  if (loading) return <SkeletonRows />;
  const recs = buildRecommendations(dashboard, retros);
  if (recs.length === 0) {
    return (
      <div className="surface-card-soft rounded-2xl p-4 shadow-soft-xs text-caption text-secondary">
        没有强信号。试试问中央 (⌘J)：「下半天我应该聚焦什么？」
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
          <span>Tandem · 个人工作台</span>
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
        Tandem 个人工作台 · 1 舞台 + 2 召唤 · 你 ↔ 搭子 ↔ Tandem AI 三层协作
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

// ════════════════════════════════════════════════════════════════
// 移动端: 底部召唤条 (固定, 56px) + 全屏 sheet
// ════════════════════════════════════════════════════════════════
function MobileSummonBar({
  leftActive,
  rightActive,
  onPickLeft,
  onPickRight,
}: {
  leftActive:  LeftTabId  | null;
  rightActive: RightTabId | null;
  onPickLeft:  (id: LeftTabId)  => void;
  onPickRight: (id: RightTabId) => void;
}) {
  return (
    <nav
      aria-label="移动端召唤栏"
      className="fixed inset-x-0 bottom-0 z-40 flex md:hidden h-14 items-center justify-around border-t surface-1"
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      {LEFT_TABS.slice(0, 3).map((t) => {
        const Icon = t.icon;
        const active = leftActive === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPickLeft(t.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 surface-interactive',
              active ? 'text-[rgb(var(--brand-600))]' : 'text-tertiary',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[10px]">{t.label}</span>
          </button>
        );
      })}
      <div className="w-px h-6 bg-[rgb(var(--border-subtle))]" aria-hidden />
      {RIGHT_TABS.map((t) => {
        const Icon = t.icon;
        const active = rightActive === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPickRight(t.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 surface-interactive',
              active ? 'text-[rgb(var(--brand-600))]' : 'text-tertiary',
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

function MobileSummonSheet({
  tab,
  side,
  onClose,
}: {
  tab: SummonTab | null;
  side: 'left' | 'right';
  onClose: () => void;
}) {
  if (!tab) return null;
  const Icon = tab.icon;
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
      />
      <aside
        role="dialog"
        aria-label={`${tab.label} 召唤面板`}
        className="fixed inset-x-0 bottom-14 z-50 md:hidden max-h-[70vh] overflow-y-auto rounded-t-2xl surface-1 shadow-soft-xl"
      >
        <header className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-[rgb(var(--brand-500))]" />
            <h2 className="text-headline text-primary">{tab.label}</h2>
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
          <p className="text-caption text-tertiary mb-3">{tab.hint}</p>
          <SummonPanelContent id={tab.id} side={side} />
        </div>
      </aside>
    </>
  );
}
