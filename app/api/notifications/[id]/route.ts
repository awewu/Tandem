import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(_req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  const n = await s.notifications.get(params.id);
  if (!n) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(n);
}

export const GET = withApiLog(GETApiHandler, { route: '/api/notifications/[id]' });

async function PATCHApiHandler(req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  const body = await req.json();
  const n = await s.notifications.update(params.id, body);
  return NextResponse.json(n);
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/notifications/[id]' });

async function DELETEApiHandler(_req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  await s.notifications.delete(params.id);
  return NextResponse.json({ ok: true });
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/notifications/[id]' });
