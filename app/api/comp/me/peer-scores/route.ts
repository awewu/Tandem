import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { submitPeerScore, getPeerScore } from '@/lib/comp/peer-review-service';

/**
 * GET /api/comp/me/peer-scores?employeeId=X&cycle=2026-Q3
 *   员工查看自己的他评聚合结果
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const employeeId = url.searchParams.get('employeeId') ?? auth.userId;
  const cycle = url.searchParams.get('cycle') ?? '';

  if (!cycle) {
    return NextResponse.json({ error: 'cycle required' }, { status: 400 });
  }

  try {
    const result = await getPeerScore(auth.tenantId, employeeId, cycle);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/me/peer-scores' });

/**
 * POST /api/comp/me/peer-scores — 评议人提交评分
 *   { employeeId, cycle, score, comment? }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  if (!body.employeeId || !body.cycle || body.score == null) {
    return NextResponse.json(
      { error: 'employeeId, cycle, score required' },
      { status: 400 },
    );
  }

  const score = Number(body.score);
  if (isNaN(score) || score < 0 || score > 1) {
    return NextResponse.json({ error: 'score must be 0-1' }, { status: 400 });
  }

  try {
    await submitPeerScore({
      tenantId: auth.tenantId,
      employeeId: body.employeeId,
      cycle: body.cycle,
      reviewerId: auth.userId,
      score,
      comment: body.comment,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/me/peer-scores' });
