/**
 * KPI 实例 Excel 导出 · CHARTER-KPI-TTI §2.5
 *
 * GET /api/kpi/export?cycleId=xxx
 *   导出指定周期的所有 KPI (含 currentValue / dataSource 供查阅, 但 import 不读这两列)
 *
 * 权限: 任何登录用户 (与 /api/kpi GET 一致 — 导出是只读快照)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { buildSheet, KPI_COLUMNS } from '@/lib/kpi/excel';

// 额外只读列, import 时忽略
const EXPORT_EXTRA_COLUMNS = ['currentValue', 'dataSource', 'createdAt'] as const;
const ALL_COLUMNS = [...KPI_COLUMNS, ...EXPORT_EXTRA_COLUMNS] as const;

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 });

  const store = getStore();
  const cycle = await withTenantScope(store.kpiCycles, auth.tenantId).get(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
  }

  const kpis = (await withTenantScope(store.kpis, auth.tenantId).list()).filter(
    (k) => k.cycleId === cycleId,
  );
  const subjects = await withTenantScope(store.kpiSubjects, auth.tenantId).list();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  kpis.sort((a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title));

  const rows = kpis.map((k) => ({
    subjectCode: subjectById.get(k.subjectId)?.code ?? '',
    level: k.level,
    scope: k.scope,
    title: k.title,
    description: k.description ?? '',
    assigneeId: k.assigneeId,
    departmentId: k.departmentId ?? '',
    measureType: k.measureType,
    startValue: k.startValue,
    targetValue: k.targetValue,
    unit: k.unit ?? '',
    weight: k.weight,
    currentValue: k.currentValue ?? 0,
    dataSource: k.dataSource ?? '',
    createdAt: k.createdAt,
  }));

  const buf = buildSheet(ALL_COLUMNS, rows, `KPIs-FY${cycle.fiscalYear}`);
  const filename = `kpi-${cycle.fiscalYear}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
