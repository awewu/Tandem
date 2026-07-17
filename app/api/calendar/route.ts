import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createCalendarService } from '@/lib/calendar/service-factory';
import { getStore } from '@/lib/storage/repository';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const svc = createCalendarService();
  const range = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
  const events = ownerId && ownerId !== auth.userId
    ? await svc.listSubscribedCalendar(auth.userId, ownerId, auth.tenantId, range)
    : await svc.listForUser(auth.userId, auth.tenantId, range);
  return NextResponse.json({ events });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const svc = createCalendarService(auth.userId);
  const owner = await getStore().auth.users.findById(auth.userId);
  const events = await svc.createManaged({
    title: body.title,
    description: body.description,
    startAt: body.startAt,
    endAt: body.endAt,
    timezone: body.timezone,
    attendeeEmails: body.attendeeEmails,
    reminderMinutes: body.reminderMinutes,
    recurrence: body.recurrence,
    location: body.location,
    meetingUrl: body.meetingUrl,
    ownerId: auth.userId,
    ownerEmail: auth.email,
    ownerName: owner?.name ?? auth.email,
    tenantId: auth.tenantId,
  });
  return NextResponse.json({ ...events[0], events, warnings: svc.getDeliveryWarnings() }, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar' });
