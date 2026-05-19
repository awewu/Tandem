import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(_req);
  if (auth instanceof NextResponse) return auth;
  const table = await getStore().bitableTables.get(params.id);
  if (!table) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json({ table });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(_req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const table = await store.bitableTables.get(params.id);
  if (!table) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await store.bitableTables.delete(params.id);
  return NextResponse.json({ ok: true });
}
