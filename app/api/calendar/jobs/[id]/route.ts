import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getCalendarJobStore } from '@/lib/calendar/job-store';
import { createCalendarService } from '@/lib/calendar/service-factory';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/calendar/jobs/[id]
 * Poll the status of an async calendar create job. Returns step-by-step progress.
 */
const GETApiHandler = withErrorHandler(async (_req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(_req);
  if (auth instanceof NextResponse) return auth;
  const store = getCalendarJobStore();
  let job = await store.get(params.id);
  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'job not found' } }, { status: 404 });
  }
  if (job.input.ownerId !== auth.userId) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'job does not belong to you' } }, { status: 403 });
  }
  job = await store.repairCompletedNotificationStep(params.id) ?? job;
  if (job.status === 'pending') {
    const svc = createCalendarService(auth.userId);
    void svc.resumeCreateJob(params.id).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[calendar-job] poll resume failed:', err);
    });
  }
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    steps: job.steps,
    totalSteps: job.totalSteps,
    completedSteps: job.completedSteps,
    progress: Math.round((job.completedSteps / job.totalSteps) * 100),
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar/jobs/[id]' });

/**
 * POST /api/calendar/jobs/[id] (with action=resume)
 * Resume a failed/partial job from the last checkpoint.
 */
const POSTApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const job = await getCalendarJobStore().get(params.id);
  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'job not found' } }, { status: 404 });
  }
  if (job.input.ownerId !== auth.userId) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'job does not belong to you' } }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'resume') {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'action=resume required' } }, { status: 400 });
  }
  const svc = createCalendarService(auth.userId);
  // resume in background
  void svc.resumeCreateJob(params.id).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[calendar-job] resume failed:', err);
  });
  return NextResponse.json({ jobId: job.id, status: 'running' }, { status: 202 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/jobs/[id]' });
