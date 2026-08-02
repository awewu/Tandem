/**
 * 目标自动生成引擎 · API 层
 *
 * POST body: { cycleId, growthRateByCode?, defaultGrowthRate? }
 *   cycleId          : 待设定目标的新周期 (通常是 draft)
 *   growthRateByCode : 按科目 code 指定增长率, e.g. { "FIN.REV": 0.15 }
 *   defaultGrowthRate: 未指定科目的兜底增长率, 缺省 0
 *
 * 纯建议, 不写任何 Kpi 记录 (见 lib/kpi/target-suggestion-engine.ts 顶部纪律说明)。
 * HR 审核后走既有 POST /api/kpi 落地创建, 或走 /api/kpi/target-amendments 修订已有目标。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { suggestTargets, checkCascadeConsistency, type PriorYearActual } from '@/lib/kpi/target-suggestion-engine';

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  const body = await req.json();
  if (!body?.cycleId) {
    return NextResponse.json({ error: 'cycleId 必填' }, { status: 400 });
  }
  const growthRateByCode: Record<string, number> =
    body.growthRateByCode && typeof body.growthRateByCode === 'object' ? body.growthRateByCode : {};
  const defaultGrowthRate = typeof body.defaultGrowthRate === 'number' ? body.defaultGrowthRate : 0;

  const store = getStore();
  const cycle = await withTenantScope(store.kpiCycles, auth.tenantId).get(body.cycleId);
  if (!cycle) return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });

  const allCycles = await withTenantScope(store.kpiCycles, auth.tenantId).list();
  const priorCycle = allCycles.find((c) => c.fiscalYear === cycle.fiscalYear - 1);
  if (!priorCycle) {
    return NextResponse.json({
      cycleId: cycle.id,
      priorCycleId: null,
      priorFiscalYear: cycle.fiscalYear - 1,
      suggestions: [],
      note: `找不到 FY${cycle.fiscalYear - 1} 的历史周期, 无真实基准可用。建议: ① 在 KPI 表单手工设定目标; ② 或通过「人工补录」/ ERP 导入上年 actual 后再重新生成建议。`,
    });
  }

  const [priorKpis, newKpis, subjects] = await Promise.all([
    withTenantScope(store.kpis, auth.tenantId).list({ cycleId: priorCycle.id }),
    withTenantScope(store.kpis, auth.tenantId).list({ cycleId: cycle.id }),
    withTenantScope(store.kpiSubjects, auth.tenantId).list(),
  ]);
  const subjectCodeById = new Map(subjects.map((s) => [s.id, s.code]));
  const newKpiByKey = new Map(newKpis.map((k) => [`${k.subjectId}_${k.assigneeId}_${k.level}`, k]));

  const priorYearActuals: PriorYearActual[] = priorKpis.map((k) => ({
    priorKpiId: k.id,
    priorParentKpiId: k.parentKpiId,
    subjectId: k.subjectId,
    subjectCode: subjectCodeById.get(k.subjectId) ?? '',
    assigneeId: k.assigneeId,
    level: k.level,
    priorActual: k.currentValue,
    priorTitle: k.title,
    priorMeasureType: k.measureType,
    priorUnit: k.unit,
    priorWeight: k.weight,
    priorScope: k.scope,
    priorDepartmentId: k.departmentId,
  }));

  const rawSuggestions = suggestTargets({ priorYearActuals, growthRateByCode, defaultGrowthRate });
  const cascadeWarnings = checkCascadeConsistency(rawSuggestions);
  const warningByParentId = new Map(cascadeWarnings.map((w) => [w.parentPriorKpiId, w]));

  const suggestions = rawSuggestions.map((s) => {
    const existing = newKpiByKey.get(`${s.subjectId}_${s.assigneeId}_${s.level}`);
    return {
      ...s,
      alreadySet: !!existing,
      existingKpiId: existing?.id,
      cascadeWarning: warningByParentId.get(s.priorKpiId) ?? null,
    };
  });

  return NextResponse.json({
    cycleId: cycle.id,
    priorCycleId: priorCycle.id,
    priorFiscalYear: priorCycle.fiscalYear,
    suggestions,
    cascadeWarnings,
  });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/kpi/target-suggestions' });
