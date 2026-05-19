/**
 * POST /api/360/submissions   — submit a review (rater 视角)
 *   body: { cycleId, subjectId, raterType, answers, strengths, improvements, overallScore? }
 *   raterId 由 auth 强制为 sessionUser.id (防伪造)
 *   - 校验 cycle.status === 'active'
 *   - 校验 raterType 一致性 (如有 assignment 必须匹配)
 *   - 标记对应 assignment 为 submitted
 *
 * GET /api/360/submissions?subjectId=...&cycleId=...
 *   - subject 自己读: peer 类 raterId 抹掉
 *   - HR/admin/cycle.createdBy: 看全
 *   - 其他: 仅看自己提交的
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { strip360SubmissionForViewer } from '@/lib/auth/strip';

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const { cycleId, subjectId, raterType, answers, strengths, improvements } = body;
    if (!cycleId || !subjectId || !raterType || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'cycleId, subjectId, raterType, answers required' },
        { status: 400 },
      );
    }
    const store = getStore();
    const cycle = await store.review360Cycles.get(cycleId);
    if (!cycle || cycle.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'cycle not found' }, { status: 404 });
    }
    if (cycle.status !== 'active') {
      return NextResponse.json({ error: 'cycle not active' }, { status: 400 });
    }
    // 防止 self-rating subject (除非 raterType=self)
    if (raterType === 'self' && subjectId !== auth.userId) {
      return NextResponse.json({ error: 'self rating only for self' }, { status: 400 });
    }
    if (raterType !== 'self' && subjectId === auth.userId) {
      return NextResponse.json({ error: 'cannot rate self with non-self type' }, { status: 400 });
    }

    const submission = await store.review360Submissions.create({
      cycleId,
      subjectId,
      raterId: auth.userId,
      raterType,
      answers,
      strengths: strengths ?? '',
      improvements: improvements ?? '',
      overallScore: typeof body.overallScore === 'number' ? body.overallScore : null,
      submittedAt: new Date().toISOString(),
    });

    // 标记 assignment 为 submitted (如有)
    const assignments = await store.review360Assignments.list({ cycleId });
    const match = assignments.find(
      (a) => a.subjectId === subjectId && a.raterId === auth.userId,
    );
    if (match && !match.submitted) {
      await store.review360Assignments.update(match.id, {
        submitted: true,
        submittedAt: submission.submittedAt,
      });
    }

    return NextResponse.json({ submission });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const subjectId = searchParams.get('subjectId');
    const store = getStore();

    let all = await store.review360Submissions.list();
    if (cycleId) all = all.filter((s) => s.cycleId === cycleId);
    if (subjectId) all = all.filter((s) => s.subjectId === subjectId);

    if (all.length === 0) return NextResponse.json({ submissions: [] });

    // 拉对应 cycle 信息 (检查 anonymizePeers + tenant 校验)
    const cycleIds = Array.from(new Set(all.map((s) => s.cycleId)));
    const cycles = await Promise.all(cycleIds.map((id) => store.review360Cycles.get(id)));
    const cycleMap = new Map(cycles.filter((c) => c && c.tenantId === auth.tenantId).map((c) => [c!.id, c!]));
    all = all.filter((s) => cycleMap.has(s.cycleId));

    // 可见性:
    //   - rater 自己: 看自己提交的全
    //   - subject 自己: 看自己被评 (peer 抹 raterId)
    //   - cycle.createdBy / admin/hr: 看全
    //   - 其他: 仅自己的
    const visible = all.filter((s) => {
      if (s.raterId === auth.userId) return true;
      if (s.subjectId === auth.userId) return true;
      const cy = cycleMap.get(s.cycleId)!;
      if (cy.createdBy === auth.userId) return true;
      if (auth.roles.some((r) => ['admin', 'hr'].includes(r))) return true;
      if (auth.demo) return true;
      return false;
    });

    const stripped = visible.map((s) => {
      const cy = cycleMap.get(s.cycleId)!;
      return strip360SubmissionForViewer(s, cy, auth.userId);
    });

    return NextResponse.json({ submissions: stripped });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
