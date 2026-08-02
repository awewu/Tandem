import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { budgetVsActual, plannedBudgets, fixedPayrollForecast, actualPayroll } from '@/lib/comp/fpa-extract';

/**
 * GET /api/comp/fpa/budget-vs-actual?period=YYYY-MM
 * FP&A 人力预决算抓取 (finance / steward / owner / admin / exec 可见)。
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['finance', 'steward', 'owner', 'admin', 'exec']);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period');
  if (!period) {
    return NextResponse.json({ error: 'period required (YYYY-MM)' }, { status: 400 });
  }

  try {
    const [summary, pools, forecast, actual] = await Promise.all([
      budgetVsActual(auth.tenantId, period),
      plannedBudgets(auth.tenantId, period),
      fixedPayrollForecast(auth.tenantId),
      actualPayroll(auth.tenantId, period),
    ]);
    return NextResponse.json({ summary, pools, forecast, actual });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/fpa/budget-vs-actual' });
