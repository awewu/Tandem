import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { membershipKey } from '@/lib/types/im';
import { requireAuth } from '@/lib/auth/require-auth';

/**
 * PATCH /api/im/channels/:id/agent-mode
 * Body: { mode: 'manual'|'agent-confirm'|'agent-auto', expiresInMinutes? }
 *
 * §T15 切换本频道内"分身/真人"模式. 仅本人可改自己的 membership.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'manual' | 'agent-confirm' | 'agent-auto';
    expiresInMinutes?: number;
  };
  if (!body.mode || !['manual', 'agent-confirm', 'agent-auto'].includes(body.mode)) {
    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
  }

  const store = getStore();
  const key = membershipKey(params.id, auth.userId);
  const m = await store.imMemberships.get(key);
  if (!m) return NextResponse.json({ error: 'not a member' }, { status: 404 });

  const now = new Date().toISOString();
  const expiresAt =
    body.mode === 'agent-auto' && body.expiresInMinutes
      ? new Date(Date.now() + body.expiresInMinutes * 60_000).toISOString()
      : undefined;

  const updated = await store.imMemberships.update(key, {
    agentMode: body.mode,
    agentModeSince: body.mode === 'manual' ? undefined : now,
    agentModeExpiresAt: expiresAt,
  });

  return NextResponse.json({ membership: updated });
}
