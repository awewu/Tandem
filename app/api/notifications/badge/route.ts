import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';
import { cacheGetOrLoad } from '@/lib/infra/cache';

/**
 * GET /api/notifications/badge?userId=xxx
 *
 * §T6 缓存策略: 30s TTL (Redis-first, InMemory fallback)
 * 失效路径: NotificationService.create / markRead 调用 cacheDel(`badge:${userId}`)
 */
export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') ?? 'demo-user';
  const count = await cacheGetOrLoad(`badge:${userId}`, 30, async () => {
    const ctx = createAppContext();
    const svc = new NotificationService(ctx);
    return svc.countUnread(userId);
  });
  return NextResponse.json({ unreadCount: count });
});
