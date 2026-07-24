/**
 * PMS API · 业绩目标
 *
 * GET  ?period=&orgId=&dealerOrgId=&targetType=   列表 (经销商仅本 org)
 * POST { action:'create' }        下达目标 (仅内部)
 * POST { action:'update_actual' } 回填实际值重算达成率 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createTarget,
  listTargets,
  updateActual,
} from '@/lib/pms/performance-target-service';

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
    let dealerOrgId = searchParams.get('dealerOrgId') || undefined;

    // 隔离: 非内部强制限定本 org
    if (!auth.isInternal) {
      if (!dealerOrgId || !auth.visibleOrgIds.includes(dealerOrgId)) {
        return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
      }
    }

    const targets = await listTargets({
      tenantId: auth.tenantId,
      period: searchParams.get('period') || undefined,
      orgId: searchParams.get('orgId') || undefined,
      dealerOrgId,
      targetType: searchParams.get('targetType') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ targets });
  } catch (error: any) {
    console.error('Performance targets GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
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

    // 业绩目标写操作仅内部
    if (!auth.isInternal) {
      return NextResponse.json({ error: 'forbidden: target write requires internal role' }, { status: 403 });
    }

    if (action === 'create') {
      if (!body.period || !body.targetType || body.targetValue == null) {
        return NextResponse.json({ error: 'Missing required fields: period, targetType, targetValue' }, { status: 400 });
      }
      const target = await createTarget({
        tenantId: auth.tenantId,
        orgId: body.orgId,
        dealerOrgId: body.dealerOrgId,
        period: body.period,
        targetType: body.targetType,
        targetValue: Number(body.targetValue),
        actualValue: typeof body.actualValue === 'number' ? body.actualValue : undefined,
        createdBy: auth.userId,
      });
      return NextResponse.json({ target }, { status: 201 });
    }

    if (action === 'update_actual') {
      if (!body.id || body.actualValue == null) {
        return NextResponse.json({ error: 'Missing id or actualValue' }, { status: 400 });
      }
      const result = await updateActual({ tenantId: auth.tenantId, id: body.id, actualValue: Number(body.actualValue) });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unknown action; expected create | update_actual' }, { status: 400 });
  } catch (error: any) {
    console.error('Performance targets POST error:', error);
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
