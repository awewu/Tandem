/**
 * POST /api/push/subscribe   — 保存浏览器 push 订阅
 * DELETE /api/push/subscribe — 取消订阅
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { isWebPushConfigured } from '@/lib/infra/web-push';
import { getStore } from '@/lib/storage/repository';
import type { PushSubscriptionRecord } from '@/lib/infra/web-push';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'Web Push not configured (VAPID keys missing)' }, { status: 503 });
  }
  let body: { subscription?: { endpoint: string; keys: { p256dh: string; auth: string } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'subscription.endpoint and keys required' }, { status: 400 });
  }
  const store = getStore();
  const all = await store.pushSubscriptions.list();
  const existing = all.find(
    (s) => s.userId === auth.userId && s.endpoint === sub.endpoint,
  );
  const now = new Date().toISOString();
  if (existing) {
    await store.pushSubscriptions.update(existing.id, { lastUsedAt: now } as never);
    return NextResponse.json({ ok: true, id: existing.id });
  }
  const record: PushSubscriptionRecord = {
    id: `psub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    userId: auth.userId,
    endpoint: sub.endpoint,
    keys: sub.keys,
    createdAt: now,
  };
  await store.pushSubscriptions.create(record);
  return NextResponse.json({ ok: true, id: record.id });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }
  const store = getStore();
  const all = await store.pushSubscriptions.list();
  const record = all.find(
    (s) => s.userId === auth.userId && s.endpoint === body.endpoint,
  );
  if (record) {
    await store.pushSubscriptions.update(record.id, { lastUsedAt: 'deleted' } as never);
  }
  return NextResponse.json({ ok: true });
}
