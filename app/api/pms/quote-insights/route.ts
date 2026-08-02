/**
 * PMS API · 报价定价洞察 (内部管理只读)
 *
 * GET → 汇总全量已签发报价, 暴露破限价 / 异常低价。
 * 涉及跨经销商价格 + 成本限价, 仅内部角色可见 (外部经销商禁访)。
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { assembleQuotePricingReport } from '@/lib/pms/quote-insights-service';

export async function GET(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!auth.isInternal) {
    return NextResponse.json({ error: 'forbidden: 定价洞察仅内部可见' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const report = await assembleQuotePricingReport(auth.tenantId, {
      dealerOrgId: searchParams.get('dealerOrgId') || undefined,
    });
    return NextResponse.json({ report });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message || 'Failed to assemble report' }, { status: 500 });
  }
}
