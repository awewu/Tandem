/**
 * PMS API · 信息管理岗工作台 (Deal Desk)
 *
 * GET  /api/pms/deal-desk               → { dealDesk }  (内部岗位专属, 只读聚合)
 * POST /api/pms/deal-desk { action:'arbitrate', appealId, decision, reason } → 仲裁撞单申诉
 *
 * 授权: 仅内部角色 (信息管理岗 = 销售运营/数据管家, 厂家侧). 经销商无权访问.
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { assembleDealDesk } from '@/lib/pms/deal-desk-service';
import { normalizeDecision } from '@/lib/pms/duplicate-appeal-service';
import { PMS_MANAGEMENT_ROLES } from '@/lib/auth/roles';
import { executeAction } from '@/lib/ontology/execute-action';
import { ensurePmsActions } from '@/lib/ontology/actions/pms-actions';

/** 映射 executeAction 拦截结果 → HTTP 状态。 */
function blockedStatus(exec: { blocked?: { stage?: string; code?: string; reasons: string[] } }): number {
  if (exec.blocked?.stage === 'gate') return 403;
  if (exec.blocked?.code === 'not_found') return 404;
  const reasons = exec.blocked?.reasons.join('; ') || '';
  if (/not arbitratable|already/.test(reasons)) return 409;
  return 400;
}

function authorize(auth: PmsAuthResult): boolean {
  return auth.isInternal && auth.roles.some((r) => (PMS_MANAGEMENT_ROLES as readonly string[]).includes(r));
}

export async function GET(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!authorize(auth)) {
    return NextResponse.json({ error: 'forbidden; 信息管理岗工作台仅限内部管理角色' }, { status: 403 });
  }
  try {
    const dealDesk = await assembleDealDesk({ tenantId: auth.tenantId });
    return NextResponse.json({ dealDesk });
  } catch (error: any) {
    console.error('DealDesk error:', error);
    return NextResponse.json({ error: error.message || 'Failed to assemble deal desk' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!authorize(auth)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // 报备审核: 通过/驳回 pending_review 商机
  if (body?.action === 'review') {
    if (!body.opportunityId) {
      return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
    }
    const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
    if (!decision) {
      return NextResponse.json({ error: 'decision must be approved|rejected' }, { status: 400 });
    }
    // 接治理链: 走 executeAction (validate → zone 闸 → 主写 → 副作用 → 审计)。
    ensurePmsActions();
    const exec = await executeAction('pms.opportunity.review', {
      tenantId: auth.tenantId,
      opportunityId: String(body.opportunityId),
      decision,
      reviewerId: auth.userId,
      note: body.note ? String(body.note) : undefined,
    }, { actorUserId: auth.userId, tenantId: auth.tenantId, isProxy: false });
    if (!exec.ok) {
      return NextResponse.json({ error: exec.blocked?.reasons.join('; ') || 'review failed' }, { status: blockedStatus(exec) });
    }
    return NextResponse.json({ ok: true, result: exec.result });
  }

  if (body?.action !== 'arbitrate') {
    return NextResponse.json({ error: 'unsupported action' }, { status: 400 });
  }
  if (!body.appealId) {
    return NextResponse.json({ error: 'appealId required' }, { status: 400 });
  }
  let decision;
  try {
    decision = normalizeDecision(String(body.decision));
  } catch {
    return NextResponse.json({ error: 'invalid decision; expected approved | rejected' }, { status: 400 });
  }
  ensurePmsActions();
  const exec = await executeAction('pms.appeal.arbitrate', {
    tenantId: auth.tenantId,
    appealId: body.appealId,
    arbitratedBy: auth.userId,
    decision,
    arbitrationReason: body.reason ? String(body.reason) : undefined,
  }, { actorUserId: auth.userId, tenantId: auth.tenantId, isProxy: false });
  if (!exec.ok) {
    return NextResponse.json({ error: exec.blocked?.reasons.join('; ') || 'arbitration failed' }, { status: blockedStatus(exec) });
  }
  return NextResponse.json({ ok: true, result: exec.result });
}
