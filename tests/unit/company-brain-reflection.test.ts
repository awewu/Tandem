/**
 * §CA-13 · CompanyBrain Reflection 生成器单测
 *
 * 验证:
 *   - 无决策时返回 null
 *   - 有决策时生成 report (启发式)
 *   - 推翻率高 → 提议下调 hardBlock 阈值
 *   - 表现稳健 → 提议上调 topKMemoriesInjected
 *   - 签批流程 (approveReflection)
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  generateReflection,
  listReflections,
  approveReflection,
} from '@/lib/persona/company-brain-reflection';
import { recordDecision, setFeedback } from '@/lib/persona/company-brain-decision';
import {
  getActiveBrainVersion,
  invalidateBrainVersionCache,
} from '@/lib/persona/company-brain-version';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { CompanyBrainVersion } from '@/lib/types/company-brain';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function reset() {
  const store = getStore();
  for (const d of await store.companyBrainDecisions.list()) {
    await store.companyBrainDecisions.delete(d.id);
  }
  for (const r of await store.companyBrainReflections.list()) {
    await store.companyBrainReflections.delete(r.id);
  }
  for (const v of await store.companyBrainVersions.list()) {
    await store.companyBrainVersions.delete(v.id);
  }
  invalidateBrainVersionCache();
}

async function seedVersion(overrides: Partial<CompanyBrainVersion> = {}): Promise<CompanyBrainVersion> {
  const store = getStore();
  const v: CompanyBrainVersion = {
    id: 'cbv_v1_seed',
    version: 1,
    tenantId: 'default',
    createdAt: new Date().toISOString(),
    styleProfileSnapshot: {
      decisionSpeed: 'medium',
      riskAppetite: 0.4,
      communicationStyle: 'analytical',
    },
    systemPromptTemplate: 'test-prompt',
    baselineThresholds: {
      hardBlock: 0.45,
      softWarn: 0.2,
    },
    topKMemoriesInjected: 10,
    metrics: {
      decisionsCount: 0,
      adoptionRate: 0,
      overruleRate: 0,
      avgCostMicroUsd: 0,
      avgLatencyMs: 0,
      sampleDecisionIds: [],
    },
    previousVersionId: null,
    createdReason: 'boot_seed',
    ...overrides,
  };
  await store.companyBrainVersions.create(v);
  return v;
}

async function seedDecision(opts: {
  outcome: 'adopted' | 'modified' | 'overruled' | 'ignored' | 'pending';
  reason?: string;
  context?: 'im_reply' | 'baseline_arbitration' | 'meeting_advice';
}) {
  const d = await recordDecision({
    context: opts.context ?? 'im_reply',
    inputSummary: 'test input',
    outputSummary: 'test output',
    tenantId: 'default',
    providerUsed: 'deepseek',
    modelUsed: 'deepseek-v3',
    scenario: 'persona_dialogue',
    tokensIn: 100,
    tokensOut: 50,
    costMicroUsd: 1500,
    latencyMs: 800,
  });
  if (d && opts.outcome !== 'pending') {
    await setFeedback(d.id, {
      outcome: opts.outcome,
      reason: opts.reason,
      feedbackBy: 'admin1',
      feedbackAt: new Date().toISOString(),
    });
  }
  return d;
}

describe('§CA-13 · CompanyBrain Reflection 生成器', () => {
  beforeEach(reset);

  it('无决策时返回 null', async () => {
    const r = await generateReflection({ useLlm: false });
    expect(r).toBeNull();
  });

  it('有决策时生成 report (启发式, 不调 LLM)', async () => {
    await seedVersion();
    for (let i = 0; i < 5; i++) {
      await seedDecision({ outcome: 'adopted' });
    }
    const r = await generateReflection({ useLlm: false });
    expect(r).not.toBeNull();
    expect(r!.approvalStatus).toBe('pending');
    expect(r!.metricsSummary.decisionsCount).toBe(5);
    expect(r!.metricsSummary.adoptionRate).toBe(1);
    // 表现稳健 → strengths 非空
    expect(r!.strengths.length).toBeGreaterThan(0);
    // 落盘成功
    const list = await listReflections();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(r!.id);
  });

  it('推翻率高 → 提议下调 hardBlock 阈值', async () => {
    await seedVersion();
    // 4 推翻 + 6 采纳 = 40% 推翻率
    for (let i = 0; i < 4; i++) {
      await seedDecision({ outcome: 'overruled', reason: '回答跑偏 战略 红线 错了' });
    }
    for (let i = 0; i < 6; i++) {
      await seedDecision({ outcome: 'adopted' });
    }
    const r = await generateReflection({ useLlm: false });
    expect(r).not.toBeNull();
    expect(r!.metricsSummary.overruleRate).toBeCloseTo(0.4, 1);
    // 应当有阈值调整建议
    expect(r!.proposedChanges.baselineThresholdsDiff?.hardBlock).toBeDefined();
    expect(r!.proposedChanges.baselineThresholdsDiff!.hardBlock!).toBeLessThan(0.45);
    expect(r!.proposedChanges.rationale).toContain('hardBlock');
  });

  it('表现稳健 + 推翻率低 → 提议上调 topKMemoriesInjected', async () => {
    await seedVersion({ topKMemoriesInjected: 8 });
    // 全部采纳, 推翻率 0%
    for (let i = 0; i < 10; i++) {
      await seedDecision({ outcome: 'adopted' });
    }
    const r = await generateReflection({ useLlm: false });
    expect(r).not.toBeNull();
    expect(r!.proposedChanges.topKMemoriesInjectedDiff).toBe(10);
  });

  it('approveReflection 写状态 + audit', async () => {
    await seedVersion();
    for (let i = 0; i < 3; i++) {
      await seedDecision({ outcome: 'adopted' });
    }
    const r = await generateReflection({ useLlm: false });
    expect(r).not.toBeNull();

    const approved = await approveReflection(r!.id, true, 'owner1', 'looks good');
    expect(approved).not.toBeNull();
    expect(approved!.approvalStatus).toBe('approved');
    expect(approved!.approvalBy).toBe('owner1');
    expect(approved!.approvalAt).toBeDefined();
  });

  it('approveReflection 不存在的 reportId 返回 null', async () => {
    const r = await approveReflection('nonexistent', true, 'owner1');
    expect(r).toBeNull();
  });

  it('CA-13 闭环写侧: 签批含 diff 的报告 → 创建新版本 + resultingVersionId + 配置生效', async () => {
    // topK=8 + 10 采纳 → 提议 topKMemoriesInjectedDiff=10
    await seedVersion({ topKMemoriesInjected: 8 });
    for (let i = 0; i < 10; i++) {
      await seedDecision({ outcome: 'adopted' });
    }
    const r = await generateReflection({ useLlm: false });
    expect(r!.proposedChanges.topKMemoriesInjectedDiff).toBe(10);

    const before = (await getStore().companyBrainVersions.list()).length;
    const approved = await approveReflection(r!.id, true, 'owner1', 'apply it');
    expect(approved!.approvalStatus).toBe('approved');
    // 写侧: 新版本被创建
    expect(approved!.resultingVersionId).toBeDefined();
    const after = await getStore().companyBrainVersions.list();
    expect(after.length).toBe(before + 1);
    const newVersion = after.find((v) => v.id === approved!.resultingVersionId)!;
    expect(newVersion.version).toBe(2);
    expect(newVersion.topKMemoriesInjected).toBe(10);
    expect(newVersion.createdReason).toBe('auto_reflection');
    expect(newVersion.previousVersionId).toBe('cbv_v1_seed');
    expect(newVersion.approvedBy).toBe('owner1');
    // 读侧: getActiveBrainVersion 立即读到新版本 (缓存已失效)
    const active = await getActiveBrainVersion();
    expect(active.id).toBe(approved!.resultingVersionId);
    expect(active.topKMemoriesInjected).toBe(10);
  });

  it('CA-13 写侧: 签批仅 rationale 无 diff → 不造新版本', async () => {
    await seedVersion();
    // 1 采纳 1 推翻 = 50% 推翻率, 但 topK=10 不触发上调; overruleRate 0.5 会触发 hardBlock diff
    // 改用全采纳但 topK 已到 20 避免任何 diff: seed topK=20
    await getStore().companyBrainVersions.update('cbv_v1_seed', {
      ...(await getStore().companyBrainVersions.get('cbv_v1_seed'))!,
      topKMemoriesInjected: 20,
    });
    invalidateBrainVersionCache();
    for (let i = 0; i < 3; i++) {
      await seedDecision({ outcome: 'adopted' });
    }
    const r = await generateReflection({ useLlm: false });
    expect(r!.proposedChanges.topKMemoriesInjectedDiff).toBeUndefined();
    expect(r!.proposedChanges.baselineThresholdsDiff).toBeUndefined();

    const before = (await getStore().companyBrainVersions.list()).length;
    const approved = await approveReflection(r!.id, true, 'owner1');
    expect(approved!.approvalStatus).toBe('approved');
    expect(approved!.resultingVersionId).toBeUndefined();
    const after = (await getStore().companyBrainVersions.list()).length;
    expect(after).toBe(before);
  });

  it('窗口内无决策 → null (即使有历史决策但都在窗口外, 这里仅验证 0 决策路径)', async () => {
    await seedVersion();
    const r = await generateReflection({ useLlm: false, windowDays: 30 });
    expect(r).toBeNull();
  });
});
