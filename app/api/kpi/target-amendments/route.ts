/**
 * 目标修订签批流 · 列表 + 创建申请
 *
 * KpiCycle.targetsLockedAt 后 targetValue 不可直接 PATCH (CHARTER §2.3)。
 * 这里是唯一合法的修订入口: 提交申请 (pending) → owner/admin 审批 (见 [id]/route.ts)。
 *
 * GET  ?kpiId= | ?cycleId= | ?status= : 列表查询
 * POST : 提交修订申请 (kpi.write 权限, 不能给自己名下的 KPI 提申请)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';
import type { KpiTargetAmendment } from '@/lib/types/kpi';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const { searchParams } = new URL(req.url);
  const kpiId = searchParams.get('kpiId') ?? undefined;
  const cycleId = searchParams.get('cycleId') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  let rows = await withTenantScope(store.kpiTargetAmendments, auth.tenantId).list(
    kpiId ? { kpiId } : cycleId ? { cycleId } : undefined,
  );
  if (status) rows = rows.filter((r) => r.status === status);

  return NextResponse.json({ amendments: rows });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/kpi/target-amendments' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  const store = getStore();
  const body = await req.json();
  if (!body?.kpiId || typeof body.toTargetValue !== 'number' || !body?.reason) {
    return NextResponse.json({ error: 'kpiId, toTargetValue, reason 均必填' }, { status: 400 });
  }

  const kpi = await withTenantScope(store.kpis, auth.tenantId).get(body.kpiId);
  if (!kpi) return NextResponse.json({ error: 'kpi_not_found' }, { status: 404 });

  // CHARTER §2.1 精神延伸: 被考核人不能为自己名下的目标申请修订 (需上级/HR 提)
  if (kpi.assigneeId === auth.userId && !auth.demo) {
    return NextResponse.json(
      { error: 'self_amend_forbidden: 不能为自己名下的 KPI 申请目标修订' },
      { status: 403 },
    );
  }

  const cycle = await store.kpiCycles.get(kpi.cycleId);
  if (cycle?.status === 'draft') {
    return NextResponse.json(
      { error: 'cycle_draft: 周期尚未锁定, 目标未锁死, 直接 PATCH /api/kpi/[id] 即可, 无需走签批流' },
      { status: 400 },
    );
  }

  // 同一 KPI 不允许有多个 pending 申请并存
  const existingPending = (
    await withTenantScope(store.kpiTargetAmendments, auth.tenantId).list({ kpiId: body.kpiId })
  ).find((a) => a.status === 'pending');
  if (existingPending) {
    return NextResponse.json(
      { error: 'pending_exists: 该 KPI 已有一条待审批的修订申请, 请先处理' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const amendment = await store.kpiTargetAmendments.create({
    kpiId: body.kpiId,
    cycleId: kpi.cycleId,
    requestedBy: auth.userId,
    fromTargetValue: kpi.targetValue,
    toTargetValue: Number(body.toTargetValue),
    reason: String(body.reason),
    status: 'pending',
    tenantId: auth.tenantId,
    createdAt: now,
    updatedAt: now,
  } as Omit<KpiTargetAmendment, 'id'>);

  await audit('kpi.target_amendment_requested', auth.userId, {
    targetId: amendment.id,
    targetType: 'kpi_target_amendment',
    metadata: {
      kpiId: kpi.id,
      fromTargetValue: kpi.targetValue,
      toTargetValue: amendment.toTargetValue,
      reason: amendment.reason,
    },
  });

  return NextResponse.json({ amendment }, { status: 201 });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/kpi/target-amendments' });
