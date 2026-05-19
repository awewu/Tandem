import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { CalendarService } from '@/lib/services/calendar-service';

export const GET = withErrorHandler(async (req: Request) => {
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
  return NextResponse.json({ events });
});

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new CalendarService(ctx);
  const ev = await svc.create(body);
  return NextResponse.json(ev, { status: 201 });
});
