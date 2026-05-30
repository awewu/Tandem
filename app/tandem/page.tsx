'use client';

/**
 * /tandem — Tandem 个人工作台 (1 主舞台 + 2 召唤侧栏)
 *
 * 决议来源: docs/PLATFORM-ARCHITECTURE-2026-05-29.md
 *   D1 搭子 → Tandem
 *   D2 1 舞台 + 2 召唤: 左召唤 = 身份(我的分身/Memory/技能/通用AI/成长)
 *                       右召唤 = 行动(待办/议事/IM未读/AI推荐)
 *                       主舞台 ≥ 60% 屏宽
 *   D5 跳事半: 主舞台决策卡可跳 /decisions/[id]
 *   D14 通用 AI 沙盒: 左召唤 tab, 不入公司 Memory
 *
 * UI 铁律 (CHARTER-UI-V1):
 *   - 只用 surface-* / shadow-soft-* / .text-title-* / pill-* token
 *   - 卡片 rounded-2xl, Hero rounded-3xl
 *   - 不出现 bg-slate-* / shadow-sm 等 raw tailwind
 *
 * Phase 1 = 骨架壳, 不实装数据. 占位卡 + 召唤展开/折叠交互齐全.
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  GraduationCap,
  Inbox,
  Layers,
  Sparkles,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────
// 左召唤 (身份栏) tabs
// ────────────────────────────────────────────────────────────────
const LEFT_TABS = [
  { id: 'persona',   label: '我的分身',  icon: Bot,         hint: '主分身今日 brief 与代办' },
  { id: 'memory',    label: 'Memory',    icon: Brain,       hint: '我签名的决议 / 复盘 / 灵感' },
  { id: 'skills',    label: '我的技能',  icon: Layers,      hint: '技能库 + 进度' },
  { id: 'sandbox',   label: '通用 AI',   icon: Sparkles,    hint: 'GPT · Kimi · 自建 LLM 沙盒 (不入档)' },
  { id: 'growth',    label: '成长',      icon: GraduationCap, hint: '学习路径 · 9-box · 360°' },
] as const;

// ────────────────────────────────────────────────────────────────
// 右召唤 (行动栏) tabs
// ────────────────────────────────────────────────────────────────
const RIGHT_TABS = [
  { id: 'inbox',     label: '待办',     icon: Inbox,    hint: '议事室回写 · IM 升起 · OKR 推进' },
  { id: 'meetings',  label: '议事',     icon: Workflow, hint: '今日议事 · 17min 收敛队列' },
  { id: 'im',        label: 'IM 未读',  icon: Users,    hint: '@我 · 群公告 · 紧急' },
  { id: 'recommend', label: 'AI 推荐',  icon: Compass,  hint: '主分身建议下一步' },
] as const;

type LeftTabId  = (typeof LEFT_TABS)[number]['id'];
type RightTabId = (typeof RIGHT_TABS)[number]['id'];

// ────────────────────────────────────────────────────────────────
export default function TandemPage() {
  // 召唤侧栏: 默认折叠成图标条 (collapsed), 点击 tab 展开为 280px 面板
  const [leftTab,  setLeftTab]  = useState<LeftTabId  | null>(null);
  const [rightTab, setRightTab] = useState<RightTabId | null>('inbox'); // 默认右召唤展开"待办"

  return (
    <div className="flex h-full w-full surface-2">
      {/* ───────── 左召唤栏 (身份) ───────── */}
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

      {/* ───────── 主舞台 (≥60%) ───────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Stage />
      </main>

      {/* ───────── 右召唤栏 (行动) ───────── */}
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
        'flex w-12 shrink-0 flex-col items-center gap-1 py-3 surface-1',
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
// 召唤面板 (展开后 280px)
// ════════════════════════════════════════════════════════════════
interface SummonPanelProps {
  side: 'left' | 'right';
  tab: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; hint: string } | null;
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
        'flex w-[280px] shrink-0 flex-col overflow-hidden surface-1',
        side === 'left' ? 'border-r' : 'border-l',
      )}
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      {/* 面板头 */}
      <header className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'rgb(var(--border-subtle))' }}>
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

      {/* 面板内容 — Phase 1 占位, 后续按 tab.id 分支接真实数据 */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-caption text-tertiary mb-3">{tab.hint}</p>
        <SummonPanelStub id={tab.id} side={side} />
      </div>
    </aside>
  );
}

