/**
 * Seed Fixtures · 开发期种子数据
 *
 * boot 时自动加载, 让所有 demo 页面有数据.
 */

import { getStore } from '../storage/repository';
import type { Persona } from '../types/persona';
import type { MemoryEntry } from '../types/memory';
import type { Cycle, Objective, KeyResult, TTI, CheckIn } from '../types/okr-tti';
import type { DecisionCard } from '../types/decision-card';
import type { Kpi, KpiCycle, KpiSubject, KpiSnapshot, KpiScope } from '../types/kpi';
import type { AgentTemplate } from '../types/agent-template';
import { createChannel, sendMessage } from '../im/service';
import { db, schema } from '../infra/drizzle-client';
import { isDatabaseMode } from '../infra/storage-mode';
import { sql } from 'drizzle-orm';

let _seeded = false;

export async function seedDevData(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  const s = getStore();

  // §T6 幂等保护: 持久化模式下若 KvStore 已有数据, 跳过 seed (重启不重复)
  if (isDatabaseMode()) {
    try {
      const existing = await db
        .select({ c: sql<number>`count(*)` })
        .from(schema.kvStore);
      const count = Number(existing[0]?.c ?? 0);
      if (count > 0) {
        // eslint-disable-next-line no-console
        console.info(`[seed] skipped (KvStore already has ${count} rows)`);
        // 幂等补种: 主 seed 跳过时, 后加的模块 (launchpad / 扩展模块 / 分身模板 B-037)
        // 仍需有机会写入既有库。各函数自带空表守卫, 重复调用安全。
        await seedLaunchpadIfEmpty();
        await seedExtraModulesIfEmpty();
        await seedAgentTemplatesIfEmpty();
        await seedPmsIfEmpty();
        await seedPmsProductCatalogIfEmpty();
        return;
      }
    } catch {
      // KvStore 表不存在(首次) → 继续 seed
    }
  }

  // 先创建用户 (FK 外键约束要求 createdById 必须存在)
  // §T2 仅在 PostgreSQL 模式下执行；InMemory 模式不需要 User 表
  if (isDatabaseMode()) {
    try {
      const now = new Date();
      const users = [
        { id: 'demo-user', email: 'demo-user@tandem.local', name: 'Demo User', roles: ['employee'], tenantId: 'default', emailVerifiedAt: now, updatedAt: now },
        { id: 'colleague-li', email: 'colleague-li@tandem.local', name: 'Colleague Li', roles: ['employee'], tenantId: 'default', emailVerifiedAt: now, updatedAt: now },
        { id: 'colleague-wang', email: 'colleague-wang@tandem.local', name: 'Colleague Wang', roles: ['steward', 'employee'], tenantId: 'default', emailVerifiedAt: now, updatedAt: now },
      ];
      for (const u of users) {
        await db.insert(schema.user).values(u).onConflictDoNothing({ target: schema.user.id });
      }
      console.info('[seed] users upserted (drizzle)');
    } catch (err) {
      console.warn('[seed] users creation skipped:', (err as Error).message);
    }
  }
  void sql; // keep import in case of future ad-hoc raw queries

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<TTI, 'id'>);

  await seedReportRecapFixturesIfEmpty();

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

  // 飞书功能追赶 seed 数据 (暂时注释以确保稳定启动, 后续通过 API 手动创建)
  /* try {
    await s.documents.create({
      title: 'V1 产品需求文档 PRD',
      content: JSON.stringify({ type: 'doc', nodes: [{ type: 'paragraph', content: '飞书文档追赶功能说明...' }] }),
      type: 'doc',
      ownerId: 'demo-user',
      tenantId: 'default',
      permissions: { read: ['demo-user', 'colleague-li', 'colleague-wang'], write: ['demo-user'] },
      version: 1,
      isLocked: false,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    } as any);
    await s.documents.create({
      title: 'Q2 财务预算表',
      content: JSON.stringify({ type: 'sheet', data: {} }),
      type: 'sheet',
      ownerId: 'colleague-wang',
      tenantId: 'default',
      permissions: { read: ['demo-user', 'colleague-li', 'colleague-wang'], write: ['colleague-wang'] },
      version: 1,
      isLocked: false,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    } as any);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await s.calendarEvents.create({
      title: '产品周会',
      description: 'Review OKR 进度 + 决策卡复盘',
      startAt: tomorrow.toISOString(),
      endAt: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
      timezone: 'Asia/Shanghai',
      allDay: false,
      ownerId: 'demo-user',
      attendees: ['demo-user', 'colleague-li', 'colleague-wang'],
      location: '会议室 A',
      meetingUrl: 'https://meet.tandem.local/abc123',
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await s.driveFiles.create({
      name: 'Tandem 品牌手册.pdf',
      mimeType: 'application/pdf',
      size: 2048000,
      parentId: null,
      ownerId: 'demo-user',
      tenantId: 'default',
      storageKey: 'brand-manual-v1.pdf',
      storageUrl: null,
      permissions: { read: ['demo-user', 'colleague-li', 'colleague-wang'] },
      version: 1,
      isFolder: false,
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    } as any);
    await s.driveFiles.create({
      name: '产品资料',
      mimeType: 'inode/directory',
      size: 0,
      parentId: null,
      ownerId: 'demo-user',
      tenantId: 'default',
      storageKey: 'folder-product',
      storageUrl: null,
      permissions: { read: ['demo-user', 'colleague-li', 'colleague-wang'] },
      version: 1,
      isFolder: true,
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    } as any);

    await s.notifications.create({
      userId: 'demo-user',
      type: 'system',
      title: '欢迎使用 Tandem 飞书功能追赶版',
      body: '文档协作、日历会议、云盘已上线，请体验反馈。',
      priority: 'normal',
      channel: 'in-app',
      tenantId: 'default',
      createdAt: new Date().toISOString(),
    } as any);
    await s.notifications.create({
      userId: 'colleague-li',
      type: 'mention',
      title: '@你在 产品讨论 中被提及',
      body: '本周 V1 PoC 部署方案我倾向 docker-compose...',
      data: { channelId: 'product', messageId: 'msg-1' },
      priority: 'normal',
      channel: 'in-app',
      tenantId: 'default',
      createdAt: new Date().toISOString(),
    } as any);

    // eslint-disable-next-line no-console
    console.info('[seed] Feishu catch-up: documents, calendar, drive, notifications seeded');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[seed] Feishu catch-up seed failed:', (err as Error).message);
  } */

  // 飞书功能追赶 seed — 使用新分层架构 (Service → Repository)
  try {
    const { createAppContext } = await import('../repositories/app-context-factory');
    const { DocumentService } = await import('../services/document-service');
    const { CalendarService } = await import('../services/calendar-service');
    const { DriveService } = await import('../services/drive-service');
    const { NotificationService } = await import('../services/notification-service');

    const ctx = createAppContext();
    const docSvc = new DocumentService(ctx);
    const calSvc = new CalendarService(ctx);
    const drvSvc = new DriveService(ctx);
    const notifSvc = new NotificationService(ctx);

    await docSvc.create({
      title: 'V1 产品需求文档 PRD',
      content: JSON.stringify({ type: 'doc', nodes: [{ type: 'paragraph', content: '飞书文档追赶功能说明...' }] }),
      type: 'doc',
      ownerId: 'demo-user',
      tenantId: 'default',
      permissions: { read: ['demo-user', 'colleague-li', 'colleague-wang'], write: ['demo-user'] },
    });

    await docSvc.create({
      title: 'Q2 财务预算表',
      content: JSON.stringify({ type: 'sheet', data: {} }),
      type: 'sheet',
      ownerId: 'colleague-wang',
      tenantId: 'default',
      permissions: { read: ['demo-user', 'colleague-li', 'colleague-wang'], write: ['colleague-wang'] },
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await calSvc.create({
      title: '产品周会',
      description: 'Review OKR 进度 + 决策卡复盘',
      startAt: tomorrow.toISOString(),
      endAt: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
      timezone: 'Asia/Shanghai',
      ownerId: 'demo-user',
      attendees: ['demo-user', 'colleague-li', 'colleague-wang'],
      location: '会议室 A',
      meetingUrl: 'https://meet.tandem.local/abc123',
      tenantId: 'default',
    });

    await drvSvc.create({
      name: 'Tandem 品牌手册.pdf',
      mimeType: 'application/pdf',
      size: 2048000,
      parentId: null,
      ownerId: 'demo-user',
      tenantId: 'default',
      storageKey: 'brand-manual-v1.pdf',
    }, { id: 'demo-user', roles: ['admin'] });

    await drvSvc.create({
      name: '产品资料',
      mimeType: 'inode/directory',
      size: 0,
      parentId: null,
      ownerId: 'demo-user',
      tenantId: 'default',
      storageKey: 'folder-product',
      isFolder: true,
    }, { id: 'demo-user', roles: ['admin'] });

    await notifSvc.create({
      userId: 'demo-user',
      type: 'system',
      title: '欢迎使用 Tandem 飞书功能追赶版',
      body: '文档协作、日历会议、云盘已上线，请体验反馈。',
      tenantId: 'default',
    });

    await notifSvc.create({
      userId: 'colleague-li',
      type: 'mention',
      title: '@你在 产品讨论 中被提及',
      body: '本周 V1 PoC 部署方案我倾向 docker-compose...',
      data: { channelId: 'product', messageId: 'msg-1' },
      tenantId: 'default',
    });

    // eslint-disable-next-line no-console
    console.info('[seed] Feishu catch-up (new arch): documents, calendar, drive, notifications seeded');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[seed] Feishu catch-up (new arch) failed:', (err as Error).message);
  }

  await seedLaunchpadIfEmpty();
  await seedExtraModulesIfEmpty();
  await seedAgentTemplatesIfEmpty();
  await seedPmsIfEmpty();
  await seedPmsProductCatalogIfEmpty();
  await seedReportRecapFixturesIfEmpty();
}

export async function seedReportRecapFixturesIfEmpty(): Promise<void> {
  const s = getStore();
  const existing = await s.checkIns.list();
  if (existing.some((c) => ['demo-star', 'demo-burnout', 'demo-mismatch', 'demo-intervene'].includes(c.authorId))) {
    return;
  }

  const cycle = (await s.cycles.list()).find((c) => c.name === '2026 Q2');
  if (!cycle) return;

  const recapDay = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const recapSpecs = [
    {
      ownerId: 'demo-star',
      objectiveTitle: '明星：高增长商机推进',
      krTitle: '新增有效商机 18 个',
      startValue: 6,
      targetValue: 18,
      currentValue: 15,
      confidence: 'on-track' as const,
      checkIns: [
        { before: 11, after: 14, achievements: '推进 3 个重点商机进入方案比价', blockers: undefined, nextSteps: '完成样板客户演示', mood: 'happy' as const, day: 6 },
        { before: 14, after: 15, achievements: '新增 1 个渠道转介绍商机', blockers: undefined, nextSteps: '锁定下周签约节奏', mood: 'happy' as const, day: 2 },
      ],
    },
    {
      ownerId: 'demo-burnout',
      objectiveTitle: '风险枯萎：高产出下的节奏修复',
      krTitle: '稳定交付节奏',
      startValue: 4,
      targetValue: 10,
      currentValue: 8,
      confidence: 'at-risk' as const,
      checkIns: [
        { before: 6, after: 7, achievements: '按时交付核心版本', blockers: '连续加班导致评审排期后移', nextSteps: '补一个质量回归窗口', mood: 'neutral' as const, day: 5 },
        { before: 7, after: 8, achievements: '完成一轮问题修复', blockers: '跨部门依赖响应偏慢', nextSteps: '拉齐供应链与研发接口人', mood: 'sad' as const, day: 1 },
      ],
    },
    {
      ownerId: 'demo-mismatch',
      objectiveTitle: '人岗错位：补齐转化与执行',
      krTitle: '关键项目推进完成率',
      startValue: 2,
      targetValue: 10,
      currentValue: 5,
      confidence: 'at-risk' as const,
      checkIns: [
        { before: 3, after: 4, achievements: '完成项目资料整理', blockers: '销售转化跟进偏弱', nextSteps: '补一轮客户跟进', mood: 'neutral' as const, day: 6 },
        { before: 4, after: 5, achievements: '推动 1 个需求确认', blockers: '资源协调慢', nextSteps: '下周补齐计划表', mood: 'sad' as const, day: 3 },
      ],
    },
    {
      ownerId: 'demo-intervene',
      objectiveTitle: '必须干预：扭转低迷状态',
      krTitle: '本月核心动作闭环',
      startValue: 0,
      targetValue: 8,
      currentValue: 2,
      confidence: 'off-track' as const,
      checkIns: [
        { before: 0, after: 1, achievements: '完成第一轮拆解', blockers: '关键资源仍未到位', nextSteps: '尽快确认 owner 与截止时间', mood: 'sad' as const, day: 4 },
        { before: 1, after: 2, achievements: '推进 1 个关键节点', blockers: '执行动作未完全落地', nextSteps: '本周必须完成回收闭环', mood: 'sad' as const, day: 1 },
      ],
    },
  ];

  for (const spec of recapSpecs) {
    const objective = await s.objectives.create({
      cycleId: cycle.id,
      level: 'individual',
      ownerId: spec.ownerId,
      title: spec.objectiveTitle,
      visibility: 'public',
      weight: 100,
      status: 'active',
      confidence: spec.confidence,
      tags: [],
      collaboratorIds: [],
      watcherIds: [],
      currentProgress: 0,
      tenantId: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<Objective, 'id'>);

    const kr = await s.keyResults.create({
      objectiveId: objective.id,
      ownerId: spec.ownerId,
      coOwnerIds: [],
      title: spec.krTitle,
      measureType: 'numeric',
      computeMethod: 'cumulative',
      startValue: spec.startValue,
      targetValue: spec.targetValue,
      currentValue: spec.currentValue,
      unit: '个',
      confidence: spec.confidence,
      riskStatus: spec.confidence === 'on-track' ? 'on_track' : spec.confidence === 'at-risk' ? 'at_risk' : 'off_track',
      weight: 100,
      status: 'active',
      tags: [],
      collaboratorIds: [],
      watcherIds: [],
      tenantId: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<KeyResult, 'id'>);

    for (const item of spec.checkIns) {
      await s.checkIns.create({
        scope: 'kr',
        scopeId: kr.id,
        authorId: spec.ownerId,
        progressBefore: item.before,
        progressAfter: item.after,
        confidenceBefore: item.mood === 'sad' ? 'at-risk' : 'on-track',
        confidenceAfter: spec.confidence,
        achievements: item.achievements,
        blockers: item.blockers ?? null,
        nextSteps: item.nextSteps ?? null,
        mood: item.mood,
        tenantId: 'default',
        createdAt: recapDay(item.day),
      } as Omit<CheckIn, 'id'>);
    }
  }
}

/**
 * Idempotent seed for modules that previously had no fixtures
 * (bitable / 1on1 / 360 / okr-initiatives). All stamped with tenantId='default'
 * so cross-tenant isolation smoke tests can exercise them.
 */
export async function seedExtraModulesIfEmpty(): Promise<void> {
  const s = getStore();
  const now = new Date().toISOString();

  try {
    // Bitable — single demo table (idempotent per-owner)
    const existing = await s.bitableTables.list();
    if (!existing.some((t) => t.ownerId === 'demo-user')) {
      await s.bitableTables.create({
        name: 'Q2 任务跟踪',
        description: 'Demo 多维表',
        ownerId: 'demo-user',
        tenantId: 'default',
        columns: [
          { id: 'col_name',     name: '任务',   type: 'text',   width: 200, required: true },
          { id: 'col_status',   name: '状态',   type: 'select', options: [
            { value: '待办', color: 'slate' },
            { value: '进行中', color: 'amber' },
            { value: '已完成', color: 'emerald' },
          ] },
          { id: 'col_due',      name: '截止',   type: 'date' },
          { id: 'col_assignee', name: '负责人', type: 'user' },
        ],
        rows: [
          { id: 'row_1', data: { col_name: '完成 V1 PoC', col_status: '进行中', col_assignee: 'demo-user' }, createdAt: now, updatedAt: now },
          { id: 'row_2', data: { col_name: 'Q2 OKR Review', col_status: '待办', col_assignee: 'colleague-wang' }, createdAt: now, updatedAt: now },
        ],
        createdAt: now,
        updatedAt: now,
      } as never);
    }
  } catch (err) {
    console.warn('[seed] bitable failed:', (err as Error).message);
  }

  try {
    // 1on1 — single demo meeting (tenantId required by type)
    const existing = await s.oneOnOneMeetings.list({ tenantId: 'default' });
    if (existing.length === 0) {
      await s.oneOnOneMeetings.create({
        tenantId: 'default',
        managerId: 'colleague-wang',
        reportId: 'demo-user',
        cadence: 'biweekly',
        scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
        startedAt: null,
        completedAt: null,
        status: 'scheduled',
        agendaManager: '复盘上周关键决策',
        agendaReport: '需要支持解决跨部门协同',
        noteProgress: null,
        noteBlockers: null,
        noteNextSteps: null,
        linkedKrIds: [],
        moodScore: null,
        privateManagerNote: null,
        createdAt: now,
        updatedAt: now,
      } as never);
    }
  } catch (err) {
    console.warn('[seed] 1on1 failed:', (err as Error).message);
  }

  try {
    // 360 review cycle
    const existing = await s.review360Cycles.list();
    if (existing.length === 0) {
      await s.review360Cycles.create({
        tenantId: 'default',
        name: '2026 Q2 360 评估',
        startDate: new Date('2026-06-01').toISOString(),
        endDate: new Date('2026-06-30').toISOString(),
        status: 'draft',
        questions: [
          { id: 'q1', text: '此人在跨部门协作中的表现', type: 'mixed', anonymous: true, qualitative: true },
          { id: 'q2', text: '此人的决策质量', type: 'mixed', anonymous: true, qualitative: true },
        ],
        anonymizePeers: true,
        createdBy: 'demo-user',
        createdAt: now,
        updatedAt: now,
      } as never);
    }
  } catch (err) {
    console.warn('[seed] 360 failed:', (err as Error).message);
  }

  try {
    // OKR Initiative — depends on at least one KR existing
    const existing = await s.initiatives.list();
    if (existing.length === 0) {
      const krs = await s.keyResults.list();
      if (krs.length > 0) {
        await s.initiatives.create({
          keyResultId: krs[0].id,
          ownerId: 'demo-user',
          title: '推广议事室使用培训',
          status: 'in_progress',
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
          tenantId: 'default',
        } as never);
      }
    }
  } catch (err) {
    console.warn('[seed] initiative failed:', (err as Error).message);
  }

  try {
    // Intranet — 公告/政策/大事记/福利 真实 seed (替换原 lib/intranet/featured 硬编码)
    const existing = await s.intranetPosts.list({ tenantId: 'default' });
    if (existing.length === 0) {
      const author = 'admin@tandem.local';
      const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
      const posts: Array<{
        type: 'announcement' | 'policy' | 'event' | 'benefit';
        title: string;
        summary: string;
        body: string;
        mandatoryRead: boolean;
        publishedAt: string;
        tags: string[];
      }> = [
        {
          type: 'announcement',
          title: '2026 年度公司 O · 让 70% 的决议在 17 分钟内达成共识',
          summary: 'CEO 发布 2026 年度公司级目标, 围绕"高质量快速决策"展开。',
          body:
            '## 2026 年度公司目标\n\n今年我们只设一个公司级 O: **让 70% 的决议在 17 分钟内达成共识**。\n\n这不是追求快, 而是追求"准备充分 + 信息对齐"后的快。三个关键结果:\n\n1. 议事室覆盖 100% 公司级决议\n2. 前置 5 分钟材料准备率 ≥ 90%\n3. 决议返工率 < 10%\n\n请各部门在本周内完成对齐。',
          mandatoryRead: false,
          publishedAt: day(1),
          tags: ['2026', 'OKR', 'CEO'],
        },
        {
          type: 'policy',
          title: 'AI 使用红线 v2.1 — 涉客户数据需经 Steward 批准',
          summary: '更新 AI 使用合规条款, 涉客户/财务数据的 AI 调用须经 Steward 审批。',
          body:
            '## AI 使用红线 v2.1\n\n为保护客户与公司数据, 自即日起:\n\n- 任何涉及**客户数据**的 AI 调用, 须经 Steward 批准\n- **财务数据**不得输入未审计的外部模型\n- 分身代行涉红线动作一律进入 24h 否决窗\n\n本政策为强制已读, 请点击下方"我已知晓"确认。',
          mandatoryRead: true,
          publishedAt: day(2),
          tags: ['合规', '红线', 'AI'],
        },
        {
          type: 'event',
          title: 'Tandem 议事室上线 100 天 — 平均共识时长 19.2 分钟',
          summary: '议事室上线百日里程碑: 累计收敛 312 单决议, 平均共识 19.2 分钟。',
          body:
            '## 议事室上线 100 天\n\n截至今日, Tandem 议事室已累计收敛 **312 单决议**, 平均共识时长 **19.2 分钟**, 距离 17 分钟目标仅一步之遥。\n\n感谢每一位在议前认真准备材料的同事 — 这就是"前置 5 分钟"纪律的力量。',
          mandatoryRead: false,
          publishedAt: day(5),
          tags: ['里程碑', '议事室'],
        },
        {
          type: 'benefit',
          title: '春季体检报名开放 — 8 家定点医院, 配偶可享同等权益',
          summary: '2026 春季体检报名开放, 8 家定点医院可选, 配偶享同等权益。',
          body:
            '## 春季体检报名\n\n2026 年春季体检报名现已开放:\n\n- **8 家定点医院**任选\n- 配偶可享**同等权益**\n- 报名截止: 月底\n\n请在 HR 系统提交报名, 体检套餐详情见附件。',
          mandatoryRead: false,
          publishedAt: day(7),
          tags: ['福利', '体检', 'HR'],
        },
        {
          type: 'announcement',
          title: 'Q2 OKR 全员对齐会 · 本周五 14:00',
          summary: 'Q2 OKR 全员对齐会安排在本周五 14:00, 全员参加。',
          body:
            '## Q2 OKR 全员对齐会\n\n时间: **本周五 14:00**\n地点: 全员线上 + 大会议室\n\n议程:\n1. 公司级 O 进展回顾\n2. 各部门 KR 对齐\n3. 下季度重点预告\n\n请提前在事半查看本部门 OKR。',
          mandatoryRead: false,
          publishedAt: day(3),
          tags: ['OKR', '全员会'],
        },
      ];
      for (const p of posts) {
        await s.intranetPosts.create({
          type: p.type,
          title: p.title,
          body: p.body,
          summary: p.summary,
          mandatoryRead: p.mandatoryRead,
          readBy: [],
          publishedAt: p.publishedAt,
          publishedBy: author,
          archivedAt: null,
          attachments: [],
          tags: p.tags,
          tenantId: 'default',
          createdAt: p.publishedAt,
          updatedAt: p.publishedAt,
        } as never);
      }
    }
  } catch (err) {
    console.warn('[seed] intranet failed:', (err as Error).message);
  }

  try {
    // Academy — 把 fixtures 课程入库为已发布课程 (学院前台/完成接口改查真库)
    const existing = await s.lessons.list({ tenantId: 'default' } as never);
    if (existing.length === 0) {
      const { FIXTURE_LESSONS } = await import('../learning/fixtures');
      const nowIso = new Date().toISOString();
      for (const lesson of FIXTURE_LESSONS) {
        await s.lessons.create({
          ...lesson,
          tenantId: 'default',
          publishedAt: nowIso,
          publishedBy: 'admin@tandem.local',
          archivedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        } as never);
      }
    }
  } catch (err) {
    console.warn('[seed] academy lessons failed:', (err as Error).message);
  }
}

/**
 * PMS · 幂等种子 (商机 demo). 仅 PostgreSQL 模式, 直写 typed table pms_opportunities.
 * 空表守卫 + onConflictDoNothing, 重复调用安全。
 */
export async function seedPmsIfEmpty(): Promise<void> {
  if (!isDatabaseMode()) return;
  try {
    const existing = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.pmsOpportunities);
    if (Number(existing[0]?.c ?? 0) > 0) return;

    const now = new Date();
    const rows = [
      { key: 'bj01', customerName: '北京华住酒店集团', projectName: '朝阳希尔顿中央热水系统', customerPhone: '13800138001', customerAddress: '北京市朝阳区建国路88号', estimatedAmount: '3200000', productLine: '商用热水', region: '华北', channel: '直销', stage: 'quoted', dealerOrgId: 'dealer_bj_01' },
      { key: 'sh01', customerName: '上海仁济医院', projectName: '浦东院区空气源热泵改造', customerPhone: '13800138002', customerAddress: '上海市浦东新区东方路1630号', estimatedAmount: '5800000', productLine: '空气源热泵', region: '华东', channel: '经销', stage: 'contracted', dealerOrgId: 'dealer_sh_01' },
      { key: 'sz01', customerName: '深圳富士康科技', projectName: '龙华厂区宿舍热水工程', customerPhone: '13800138003', customerAddress: '广东省深圳市龙华区观澜大道', estimatedAmount: '12000000', productLine: '商用热水', region: '华南', channel: '直销', stage: 'following', dealerOrgId: 'dealer_sz_01' },
    ];
    for (const r of rows) {
      const dedupeKey = Buffer.from(`${r.customerName}|${r.customerAddress}|${r.projectName}`.toLowerCase()).toString('base64').substring(0, 32);
      await db.insert(schema.pmsOpportunities).values({
        id: `pms_seed_${r.key}`,
        tenantId: 'default',
        orgId: r.dealerOrgId,
        dealerOrgId: r.dealerOrgId,
        reporterId: 'demo-user',
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerAddress: r.customerAddress,
        projectName: r.projectName,
        stage: r.stage,
        status: 'active',
        estimatedAmount: r.estimatedAmount,
        productLine: r.productLine,
        region: r.region,
        channel: r.channel,
        dedupeKey,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({ target: schema.pmsOpportunities.id });
    }
    // eslint-disable-next-line no-console
    console.info('[seed] PMS opportunities seeded (3)');
  } catch (err) {
    console.warn('[seed] PMS seed failed:', (err as Error).message);
  }
}

/**
 * PMS · 产品目录幂等种子 (系列 × 型号 + attributes 选项). 仅 PostgreSQL 模式.
 * 空表守卫 + 确定性 id + onConflictDoNothing, 重复调用安全。
 * 品牌对齐 Rheem / RUUD / 恒热, 品类覆盖热泵/热水/新风/净水/五恒。
 * attributes = "选项挂型号 JSON" 范式 (制热量/COP/出水温度/能效等), 供报备选型与后续分析。
 */
export async function seedPmsProductCatalogIfEmpty(): Promise<void> {
  if (!isDatabaseMode()) return;
  try {
    const existing = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.pmsProductCatalog);
    if (Number(existing[0]?.c ?? 0) > 0) return;

    const now = new Date();
    const products: Array<{
      series: string; seriesCode: string; model: string; modelCode: string;
      category: string; specification: string; unit: string;
      listPrice: number; costPrice: number; minPrice: number;
      attributes: Record<string, string>;
    }> = [
      // 空气源热泵 (heat_pump)
      { series: 'Rheem 商用空气源热泵', seriesCode: 'RH-HP', model: 'HP-12 变频空气源热泵', modelCode: 'HP12INV', category: 'heat_pump', specification: '制热量 12kW', unit: '台', listPrice: 28000, costPrice: 19600, minPrice: 23800, attributes: { 制热量: '12kW', COP: '4.2', 出水温度: '60℃', 能效等级: '一级', 安装方式: '落地' } },
      { series: 'Rheem 商用空气源热泵', seriesCode: 'RH-HP', model: 'HP-16 变频空气源热泵', modelCode: 'HP16INV', category: 'heat_pump', specification: '制热量 16kW', unit: '台', listPrice: 35000, costPrice: 24500, minPrice: 29750, attributes: { 制热量: '16kW', COP: '4.1', 出水温度: '60℃', 能效等级: '一级', 安装方式: '落地' } },
      { series: 'Rheem 商用空气源热泵', seriesCode: 'RH-HP', model: 'HP-25 商用空气源热泵', modelCode: 'HP25COM', category: 'heat_pump', specification: '制热量 25kW', unit: '台', listPrice: 68000, costPrice: 47600, minPrice: 57800, attributes: { 制热量: '25kW', COP: '3.9', 出水温度: '65℃', 能效等级: '一级', 安装方式: '落地' } },
      // 商用热水 (water_heater)
      { series: '恒热商用热水', seriesCode: 'EH-WH', model: 'Premier TW-300 热泵热水机', modelCode: 'TW300', category: 'water_heater', specification: '水箱 300L', unit: '台', listPrice: 12500, costPrice: 8750, minPrice: 10625, attributes: { 水箱容量: '300L', 类型: 'heatpump', COP: '3.5', 出水温度: '55℃' } },
      { series: '恒热商用热水', seriesCode: 'EH-WH', model: 'Instant E-15 即热电热水器', modelCode: 'E15', category: 'water_heater', specification: '功率 15kW', unit: '台', listPrice: 4500, costPrice: 3150, minPrice: 3825, attributes: { 功率: '15kW', 类型: 'electric', 出水温度: '45℃' } },
      // 新风除湿 (fresh_air)
      { series: 'Rheem 新风系统', seriesCode: 'RH-FA', model: 'FA-350 新风除湿一体机', modelCode: 'FA350', category: 'fresh_air', specification: '风量 350m³/h', unit: '台', listPrice: 8800, costPrice: 6160, minPrice: 7480, attributes: { 风量: '350m³/h', 除湿量: '30L/天', 滤网等级: 'H13', 安装方式: '吊顶' } },
      { series: 'Rheem 新风系统', seriesCode: 'RH-FA', model: 'FA-500 管道式新风机', modelCode: 'FA500', category: 'fresh_air', specification: '风量 500m³/h', unit: '台', listPrice: 12000, costPrice: 8400, minPrice: 10200, attributes: { 风量: '500m³/h', 滤网等级: 'H13', 安装方式: '管道' } },
      // 全屋净水 (water_purify)
      { series: '恒热全屋净水', seriesCode: 'EH-WP', model: 'PureFlow RO-800 中央净水', modelCode: 'RO800', category: 'water_purify', specification: '通量 800G', unit: '套', listPrice: 12500, costPrice: 8750, minPrice: 10625, attributes: { 通量: '800G', 类型: 'ro', 制水率: '85%', 滤芯寿命: '12月' } },
      { series: '恒热全屋净水', seriesCode: 'EH-WP', model: 'AquaTap UF-200 直饮机', modelCode: 'UF200', category: 'water_purify', specification: '通量 200G', unit: '套', listPrice: 3200, costPrice: 2240, minPrice: 2720, attributes: { 通量: '200G', 类型: 'uf', 制水率: '72%' } },
      // 五恒系统 (five_comfort)
      { series: 'RUUD 五恒系统', seriesCode: 'RU-5H', model: '5H-20 家用五恒系统', modelCode: '5H20', category: 'five_comfort', specification: '适用 200㎡', unit: '套', listPrice: 85000, costPrice: 59500, minPrice: 72250, attributes: { 适用面积: '200㎡', 恒温: '是', 恒湿: '是', 恒氧: '是', 恒洁: '是', 恒静: '是' } },
      { series: 'RUUD 五恒系统', seriesCode: 'RU-5H', model: '5H-50 别墅五恒系统', modelCode: '5H50', category: 'five_comfort', specification: '适用 500㎡', unit: '套', listPrice: 168000, costPrice: 117600, minPrice: 142800, attributes: { 适用面积: '500㎡', 恒温: '是', 恒湿: '是', 恒氧: '是', 恒洁: '是', 恒静: '是' } },
      // 地暖 (floor_heating)
      { series: 'Rheem 地暖系统', seriesCode: 'RH-FH', model: 'WM-28C 冷凝壁挂炉', modelCode: 'WM28C', category: 'floor_heating', specification: '功率 28kW', unit: '台', listPrice: 18000, costPrice: 12600, minPrice: 15300, attributes: { 功率: '28kW', 类型: '冷凝', 能效等级: '一级' } },
    ];

    for (const p of products) {
      await db.insert(schema.pmsProductCatalog).values({
        id: `pms_prod_${p.modelCode}`,
        tenantId: 'default',
        series: p.series,
        seriesCode: p.seriesCode,
        model: p.model,
        modelCode: p.modelCode,
        category: p.category,
        specification: p.specification,
        unit: p.unit,
        listPrice: p.listPrice.toString(),
        costPrice: p.costPrice.toString(),
        minPrice: p.minPrice.toString(),
        bomItems: [],
        attributes: p.attributes,
        source: 'manual',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({ target: schema.pmsProductCatalog.id });
    }
    // eslint-disable-next-line no-console
    console.info(`[seed] PMS product catalog seeded (${products.length})`);
  } catch (err) {
    console.warn('[seed] PMS product catalog seed failed:', (err as Error).message);
  }
}

/**
 * Idempotent Launchpad seed — runs even when KvStore is already populated,
 * so existing dev DBs can pick up the new tables without a full reset.
 */
export async function seedLaunchpadIfEmpty(): Promise<void> {
  try {
    const { createAppContext } = await import('../repositories/app-context-factory');
    const { LaunchpadService } = await import('../services/launchpad-service');
    const ctx = createAppContext();
    const lpSvc = new LaunchpadService(ctx);
    const existing = await lpSvc.listAdmin({ tenantId: 'default' });
    const plmExisting = existing.find((a) => a.url === '#plm' || /PLM/i.test(a.name));
    if (plmExisting && plmExisting.url !== '/api/integrations/plm/sso') {
      await lpSvc.update(plmExisting.id, {
        url: '/api/integrations/plm/sso',
        ssoMode: 'redirect-token',
        status: 'active',
        description: plmExisting.description ?? '产品全生命周期 · 研发协同',
      });
    }
    const stratExisting = existing.find((a) => a.url === '#stratos' || /StratOS|战略/i.test(a.name));
    if (stratExisting && stratExisting.url !== 'https://strat.rhautt.com/api/auth/tandem?next=%2Fstrategy%2Finput') {
      await lpSvc.update(stratExisting.id, {
        url: 'https://strat.rhautt.com/api/auth/tandem?next=%2Fstrategy%2Finput',
        ssoMode: 'oidc',
        status: 'active',
        description: stratExisting.description ?? '战略地图 · 经营沙盘',
      });
    }
    // §集团模块 · 快速跳板. url/ssoMode 为对外软件预留接口 (待接入时由 /admin/launchpad 填真实地址 + SSO).
    const base = {
      iconUrl: null, ssoMode: 'none' as const, ssoConfig: null,
      visibleTo: [], visibleToRoles: [], unreadAdapter: null,
      status: 'active' as const, tenantId: 'default',
    };
    // PMS/驾驶舱卡片对「内部 + 经销商」都可见 (isAppVisibleTo: 内部亦需 visibleToRoles 命中, 故须列全).
    const PMS_ROLES = ['owner', 'admin', 'manager', 'employee', 'steward', 'champion', 'dealer_sales', 'dealer_admin'];
    // PMS 启动台: 合并为单张"大门"卡, 指向更完整的驾驶舱 (/pms/cockpit).
    // 列表页 (/pms) 在模块内可切换, 无需独立启动台卡. 以下逻辑幂等: 清旧列表卡 + 归一驾驶舱卡.
    const PMS_GATE = {
      ...base, category: 'business' as const, name: '销售 · 经销商商机管理',
      description: '驾驶舱预警 · 项目/管道/风险即时暴露 — 产研销的「销」闭环',
      url: '/pms/cockpit', order: 9, visibleToRoles: PMS_ROLES,
      recommendKeywords: ['销售', '商机', 'pms', '驾驶舱', '预警', '经销商', '合同', '交付', '风险', '经营'],
    };
    if (existing.length > 0) {
      // 1. 清理旧的 PMS 列表卡 (url === '/pms') — 已合并入驾驶舱大门.
      for (const a of existing.filter((x) => x.url === '/pms')) {
        await lpSvc.delete(a.id);
        // eslint-disable-next-line no-console
        console.info('[seed] launchpad: 清理旧 PMS 列表卡 (合并入驾驶舱大门)');
      }
      // 2. 归一驾驶舱大门卡: 无则补种, 有则更新首张并删除多余重复.
      const cockpitCards = existing.filter((a) => a.url === '/pms/cockpit');
      if (cockpitCards.length === 0) {
        await lpSvc.create(PMS_GATE);
        // eslint-disable-next-line no-console
        console.info('[seed] launchpad: 补种 PMS 大门卡 (→ 驾驶舱)');
      } else {
        const [keep, ...dupes] = cockpitCards;
        await lpSvc.update(keep.id, { name: PMS_GATE.name, description: PMS_GATE.description, visibleToRoles: PMS_ROLES, recommendKeywords: PMS_GATE.recommendKeywords });
        for (const d of dupes) {
          await lpSvc.delete(d.id);
          // eslint-disable-next-line no-console
          console.info('[seed] launchpad: 清理重复驾驶舱卡');
        }
      }
    }
    // 旧演示卡片名单 (历史默认种子). 仅当跳板「只剩这些」时才视为未定制 → 清掉重播集团模块.
    // 若含任何非旧卡片 (用户自定义 或 已是新集团模块) → 跳过, 保持幂等且绝不误删用户数据.
    const LEGACY_DEMO_NAMES = new Set([
      '金蝶 ERP', 'Salesforce CRM', 'Jira', '钉钉', '腾讯会议', '公司 Wiki', 'HR 系统',
    ]);
    if (existing.length > 0) {
      const allLegacy = existing.every((a) => LEGACY_DEMO_NAMES.has(a.name));
      if (!allLegacy) return;
      for (const a of existing) await lpSvc.delete(a.id);
      // eslint-disable-next-line no-console
      console.info(`[seed] launchpad: 清理 ${existing.length} 张旧演示卡片, 改播集团模块`);
    }
    const seedApps: Array<Parameters<typeof lpSvc.create>[0]> = [
      { ...base, category: 'business', name: '搭子手抄', description: 'AI 笔记 · 记录→加工→沉淀',
        url: '/shouchao', order: 0, recommendKeywords: ['笔记', '手抄', 'note', '沉淀'] },
      { ...base, category: 'business', name: '创新匠台 PLM', description: '产品全生命周期 · 研发协同',
        url: '/api/integrations/plm/sso', ssoMode: 'redirect-token', order: 1, recommendKeywords: ['plm', '研发', '产品', '生命周期', '匠台'] },
      { ...base, category: 'business', name: '瑞诺瓦 AI 问诊', description: 'AI 智能诊断 · 健康问询',
        url: 'https://rhautt.com/pain-diagnosis.html', order: 2, recommendKeywords: ['ai', '问诊', '诊断', '瑞诺瓦', 'renova'] },
      { ...base, category: 'business', name: 'Youngsuite ERP', description: '采购 · 财务 · 供应链',
        url: '#youngsuite-erp', order: 3, recommendKeywords: ['erp', '财务', '采购', '供应链', 'youngsuite'] },
      { ...base, category: 'business', name: '售后系统', description: '工单 · 客诉 · 维保',
        url: '#after-sales', order: 4, recommendKeywords: ['售后', '工单', '客诉', '维保', 'service'] },
      { ...base, category: 'business', name: '战略布局 StratOS', description: '战略地图 · 经营沙盘',
        url: 'https://strat.rhautt.com/api/auth/tandem?next=%2Fstrategy%2Finput', ssoMode: 'oidc', order: 5, recommendKeywords: ['战略', '布局', 'stratos', '沙盘', '经营'] },
      { ...base, category: 'business', name: 'Salesforce', description: '客户 · 销售 · 商机跟进',
        url: 'https://login.salesforce.com', order: 6, recommendKeywords: ['销售', '客户', '商机', 'sales', 'crm'] },
      { ...base, category: 'business', name: 'MES', description: '制造执行 · 生产排程',
        url: '#mes', order: 7, recommendKeywords: ['mes', '制造', '生产', '排程', '车间'] },
      { ...base, category: 'business', name: 'Rhautt 宜居家', description: '宜居家 · 智能家居平台',
        url: '#rhautt', order: 8, recommendKeywords: ['rhautt', '宜居家', '家居', 'home', '智能家居'] },
      PMS_GATE,
    ];
    for (const app of seedApps) await lpSvc.create(app);
    // eslint-disable-next-line no-console
    console.info(`[seed] launchpad: ${seedApps.length} default apps seeded`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[seed] launchpad seed failed:', (err as Error).message);
  }
}

/**
 * 自动在系统 boot 期间种入 BSC 个人及部门 KPI 演示数据 (P0)
 */
export async function seedKpiDemoIfEmpty(): Promise<void> {
  const s = getStore();
  try {
    const existing = await s.kpiCycles.list();
    if (existing.length > 0) return;

    const now = new Date().toISOString();
    // 1. 创建 FY2026 演示周期
    const cycle = await s.kpiCycles.create({
      fiscalYear: 2026,
      name: 'FY2026 (Demo)',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
      status: 'active',
      tenantId: 'default',
      targetsLockedAt: now,
      createdBy: 'demo-user',
      createdAt: now,
      updatedAt: now,
    } as Omit<KpiCycle, 'id'>);

    // 2. 创建 7 个核心 BSC 科目
    type SubjectSpec = Pick<KpiSubject, 'code' | 'name' | 'defaultUnit' | 'defaultMeasureType' | 'defaultScope' | 'bscPerspective'>;
    const subjectsSpec: SubjectSpec[] = [
      { code: 'FIN.REV', name: '营业收入', defaultUnit: '万元', defaultMeasureType: 'currency', defaultScope: 'bonus', bscPerspective: 'financial' },
      { code: 'FIN.GP', name: '毛利率', defaultUnit: '%', defaultMeasureType: 'percentage', defaultScope: 'bonus', bscPerspective: 'financial' },
      { code: 'CUST.CSAT', name: '客户满意度', defaultUnit: '分', defaultMeasureType: 'numeric', defaultScope: 'monitor', bscPerspective: 'customer' },
      { code: 'CUST.NEW', name: '新客户数', defaultUnit: '家', defaultMeasureType: 'count', defaultScope: 'bonus', bscPerspective: 'customer' },
      { code: 'OPS.QA', name: '质量合格率', defaultUnit: '%', defaultMeasureType: 'percentage', defaultScope: 'monitor', bscPerspective: 'process' },
      { code: 'OPS.LEAD', name: '交付周期', defaultUnit: '天', defaultMeasureType: 'numeric', defaultScope: 'monitor', bscPerspective: 'process' },
      { code: 'HR.RETAIN', name: '关键人才留存率', defaultUnit: '%', defaultMeasureType: 'percentage', defaultScope: 'monitor', bscPerspective: 'growth' },
    ];

    const subjectByCode = new Map<string, KpiSubject>();
    for (const spec of subjectsSpec) {
      const subj = await s.kpiSubjects.create({
        code: spec.code,
        name: spec.name,
        level: 1,
        bscPerspective: spec.bscPerspective,
        defaultScope: spec.defaultScope,
        defaultUnit: spec.defaultUnit,
        defaultMeasureType: spec.defaultMeasureType,
        active: true,
        tenantId: 'default',
        createdBy: 'demo-user',
        createdAt: now,
        updatedAt: now,
      } as Omit<KpiSubject, 'id'>);
      subjectByCode.set(spec.code, subj);
    }

    // 3. 配置每个人（包括 demo-user 员工本人）的指标实例
    const kpiSpecs = [
      // 员工自己 (demo-user)
      { subjectCode: 'FIN.REV', assignee: 'demo-user', title: '研发项目相关业务增量营收', startValue: 0, targetValue: 500, weight: 30, scope: 'bonus', kpiCompletion: 0.88 },
      { subjectCode: 'CUST.CSAT', assignee: 'demo-user', title: '核心系统可用性 SLA 客户满意度', startValue: 80, targetValue: 95, weight: 30, scope: 'bonus', kpiCompletion: 0.88 },
      { subjectCode: 'OPS.QA', assignee: 'demo-user', title: '代码发布质量合格率', startValue: 90, targetValue: 98, weight: 20, scope: 'bonus', kpiCompletion: 0.88 },
      { subjectCode: 'HR.RETAIN', assignee: 'demo-user', title: '关键技能掌握与内部技术分享次', startValue: 0, targetValue: 5, weight: 20, scope: 'bonus', kpiCompletion: 0.88 },
      // 演示同事
      { subjectCode: 'FIN.REV', assignee: 'demo-star', title: '营业收入 (Star)', startValue: 5000, targetValue: 8000, weight: 50, scope: 'bonus', kpiCompletion: 1.05 },
      { subjectCode: 'CUST.NEW', assignee: 'demo-star', title: '新客户数 (Star)', startValue: 0, targetValue: 30, weight: 30, scope: 'bonus', kpiCompletion: 1.05 },
      { subjectCode: 'FIN.GP', assignee: 'demo-star', title: '毛利率 (Star)', startValue: 25, targetValue: 35, weight: 20, scope: 'bonus', kpiCompletion: 1.05 },
      { subjectCode: 'FIN.REV', assignee: 'demo-burnout', title: '营业收入 (Burnout)', startValue: 4000, targetValue: 6000, weight: 60, scope: 'bonus', kpiCompletion: 1.0 },
      { subjectCode: 'OPS.LEAD', assignee: 'demo-burnout', title: '交付周期 (Burnout)', startValue: 30, targetValue: 20, weight: 40, scope: 'bonus', kpiCompletion: 1.0 },
      { subjectCode: 'FIN.REV', assignee: 'demo-mismatch', title: '营业收入 (Mismatch)', startValue: 3000, targetValue: 5000, weight: 70, scope: 'bonus', kpiCompletion: 0.5 },
      { subjectCode: 'OPS.QA', assignee: 'demo-mismatch', title: '质量合格率 (Mismatch)', startValue: 90, targetValue: 95, weight: 30, scope: 'bonus', kpiCompletion: 0.5 },
      { subjectCode: 'FIN.REV', assignee: 'demo-intervene', title: '营业收入 (Intervene)', startValue: 2000, targetValue: 4000, weight: 100, scope: 'bonus', kpiCompletion: 0.4 },
    ];

    const SNAPSHOT_DAYS = 30;
    for (const spec of kpiSpecs) {
      const subj = subjectByCode.get(spec.subjectCode);
      if (!subj) continue;
      const range = spec.targetValue - spec.startValue;
      const currentValue = spec.startValue + range * spec.kpiCompletion;
      const kpi = await s.kpis.create({
        cycleId: cycle.id,
        subjectId: subj.id,
        bscPerspective: subj.bscPerspective,
        level: spec.assignee === 'demo-user' ? 'individual' : 'company',
        assigneeId: spec.assignee,
        title: spec.title,
        measureType: subj.defaultMeasureType,
        startValue: spec.startValue,
        targetValue: spec.targetValue,
        currentValue: Math.round(currentValue * 100) / 100,
        unit: subj.defaultUnit,
        weight: spec.weight,
        dataSource: 'manual',
        scope: spec.scope as KpiScope,
        tenantId: 'default',
        createdBy: 'demo-user',
        createdAt: now,
        updatedAt: now,
      } as Omit<Kpi, 'id'>);

      // 生成 30 天历史快照
      const finalValue = kpi.currentValue;
      for (let d = SNAPSHOT_DAYS - 1; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dayStr = date.toISOString().slice(0, 10);
        const t = (SNAPSHOT_DAYS - 1 - d) / (SNAPSHOT_DAYS - 1);
        const noise = ((d * 7 + spec.startValue) % 11) / 100 - 0.05;
        const v = spec.startValue + (finalValue - spec.startValue) * (t + noise * t);
        await s.kpiSnapshots.create({
          kpiId: kpi.id,
          date: dayStr,
          cumulativeValue: Math.round(v * 100) / 100,
          source: 'manual',
          createdAt: now,
        } as Omit<KpiSnapshot, 'id'>);
      }
    }
    console.info(`[seed] KPI balance-scorecard seeded: ${kpiSpecs.length} KPIs inserted`);
  } catch (err) {
    console.warn('[seed] KPI demo seed failed:', (err as Error).message);
  }
}

/**
 * 分身编队 (B-037 · M4): 起始基础 Agent 模板市场 (idempotent).
 * 员工从这些已发布模板 fork 出技能分身。全部 origin='internal' (公司策展),
 * 外部市场 (external_market) 走 M5 + §19 出站审查, 不在此 seed。
 */
export async function seedAgentTemplatesIfEmpty(): Promise<void> {
  const s = getStore();
  try {
    const existing = await s.agentTemplates.list();
    if (existing.some((t) => t.tenantId === 'default')) return;

    const now = new Date().toISOString();
    const defs: Array<Pick<AgentTemplate, 'name' | 'specialty' | 'basePrompt' | 'defaultSkills' | 'defaultKnowledgeTags'>> = [
      {
        name: '资深财务分析师',
        specialty: 'finance',
        basePrompt:
          '你是一名资深财务分析师。擅长预算测算、ROI/回本周期评估、现金流与成本结构分析。给建议时先量化关键数字, 明确假设与敏感性, 保守稳健、不夸大收益。',
        defaultSkills: [],
        defaultKnowledgeTags: ['finance', 'budget', 'roi'],
      },
      {
        name: '技术架构师',
        specialty: 'tech',
        basePrompt:
          '你是一名技术架构师。擅长可行性评估、系统设计、依赖与风险识别、工作量与技术债权衡。给方案时标注关键风险与验证路径, 不过度设计。',
        defaultSkills: [],
        defaultKnowledgeTags: ['tech', 'architecture'],
      },
      {
        name: '产品经理',
        specialty: 'pm',
        basePrompt:
          '你是一名产品经理。擅长需求优先级、范围与排期、验收标准、用户价值取舍。给建议时先厘清目标用户与核心价值, 明确 MVP 边界与验收口径。',
        defaultSkills: [],
        defaultKnowledgeTags: ['pm', 'product'],
      },
      {
        name: '增长营销专家',
        specialty: 'marketing',
        basePrompt:
          '你是一名增长营销专家。擅长目标人群定位、卖点提炼、渠道与话术、转化漏斗与增长实验。建议须可度量、可实验, 不编造数据。',
        defaultSkills: [],
        defaultKnowledgeTags: ['marketing', 'growth'],
      },
      {
        name: '法务合规顾问',
        specialty: 'legal',
        basePrompt:
          '你是一名法务合规顾问。擅长合同要点、合规风险识别、条款取舍。仅提示风险与建议, 绝不替代正式法律意见; 涉及重大法律事项一律建议转专业律师。',
        defaultSkills: [],
        defaultKnowledgeTags: ['legal', 'compliance'],
      },
    ];

    for (const d of defs) {
      await s.agentTemplates.create({
        tenantId: 'default',
        name: d.name,
        specialty: d.specialty,
        origin: 'internal',
        basePrompt: d.basePrompt,
        defaultSkills: d.defaultSkills,
        defaultKnowledgeTags: d.defaultKnowledgeTags,
        status: 'published',
        createdBy: 'admin@tandem.local',
        createdAt: now,
        updatedAt: now,
      } as Omit<AgentTemplate, 'id'>);
    }
    console.info(`[seed] agent templates seeded: ${defs.length} published`);
  } catch (err) {
    console.warn('[seed] agent templates failed:', (err as Error).message);
  }
}
