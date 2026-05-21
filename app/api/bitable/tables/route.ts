import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const tables = await getStore().bitableTables.list();
  // Tenant isolation first, then owner filter.
  const mine = tables.filter(
    (t) => (t.tenantId ?? 'default') === auth.tenantId && t.ownerId === auth.userId,
  );
  return NextResponse.json({ tables: mine });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { name?: string; description?: string };
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const now = new Date().toISOString();
  const created = await getStore().bitableTables.create({
    name: body.name,
    description: body.description,
    ownerId: auth.userId,
    tenantId: auth.tenantId,
    columns: [
      { id: 'col_name', name: '名称', type: 'text', width: 200, required: true },
      { id: 'col_status', name: '状态', type: 'select', options: [
        { value: '待办', color: 'slate' },
        { value: '进行中', color: 'amber' },
        { value: '已完成', color: 'emerald' },
      ] },
      { id: 'col_due', name: '截止', type: 'date' },
      { id: 'col_assignee', name: '负责人', type: 'user' },
    ],
    rows: [],
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ table: created });
}
