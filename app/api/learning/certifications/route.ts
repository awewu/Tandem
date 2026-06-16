/**
 * GET /api/learning/certifications
 * 返回当前用户的所有认证记录（含关联课程标题）
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const [allCerts, allLessons] = await Promise.all([
    store.learningCertifications.list(),
    store.lessons.list(),
  ]);

  const lessonMap = new Map(allLessons.map((l) => [l.id, l.title]));
  const certs = allCerts
    .filter((c) => c.userId === auth.userId)
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
    .map((c) => ({ ...c, lessonTitle: lessonMap.get(c.lessonId) }));

  return NextResponse.json({ certifications: certs });
}
