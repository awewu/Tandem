/**
 * §B-025 · strategy-engine realignPersonaToOkr 单测
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { realignPersonaToOkr } from '@/lib/persona/strategy-engine';
import { STAGE_TO_DEFAULT_SKILLS } from '@/lib/types/persona';

async function seed() {
  const store = getStore();
  const now = new Date().toISOString();
  const cycle = await store.cycles.create({
    period: 'quarter',
    name: 'Q3 2026',
    startDate: new Date('2026-07-01').toISOString(),
    endDate: new Date('2026-09-30').toISOString(),
    isActive: true,
  });
  await store.objectives.create({
    cycleId: cycle.id,
    title: '扩大销售渠道提升营收',
    ownerId: 'user1',
    tenantId: 'default',
    currentProgress: 0,
    status: 'active',
    level: 'company',
    visibility: 'public',
    weight: 100,
    confidence: 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: now,
    updatedAt: now,
  });
  const styleProfile = {
    decisionSpeed: 'medium' as const,
    riskAppetite: 0.5,
    communicationStyle: 'direct' as const,
    preferredOptions: [] as never[],
    communicationExamples: [],
  };
  const decisionHistory = { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 };
  const dataOwnership = { companyOwnsData: true as const, anonymizationPending: false, employeeCanExportOrigins: true as const };
  const basePersona = { schemaVersion: 'tandem.v1' as const, stageEnteredAt: now, bossCaptureScore: 0, dataOwnership, styleProfile, growthAreas: [], decisionHistory, learningActive: false, createdAt: now, updatedAt: now };
  await store.personas.create({ ...basePersona, userId: 'user1', stage: 'assistant', delegationLevel: 'soft_opinion' });
  await store.personas.create({ ...basePersona, userId: 'user2', stage: 'newborn', delegationLevel: 'observe_only', styleProfile: { ...styleProfile, riskAppetite: 0.3, communicationStyle: 'analytical' as const } });
}

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('realignPersonaToOkr', () => {
  it('assistant 阶段 + 销售 OKR → 解锁 sales-coaching 额外技能', async () => {
    await seed();
    const result = await realignPersonaToOkr('default');
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);

    const store = getStore();
    const personas = await store.personas.list();
    const user1 = personas.find((p) => p.userId === 'user1')!;
    expect(user1.enabledSkills).toContain('sales-coaching');
    expect(user1.enabledSkills).toContain('tti-coaching'); // stage default
  });

  it('newborn 阶段 → enabledSkills 为空 (不扩展 OKR extras)', async () => {
    await seed();
    await realignPersonaToOkr('default');
    const store = getStore();
    const personas = await store.personas.list();
    const user2 = personas.find((p) => p.userId === 'user2')!;
    expect(user2.enabledSkills).toEqual(STAGE_TO_DEFAULT_SKILLS['newborn']);
    expect(user2.enabledSkills).not.toContain('sales-coaching');
  });

  it('无 active cycle → processed 但 updated=0 (无 OKR extra)', async () => {
    const store = getStore();
    await store.cycles.create({
      period: 'quarter', name: 'Q3', startDate: '', endDate: '', isActive: false,
    });
    const nowX = new Date().toISOString();
    await store.personas.create({
      userId: 'user3', stage: 'deputy', delegationLevel: 'commit_short',
      schemaVersion: 'tandem.v1', stageEnteredAt: nowX, bossCaptureScore: 0,
      dataOwnership: { companyOwnsData: true, anonymizationPending: false, employeeCanExportOrigins: true },
      styleProfile: { decisionSpeed: 'fast' as const, riskAppetite: 0.5, communicationStyle: 'direct' as const, preferredOptions: [] as never[], communicationExamples: [] },
      growthAreas: [], decisionHistory: { totalDecisions: 0, selfMade: 0, aiAssisted: 0, vetoedByUser: 0, vetoRate: 0 },
      learningActive: false, createdAt: nowX, updatedAt: nowX,
    });
    const result = await realignPersonaToOkr('default');
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    const p3 = (await store.personas.list()).find((p) => p.userId === 'user3')!;
    expect(p3.enabledSkills).toEqual(STAGE_TO_DEFAULT_SKILLS['deputy']);
  });

  it('幂等: 重复调用结果一致', async () => {
    await seed();
    await realignPersonaToOkr('default');
    const r2 = await realignPersonaToOkr('default');
    expect(r2.updated).toBe(0); // 第二次无变化
  });
});
