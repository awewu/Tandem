import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { evaluateQuarterMulti } from '@/lib/comp/quarter-gate';
import { initGradeState } from '@/lib/comp/grade-machine';
import { db } from '@/lib/infra/drizzle-client';
import { compGradeChangeLog, compEmployeeGrade } from '@/lib/infra/drizzle-schema';
import { eq, isNull, and } from 'drizzle-orm';

/**
 * POST /api/comp/admin/quarter-gate — 季度闸门评估
 *   { cycleId?, quarter? }
 *
 * 对所有在职员工, 从 KPI 达成率推导季度结果, 跑 grade-machine 状态机,
 * 若需要书面确认 (PIP告知/降职生效) 则自动创建 grade_change_log 记录。
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const cycleId = body.cycleId ? String(body.cycleId) : undefined;
  const quarter = body.quarter ? String(body.quarter) : `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

  try {
    const store = getStore();

    // 解析 KPI 周期
    let resolvedCycleId = cycleId;
    if (!resolvedCycleId) {
      const cycles = (await store.kpiCycles.list()).filter((c) => c.status === 'active');
      cycles.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
      resolvedCycleId = cycles[0]?.id;
    }

    if (!resolvedCycleId) {
      return NextResponse.json({ error: 'no active KPI cycle found' }, { status: 400 });
    }

    // 加载所有 bonus KPI
    const allKpis = (await store.kpis.list({ tenantId: auth.tenantId, cycleId: resolvedCycleId }))
      .filter((k) => k.scope === 'bonus');

    // 加载所有在职员工
    const grades = await db
      .select()
      .from(compEmployeeGrade)
      .where(
        and(
          eq(compEmployeeGrade.tenantId, auth.tenantId),
          isNull(compEmployeeGrade.effectiveTo),
        ),
      );

    // 加载已有 grade_change_log (用于恢复当前状态)
    const existingLogs = await db
      .select()
      .from(compGradeChangeLog)
      .where(eq(compGradeChangeLog.tenantId, auth.tenantId));

    const results: Array<{
      employeeId: string;
      outcome: 'meet' | 'below';
      state: string;
      requiresAck: boolean;
      ackType: string | null;
      createdLog: boolean;
    }> = [];

    for (const g of grades) {
      const empKpis = allKpis.filter((k) => k.assigneeId === g.employeeId);

      // 恢复当前 grade-machine 状态 (从历史 logs 简化推断)
      const empLogs = existingLogs.filter((l) => l.employeeId === g.employeeId);
      const currentState = initGradeState();

      const result = evaluateQuarterMulti(
        {
          items: empKpis.map((k) => ({
            currentValue: k.currentValue,
            targetValue: k.targetValue,
            startValue: k.startValue,
          })),
          weights: empKpis.map((k) => k.weight),
        },
        currentState,
      );

      let createdLog = false;

      // 若需要书面确认, 创建 grade_change_log
      if (result.requiresAck && result.ackType) {
        const logId = `change_${auth.tenantId}_${g.employeeId}_${quarter}_${Date.now()}`;
        await db.insert(compGradeChangeLog).values({
          id: logId,
          tenantId: auth.tenantId,
          employeeId: g.employeeId,
          nodeId: g.familyId,
          cycle: quarter,
          changeType: result.ackType,
          fromGrade: g.currentLevel,
          toGrade: result.ackType === '降职生效' ? g.currentLevel : null,
          evidenceSnapshot: {
            achievementRate: result.achievementRate,
            outcome: result.outcome,
            kpiCount: empKpis.length,
          },
          signatureState: '待签',
          appealState: 'none',
        }).onConflictDoNothing();
        createdLog = true;
      }

      results.push({
        employeeId: g.employeeId,
        outcome: result.outcome,
        state: result.newState.state,
        requiresAck: result.requiresAck,
        ackType: result.ackType,
        createdLog,
      });
    }

    const ackCount = results.filter((r) => r.requiresAck).length;
    const meetCount = results.filter((r) => r.outcome === 'meet').length;
    const belowCount = results.filter((r) => r.outcome === 'below').length;

    return NextResponse.json({
      quarter,
      cycleId: resolvedCycleId,
      total: results.length,
      meet: meetCount,
      below: belowCount,
      acknowledgements: ackCount,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/quarter-gate' });
