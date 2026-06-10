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
  analyzeOkrHealth,
  setOptimizationProposalStatus,
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
  for (const c of await store.cycles.list()) {
    await store.cycles.delete(c.id);
  }
  for (const o of await store.objectives.list()) {
    await store.objectives.delete(o.id);
  }
  for (const k of await store.keyResults.list()) {
    await store.keyResults.delete(k.id);
  }
  for (const c of await store.checkIns.list()) {
    await store.checkIns.delete(c.id);
  }
  invalidateBrainVersionCache();
}

/** ON-3: 给某 KR 播一条 check-in (用于趋势检测) */
async function seedCheckIn(opts: {
  krId: string;
  progressBefore: number;
  progressAfter: number;
  daysAgo?: number;
}) {
  const store = getStore();
  const createdAt = new Date(Date.now() - (opts.daysAgo ?? 0) * 24 * 60 * 60 * 1000).toISOString();
  await store.checkIns.create({
    id: `ci-${opts.krId}-${Math.random().toString(36).slice(2, 8)}`,
    scope: 'kr', scopeId: opts.krId, authorId: 'u-1',
    progressBefore: opts.progressBefore, progressAfter: opts.progressAfter,
    confidenceBefore: 'on-track', confidenceAfter: 'on-track', createdAt,
  } as never);
}

