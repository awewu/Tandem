import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';
import { withApiLog } from '@/lib/api-log/with-api-log';

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const service = new NotificationService(createAppContext());
  const result = await service.markAllRead(auth.userId, { tenantId: auth.tenantId });
  return NextResponse.json({ ok: true, ...result });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/notifications/read-all' });
