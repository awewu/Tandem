/**
 * PMS API · 撞单申诉仲裁 (S2 查重闭环)
 *
 * GET  ?status=&duplicateCheckId=   列表 (经销商仅见本人申诉)
 * POST { action:'create' }          提交申诉 (经销商/内部)
 * POST { action:'arbitrate' }       仲裁 (仅内部/销售管理部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createAppeal,
  listAppeals,
  normalizeDecision,
} from '@/lib/pms/duplicate-appeal-service';
import { executeAction } from '@/lib/ontology/execute-action';
import { ensurePmsActions } from '@/lib/ontology/actions/pms-actions';

export async function GET(req: NextRequest) {
  await boot();

  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const appeals = await listAppeals({
      tenantId: auth.tenantId,
      status: searchParams.get('status') || undefined,
      duplicateCheckId: searchParams.get('duplicateCheckId') || undefined,
      // 隔离: 非内部角色仅可见本人提交的申诉
      appealerId: auth.isInternal ? (searchParams.get('appealerId') || undefined) : auth.userId,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ appeals });
  } catch (error: any) {
    console.error('List appeals error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list appeals' },
      { status: 500 }
    );
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

  try {
    const body = await req.json();
    const action = (body.action as string) || 'create';

    // --- 仲裁 (仅内部/销售管理部) ---
    if (action === 'arbitrate') {
      if (!auth.isInternal) {
        return NextResponse.json({ error: 'forbidden: arbitration requires internal role' }, { status: 403 });
      }
      if (!body.appealId || !body.decision) {
        return NextResponse.json({ error: 'Missing appealId or decision' }, { status: 400 });
      }
      let decision;
      try {
        decision = normalizeDecision(body.decision);
      } catch {
        return NextResponse.json({ error: 'invalid decision; expected approved | rejected' }, { status: 400 });
      }
      // 接治理链: 走 executeAction (validate → zone 闸 → 主写 → 副作用 → 审计)。
      // 人工内部角色 isProxy=false: 黄区立即执行 (行为不变) + 统一审计留痕。
      ensurePmsActions();
      const exec = await executeAction('pms.appeal.arbitrate', {
        tenantId: auth.tenantId,
        appealId: body.appealId,
        arbitratedBy: auth.userId,
        decision,
        arbitrationReason: body.arbitrationReason,
      }, { actorUserId: auth.userId, tenantId: auth.tenantId, isProxy: false });
      if (!exec.ok) {
        const reasons = exec.blocked?.reasons.join('; ') || 'action blocked';
        const status = exec.blocked?.stage === 'gate' ? 403
          : exec.blocked?.code === 'not_found' ? 404
          : /not arbitratable/.test(reasons) ? 409
          : 400;
        return NextResponse.json({ error: reasons }, { status });
      }
      return NextResponse.json({ result: exec.result });
    }

    // --- 提交申诉 ---
    if (action === 'create') {
      if (!body.duplicateCheckId || !body.reason) {
        return NextResponse.json({ error: 'Missing duplicateCheckId or reason' }, { status: 400 });
      }
      const evidence = Array.isArray(body.evidence) ? body.evidence : undefined;
      const appeal = await createAppeal({
        tenantId: auth.tenantId,
        duplicateCheckId: body.duplicateCheckId,
        appealerId: auth.userId,
        reason: body.reason,
        evidence,
      });
      return NextResponse.json({ appeal }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | arbitrate' }, { status: 400 });
  } catch (error: any) {
    console.error('Appeal action error:', error);
    // 业务态错误 → 409
    if (/not found|already exists|not arbitratable/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process appeal action' },
      { status: 500 }
    );
  }
}
