import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore, generateId } from '@/lib/storage/repository';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const table = await store.bitableTables.get(params.id);
  if (!table) return NextResponse.json({ error: 'table not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { data?: Record<string, unknown> };
  const now = new Date().toISOString();
  const row = {
    id: generateId('row'),
    data: body.data ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const updated = await store.bitableTables.update(params.id, {
    rows: [...table.rows, row],
    updatedAt: now,
  });
  return NextResponse.json({ row, table: updated });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const table = await store.bitableTables.get(params.id);
  if (!table) return NextResponse.json({ error: 'table not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { rowId?: string; data?: Record<string, unknown> };
  if (!body.rowId) return NextResponse.json({ error: 'rowId required' }, { status: 400 });
  const now = new Date().toISOString();
  const rows = table.rows.map((r) =>
    r.id === body.rowId ? { ...r, data: { ...r.data, ...(body.data ?? {}) }, updatedAt: now } : r,
  );
  const updated = await store.bitableTables.update(params.id, { rows, updatedAt: now });
  return NextResponse.json({ table: updated });
}
