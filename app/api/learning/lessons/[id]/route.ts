/**
 * GET    /api/learning/lessons/[id]   — 读取单条 (课时页; 已发布非归档对全员可见)
 * PATCH  /api/learning/lessons/[id]   — 更新 / 发布草稿 / archive (admin/champion/steward)
 * DELETE /api/learning/lessons/[id]   — 软删 (archivedAt = now)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import type { Lesson } from '@/lib/learning/types';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const lesson = await store.lessons.get(params.id);
    if (!lesson || (lesson.tenantId ?? 'default') !== auth.tenantId || !lesson.publishedAt || lesson.archivedAt) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ lesson });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function loadAndAuthorize(
  req: NextRequest,
  lessonId: string,
): Promise<{ error: NextResponse } | { lesson: Lesson; userId: string }> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return { error: auth };
  const forbidden = requireRole(auth, [...DATA_STEWARD_ROLES, 'champion']);
  if (forbidden) return { error: forbidden };
  const store = getStore();
  const lesson = await store.lessons.get(lessonId);
  if (!lesson || (lesson.tenantId ?? 'default') !== auth.tenantId) {
    return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  return { lesson, userId: auth.userId };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const r = await loadAndAuthorize(req, params.id);
  if ('error' in r) return r.error;
  try {
    const body = await req.json();
    const allowed = [
      'title', 'summary', 'category', 'requirement', 'durationMin',
      'contentMarkdown', 'sourceRefs', 'rewardMode', 'rewardScore', 'linkedKrId',
    ];
    const patch: Partial<Lesson> = { updatedAt: new Date().toISOString() };
    for (const k of allowed) if (k in body) (patch as Record<string, unknown>)[k] = body[k];

    if (body.publish === true && !r.lesson.publishedAt) {
      patch.publishedAt = new Date().toISOString();
    }
    if (body.unpublish === true) patch.publishedAt = null;
    if (body.archive === true) patch.archivedAt = new Date().toISOString();
    else if (body.unarchive === true) patch.archivedAt = null;

    const store = getStore();
    const updated = await store.lessons.update(params.id, patch as never);
    return NextResponse.json({ lesson: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const r = await loadAndAuthorize(req, params.id);
  if ('error' in r) return r.error;
  try {
    const store = getStore();
    await store.lessons.update(params.id, { archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as never);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
