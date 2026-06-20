/**
 * KPI 实例单条 · CHARTER-KPI-TTI §2.3 (target/scope 锁死规则)
 *
 * GET    : 单条详情
 * PATCH  : 改 title/description/weight/parentKpiId 等 (target/scope 受周期状态限制)
 * DELETE : 仅 draft 周期可删
 *
 * 严格禁止: 个人/被考核人/直属主管/高管改 currentValue (走通道 B/C).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';

const PATCH_DENY_KEYS = new Set([
  'currentValue', // 通道 B/C 专属
  'dataSource',
  'tenantId',
  'createdBy',
  'createdAt',
  'cycleId',
  'subjectId',
]);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const kpi = await withTenantScope(store.kpis, auth.tenantId).get(params.id);
  if (!kpi) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ kpi });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  const store = getStore();
  const kpis = withTenantScope(store.kpis, auth.tenantId);
  const kpi = await kpis.get(params.id);
  if (!kpi) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const cycle = await store.kpiCycles.get(kpi.cycleId);
  if (!cycle) return NextResponse.json({ error: 'cycle_not_found' }, { status: 500 });

  try {
    const body = await req.json();

    // 拒绝写入只读字段
    for (const k of Object.keys(body)) {
      if (PATCH_DENY_KEYS.has(k)) {
        return NextResponse.json(
          { error: `field_readonly: ${k} 必须走通道 B/C 或不可修改 (CHARTER §2.1/§2.3)` },
          { status: 400 },
        );
      }
    }

    // targetValue / scope: 周期 active 后 frozen
    if (cycle.status !== 'draft') {
      if ('targetValue' in body && Number(body.targetValue) !== kpi.targetValue) {
        return NextResponse.json(
          { error: 'target_locked: 周期已激活, targetValue 锁死 (CHARTER §2.3)' },
          { status: 400 },
        );
      }
      if ('scope' in body && body.scope !== kpi.scope) {
        return NextResponse.json(
          { error: 'scope_locked: 周期已激活, scope 锁死防止奖金口径漂移 (CHARTER §2.3)' },
          { status: 400 },
        );
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const editable = ['title', 'description', 'level', 'parentKpiId', 'assigneeId', 'departmentId', 'measureType', 'startValue', 'targetValue', 'unit', 'weight', 'scope'];
    for (const k of editable) if (k in body) patch[k] = body[k];

    const updated = await kpis.update(params.id, patch);

    // 若 target / scope 改了, 单独 audit
    if ('targetValue' in body && Number(body.targetValue) !== kpi.targetValue) {
      await audit('kpi.target_set', auth.userId, {
        targetId: params.id,
        targetType: 'kpi',
        metadata: { from: kpi.targetValue, to: Number(body.targetValue), reason: body.reason },
      });
    }

    return NextResponse.json({ kpi: updated });
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
  const kpis = withTenantScope(store.kpis, auth.tenantId);
  const kpi = await kpis.get(params.id);
  if (!kpi) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const cycle = await store.kpiCycles.get(kpi.cycleId);
  if (cycle && cycle.status !== 'draft') {
    return NextResponse.json(
      { error: 'cycle_locked: 周期已激活, 不可删 KPI' },
      { status: 400 },
    );
  }
  await kpis.delete(params.id);
  return NextResponse.json({ ok: true });
}
