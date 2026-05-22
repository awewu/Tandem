/**
 * KPI 分析端点 · CHARTER-KPI-TTI §3 (服务于 health-dashboard / 9-box 纵轴 / 高管简报)
 *
 * GET /api/kpi/analytics?view=<view>&cycleId=<id>[&extra=...]
 *
 * 8 个视图 (view):
 *   1. company-summary       公司整体 (count/green/amber/red, weighted completion)
 *   2. department-rollup     各部门加权完成率
 *   3. assignee-rollup       各 assignee (含 9-box 纵轴用) 加权完成率 + grade
 *   4. cascade-coverage      公司→部门→个人 cascade 覆盖统计
 *   5. data-source           数据来源分布 (manual/erp/system/pending)
 *   6. risk-list             红色 KPI 清单 (completion < 0.6)
 *   7. scope-balance         bonus vs monitor 数量与权重分布
 *   8. weight-validation     每个 assignee 的 bonus 权重总和是否 = 100
 *
 * 所有视图均按 tenantId + cycleId 过滤. 只读, 无需特殊权限 (要登录).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { computeKpiCompletion, type Kpi, type KpiSubject } from '@/lib/types/kpi';

type Health = 'green' | 'amber' | 'red';

function healthOf(completion: number): Health {
  if (completion >= 0.9) return 'green';
  if (completion >= 0.6) return 'amber';
  return 'red';
}

/** assignee 9-box 纵轴等级 (KPI 加权完成率 → low/mid/high) */
function kpiGradeOf(weightedCompletion: number): 'low' | 'mid' | 'high' {
  if (weightedCompletion >= 0.95) return 'high';
  if (weightedCompletion >= 0.7) return 'mid';
  return 'low';
}

