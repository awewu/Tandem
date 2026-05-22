/**
 * POST /api/kpi/erp/sync · KPI 通道 B 手动触发 ERP 同步
 *
 * Body: { cycleId: string }
 * 权限: kpi.write (HR/admin) 或 finance 角色
 *
 * 自动同步另走 cron (尚未实装, 见 lib/kpi/erp-adapter.ts 顶部注释).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { syncErpActuals } from '@/lib/kpi/erp-adapter';

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const canTrigger =
    hasKpiPermission(auth, 'kpi.write') || auth.roles.includes('finance');
  if (!canTrigger) {
    return NextResponse.json(
      { error: 'forbidden: kpi.write or finance role required' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    if (!body.cycleId) {
      return NextResponse.json({ error: 'cycleId required' }, { status: 400 });
    }
    const result = await syncErpActuals(auth.tenantId, body.cycleId, auth.userId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
