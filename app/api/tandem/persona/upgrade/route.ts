/**
 * /api/tandem/persona/upgrade
 *
 * Persona 阶段升级 (宪章 §15: AI 助员工成长, autonomy 守门).
 *
 * GET    : 检查当前 persona 是否符合升级条件 (?personaId=...)
 * POST   : 员工本人确认升级 (body: { personaId })
 *          静默自动升级走 cron (boot.ts runSlowScans).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import {
  checkUpgradeEligibility,
  upgradeStage,
} from '@/lib/persona/evolution';

export async function GET(req: NextRequest) {
  await boot();
  const url = new URL(req.url);
  const personaId = url.searchParams.get('personaId');
  if (!personaId) {
    return NextResponse.json({ error: 'personaId 必填' }, { status: 400 });
  }

  const store = getStore();
  const persona = await store.personas.get(personaId);
  if (!persona) {
    return NextResponse.json({ error: 'persona not found' }, { status: 404 });
  }

  const check = checkUpgradeEligibility(persona);
  return NextResponse.json({ persona, check });
}

export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    if (!body.personaId) {
      return NextResponse.json({ error: 'personaId 必填' }, { status: 400 });
    }
    const updated = await upgradeStage(body.personaId, 'user');
    return NextResponse.json({ persona: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
