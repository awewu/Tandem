import { NextResponse } from 'next/server';
import { getVapidPublicKey, isWebPushConfigured } from '@/lib/infra/web-push';

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }
  return NextResponse.json({ configured: true, publicKey: getVapidPublicKey() });
}
