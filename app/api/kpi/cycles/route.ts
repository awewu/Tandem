/**
 * KPI 周期 (财年) · CHARTER-KPI-TTI §2
 *
 * GET   : 列出当前租户的所有 KpiCycle
 * POST  : 创建新周期 (status='draft' 起步, target 未锁)
 *
 * 激活/关闭走 /api/kpi/cycles/[id]/activate 等动作子路径 (V2).
 *
 * 权限: kpi.write (HR/高管) 才能创建; 所有登录用户可读 (供个人 KPI 页拉周期信息).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import type { KpiCycle, KpiCycleStatus } from '@/lib/types/kpi';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const all = await store.kpiCycles.list();
  const mine = all.filter((c) => c.tenantId === auth.tenantId);
  return NextResponse.json({ cycles: mine });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const fiscalYear = Number(body.fiscalYear);
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      return NextResponse.json({ error: 'fiscalYear required (2000-2100)' }, { status: 400 });
    }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: 'startDate / endDate required (ISO 8601)' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const cycle: Omit<KpiCycle, 'id'> = {
      fiscalYear,
      name: body.name || `FY${fiscalYear}`,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'draft' as KpiCycleStatus,
      tenantId: auth.tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    };

    const store = getStore();
    const created = await store.kpiCycles.create(cycle);

    await audit('kpi.cycle_created', auth.userId, {
      targetId: created.id,
      targetType: 'kpi_cycle',
      metadata: { fiscalYear, name: created.name, tenantId: auth.tenantId },
    });

    return NextResponse.json({ cycle: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
