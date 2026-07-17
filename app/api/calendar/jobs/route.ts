import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createCalendarService } from '@/lib/calendar/service-factory';
import { getCalendarJobStore, type CalendarJobInput } from '@/lib/calendar/job-store';

/**
 * POST /api/calendar/jobs
 * Create a calendar event asynchronously. Returns 202 + jobId immediately.
 * The client polls GET /api/calendar/jobs/[id] for progress.
 */
const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const owner = await getStore().auth.users.findById(auth.userId);

  const input: CalendarJobInput = {
    title: String(body.title ?? ''),
    description: body.description ?? null,
    startAt: String(body.startAt ?? ''),
    endAt: String(body.endAt ?? ''),
    timezone: body.timezone,
    ownerId: auth.userId,
    ownerEmail: auth.email,
    ownerName: owner?.name ?? auth.email,
    attendeeEmails: Array.isArray(body.attendeeEmails) ? body.attendeeEmails : [],
    location: body.location ?? null,
    meetingUrl: body.meetingUrl ?? null,
    reminderMinutes: body.reminderMinutes ?? null,
    recurrence: body.recurrence ?? null,
    tenantId: auth.tenantId,
  };

  const store = getCalendarJobStore();
  const job = await store.create(input);

  // Run in background — do NOT await
  const svc = createCalendarService(auth.userId);
  void svc.createManagedAsync(job).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[calendar-job] background create failed:', err);
  });

  return NextResponse.json({ jobId: job.id, status: 'pending' }, { status: 202 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/jobs' });
