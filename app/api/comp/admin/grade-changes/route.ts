import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  createGradeChange,
  signGradeChange,
  updateAppeal,
  listGradeChanges,
} from '@/lib/comp/grade-change-service';
import type { CompLevel } from '@/lib/types/comp';

const VALID_LEVELS: CompLevel[] = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];
const VALID_CHANGE_TYPES = ['知悉', 'PIP告知', '降职生效', '职级晋升', '任务承接'];

/**
 * GET /api/comp/admin/grade-changes?employeeId=&signatureState=
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId') ?? undefined;
  const signatureState = searchParams.get('signatureState') ?? undefined;

  try {
    const rows = await listGradeChanges(auth.tenantId, employeeId, signatureState);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/grade-changes' });

/**
 * POST /api/comp/admin/grade-changes — 发起职级变更
 *   { employeeId, nodeId, cycle, changeType, fromGrade?, toGrade?, evidenceSnapshot? }
 *
 * PATCH /api/comp/admin/grade-changes — 签批/申诉
 *   { changeId, action: 'sign'|'reject'|'appeal_open'|'appeal_resolve' }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const changeType = String(body.changeType ?? '');
  if (!VALID_CHANGE_TYPES.includes(changeType)) {
    return NextResponse.json({ error: `changeType must be one of: ${VALID_CHANGE_TYPES.join(', ')}` }, { status: 400 });
  }

  const fromGrade = body.fromGrade ? (String(body.fromGrade) as CompLevel) : undefined;
  const toGrade = body.toGrade ? (String(body.toGrade) as CompLevel) : undefined;
  if (fromGrade && !VALID_LEVELS.includes(fromGrade)) {
    return NextResponse.json({ error: `fromGrade must be one of: ${VALID_LEVELS.join(', ')}` }, { status: 400 });
  }
  if (toGrade && !VALID_LEVELS.includes(toGrade)) {
    return NextResponse.json({ error: `toGrade must be one of: ${VALID_LEVELS.join(', ')}` }, { status: 400 });
  }

  try {
    const result = await createGradeChange({
      tenantId: auth.tenantId,
      employeeId: String(body.employeeId ?? ''),
      nodeId: String(body.nodeId ?? ''),
      cycle: String(body.cycle ?? ''),
      changeType: changeType as '知悉' | 'PIP告知' | '降职生效' | '职级晋升' | '任务承接',
      fromGrade,
      toGrade,
      evidenceSnapshot: body.evidenceSnapshot,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/grade-changes' });

async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const changeId = String(body.changeId ?? '');
  const action = String(body.action ?? '');

  if (!changeId || !['sign', 'reject', 'appeal_open', 'appeal_resolve'].includes(action)) {
    return NextResponse.json({ error: 'changeId and action (sign|reject|appeal_open|appeal_resolve) required' }, { status: 400 });
  }

  try {
    if (action === 'sign') {
      const result = await signGradeChange(auth.tenantId, changeId, '已签');
      return NextResponse.json({ result });
    } else if (action === 'reject') {
      const result = await signGradeChange(auth.tenantId, changeId, '拒签');
      return NextResponse.json({ result });
    } else if (action === 'appeal_open') {
      await updateAppeal(auth.tenantId, changeId, 'open');
      return NextResponse.json({ ok: true });
    } else {
      await updateAppeal(auth.tenantId, changeId, 'resolved');
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/comp/admin/grade-changes' });
