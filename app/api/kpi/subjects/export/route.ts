/**
 * KPI 科目 Excel 导出 · CHARTER-KPI-TTI §2.5
 *
 * GET /api/kpi/subjects/export
 *   返回当前租户全部科目 (含软删除) 的 xlsx 二进制流.
 *   列定义见 lib/kpi/excel.ts SUBJECT_COLUMNS.
 *   parentCode 用父科目的 code (而非 id), 便于跨环境迁移.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { buildSheet, SUBJECT_COLUMNS } from '@/lib/kpi/excel';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!hasKpiPermission(auth, 'kpi.subject_admin')) {
    return NextResponse.json({ error: 'forbidden: kpi.subject_admin required' }, { status: 403 });
  }

  const store = getStore();
  const subjects = await withTenantScope(store.kpiSubjects, auth.tenantId).list();
  const byId = new Map(subjects.map((s) => [s.id, s]));

  // 按 level + code 排序导出, 父先于子, 便于人眼阅读
  subjects.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));

  const rows = subjects.map((s) => ({
    code: s.code,
    name: s.name,
    description: s.description ?? '',
    parentCode: s.parentId ? byId.get(s.parentId)?.code ?? '' : '',
    defaultScope: s.defaultScope,
    defaultMeasureType: s.defaultMeasureType,
    defaultUnit: s.defaultUnit ?? '',
    active: s.active ? 'true' : 'false',
  }));

  const buf = buildSheet(SUBJECT_COLUMNS, rows, 'KpiSubjects');
  const filename = `kpi-subjects-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
