import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { computeBossCaptureScore, checkUpgradeEligibility } from '@/lib/persona/evolution';

/**
 * EVO-7 phase 2 (2026-05-12): 加 auth gate.
 *
 * 旧行为: 任何人可读/改任何 userId 的 persona (含 bossCaptureScore 等敏感分数).
 * 新行为: GET   · 仅本人 / admin / hr / steward 可读
 *        PATCH · 仅本人 / admin 可改 (合 §15 不替员工自决)
 */
function checkSelfOrPrivileged(
  auth: ReturnType<typeof requireAuth>,
  targetUserId: string,
  forWrite: boolean,
): NextResponse | null {
  if (auth instanceof NextResponse) return auth;
  if (auth.userId === targetUserId) return null;
  if (auth.demo) return null;
  const privileged = forWrite
    ? ['admin']
    : ['admin', 'hr', 'steward'];
  if (auth.roles.some((r) => privileged.includes(r))) return null;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const gate = checkSelfOrPrivileged(auth, params.userId, false);
  if (gate) return gate;
  try {
    const store = getStore();
    const list = await store.personas.list({ userId: params.userId } as never);
    const persona = list[0];
    if (!persona) {
      return NextResponse.json({ error: 'persona not found' }, { status: 404 });
    }
    const score = computeBossCaptureScore(persona);
    const upgrade = checkUpgradeEligibility(persona);
    return NextResponse.json({
      persona: { ...persona, bossCaptureScore: score },
      upgrade,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const gate = checkSelfOrPrivileged(auth, params.userId, true);
  if (gate) return gate;
  try {
    const body = await req.json();
    const store = getStore();
    const list = await store.personas.list({ userId: params.userId } as never);
    const persona = list[0];
    if (!persona) {
      return NextResponse.json({ error: 'persona not found' }, { status: 404 });
    }
    const updated = await store.personas.update(persona.id, {
      ...body,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ persona: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
