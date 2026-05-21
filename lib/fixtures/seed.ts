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
import { db, schema } from '../infra/drizzle-client';
import { sql } from 'drizzle-orm';

let _seeded = false;

export async function seedDevData(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  const s = getStore();

  // §T6 幂等保护: 持久化模式下若 KvStore 已有数据, 跳过 seed (重启不重复)
  if (process.env.DATABASE_URL) {
    try {
      const existing = await db
        .select({ c: sql<number>`count(*)` })
        .from(schema.kvStore);
      const count = Number(existing[0]?.c ?? 0);
      if (count > 0) {
        // eslint-disable-next-line no-console
        console.info(`[seed] skipped (KvStore already has ${count} rows)`);
        return;
      }
    } catch {
      // KvStore 表不存在(首次) → 继续 seed
    }
  }

  // 先创建用户 (FK 外键约束要求 createdById 必须存在)
  // §T2 仅在 PostgreSQL 模式下执行；InMemory 模式不需要 User 表
  if (process.env.DATABASE_URL) {
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
    });

    await drvSvc.create({
      name: '产品资料',
      mimeType: 'inode/directory',
      size: 0,
      parentId: null,
      ownerId: 'demo-user',
      tenantId: 'default',
      storageKey: 'folder-product',
      isFolder: true,
    });

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
    if (existing.length > 0) return;

    const seedApps: Array<Parameters<typeof lpSvc.create>[0]> = [
      {
        category: 'business', name: '金蝶 ERP', description: '采购 · 财务 · 供应链',
        url: 'https://www.kingdee.com', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 0,
        recommendKeywords: ['财务', '采购', '供应链', 'erp', 'finance'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
      {
        category: 'business', name: 'Salesforce CRM', description: '客户 · 销售 · 商机跟进',
        url: 'https://login.salesforce.com', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 1,
        recommendKeywords: ['销售', '客户', '商机', 'sales', 'crm', '签单'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
      {
        category: 'business', name: 'Jira', description: '研发任务 · Sprint 看板',
        url: 'https://www.atlassian.com/software/jira', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 2,
        recommendKeywords: ['研发', '工程', 'bug', 'sprint', '迭代'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
      {
        category: 'comm', name: '钉钉', description: '即时通讯 · 视频会议',
        url: 'https://im.dingtalk.com', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 0,
        recommendKeywords: ['沟通', '消息', '会议'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
      {
        category: 'comm', name: '腾讯会议', description: '视频会议 · 屏幕共享',
        url: 'https://meeting.tencent.com', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 1,
        recommendKeywords: ['会议', 'meeting', '视频'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
      {
        category: 'learning', name: '公司 Wiki', description: '知识库 · 文档中心',
        url: 'https://www.notion.so', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 0,
        recommendKeywords: ['文档', '知识', '培训', 'wiki', '手册'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
      {
        category: 'learning', name: 'HR 系统', description: '考勤 · 请假 · 报销',
        url: 'https://www.bamboohr.com', iconUrl: null, ssoMode: 'none', ssoConfig: null,
        visibleTo: [], visibleToRoles: [], order: 1,
        recommendKeywords: ['人事', 'hr', '请假', '考勤', '报销'],
        unreadAdapter: null, status: 'active', tenantId: 'default',
      },
    ];
    for (const app of seedApps) await lpSvc.create(app);
    // eslint-disable-next-line no-console
    console.info(`[seed] launchpad: ${seedApps.length} default apps seeded`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[seed] launchpad seed failed:', (err as Error).message);
  }
}
