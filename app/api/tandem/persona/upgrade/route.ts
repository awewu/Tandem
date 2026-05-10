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
import type { GrowthArea } from '@/lib/types/persona';

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

    // 员工本人确认后, 把 cron 写入的 `upgrade_proposal` growth area 标记为 addressed
    // (否则 UI 会持续显示"有待确认升级", 已经升完了还提示)
    const hasPending = updated.growthAreas.some(
      (g) => g.category === 'upgrade_proposal' && g.status === 'identified'
    );
    if (hasPending) {
      const cleared: GrowthArea[] = updated.growthAreas.map((g) =>
        g.category === 'upgrade_proposal' && g.status === 'identified'
          ? { ...g, status: 'addressed' as const, addressedAt: new Date().toISOString() }
          : g
      );
      const store = getStore();
      const final = await store.personas.update(updated.id, {
        growthAreas: cleared,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ persona: final });
    }

    return NextResponse.json({ persona: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

/**
 * DELETE /api/tandem/persona/upgrade?personaId=xxx
 *
 * 员工拒绝/推迟升级 (不触发阶段变更, 仅把 growth area 标记为 dismissed).
 * 下一轮 cron 不会重复弹出 (hasPending 判断).
 * 员工可以在稍后手动触发升级按钮.
 */
export async function DELETE(req: NextRequest) {
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

  const dismissed: GrowthArea[] = persona.growthAreas.map((g) =>
    g.category === 'upgrade_proposal' && g.status === 'identified'
      ? { ...g, status: 'dismissed' as const, addressedAt: new Date().toISOString() }
      : g
  );
  const updated = await store.personas.update(personaId, {
    growthAreas: dismissed,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ persona: updated });
}
