import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { computeBossCaptureScore, checkUpgradeEligibility } from '@/lib/persona/evolution';

/**
 * 治理/身份/系统计算字段 — 不可经原始 PATCH 注入 (防越权):
 *   - stage/stageEnteredAt/delegationLevel: 授权等级, 升级必须走 evolution + 议事治理流程
 *   - bossCaptureScore/decisionHistory/modeProficiency: 系统计算, 非自填
 *   - enabledSkills: 随 stage 渐进解锁 (红区永不解锁)
 *   - dataOwnership/id/userId/tenantId/schemaVersion/createdAt: 不可变身份/归属
 */
const PERSONA_GOVERNANCE_KEYS = new Set([
  'id', 'userId', 'schemaVersion', 'tenantId',
  'stage', 'stageEnteredAt', 'delegationLevel',
  'decisionHistory', 'bossCaptureScore', 'dataOwnership',
  'enabledSkills', 'modeProficiency', 'createdAt',
]);

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
  const privileged: string[] = forWrite ? ['admin'] : DATA_STEWARD_ROLES;
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
  await boot();
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
    // 字段白名单 (剔除治理/身份/系统字段): 仅放行软字段 (styleProfile / growthAreas / learningActive 等).
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(body)) {
      if (PERSONA_GOVERNANCE_KEYS.has(k)) continue;
      patch[k] = v;
    }
    const updated = await store.personas.update(persona.id, patch);
    return NextResponse.json({ persona: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
