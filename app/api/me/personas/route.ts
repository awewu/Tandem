/**
 * GET /api/me/personas
 *
 * 分身编队 (B-037 · M4): 工作台 persona-picker 数据源 —
 * 返回本人的主分身 (班长) + 全部技能分身, 及 fork 上限/余量。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getPrimaryPersona, listSkillPersonas } from '@/lib/persona/persona-lookup';
import { MAX_SKILL_PERSONAS_PER_USER } from '@/lib/types/persona';
import type { Persona } from '@/lib/types/persona';

export const dynamic = 'force-dynamic';

function view(p: Persona) {
  return {
    id: p.id,
    kind: p.kind ?? 'primary',
    specialty: p.specialty ?? null,
    templateId: p.templateId ?? null,
    stage: p.stage,
    delegationLevel: p.delegationLevel,
    /** 被采纳次数 (aiAssisted) — 独立进化的可见指标 */
    adoptionCount: p.decisionHistory?.aiAssisted ?? 0,
    bossCaptureScore: p.bossCaptureScore ?? 0,
  };
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const [primary, skills] = await Promise.all([
    getPrimaryPersona(auth.userId),
    listSkillPersonas(auth.userId),
  ]);

  return NextResponse.json({
    ok: true,
    primary: primary ? view(primary) : null,
    skills: skills.map(view),
    cap: MAX_SKILL_PERSONAS_PER_USER,
    remaining: Math.max(0, MAX_SKILL_PERSONAS_PER_USER - skills.length),
  });
}
