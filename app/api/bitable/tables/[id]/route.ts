import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore, generateId } from '@/lib/storage/repository';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { BitableColumn } from '@/lib/types/bitable';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(_req);
  if (auth instanceof NextResponse) return auth;
  const table = await withTenantScope(getStore().bitableTables, auth.tenantId).get(params.id);
  if (!table) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json({ table });
}

/**
 * D-02: PATCH 用于增删改列 (columns) 与基本属性 (name/description).
 * Body 形态:
 *   - { name?, description? }
 *   - { addColumn: { name, type, aiPrompt?, aiModel?, aiDependsOn?, options?, width? } }
 *   - { updateColumn: { id, ...partial } }
 *   - { removeColumnId: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const tables = withTenantScope(getStore().bitableTables, auth.tenantId);
  const table = await tables.get(params.id);
  if (!table) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    addColumn?: Omit<BitableColumn, 'id'> & { id?: string };
    updateColumn?: Partial<BitableColumn> & { id: string };
    removeColumnId?: string;
  };

  let columns = table.columns;
  if (body.addColumn) {
    const c = body.addColumn;
    if (!c.name?.trim() || !c.type) {
      return NextResponse.json({ error: 'addColumn: name + type required' }, { status: 400 });
    }
    columns = [
      ...columns,
      { ...(c as BitableColumn), id: c.id ?? generateId('col') },
    ];
  }
  if (body.updateColumn) {
    const id = body.updateColumn.id;
    if (!columns.some((c) => c.id === id)) {
      return NextResponse.json({ error: 'updateColumn: id not found' }, { status: 404 });
    }
    columns = columns.map((c) => (c.id === id ? { ...c, ...body.updateColumn, id: c.id } : c));
  }
  if (body.removeColumnId) {
    if (!columns.some((c) => c.id === body.removeColumnId)) {
      return NextResponse.json({ error: 'removeColumn: id not found' }, { status: 404 });
    }
    columns = columns.filter((c) => c.id !== body.removeColumnId);
  }

  const now = new Date().toISOString();
  const updated = await tables.update(params.id, {
    name: body.name ?? table.name,
    description: body.description ?? table.description,
    columns,
    updatedAt: now,
  });
  return NextResponse.json({ table: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(_req);
  if (auth instanceof NextResponse) return auth;
  const tables = withTenantScope(getStore().bitableTables, auth.tenantId);
  const table = await tables.get(params.id);
  if (!table) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (table.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await tables.delete(params.id);
  return NextResponse.json({ ok: true });
}
