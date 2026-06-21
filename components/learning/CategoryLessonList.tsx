'use client';

/**
 * CategoryLessonList · 单分类课程列表
 * 复用于 onboarding / compliance / products / processes / tracks / certifications 页
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, CheckCircle2, Clock3, Lock, Loader2, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import { FIXTURE_LESSONS } from '@/lib/learning/fixtures';
import type { Lesson, LessonCategory } from '@/lib/learning/types';

const REQ_LABEL: Record<string, string> = {
  mandatory_once: '一次性必修',
  mandatory_quarterly: '季度必修',
  recommended: '推荐',
};
const REQ_COLOR: Record<string, string> = {
  mandatory_once: 'bg-danger/10 text-danger',
  mandatory_quarterly: 'bg-warning/10 text-warning',
  recommended: 'bg-surface-3 text-ink-secondary',
};

interface Props {
  category: LessonCategory;
  title: string;
  subtitle: string;
  backHref?: string;
}

export function CategoryLessonList({ category, title, subtitle, backHref = '/learning' }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/learning/lessons', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const all: Lesson[] = j.lessons ?? [];
        const src = all.length > 0 ? all : FIXTURE_LESSONS;
        setLessons(src.filter((l) => l.category === category));
        setStatus('ok');
      })
      .catch(() => {
        setLessons(FIXTURE_LESSONS.filter((l) => l.category === category));
        setStatus('error');
      });
  }, [category]);

  useEffect(() => {
    fetch('/api/learning/progress', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setCompletedIds(new Set<string>(j.completedLessonIds ?? [])))
      .catch(() => {
        /* 进度加载失败退化为未完成态 */
      });
  }, []);

  const completedInCat = lessons.filter((l) => completedIds.has(l.id)).length;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 space-y-5">
      {/* back */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-caption text-ink-secondary hover:text-ink-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回学习中心
      </Link>

      {/* header */}
      <div className="hero-ink p-5 sm:p-7 space-y-1">
        <h1 className="text-title-3 font-bold text-white flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: 'rgb(var(--brand-300))' }} />
          {title}
        </h1>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.65)' }}>{subtitle}</p>
        {lessons.length > 0 && (
          <p className="text-footnote pt-1" style={{ color: 'rgb(var(--brand-300))' }}>
            已完成 {completedInCat} / {lessons.length} 课
          </p>
        )}
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning bg-warning/5 px-4 py-3 text-caption text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> API 加载失败，显示内置示例课程
        </div>
      )}

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16 text-ink-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载课程…
        </div>
      )}

      {status !== 'loading' && lessons.length === 0 && (
        <div className="surface-card p-8 text-center text-ink-secondary text-caption">
          该分类暂无课程，管理员可在 <Link href="/admin/learning" className="underline">学院管理</Link> 中发布。
        </div>
      )}

      {status !== 'loading' && lessons.length > 0 && (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/learning/lesson/${lesson.id}`}
              className="surface-card flex items-start gap-4 p-4 hover:border-brand-200 surface-interactive transition"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink-secondary">
                {lesson.requirement === 'mandatory_quarterly' ? (
                  <Lock className="h-4 w-4 text-warning" />
                ) : lesson.requirement === 'mandatory_once' ? (
                  <CheckCircle2 className="h-4 w-4 text-danger" />
                ) : (
                  <BookOpen className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption font-medium text-ink-primary truncate">{lesson.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${REQ_COLOR[lesson.requirement] ?? 'bg-surface-3 text-ink-secondary'}`}>
                    {REQ_LABEL[lesson.requirement] ?? lesson.requirement}
                  </span>
                  {completedIds.has(lesson.id) && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" /> 已完成
                    </span>
                  )}
                </div>
                {lesson.summary && (
                  <p className="mt-0.5 text-footnote text-ink-tertiary line-clamp-2">{lesson.summary}</p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-footnote text-ink-tertiary">
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3" /> {lesson.durationMin} 分钟
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
