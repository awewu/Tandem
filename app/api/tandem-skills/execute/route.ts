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
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  let body: { skillId?: string; args?: unknown; isProxy?: boolean; userId?: string; tenantId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  if (!body.skillId) {
    return NextResponse.json({ ok: false, error: 'skillId required' }, { status: 400 });
  }

  const result = await skillRegistry.execute(body.skillId, body.args ?? {}, {
    userId: body.userId ?? 'demo_user',
    tenantId: body.tenantId ?? 'default',
    isProxy: body.isProxy ?? false,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
