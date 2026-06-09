/**
 * S1 "眼睛" · okr.health_digest Skill 单测
 *
 * 验证中央 AI 的按需 OKR 健康度查询: at-risk 排行 (rollup 真值) + 层级过滤。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OkrHealthDigestSkill } from '@/lib/taf/skills/builtin';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { SkillContext } from '@/lib/taf/skills/registry';
import type { Cycle, Objective, KeyResult } from '@/lib/types/okr-tti';

const CTX: SkillContext = { userId: '__company__', isProxy: true, tenantId: 'default' };

function makeCycle(over: Partial<Cycle> = {}): Cycle {
  return {
    id: 'cyc1',
    period: 'quarter',
    name: '2026 Q2',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    isActive: true,
    ...over,
  };
}

function makeObj(over: Partial<Objective> & { id: string }): Objective {
  return {
    cycleId: 'cyc1',
    level: 'company',
    ownerId: 'u1',
    title: 'O',
    visibility: 'public',
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: '2026-04-01',
    updatedAt: '2026-04-01',
    ...over,
  } as Objective;
}

function makeKr(over: Partial<KeyResult> & { id: string; objectiveId: string }): KeyResult {
  return {
    ownerId: 'u1',
    coOwnerIds: [],
    title: 'KR',
    measureType: 'numeric',
    computeMethod: 'latest',
    startValue: 0,
    targetValue: 100,
    currentValue: 50,
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: 100,
    status: 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: '2026-04-01',
    updatedAt: '2026-04-01',
    ...over,
  } as KeyResult;
}

async function seed() {
  const store = getStore();
  await store.cycles.create(makeCycle());
  // O1 company 健康, KR 全 on-track
  await store.objectives.create(makeObj({ id: 'o1', level: 'company', currentProgress: 0.8 }));
  await store.keyResults.create(makeKr({ id: 'k1', objectiveId: 'o1', currentValue: 80 }));
  // O2 team 落后, 2 KR at-risk/off-track
  await store.objectives.create(
    makeObj({ id: 'o2', level: 'team', confidence: 'at-risk', currentProgress: 0.2 }),
  );
  await store.keyResults.create(
    makeKr({ id: 'k2', objectiveId: 'o2', currentValue: 30, confidence: 'at-risk' }),
  );
  await store.keyResults.create(
    makeKr({ id: 'k3', objectiveId: 'o2', currentValue: 10, confidence: 'off-track' }),
  );
}

describe('S1 · okr.health_digest', () => {
  beforeEach(async () => {
    setStore(createInMemoryStore());
    await seed();
  });

  it('元数据: 绿区 + 代行允许 (中央 AI 可调)', () => {
    expect(OkrHealthDigestSkill.zone).toBe('green');
    expect(OkrHealthDigestSkill.proxyAllowed).toBe(true);
  });

  it('全层级: at-risk 优先排前, atRiskKrs 按进度升序 (最迟在前)', async () => {
    const res = (await OkrHealthDigestSkill.execute({}, CTX)) as {
      ok: boolean;
      data: {
        totalObjectives: number;
        atRiskObjectives: number;
        worst: Array<{ objectiveId: string; atRiskCount: number; atRiskKrs: Array<{ progress: number }> }>;
      };
    };
    expect(res.ok).toBe(true);
    expect(res.data.totalObjectives).toBe(2);
    expect(res.data.atRiskObjectives).toBe(1);
    // O2 (2 个 at-risk KR) 排第一
    expect(res.data.worst[0].objectiveId).toBe('o2');
    expect(res.data.worst[0].atRiskCount).toBe(2);
    // 最迟的 KR (k3 进度 10%) 排在 k2 (30%) 前
    expect(res.data.worst[0].atRiskKrs[0].progress).toBe(10);
    expect(res.data.worst[0].atRiskKrs[1].progress).toBe(30);
  });

  it('层级过滤: level=company 只看公司层', async () => {
    const res = (await OkrHealthDigestSkill.execute({ level: 'company' }, CTX)) as {
      data: { totalObjectives: number; worst: Array<{ objectiveId: string }> };
    };
    expect(res.data.totalObjectives).toBe(1);
    expect(res.data.worst[0].objectiveId).toBe('o1');
  });

  it('无 active 周期 → 诚实返回空, 不抛错', async () => {
    setStore(createInMemoryStore());
    await getStore().cycles.create(makeCycle({ isActive: false }));
    const res = (await OkrHealthDigestSkill.execute({}, CTX)) as { ok: boolean; data: { cycle: null } };
    expect(res.ok).toBe(true);
    expect(res.data.cycle).toBeNull();
  });
});
