/**
 * GET /api/organization/performance?scope=me|reports
 *
 * "我的绩效与潜力" 自视角聚合 (组织模块 · 反馈评估组).
 *
 *   scope=me      : 本人 KPI 完成情况 + OKR/TTI 目标进度 + 【收入】(KpiBonusPayout).
 *                   收入字段仅此 scope 返回, 且严格等于 auth.userId, 任何情况下不对外泄露.
 *   scope=reports : 直属 + 多级下属 (managerId 汇报链) 的 KPI/OKR 目标达成情况——
 *                   **不含收入字段**, 权限仅限本人的组织下游, 满足"下属能看目标进展,
 *                   收入只有本人能看"的要求。
 *
 * 数据源全部复用既有 store (无新表): kpis / objectives / kpiBonusPayouts / kpiCycles / auth.users.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { computeKpiCompletion, type Kpi } from '@/lib/types/kpi';
import { effectiveObjectiveProgress, computeKRProgress, classifyNineBox, type NineBoxCell } from '@/lib/types/okr-tti';
import { withApiLog } from '@/lib/api-log/with-api-log';

interface KpiSummary {
  id: string;
  title: string;
  scope: 'bonus' | 'monitor';
  weight: number;
  completion: number;
}

interface ObjectiveSummary {
  id: string;
  title: string;
  confidence: string;
  progress: number;
}

interface NineBoxSummary {
  kpiScore: number;
  ttiScore: number;
  cell: NineBoxCell;
}

interface PersonPerformance {
  userId: string;
  name?: string;
  email?: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox: NineBoxSummary | null;
}

interface PersonPerformanceWithBonus extends PersonPerformance {
  bonus: {
    baseBonus: number;
    weightedCompletion: number;
    finalBonus: number;
    committed: boolean;
  } | null;
}

/** 沿 managerId 汇报链找出全部下属 (直属 + 多级), 不含本人 */
function collectSubordinateIds(
  users: { id: string; managerId?: string | null; disabled?: boolean }[],
  managerId: string,
): string[] {
  const ids = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const u of users) {
      if (u.disabled) continue;
      if (!u.managerId) continue;
      const parentInScope = u.managerId === managerId || ids.has(u.managerId);
      if (!parentInScope || ids.has(u.id) || u.id === managerId) continue;
      ids.add(u.id);
      changed = true;
    }
  }
  return Array.from(ids);
}

/**
 * 9-box 双轴打分 (与 /api/nine-box 同一套公式, 见该文件顶部注释):
 *   纵轴 kpiScore = bonus scope KPI 加权完成率
 *   横轴 ttiScore = (KR 平均进度 + 360 均分归一化) / 2, 任一缺失取另一项, 全无则 0
 * 双轴数据均缺失时返回 null (UI 显示"数据不足", 不强行给一个假的落点).
 */
async function computeNineBox(
  tenantId: string,
  userId: string,
  personKpis: Kpi[],
): Promise<NineBoxSummary | null> {
  const store = getStore();

  const scoredKpis = personKpis.filter((k) => k.scope === 'bonus');
  let kpiScore = 0;
  if (scoredKpis.length > 0) {
    const totalW = scoredKpis.reduce((s, k) => s + k.weight, 0);
    if (totalW > 0) {
      kpiScore = Math.min(
        1,
        scoredKpis.reduce((s, k) => s + k.weight * computeKpiCompletion(k), 0) / totalW,
      );
    }
  }

  const krs = (await withTenantScope(store.keyResults, tenantId).list()).filter(
    (k) => k.ownerId === userId,
  );
  const ttiCompletion = krs.length === 0 ? null : krs.reduce((s, k) => s + computeKRProgress(k), 0) / krs.length;

  const submissions = (await withTenantScope(store.review360Submissions, tenantId).list()).filter(
    (s) => s.subjectId === userId && s.overallScore != null,
  );
  const review360Normalized =
    submissions.length === 0
      ? null
      : Math.max(
          0,
          Math.min(1, (submissions.reduce((s, x) => s + (x.overallScore ?? 0), 0) / submissions.length - 1) / 4),
        );

  let ttiScore = 0;
  if (ttiCompletion != null && review360Normalized != null) ttiScore = (ttiCompletion + review360Normalized) / 2;
  else if (ttiCompletion != null) ttiScore = ttiCompletion;
  else if (review360Normalized != null) ttiScore = review360Normalized;

  if (scoredKpis.length === 0 && krs.length === 0 && submissions.length === 0) return null;
  return { kpiScore, ttiScore, cell: classifyNineBox(kpiScore, ttiScore) };
}

async function buildPersonPerformance(
  tenantId: string,
  userId: string,
  activeCycleId: string | null,
): Promise<Omit<PersonPerformance, 'name' | 'email'>> {
  const store = getStore();

  const kpis = activeCycleId
    ? (await withTenantScope(store.kpis, tenantId).list({ cycleId: activeCycleId })).filter(
        (k) => k.assigneeId === userId,
      )
    : [];
  const kpiSummaries: KpiSummary[] = kpis.map((k) => ({
    id: k.id,
    title: k.title,
    scope: k.scope,
    weight: k.weight,
    completion: computeKpiCompletion(k),
  }));

  const allObjectives = await withTenantScope(store.objectives, tenantId).list();
  const objectives = allObjectives.filter(
    (o) => o.ownerId === userId && o.status !== 'abandoned',
  );
  const objectiveSummaries: ObjectiveSummary[] = objectives.map((o) => ({
    id: o.id,
    title: o.title,
    confidence: o.confidence,
    progress: effectiveObjectiveProgress(o),
  }));

  const nineBox = await computeNineBox(tenantId, userId, kpis);

  return { userId, kpis: kpiSummaries, objectives: objectiveSummaries, nineBox };
}

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') === 'reports' ? 'reports' : 'me';
  const store = getStore();

  const cycles = await withTenantScope(store.kpiCycles, auth.tenantId).list();
  const activeCycle = cycles.find((c) => c.status === 'active') ?? null;

  if (scope === 'me') {
    const perf = await buildPersonPerformance(auth.tenantId, auth.userId, activeCycle?.id ?? null);

    let bonus: PersonPerformanceWithBonus['bonus'] = null;
    if (activeCycle) {
      const payouts = await withTenantScope(store.kpiBonusPayouts, auth.tenantId).list({
        cycleId: activeCycle.id,
      });
      const mine = payouts.find((p) => p.assigneeId === auth.userId);
      if (mine) {
        bonus = {
          baseBonus: mine.baseBonus,
          weightedCompletion: mine.weightedCompletion,
          finalBonus: mine.finalBonus,
          committed: mine.committed,
        };
      }
    }

    const result: PersonPerformanceWithBonus = {
      ...perf,
      bonus,
    };
    return NextResponse.json({ scope, cycle: activeCycle, me: result });
  }

  // scope=reports: 仅本人组织下游, 严禁附带任何收入/奖金字段.
  const users = await store.auth.users.list({ tenantId: auth.tenantId });
  const subordinateIds = collectSubordinateIds(users, auth.userId);
  if (subordinateIds.length === 0) {
    return NextResponse.json({ scope, cycle: activeCycle, reports: [] });
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const reports: PersonPerformance[] = await Promise.all(
    subordinateIds.map(async (id) => {
      const perf = await buildPersonPerformance(auth.tenantId, id, activeCycle?.id ?? null);
      const u = userById.get(id);
      return { ...perf, name: u?.name, email: u?.email };
    }),
  );

  return NextResponse.json({ scope, cycle: activeCycle, reports });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/organization/performance' });
