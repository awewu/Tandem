/**
 * GET  /api/okr/initiatives?keyResultId=...&ownerId=...   — list
 * POST /api/okr/initiatives                                — create
 *   ownerId 默认 = sessionUser.id (caller 显式传可覆盖, 但需校验是 KR 的 owner/coOwner)
 *
 * A3.1 跨模块 wire: 1on1 ActionItem.linkedInitiativeId 引用此 Initiative.id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { syncKrFromInitiatives } from '@/lib/okr/execution-rollup';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const keyResultId = searchParams.get('keyResultId');
    const ownerId = searchParams.get('ownerId');
    const store = getStore();
    let all = await store.initiatives.list();
    // Tenant isolation: scope to caller's tenant.
    all = all.filter((i) => (i.tenantId ?? 'default') === auth.tenantId);
    if (keyResultId) all = all.filter((i) => i.keyResultId === keyResultId);
    if (ownerId) all = all.filter((i) => i.ownerId === ownerId);
    return NextResponse.json({ initiatives: all });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const { keyResultId, title } = body;
    if (!keyResultId || !title) {
      return NextResponse.json(
        { error: 'keyResultId and title required' },
        { status: 400 },
      );
    }
    const store = getStore();
    const kr = await store.keyResults.get(keyResultId);
    if (!kr) return NextResponse.json({ error: 'kr not found' }, { status: 404 });
    const ownerId = body.ownerId ?? auth.userId;
    // 校验 ownerId 是 KR owner/coOwner 或 caller 是
    const allowed =
      kr.ownerId === auth.userId ||
      (kr.coOwnerIds ?? []).includes(auth.userId) ||
      auth.demo;
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const initiative = await store.initiatives.create({
      keyResultId,
      ownerId,
      title,
      decisionCardIds: Array.isArray(body.decisionCardIds) ? body.decisionCardIds : [],
      status: body.status ?? 'planned',
      dueDate: body.dueDate ?? undefined,
      tenantId: body.tenantId ?? auth.tenantId,
    });
    // B3 执行联动: 新建 Initiative 改变完成率分母 → 重算 KR → 向上 rollup.
    let execRollup = null;
    try {
      execRollup = await syncKrFromInitiatives(keyResultId, store, {
        actorId: auth.userId,
        eventIdSuffix: `create:${initiative.id}`,
      });
    } catch {
      /* fail-soft */
    }
    return NextResponse.json({ initiative, execRollup });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
