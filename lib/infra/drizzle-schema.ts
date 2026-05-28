/**
 * Drizzle Schema · 与 Prisma schema.prisma 对齐
 * 仅声明 V1 GA 路径所需表；其它表可后续增量迁移。
 */

import { pgTable, text, integer, boolean, timestamp, jsonb, index, primaryKey } from 'drizzle-orm/pg-core';

/**
 * KvStore · 遗留模块持久化的通用 JSON 表
 * §T6: V1 GA 阶段, 老模块 (Persona/Memory/OKR/IM/DecisionCard/...) 用此表落 PG.
 * 热表后续会逐步升级到强类型 schema.
 */
export const kvStore = pgTable(
  'KvStore',
  {
    collection: text('collection').notNull(),
    id: text('id').notNull(),
    data: jsonb('data').notNull(),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collection, t.id] }),
    collectionIdx: index('KvStore_collection_idx').on(t.collection),
    tenantIdx: index('KvStore_tenant_idx').on(t.tenantId),
  }),
);

export const user = pgTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('emailVerifiedAt', { precision: 3, mode: 'date' }),
  name: text('name').notNull(),
  avatarUrl: text('avatarUrl'),
  roles: text('roles').array().notNull().default([]),
  tenantId: text('tenantId').notNull().default('default'),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  deletedAt: timestamp('deletedAt', { precision: 3, mode: 'date' }),
});

export const document = pgTable(
  'Document',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    type: text('type').notNull().default('doc'),
    ownerId: text('ownerId').notNull(),
    tenantId: text('tenantId').notNull().default('default'),
    permissions: jsonb('permissions').notNull().default({}),
    version: integer('version').notNull().default(1),
    isLocked: boolean('isLocked').notNull().default(false),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    deletedAt: timestamp('deletedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    ownerIdx: index('Document_ownerId_idx').on(t.ownerId),
    tenantIdx: index('Document_tenantId_idx').on(t.tenantId),
    updatedIdx: index('Document_updatedAt_idx').on(t.updatedAt),
  }),
);

export const calendarEvent = pgTable(
  'CalendarEvent',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startAt: timestamp('startAt', { precision: 3, mode: 'date' }).notNull(),
    endAt: timestamp('endAt', { precision: 3, mode: 'date' }).notNull(),
    timezone: text('timezone').notNull().default('Asia/Shanghai'),
    allDay: boolean('allDay').notNull().default(false),
    recurringRule: jsonb('recurringRule'),
    ownerId: text('ownerId').notNull(),
    attendees: text('attendees').array().notNull().default([]),
    location: text('location'),
    meetingUrl: text('meetingUrl'),
    calendarSource: text('calendarSource').notNull().default('manual'),
    externalId: text('externalId'),
    status: text('status').notNull().default('confirmed'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    ownerIdx: index('CalendarEvent_ownerId_idx').on(t.ownerId),
    startIdx: index('CalendarEvent_startAt_idx').on(t.startAt),
  }),
);

export const driveFile = pgTable(
  'DriveFile',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    mimeType: text('mimeType').notNull().default('application/octet-stream'),
    size: integer('size').notNull().default(0),
    parentId: text('parentId'),
    ownerId: text('ownerId').notNull(),
    tenantId: text('tenantId').notNull().default('default'),
    storageKey: text('storageKey').notNull(),
    storageUrl: text('storageUrl'),
    permissions: jsonb('permissions').notNull().default({}),
    version: integer('version').notNull().default(1),
    isFolder: boolean('isFolder').notNull().default(false),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    deletedAt: timestamp('deletedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    ownerIdx: index('DriveFile_ownerId_idx').on(t.ownerId),
    parentIdx: index('DriveFile_parentId_idx').on(t.parentId),
  }),
);

export const launchpadApp = pgTable(
  'LaunchpadApp',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    iconUrl: text('iconUrl'),
    url: text('url').notNull(),
    ssoMode: text('ssoMode').notNull().default('none'),
    ssoConfig: jsonb('ssoConfig'),
    visibleTo: text('visibleTo').array().notNull().default([]),
    visibleToRoles: text('visibleToRoles').array().notNull().default([]),
    order: integer('order').notNull().default(0),
    recommendKeywords: text('recommendKeywords').array().notNull().default([]),
    unreadAdapter: jsonb('unreadAdapter'),
    status: text('status').notNull().default('active'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index('LaunchpadApp_category_idx').on(t.category),
    tenantIdx: index('LaunchpadApp_tenantId_idx').on(t.tenantId),
    statusIdx: index('LaunchpadApp_status_idx').on(t.status),
  }),
);

export const launchpadClick = pgTable(
  'LaunchpadClick',
  {
    id: text('id').primaryKey(),
    appId: text('appId').notNull(),
    userId: text('userId').notNull(),
    clickedAt: timestamp('clickedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    source: text('source').notNull().default('home'),
    tenantId: text('tenantId').notNull().default('default'),
  },
  (t) => ({
    appIdx: index('LaunchpadClick_appId_idx').on(t.appId),
    userIdx: index('LaunchpadClick_userId_idx').on(t.userId),
    clickedIdx: index('LaunchpadClick_clickedAt_idx').on(t.clickedAt),
  }),
);

export const notification = pgTable(
  'Notification',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    data: jsonb('data'),
    readAt: timestamp('readAt', { precision: 3, mode: 'date' }),
    dismissedAt: timestamp('dismissedAt', { precision: 3, mode: 'date' }),
    priority: text('priority').notNull().default('normal'),
    channel: text('channel').notNull().default('in-app'),
    sourceId: text('sourceId'),
    sourceType: text('sourceType'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('Notification_userId_idx').on(t.userId),
    createdIdx: index('Notification_createdAt_idx').on(t.createdAt),
  }),
);

