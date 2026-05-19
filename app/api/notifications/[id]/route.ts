import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  const n = await s.notifications.get(params.id);
  if (!n) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(n);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  const body = await req.json();
  const n = await s.notifications.update(params.id, body);
  return NextResponse.json(n);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  await s.notifications.delete(params.id);
  return NextResponse.json({ ok: true });
}
