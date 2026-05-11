/**
 * GET /api/me/retro-pending
 *
 * EVO-1 · 决议节奏护栏 · 返回当前用户"该复盘"的决议列表 (最多 3 条).
 *
 * 守则:
 *   - requireAuth: session 缺失返回空数组 (不暴露 401, 静默退化)
 *   - 不在响应里夹带任何 PII 之外的私人字段, 仅 decisionId / title / 天数 / 紧迫等级
 *   - 永不外发 (无推送 webhook), 仅由 dashboard 主动 GET
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import { derivePendingRetros, topPendingRetros } from '@/lib/decisions/cadence';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) {
    // 静默退化 · 不暴露 401, dashboard 看到空即可
    return NextResponse.json({ items: [], hiddenCount: 0, total: 0 });
  }
  const store = getStore();
  const cards = await store.decisionCards.list();
  const retros = derivePendingRetros(cards, auth.userId);
  const { items, hiddenCount } = topPendingRetros(retros, 3);
  return NextResponse.json({
    items,
    hiddenCount,
    total: retros.length,
  });
}
