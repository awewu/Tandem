/**
 * POST /api/persona/proxy-actions/[id]/confirm
 *
 * 员工显式确认代行 (跳过 24h 等待, 立即落定).
 *
 * ON-2: kind='ontology_action' 是"延迟执行"代行 (真写发生在确认/否决窗后),
 * 故走 `confirmAndMaterialize` —— 它对 ontology_action 先跑 executeAction 真写再标 executed,
 * 对其它 kind 退化为普通 confirmProxyAction (仅翻状态)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { confirmAndMaterialize } from '@/lib/ontology';
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
    const result = await confirmAndMaterialize(params.id, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? 'confirm_failed' }, { status: 400 });
    }
    const updated = await store.proxyActions.get(params.id);
    return NextResponse.json({ ok: true, action: updated, materialized: !!result.execResult });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
