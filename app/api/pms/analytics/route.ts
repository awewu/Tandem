/**
 * PMS API · 分析看板 (只读聚合)
 *
 * GET  ?region=&productLine=&dateFrom=&dateTo=
 *      商机漏斗 / 状态分布 / 区域分布 / 赢单率 / 管道金额 (orgId 隔离)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { getOpportunityAnalytics } from '@/lib/pms/analytics-service';

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
    const analytics = await getOpportunityAnalytics({
      tenantId: auth.tenantId,
      visibleOrgIds: auth.isInternal ? undefined : auth.visibleOrgIds,
      region: searchParams.get('region') || undefined,
      productLine: searchParams.get('productLine') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    });
    return NextResponse.json({ analytics });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: 'method not allowed; analytics is read-only' }, { status: 405 });
}
