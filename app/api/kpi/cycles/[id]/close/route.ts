/**
 * KPI 周期年终关闭 · CHARTER-KPI-TTI §5 M3
 *
 * POST /api/kpi/cycles/[id]/close
 *   Body: { force?: boolean }
 *
 * 行为:
 *   1. 校验所有 bonus scope KPI 的 assignee 都有 committed=true 的 payout
 *      (force=true 时跳过此校验, 仅 admin 可用)
 *   2. 将 cycle.status 改为 'closed'
 *   3. 锁定: closedAt 标记 + audit log kpi.year_end_close
 *
 * 与 PATCH /api/kpi/cycles/[id] status='closed' 的区别:
 *   PATCH 只改状态; 此端点有完整的 pre-flight 校验, 适合给 HR 在 UI 上点"年终关闭"按钮.
 *
 * 权限: kpi.write
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }
  const { id: cycleId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    const store = getStore();
    const cycle = await store.kpiCycles.get(cycleId);
    if (!cycle || cycle.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
    }
    if (cycle.status === 'closed') {
      return NextResponse.json({ error: 'already_closed' }, { status: 400 });
    }
    if (cycle.status === 'draft') {
      return NextResponse.json(
        { error: 'cycle_draft: 周期未激活, 无需关闭' },
        { status: 400 },
      );
    }

    // 校验: 所有 bonus assignee 已有 committed payout
    if (!force) {
      const bonusKpis = (await store.kpis.list()).filter(
        (k) => k.tenantId === auth.tenantId && k.cycleId === cycleId && k.scope === 'bonus',
      );
      const assignees = Array.from(new Set(bonusKpis.map((k) => k.assigneeId)));
      const payouts = (await store.kpiBonusPayouts.list()).filter(
        (p) => p.tenantId === auth.tenantId && p.cycleId === cycleId,
      );
      const committedAssignees = new Set(
        payouts.filter((p) => p.committed).map((p) => p.assigneeId),
      );
      const missing = assignees.filter((a) => !committedAssignees.has(a));
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: 'precondition_failed: 以下 assignee 尚未完成奖金下发',
            missingAssignees: missing,
            hint: '调用 POST /api/kpi/cycles/[id]/bonus { commit: true, ... } 先下发, 或加 ?force=1 强制关闭',
          },
          { status: 412 },
        );
      }
    }

    const now = new Date().toISOString();
    const updated = await store.kpiCycles.update(cycleId, {
      status: 'closed',
      closedAt: now,
      updatedAt: now,
    });

    await audit('kpi.year_end_close', auth.userId, {
      targetId: cycleId,
      targetType: 'kpi_cycle',
      metadata: {
        fiscalYear: cycle.fiscalYear,
        force,
      },
    });

    return NextResponse.json({ cycle: updated, closedAt: now });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
