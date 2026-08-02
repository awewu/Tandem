import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { submitReview, listReviews, nineBoxOutcome } from '@/lib/comp/review-service';

/**
 * GET /api/comp/admin/reviews?employeeId=&cycle=
 * 查询述职评审记录 (HR/管理角色)
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId') ?? undefined;
  const cycle = searchParams.get('cycle') ?? undefined;

  try {
    const rows = await listReviews(auth.tenantId, employeeId, cycle);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/reviews' });

/**
 * POST /api/comp/admin/reviews — 提交述职评审
 *   { employeeId, cycle, reviewType, okrPotentialScore?, kpiPerformanceScore?,
 *     nineBoxRow?, nineBoxCol?, selfScore?, peerScore?, managerScore?,
 *     sourceWeights?, review360CycleId?, outcome?, snapshot? }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const employeeId = String(body.employeeId ?? '');
  const cycle = String(body.cycle ?? '');
  const reviewType = String(body.reviewType ?? '');

  if (!employeeId || !cycle || !reviewType) {
    return NextResponse.json({ error: 'employeeId, cycle, reviewType required' }, { status: 400 });
  }

  try {
    const result = await submitReview({
      tenantId: auth.tenantId,
      employeeId,
      cycle,
      reviewType: reviewType as 'quarterly_checkin' | 'half_year' | 'annual',
      okrPotentialScore: body.okrPotentialScore != null ? Number(body.okrPotentialScore) : undefined,
      kpiPerformanceScore: body.kpiPerformanceScore != null ? Number(body.kpiPerformanceScore) : undefined,
      nineBoxRow: body.nineBoxRow != null ? Number(body.nineBoxRow) : undefined,
      nineBoxCol: body.nineBoxCol != null ? Number(body.nineBoxCol) : undefined,
      selfScore: body.selfScore != null ? Number(body.selfScore) : undefined,
      peerScore: body.peerScore != null ? Number(body.peerScore) : undefined,
      managerScore: body.managerScore != null ? Number(body.managerScore) : undefined,
      sourceWeights: body.sourceWeights,
      review360CycleId: body.review360CycleId,
      outcome: body.outcome,
      snapshot: body.snapshot,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/reviews' });
