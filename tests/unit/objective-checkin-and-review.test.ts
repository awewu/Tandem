/**
 * tests/unit/objective-checkin-and-review.test.ts · objective.checkin 动作 + 经营回顾 pre-read (S1 收尾 · 2026-06-09)
 *
 * 覆盖:
 *   1. objective.checkin ActionType: executeAction 直执行 → 建 CheckIn(scope=objective) + 同步 confidence + 真 rollup 重算 currentProgress。
 *   2. okr.objective_checkin_propose skill: 搭子提议 → 经 proposeAction 治理 (commit_short→pending_veto / soft_opinion→越权升red)。
 *   3. okr.business_review skill: 复用 analyzeOkrHealth, 产出承压信号 pre-read (纯只读, 不落 ProxyAction)。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry } from '@/lib/taf/skills/registry';
import { registerBuiltinSkills } from '@/lib/taf/skills/builtin';
import { executeAction, type ObjectiveCheckinResult } from '@/lib/ontology';
import type { SkillContext } from '@/lib/taf/skills/registry';

const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
  skillRegistry.clear();
  registerBuiltinSkills();
});

async function seedPersona(userId: string, delegationLevel: string): Promise<void> {
  await getStore().personas.create({
    id: `persona_${userId}`,
    userId,
    schemaVersion: 'tandem.v1',
    stage: 'deputy',
    stageEnteredAt: new Date().toISOString(),
    delegationLevel,
    learningActive: true,
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.5,
      communicationStyle: 'direct',
      preferredOptions: [],
      communicationExamples: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

async function seedActiveCycle(): Promise<void> {
  await getStore().cycles.create({
    id: 'cycle_1',
    name: '2026 H1',
    isActive: true,
    startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
  } as never);
}

async function seedObjective(
  id: string,
  ownerId: string,
  opts: { level?: string; confidence?: string } = {},
): Promise<void> {
  await getStore().objectives.create({
    id,
    cycleId: 'cycle_1',
    title: `目标 ${id}`,
    ownerId,
    level: opts.level ?? 'company',
    status: 'active',
    confidence: opts.confidence ?? 'on-track',
    weight: 100,
    collaboratorIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

async function seedKr(
  id: string,
  objectiveId: string,
  ownerId: string,
  opts: { currentValue?: number; confidence?: string } = {},
): Promise<void> {
  await getStore().keyResults.create({
    id,
    objectiveId,
    ownerId,
    title: `KR ${id}`,
    type: 'numeric',
    status: 'active',
    startValue: 0,
    currentValue: opts.currentValue ?? 0,
    targetValue: 100,
    weight: 1,
    confidence: opts.confidence ?? 'on-track',
    unit: '%',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

function ctx(userId: string): SkillContext {
  return { userId, isProxy: true, tenantId: TENANT };
}

describe('objective.checkin · ActionType 直执行 + rollup', () => {
  it('executeAction 建 CheckIn(objective) + 同步 confidence + rollup 重算 currentProgress', async () => {
    await seedActiveCycle();
    await seedObjective('obj_1', 'u_alice');
    await seedKr('kr_1', 'obj_1', 'u_alice', { currentValue: 50 }); // 50% 进度

    const r = await executeAction<ObjectiveCheckinResult>(
      'objective.checkin',
      { objectiveId: 'obj_1', confidenceAfter: 'at-risk', nextSteps: '加派资源' },
      { actorUserId: 'u_alice', isProxy: false },
    );

    expect(r.ok).toBe(true);
    expect(r.result?.checkIn.scope).toBe('objective');
    expect(r.result?.confidenceAfter).toBe('at-risk');

    // confidence 已写回
    const obj = await getStore().objectives.get('obj_1');
    expect(obj?.confidence).toBe('at-risk');
    // 真 rollup: currentProgress 从 KR 重算 ≈ 0.5
    expect(obj?.currentProgress).toBeCloseTo(0.5, 5);

    // rollup 副作用 lineage 输出
    const rolled = r.sideEffects.find((s) => s.name === 'okr.rollup.propagate');
    expect(rolled?.ok).toBe(true);
  });

  it('未授权 (非 owner/collaborator) → forbidden', async () => {
    await seedActiveCycle();
    await seedObjective('obj_2', 'u_owner');

    const r = await executeAction(
      'objective.checkin',
      { objectiveId: 'obj_2', confidenceAfter: 'at-risk' },
      { actorUserId: 'u_intruder', isProxy: false },
    );
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('forbidden');
  });

  it('objective 不存在 → not_found', async () => {
    const r = await executeAction(
      'objective.checkin',
      { objectiveId: 'nope', confidenceAfter: 'at-risk' },
      { actorUserId: 'u_alice', isProxy: false, demo: true },
    );
    expect(r.ok).toBe(false);
    expect(r.blocked?.code).toBe('not_found');
  });
});

describe('okr.objective_checkin_propose · 搭子提议治理', () => {
  it('commit_short 分身提议目标 check-in → 黄区 pending_veto + 落 24h 否决窗', async () => {
    await seedPersona('u_bob', 'commit_short');
    await seedActiveCycle();
    await seedObjective('obj_b', 'u_bob');

    const r = await skillRegistry.execute(
      'okr.objective_checkin_propose',
      { objectiveId: 'obj_b', confidence: 'at-risk', reason: '进度落后' },
      ctx('u_bob'),
    );

    expect(r.ok).toBe(true);
    const data = r.data as { status: string; zone: string; proxyActionId?: string };
    expect(data.status).toBe('pending_veto');
    expect(data.zone).toBe('yellow');
    expect(data.proxyActionId).toBeTruthy();

    // 延迟执行: 否决窗内不写 confidence
    const obj = await getStore().objectives.get('obj_b');
    expect(obj?.confidence).toBe('on-track');
    const pas = await getStore().proxyActions.list();
    expect(pas).toHaveLength(1);
    expect(pas[0].kind).toBe('ontology_action');
    expect(pas[0].status).toBe('awaiting_veto');
  });

  it('soft_opinion 分身提议 commit 类目标动作 → 越权升红 → rejected', async () => {
    await seedPersona('u_carol', 'soft_opinion');
    await seedActiveCycle();
    await seedObjective('obj_c', 'u_carol');

    const r = await skillRegistry.execute(
      'okr.objective_checkin_propose',
      { objectiveId: 'obj_c', confidence: 'at-risk' },
      ctx('u_carol'),
    );

    expect(r.ok).toBe(false);
    const data = r.data as { status: string; zone: string };
    expect(data.status).toBe('rejected');
    expect(data.zone).toBe('red');
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });
});

describe('okr.business_review · 经营回顾 pre-read (只读)', () => {
  it('扫公司层承压 OKR → 产出承压信号, 不落 ProxyAction', async () => {
    await seedActiveCycle();
    await seedObjective('obj_r', 'u_alice', { level: 'company', confidence: 'at-risk' });
    await seedKr('kr_r', 'obj_r', 'u_alice', { currentValue: 10, confidence: 'off-track' });

    const r = await skillRegistry.execute('okr.business_review', {}, ctx('u_alice'));

    expect(r.ok).toBe(true);
    const data = r.data as {
      totalSignals: number;
      summary: { atRiskKr: number; stalledObjectives: number };
      proposals: Array<{ kind: string }>;
    };
    expect(data.totalSignals).toBeGreaterThanOrEqual(2);
    expect(data.summary.atRiskKr).toBeGreaterThanOrEqual(1);
    expect(data.summary.stalledObjectives).toBeGreaterThanOrEqual(1);
    // 纯只读: 不创建任何 ProxyAction
    expect(await getStore().proxyActions.list()).toHaveLength(0);
  });

  it('无 active 周期 → 空信号 (note 提示), 不抛', async () => {
    const r = await skillRegistry.execute('okr.business_review', {}, ctx('u_alice'));
    expect(r.ok).toBe(true);
    const data = r.data as { totalSignals: number; note: string };
    expect(data.totalSignals).toBe(0);
    expect(data.note).toContain('无');
  });
});
