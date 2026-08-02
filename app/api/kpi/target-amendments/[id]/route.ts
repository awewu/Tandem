/**
 * 目标修订签批流 · 审批 (approve/reject)
 *
 * 仅 owner/admin (CEO/总裁层级) 可审批 —— 这是 targetsLockedAt 后 targetValue
 * 变更的唯一合法落地点。approve 时才真正改写 Kpi.targetValue + audit; reject 不改。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { isCascadeConsistent } from '@/lib/types/kpi';

function isApprover(auth: { roles: string[]; demo?: boolean }): boolean {
  if (auth.demo) return true;
  return auth.roles.includes('owner') || auth.roles.includes('admin');
}

async function PATCHApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isApprover(auth)) {
    return NextResponse.json(
      { error: 'forbidden: 仅 owner/admin (CEO 层级) 可审批目标修订申请' },
      { status: 403 },
    );
  }

  const store = getStore();
  const amendments = withTenantScope(store.kpiTargetAmendments, auth.tenantId);
  const amendment = await amendments.get(params.id);
  if (!amendment) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (amendment.status !== 'pending') {
    return NextResponse.json({ error: 'already_reviewed: 该申请已处理, 不可重复审批' }, { status: 400 });
  }

  const body = await req.json();
  const decision = body?.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision 必须是 approve 或 reject' }, { status: 400 });
  }

  const kpi = await withTenantScope(store.kpis, auth.tenantId).get(amendment.kpiId);
  if (!kpi) return NextResponse.json({ error: 'kpi_not_found: 目标 KPI 已不存在' }, { status: 404 });

  const cycle = await store.kpiCycles.get(kpi.cycleId);
  if (cycle?.status !== 'active') {
    return NextResponse.json(
      { error: `cycle_not_active: 周期状态为 ${cycle?.status ?? 'unknown'}, 仅在 active 锁定后可审批目标修订` },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const updated = await amendments.update(params.id, {
    status,
    reviewedBy: auth.userId,
    reviewedAt: now,
    reviewNote: body?.reviewNote,
    updatedAt: now,
  });

  let cascadeWarning: { parentTarget: number; childrenSum: number; deltaPct: number } | null = null;

  if (decision === 'approve') {
    await store.kpis.update(amendment.kpiId, {
      targetValue: amendment.toTargetValue,
      updatedAt: now,
    });

    // 级联一致性校验: 父级 target 改变后, 子级 target 之和是否仍对齐
    const children = await withTenantScope(store.kpis, auth.tenantId).list({ parentKpiId: kpi.id });
    const childrenTargets = children.map((c) => c.targetValue);
    if (children.length > 0 && !isCascadeConsistent(amendment.toTargetValue, childrenTargets)) {
      const childrenSum = childrenTargets.reduce((a, b) => a + b, 0);
      const deltaPct =
        amendment.toTargetValue !== 0
          ? ((childrenSum - amendment.toTargetValue) / Math.abs(amendment.toTargetValue)) * 100
          : 0;
      cascadeWarning = {
        parentTarget: amendment.toTargetValue,
        childrenSum: Math.round(childrenSum * 100) / 100,
        deltaPct: Math.round(deltaPct * 100) / 100,
      };
      await audit('kpi.target_amendment_cascade_warning', auth.userId, {
        targetId: amendment.id,
        targetType: 'kpi_target_amendment',
        metadata: {
          kpiId: amendment.kpiId,
          parentTarget: cascadeWarning.parentTarget,
          childrenSum: cascadeWarning.childrenSum,
          deltaPct: cascadeWarning.deltaPct,
          childrenIds: children.map((c) => c.id),
        },
      });
    }

    await audit('kpi.target_amendment_approved', auth.userId, {
      targetId: amendment.id,
      targetType: 'kpi_target_amendment',
      metadata: {
        kpiId: amendment.kpiId,
        fromTargetValue: amendment.fromTargetValue,
        toTargetValue: amendment.toTargetValue,
        requestedBy: amendment.requestedBy,
      },
    });
  } else {
    await audit('kpi.target_amendment_rejected', auth.userId, {
      targetId: amendment.id,
      targetType: 'kpi_target_amendment',
      metadata: { kpiId: amendment.kpiId, reviewNote: body?.reviewNote },
    });
  }

  return NextResponse.json({ amendment: updated, cascadeWarning });
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/kpi/target-amendments/[id]' });
