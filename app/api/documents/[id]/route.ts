import { NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  const doc = await s.documents.get(params.id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  const body = await req.json();
  const doc = await s.documents.update(params.id, body);
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await boot();
  const s = getStore();
  await s.documents.delete(params.id);
  return NextResponse.json({ ok: true });
}
