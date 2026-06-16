'use client';

/**
 * Learning Center · 学习台 (P2 MVP)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - Hero = .hero-ink (深底 ink-black + brand 径向光)
 *   - 内容卡 = .surface-card (Notion-density)
 *   - 5 类别 = .rheem-tile 风格 (品牌红 portal 砖)
 *
 * 真扭转: 完成课时走 /api/learning/complete → closure.ts 写库.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileLock,
  GraduationCap,
  Layers,
  ScrollText,
  Sparkles,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { FIXTURE_LESSONS } from '@/lib/learning/fixtures';
import type { Lesson, LessonCategory } from '@/lib/learning/types';

const CATEGORY_META: Record<
  LessonCategory,
  { icon: typeof BookOpen; label: string; href: string }
> = {
  onboarding: {
    icon: GraduationCap,
    label: '入职必修',
    href: '/learning/onboarding',
  },
  compliance: {
    icon: FileLock,
    label: '合规与红线',
    href: '/learning/compliance',
  },
  products: { icon: Layers, label: '产品学院', href: '/learning/products' },
  processes: {
    icon: Workflow,
    label: '流程与标准',
    href: '/learning/processes',
  },
  tracks: { icon: TrendingUp, label: '专项进阶', href: '/learning/tracks' },
};

export default function LearningPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/learning/lessons', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const data: Lesson[] = j.lessons ?? [];
        setLessons(data.length > 0 ? data : FIXTURE_LESSONS);
        setLoadStatus('ok');
      })
      .catch(() => {
        setLessons(FIXTURE_LESSONS);
        setLoadStatus('error');
      });
  }, []);

  const grouped = useMemo(() => {
    const map: Partial<Record<LessonCategory, Lesson[]>> = {};
    for (const l of lessons) {
      (map[l.category] ??= []).push(l);
    }
    return map;
  }, [lessons]);

  const mandatory = useMemo(
    () => lessons.filter((l) => l.requirement === 'mandatory_once' || l.requirement === 'mandatory_quarterly'),
    [lessons],
  );
  const recommended = useMemo(
    () => lessons.filter((l) => l.requirement === 'recommended'),
    [lessons],
  );

  if (loadStatus === 'loading') {
    return (
      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        <div className="hero-ink p-6 sm:p-8 animate-pulse">
          <div className="h-7 w-48 rounded-lg bg-white/10" />
          <div className="mt-3 h-4 w-72 rounded bg-white/8" />
        </div>
        <div className="surface-card p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
      {loadStatus === 'error' && (
        <div
          role="status"
          className="rounded-2xl border-l-4 border-warning bg-warning/5 px-4 py-3 shadow-soft-xs"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-warning mt-0.5" />
            <div className="min-w-0">
              <p className="text-headline text-ink-primary">
                课程数据加载失败 · 显示示例课程
              </p>
              <p className="mt-1 text-caption text-ink-secondary">
                无法连接学院 API，当前显示内置示例课程。刷新页面重试。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== Hero · 深底品牌 ===== */}
      <section className="hero-ink p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-title-2 inline-flex items-center gap-2.5 text-white">
              <BookOpen
                className="h-7 w-7"
                style={{ color: 'rgb(var(--brand-300))' }}
              />
              课程目录 · Academy
            </h1>
            <p
              className="mt-2 text-body"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              📚 教务系统 · 学院架构 · 今日{' '}
              <span className="font-mono font-semibold text-white">
                {mandatory.length}
              </span>{' '}
              门必修 +{' '}
              <span className="font-mono font-semibold text-white">
                {recommended.length}
              </span>{' '}
              门推荐
            </p>
            <p
              className="mt-2 text-caption"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <Link
                href="/persona"
                className="underline hover:text-white"
                style={{ color: 'rgb(var(--brand-300))' }}
              >
                查看我的学员页 →
              </Link>{' '}
              · 通过课程解锁 实习权限 + 提升 主修 GPA
            </p>
          </div>
          <span className="pill-on-dark shrink-0">学院 v0.2</span>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <HeroStat
            value={mandatory.length}
            label="必修待完成"
            tone="danger"
          />
          <HeroStat value={recommended.length} label="推荐学习" tone="info" />
          <HeroStat value={0} label="已认证 (本季)" tone="success" />
        </div>
      </section>

      {/* 必修区 (置顶) */}
      {mandatory.length > 0 && (
        <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
          <h2
            className="mb-4 flex items-center gap-2 text-headline"
            style={{ color: 'rgb(var(--brand-700))' }}
          >
            <Sparkles className="h-5 w-5" />
            ⚠️ 必修待完成 · {mandatory.length} 门
          </h2>
          <ul className="space-y-2">
            {mandatory.map((l) => (
              <LessonRow key={l.id} lesson={l} />
            ))}
          </ul>
        </section>
      )}

      {/* 5 大类别入口 */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(CATEGORY_META) as LessonCategory[]).map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const count = grouped[cat]?.length ?? 0;
          return (
            <Link
              key={cat}
              href={meta.href}
              className="rheem-tile launchpad-narrow"
            >
              <Icon className="rheem-tile-icon" />
              <span className="rheem-tile-label">{meta.label}</span>
              <span
                className="text-footnote"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {count} 课
              </span>
            </Link>
          );
        })}
      </section>

      {/* 推荐区 */}
      {recommended.length > 0 && (
        <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
          <h2 className="mb-4 flex items-center gap-2 text-headline text-primary">
            <CheckCircle2
              className="h-5 w-5"
              style={{ color: 'rgb(var(--semantic-success))' }}
            />
            主分身推荐: {recommended.length} 门
          </h2>
          <ul className="space-y-2">
            {recommended.map((l) => (
              <LessonRow key={l.id} lesson={l} />
            ))}
          </ul>
        </section>
      )}

      {/* 我的认证入口 */}
      <Link
        href="/learning/certifications"
        className="surface-card-soft surface-interactive flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-body text-secondary"
        style={{ borderColor: 'rgb(var(--border-default))' }}
      >
        <ScrollText className="h-5 w-5" />
        查看我的认证
      </Link>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

function HeroStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'danger' | 'info' | 'success';
}) {
  const accent = {
    danger: 'rgb(var(--brand-300))',
    info: '#60A5FA',
    success: 'rgb(74, 222, 128)',
  }[tone];
  return (
    <div
      className="rounded-2xl p-3.5 text-center"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <p className="font-mono text-title-3 font-bold" style={{ color: accent }}>
        {value}
      </p>
      <p
        className="mt-1 text-[10px] uppercase tracking-wide"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        {label}
      </p>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  const reqBadge =
    lesson.requirement === 'mandatory_once'
      ? '必修'
      : lesson.requirement === 'mandatory_quarterly'
        ? '季度必修'
        : lesson.requirement === 'recommended'
          ? '推荐'
          : '选修';
  const isMandatory = lesson.requirement.startsWith('mandatory');

  return (
    <li className="surface-card-soft surface-interactive flex items-start gap-3 p-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="rounded-md px-1.5 py-0.5 text-footnote font-semibold"
            style={
              isMandatory
                ? {
                    background: 'rgb(var(--brand-50))',
                    color: 'rgb(var(--brand-700))',
                  }
                : {
                    background: 'rgb(var(--surface-3))',
                    color: 'rgb(var(--text-secondary))',
                  }
            }
          >
            {reqBadge}
          </span>
          <h3 className="text-body font-medium text-primary">{lesson.title}</h3>
        </div>
        <p className="mt-1 text-caption text-secondary">{lesson.summary}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-tertiary">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> {lesson.durationMin} min
          </span>
          {lesson.rewardMode && lesson.rewardScore && (
            <span style={{ color: 'rgb(var(--brand-600))' }}>
              + {lesson.rewardScore} 分 → {lesson.rewardMode} 主修
            </span>
          )}
          {lesson.linkedKrId && (
            <span style={{ color: 'rgb(var(--semantic-success))' }}>
              完成 → 推流 KR-{lesson.linkedKrId}
            </span>
          )}
        </div>
      </div>
      <Link
        href={`/learning/lesson/${lesson.id}`}
        className="rheem-btn-pill shrink-0"
        style={{ padding: '6px 14px', fontSize: 12 }}
      >
        开始学习
      </Link>
    </li>
  );
}
