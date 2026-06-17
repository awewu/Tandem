/**
 * PATCH  /api/tandem-okr/[id]   — 更新 objective (本租户内)
 * DELETE /api/tandem-okr/[id]   — 删除 objective + 连带其 KR (本租户内)
 *
 * 写权限 (B4 Phase-2 落库, 2026-06-17):
 *   - 仅 objective owner / 老板(owner|admin) / demo 可改删.
 *   - tenantId 一律以鉴权上下文为准, 绝不接受 body 注入.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { OKR_BOSS_ROLES } from '@/lib/okr/visibility';

function isBoss(roles: string[]): boolean {
  return roles.some((r) => OKR_BOSS_ROLES.includes(r as never));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const obj = await store.objectives.get(params.id);
    if (!obj || (obj.tenantId ?? 'default') !== auth.tenantId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!auth.demo && obj.ownerId !== auth.userId && !isBoss(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    // 白名单字段, 绝不接受 tenantId / id / createdAt 注入.
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.cycleId === 'string') patch.cycleId = body.cycleId;
    if (typeof body.ownerId === 'string') patch.ownerId = body.ownerId;
    if (typeof body.level === 'string') patch.level = body.level;
    if ('parentObjectiveId' in body) patch.parentObjectiveId = body.parentObjectiveId ?? undefined;
    if (typeof body.visibility === 'string') patch.visibility = body.visibility;
    if (typeof body.weight === 'number') patch.weight = body.weight;
    if (typeof body.status === 'string') patch.status = body.status;
    if (typeof body.confidence === 'string') patch.confidence = body.confidence;
    if (Array.isArray(body.tags)) patch.tags = body.tags;
    if (Array.isArray(body.collaboratorIds)) patch.collaboratorIds = body.collaboratorIds;
    if (Array.isArray(body.watcherIds)) patch.watcherIds = body.watcherIds;
    if (typeof body.finalScore === 'number') patch.finalScore = body.finalScore;
    if (typeof body.selfScore === 'number') patch.selfScore = body.selfScore;
    if (typeof body.managerScore === 'number') patch.managerScore = body.managerScore;
    if (typeof body.retrospective === 'string') patch.retrospective = body.retrospective;
    const updated = await store.objectives.update(params.id, patch as never);
    return NextResponse.json({ objective: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const obj = await store.objectives.get(params.id);
    if (!obj || (obj.tenantId ?? 'default') !== auth.tenantId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!auth.demo && obj.ownerId !== auth.userId && !isBoss(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // 连带删除其 KR (check-in / initiative 暂留, 不阻塞主删除).
    const krs = (await store.keyResults.list()).filter((k) => k.objectiveId === params.id);
    for (const kr of krs) {
      await store.keyResults.delete(kr.id);
    }
    await store.objectives.delete(params.id);
    return NextResponse.json({ ok: true, deletedKrs: krs.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
