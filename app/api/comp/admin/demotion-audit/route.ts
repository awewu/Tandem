import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { db } from '@/lib/infra/drizzle-client';
import { compGradeChangeLog } from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';
import { analyzeDemotionFairness } from '@/lib/comp/demotion-audit';

/**
 * GET /api/comp/admin/demotion-audit — 降职分布公平性审计
 */
async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select()
      .from(compGradeChangeLog)
      .where(eq(compGradeChangeLog.tenantId, auth.tenantId));

    const result = analyzeDemotionFairness(
      rows.map((r) => ({
        employeeId: r.employeeId,
        cycle: r.cycle,
        changeType: r.changeType,
      })),
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/comp/admin/demotion-audit' });
