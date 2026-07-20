/**
 * GET /api/story-chain
 *
 * Phase 4 · 点亮 · 端到端故事链 provenance (只读):
 *   - 无 ?krId → 返回可选锚点 KR 列表 (供 UI picker)
 *   - ?krId=xxx → 返回该 KR 的完整链路 (议→沉→拿→算)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { buildStoryChain, listAnchorKrs } from '@/lib/story-chain/aggregate';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const krId = new URL(req.url).searchParams.get('krId');
  if (!krId) {
    const anchors = await listAnchorKrs(auth.tenantId);
    return NextResponse.json({ anchors });
  }

  const chain = await buildStoryChain(krId, auth.tenantId);
  if (!chain) return NextResponse.json({ error: 'KR not found' }, { status: 404 });
  return NextResponse.json({ chain });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/story-chain' });
