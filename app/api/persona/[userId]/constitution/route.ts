/**
 * /api/persona/[userId]/constitution — B-027 价值观锚 REST API
 *
 * GET    · 读 active 规则 (仅本人 / admin / steward)
 * POST   · 加一条规则 (仅本人 / admin)
 * DELETE · 归档一条规则 (仅本人 / admin)
 *
 * MANIFESTO §13.2 + §15: 写权限严格限本人, Steward 只读.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  loadConstitution,
  addRule,
  archiveRule,
} from '@/lib/persona/constitution';

function checkSelfOrPrivileged(
  auth: ReturnType<typeof requireAuth>,
  targetUserId: string,
  forWrite: boolean,
): NextResponse | null {
  if (auth instanceof NextResponse) return auth;
  if (auth.userId === targetUserId) return null;
  if (auth.demo) return null;
  const privileged = forWrite ? ['admin'] : ['admin', 'steward'];
  if (auth.roles.some((r) => privileged.includes(r))) return null;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const gate = checkSelfOrPrivileged(auth, params.userId, false);
  if (gate) return gate;

  try {
    const constitution = await loadConstitution(params.userId);
    return NextResponse.json({ constitution: constitution ?? null });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const gate = checkSelfOrPrivileged(auth, params.userId, true);
  if (gate) return gate;

  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text !== 'string') {
      return NextResponse.json({ error: 'text 必填且为字符串' }, { status: 400 });
    }
    const updated = await addRule({
      userId: params.userId,
      text: body.text,
      addedBy: auth.userId,
    });
    return NextResponse.json({ constitution: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const gate = checkSelfOrPrivileged(auth, params.userId, true);
  if (gate) return gate;

  const ruleId = req.nextUrl.searchParams.get('ruleId');
  if (!ruleId) {
    return NextResponse.json({ error: 'ruleId 必填' }, { status: 400 });
  }
  const reason = req.nextUrl.searchParams.get('reason') ?? undefined;

  try {
    const updated = await archiveRule({
      userId: params.userId,
      ruleId,
      archivedBy: auth.userId,
      reason,
    });
    return NextResponse.json({ constitution: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
