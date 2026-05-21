/**
 * POST /api/launchpad/:id/click — record click + return target URL.
 * Body: { source?: 'home' | 'launchpad' | 'search' | 'recommendation' }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { LaunchpadService, type ViewerCtx } from '@/lib/services/launchpad-service';
import { boot } from '@/lib/boot';

export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  let source = 'home';
  try {
    const body = await req.json();
    if (typeof body?.source === 'string') source = body.source;
  } catch {
    // empty body OK
  }
  const viewer: ViewerCtx = { userId: auth.userId, roles: auth.roles, tenantId: auth.tenantId };
  const svc = new LaunchpadService(createAppContext());
  const result = await svc.click(params.id, viewer, source);
  if (!result) return NextResponse.json({ error: 'not found or forbidden' }, { status: 404 });
  return NextResponse.json(result);
});
