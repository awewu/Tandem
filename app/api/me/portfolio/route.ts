/**
 * GET /api/me/portfolio
 *
 * 聚合当前用户的"代表作"——全部来自真实 store，不造假：
 *   - certification: 已获得的学院认证 (store.learningCertifications)
 *   - achievement:   日报 check-in 中填了 achievements 的真实产出 (store.checkIns)
 *   - decision:      本人 COMMIT 的决议 (store.decisionCards)
 *
 * 按时间倒序合并。空 → { items: [] }，前端显示"暂无代表作"。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import type { CheckIn, KeyResult } from '@/lib/types/okr-tti';

export const dynamic = 'force-dynamic';

interface PortfolioItem {
  id: string;
  kind: 'certification' | 'achievement' | 'decision';
  title: string;
  detail?: string;
  date: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const userId = auth.userId;
  const items: PortfolioItem[] = [];

  // 1. 认证
  try {
    const [certs, lessons] = await Promise.all([
      store.learningCertifications.list(),
      store.lessons.list(),
    ]);
    const lessonMap = new Map(lessons.map((l) => [l.id, l.title]));
    for (const c of certs.filter((x) => x.userId === userId)) {
      items.push({
        id: `cert_${c.id}`,
        kind: 'certification',
        title: lessonMap.get(c.lessonId) ?? '学院认证',
        detail: '获得能力认证',
        date: c.earnedAt,
      });
    }
  } catch {
    /* fail-soft */
  }

  // 2. check-in 真实产出
  try {
    const checkIns = (await store.checkIns.list()) as CheckIn[];
    const mine = checkIns
      .filter((c) => c.authorId === userId && c.scope === 'kr' && c.achievements?.trim())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 20);
    const krCache = new Map<string, KeyResult | null>();
    for (const c of mine) {
      let kr = krCache.get(c.scopeId);
      if (kr === undefined) {
        kr = (await store.keyResults.get(c.scopeId)) as KeyResult | null;
        krCache.set(c.scopeId, kr ?? null);
      }
      items.push({
        id: `ach_${c.id}`,
        kind: 'achievement',
        title: kr?.title ?? '工作产出',
        detail: c.achievements ?? undefined,
        date: c.createdAt,
      });
    }
  } catch {
    /* fail-soft */
  }

  // 3. COMMIT 决议
  try {
    const cards = (await store.decisionCards.list()) as Array<{
      id: string;
      title?: string;
      ownerUserId?: string;
      createdBy?: string;
      convergenceState?: string;
      createdAt: string;
      tenantId?: string;
    }>;
    for (const c of cards.filter(
      (x) =>
        x.convergenceState === 'COMMIT' &&
        (x.ownerUserId === userId || x.createdBy === userId),
    )) {
      items.push({
        id: `dec_${c.id}`,
        kind: 'decision',
        title: c.title ?? '决议',
        detail: '已收敛 COMMIT 的决策',
        date: c.createdAt,
      });
    }
  } catch {
    /* fail-soft */
  }

  items.sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({ items });
}
