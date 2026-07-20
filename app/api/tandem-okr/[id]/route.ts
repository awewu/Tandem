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
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { OKR_BOSS_ROLES, hasOkrApproverRole } from '@/lib/okr/visibility';
import { authorizeStatusChange, type LifecycleActor } from '@/lib/okr/objective-lifecycle';
import type { ObjectiveStatus as ClientObjectiveStatus } from '@/lib/store/okr';
import { withApiLog } from '@/lib/api-log/with-api-log';

function isBoss(roles: string[]): boolean {
  return roles.some((r) => OKR_BOSS_ROLES.includes(r as never));
}

/**
 * 服务端 ObjectiveStatus ('abandoned') → 生命周期状态机用的客户端枚举 ('archived').
 * 其余同名直通. 服务端存的是 'abandoned', 而 objective-lifecycle 走客户端枚举.
 */
function toLifecycleStatus(s: string): ClientObjectiveStatus {
  return (s === 'abandoned' ? 'archived' : s) as ClientObjectiveStatus;
}

async function PATCHApiHandler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const objectives = withTenantScope(store.objectives, auth.tenantId);
    const obj = await objectives.get(params.id);
    if (!obj) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const body = await req.json();

    const isOwner = obj.ownerId === auth.userId;
    const isBossRole = isBoss(auth.roles);
    const isApprover = hasOkrApproverRole(auth.roles);

    // ── 内容字段白名单 (绝不接受 tenantId / id / createdAt / status 注入; status 单独走状态机) ──
    const patch: Record<string, unknown> = {};
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.cycleId === 'string') patch.cycleId = body.cycleId;
    if (typeof body.ownerId === 'string') patch.ownerId = body.ownerId;
    if (typeof body.level === 'string') patch.level = body.level;
    if ('parentObjectiveId' in body) patch.parentObjectiveId = body.parentObjectiveId ?? null;
    if (typeof body.visibility === 'string') patch.visibility = body.visibility;
    if (typeof body.weight === 'number') patch.weight = body.weight;
    if (typeof body.confidence === 'string') patch.confidence = body.confidence;
    if (Array.isArray(body.tags)) patch.tags = body.tags;
    if (Array.isArray(body.collaboratorIds)) patch.collaboratorIds = body.collaboratorIds;
    if (Array.isArray(body.watcherIds)) patch.watcherIds = body.watcherIds;
    if (typeof body.finalScore === 'number') patch.finalScore = body.finalScore;
    if (typeof body.selfScore === 'number') patch.selfScore = body.selfScore;
    if (typeof body.managerScore === 'number') patch.managerScore = body.managerScore;
    if (typeof body.retrospective === 'string') patch.retrospective = body.retrospective;
    const hasContentEdit = Object.keys(patch).length > 0;

    // ── 状态变更: 服务端强制走审批漏斗状态机 + 角色校验 (此前闸只在前端 = 可绕过) ──
    const statusChanging = typeof body.status === 'string' && body.status !== obj.status;
    if (statusChanging && !auth.demo) {
      const actors: LifecycleActor[] = [];
      if (isOwner) actors.push('owner');
      if (isApprover) actors.push('approver');
      const verdict = authorizeStatusChange(
        toLifecycleStatus(obj.status),
        toLifecycleStatus(body.status),
        actors,
      );
      if (!verdict.ok) {
        return NextResponse.json(
          { error: verdict.reason === 'invalid_transition' ? 'invalid_status_transition' : 'forbidden' },
          { status: verdict.reason === 'invalid_transition' ? 400 : 403 },
        );
      }
    }
    if (statusChanging) patch.status = body.status;

    // ── 内容编辑授权: 仅 owner / 老板(owner|admin) / demo 可改内容字段 (approver 只能改状态) ──
    if (hasContentEdit && !auth.demo && !isOwner && !isBossRole) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    if (!hasContentEdit && !statusChanging) {
      return NextResponse.json({ objective: obj });
    }

    patch.updatedAt = new Date().toISOString();
    const updated = await objectives.update(params.id, patch as never);
    return NextResponse.json({ objective: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/tandem-okr/[id]' });

async function DELETEApiHandler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const objectives = withTenantScope(store.objectives, auth.tenantId);
    const keyResults = withTenantScope(store.keyResults, auth.tenantId);
    const obj = await objectives.get(params.id);
    if (!obj) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!auth.demo && obj.ownerId !== auth.userId && !isBoss(auth.roles)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // 连带删除其 KR (check-in / initiative 暂留, 不阻塞主删除).
    const krs = await keyResults.list({ objectiveId: params.id });
    for (const kr of krs) {
      await keyResults.delete(kr.id);
    }
    await objectives.delete(params.id);
    return NextResponse.json({ ok: true, deletedKrs: krs.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/tandem-okr/[id]' });
