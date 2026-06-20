/**
 * POST /api/okr/cycles/[id]/activate
 *
 * OKR 周期激活权威后端入口 (B-025).
 *   1. 将目标周期设为 isActive=true, 其余周期设为 false (同租户)
 *   2. 发出 okr.cycle-activated 域事件 → subscribers 触发 realignPersonaToOkr
 *
 * 权限: admin / owner / manager
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { eventBus } from '@/lib/events/bus';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!auth.roles.some((r) => ['admin', 'owner', 'manager'].includes(r))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const cycleId = params.id;
  // 跨租户写隔离 (§23): scoped get/list/update — 激活仅影响本租户周期,
  // 不再误停用他租户 active 周期.
  const cycles = withTenantScope(getStore().cycles, auth.tenantId);

  const cycle = await cycles.get(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'cycle_not_found' }, { status: 404 });
  }

  const tenantId = auth.tenantId;

  // 找出当前 active 周期 (仅本租户)
  const allCycles = await cycles.list();
  const previousActive = allCycles.find((c) => c.isActive && c.id !== cycleId);

  // 停用本租户其他周期，激活目标周期
  await Promise.all(
    allCycles
      .filter((c) => c.id !== cycleId)
      .map((c) => cycles.update(c.id, { isActive: false })),
  );
  const updated = await cycles.update(cycleId, { isActive: true });

  // 发出域事件 → subscribers → realignPersonaToOkr
  eventBus.emit('okr.cycle-activated', {
    cycleId,
    tenantId,
    previousCycleId: previousActive?.id,
    activatedBy: auth.userId,
    timestamp: Date.now(),
  });

  return NextResponse.json({ cycle: updated, previousCycleId: previousActive?.id ?? null });
}
