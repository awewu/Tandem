/**
 * PATCH  /api/okr/initiatives/[id]   — update title/status/dueDate/decisionCardIds
 * DELETE /api/okr/initiatives/[id]
 *   只有 owner 或 KR.owner 可改/删
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { syncKrFromInitiatives } from '@/lib/okr/execution-rollup';

async function authorize(initiativeId: string, requesterId: string, demo: boolean) {
  const store = getStore();
  const init = await store.initiatives.get(initiativeId);
  if (!init) return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  const kr = await store.keyResults.get(init.keyResultId);
  const allowed =
    demo ||
    init.ownerId === requesterId ||
    kr?.ownerId === requesterId ||
    (kr?.coOwnerIds ?? []).includes(requesterId);
  if (!allowed) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { init };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { error, init } = await authorize(params.id, auth.userId, auth.demo);
  if (error) return error;
  try {
    const body = await req.json();
    const allowed = ['title', 'status', 'dueDate', 'decisionCardIds'];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    const store = getStore();
    const updated = await store.initiatives.update(params.id, patch);
    // B3 执行联动: 状态变化可能改变 KR 完成率 → 驱动 KR.currentValue → 向上 rollup.
    let execRollup = null;
    if ('status' in patch && init) {
      try {
        execRollup = await syncKrFromInitiatives(init.keyResultId, store, {
          actorId: auth.userId,
          eventIdSuffix: `patch:${params.id}`,
        });
      } catch {
        /* fail-soft: 不阻断 initiative 更新 */
      }
    }
    return NextResponse.json({ initiative: updated, execRollup });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { error, init } = await authorize(params.id, auth.userId, auth.demo);
  if (error) return error;
  const store = getStore();
  const keyResultId = init?.keyResultId;
  await store.initiatives.delete(params.id);
  // B3 执行联动: 删除 Initiative 改变完成率 → 重算 KR → 向上 rollup.
  let execRollup = null;
  if (keyResultId) {
    try {
      execRollup = await syncKrFromInitiatives(keyResultId, store, {
        actorId: auth.userId,
        eventIdSuffix: `delete:${params.id}`,
      });
    } catch {
      /* fail-soft */
    }
  }
  return NextResponse.json({ ok: true, execRollup });
}
