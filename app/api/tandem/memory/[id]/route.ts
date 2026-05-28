/**
 * /api/tandem/memory/[id]
 *
 * GET    · 获取单条 Memory 详情
 * PATCH  · 更新 (仅作者本人或 owner role)
 * DELETE · 删除 (仅作者本人或 owner role; 公司/部门级走 downgrade-flow, 此处只允许 personal)
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import type { MemoryEntry, MemoryType } from '@/lib/types/memory';

const UI_CAT_TO_TYPE: Record<string, MemoryType> = {
  requirement: 'lesson',
  consensus: 'value',
  standard: 'sop',
  context: 'case',
};

function canMutate(
  entry: MemoryEntry,
  auth: { userId: string; roles: string[] }
): boolean {
  if (entry.ownershipLevel === 'personal') {
    return entry.ownerUserId === auth.userId || auth.roles.includes('admin');
  }
  // 非个人 Memory 不能从此端口改 (走 promotion/downgrade flow)
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const entry = await store.memories.get(params.id);
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // 个人 Memory 只有 owner / admin 能看
  if (
    entry.ownershipLevel === 'personal' &&
    entry.ownerUserId !== auth.userId &&
    !auth.roles.includes('admin')
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({ memory: entry });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const entry = await store.memories.get(params.id);
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!canMutate(entry, auth)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const patch: Partial<MemoryEntry> = {
      updatedAt: new Date().toISOString(),
      version: (entry.version ?? 1) + 1,
    };

    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (typeof body.body === 'string') patch.body = body.body;
    if (typeof body.uiCategory === 'string') {
      patch.uiCategory = body.uiCategory as MemoryEntry['uiCategory'];
      // 同步 type (保持向后兼容)
      patch.type = UI_CAT_TO_TYPE[body.uiCategory] ?? entry.type;
    }
    if (typeof body.priority === 'string') {
      patch.priority = body.priority as MemoryEntry['priority'];
    }
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.map((t: unknown) => String(t));
    }
    if ('parentId' in body) patch.parentId = body.parentId ?? null;
    if (typeof body.isActive === 'boolean') {
      patch.isActive = body.isActive;
      // 同步 status (active ↔ inactive)
      patch.status = body.isActive ? 'active' : 'inactive';
    }

    const updated = await store.memories.update(params.id, patch);
    return NextResponse.json({ memory: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const entry = await store.memories.get(params.id);
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!canMutate(entry, auth)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await store.memories.delete(params.id);
  return NextResponse.json({ ok: true });
}
