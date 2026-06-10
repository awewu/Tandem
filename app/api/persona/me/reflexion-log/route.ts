/**
 * GET /api/persona/me/reflexion-log?days=7&limit=20
 *
 * Gap3 · 把后端真在学的事实暴露到用户能看见的"进化感"面板。
 *
 * 返回:
 *   - windowDays           · 本次查询窗口
 *   - pattern              · analyzeReflexionPatterns 聚合 (byCategory / skillMisuseCounts / total)
 *   - recentLessons        · 窗口内具体教训列表 (倒序, 限制 limit 条)
 *   - lifetimeTotal        · 自分身建立以来累计反思总数 (信心来源)
 *
 * 设计:
 *   - 仅返回 caller 本人的 personal episodic lessons (隐私边界, 别人看不到)
 *   - fail-soft: 出错返回空结构 + 200, UI 友好显示"暂无", 不阻塞页面
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { analyzeReflexionPatterns, REFLEXION_TAG } from '@/lib/persona/reflexion';
import type { MemoryEntry } from '@/lib/types/memory';

export const runtime = 'nodejs';

interface RecentLesson {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: string;
  trigger: string;
  skillId?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') ?? '7', 10) || 7));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));

  try {
    const store = getStore();
    const all = await store.memories.list();
    const sinceMs = Date.now() - days * 86400_000;

    const mine = all.filter(
      (m: MemoryEntry) =>
        m.ownershipLevel === 'personal' &&
        m.ownerUserId === auth.userId &&
        m.type === 'lesson' &&
        (m.tags ?? []).includes(REFLEXION_TAG),
    );

    const lifetimeTotal = mine.length;

    const recent: RecentLesson[] = mine
      .filter((m) => new Date(m.createdAt ?? 0).getTime() >= sinceMs)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, limit)
      .map((m) => {
        const tags = m.tags ?? [];
        const catTag = tags.find((t) => t.startsWith('category:'));
        const trigTag = tags.find((t) => t.startsWith('trigger:'));
        const skillTag = tags.find((t) => t.startsWith('skill:'));
        return {
          id: m.id,
          title: m.title ?? '(no title)',
          body: m.body ?? '',
          createdAt: m.createdAt ?? new Date(0).toISOString(),
          category: catTag ? catTag.slice('category:'.length) : 'other',
          trigger: trigTag ? trigTag.slice('trigger:'.length) : 'unknown',
          skillId: skillTag ? skillTag.slice('skill:'.length) : undefined,
        };
      });

    const pattern = await analyzeReflexionPatterns(auth.userId, days);

    return NextResponse.json({
      windowDays: days,
      lifetimeTotal,
      pattern,
      recentLessons: recent,
    });
  } catch (err) {
    return NextResponse.json(
      {
        windowDays: days,
        lifetimeTotal: 0,
        pattern: {
          byCategory: { skill_misuse: 0, okr_drift: 0, knowledge_gap: 0, judgment: 0, other: 0 },
          skillMisuseCounts: [],
          total: 0,
          windowStart: new Date(Date.now() - days * 86400_000).toISOString(),
        },
        recentLessons: [],
        warning: `reflexion-log failed (fail-soft): ${(err as Error).message}`,
      },
      { status: 200 },
    );
  }
}
