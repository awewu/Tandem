/**
 * §B-014 · CompanyBrain OKR Anchor 注入器 单测
 *
 * 验证 buildOkrAnchorContext / buildCompanyBrainSystemPrompt 在四种场景下的行为:
 *   1. 无 active 周期 → 占位文本 (不抛错)
 *   2. 有周期 + 无公司层 Objective → 占位文本带周期名
 *   3. 有周期 + 公司层 Objective + KR → 列出 Objective + KR 进度
 *   4. buildCompanyBrainSystemPrompt 注入 OKR + Memory
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  buildOkrAnchorContext,
  buildCompanyBrainSystemPrompt,
} from '@/lib/persona/company-brain';
import type { Cycle, Objective, KeyResult } from '@/lib/types/okr-tti';
import type { MemoryEntry } from '@/lib/types/memory';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function reset() {
  const store = getStore();
  for (const c of await store.cycles.list()) await store.cycles.delete(c.id);
  for (const o of await store.objectives.list()) await store.objectives.delete(o.id);
  for (const k of await store.keyResults.list()) await store.keyResults.delete(k.id);
  for (const m of await store.memories.list()) await store.memories.delete(m.id);
}

async function seedCycle(p: Partial<Cycle> & { id: string; isActive: boolean }): Promise<Cycle> {
  const store = getStore();
  return store.cycles.create({
    id: p.id,
    period: p.period ?? 'quarter',
    name: p.name ?? '2026 Q2',
    startDate: p.startDate ?? '2026-04-01',
    endDate: p.endDate ?? '2026-06-30',
    isActive: p.isActive,
  } as Cycle);
}

async function seedObjective(p: Partial<Objective> & { id: string; cycleId: string }): Promise<Objective> {
  const store = getStore();
  const now = new Date().toISOString();
  return store.objectives.create({
    id: p.id,
    cycleId: p.cycleId,
    level: p.level ?? 'company',
    ownerId: p.ownerId ?? 'u_ceo',
    title: p.title ?? '提升营收',
    description: p.description ?? '',
    visibility: 'public',
    weight: 100,
    status: p.status ?? 'active',
    confidence: p.confidence ?? 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    tenantId: 'default',
    createdAt: now,
    updatedAt: now,
  } as Objective);
}

async function seedKR(p: Partial<KeyResult> & { id: string; objectiveId: string }): Promise<KeyResult> {
  const store = getStore();
  const now = new Date().toISOString();
  return store.keyResults.create({
    id: p.id,
    objectiveId: p.objectiveId,
    ownerId: p.ownerId ?? 'u_ceo',
    coOwnerIds: [],
    title: p.title ?? '营收达 1000 万',
    measureType: 'numeric',
    computeMethod: 'latest',
    startValue: p.startValue ?? 0,
    targetValue: p.targetValue ?? 1000,
    currentValue: p.currentValue ?? 500,
    unit: '万',
    confidence: p.confidence ?? 'on-track',
    riskStatus: 'on_track',
    weight: 100,
    status: p.status ?? 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: now,
    updatedAt: now,
  } as KeyResult);
}

async function seedCompanyMemory(p: { id: string; title: string; body: string }): Promise<MemoryEntry> {
  const store = getStore();
  const now = new Date().toISOString();
  return store.memories.create({
    id: p.id,
    type: 'sop',
    title: p.title,
    body: p.body,
    status: 'active',
    signers: [],
    referenceCount: 0,
    ownershipLevel: 'company',
    createdAt: now,
    updatedAt: now,
  } as MemoryEntry);
}

describe('§B-014 · OKR Anchor 注入器', () => {
  beforeEach(reset);

  it('无 active 周期 → 返回占位文本 (不抛错)', async () => {
    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('无 active 周期');
    expect(ctx).toContain('/okr');
  });

  it('有 active 周期 + 无公司层 Objective → 占位文本含周期名', async () => {
    await seedCycle({ id: 'c1', isActive: true, name: '2026 Q2' });
    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('2026 Q2');
    expect(ctx).toContain('无公司层 active Objective');
  });

  it('paused 周期不算 active → 占位', async () => {
    await seedCycle({ id: 'c1', isActive: false, name: '2025 Q4' });
    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('无 active 周期');
  });

  it('有公司层 Objective + KR → 列出 Objective + KR 进度', async () => {
    await seedCycle({ id: 'c1', isActive: true, name: '2026 Q2' });
    await seedObjective({ id: 'o1', cycleId: 'c1', title: '提升营收', confidence: 'on-track' });
    await seedKR({
      id: 'kr1',
      objectiveId: 'o1',
      title: '营收达 1000 万',
      currentValue: 500,
      targetValue: 1000,
      confidence: 'on-track',
    });
    await seedKR({
      id: 'kr2',
      objectiveId: 'o1',
      title: '新增 50 个企业客户',
      currentValue: 30,
      targetValue: 50,
      confidence: 'at-risk',
    });

    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('2026 Q2');
    expect(ctx).toContain('提升营收');
    expect(ctx).toContain('营收达 1000 万');
    expect(ctx).toContain('50%'); // KR1 进度
    expect(ctx).toContain('at-risk'); // KR2 风险
  });

  it('paused/abandoned Objective 不被注入', async () => {
    await seedCycle({ id: 'c1', isActive: true });
    await seedObjective({ id: 'o_active', cycleId: 'c1', title: '活跃目标', status: 'active' });
    await seedObjective({ id: 'o_paused', cycleId: 'c1', title: '暂停目标', status: 'paused' });

    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('活跃目标');
    expect(ctx).not.toContain('暂停目标');
  });

  it('team-level Objective 不污染公司视角', async () => {
    await seedCycle({ id: 'c1', isActive: true });
    await seedObjective({ id: 'o_company', cycleId: 'c1', level: 'company', title: '公司目标' });
    await seedObjective({ id: 'o_team', cycleId: 'c1', level: 'team', title: '团队目标' });

    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('公司目标');
    expect(ctx).not.toContain('团队目标');
  });

  it('多 active 周期 → 取最新 startDate', async () => {
    await seedCycle({ id: 'c_old', isActive: true, name: '2026 Q1', startDate: '2026-01-01' });
    await seedCycle({ id: 'c_new', isActive: true, name: '2026 Q2', startDate: '2026-04-01' });
    await seedObjective({ id: 'o1', cycleId: 'c_new', title: 'Q2 目标' });

    const ctx = await buildOkrAnchorContext();
    expect(ctx).toContain('2026 Q2');
    expect(ctx).toContain('Q2 目标');
  });

  it('buildCompanyBrainSystemPrompt 注入 OKR + Memory + 身份约束', async () => {
    await seedCycle({ id: 'c1', isActive: true, name: '2026 Q2' });
    await seedObjective({ id: 'o1', cycleId: 'c1', title: '提升客户满意度' });
    await seedCompanyMemory({ id: 'm1', title: '客户第一原则', body: '任何决策以客户为先' });

    const prompt = await buildCompanyBrainSystemPrompt();
    expect(prompt).toContain('CompanyBrain');
    expect(prompt).toContain('提升客户满意度'); // OKR 注入
    expect(prompt).toContain('客户第一原则'); // Memory 注入
    expect(prompt).toContain('服务/不服务'); // 身份约束
    expect(prompt).toContain('2026 Q2'); // 周期信息
  });
});
