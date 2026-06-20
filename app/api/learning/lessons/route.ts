/**
 * GET  /api/learning/lessons   — 列出课程 (默认仅已发布非归档; ?includeArchived=1&includeDrafts=1 给管理后台)
 * POST /api/learning/lessons   — 创建课程 (admin/champion/steward)
 *
 * Academy CMS · 课程内容真落库 (store.lessons, collection 'learning_lessons').
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import type { Lesson, LessonCategory, LessonRequirement } from '@/lib/learning/types';

const VALID_CATEGORIES: LessonCategory[] = ['onboarding', 'compliance', 'products', 'processes', 'tracks'];
const VALID_REQUIREMENTS: LessonRequirement[] = ['mandatory_once', 'mandatory_quarterly', 'recommended', 'elective'];

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get('category') as LessonCategory | null;
    const includeArchived = searchParams.get('includeArchived') === '1';
    const includeDrafts = searchParams.get('includeDrafts') === '1';

    const store = getStore();
    // Tenant isolation: 收敛到统一 withTenantScope (宪章 §23).
    let lessons = await withTenantScope(store.lessons, auth.tenantId).list();
    if (categoryFilter && VALID_CATEGORIES.includes(categoryFilter)) {
      lessons = lessons.filter((l) => l.category === categoryFilter);
    }
    if (!includeArchived) lessons = lessons.filter((l) => !l.archivedAt);
    if (!includeDrafts) lessons = lessons.filter((l) => !!l.publishedAt);

    lessons.sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : Date.parse(a.createdAt ?? '') || 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : Date.parse(b.createdAt ?? '') || 0;
      return bt - at;
    });

    return NextResponse.json({ lessons });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, [...DATA_STEWARD_ROLES, 'champion']);
  if (forbidden) return forbidden;

  try {
    const body = await req.json();
    const { title, category, requirement } = body;
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 });
    }
    if (!requirement || !VALID_REQUIREMENTS.includes(requirement)) {
      return NextResponse.json({ error: 'invalid requirement' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const draft = body.draft === true;
    const lesson: Lesson = {
      id: `l_${crypto.randomUUID()}`,
      title: title.trim(),
      category,
      requirement,
      durationMin: Number.isFinite(body.durationMin) ? Math.max(1, Math.floor(body.durationMin)) : 10,
      summary: typeof body.summary === 'string' ? body.summary.trim().slice(0, 280) : '',
      sourceRefs: Array.isArray(body.sourceRefs) ? body.sourceRefs.slice(0, 20) : [],
      contentMarkdown: typeof body.contentMarkdown === 'string' ? body.contentMarkdown : undefined,
      rewardMode: body.rewardMode || undefined,
      rewardScore: Number.isFinite(body.rewardScore) ? body.rewardScore : undefined,
      linkedKrId: typeof body.linkedKrId === 'string' && body.linkedKrId ? body.linkedKrId : undefined,
      tenantId: auth.tenantId,
      publishedAt: draft ? null : now,
      publishedBy: auth.userId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const store = getStore();
    await store.lessons.create(lesson as never);
    return NextResponse.json({ lesson });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
