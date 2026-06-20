/**
 * KPI 人工补录 (通道 C) · CHARTER-KPI-TTI §2.1
 *
 * 物理隔离 endpoint, 与通道 A 的 /api/kpi PATCH 分离.
 *
 * POST :
 *   写 KPI.currentValue (并打 dataSource='manual') + 创建 KpiManualEntry 审计记录
 *   仅 finance/HR/internal_staff (kpi.manual_entry 权限) 可调
 *   被考核人本人不可写自己的 KPI (即使有权限位)
 *   必填: reason
 *
 * GET :
 *   列出某 KPI 的人工补录历史 (供 UI 显示来源, audit-trail)
 *
 * CHARTER §2.1 绝对禁止改 KPI actuals 的角色:
 *   - 被考核员工本人 (即使是 HR/财务)
 *   - 直属主管 (manager 角色没有 kpi.manual_entry 权限)
 *   - CEO / 高管 (未兼任 finance/HR 时)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { canManualEntry } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { KpiManualEntry } from '@/lib/types/kpi';

function operatorRoleFromAuth(roles: string[]): 'finance' | 'hr' | 'internal_staff' {
  // SSOT 角色 → KPI 审计 operatorRole 标签 (kpi.ts). 'steward' 即 HR/数据管家.
  if (roles.includes('finance')) return 'finance';
  if (roles.includes('steward')) return 'hr';
  return 'internal_staff';
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const kpiId = url.searchParams.get('kpiId');
  if (!kpiId) {
    return NextResponse.json({ error: 'kpiId required' }, { status: 400 });
  }

  const store = getStore();
  const entries = (await withTenantScope(store.kpiManualEntries, auth.tenantId).list())
    .filter((e) => e.kpiId === kpiId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    if (!body.kpiId || body.toValue === undefined || body.toValue === null) {
      return NextResponse.json({ error: 'required: kpiId, toValue' }, { status: 400 });
    }
    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'reason_required: 人工补录必须填 reason (CHARTER §2.1 通道 C 必填)' },
        { status: 400 },
      );
    }
    const toValue = Number(body.toValue);
    if (!Number.isFinite(toValue)) {
      return NextResponse.json({ error: 'toValue must be a number' }, { status: 400 });
    }

    const store = getStore();
    const kpi = await withTenantScope(store.kpis, auth.tenantId).get(body.kpiId);
    if (!kpi) {
      return NextResponse.json({ error: 'kpi_not_found' }, { status: 404 });
    }

    // 通道 C 二级守卫: 权限 + 不能改自己的 KPI
    const guard = canManualEntry(auth, kpi);
    if (!guard.ok) {
      return NextResponse.json({ error: 'forbidden', reason: guard.reason }, { status: 403 });
    }

    // 周期必须 active (target 已锁) 才允许补录 actuals; draft 周期不应有 actuals
    const cycle = await store.kpiCycles.get(kpi.cycleId);
    if (!cycle) return NextResponse.json({ error: 'cycle_not_found' }, { status: 500 });
    if (cycle.status === 'closed') {
      return NextResponse.json({ error: 'cycle_closed: 周期已关闭, 不可补录' }, { status: 400 });
    }
    if (cycle.status === 'draft') {
      return NextResponse.json(
        { error: 'cycle_draft: 周期未激活, 还在 target 设定阶段, 暂无 actuals 补录意义' },
        { status: 400 },
      );
    }

    const fromValue = kpi.currentValue;
    const now = new Date().toISOString();

    // 写入 actuals + 标记 dataSource=manual
    await store.kpis.update(body.kpiId, {
      currentValue: toValue,
      dataSource: 'manual',
      updatedAt: now,
    });

    // 落审计表 (独立表, audit-trail 用)
    const entry: Omit<KpiManualEntry, 'id'> = {
      kpiId: body.kpiId,
      operatorId: auth.userId,
      operatorRole: operatorRoleFromAuth(auth.roles),
      fromValue,
      toValue,
      reason: body.reason.trim(),
      evidenceUrl: typeof body.evidenceUrl === 'string' ? body.evidenceUrl : undefined,
      tenantId: auth.tenantId,
      createdAt: now,
    };
    const created = await store.kpiManualEntries.create(entry);

    // audit log 也记一条 (与独立 entry 表互为冗余, 但事件流好查)
    await audit('kpi.actuals_manual_entry', auth.userId, {
      targetId: body.kpiId,
      targetType: 'kpi',
      metadata: {
        entryId: created.id,
        fromValue,
        toValue,
        delta: toValue - fromValue,
        operatorRole: entry.operatorRole,
        reason: entry.reason,
        evidenceUrl: entry.evidenceUrl,
      },
    });

    return NextResponse.json({ entry: created, kpi: { ...kpi, currentValue: toValue, dataSource: 'manual' as const } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
