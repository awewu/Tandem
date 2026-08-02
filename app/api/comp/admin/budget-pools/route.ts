import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import {
  listBudgetPools,
  createBudgetPool,
  updatePoolStatus,
  deleteBudgetPool,
  type BudgetPoolInput,
} from '@/lib/comp/budget-pool-service';

/**
 * GET /api/comp/admin/budget-pools?period=YYYY-MM
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const period = new URL(req.url).searchParams.get('period') ?? undefined;

  try {
    const rows = await listBudgetPools(auth.tenantId, period);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/budget-pools' });

/**
 * POST /api/comp/admin/budget-pools — 创建/更新预算池 (幂等 upsert)
 *   { departmentId, period, poolType?, baseAmount, hardCliff?, budgetCeiling?,
 *     qualityCoefficient?, attendanceBasis?, params?, status? }
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = (await req.json().catch(() => ({}))) as Partial<BudgetPoolInput>;
  if (!body.departmentId || !body.period || body.baseAmount == null) {
    return NextResponse.json(
      { error: 'departmentId, period, baseAmount required' },
      { status: 400 },
    );
  }

  try {
    const result = await createBudgetPool(auth.tenantId, {
      departmentId: body.departmentId,
      period: body.period,
      poolType: body.poolType,
      baseAmount: Number(body.baseAmount),
      hardCliff: body.hardCliff,
      budgetCeiling: body.budgetCeiling,
      qualityCoefficient: body.qualityCoefficient,
      attendanceBasis: body.attendanceBasis,
      params: body.params,
      status: body.status,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/comp/admin/budget-pools' });

/**
 * PATCH /api/comp/admin/budget-pools — 状态流转
 *   { poolId, status: 'draft'|'active'|'frozen'|'closed' }
 *
 * DELETE /api/comp/admin/budget-pools — 删除
 *   { poolId }
 */
async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const poolId = String(body.poolId ?? '');
  const status = String(body.status ?? '') as 'draft' | 'active' | 'frozen' | 'closed';

  if (!poolId || !['draft', 'active', 'frozen', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'poolId and valid status required' }, { status: 400 });
  }

  try {
    await updatePoolStatus(auth.tenantId, poolId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/comp/admin/budget-pools' });

async function DELETEApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const poolId = String(body.poolId ?? '');

  if (!poolId) {
    return NextResponse.json({ error: 'poolId required' }, { status: 400 });
  }

  try {
    await deleteBudgetPool(auth.tenantId, poolId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/comp/admin/budget-pools' });
