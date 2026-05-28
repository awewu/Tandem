/**
 * POST /api/persona/proxy-actions/[id]/confirm
 *
 * 员工显式确认代行 (跳过 24h 等待, 立即落定).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { confirmProxyAction } from '@/lib/persona/proxy-actions';
import { getStore } from '@/lib/storage/repository';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(_req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const action = await store.proxyActions.get(params.id);
  if (!action) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (action.tenantId !== auth.tenantId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  // 仅本人可确认 (老板可否决, 但不可代为确认)
  if (action.userId !== auth.userId) {
    return NextResponse.json({ ok: false, error: 'only_owner_can_confirm' }, { status: 403 });
  }

  try {
    const updated = await confirmProxyAction(params.id, auth.userId);
    return NextResponse.json({ ok: true, action: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
