import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { CalendarService } from '@/lib/services/calendar-service';
import { boot } from '@/lib/boot';
import { withApiLog } from '@/lib/api-log/with-api-log';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const ctx = createAppContext();
  const svc = new CalendarService(ctx);
  // Tenant isolation: tenantId 下推 service/repo, 不再逐路由手写过滤.
  const events = await svc.list({
    ownerId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    tenantId: auth.tenantId,
  });
  return NextResponse.json({ events });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new CalendarService(ctx);
  // P0-A: tenantId/ownerId 一律取自鉴权上下文, 绝不接受 body 注入 (防跨租户写).
  const ev = await svc.create({
    title: body.title,
    description: body.description,
    startAt: body.startAt,
    endAt: body.endAt,
    timezone: body.timezone,
    attendees: body.attendees,
    location: body.location,
    meetingUrl: body.meetingUrl,
    ownerId: body.ownerId ?? auth.userId,
    tenantId: auth.tenantId,
  });
  return NextResponse.json(ev, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar' });
