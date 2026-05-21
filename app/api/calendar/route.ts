import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { CalendarService } from '@/lib/services/calendar-service';
import { boot } from '@/lib/boot';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const ctx = createAppContext();
  const svc = new CalendarService(ctx);
  const events = await svc.list({
    ownerId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  // Tenant isolation: scope to caller's tenant.
  const scoped = events.filter((e) => (e.tenantId ?? 'default') === auth.tenantId);
  return NextResponse.json({ events: scoped });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new CalendarService(ctx);
  // Derive ownerId & tenantId from auth ctx if client did not provide them.
  const ev = await svc.create({
    ...body,
    ownerId: body.ownerId ?? auth.userId,
    tenantId: body.tenantId ?? auth.tenantId,
  });
  return NextResponse.json(ev, { status: 201 });
});
