/**
 * IM 定时日报 cron 触发 (§Sprint3 群机器人)
 *
 * GET  供 Vercel Cron (自动带 Authorization: Bearer CRON_SECRET), 仅密钥鉴权, tenant='default'。
 * POST 供外部调度器 (x-cron-secret) 或已登录内部用户手动触发; body: { tenantId? }。
 *
 * 鉴权二选一 (镜像 app/api/pms/cron):
 *   - Header x-cron-secret === process.env.CRON_SECRET, 或 Authorization: Bearer <secret>
 *   - 或 已登录内部用户 (admin/owner/manager)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { runDailyDigest } from '@/lib/im/daily-digest';
import { INTERNAL_ROLES } from '@/lib/auth/roles';
import { withApiLog } from '@/lib/api-log/with-api-log';

function cronSecretOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-cron-secret');
  const bearer = req.headers.get('authorization');
  return header === secret || bearer === `Bearer ${secret}`;
}

async function GETApiHandler(req: NextRequest) {
  await boot();
  if (!cronSecretOk(req)) {
    return NextResponse.json({ error: 'unauthorized: invalid cron secret' }, { status: 401 });
  }
  const result = await runDailyDigest('default');
  return NextResponse.json({ result });
}

async function POSTApiHandler(req: NextRequest) {
  await boot();
  let tenantId = 'default';

  if (!cronSecretOk(req)) {
    // 回退到内部用户鉴权 (仅内部角色可手动触发)
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const isInternal = auth.roles.some((r) => (INTERNAL_ROLES as readonly string[]).includes(r));
    if (!isInternal) {
      return NextResponse.json({ error: 'forbidden: cron requires internal role or cron secret' }, { status: 403 });
    }
    tenantId = auth.tenantId ?? 'default';
  } else {
    const body = (await req.json().catch(() => ({}))) as { tenantId?: unknown };
    if (typeof body.tenantId === 'string' && body.tenantId) tenantId = body.tenantId;
  }

  const result = await runDailyDigest(tenantId);
  return NextResponse.json({ result });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/im/cron/daily-digest' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/im/cron/daily-digest' });