/**
 * AuditLog · 不可篡改审计链
 *
 * - hash + prevHash 形成 SHA-256 链, 任何条目被改动会导致后续 verify() 失败
 * - 跨重启保持链路完整 (启动时从 DB 加载最新 hash 作为新链头 prevHash)
 * - 等保二级 / GDPR / PIPL 证据要求
 */
export const auditLog = pgTable(
  'AuditLog',
  {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    actorId: text('actorId').notNull(),
    targetId: text('targetId'),
    targetType: text('targetType'),
    metadata: jsonb('metadata'),
    timestamp: timestamp('timestamp', { precision: 3, mode: 'date' }).notNull(),
    hash: text('hash').notNull(),
    prevHash: text('prevHash'),
    tenantId: text('tenantId').notNull().default('default'),
    /** sequence number (monotonic per tenant, db-side default via BIGSERIAL-equivalent) */
    seq: integer('seq').notNull(),
  },
  (t) => ({
    actionIdx: index('AuditLog_action_idx').on(t.action),
    actorIdx: index('AuditLog_actorId_idx').on(t.actorId),
    targetIdx: index('AuditLog_targetId_idx').on(t.targetId),
    timestampIdx: index('AuditLog_timestamp_idx').on(t.timestamp),
    tenantSeqIdx: index('AuditLog_tenant_seq_idx').on(t.tenantId, t.seq),
  }),
);

/**
 * UsageEvent · 用户行为埋点
 *
 * 用途: 自用阶段 30+ 同事每天产生的使用数据 → 产品决策原料
 *   - 哪些页面 / 模块被真用
 *   - 谁用得多 / 谁完全不用
 *   - 哪些功能从来没被点 (准备砍)
 *
 * 设计选择:
 *   - 不引入第三方 (PostHog / Mixpanel), 自建可控
 *   - props 用 jsonb 保留灵活性, 不强 schema
 *   - 按 userId / eventName / createdAt 三索引覆盖看板查询
 */
export const usageEvent = pgTable(
  'UsageEvent',
  {
    id: text('id').primaryKey(),
    userId: text('userId'), // 匿名访问 (未登录) 时可为 null
    tenantId: text('tenantId').notNull().default('default'),
    /** 事件名 (推荐 'domain.action' 格式: 'page.view' / 'okr.create' / 'persona.train' / 'memory.promote' / 'convergence.commit' / ...) */
    eventName: text('eventName').notNull(),
    /** 任意属性 (path, durationMs, targetId, targetType, ...) */
    props: jsonb('props'),
    sessionId: text('sessionId'),
    userAgent: text('userAgent'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('UsageEvent_userId_idx').on(t.userId),
    eventIdx: index('UsageEvent_eventName_idx').on(t.eventName),
    createdAtIdx: index('UsageEvent_createdAt_idx').on(t.createdAt),
    tenantUserIdx: index('UsageEvent_tenant_user_idx').on(t.tenantId, t.userId),
  }),
);

/**
 * LlmUsageLog · LLM 调用成本与延迟记录
 *
 * 用途: AI 调用从黑盒变可见, 自用语境下是"成本中心"而不是"商业化定价"
 *   - 每月 LLM 总花费 ¥? token?
 *   - 哪个 scenario (persona_dialogue / reasoning_complex / long_context) 烧最多
 *   - 哪个 provider (deepseek / anthropic / openai) ROI 最好
 *   - 是否有用户在异常调用 (rate limit)
 *
 * §B-005 (AI-BACKLOG 战略级条目)
 */
export const llmUsageLog = pgTable(
  'LlmUsageLog',
  {
    id: text('id').primaryKey(),
    userId: text('userId'), // 系统任务可为 null
    tenantId: text('tenantId').notNull().default('default'),
    /** TAF Router scenario (persona_dialogue / reasoning_complex / long_context / chat_simple / ...) */
    scenario: text('scenario').notNull(),
    /** Provider (deepseek / anthropic / openai / kimi / doubao / qwen / ...) */
    provider: text('provider').notNull(),
    /** 具体模型名 (deepseek-chat / claude-3-7-sonnet / gpt-4o / ...) */
    model: text('model').notNull(),
    tokensIn: integer('tokensIn').notNull().default(0),
    tokensOut: integer('tokensOut').notNull().default(0),
    latencyMs: integer('latencyMs').notNull().default(0),
    /** 成本: 单位 1/10000 美元 (= 0.01 美分). 100 美分 = $1. 用 integer 避免浮点 */
    costMicroUsd: integer('costMicroUsd').notNull().default(0),
    /** 追踪请求链路 (可关联 baseline-guard checkId / api request id / ...) */
    requestId: text('requestId'),
    success: boolean('success').notNull().default(true),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('LlmUsageLog_userId_idx').on(t.userId),
    providerIdx: index('LlmUsageLog_provider_idx').on(t.provider),
    scenarioIdx: index('LlmUsageLog_scenario_idx').on(t.scenario),
    createdAtIdx: index('LlmUsageLog_createdAt_idx').on(t.createdAt),
    tenantCreatedIdx: index('LlmUsageLog_tenant_created_idx').on(t.tenantId, t.createdAt),
  }),
);


