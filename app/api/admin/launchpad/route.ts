/**
 * GET /api/admin/launchpad — list ALL apps (incl. disabled) for admin.
 * POST /api/admin/launchpad/reorder — bulk reorder.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { LaunchpadService } from '@/lib/services/launchpad-service';
import { boot } from '@/lib/boot';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin']);
  if (forbid) return forbid;
  const svc = new LaunchpadService(createAppContext());
  const [apps, stats] = await Promise.all([
    svc.listAdmin({ tenantId: auth.tenantId }),
    svc.stats(auth.tenantId),
  ]);
  const statsMap = new Map(stats.map((s) => [s.appId, s]));
  const enriched = apps.map((a) => ({
    ...a,
    stats: statsMap.get(a.id) ?? { appId: a.id, totalClicks: 0, uniqueUsers: 0, last7DaysClicks: 0 },
  }));
  return NextResponse.json({ apps: enriched });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin']);
  if (forbid) return forbid;
  const body = (await req.json()) as { orderMap?: Array<{ id: string; order: number }> };
  if (!Array.isArray(body.orderMap)) {
    return NextResponse.json({ error: 'orderMap required' }, { status: 400 });
  }
  const svc = new LaunchpadService(createAppContext());
  await svc.reorder(body.orderMap);
  return NextResponse.json({ ok: true });
});
