/**
 * GET  /api/okr/checkins?scope=objective|kr&scopeId=...   — list check-ins
 * POST /api/okr/checkins
 *   body: { scope, scopeId, progressBefore, progressAfter, confidenceBefore,
 *           confidenceAfter, achievements, blockers, nextSteps, mood }
 *   authorId 强制 = sessionUser.id
 *
 * 校验:
 *   - 仅 owner / coOwner / collaborator / watcher 可 POST (V1: owner only)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const scopeId = searchParams.get('scopeId');
    const store = getStore();
    let all = await store.checkIns.list();
    if (scope) all = all.filter((c) => c.scope === scope);
    if (scopeId) all = all.filter((c) => c.scopeId === scopeId);
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return NextResponse.json({ checkIns: all });
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
    const { scope, scopeId } = body;
    if (!scope || !scopeId || (scope !== 'objective' && scope !== 'kr')) {
      return NextResponse.json(
        { error: 'scope (objective|kr) and scopeId required' },
        { status: 400 },
      );
    }
    const store = getStore();
    // 验证 scopeId 存在 & 调用者是 owner/coOwner
    if (scope === 'objective') {
      const obj = await store.objectives.get(scopeId);
      if (!obj) return NextResponse.json({ error: 'objective not found' }, { status: 404 });
      const allowed =
        obj.ownerId === auth.userId ||
        (obj.collaboratorIds ?? []).includes(auth.userId) ||
        auth.demo;
      if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    } else {
      const kr = await store.keyResults.get(scopeId);
      if (!kr) return NextResponse.json({ error: 'kr not found' }, { status: 404 });
      const allowed =
        kr.ownerId === auth.userId ||
        (kr.coOwnerIds ?? []).includes(auth.userId) ||
        auth.demo;
      if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const checkIn = await store.checkIns.create({
      scope,
      scopeId,
      authorId: auth.userId,
      progressBefore: typeof body.progressBefore === 'number' ? body.progressBefore : 0,
      progressAfter: typeof body.progressAfter === 'number' ? body.progressAfter : 0,
      confidenceBefore: body.confidenceBefore ?? 'on-track',
      confidenceAfter: body.confidenceAfter ?? 'on-track',
      achievements: body.achievements ?? null,
      blockers: body.blockers ?? null,
      nextSteps: body.nextSteps ?? null,
      mood: body.mood ?? null,
      createdAt: new Date().toISOString(),
    });
    // 如果是 KR check-in: 同步更新 KR 的 currentValue + confidence
    if (scope === 'kr' && (typeof body.currentValue === 'number' || typeof body.confidenceAfter === 'string')) {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (typeof body.currentValue === 'number') patch.currentValue = body.currentValue;
      if (typeof body.confidenceAfter === 'string') patch.confidence = body.confidenceAfter;
      await store.keyResults.update(scopeId, patch);
    }
    return NextResponse.json({ checkIn });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
