/**
 * GET /api/persona/proxy-actions
 *
 * 列出当前用户的代行历史 (拿捏闭环 ③+④ 入口).
 * Query:
 *   - status?: drafted|awaiting_veto|executed|vetoed|expired
 *   - limit?: number (default 50)
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listProxyActionsForUser } from '@/lib/persona/proxy-actions';
import type { ProxyActionStatus } from '@/lib/types/proxy-action';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as ProxyActionStatus | null;
  const limit = Number(url.searchParams.get('limit') ?? '50');

  const actions = await listProxyActionsForUser(auth.userId, auth.tenantId, {
    status: status ?? undefined,
    limit,
  });

  return NextResponse.json({ ok: true, actions });
}
