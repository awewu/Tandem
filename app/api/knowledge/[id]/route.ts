/**
 * 知识库 · 单节点更新 / 删除
 *
 *   PATCH  /api/knowledge/:id    更新 { name?, content?, ownership?, parentId? }
 *                                (parentId 变更 = 移动, 含防环校验)
 *   DELETE /api/knowledge/:id    递归软删 (文件夹连带其后代)
 *
 * 仅 owner 可改, 跨用户返回 404.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { updateNode, deleteNode, moveNode } from '@/lib/knowledge/service';
import type { KnowledgeOwnership } from '@/lib/types/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PatchBody {
  name?: string;
  content?: string;
  parentId?: string | null;
  /** null = 清除 ownership (未分级) */
  ownership?: KnowledgeOwnership | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    body = {};
  }

  // 纯移动 (只传 parentId) 走防环 moveNode; 否则走通用 update.
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === 'parentId' && typeof body.parentId === 'string') {
    const moved = await moveNode(auth.userId, params.id, body.parentId);
    if (!moved) return NextResponse.json({ error: '非法移动或节点不存在' }, { status: 400 });
    return NextResponse.json({ node: moved });
  }

  const node = await updateNode(auth.userId, params.id, {
    name: body.name,
    content: body.content,
    parentId: body.parentId,
    ownership: body.ownership,
  });
  if (!node) return NextResponse.json({ error: '节点不存在或无权限' }, { status: 404 });
  return NextResponse.json({ node });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const count = await deleteNode(auth.userId, params.id);
  if (count === 0) return NextResponse.json({ error: '节点不存在或无权限' }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: count });
}
