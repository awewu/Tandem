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
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Cpu,
  ExternalLink,
  FileText,
  GraduationCap,
  Inbox,
  Layers,
  Megaphone,
  MessageSquare,
  Palette,
  Send,
  Sparkles,
  Target,
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
    deepLink: { href: '/decisions/new',  label: '到议事室创建正式决策卡' },
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

  return (
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
  if (side === 'left'  && id === 'persona') return <PersonaCard />;
  if (side === 'right' && id === 'deliver') return <DeliverCard />;
  return <StubCard id={id} side={side} />;
}

function PersonaCard() {
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
            <p className="text-footnote text-tertiary">就绪 · 代行权限: 基础</p>
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

function DeliverCard() {
  const targets = [
    { id: 'decisions', label: '送到议事室',     href: '/decisions/new',           icon: Target },
    { id: 'im',        label: '送到 IM',         href: '/im',                      icon: MessageSquare },
    { id: 'mail',      label: '送到邮件',         href: '/mail/compose',            icon: Send },
    { id: 'memory',    label: '沉淀到 Memory',  href: '/company-brain',           icon: Brain },
  ];
  return (
    <div className="space-y-2">
      <p className="text-caption text-secondary leading-relaxed">
        把主舞台上和搭子协作的产出送出去。<span className="text-tertiary">(P1 = 入口, 实际送出待接 Bridges)</span>
      </p>
      {targets.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={t.href}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-caption text-primary hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
            style={{ borderColor: 'rgb(var(--border-subtle))' }}
          >
            <Icon className="h-4 w-4 text-[rgb(var(--brand-500))]" />
            {t.label}
          </Link>
        );
      })}
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

      <section className="surface-card-soft rounded-2xl p-6 shadow-soft-xs min-h-[200px]">
        <div className="flex items-center gap-2 text-caption text-tertiary mb-3">
          <Bot className="h-4 w-4" />
          <span>搭子在线 · 等你开始</span>
        </div>
        <p className="text-body text-secondary leading-relaxed">
          这里展开「{meta.title}」的协作界面。<br />
          <span className="text-tertiary">P1 = 入口骨架, P2 接入实际编辑器 / 对话流 / 决议起草组件。</span>
        </p>
        <Link
          href={meta.deepLink.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--brand-500))] text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-[rgb(var(--brand-600))]"
        >
          {meta.deepLink.label} <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
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
