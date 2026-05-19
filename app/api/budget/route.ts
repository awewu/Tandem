import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { budgetTracker } from '@/lib/taf/budget/tracker';
import { requireAuth } from '@/lib/auth/require-auth';

/**
 * GET /api/budget?scope=tenant:default      → 查询剩余
 * POST /api/budget    Body: { scope, limit, resetHours? }  → 设置预算
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope');
  if (!scope) {
    return NextResponse.json({ snapshot: budgetTracker.snapshot() });
  }
  return NextResponse.json({
    scope,
    remaining: budgetTracker.remaining(scope),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const body = (await req.json().catch(() => ({}))) as {
    scope?: string;
    limit?: number;
    resetHours?: number;
  };
  if (!body.scope || !body.limit) {
    return NextResponse.json({ ok: false, error: 'scope + limit required' }, { status: 400 });
  }
  budgetTracker.setLimit(body.scope, body.limit, body.resetHours);
  return NextResponse.json({ ok: true, scope: body.scope, limit: body.limit });
}
