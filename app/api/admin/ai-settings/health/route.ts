/**
 * GET /api/admin/ai-settings/health
 * 对当前已注册的所有 LLM provider 跑一次连通性自检 (各发一个最小 ping).
 * 用于"换底座/换中继后一键验证可达". owner/admin only.
 *
 * 返回: { primary, providers: { [name]: { healthy, latencyMs?, error? } } }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const router = getRouter();
  const providers = await router.healthCheckAll();
  return NextResponse.json({
    primary: router.getPrimaryOverride(),
    providers,
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/ai-settings/health' });
