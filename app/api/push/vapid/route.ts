import { NextResponse } from 'next/server';
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/infra/web-push';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }
  return NextResponse.json({ configured: true, publicKey: getVapidPublicKey() });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/push/vapid' });
