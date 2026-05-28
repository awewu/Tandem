/**
 * POST /api/persona/proxy-actions/[id]/veto
 *
 * 员工 (或老板) 在 24h 否决窗口内撤销代行.
 * Body: { reason?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { vetoProxyAction } from '@/lib/persona/proxy-actions';
import { getStore } from '@/lib/storage/repository';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const action = await store.proxyActions.get(params.id);
  if (!action) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (action.tenantId !== auth.tenantId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  // 仅本人 / manager / admin 可否决
  const isSelf = action.userId === auth.userId;
  const isManager = auth.roles.some((r) => ['manager', 'admin', 'owner'].includes(r));
  if (!isSelf && !isManager) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }

  try {
    const updated = await vetoProxyAction(params.id, auth.userId, body.reason);
    return NextResponse.json({ ok: true, action: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