/** ON-3: 播 active 周期 + 公司/团队 Objective + KR (confidence 可控) */
async function seedOkr(opts: {
  level?: 'company' | 'team' | 'individual';
  confidence: 'on-track' | 'at-risk' | 'off-track';
  current?: number;
  krId?: string;
  objConfidence?: 'on-track' | 'at-risk' | 'off-track';
  objProgress?: number;
}) {
  const store = getStore();
  const NOW = new Date().toISOString();
  if (!(await store.cycles.get('cyc-on3'))) {
    await store.cycles.create({
      id: 'cyc-on3', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true,
    } as never);
  }
  const objId = `obj-${opts.level ?? 'company'}`;
  if (!(await store.objectives.get(objId))) {
    await store.objectives.create({
      id: objId, cycleId: 'cyc-on3', level: opts.level ?? 'company', ownerId: 'u-1',
      title: `${opts.level ?? 'company'} 目标`, visibility: 'public', weight: 100,
      status: 'active', confidence: opts.objConfidence ?? 'on-track',
      currentProgress: opts.objProgress, tags: [], collaboratorIds: [], watcherIds: [],
      createdAt: NOW, updatedAt: NOW,
    } as never);
  }
  const krId = opts.krId ?? `kr-${opts.confidence}`;
  await store.keyResults.create({
    id: krId, objectiveId: objId, ownerId: 'u-1', coOwnerIds: [], measureType: 'numeric',
    computeMethod: 'latest', startValue: 0, targetValue: 100, currentValue: opts.current ?? 20,
    confidence: opts.confidence, riskStatus: 'at_risk', weight: 1, status: 'active', tags: [],
    collaboratorIds: [], watcherIds: [], title: `KR ${krId}`, createdAt: NOW, updatedAt: NOW,
  } as never);
  return krId;
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

  // ----- ON-3 · OKR 健康优化提议 (参谋产物) -----

  it('ON-3: 承压 KR (偏离 on-track) → report 含 kr_at_risk 优化提议 (pending, 不自动改)', async () => {
    await seedVersion();
    await seedOkr({ confidence: 'at-risk', current: 20 });
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'adopted' });

    const r = await generateReflection({ useLlm: false });
    expect(r).not.toBeNull();
    expect(r!.optimizationProposals?.length).toBe(1);
    const p = r!.optimizationProposals![0];
    expect(p.kind).toBe('kr_at_risk');
    expect(p.targetType).toBe('key_result');
    expect(p.targetId).toBe('kr-at-risk');
    expect(p.status).toBe('pending');
    expect(p.metrics.progressPct).toBe(20);
    expect(p.metrics.confidence).toBe('at-risk');
  });

  it('ON-3: 全部 on-track → 无优化提议', async () => {
    await seedVersion();
    await seedOkr({ confidence: 'on-track', current: 90 });
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'adopted' });

    const r = await generateReflection({ useLlm: false });
    expect(r!.optimizationProposals).toEqual([]);
  });

  it('ON-3: analyzeOkrHealth 只看公司/团队层, 排除个人层 KR', async () => {
    await seedOkr({ level: 'individual', confidence: 'off-track', current: 5 });
    const proposals = await analyzeOkrHealth();
    expect(proposals).toEqual([]);
  });

  it('ON-3: 无 active 周期 → analyzeOkrHealth 空 (不报错)', async () => {
    const proposals = await analyzeOkrHealth();
    expect(proposals).toEqual([]);
  });

  it('ON-3: 多个承压 KR 按进度从低到高排序', async () => {
    await seedOkr({ confidence: 'off-track', current: 50, krId: 'kr-mid' });
    await seedOkr({ confidence: 'at-risk', current: 10, krId: 'kr-low' });
    const proposals = await analyzeOkrHealth();
    expect(proposals.length).toBe(2);
    expect(proposals[0].targetId).toBe('kr-low');
    expect(proposals[1].targetId).toBe('kr-mid');
  });

  it('ON-3: 停滞目标 (Objective 偏离 on-track) → objective_stalled 提议', async () => {
    // KR on-track (不产 kr 提议), 但目标自身 at-risk → 仅 1 条 objective_stalled
    await seedOkr({ confidence: 'on-track', current: 90, objConfidence: 'at-risk', objProgress: 0.3 });
    const proposals = await analyzeOkrHealth();
    expect(proposals.length).toBe(1);
    const p = proposals[0];
    expect(p.kind).toBe('objective_stalled');
    expect(p.targetType).toBe('objective');
    expect(p.targetId).toBe('obj-company');
    expect(p.metrics.confidence).toBe('at-risk');
    expect(p.metrics.progressPct).toBe(30);
    expect(p.status).toBe('pending');
  });

  it('ON-3: KR 提议排在目标提议之前 (承压 KR + 停滞目标并存)', async () => {
    await seedOkr({ confidence: 'at-risk', current: 20, objConfidence: 'off-track', objProgress: 0.1 });
    const proposals = await analyzeOkrHealth();
    expect(proposals.length).toBe(2);
    expect(proposals[0].kind).toBe('kr_at_risk');
    expect(proposals[1].kind).toBe('objective_stalled');
  });

  it('ON-3: 目标 on-track 时不产 objective_stalled', async () => {
    await seedOkr({ confidence: 'on-track', current: 80, objConfidence: 'on-track' });
    const proposals = await analyzeOkrHealth();
    expect(proposals).toEqual([]);
  });

  it('ON-3: 信心度 on-track 但 check-in 趋势停滞 → kr_stalled_trend 提议', async () => {
    await seedOkr({ confidence: 'on-track', current: 30, krId: 'kr-flat' });
    // 两次 check-in, 净进度仅 +1pt (停滞)
    await seedCheckIn({ krId: 'kr-flat', progressBefore: 0.29, progressAfter: 0.30, daysAgo: 20 });
    await seedCheckIn({ krId: 'kr-flat', progressBefore: 0.30, progressAfter: 0.30, daysAgo: 2 });
    const proposals = await analyzeOkrHealth();
    expect(proposals.length).toBe(1);
    const p = proposals[0];
    expect(p.kind).toBe('kr_stalled_trend');
    expect(p.targetType).toBe('key_result');
    expect(p.targetId).toBe('kr-flat');
    expect(p.metrics.confidence).toBe('on-track');
  });

  it('ON-3: check-in 有明显进度增长 → 不产 kr_stalled_trend', async () => {
    await seedOkr({ confidence: 'on-track', current: 60, krId: 'kr-moving' });
    await seedCheckIn({ krId: 'kr-moving', progressBefore: 0.20, progressAfter: 0.40, daysAgo: 15 });
    await seedCheckIn({ krId: 'kr-moving', progressBefore: 0.40, progressAfter: 0.60, daysAgo: 1 });
    const proposals = await analyzeOkrHealth();
    expect(proposals).toEqual([]);
  });

  it('ON-3: 仅 1 次 check-in 不构成趋势 → 不产 kr_stalled_trend', async () => {
    await seedOkr({ confidence: 'on-track', current: 30, krId: 'kr-one' });
    await seedCheckIn({ krId: 'kr-one', progressBefore: 0.30, progressAfter: 0.30, daysAgo: 3 });
    const proposals = await analyzeOkrHealth();
    expect(proposals).toEqual([]);
  });

  it('ON-3: 承压 KR (非 on-track) 不重复进趋势分支 (仅 kr_at_risk)', async () => {
    await seedOkr({ confidence: 'at-risk', current: 20, krId: 'kr-risk' });
    await seedCheckIn({ krId: 'kr-risk', progressBefore: 0.20, progressAfter: 0.20, daysAgo: 10 });
    await seedCheckIn({ krId: 'kr-risk', progressBefore: 0.20, progressAfter: 0.20, daysAgo: 1 });
    const proposals = await analyzeOkrHealth();
    expect(proposals.length).toBe(1);
    expect(proposals[0].kind).toBe('kr_at_risk');
  });

  it('ON-3: 窗口外的 check-in 不计入趋势', async () => {
    await seedOkr({ confidence: 'on-track', current: 30, krId: 'kr-old' });
    // 两条都在 30 天窗口外
    await seedCheckIn({ krId: 'kr-old', progressBefore: 0.30, progressAfter: 0.30, daysAgo: 60 });
    await seedCheckIn({ krId: 'kr-old', progressBefore: 0.30, progressAfter: 0.30, daysAgo: 40 });
    const proposals = await analyzeOkrHealth();
    expect(proposals).toEqual([]);
  });

  it('ON-3: 长期高采纳场景 → skill_promotion 沉淀提议 (capability, pending)', async () => {
    await seedVersion();
    for (let i = 0; i < 6; i++) await seedDecision({ outcome: 'adopted', context: 'meeting_advice' });
    const r = await generateReflection({ useLlm: false });
    const skill = r!.optimizationProposals!.find((p) => p.kind === 'skill_promotion');
    expect(skill).toBeDefined();
    expect(skill!.targetType).toBe('capability');
    expect(skill!.targetId).toBe('meeting_advice');
    expect(skill!.status).toBe('pending');
    expect(skill!.metrics.progressPct).toBe(100);
  });

  it('ON-3: 推翻率高的场景不产 skill_promotion', async () => {
    await seedVersion();
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'overruled', reason: '跑偏' });
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'adopted' });
    const r = await generateReflection({ useLlm: false });
    const skill = r!.optimizationProposals!.find((p) => p.kind === 'skill_promotion');
    expect(skill).toBeUndefined();
  });

  it('ON-3: 样本不足 (<5) 不产 skill_promotion', async () => {
    await seedVersion();
    for (let i = 0; i < 4; i++) await seedDecision({ outcome: 'adopted', context: 'meeting_advice' });
    const r = await generateReflection({ useLlm: false });
    const skill = r!.optimizationProposals!.find((p) => p.kind === 'skill_promotion');
    expect(skill).toBeUndefined();
  });

  it('ON-3 闭环: acknowledged skill_promotion → 发起 Memory 三级签批请求 (company 级, 不自动写 Memory)', async () => {
    await seedVersion();
    for (let i = 0; i < 6; i++) await seedDecision({ outcome: 'adopted', context: 'meeting_advice' });
    const r = await generateReflection({ useLlm: false });
    const skill = r!.optimizationProposals!.find((p) => p.kind === 'skill_promotion')!;
    const memBefore = (await getStore().memories.list()).length;

    const updated = await setOptimizationProposalStatus(r!.id, skill.id, 'acknowledged', 'owner1');
    const sp = updated!.optimizationProposals!.find((p) => p.id === skill.id)!;
    expect(sp.status).toBe('acknowledged');
    expect(sp.promotionRequestId).toBeTruthy();

    const promo = (await getStore().promotions.list()).find((p) => p.id === sp.promotionRequestId)!;
    expect(promo).toBeDefined();
    expect(promo.status).toBe('pending');
    expect(promo.level).toBe('company');
    expect(promo.proposedType).toBe('sop');
    // 裁定 A: 三级签批前不写 Memory
    expect((await getStore().memories.list()).length).toBe(memBefore);
  });

  it('ON-3 闭环: 重复 acknowledged skill_promotion 幂等 (不重复发起 promotion)', async () => {
    await seedVersion();
    for (let i = 0; i < 6; i++) await seedDecision({ outcome: 'adopted', context: 'meeting_advice' });
    const r = await generateReflection({ useLlm: false });
    const skill = r!.optimizationProposals!.find((p) => p.kind === 'skill_promotion')!;
    const u1 = await setOptimizationProposalStatus(r!.id, skill.id, 'acknowledged', 'owner1');
    const pid1 = u1!.optimizationProposals!.find((p) => p.id === skill.id)!.promotionRequestId;
    const u2 = await setOptimizationProposalStatus(r!.id, skill.id, 'acknowledged', 'owner1');
    const pid2 = u2!.optimizationProposals!.find((p) => p.id === skill.id)!.promotionRequestId;
    expect(pid2).toBe(pid1);
    const promos = (await getStore().promotions.list()).filter(
      (p) => p.materialId === `skill_promotion:${skill.id}`,
    );
    expect(promos.length).toBe(1);
  });

  it('ON-3 闭环: kr_at_risk acknowledged 不发起 promotion (仅 skill_promotion 走沉淀)', async () => {
    await seedVersion();
    await seedOkr({ confidence: 'at-risk', current: 20 });
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'adopted' });
    const r = await generateReflection({ useLlm: false });
    const kr = r!.optimizationProposals!.find((p) => p.kind === 'kr_at_risk')!;
    const promosBefore = (await getStore().promotions.list()).length;
    const u = await setOptimizationProposalStatus(r!.id, kr.id, 'acknowledged', 'owner1');
    expect(u!.optimizationProposals!.find((p) => p.id === kr.id)!.promotionRequestId).toBeUndefined();
    expect((await getStore().promotions.list()).length).toBe(promosBefore);
  });

  it('ON-3: 治理处置提议 → status acknowledged/dismissed 落盘 (不触 OKR 写)', async () => {
    await seedVersion();
    await seedOkr({ confidence: 'at-risk', current: 20 });
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'adopted' });
    const r = await generateReflection({ useLlm: false });
    const pid = r!.optimizationProposals![0].id;

    const ack = await setOptimizationProposalStatus(r!.id, pid, 'acknowledged', 'owner1');
    expect(ack!.optimizationProposals![0].status).toBe('acknowledged');
    // 落盘可复读
    const reloaded = (await listReflections()).find((x) => x.id === r!.id)!;
    expect(reloaded.optimizationProposals![0].status).toBe('acknowledged');
    // KR 未被改动 (advisory, 不触写)
    const kr = await getStore().keyResults.get('kr-at-risk');
    expect(kr!.confidence).toBe('at-risk');
    expect(kr!.currentValue).toBe(20);

    const dis = await setOptimizationProposalStatus(r!.id, pid, 'dismissed', 'owner1');
    expect(dis!.optimizationProposals![0].status).toBe('dismissed');
  });

  it('ON-3: 处置不存在的报告/提议 → null', async () => {
    expect(await setOptimizationProposalStatus('nope', 'nope', 'dismissed', 'owner1')).toBeNull();
    await seedVersion();
    await seedOkr({ confidence: 'at-risk', current: 20 });
    for (let i = 0; i < 3; i++) await seedDecision({ outcome: 'adopted' });
    const r = await generateReflection({ useLlm: false });
    expect(await setOptimizationProposalStatus(r!.id, 'no-such-proposal', 'dismissed', 'owner1')).toBeNull();
  });
});
