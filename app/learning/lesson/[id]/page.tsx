'use client';

/**
 * /learning/lesson/[id] · 课时学习页
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md Phase 2.1
 * 数据源: GET /api/learning/lessons/[id] (真 store.lessons CMS).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { LessonViewer } from '@/components/learning/LessonViewer';
import type { Lesson } from '@/lib/learning/types';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading');

  useEffect(() => {
    fetch(`/api/learning/lessons/${id}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        setLesson(j.lesson as Lesson);
        setStatus('ok');
      })
      .catch(() => setStatus('notfound'));
  }, [id]);

  if (status === 'loading') {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12 flex items-center justify-center text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载课程…
      </main>
    );
  }

  if (status === 'notfound' || !lesson) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-title-2 text-primary">课程未找到</h1>
        <p className="mt-2 text-body text-secondary">
          ID <code className="font-mono text-primary">{id}</code> 未匹配已发布课程.
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
