/**
 * GET /api/launchpad — list visible apps for current viewer (with recommendation).
 * POST /api/launchpad — admin create app.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { LaunchpadService, type ViewerCtx } from '@/lib/services/launchpad-service';
import { boot } from '@/lib/boot';
import type { LaunchpadApp } from '@/lib/types/launchpad';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const viewer: ViewerCtx = {
    userId: auth.userId,
    roles: auth.roles,
    tenantId: auth.tenantId,
  };
  const svc = new LaunchpadService(createAppContext());
  const apps = await svc.listForViewer(viewer);
  return NextResponse.json({ apps });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin']);
  if (forbid) return forbid;
  const body = (await req.json()) as Partial<LaunchpadApp>;
  if (!body.name || !body.url || !body.category) {
    return NextResponse.json({ error: 'name, url, category required' }, { status: 400 });
  }
  const svc = new LaunchpadService(createAppContext());
  const app = await svc.create({
    category: body.category,
    name: body.name,
    description: body.description ?? null,
    iconUrl: body.iconUrl ?? null,
    url: body.url,
    ssoMode: body.ssoMode ?? 'none',
    ssoConfig: body.ssoConfig ?? null,
    visibleTo: body.visibleTo ?? [],
    visibleToRoles: body.visibleToRoles ?? [],
    order: body.order ?? 0,
    recommendKeywords: body.recommendKeywords ?? [],
    unreadAdapter: body.unreadAdapter ?? null,
    status: body.status ?? 'active',
    tenantId: auth.tenantId,
  });
  return NextResponse.json({ app }, { status: 201 });
});
