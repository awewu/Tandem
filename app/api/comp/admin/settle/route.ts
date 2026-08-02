import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  runMonthlySettlement,
  listSettlements,
  updateSettlementStatus,
} from '@/lib/comp/settlement-service';

/**
 * GET /api/comp/admin/settle?period=YYYY-MM
 * 查询某周期结算行列表 (HR/管理角色)
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const period = new URL(req.url).searchParams.get('period');
  if (!period) return NextResponse.json({ error: 'period required (YYYY-MM)' }, { status: 400 });

  try {
    const rows = await listSettlements(auth.tenantId, period);
    return NextResponse.json({ period, rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/settle' });

/**
 * POST /api/comp/admin/settle — 批量生成月度结算
 *   { period, attendance?, coefficient?, performanceOverride?, gateFlags? }
 *
 * PATCH /api/comp/admin/settle — 更新结算行状态
 *   { settlementId, status: 'draft'|'reviewed'|'paid' }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const period = String(body.period ?? '');
  if (!period) return NextResponse.json({ error: 'period required (YYYY-MM)' }, { status: 400 });

  try {
    const result = await runMonthlySettlement({
      tenantId: auth.tenantId,
      period,
      attendance: body.attendance != null ? Number(body.attendance) : undefined,
      coefficient: body.coefficient != null ? Number(body.coefficient) : undefined,
      performanceOverride: body.performanceOverride != null ? Number(body.performanceOverride) : undefined,
      gateFlags: body.gateFlags,
      autoCoefficient: Boolean(body.autoCoefficient),
      kpiCycleId: body.kpiCycleId ? String(body.kpiCycleId) : undefined,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/settle' });

async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const settlementId = String(body.settlementId ?? '');
  const status = String(body.status ?? '') as 'draft' | 'reviewed' | 'paid';
  if (!settlementId || !['draft', 'reviewed', 'paid'].includes(status)) {
    return NextResponse.json({ error: 'settlementId and valid status required' }, { status: 400 });
  }

  try {
    await updateSettlementStatus(auth.tenantId, settlementId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/comp/admin/settle' });
