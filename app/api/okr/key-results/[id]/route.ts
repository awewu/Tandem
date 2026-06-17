/**
 * PATCH  /api/okr/key-results/[id]   — 更新 KR (B4 Phase-2 落库, 2026-06-17)
 * DELETE /api/okr/key-results/[id]   — 删除 KR
 *
 * 写权限: KR owner / 父 objective owner / 老板(owner|admin) / demo.
 *         tenantId / id / createdAt 绝不接受 body 注入.
 *
 * 注: KR 的 currentValue / confidence 等"测量"字段正路应走 check-in (信任铁律),
 *     此 PATCH 仅用于编辑 KR 定义 (标题 / 目标值 / 权重 / 类型 等); UI 编辑弹窗用.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { OKR_BOSS_ROLES } from '@/lib/okr/visibility';
import type { Confidence } from '@/lib/types/okr-tti';

function isBoss(roles: string[]): boolean {
  return roles.some((r) => OKR_BOSS_ROLES.includes(r as never));
}

function toRiskStatus(c: Confidence): 'on_track' | 'at_risk' | 'off_track' {
  return c === 'at-risk' ? 'at_risk' : c === 'off-track' ? 'off_track' : 'on_track';
}

async function guard(req: NextRequest, id: string) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return { error: auth };
  const store = getStore();
  const kr = await store.keyResults.get(id);
  if (!kr || (kr.tenantId ?? 'default') !== auth.tenantId) {
    return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  }
  const obj = await store.objectives.get(kr.objectiveId);
  const allowed =
    auth.demo ||
    kr.ownerId === auth.userId ||
    (obj && obj.ownerId === auth.userId) ||
    isBoss(auth.roles);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { auth, store, kr };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const g = await guard(req, params.id);
  if (g.error) return g.error;
  const { store } = g;
  try {
    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.ownerId === 'string') patch.ownerId = body.ownerId;
    if (typeof body.measureType === 'string') patch.measureType = body.measureType;
    if (typeof body.computeMethod === 'string') patch.computeMethod = body.computeMethod;
    if (typeof body.startValue === 'number') patch.startValue = body.startValue;
    if (typeof body.targetValue === 'number') patch.targetValue = body.targetValue;
    if (typeof body.currentValue === 'number') patch.currentValue = body.currentValue;
    if ('unit' in body) patch.unit = body.unit ?? '';
    if (typeof body.confidence === 'string') {
      patch.confidence = body.confidence;
      patch.riskStatus = toRiskStatus(body.confidence as Confidence);
    }
    if (typeof body.weight === 'number') patch.weight = body.weight;
    if (typeof body.status === 'string') patch.status = body.status;
    if ('dueDate' in body) patch.dueDate = body.dueDate ?? undefined;
    if (Array.isArray(body.tags)) patch.tags = body.tags;
    if (Array.isArray(body.collaboratorIds)) patch.collaboratorIds = body.collaboratorIds;
    if (Array.isArray(body.watcherIds)) patch.watcherIds = body.watcherIds;
    const updated = await store.keyResults.update(params.id, patch as never);
    return NextResponse.json({ keyResult: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const g = await guard(req, params.id);
  if (g.error) return g.error;
  const { store } = g;
  try {
    await store.keyResults.delete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
