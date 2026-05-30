'use client';

/**
 * CourseTabs · 学员主页 4 面 tab
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - surface-card 容器 (white + subtle border + soft shadow)
 *   - active = 品牌色 (rheem red 反白)
 *   - hover = surface-2 微弱反馈
 *   - 字体 text-caption (13px), 不再用 raw text-sm
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export type PersonaTab = 'today' | 'archive';

interface TabDef {
  id: PersonaTab | 'training' | 'delegation';
  label: string;
  emoji: string;
  externalHref?: string;
}

const TABS: TabDef[] = [
  { id: 'today', label: '今日课表', emoji: '📋' },
  { id: 'archive', label: '实习日志', emoji: '📊' },
  {
    id: 'training',
    label: '培养计划',
    emoji: '🎯',
    externalHref: '/persona/training',
  },
  {
    id: 'delegation',
    label: '实习权限',
    emoji: '🔑',
    externalHref: '/persona/delegation',
  },
];

export interface CourseTabsProps {
  active: PersonaTab;
  /** badge 数字 (例: today=2 表示有 2 件待办) */
  badges?: Partial<Record<PersonaTab, number>>;
}

export function CourseTabs({ active, badges }: CourseTabsProps) {
  const params = useSearchParams();

  function buildHref(tab: PersonaTab): string {
    const next = new URLSearchParams(params.toString());
    next.set('tab', tab);
    return `/persona?${next.toString()}`;
  }

  return (
    <nav className="surface-card p-1.5">
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const isActive = !tab.externalHref && active === tab.id;
          const href = tab.externalHref ?? buildHref(tab.id as PersonaTab);
          const badge =
            !tab.externalHref && badges?.[tab.id as PersonaTab];
          return (
            <li key={tab.id}>
              <Link
                href={href}
                className="surface-interactive flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-caption font-medium"
                style={
                  isActive
                    ? {
                        background: 'rgb(var(--brand-500))',
                        color: '#fff',
                      }
                    : {
                        color: 'rgb(var(--text-secondary))',
                        background: 'transparent',
                      }
                }
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {badge ? (
                  <span
                    className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                    style={
                      isActive
                        ? {
                            background: '#fff',
                            color: 'rgb(var(--brand-700))',
                          }
                        : {
                            background: 'rgb(var(--brand-500))',
                            color: '#fff',
                          }
                    }
                  >
                    {badge}
                  </span>
                ) : null}
                {tab.externalHref && (
                  <span
                    className="ml-0.5 text-[10px]"
                    style={{
                      color: isActive
                        ? 'rgba(255,255,255,0.65)'
                        : 'rgb(var(--text-tertiary))',
                    }}
                  >
                    →
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function isPersonaTab(v: string | null | undefined): v is PersonaTab {
  return v === 'today' || v === 'archive';
}
