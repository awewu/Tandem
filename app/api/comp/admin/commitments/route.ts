import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  proposeCommitment,
  approveCommitment,
  rejectCommitment,
  listCommitments,
} from '@/lib/comp/commitment-service';
import type { TaskGear } from '@/lib/types/comp';

const VALID_GEARS: TaskGear[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * GET /api/comp/admin/commitments?employeeId=&status=
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    const rows = await listCommitments(auth.tenantId, employeeId, status);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/commitments' });

/**
 * POST /api/comp/admin/commitments — 提交任务承诺申请
 *   { employeeId, familyId, cycle, commitmentType, fromGear?, toGear, reason? }
 *
 * PATCH /api/comp/admin/commitments — 审批/驳回
 *   { commitmentId, action: 'approve'|'reject' }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const toGear = String(body.toGear ?? '') as TaskGear;
  if (!VALID_GEARS.includes(toGear)) {
    return NextResponse.json({ error: 'toGear must be A-G' }, { status: 400 });
  }

  try {
    const result = await proposeCommitment({
      tenantId: auth.tenantId,
      employeeId: String(body.employeeId ?? ''),
      familyId: String(body.familyId ?? ''),
      cycle: String(body.cycle ?? ''),
      commitmentType: String(body.commitmentType ?? 'annual') as 'annual' | 'quarterly' | 'half_year' | 'special',
      fromGear: body.fromGear ? (String(body.fromGear) as TaskGear) : undefined,
      toGear,
      reason: body.reason,
      proposedBy: auth.userId,
      evidenceSnapshot: body.evidenceSnapshot,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/commitments' });

async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const commitmentId = String(body.commitmentId ?? '');
  const action = String(body.action ?? '');

  if (!commitmentId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'commitmentId and action (approve|reject) required' }, { status: 400 });
  }

  try {
    if (action === 'approve') {
      const result = await approveCommitment(auth.tenantId, commitmentId, auth.userId);
      return NextResponse.json({ result });
    } else {
      await rejectCommitment(auth.tenantId, commitmentId);
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/comp/admin/commitments' });
