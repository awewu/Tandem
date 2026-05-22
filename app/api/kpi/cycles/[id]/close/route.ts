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
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { kpiCycleRepo } from '@/lib/domain/kpi/kpi-cycle-repo-impl';

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

    const cycle = await kpiCycleRepo.findById(cycleId);
    if (!cycle || cycle.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
    }

    const result = await kpiCycleRepo.close({
      cycleId,
      actorId: auth.userId,
      force,
    });

    if (!result.ok) {
      if (result.reason === 'invalid_state') {
        const msg =
          result.current === 'closed' ? 'already_closed' : 'cycle_draft: 周期未激活, 无需关闭';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json(
        {
          error: 'precondition_failed: 以下 assignee 尚未完成奖金下发',
          missingAssignees: result.missingAssignees,
          hint: '先 POST /api/kpi/cycles/[id]/bonus { commit:true, ... } 下发, 或 force:true 强关',
        },
        { status: 412 },
      );
    }

    return NextResponse.json({ cycle: result.cycle, closedAt: result.cycle.closedAt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
