import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { skillRegistry } from '@/lib/taf/skills';
import { requireAuth } from '@/lib/auth/require-auth';

/**
 * POST /api/tandem-skills/execute
 *
 * Body: { skillId: string, args: object, isProxy?: boolean }
 *
 * 服务端代执行 skill (带审计 + 红区守门).
 *
 * 安全 (P0-A): 调用身份 (userId / tenantId) **一律取自鉴权上下文**, 绝不接受
 * 请求体注入 — 否则任何登录用户可传 body.userId=他人 冒充执行 (skill 内
 * data-scope 用 ctx.userId), 或传 body.tenantId 跨租户。body 仅决定 skillId/args/isProxy。
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  let body: { skillId?: string; args?: unknown; isProxy?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  if (!body.skillId) {
    return NextResponse.json({ ok: false, error: 'skillId required' }, { status: 400 });
  }

  const result = await skillRegistry.execute(body.skillId, body.args ?? {}, {
    userId: auth.userId,
    tenantId: auth.tenantId,
    isProxy: body.isProxy ?? false,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
