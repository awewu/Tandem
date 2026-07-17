import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/domain/errors';

interface RouteContext {
  params: { id: string };
}

async function requireOwnedNotification(req: NextRequest, id: string) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return { response: auth };
  const ctx = createAppContext();
  const notification = await ctx.notificationRepo.findById(id);
  if (!notification) throw new NotFoundError('Notification', id);
  if (notification.userId !== auth.userId || notification.tenantId !== auth.tenantId) {
    throw new ForbiddenError('notification does not belong to current user');
  }
  return { auth, ctx, notification };
}

const GETApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  const result = await requireOwnedNotification(req, params.id);
  if (result.response) return result.response;
  return NextResponse.json(result.notification);
});

export const GET = withApiLog(GETApiHandler, { route: '/api/notifications/[id]' });

const PATCHApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  const result = await requireOwnedNotification(req, params.id);
  if (result.response) return result.response;
  const body = await req.json();
  const service = new NotificationService(result.ctx!);
  if (body.read === true) return NextResponse.json(await service.markRead(params.id));
  if (body.dismissed === true) return NextResponse.json(await service.markDismissed(params.id));
  throw new ValidationError('read or dismissed must be true');
});

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/notifications/[id]' });

const DELETEApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  const result = await requireOwnedNotification(req, params.id);
  if (result.response) return result.response;
  return NextResponse.json(await new NotificationService(result.ctx!).markDismissed(params.id));
});

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/notifications/[id]' });
