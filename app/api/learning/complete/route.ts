/**
 * POST /api/learning/complete
 *
 * 完成一节课的真闭环入口 (Phase 2.1).
 *
 * 输入: { lessonId, score, userId? }
 * 行为:
 *   1. 找 lesson (P1: fixtures, P2: db)
 *   2. 构造 LessonAttempt
 *   3. 调 lib/learning/closure.ts onLessonCompleted (KR 推流 + Proficiency + Cert + Memory + Audit)
 *   4. 返回 ClosureResult 给前端展示
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 */

import { NextResponse, type NextRequest } from 'next/server';
import { FIXTURE_LESSONS } from '@/lib/learning/fixtures';
import { onLessonCompleted } from '@/lib/learning/closure';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import type { LessonAttempt } from '@/lib/learning/types';

export const runtime = 'nodejs';

interface CompleteBody {
  lessonId?: string;
  score?: number;
  userId?: string;
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: CompleteBody;
  try {
    body = (await req.json()) as CompleteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  const { lessonId, score = 100 } = body;
  // 真扭转: userId 从 auth 取, 不接受 body 覆盖 (防越权写他人 Persona)
  const userId = auth.userId;

  if (!lessonId) {
    return NextResponse.json(
      { ok: false, error: 'MISSING_LESSON_ID' },
      { status: 400 },
    );
  }

  const lesson = FIXTURE_LESSONS.find((l) => l.id === lessonId);
  if (!lesson) {
    return NextResponse.json(
      { ok: false, error: 'LESSON_NOT_FOUND', lessonId },
      { status: 404 },
    );
  }

  const passed = score >= 60;

  const attempt: LessonAttempt = {
    id: `attempt_${Date.now()}`,
    lessonId,
    userId,
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    completedAt: new Date().toISOString(),
    score,
    passed,
  };

  if (!passed) {
    return NextResponse.json({
      ok: true,
      passed: false,
      attempt,
      effects: {},
      warnings: ['未通过 (score < 60), 不触发闭环'],
    });
  }

  const closure = await onLessonCompleted({ attempt, lesson });

  return NextResponse.json({
    ok: closure.success,
    passed: true,
    attempt,
    effects: closure.effects,
    warnings: closure.warnings,
  });
}
