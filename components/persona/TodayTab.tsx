'use client';

/**
 * TodayTab · 今日课表
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md § 5.1
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - 内容卡 = surface-card (Notion-density)
 *   - 强调色用 CSS var (semantic-warning / semantic-danger / brand-500)
 *   - 标题 text-headline (18px), 不用 raw text-base font-semibold
 *
 * P1.5 真接入:
 *   - brief 改为 useStreamingBrief(userId) 流式 LLM
 *   - 下节课改为 fetch /api/learning/recommend?userId=...
 */

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  SKILL_MODES,
  isSkillMode,
  type SkillMode,
} from '@/lib/persona/skill-modes';
import { getMockProficiencies } from '@/lib/persona/maturity';

// ---------------------------------------------------------------------------
// Mock 数据 (P1)
// ---------------------------------------------------------------------------

interface BriefItem {
  kind: 'waiting' | 'running';
  emoji: string;
  title: string;
  desc: string;
  href?: string;
}

interface NextLesson {
  id: string;
  title: string;
  mode: SkillMode | null;
  estMinutes: number;
  requirement: 'mandatory' | 'recommended';
  href: string;
}

const MOCK_BRIEF_ITEMS: BriefItem[] = [
  {
    kind: 'waiting',
    emoji: '🔴',
    title: 'KR-3「DAU 增长」off-track 已 5 天',
    desc: '建议召唤 战略模式 复盘卡点',
    href: '/okr?owner=me',
  },
  {
    kind: 'waiting',
    emoji: '🟡',
    title: '5min 日报今日还没写',
    desc: '建议召唤 PM 模式 起草日报',
    href: '/report',
  },
  {
    kind: 'running',
    emoji: '🟢',
    title: 'KR-1 / KR-2 在轨',
    desc: '本周回顾建议周五 16:00 完成',
  },
];

