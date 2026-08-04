import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createCalendarService } from '@/lib/calendar/service-factory';
import type { CalendarMutationScope } from '@/lib/types/calendar-management';

interface RouteContext {
  params: { id: string };
}

function scopeOf(value: unknown): CalendarMutationScope {
  return value === 'future' || value === 'series' ? value : 'single';
}

const PATCHApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const service = createCalendarService(auth.userId);
  if (body.action === 'transferOwner') {
    const events = await service.transferOwnerManaged(
      params.id,
      auth.userId,
      String(body.newOwnerId ?? ''),
      scopeOf(body.scope),
      auth.email,
    );
    return NextResponse.json({ action: 'owner_transferred', events, warnings: service.getDeliveryWarnings() });
  }
  const events = await service.updateManaged(params.id, auth.userId, scopeOf(body.scope), {
    ownerEmail: auth.email,
    title: body.title,
    description: body.description,
    startAt: body.startAt,
    endAt: body.endAt,
    location: body.location,
    meetingUrl: body.meetingUrl,
    attendeeEmails: body.attendeeEmails,
    reminderMinutes: body.reminderMinutes,
    recurrence: body.recurrence,
  }, { notify: 'background' });
  return NextResponse.json({ events, warnings: service.getDeliveryWarnings() });
});

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/calendar/[id]' });

const DELETEApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const service = createCalendarService(auth.userId);
  const event = await service.getById(params.id);
  if (body.action === 'leave' && body.async === true) {
    if (!event) {
      return NextResponse.json({ error: { message: '日程不存在' } }, { status: 404 });
    }
    if (event.ownerId === auth.userId) {
      return NextResponse.json({ error: { message: '创建人不能退出自己创建的日程' } }, { status: 403 });
    }
    const scope = scopeOf(body.scope);
    void service.leaveManaged(params.id, auth.userId, scope, auth.email, { sideEffects: 'background' }).catch(() => undefined);
    return NextResponse.json({ action: 'left', accepted: true, eventId: params.id, scope }, { status: 202 });
  }
  const events = event?.ownerId === auth.userId && body.action !== 'leave'
    ? await service.cancelManaged(params.id, auth.userId, scopeOf(body.scope), auth.email, { notify: 'background' })
    : await service.leaveManaged(params.id, auth.userId, scopeOf(body.scope), auth.email, { sideEffects: 'background' });
  return NextResponse.json({ action: event?.ownerId === auth.userId && body.action !== 'leave' ? 'cancelled' : 'left', events, warnings: service.getDeliveryWarnings() });
});

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/calendar/[id]' });