// 各 tab 占位卡 — Phase 2 替换为真实组件
function SummonPanelStub({ id, side }: { id: string; side: 'left' | 'right' }) {
  // 简单占位卡, 不放假数据避免误导
  return (
    <div className="surface-card-soft rounded-2xl p-4 shadow-soft-xs">
      <div className="text-caption text-secondary leading-relaxed">
        <span className="pill-neutral mb-2">P1 骨架</span>
        <p className="mt-2">
          {side === 'left' ? '身份' : '行动'}召唤 · <code className="text-primary">{id}</code> 面板待接入真实数据。
        </p>
        <p className="mt-2 text-tertiary">
          见 <code>docs/PLATFORM-ARCHITECTURE-2026-05-29.md</code> §5 Phase 2.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 主舞台 — 当前任务 / 决策卡 / 文档 / 主分身对话
// ════════════════════════════════════════════════════════════════
function Stage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      {/* Hero — Tandem 个人工作台引导 */}
      <section className="hero-ink rounded-3xl p-8 shadow-soft-lg">
        <div className="flex items-center gap-2 text-white/70 text-caption mb-3">
          <Sparkles className="h-4 w-4" />
          <span>Tandem · 个人工作台</span>
        </div>
        <h1 className="text-title-1 text-white">
          欢迎回来.
        </h1>
        <p className="mt-3 text-body text-white/75 max-w-2xl">
          这是你的主舞台. 左侧召唤身份 (分身 / Memory / 技能 / 通用 AI / 成长),
          右侧召唤行动 (待办 / 议事 / IM / AI 推荐).
          决策卡 / 文档 / 主分身对话框在此展开.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/persona"
            className="inline-flex items-center gap-2 rounded-full bg-white text-[rgb(var(--rheem-ink-black))] px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/90"
          >
            <Bot className="h-4 w-4" /> 召唤主分身
          </Link>
          <Link
            href="/okr?owner=me"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/10"
          >
            <Target className="h-4 w-4" /> 我的 OKR
          </Link>
          <Link
            href="/report"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/10"
          >
            <FileText className="h-4 w-4" /> 5min 日报
          </Link>
        </div>
      </section>

      {/* 主舞台内容区 — Phase 1 = 引导卡 + 入口卡 */}
      <section className="grid gap-4 sm:grid-cols-2">
        <StageCard
          title="当前决策卡"
          desc="议事室未结案的决策、需我表态的提案."
          href="/decisions"
          icon={Target}
        />
        <StageCard
          title="今日文档"
          desc="昨日协作过的文档、待我审阅的草稿."
          href="/documents"
          icon={FileText}
        />
        <StageCard
          title="主分身对话"
          desc="与我的 AI 分身协作起草、回邮、复盘."
          href="/persona"
          icon={Bot}
        />
        <StageCard
          title="我的代表作"
          desc="自动聚合的日报 / 复盘 / 议事发言, 标星沉淀."
          href="/portfolio"
          icon={Sparkles}
        />
      </section>

      {/* 锚定脚注 — 告诉用户这是 P1 骨架 */}
      <footer className="text-footnote text-tertiary text-center pt-2">
        Tandem v1.0 骨架 · 主舞台 ≥ 60% · 召唤侧栏 280px ·
        见 <code>docs/PLATFORM-ARCHITECTURE-2026-05-29.md</code>
      </footer>
    </div>
  );
}

function StageCard({
  title,
  desc,
  href,
  icon: Icon,
}: {
  title: string;
  desc: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group surface-card rounded-2xl p-5 shadow-soft-xs surface-interactive hover:shadow-soft-sm"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-[rgb(var(--brand-50))] p-2 text-[rgb(var(--brand-600))]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-title-3 text-primary group-hover:text-[rgb(var(--brand-700))]">{title}</h3>
          <p className="mt-1 text-caption text-secondary">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
