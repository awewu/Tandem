/**
 * PMS API · 经销商健康分 (考核=自查同源)
 *
 * GET  ?dealerOrgId=&period=      列表 (经销商仅本 org)
 * POST { action:'compute' }       计算并 upsert 健康分 (仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  upsertHealthScore,
  listHealthScores,
} from '@/lib/pms/dealer-health-service';

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
    const dealerOrgId = searchParams.get('dealerOrgId') || undefined;

    // 隔离: 非内部仅见本 org
    if (!auth.isInternal) {
      if (!dealerOrgId || !auth.visibleOrgIds.includes(dealerOrgId)) {
        return NextResponse.json({ error: 'forbidden: dealerOrgId out of scope' }, { status: 403 });
      }
    }

    const scores = await listHealthScores({
      tenantId: auth.tenantId,
      dealerOrgId,
      period: searchParams.get('period') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ scores });
  } catch (error: any) {
    console.error('Dealer health GET error:', error);
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

  if (!auth.isInternal) {
    return NextResponse.json({ error: 'forbidden: health scoring requires internal role' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = (body.action as string) || 'compute';

    if (action === 'compute') {
      const d = body.dimensions;
      if (!body.dealerOrgId || !body.period || !d ||
          typeof d.compliance !== 'number' || typeof d.performance !== 'number' ||
          typeof d.service !== 'number' || typeof d.cooperation !== 'number') {
        return NextResponse.json(
          { error: 'Missing required fields: dealerOrgId, period, dimensions{compliance,performance,service,cooperation}' },
          { status: 400 }
        );
      }
      const score = await upsertHealthScore({
        tenantId: auth.tenantId,
        dealerOrgId: body.dealerOrgId,
        period: body.period,
        dimensions: d,
      });
      return NextResponse.json({ score }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action; expected compute' }, { status: 400 });
  } catch (error: any) {
    console.error('Dealer health POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