function weightedCompletion(bonusKpis: Kpi[]): number {
  if (bonusKpis.length === 0) return 0;
  let totalW = 0;
  let sum = 0;
  for (const k of bonusKpis) {
    totalW += k.weight;
    sum += k.weight * computeKpiCompletion(k);
  }
  return totalW > 0 ? sum / totalW : 0;
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const view = url.searchParams.get('view');
  const cycleId = url.searchParams.get('cycleId');
  if (!view) return NextResponse.json({ error: 'view required' }, { status: 400 });
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 });

  const store = getStore();
  const kpis = (await store.kpis.list()).filter(
    (k) => k.tenantId === auth.tenantId && k.cycleId === cycleId,
  );
  const subjects = (await store.kpiSubjects.list()).filter(
    (s) => s.tenantId === auth.tenantId,
  );
  const subjectById = new Map<string, KpiSubject>(subjects.map((s) => [s.id, s]));

  switch (view) {
    // -----------------------------------------------------------------------
    case 'company-summary': {
      const bonus = kpis.filter((k) => k.scope === 'bonus');
      const monitor = kpis.filter((k) => k.scope === 'monitor');
      let green = 0;
      let amber = 0;
      let red = 0;
      for (const k of kpis) {
        const h = healthOf(computeKpiCompletion(k));
        if (h === 'green') green++;
        else if (h === 'amber') amber++;
        else red++;
      }
      return NextResponse.json({
        view,
        total: kpis.length,
        bonus: bonus.length,
        monitor: monitor.length,
        green,
        amber,
        red,
        bonusWeightedCompletion: weightedCompletion(bonus),
        // 全公司层级 (level=company) 的加权完成率, 高管简报用
        companyLevelWeightedCompletion: weightedCompletion(
          bonus.filter((k) => k.level === 'company'),
        ),
      });
    }

    // -----------------------------------------------------------------------
    case 'department-rollup': {
      const byDept = new Map<string, Kpi[]>();
      for (const k of kpis) {
        if (k.scope !== 'bonus') continue;
        const d = k.departmentId ?? '__unassigned__';
        if (!byDept.has(d)) byDept.set(d, []);
        byDept.get(d)!.push(k);
      }
      const departments = Array.from(byDept.entries()).map(([deptId, list]) => {
        const wc = weightedCompletion(list);
        return {
          departmentId: deptId,
          kpiCount: list.length,
          weightedCompletion: wc,
          health: healthOf(wc),
        };
      });
      departments.sort((a, b) => b.weightedCompletion - a.weightedCompletion);
      return NextResponse.json({ view, departments });
    }

    // -----------------------------------------------------------------------
    case 'assignee-rollup': {
      const byAssignee = new Map<string, Kpi[]>();
      for (const k of kpis) {
        if (k.scope !== 'bonus') continue;
        if (!byAssignee.has(k.assigneeId)) byAssignee.set(k.assigneeId, []);
        byAssignee.get(k.assigneeId)!.push(k);
      }
      const assignees = Array.from(byAssignee.entries()).map(([assigneeId, list]) => {
        const wc = weightedCompletion(list);
        return {
          assigneeId,
          kpiCount: list.length,
          totalWeight: list.reduce((s, k) => s + k.weight, 0),
          weightedCompletion: wc,
          grade: kpiGradeOf(wc),
          health: healthOf(wc),
        };
      });
      assignees.sort((a, b) => b.weightedCompletion - a.weightedCompletion);
      return NextResponse.json({ view, assignees });
    }

    // -----------------------------------------------------------------------
    case 'cascade-coverage': {
      const companyKpis = kpis.filter((k) => k.level === 'company');
      const deptKpis = kpis.filter((k) => k.level === 'department');
      const indivKpis = kpis.filter((k) => k.level === 'individual');
      const companyWithChildren = new Set(
        deptKpis.map((k) => k.parentKpiId).filter((id): id is string => !!id),
      );
      const deptWithChildren = new Set(
        indivKpis.map((k) => k.parentKpiId).filter((id): id is string => !!id),
      );
      const orphanDept = deptKpis.filter((k) => !k.parentKpiId).length;
      const orphanIndiv = indivKpis.filter((k) => !k.parentKpiId).length;
      const companyUncascaded = companyKpis.filter(
        (k) => !companyWithChildren.has(k.id),
      ).length;
      const deptUncascaded = deptKpis.filter((k) => !deptWithChildren.has(k.id)).length;
      return NextResponse.json({
        view,
        company: { total: companyKpis.length, uncascadedToDept: companyUncascaded },
        department: {
          total: deptKpis.length,
          orphan: orphanDept,
          uncascadedToIndividual: deptUncascaded,
        },
        individual: { total: indivKpis.length, orphan: orphanIndiv },
      });
    }

    // -----------------------------------------------------------------------
    case 'data-source': {
      const counts: Record<string, number> = {};
      for (const k of kpis) {
        const ds = k.dataSource ?? 'pending';
        counts[ds] = (counts[ds] ?? 0) + 1;
      }
      return NextResponse.json({ view, total: kpis.length, counts });
    }

    // -----------------------------------------------------------------------
    case 'risk-list': {
      const risks = kpis
        .map((k) => ({ kpi: k, completion: computeKpiCompletion(k) }))
        .filter((x) => x.completion < 0.6)
        .sort((a, b) => a.completion - b.completion)
        .map(({ kpi, completion }) => ({
          id: kpi.id,
          title: kpi.title,
          subjectCode: subjectById.get(kpi.subjectId)?.code ?? '',
          level: kpi.level,
          scope: kpi.scope,
          assigneeId: kpi.assigneeId,
          departmentId: kpi.departmentId,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
          completion,
          dataSource: kpi.dataSource,
        }));
      return NextResponse.json({ view, risks });
    }

    // -----------------------------------------------------------------------
    case 'scope-balance': {
      const bonus = kpis.filter((k) => k.scope === 'bonus');
      const monitor = kpis.filter((k) => k.scope === 'monitor');
      const bonusByLevel: Record<string, number> = { company: 0, department: 0, individual: 0 };
      const monitorByLevel: Record<string, number> = { company: 0, department: 0, individual: 0 };
      for (const k of bonus) bonusByLevel[k.level]++;
      for (const k of monitor) monitorByLevel[k.level]++;
      const totalBonusWeight = bonus.reduce((s, k) => s + k.weight, 0);
      return NextResponse.json({
        view,
        bonus: { count: bonus.length, totalWeight: totalBonusWeight, byLevel: bonusByLevel },
        monitor: { count: monitor.length, byLevel: monitorByLevel },
      });
    }

    // -----------------------------------------------------------------------
    case 'weight-validation': {
      // 每个 assignee 的 bonus KPI 权重总和应 = 100
      const byAssignee = new Map<string, number>();
      for (const k of kpis) {
        if (k.scope !== 'bonus') continue;
        byAssignee.set(k.assigneeId, (byAssignee.get(k.assigneeId) ?? 0) + k.weight);
      }
      const violations = Array.from(byAssignee.entries())
        .filter(([, total]) => Math.abs(total - 100) > 0.01)
        .map(([assigneeId, total]) => ({ assigneeId, totalWeight: total, expected: 100 }));
      return NextResponse.json({
        view,
        ok: violations.length === 0,
        violations,
      });
    }

    // -----------------------------------------------------------------------
    default:
      return NextResponse.json(
        {
          error: `unknown view "${view}"`,
          available: [
            'company-summary',
            'department-rollup',
            'assignee-rollup',
            'cascade-coverage',
            'data-source',
            'risk-list',
            'scope-balance',
            'weight-validation',
          ],
        },
        { status: 400 },
      );
  }
}
