/**
 * Seed Fixtures · 开发期种子数据
 *
 * boot 时自动加载, 让所有 demo 页面有数据.
 */

import { getStore } from '../storage/repository';
import type { Persona } from '../types/persona';
import type { MemoryEntry } from '../types/memory';
import type { Cycle, Objective, KeyResult, TTI } from '../types/okr-tti';
import type { DecisionCard } from '../types/decision-card';
import { createChannel, sendMessage } from '../im/service';

let _seeded = false;

export async function seedDevData(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  const s = getStore();

  // Memory: SOPs + Cases
  const memories: Omit<MemoryEntry, 'id'>[] = [
    {
      type: 'sop',
      title: '紧急客户投诉处理 SOP',
      body: '1. 1 小时内电话回访\n2. 24h 内提供书面方案\n3. 主管同步\n4. 结案录入案例库',
      status: 'active',
      ownershipLevel: 'company',
      signers: [],
      referenceCount: 12,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      type: 'sop',
      title: '新员工入职引导 SOP',
      body: '1. HR 当日完成系统开通\n2. 主管 3 日内一对一\n3. 1 月 30 天目标\n4. 90 天试用期评估',
      status: 'active',
      ownershipLevel: 'company',
      signers: [],
      referenceCount: 28,
      createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      type: 'case',
      title: '2025-Q3 大客户流失挽回案例',
      body: 'A 客户因服务延迟提出终止合作. 主管 2h 内拜访 + 主动降价 8% + 增配 1 人专属服务. 7 天内挽回, 续签 2 年.',
      status: 'active',
      ownershipLevel: 'company',
      signers: [],
      referenceCount: 5,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      type: 'case',
      title: '2025-Q4 内部流程冲突解决案例',
      body: '研发与产品就 PRD 优先级冲突. 通过议事室 12 分钟达成共识: 拆分 Sprint, 关键功能优先.',
      status: 'active',
      ownershipLevel: 'department',
      signers: [],
      referenceCount: 3,
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      type: 'redline',
      title: '红线: 客户敏感信息禁止外发',
      body: '任何含客户姓名/电话/合同金额的文件不得通过个人邮箱/微信发送. 违反 → 0.5 倍年终奖.',
      status: 'active',
      ownershipLevel: 'company',
      signers: [],
      referenceCount: 0,
      createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      type: 'value',
      title: '价值观: 客户成功优于公司利润',
      body: '短期利润让位于长期客户关系. 任何牺牲客户体验换利润的方案 → 议事室必须 D 选项重做.',
      status: 'active',
      ownershipLevel: 'company',
      signers: [],
      referenceCount: 8,
      createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  for (const m of memories) {
    await s.memories.create(m);
  }

  // Cycle
  const cycle = await s.cycles.create({
    period: 'quarter',
    name: '2026 Q2',
    startDate: new Date('2026-04-01').toISOString(),
    endDate: new Date('2026-06-30').toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  } as Omit<Cycle, 'id'>);

  // Objectives + KRs
  const obj = await s.objectives.create({
    cycleId: cycle.id,
    level: 'company',
    ownerId: 'demo-user',
    title: '建立 Tandem 议事文化, 让 70% 决议在 17 分钟内闭环',
    visibility: 'public',
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<Objective, 'id'>);

  await s.keyResults.create({
    objectiveId: obj.id,
    ownerId: 'demo-user',
    coOwnerIds: [],
    title: '议事室使用率 ≥ 80%',
    measureType: 'percentage',
    computeMethod: 'latest',
    startValue: 0.2,
    targetValue: 0.8,
    currentValue: 0.55,
    unit: '%',
    confidence: 'at-risk',
    riskStatus: 'on_track',
    weight: 50,
    status: 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<KeyResult, 'id'>);

  await s.keyResults.create({
    objectiveId: obj.id,
    ownerId: 'demo-user',
    coOwnerIds: [],
    title: '17 分钟达成共识比例 ≥ 70%',
    measureType: 'percentage',
    computeMethod: 'average',
    startValue: 0.3,
    targetValue: 0.7,
    currentValue: 0.62,
    unit: '%',
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: 50,
    status: 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<KeyResult, 'id'>);

  // TTI
  await s.ttis.create({
    cycleId: cycle.id,
    ownerId: 'demo-user',
    title: '建立 Memory 治理体系 (≥ 50 条 SOP, 3 名 Steward)',
    description: '本季度沉淀公司知识资产',
    successCriteria: '≥ 50 条 active SOP + 3 名 Steward 委任 + Memory 引用率 ≥ 30%',
    startValue: 6,
    targetValue: 50,
    currentValue: 18,
    unit: '条',
    completionRate: 0.36,
    affectsCompensation: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<TTI, 'id'>);

  // Persona for demo-user
  await s.personas.create({
    userId: 'demo-user',
    schemaVersion: 'tandem.v1',
    stage: 'apprentice',
    stageEnteredAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    delegationLevel: 'report_only',
    decisionHistory: {
      totalDecisions: 47,
      selfMade: 38,
      aiAssisted: 9,
      vetoedByUser: 3,
      vetoRate: 0.064,
    },
    styleProfile: {
      decisionSpeed: 'medium',
      riskAppetite: 0.4,
      communicationStyle: 'analytical',
      preferredOptions: ['SOP', 'reasoning', 'historical', 'reasoning', 'original'],
      communicationExamples: [],
    },
    growthAreas: [],
    bossCaptureScore: 28,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    learningActive: true,
    createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<Persona, 'id'>);

  // Steward 委任: colleague-wang 担任 Steward (Memory 三级签批刚需角色, 见 MANIFESTO §8.1)
  await s.stewards.set({
    userId: 'colleague-wang',
    appointedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    conflictWith: [],
  } as never);

  // Persona for colleague-li (assistant 阶段, soft_opinion 委托级别 — 允许 IM @persona 召唤代行)
  await s.personas.create({
    userId: 'colleague-li',
    schemaVersion: 'tandem.v1',
    stage: 'assistant',
    stageEnteredAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    delegationLevel: 'soft_opinion',
    decisionHistory: {
      totalDecisions: 184,
      selfMade: 150,
      aiAssisted: 31,
      vetoedByUser: 3,
      vetoRate: 0.016,
    },
    styleProfile: {
      decisionSpeed: 'fast',
      riskAppetite: 0.6,
      communicationStyle: 'direct',
      preferredOptions: ['reasoning', 'original', 'SOP', 'historical', 'reasoning'],
      communicationExamples: [],
    },
    growthAreas: [],
    bossCaptureScore: 62,
    dataOwnership: {
      companyOwnsData: true,
      anonymizationPending: false,
      employeeCanExportOrigins: true,
    },
    learningActive: true,
    createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<Persona, 'id'>);

  // 3 历史 DecisionCards (展示列表)
  const sample: Partial<DecisionCard>[] = [
    {
      title: '客户 A 续约谈判策略',
      decisionClass: 'complex',
      convergenceState: 'COMMIT',
      elapsedSeconds: 14 * 60 + 23,
      selected: 'B',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      title: 'Q2 团队人手不足是否扩招',
      decisionClass: 'strategic',
      convergenceState: 'COMMIT',
      elapsedSeconds: 16 * 60 + 50,
      selected: 'D',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      title: '本周项目延期是否赶工',
      decisionClass: 'simple',
      convergenceState: 'ESCALATED',
      elapsedSeconds: 17 * 60,
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
  ];
  for (const d of sample) {
    await s.decisionCards.create({
      schemaVersion: 'tandem.v1',
      title: d.title!,
      decisionClass: d.decisionClass as never,
      convergenceState: d.convergenceState as never,
      elapsedSeconds: d.elapsedSeconds!,
      selected: d.selected as never,
      options: [],
      actionItems: [],
      createdBy: 'demo-user',
      createdAt: d.createdAt!,
      watermark: { isProxy: false },
    } as Omit<DecisionCard, 'id'>);
  }

  // IM 默认频道 + demo 消息 (失败不影响其他数据, 但要记录原因)
  try {
    // eslint-disable-next-line no-console
    console.info('[seed] IM channels: starting');
    const general = await createChannel({
      type: 'group',
      name: '全员公告',
      topic: '全公司广播频道, 任何同事都可见',
      visibility: 'public',
      memberIds: ['demo-user', 'colleague-li', 'colleague-wang'],
      createdBy: 'demo-user',
    });
    const product = await createChannel({
      type: 'group',
      name: '产品讨论',
      topic: 'PM / 研发 / 设计 日常协同',
      visibility: 'public',
      memberIds: ['demo-user', 'colleague-li', 'colleague-wang'],
      createdBy: 'demo-user',
    });
    await sendMessage({
      channelId: general.id,
      senderId: 'colleague-li',
      body: '👋 欢迎加入牛马搭子! 这里和企微最大不同: 任何消息都能 一键开议事室 / 一键沉淀 Memory.',
    });
    await sendMessage({
      channelId: product.id,
      senderId: 'colleague-wang',
      body: '本周 V1 PoC 部署方案我倾向 docker-compose, 大家怎么看? @[demo-user](demo-user:consult)',
    });
    await sendMessage({
      channelId: product.id,
      senderId: 'demo-user',
      body: '同意, 我们先从 docker-compose 开始, 后期看负载再迁 K8s.',
    });
    // eslint-disable-next-line no-console
    console.info('[seed] IM channels: 2 频道 + 3 消息 创建成功');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[seed] IM channels: failed —', (err as Error).message, (err as Error).stack);
  }
}
