/**
 * /api/admin/personas/:userId · 管理员手动设定分身阶段 (Owner/Admin)
 *
 * PATCH  Body: { stage: PersonaStage, delegationLevel?: DelegationLevel }
 *        组织主权侧 override: 直接设阶段 + 委托级别 (绕过自然升级条件), 全程留痕。
 *        persona 不存在时自动建档再设阶段。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { adminSetPersonaStage } from '@/lib/persona/evolution';
import type { PersonaStage, DelegationLevel } from '@/lib/types/persona';

const VALID_STAGES: PersonaStage[] = ['newborn', 'apprentice', 'assistant', 'deputy', 'partner'];
const VALID_LEVELS: DelegationLevel[] = [
  'observe_only',
  'report_only',
  'soft_opinion',
  'commit_short',
  'commit_long',
  'cross_company',
];

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;

  const body = (await req.json().catch(() => ({}))) as {
    stage?: string;
    delegationLevel?: string;
  };

  if (!body.stage || !VALID_STAGES.includes(body.stage as PersonaStage)) {
    return NextResponse.json(
      { ok: false, error: `stage 必填且须为 ${VALID_STAGES.join(' / ')}` },
      { status: 400 },
    );
  }
  if (body.delegationLevel && !VALID_LEVELS.includes(body.delegationLevel as DelegationLevel)) {
    return NextResponse.json(
      { ok: false, error: `delegationLevel 非法` },
      { status: 400 },
    );
  }

  try {
    const persona = await adminSetPersonaStage(params.userId, body.stage as PersonaStage, {
      actorUserId: auth.userId,
      delegationLevel: body.delegationLevel as DelegationLevel | undefined,
    });
    return NextResponse.json({ ok: true, persona });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
