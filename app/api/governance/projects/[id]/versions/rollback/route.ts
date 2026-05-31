/**
 * POST /api/governance/projects/:id/versions/rollback body { version } — 回滚到指定版本
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { rollbackTemplate, GovernanceError } from '@/lib/governance/projects';

const WRITERS = ['manager', 'admin', 'owner', 'champion', 'steward'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, WRITERS);
  if (guard) return guard;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const v = Number(body.version);
  if (!Number.isInteger(v) || v < 1) {
    return NextResponse.json(
      { ok: false, error: 'version 必须是正整数' },
      { status: 400 },
    );
  }

  try {
    const template = await rollbackTemplate(id, v, auth.userId);
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    if (err instanceof GovernanceError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus },
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