const MOCK_NEXT_LESSONS: NextLesson[] = [
  {
    id: 'L-strategy-okr-recovery',
    title: 'KR-3 卡点复盘 · 战略模式必修',
    mode: 'strategy',
    estMinutes: 18,
    requirement: 'mandatory',
    href: '/learning/tracks',
  },
  {
    id: 'L-pm-daily-report',
    title: '5min 日报实操 · PM 模式',
    mode: 'pm',
    estMinutes: 5,
    requirement: 'recommended',
    href: '/learning/processes',
  },
];

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function TodayTab() {
  const params = useSearchParams();
  const modeParam = params.get('mode');
  const currentMode: SkillMode | null = isSkillMode(modeParam)
    ? modeParam
    : null;
  const proficiencies = getMockProficiencies();

  const waiting = MOCK_BRIEF_ITEMS.filter((i) => i.kind === 'waiting');
  const running = MOCK_BRIEF_ITEMS.filter((i) => i.kind === 'running');

  return (
    <div className="space-y-4">
      <BriefCard waiting={waiting} running={running} />
      <NextLessonsCard lessons={MOCK_NEXT_LESSONS} />
      {currentMode && (
        <ActiveModeCard mode={currentMode} score={proficiencies[currentMode]} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · brief 卡
// ---------------------------------------------------------------------------

function BriefCard({
  waiting,
  running,
}: {
  waiting: BriefItem[];
  running: BriefItem[];
}) {
  return (
    <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-headline text-primary">📋 主分身今日 brief</h2>
        <span className="pill-neutral">mock · P1.5 真接</span>
      </header>

      {waiting.length > 0 && (
        <div className="mt-4">
          <p
            className="mb-2 flex items-center gap-1.5 text-footnote font-semibold"
            style={{ color: 'rgb(var(--semantic-danger))' }}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {waiting.length} 件等你处理
          </p>
          <ul className="space-y-2">
            {waiting.map((it, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-2xl p-3"
                style={{
                  background: 'rgb(var(--semantic-danger) / 0.06)',
                  border: '1px solid rgb(var(--semantic-danger) / 0.18)',
                }}
              >
                <span className="shrink-0 text-headline leading-none">
                  {it.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-primary">
                    {it.title}
                  </p>
                  <p className="mt-0.5 text-caption text-secondary">
                    {it.desc}
                  </p>
                </div>
                {it.href && (
                  <Link
                    href={it.href}
                    className="surface-interactive shrink-0 rounded-md px-2.5 py-1 text-footnote font-medium text-white"
                    style={{ background: 'rgb(var(--brand-500))' }}
                  >
                    去处理
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {running.length > 0 && (
        <div className="mt-5">
          <p
            className="mb-2 flex items-center gap-1.5 text-footnote font-semibold"
            style={{ color: 'rgb(var(--semantic-success))' }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            在跑中
          </p>
          <ul className="space-y-1.5">
            {running.map((it, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-body text-secondary"
              >
                <span className="shrink-0 leading-none">{it.emoji}</span>
                <span>
                  <span className="font-medium text-primary">{it.title}</span>{' '}
                  <span className="text-tertiary">· {it.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · 下节课
// ---------------------------------------------------------------------------

function NextLessonsCard({ lessons }: { lessons: NextLesson[] }) {
  return (
    <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-headline text-primary flex items-center gap-2">
          <BookOpen
            className="h-5 w-5"
            style={{ color: 'rgb(var(--brand-500))' }}
          />
          📚 你的下节课
        </h2>
        <Link
          href="/learning"
          className="text-caption text-tertiary hover:text-primary"
        >
          查看全部 →
        </Link>
      </header>

      <ul className="mt-4 space-y-2">
        {lessons.map((l) => {
          const modeMeta = l.mode ? SKILL_MODES[l.mode] : null;
          return (
            <li key={l.id}>
              <Link
                href={l.href}
                className="surface-card-soft surface-interactive flex items-center gap-3 p-3 hover:shadow-soft-sm"
              >
                <span className="text-title-3 leading-none shrink-0">
                  {l.requirement === 'mandatory' ? '🔴' : '🟡'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-primary">
                    {l.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-footnote text-tertiary">
                    {modeMeta && (
                      <span className="inline-flex items-center gap-0.5">
                        <span>{modeMeta.emoji}</span>
                        <span>{modeMeta.label}</span>
                      </span>
                    )}
                    <span>·</span>
                    <span>{l.estMinutes} min</span>
                    <span>·</span>
                    <span
                      className="font-medium"
                      style={{
                        color:
                          l.requirement === 'mandatory'
                            ? 'rgb(var(--semantic-danger))'
                            : 'rgb(var(--text-tertiary))',
                      }}
                    >
                      {l.requirement === 'mandatory' ? '必修' : '推荐'}
                    </span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-tertiary" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · 当前主修详情 (披着外套时)
// ---------------------------------------------------------------------------

function ActiveModeCard({
  mode,
  score,
}: {
  mode: SkillMode;
  score: number | undefined;
}) {
  const meta = SKILL_MODES[mode];
  const labels: Record<SkillMode, { tip: string; tools: string }> = {
    design: {
      tip: '关注 用户目标 / 信息架构 / 视觉层级 / 可访问性',
      tools: 'Figma · FigJam · Stripe Dashboard 参考库',
    },
    pm: {
      tip: '关注 用户价值 / ROI / 工程成本 · RICE / MoSCoW',
      tools: 'Linear · Notion PRD · Tandem 决议卡',
    },
    tech: {
      tip: '先 audit 现状 → 最小变更 · 不假设不存在的 API',
      tools: 'Cursor · Claude Code · Hermes Agent',
    },
    marketing: {
      tip: '受众心智 · 渠道适配 · 数据可衡量',
      tools: 'Notion AI · Substack · Tandem Material',
    },
    strategy: {
      tip: '北极星 · 二阶效应 · 资源约束 · 反例',
      tools: 'OKR Cascade · 议事室 · 战略画布',
    },
  };
  const info = labels[mode];

  return (
    <section
      className="rounded-2xl border-2 border-dashed p-4 sm:p-5"
      style={{
        borderColor: 'rgb(var(--border-default))',
        background: 'rgb(var(--surface-2))',
      }}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-headline text-primary">
          当前披着 {meta.emoji} {meta.label}
        </h3>
        {typeof score === 'number' && (
          <span className="font-mono text-caption text-secondary">
            专长度 {score}/100
          </span>
        )}
      </header>
      <p className="mt-2 text-caption text-primary">
        <span className="font-semibold">提醒:</span> {info.tip}
      </p>
      <p className="mt-1 text-caption text-secondary">
        <span className="font-semibold">推荐工具:</span> {info.tools}
      </p>
      <p className="mt-2 text-footnote text-tertiary">
        整体学位 (stage) 不变 · 单分身一致性铁律 (MANIFESTO §13.2)
      </p>
    </section>
  );
}
