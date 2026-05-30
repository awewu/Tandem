'use client';

/**
 * /learning/lesson/[id] · 课时学习页 (P1 stub)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md Phase 2.1
 *
 * 当前: 从 fixtures 找 lesson, 用 LessonViewer 渲染
 * P2 真接入: 服务端 fetch db Lesson + Question + Enrollment 状态
 */

import { use } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LessonViewer } from '@/components/learning/LessonViewer';
import { FIXTURE_LESSONS } from '@/lib/learning/fixtures';

export default function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const lesson = FIXTURE_LESSONS.find((l) => l.id === id);

  if (!lesson) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-title-2 text-primary">课程未找到</h1>
        <p className="mt-2 text-body text-secondary">
          ID <code className="font-mono text-primary">{id}</code> 不在当前
          fixtures 中.
        </p>
        <Link
          href="/learning"
          className="rheem-btn-pill mt-6 inline-flex"
          style={{ padding: '10px 22px', fontSize: 14 }}
        >
          返回课程目录
        </Link>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <LessonViewer lesson={lesson} />
    </main>
  );
}
