/**
 * KPI 周期单条操作 · CHARTER-KPI-TTI §2.3 (targetValue 锁死规则)
 *
 * GET    : 单个周期详情
 * PATCH  : 更新周期 (限 draft 时); 激活 (draft → active, 同时锁所有 target) ; 关闭 (active → closed)
 * DELETE : 仅 draft 周期可删 (没数据), 防止误删历史考核数据
 *
 * 激活动作 = 把 status 改为 'active' 并打 targetsLockedAt 时间戳.
 * 之后所有 Kpi.targetValue 不可修改 (除非走特批 + audit log).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const cycle = await store.kpiCycles.get(params.id);
  if (!cycle || cycle.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ cycle });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  const store = getStore();
  const cycle = await store.kpiCycles.get(params.id);
  if (!cycle || cycle.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedAt: now };

    // 状态机: draft → active (锁 target) → closed
    if (body.status && body.status !== cycle.status) {
      const allowed: Record<string, string[]> = {
        draft: ['active'],
        active: ['closed'],
        closed: [],
      };
      if (!allowed[cycle.status]?.includes(body.status)) {
        return NextResponse.json(
          { error: `invalid_transition: ${cycle.status} → ${body.status}` },
          { status: 400 },
        );
      }
      patch.status = body.status;
      if (body.status === 'active') {
        patch.targetsLockedAt = now;
      }
    }

    // 元数据 (仅 draft 时可改)
    if (cycle.status === 'draft') {
      if (typeof body.name === 'string') patch.name = body.name;
      if (typeof body.startDate === 'string') patch.startDate = body.startDate;
      if (typeof body.endDate === 'string') patch.endDate = body.endDate;
    } else if (body.name || body.startDate || body.endDate) {
      return NextResponse.json(
        { error: 'cycle_locked: 周期非 draft 状态, 元数据不可修改' },
        { status: 400 },
      );
    }

    const updated = await store.kpiCycles.update(params.id, patch);

    if (patch.status === 'active') {
      await audit('kpi.cycle_activated', auth.userId, {
        targetId: params.id,
        targetType: 'kpi_cycle',
        metadata: { fiscalYear: cycle.fiscalYear, targetsLockedAt: now },
      });
    } else if (patch.status === 'closed') {
      await audit('kpi.cycle_closed', auth.userId, {
        targetId: params.id,
        targetType: 'kpi_cycle',
        metadata: { fiscalYear: cycle.fiscalYear },
      });
    }

    return NextResponse.json({ cycle: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  const store = getStore();
  const cycle = await store.kpiCycles.get(params.id);
  if (!cycle || cycle.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (cycle.status !== 'draft') {
    return NextResponse.json(
      { error: 'cycle_protected: 仅 draft 周期可删, 防止误删历史考核数据' },
      { status: 400 },
    );
  }

  // 删除前检查是否已有 Kpi 引用
  const allKpis = await store.kpis.list();
  const refCount = allKpis.filter((k) => k.cycleId === params.id).length;
  if (refCount > 0) {
    return NextResponse.json(
      { error: `cycle_has_kpis: 仍有 ${refCount} 条 KPI 引用此周期, 先删 KPI` },
      { status: 400 },
    );
  }

  await store.kpiCycles.delete(params.id);
  return NextResponse.json({ ok: true });
}
