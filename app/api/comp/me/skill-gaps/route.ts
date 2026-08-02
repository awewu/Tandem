import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getEmployeeGradeView } from '@/lib/comp/grade-service';
import { matchGapToCourses } from '@/lib/comp/skill-course-link';

/**
 * GET /api/comp/me/skill-gaps — 查看我的技能缺口 + 推荐课程
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const view = await getEmployeeGradeView(auth.tenantId, auth.userId);
    if (view.status === 'notfound') {
      return NextResponse.json({ error: 'grade record not found' }, { status: 404 });
    }

    const gapSkills = view.nextLevel?.gapSkills ?? [];
    if (gapSkills.length === 0) {
      return NextResponse.json({ gaps: [], recommendations: [], message: '无技能缺口' });
    }

    // 从 store 加载学院课程
    const store = getStore();
    const lessons = await store.lessons.list();
    const lessonLites = lessons.map((l) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      category: l.category,
    }));

    const recommendations = matchGapToCourses(gapSkills, lessonLites);

    return NextResponse.json({
      gaps: gapSkills,
      recommendations,
      nextLevel: view.nextLevel?.level,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/me/skill-gaps' });
