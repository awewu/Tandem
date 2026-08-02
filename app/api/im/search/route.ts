/**
 * GET /api/im/search?q=&channelId=&limit=
 *
 * §Sprint1 (Megaplan) · IM 全文 + 语义消息搜索。
 * 只在当前用户可见频道内检索; 越权/跨租户频道消息绝不返回。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { searchMessages } from '@/lib/im/search';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ results: [] });

  const channelId = url.searchParams.get('channelId') ?? undefined;
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 30;

  const results = await searchMessages({
    userId: auth.userId,
    tenantId: auth.tenantId,
    query: q,
    channelId,
    limit,
  });
  return NextResponse.json({ results });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/im/search' });
