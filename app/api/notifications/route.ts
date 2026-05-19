import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';

export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') ?? 'demo-user';
  const unreadOnly = searchParams.get('unread') === 'true';
  const ctx = createAppContext();
  const svc = new NotificationService(ctx);
  const notifs = await svc.list(userId, { unreadOnly });
  const unreadCount = await svc.countUnread(userId);
  return NextResponse.json({ notifications: notifs, unreadCount });
});

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new NotificationService(ctx);
  const n = await svc.create(body);
  return NextResponse.json(n, { status: 201 });
});
