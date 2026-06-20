/**
 * POST /api/okr/key-results   — 新建 KR (B4 Phase-2 落库, 2026-06-17)
 *   body: { objectiveId, title, ownerId?, measureType?, startValue?, targetValue?,
 *           currentValue?, unit?, weight?, confidence?, status?, dueDate?, tags? }
 *
 * 写权限: 父 objective owner / 老板(owner|admin) / demo.
 *         ownerId 默认 = 父 objective.ownerId (再退到 caller).
 *         tenantId 一律继承父 objective (绝不接受 body 注入).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { OKR_BOSS_ROLES } from '@/lib/okr/visibility';
import type { Confidence } from '@/lib/types/okr-tti';

function isBoss(roles: string[]): boolean {
  return roles.some((r) => OKR_BOSS_ROLES.includes(r as never));
}

function toRiskStatus(c: Confidence): 'on_track' | 'at_risk' | 'off_track' {
  return c === 'at-risk' ? 'at_risk' : c === 'off-track' ? 'off_track' : 'on_track';
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const { objectiveId, title } = body;
    if (!objectiveId || !title) {
      return NextResponse.json({ error: 'objectiveId and title required' }, { status: 400 });
    }
    const store = getStore();
    const obj = await withTenantScope(store.objectives, auth.tenantId).get(objectiveId);
    if (!obj) {
      return NextResponse.json({ error: 'objective not found' }, { status: 404 });
    }
    if (!auth.demo && obj.ownerId !== auth.userId && !isBoss(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const confidence: Confidence = body.confidence ?? 'on-track';
    const now = new Date().toISOString();
    const kr = await withTenantScope(store.keyResults, auth.tenantId).create({
      objectiveId,
      ownerId: typeof body.ownerId === 'string' ? body.ownerId : obj.ownerId,
      coOwnerIds: Array.isArray(body.coOwnerIds) ? body.coOwnerIds : [],
      title,
      measureType: body.measureType ?? 'numeric',
      computeMethod: body.computeMethod ?? 'latest',
      startValue: typeof body.startValue === 'number' ? body.startValue : 0,
      targetValue: typeof body.targetValue === 'number' ? body.targetValue : 100,
      currentValue: typeof body.currentValue === 'number' ? body.currentValue : 0,
      unit: body.unit ?? '',
      confidence,
      riskStatus: toRiskStatus(confidence),
      weight: typeof body.weight === 'number' ? body.weight : 1,
      status: body.status ?? 'active',
      dueDate: body.dueDate ?? undefined,
      tags: Array.isArray(body.tags) ? body.tags : [],
      collaboratorIds: Array.isArray(body.collaboratorIds) ? body.collaboratorIds : [],
      watcherIds: Array.isArray(body.watcherIds) ? body.watcherIds : [],
      // tenantId 由 withTenantScope 强制注入 auth.tenantId (与父 objective 同租户).
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ keyResult: kr });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
