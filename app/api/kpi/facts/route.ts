/**
 * GET /api/kpi/facts?cycleId=...
 *
 * BSC 全维度事实层只读端点 (lib/kpi/bsc-fact-service.ts):
 * 批量返回该周期下全部 KPI 的真实跨财年同比事实, 取代 app/kpi/page.tsx
 * 原先用 target*0.85 虚构去年同期的假同比。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { computeYoyFacts } from '@/lib/kpi/bsc-fact-service';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  if (!cycleId) {
    return NextResponse.json({ error: 'cycleId required' }, { status: 400 });
  }

  const store = getStore();
  const kpis = await withTenantScope(store.kpis, auth.tenantId).list({ cycleId });
  const yoyByKpiId = await computeYoyFacts(auth.tenantId, kpis);

  return NextResponse.json({ facts: Array.from(yoyByKpiId.values()) });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/kpi/facts' });
