/**
 * PATCH /api/launchpad/:id — admin update app.
 * DELETE /api/launchpad/:id — admin delete app.
 * GET    /api/launchpad/:id — fetch single (admin).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { LaunchpadService } from '@/lib/services/launchpad-service';
import { boot } from '@/lib/boot';
import type { LaunchpadApp } from '@/lib/types/launchpad';

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin']);
  if (forbid) return forbid;
  const ctx = createAppContext();
  const app = await ctx.launchpadRepo.findAppById(params.id);
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ app });
});

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin']);
  if (forbid) return forbid;
  const body = (await req.json()) as Partial<LaunchpadApp>;
  const allowed: Array<keyof LaunchpadApp> = [
    'category', 'name', 'description', 'iconUrl', 'url',
    'ssoMode', 'ssoConfig', 'visibleTo', 'visibleToRoles',
    'order', 'recommendKeywords', 'unreadAdapter', 'status',
  ];
  const patch: Partial<LaunchpadApp> = {};
  for (const k of allowed) if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  const svc = new LaunchpadService(createAppContext());
  const app = await svc.update(params.id, patch);
  return NextResponse.json({ app });
});

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin']);
  if (forbid) return forbid;
  const svc = new LaunchpadService(createAppContext());
  await svc.delete(params.id);
  return NextResponse.json({ ok: true });
});
