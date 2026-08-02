/**
 * Drizzle Schema · 与 Prisma schema.prisma 对齐
 * 仅声明 V1 GA 路径所需表；其它表可后续增量迁移。
 */

import { pgTable, text, integer, boolean, timestamp, jsonb, index, primaryKey, numeric, uniqueIndex } from 'drizzle-orm/pg-core';

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
    // 迁移 0006: 支撑 list(filter.tenantId) 的 collection+tenant 下推 (C2)
    collectionTenantIdx: index('KvStore_collection_tenant_idx').on(t.collection, t.tenantId),
  }),
);

export const user = pgTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('emailVerifiedAt', { precision: 3, mode: 'date' }),
  name: text('name').notNull(),
  avatarUrl: text('avatarUrl'),
  departmentId: text('departmentId'),
  managerId: text('managerId'),
  jobTitle: text('jobTitle'),
  employeeId: text('employeeId'),
  hireDate: text('hireDate'),
  workLocation: text('workLocation'),
  phone: text('phone'),
  roles: text('roles').array().notNull().default([]),
  tenantId: text('tenantId').notNull().default('default'),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  deletedAt: timestamp('deletedAt', { precision: 3, mode: 'date' }),
});

export const roleDefinition = pgTable(
  'RoleDefinition',
  {
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    kind: text('kind').notNull().default('internal'),
    permissions: text('permissions').array().notNull().default([]),
    system: boolean('system').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sortOrder').notNull().default(0),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.key] }),
    tenantEnabledIdx: index('RoleDefinition_tenant_enabled_idx').on(t.tenantId, t.enabled),
  }),
);

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
    spawnedPromotionId: text('spawnedPromotionId'),
    spawnedDecisionCardId: text('spawnedDecisionCardId'),
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
    attendeeEmails: text('attendeeEmails').array().notNull().default([]),
    externalAttendeeEmails: text('externalAttendeeEmails').array().notNull().default([]),
    reminderMinutes: integer('reminderMinutes'),
    seriesId: text('seriesId'),
    recurrenceIndex: integer('recurrenceIndex'),
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
    seriesIdx: index('CalendarEvent_seriesId_idx').on(t.seriesId),
    tenantStartIdx: index('CalendarEvent_tenant_start_idx').on(t.tenantId, t.startAt),
  }),
);

export const calendarReminder = pgTable(
  'CalendarReminder',
  {
    id: text('id').primaryKey(),
    eventId: text('eventId').notNull(),
    userId: text('userId').notNull(),
    remindAt: timestamp('remindAt', { precision: 3, mode: 'date' }).notNull(),
    status: text('status').notNull().default('pending'),
    tenantId: text('tenantId').notNull().default('default'),
    firedAt: timestamp('firedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    eventIdx: index('CalendarReminder_eventId_idx').on(t.eventId),
    userDueIdx: index('CalendarReminder_user_due_idx').on(t.tenantId, t.userId, t.status, t.remindAt),
  }),
);

export const calendarSubscription = pgTable(
  'CalendarSubscription',
  {
    id: text('id').primaryKey(),
    subscriberId: text('subscriberId').notNull(),
    targetUserId: text('targetUserId').notNull(),
    status: text('status').notNull().default('subscribed'),
    detailPermission: text('detailPermission').notNull().default('not_requested'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    relationUniq: uniqueIndex('CalendarSubscription_relation_uniq').on(t.tenantId, t.subscriberId, t.targetUserId),
    targetIdx: index('CalendarSubscription_target_idx').on(t.tenantId, t.targetUserId),
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
    nodeRole: text('nodeRole'),
    distillable: boolean('distillable').notNull().default(true),
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

export const reminderTask = pgTable(
  'ReminderTask',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    userId: text('userId').notNull(),
    sourceType: text('sourceType').notNull(),
    sourceId: text('sourceId').notNull(),
    dedupeKey: text('dedupeKey').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    url: text('url'),
    remindAt: timestamp('remindAt', { precision: 3, mode: 'date' }).notNull(),
    channels: text('channels').array().notNull().default(['in_app']),
    priority: text('priority').notNull().default('normal'),
    status: text('status').notNull().default('pending'),
    retryCount: integer('retryCount').notNull().default(0),
    lastError: text('lastError'),
    processingAt: timestamp('processingAt', { precision: 3, mode: 'date' }),
    sentAt: timestamp('sentAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    dedupeUniq: uniqueIndex('ReminderTask_tenant_dedupe_uniq').on(t.tenantId, t.dedupeKey),
    userDueIdx: index('ReminderTask_user_due_idx').on(t.tenantId, t.userId, t.status, t.remindAt),
    sourceIdx: index('ReminderTask_source_idx').on(t.tenantId, t.sourceType, t.sourceId),
    dueIdx: index('ReminderTask_due_idx').on(t.status, t.remindAt),
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
 * ApiLog · HTTP 接口访问日志
 *
 * 记录方法、路由、状态码、耗时和脱敏请求上下文。业务动作写入 BusinessLog。
 */
export const apiLog = pgTable(
  'ApiLog',
  {
    id: text('id').primaryKey(),
    requestId: text('requestId'),
    tenantId: text('tenantId').notNull().default('default'),
    actorId: text('actorId').notNull().default('anonymous'),
    actorType: text('actorType').notNull().default('anonymous'),
    source: text('source').notNull().default('api'),
    category: text('category').notNull().default('system'),
    operation: text('operation').notNull(),
    action: text('action').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    route: text('route'),
    targetType: text('targetType'),
    targetId: text('targetId'),
    statusCode: integer('statusCode').notNull(),
    outcome: text('outcome').notNull(),
    level: text('level').notNull().default('info'),
    durationMs: integer('durationMs'),
    summary: text('summary').notNull(),
    requestData: jsonb('requestData'),
    details: jsonb('details'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('ApiLog_tenant_created_idx').on(t.tenantId, t.createdAt),
    tenantActorIdx: index('ApiLog_tenant_actor_idx').on(t.tenantId, t.actorId, t.createdAt),
    tenantRouteIdx: index('ApiLog_tenant_route_idx').on(t.tenantId, t.route, t.createdAt),
    tenantOutcomeIdx: index('ApiLog_tenant_outcome_idx').on(t.tenantId, t.outcome, t.createdAt),
    requestIdx: index('ApiLog_requestId_idx').on(t.requestId),
  }),
);

/**
 * BusinessLog · 可检索领域业务日志
 *
 * 与 AuditLog 的职责不同:
 * - AuditLog 保存少量、不可篡改的合规证据;
 * - BusinessLog 保存领域动作及其业务对象, 供运营查询和 AI 检索;
 * - ApiLog 独立保存 HTTP 接口访问, 不混入本表.
 *
 * details 在写入前必须经过 lib/business-log/redact.ts 脱敏.
 */
export const businessLog = pgTable(
  'BusinessLog',
  {
    id: text('id').primaryKey(),
    requestId: text('requestId'),
    tenantId: text('tenantId').notNull().default('default'),
    actorId: text('actorId').notNull().default('anonymous'),
    actorType: text('actorType').notNull().default('anonymous'),
    kind: text('kind').notNull(),
    source: text('source').notNull().default('domain'),
    category: text('category').notNull().default('system'),
    operation: text('operation').notNull(),
    action: text('action').notNull(),
    method: text('method'),
    path: text('path'),
    route: text('route'),
    targetType: text('targetType'),
    targetId: text('targetId'),
    statusCode: integer('statusCode'),
    outcome: text('outcome').notNull(),
    level: text('level').notNull().default('info'),
    durationMs: integer('durationMs'),
    summary: text('summary').notNull(),
    requestData: jsonb('requestData'),
    details: jsonb('details'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('BusinessLog_tenant_created_idx').on(t.tenantId, t.createdAt),
    tenantActorIdx: index('BusinessLog_tenant_actor_idx').on(t.tenantId, t.actorId, t.createdAt),
    tenantOperationIdx: index('BusinessLog_tenant_operation_idx').on(t.tenantId, t.operation, t.createdAt),
    tenantOutcomeIdx: index('BusinessLog_tenant_outcome_idx').on(t.tenantId, t.outcome, t.createdAt),
    requestIdx: index('BusinessLog_requestId_idx').on(t.requestId),
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
    /** Call-site 级 feature 标签 (比 scenario 更细粒度): 'boss_ai_stream' / 'verify_step' / 'planguard' / ... */
    feature: text('feature'),
    success: boolean('success').notNull().default(true),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('LlmUsageLog_userId_idx').on(t.userId),
    providerIdx: index('LlmUsageLog_provider_idx').on(t.provider),
    scenarioIdx: index('LlmUsageLog_scenario_idx').on(t.scenario),
    featureIdx: index('LlmUsageLog_feature_idx').on(t.feature),
    createdAtIdx: index('LlmUsageLog_createdAt_idx').on(t.createdAt),
    tenantCreatedIdx: index('LlmUsageLog_tenant_created_idx').on(t.tenantId, t.createdAt),
  }),
);

// ===========================================================================
// Academy · 学院架构核心 8 表 (2026-05-29)
// 详见 docs/ACADEMY-METAPHOR-2026-05-29.md § 2.2
// 心智模型: 学员证 / 5 主修 / GPA / 课程目录 / 必修 / 学位 / 实习权限
// 设计原则: 强类型核心 (HR CRUD 高频), 租户隔离, 软删, 版本化, 全审计
// ===========================================================================

/**
 * Course · 课程主表
 *
 * HR 创建 + 学员选课/被派课. 一门课 N 节 Lesson.
 * 心智模型 = 「课程 / 学位课」.
 */
export const course = pgTable(
  'Course',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    /** onboarding | compliance | product | process | track | mode_specialty | leadership */
    category: text('category').notNull(),
    /** 关联的 5 模式 (设计/PM/技术/营销/战略), null = 通识课 */
    modeAffinity: text('modeAffinity').array().notNull().default([]),
    /** beginner | intermediate | advanced */
    level: text('level').notNull().default('beginner'),
    estMinutes: integer('estMinutes').notNull().default(0),
    description: text('description').notNull().default(''),
    coverUrl: text('coverUrl'),

    // 治理
    ownerUserId: text('ownerUserId').notNull(),
    createdByUserId: text('createdByUserId').notNull(),
    /** Steward 双签批人 IDs (MANIFESTO §8) */
    reviewedByUserIds: text('reviewedByUserIds').array().notNull().default([]),
    /** draft | in_review | published | archived */
    status: text('status').notNull().default('draft'),
    publishedAt: timestamp('publishedAt', { precision: 3, mode: 'date' }),

    // 必修策略
    /** mandatory_once | mandatory_quarterly | mandatory_yearly | recommended | elective */
    requirement: text('requirement').notNull().default('elective'),

    // 学分 / 解锁
    /** { mode: 'pm', score: 5 } 通过该课给 mode proficiency +5 */
    proficiencyReward: jsonb('proficiencyReward'),
    /** 通过给综合 GPA (bossCaptureScore) 加分 */
    bossCaptureBonus: integer('bossCaptureBonus').notNull().default(0),
    /** 通过此课才能晋升到指定 delegationLevel (L1/L2/L3) */
    unlocksDelegationLevel: text('unlocksDelegationLevel'),
    /** 季度复训过期 → 锁权限触发 */
    lockOnExpiry: boolean('lockOnExpiry').notNull().default(false),

    // 版本
    version: integer('version').notNull().default(1),
    /** 内容 hash, 大改后老证书标 outdated */
    contentHash: text('contentHash').notNull().default(''),

    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    deletedAt: timestamp('deletedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    slugUniq: index('Course_slug_tenant_uniq').on(t.slug, t.tenantId),
    statusCatIdx: index('Course_status_category_idx').on(t.status, t.category),
    requirementIdx: index('Course_requirement_idx').on(t.requirement, t.status),
    tenantIdx: index('Course_tenant_idx').on(t.tenantId),
  }),
);

/**
 * Lesson · 课时 (1 课程 N 课时)
 *
 * 心智模型 = 「课节 / 讲义」.
 */
export const lesson = pgTable(
  'Lesson',
  {
    id: text('id').primaryKey(),
    courseId: text('courseId').notNull(),
    orderIdx: integer('orderIdx').notNull().default(0),
    title: text('title').notNull(),
    /** lecture | video | quiz | interactive | reading */
    type: text('type').notNull().default('lecture'),
    estMinutes: integer('estMinutes').notNull().default(0),

    // 内容 (按 type 用对应字段)
    contentMarkdown: text('contentMarkdown'),
    contentVideoUrl: text('contentVideoUrl'),
    /** type=interactive 用: { schema: 'three_plus_one_decision', ctx: {...} } */
    contentInteractiveSchema: jsonb('contentInteractiveSchema'),

    // AI 生成标识 (走 /api/learning/generate, 必经 Skill Gateway 4 道闸)
    aiGeneratedAt: timestamp('aiGeneratedAt', { precision: 3, mode: 'date' }),
    aiSourceId: text('aiSourceId'),
    aiReviewedBy: text('aiReviewedBy'),

    // 通过条件
    /** { type: 'quiz_score', threshold: 0.8 } */
    passCondition: jsonb('passCondition'),

    // 三柱闭环锚定 (lib/learning/closure.ts)
    linkedKrId: text('linkedKrId'),
    /** 通过该 lesson 给 mode proficiency 加分 */
    rewardMode: text('rewardMode'),
    rewardScore: integer('rewardScore').notNull().default(0),

    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    courseOrderIdx: index('Lesson_courseId_orderIdx').on(t.courseId, t.orderIdx),
    tenantIdx: index('Lesson_tenant_idx').on(t.tenantId),
  }),
);

/**
 * Question · 题库 (多对一 Lesson)
 *
 * 学院特色: type=decision_3plus1 走 lib/decision-layer/ 引擎
 */
export const question = pgTable(
  'Question',
  {
    id: text('id').primaryKey(),
    lessonId: text('lessonId').notNull(),
    orderIdx: integer('orderIdx').notNull().default(0),
    /** single | multi | true_false | free_text | decision_3plus1 */
    type: text('type').notNull().default('single'),
    prompt: text('prompt').notNull(),
    /** [{ id, text, isCorrect, explanation }] */
    options: jsonb('options').notNull().default([]),
    /** free_text 评分准则 */
    rubric: jsonb('rubric'),
    correctAnswerExplanation: text('correctAnswerExplanation').notNull().default(''),

    // 学院特色 · 3+1 决策题
    /** type=decision_3plus1 时填: { scenario, A/B/C/D options } */
    decisionContext: jsonb('decisionContext'),
    /** A_sop | B_reason | C_case | D_original | any */
    rightAnswerType: text('rightAnswerType'),

    weight: integer('weight').notNull().default(1),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    lessonOrderIdx: index('Question_lessonId_orderIdx').on(t.lessonId, t.orderIdx),
  }),
);

/**
 * Enrollment · 选课 / 报名关系 (一人一课一份)
 */
export const enrollment = pgTable(
  'Enrollment',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    courseId: text('courseId').notNull(),
    /** self_elected | hr_assigned | manager_assigned | ai_recommended | track_required */
    source: text('source').notNull().default('self_elected'),
    /** 若 source=*_assigned, 关联 CourseAssignment.id */
    assignmentId: text('assignmentId'),
    /** enrolled | in_progress | passed | failed | dropped */
    status: text('status').notNull().default('enrolled'),
    enrolledAt: timestamp('enrolledAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    startedAt: timestamp('startedAt', { precision: 3, mode: 'date' }),
    completedAt: timestamp('completedAt', { precision: 3, mode: 'date' }),
    /** HR 派课截止时间 */
    dueAt: timestamp('dueAt', { precision: 3, mode: 'date' }),

    /** 已完成的 lesson IDs */
    lessonsCompleted: text('lessonsCompleted').array().notNull().default([]),
    totalScore: integer('totalScore'),

    tenantId: text('tenantId').notNull().default('default'),
  },
  (t) => ({
    userStatusIdx: index('Enrollment_userId_status_idx').on(t.userId, t.status),
    courseStatusIdx: index('Enrollment_courseId_status_idx').on(t.courseId, t.status),
    uniqEnroll: index('Enrollment_user_course_tenant_uniq').on(t.userId, t.courseId, t.tenantId),
  }),
);

/**
 * LessonAttempt · 单次答题尝试 (一节课多次重修 = 多条 attempt)
 */
export const lessonAttempt = pgTable(
  'LessonAttempt',
  {
    id: text('id').primaryKey(),
    enrollmentId: text('enrollmentId').notNull(),
    /** 冗余, 加速查询 */
    userId: text('userId').notNull(),
    lessonId: text('lessonId').notNull(),
    attemptNo: integer('attemptNo').notNull().default(1),

    startedAt: timestamp('startedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    submittedAt: timestamp('submittedAt', { precision: 3, mode: 'date' }),
    timeSpentSec: integer('timeSpentSec').notNull().default(0),

    /** { questionId: answerValue }[] */
    answers: jsonb('answers').notNull().default([]),
    score: integer('score'),
    passed: boolean('passed'),

    // 三柱闭环 (走 lib/learning/closure.ts onLessonCompleted)
    closureExecuted: boolean('closureExecuted').notNull().default(false),
    /** krProgressDelta / proficiencyDelta / certification / personaMemoryCandidate */
    closureEffects: jsonb('closureEffects'),

    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userLessonIdx: index('LessonAttempt_userId_lessonId_idx').on(t.userId, t.lessonId),
    enrollmentIdx: index('LessonAttempt_enrollmentId_idx').on(t.enrollmentId),
  }),
);

/**
 * Certification · 证书 (通过课程后颁发, 季度复训会过期)
 */
export const certification = pgTable(
  'Certification',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    courseId: text('courseId').notNull(),
    enrollmentId: text('enrollmentId').notNull(),

    earnedAt: timestamp('earnedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    /** 季度必修 = earnedAt + 90 天 */
    expiresAt: timestamp('expiresAt', { precision: 3, mode: 'date' }),
    /** valid | expiring_soon | expired | revoked | outdated */
    status: text('status').notNull().default('valid'),

    /** 「TANDEM-2026-CMPL-Q2-0007」 */
    certNo: text('certNo').notNull(),
    /** 学到的内容版本快照 */
    contentHashAtEarning: text('contentHashAtEarning').notNull().default(''),
    /** Steward 数字签名 (高阶证书) */
    signedBy: text('signedBy'),

    /** 解锁: L1/L2/L3 实习权限 */
    unlockedDelegationLevel: text('unlockedDelegationLevel'),
    /** { mode: 'pm', score: 5 } */
    unlockedProficiencyBoost: jsonb('unlockedProficiencyBoost'),

    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('Certification_userId_status_idx').on(t.userId, t.status, t.expiresAt),
    courseEarnedIdx: index('Certification_courseId_earnedAt_idx').on(t.courseId, t.earnedAt),
    certNoIdx: index('Certification_certNo_idx').on(t.certNo),
  }),
);

/**
 * CourseAssignment · HR / 上级派课 (按部门 / 角色 / 单人)
 *
 * 派课 = 自动给 target 创建 Enrollment + 推提醒.
 */
export const courseAssignment = pgTable(
  'CourseAssignment',
  {
    id: text('id').primaryKey(),
    courseId: text('courseId').notNull(),

    /** user | department | role | all_tenant */
    targetType: text('targetType').notNull(),
    targetUserId: text('targetUserId'),
    targetDepartmentId: text('targetDepartmentId'),
    targetRole: text('targetRole'),

    assignedByUserId: text('assignedByUserId').notNull(),
    /** 派课理由 (审计用) */
    reason: text('reason').notNull().default(''),

    dueInDays: integer('dueInDays'),
    /** { firstReminderDays: 7, escalateAfterDays: 14 } */
    reminderPolicy: jsonb('reminderPolicy'),

    /** 完成前锁特定权限 (例: 锁 黄区代行) */
    blocksUntilCompletion: boolean('blocksUntilCompletion').notNull().default(false),

    /** active | paused | cancelled */
    status: text('status').notNull().default('active'),

    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    targetUserIdx: index('CourseAssignment_targetUserId_idx').on(t.targetUserId, t.status),
    targetDeptIdx: index('CourseAssignment_targetDepartmentId_idx').on(t.targetDepartmentId, t.status),
    courseIdx: index('CourseAssignment_courseId_idx').on(t.courseId),
  }),
);

/**
 * LearningMcpToken · 个人 AI 接入 token
 *
 * MANIFESTO §19 落地: 员工把自己的 Claude Desktop / Cursor 等接入 Tandem 学习 MCP.
 * Token 颁发 = 员工自助 + 默认极窄 scope (不含 submit_attempt).
 * 所有 MCP 调用走 runSkillGateway() 4 道闸.
 */
export const learningMcpToken = pgTable(
  'LearningMcpToken',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    /** SHA-256 of token (不存明文) */
    tokenHash: text('tokenHash').notNull(),

    /**
     * 默认 scope: ['academy.search', 'academy.fetch_lesson', 'academy.my_status', 'academy.recommend', 'academy.export_notes']
     * 高敏 scope (员工 UI 二次确认才开): ['academy.start_lesson', 'academy.submit_attempt', 'academy.claim_proficiency']
     */
    scopes: text('scopes').array().notNull().default([]),

    /** 节流 */
    rateLimitPerHour: integer('rateLimitPerHour').notNull().default(30),
    /** 90 天后过期 */
    expiresAt: timestamp('expiresAt', { precision: 3, mode: 'date' }).notNull(),

    /** 审计 */
    lastUsedAt: timestamp('lastUsedAt', { precision: 3, mode: 'date' }),
    totalCalls: integer('totalCalls').notNull().default(0),
    revokedAt: timestamp('revokedAt', { precision: 3, mode: 'date' }),

    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userActiveIdx: index('LearningMcpToken_userId_revokedAt_idx').on(t.userId, t.revokedAt),
    tokenHashIdx: index('LearningMcpToken_tokenHash_idx').on(t.tokenHash),
  }),
);

// ===========================================================================
// KPI 体系强类型表 (B-019 / B-020, 从 KvStore 升级)
// 见 docs/CHARTER-KPI-TTI.md §2 + lib/types/kpi.ts
// 设计原则: 热表强类型 + 复合索引, 时序表按 kpiId+date 索引
// ===========================================================================

/**
 * KpiCycle · 财年绩效周期 (年度, 一家公司同时只有一个 active)
 */
export const kpiCycle = pgTable(
  'KpiCycle',
  {
    id: text('id').primaryKey(),
    fiscalYear: integer('fiscalYear').notNull(),
    name: text('name').notNull(),
    startDate: text('startDate').notNull(),
    endDate: text('endDate').notNull(),
    /** draft | active | closed */
    status: text('status').notNull().default('draft'),
    tenantId: text('tenantId').notNull().default('default'),
    targetsLockedAt: timestamp('targetsLockedAt', { precision: 3, mode: 'date' }),
    closedAt: timestamp('closedAt', { precision: 3, mode: 'date' }),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    tenantStatusIdx: index('KpiCycle_tenantId_status_idx').on(t.tenantId, t.status),
    fiscalYearIdx: index('KpiCycle_fiscalYear_idx').on(t.fiscalYear, t.tenantId),
  }),
);

/**
 * KpiSubject · 科目主数据 (动态可扩展树)
 *
 * 三层结构: level=1 一级科目 → level=2 二级 → level=3 三级.
 * HR/财务可增删改; 软删除 (active=false) 保留历史 KPI 引用完整性.
 */
export const kpiSubject = pgTable(
  'KpiSubject',
  {
    id: text('id').primaryKey(),
    parentId: text('parentId'),
    /** 业务编码, e.g. "REV-001". Excel 导入匹配键 */
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** financial | customer | process | growth */
    bscPerspective: text('bscPerspective'),
    level: integer('level').notNull().default(1),
    /** bonus | monitor */
    defaultScope: text('defaultScope').notNull().default('bonus'),
    defaultUnit: text('defaultUnit'),
    /** numeric | percentage | currency | count */
    defaultMeasureType: text('defaultMeasureType').notNull().default('numeric'),
    active: boolean('active').notNull().default(true),
    tenantId: text('tenantId').notNull().default('default'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    codeUniq: uniqueIndex('KpiSubject_code_tenant_uniq').on(t.code, t.tenantId),
    parentIdx: index('KpiSubject_parentId_idx').on(t.parentId),
    bscIdx: index('KpiSubject_bscPerspective_idx').on(t.bscPerspective, t.tenantId),
    activeIdx: index('KpiSubject_active_tenant_idx').on(t.active, t.tenantId),
  }),
);

/**
 * Kpi · KPI 指标实例 (热表, 最高频查询)
 *
 * 复合索引覆盖: cycleId+level+scope+assigneeId 是最常见过滤组合.
 */
export const kpi = pgTable(
  'Kpi',
  {
    id: text('id').primaryKey(),
    cycleId: text('cycleId').notNull(),
    subjectId: text('subjectId').notNull(),
    /** financial | customer | process | growth (可覆写 subject 的默认值) */
    bscPerspective: text('bscPerspective'),
    /** company | department | individual */
    level: text('level').notNull(),
    parentKpiId: text('parentKpiId'),
    assigneeId: text('assigneeId').notNull(),
    /** 跨体系联合持有人 id 数组 (JSON) — 见 Kpi.coOwnerIds 类型注释: 纯数据层联合监控, 不驱动奖金 */
    coOwnerIds: jsonb('coOwnerIds'),
    departmentId: text('departmentId'),
    title: text('title').notNull(),
    description: text('description'),
    /** numeric | percentage | currency | count */
    measureType: text('measureType').notNull().default('numeric'),
    startValue: numeric('startValue', { precision: 18, scale: 4 }).notNull().default('0'),
    targetValue: numeric('targetValue', { precision: 18, scale: 4 }).notNull().default('0'),
    currentValue: numeric('currentValue', { precision: 18, scale: 4 }).notNull().default('0'),
    unit: text('unit'),
    weight: numeric('weight', { precision: 6, scale: 2 }).notNull().default('0'),
    /** erp | manual | pending */
    dataSource: text('dataSource').notNull().default('pending'),
    /** bonus | monitor */
    scope: text('scope').notNull().default('bonus'),
    tenantId: text('tenantId').notNull().default('default'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    /** 最核心查询: 一个周期内按层级+scope+被考核人过滤 */
    cycleLevelScopeIdx: index('Kpi_cycleId_level_scope_idx').on(t.cycleId, t.level, t.scope),
    assigneeIdx: index('Kpi_assigneeId_cycleId_idx').on(t.assigneeId, t.cycleId),
    parentIdx: index('Kpi_parentKpiId_idx').on(t.parentKpiId),
    deptIdx: index('Kpi_departmentId_cycleId_idx').on(t.departmentId, t.cycleId),
    bscIdx: index('Kpi_bscPerspective_cycleId_idx').on(t.bscPerspective, t.cycleId),
    tenantIdx: index('Kpi_tenantId_idx').on(t.tenantId),
  }),
);

/**
 * KpiCheckIn · 季度/月度进度快照 (只读追加, 审计链节点)
 */
export const kpiCheckIn = pgTable(
  'KpiCheckIn',
  {
    id: text('id').primaryKey(),
    kpiId: text('kpiId').notNull(),
    /** 快照时点 ISO 字符串 */
    asOf: text('asOf').notNull(),
    cumulativeValue: numeric('cumulativeValue', { precision: 18, scale: 4 }).notNull(),
    delta: numeric('delta', { precision: 18, scale: 4 }).notNull().default('0'),
    /** erp | manual | pending */
    source: text('source').notNull().default('manual'),
    note: text('note'),
    createdBy: text('createdBy').notNull(),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    kpiAsOfIdx: index('KpiCheckIn_kpiId_asOf_idx').on(t.kpiId, t.asOf),
    tenantIdx: index('KpiCheckIn_tenantId_idx').on(t.tenantId),
  }),
);

/**
 * KpiSnapshot · 每日/每周时序快照 (供 YTD / 环比 / 趋势分析)
 *
 * 时序表: kpiId+date 是唯一键, 每日 upsert 一条.
 * 避免 KvStore 全量拉出再在 Node 内存排序的 O(N) 问题.
 */
export const kpiSnapshot = pgTable(
  'KpiSnapshot',
  {
    id: text('id').primaryKey(),
    kpiId: text('kpiId').notNull(),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    cumulativeValue: numeric('cumulativeValue', { precision: 18, scale: 4 }).notNull(),
    /** erp | manual | pending */
    source: text('source').notNull().default('erp'),
    /** 多维分解 JSON, e.g. { "productA": 100, "productB": 200 } */
    breakdown: jsonb('breakdown'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    /** 时序主查询索引: 按 kpiId 拿时间段数据 */
    kpiDateIdx: index('KpiSnapshot_kpiId_date_idx').on(t.kpiId, t.date),
    /** 唯一约束: 一条 KPI 每日只有一条快照 */
    kpiDateUniq: uniqueIndex('KpiSnapshot_kpiId_date_uniq').on(t.kpiId, t.date),
    tenantDateIdx: index('KpiSnapshot_tenantId_date_idx').on(t.tenantId, t.date),
  }),
);

/**
 * KpiManualEntry · 通道 C 人工补录审计记录
 *
 * CHARTER §2.1: 人工补录必须留记录 + reason + 可选 evidenceUrl.
 * 财务/HR/内勤操作, 高管和被考核人不能操作.
 */
export const kpiManualEntry = pgTable(
  'KpiManualEntry',
  {
    id: text('id').primaryKey(),
    kpiId: text('kpiId').notNull(),
    operatorId: text('operatorId').notNull(),
    /** finance | hr | internal_staff */
    operatorRole: text('operatorRole').notNull(),
    fromValue: numeric('fromValue', { precision: 18, scale: 4 }).notNull(),
    toValue: numeric('toValue', { precision: 18, scale: 4 }).notNull(),
    reason: text('reason').notNull(),
    evidenceUrl: text('evidenceUrl'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    /** 审计查询: 某 KPI 的全部人工操作历史 */
    kpiOperatorIdx: index('KpiManualEntry_kpiId_operatorId_idx').on(t.kpiId, t.operatorId),
    kpiCreatedIdx: index('KpiManualEntry_kpiId_createdAt_idx').on(t.kpiId, t.createdAt),
    tenantIdx: index('KpiManualEntry_tenantId_idx').on(t.tenantId),
  }),
);

/**
 * KpiBonusPayout · 年终奖金计算结果 (CHARTER §5 M3)
 *
 * committed=false = draft 预估; committed=true = 已下发, 不可撤回.
 */
export const kpiBonusPayout = pgTable(
  'KpiBonusPayout',
  {
    id: text('id').primaryKey(),
    cycleId: text('cycleId').notNull(),
    assigneeId: text('assigneeId').notNull(),
    baseBonus: numeric('baseBonus', { precision: 18, scale: 2 }).notNull(),
    weightedCompletion: numeric('weightedCompletion', { precision: 6, scale: 4 }).notNull(),
    finalBonus: numeric('finalBonus', { precision: 18, scale: 2 }).notNull(),
    /** JSON: KpiBonusContribution[] */
    contributions: jsonb('contributions').notNull().default([]),
    calculatedAt: timestamp('calculatedAt', { precision: 3, mode: 'date' }).notNull(),
    calculatedBy: text('calculatedBy').notNull(),
    committed: boolean('committed').notNull().default(false),
    committedAt: timestamp('committedAt', { precision: 3, mode: 'date' }),
    note: text('note'),
    tenantId: text('tenantId').notNull().default('default'),
  },
  (t) => ({
    cycleAssigneeIdx: index('KpiBonusPayout_cycleId_assigneeId_idx').on(t.cycleId, t.assigneeId),
    committedIdx: index('KpiBonusPayout_committed_cycleId_idx').on(t.committed, t.cycleId),
    tenantIdx: index('KpiBonusPayout_tenantId_idx').on(t.tenantId),
  }),
);

/**
 * KpiCausalLink · BSC 战略地图因果链 (B-019)
 *
 * 建模"学习与成长 → 内部流程 → 客户 → 财务"的跨维度假设验证.
 * fromKpiId 是"驱动因", toKpiId 是"结果果".
 * validated=true 表示经年终复盘确认因果成立.
 *
 * isCausalDirectionValid() 见 lib/kpi/bsc-validation.ts — 仅允许
 * growth→process/customer/financial, process→customer/financial, customer→financial.
 */
export const kpiCausalLink = pgTable(
  'KpiCausalLink',
  {
    id: text('id').primaryKey(),
    cycleId: text('cycleId').notNull(),
    fromKpiId: text('fromKpiId').notNull(),
    toKpiId: text('toKpiId').notNull(),
    /** 因果关系置信强度: 0.0-1.0 (由 HR/高管主观打分, 年终可用数据修正) */
    strength: numeric('strength', { precision: 4, scale: 3 }).notNull().default('0.5'),
    /** 假设描述, e.g. "技能提升 → 交付效率提升 → NPS 上升" */
    hypothesis: text('hypothesis'),
    /** true = 年终复盘后数据验证成立 */
    validated: boolean('validated').notNull().default(false),
    validatedAt: timestamp('validatedAt', { precision: 3, mode: 'date' }),
    validatedBy: text('validatedBy'),
    /** 验证注记 (复盘结论摘要) */
    validationNote: text('validationNote'),
    tenantId: text('tenantId').notNull().default('default'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    /** 拓扑构建查询: 一个周期内从某 KPI 出发的所有下游 */
    fromCycleIdx: index('KpiCausalLink_fromKpiId_cycleId_idx').on(t.fromKpiId, t.cycleId),
    /** 反向查询: 某 KPI 被哪些 KPI 驱动 */
    toCycleIdx: index('KpiCausalLink_toKpiId_cycleId_idx').on(t.toKpiId, t.cycleId),
    /** 防重: 同周期同一对 KPI 只能有一条因果链 */
    linkUniq: uniqueIndex('KpiCausalLink_from_to_cycle_uniq').on(t.fromKpiId, t.toKpiId, t.cycleId),
    tenantIdx: index('KpiCausalLink_tenantId_idx').on(t.tenantId),
  }),
);

/**
 * KpiTargetAmendment · 目标修订签批流
 *
 * KpiCycle.targetsLockedAt 后 targetValue 不可直接编辑, 唯一合法变更通道是这里:
 * 提交申请 → owner/admin 审批 → approve 时才真正改写 Kpi.targetValue。
 */
export const kpiTargetAmendment = pgTable(
  'KpiTargetAmendment',
  {
    id: text('id').primaryKey(),
    kpiId: text('kpiId').notNull(),
    cycleId: text('cycleId').notNull(),
    requestedBy: text('requestedBy').notNull(),
    fromTargetValue: numeric('fromTargetValue', { precision: 18, scale: 4 }).notNull(),
    toTargetValue: numeric('toTargetValue', { precision: 18, scale: 4 }).notNull(),
    reason: text('reason').notNull(),
    /** pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    reviewedBy: text('reviewedBy'),
    reviewedAt: timestamp('reviewedAt', { precision: 3, mode: 'date' }),
    reviewNote: text('reviewNote'),
    tenantId: text('tenantId').notNull().default('default'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    kpiStatusIdx: index('KpiTargetAmendment_kpiId_status_idx').on(t.kpiId, t.status),
    cycleIdx: index('KpiTargetAmendment_cycleId_idx').on(t.cycleId, t.tenantId),
    statusTenantIdx: index('KpiTargetAmendment_status_tenant_idx').on(t.status, t.tenantId),
  }),
);

/**
 * AgentTemplate · 分身编队 (B-037) 基础 Agent 模板 — 强类型表 (不走 KvStore)
 *
 * 公司资产: 员工从模板 fork 技能分身。双轨来源 (internal 策展 / external_market 引入)。
 * 详见 docs/PERSONA-SQUAD-ARCHITECTURE.md §3.1 + 迁移 0010。
 * CHECK 约束 (origin / status 枚举) 在迁移 SQL 中以幂等 DO 块施加。
 */
export const agentTemplate = pgTable(
  'AgentTemplate',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    name: text('name').notNull(),
    /** 专业域: design|pm|tech|marketing|strategy|finance|sales|hr|legal|... */
    specialty: text('specialty').notNull(),
    /** internal | external_market */
    origin: text('origin').notNull().default('internal'),
    /** 外部市场来源标识 (origin='external_market' 时) */
    externalRef: text('externalRef'),
    basePrompt: text('basePrompt').notNull(),
    /** string[] 初始 enabledSkills */
    defaultSkills: jsonb('defaultSkills').notNull().default([]),
    /** string[] 知识/记忆检索标签 */
    defaultKnowledgeTags: jsonb('defaultKnowledgeTags').notNull().default([]),
    /** draft | published | archived */
    status: text('status').notNull().default('draft'),
    createdBy: text('createdBy').notNull(),
    /** 外部 import 必填 (经 §19 出站 + skill-gateway 审查) */
    reviewedBy: text('reviewedBy'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    /** 市场列表主查询: 某租户下按状态 (published) 过滤 */
    tenantStatusIdx: index('AgentTemplate_tenantId_status_idx').on(t.tenantId, t.status),
    /** 按专业域浏览 */
    tenantSpecialtyIdx: index('AgentTemplate_tenantId_specialty_idx').on(t.tenantId, t.specialty),
    /** 外部来源审查队列 */
    originIdx: index('AgentTemplate_origin_idx').on(t.origin, t.status),
    /** 同租户模板名唯一 (策展库完整性, 防歧义 fork) */
    nameUniq: uniqueIndex('AgentTemplate_tenantId_name_uniq').on(t.tenantId, t.name),
  }),
);

// ============================================================================
// PMS (项目报备全生命周期管理) Typed Tables
// 方案 A: 全 Typed Tables 架构（世界级百万级数据支持）
// ============================================================================

/**
 * pms_opportunities · 商机报备
 * 核心业务实体，支持百万级数据查询
 */
export const pmsOpportunities = pgTable(
  'pms_opportunities',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId').notNull(),
    dealerOrgId: text('dealerOrgId').notNull(),
    // 项目型销售: 归属项目 (一个项目可挂多条报价/竞标商机)
    projectId: text('projectId'),
    reporterId: text('reporterId').notNull(),
    customerName: text('customerName').notNull(),
    customerPhone: text('customerPhone'),
    customerAddress: text('customerAddress'),
    // 销售关键信息补充 (2026-07 增补)
    contactName: text('contactName'),
    contactTitle: text('contactTitle'),
    leadSource: text('leadSource'),
    competitors: jsonb('competitors'),
    customerIndustry: text('customerIndustry'),
    projectName: text('projectName').notNull(),
    stage: text('stage').notNull().default('initial_contact'),
    status: text('status').notNull().default('active'),
    estimatedAmount: numeric('estimatedAmount'),
    estimatedClosingDate: text('estimatedClosingDate'),
    productLine: text('productLine'),
    // 结构化产品选型 (引用 pms_product_catalog)
    productSeries: text('productSeries'),
    productSeriesCode: text('productSeriesCode'),
    productModel: text('productModel'),
    productModelCode: text('productModelCode'),
    productCatalogId: text('productCatalogId'),
    productCategory: text('productCategory'),
    productAttributes: jsonb('productAttributes'),
    region: text('region'),
    channel: text('channel'),
    dedupeKey: text('dedupeKey').notNull(),
    duplicateStatus: text('duplicateStatus'),
    // 报备审核关卡 (2026-07 增补): pending_review → approved / rejected
    reviewStatus: text('reviewStatus').notNull().default('approved'),
    reviewedBy: text('reviewedBy'),
    reviewedAt: timestamp('reviewedAt', { precision: 3, mode: 'date' }),
    reviewNote: text('reviewNote'),
    lastFollowUpAt: timestamp('lastFollowUpAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    // 高频查询索引（支持百万级过滤）
    orgIdStatusStageIdx: index('pms_opp_orgid_status_stage_idx').on(t.orgId, t.status, t.stage),
    dedupeKeyIdx: uniqueIndex('pms_opp_dedupkey_idx').on(t.dedupeKey),
    dealerStageIdx: index('pms_opp_dealer_stage_idx').on(t.dealerOrgId, t.stage, t.createdAt),
    projectIdx: index('pms_opp_project_idx').on(t.projectId),
    // 预警扫描索引
    alertScanIdx: index('pms_opp_alert_scan_idx').on(t.lastFollowUpAt, t.status),
    // 分析查询复合索引
    analyticsIdx: index('pms_opp_analytics_idx').on(
      t.tenantId, t.orgId, t.stage, t.status, t.region, t.productLine, t.createdAt
    ),
    tenantIdx: index('pms_opp_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_follow_ups · 跟进记录
 * 时间序列数据，支持高频写入
 */
export const pmsFollowUps = pgTable(
  'pms_follow_ups',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    opportunityId: text('opportunityId').notNull(),
    userId: text('userId').notNull(),
    stage: text('stage').notNull(),
    content: text('content').notNull(),
    nextFollowUpAt: timestamp('nextFollowUpAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    // 时间序列索引（按商机ID + 时间倒序）
    oppTimeIdx: index('pms_followup_opp_time_idx').on(t.opportunityId, t.createdAt),
    tenantIdx: index('pms_followup_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_duplicate_checks · 查重记录
 * 存储查重结果，支持撞单仲裁
 */
export const pmsDuplicateChecks = pgTable(
  'pms_duplicate_checks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    opportunityId: text('opportunityId').notNull(),
    duplicateOpportunityId: text('duplicateOpportunityId'),
    similarityScore: numeric('similarityScore').notNull(),
    dimensions: jsonb('dimensions').notNull(),
    status: text('status').notNull().default('pending'),
    resolvedBy: text('resolvedBy'),
    resolvedAt: timestamp('resolvedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    oppIdx: index('pms_dupcheck_opp_idx').on(t.opportunityId),
    statusIdx: index('pms_dupcheck_status_idx').on(t.status),
    tenantIdx: index('pms_dupcheck_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_duplicate_appeals · 撞单申诉
 * 支持撞单仲裁流程
 */
export const pmsDuplicateAppeals = pgTable(
  'pms_duplicate_appeals',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    duplicateCheckId: text('duplicateCheckId').notNull(),
    appealerId: text('appealerId').notNull(),
    reason: text('reason').notNull(),
    evidence: jsonb('evidence'),
    status: text('status').notNull().default('pending'),
    arbitratedBy: text('arbitratedBy'),
    arbitrationResult: text('arbitrationResult'),
    arbitrationReason: text('arbitrationReason'),
    arbitratedAt: timestamp('arbitratedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    checkIdx: index('pms_appeal_check_idx').on(t.duplicateCheckId),
    statusIdx: index('pms_appeal_status_idx').on(t.status),
    tenantIdx: index('pms_appeal_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_public_pool · 公海池
 * 支持商机流转和认领
 */
export const pmsPublicPool = pgTable(
  'pms_public_pool',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    opportunityId: text('opportunityId').notNull(),
    releasedBy: text('releasedBy').notNull(),
    releasedReason: text('releasedReason').notNull(),
    releasedAt: timestamp('releasedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    claimed: boolean('claimed').notNull().default(false),
    claimedBy: text('claimedBy'),
    claimedAt: timestamp('claimedAt', { precision: 3, mode: 'date' }),
    protectionExpiresAt: timestamp('protectionExpiresAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    // 公海池认领查询
    releasedIdx: index('pms_pool_released_idx').on(t.releasedAt, t.claimed),
    oppIdx: index('pms_pool_opp_idx').on(t.opportunityId),
    tenantIdx: index('pms_pool_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_approvals · 审批记录
 * 支持多级审批流程
 */
export const pmsApprovals = pgTable(
  'pms_approvals',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    level: integer('level').notNull(),
    approverId: text('approverId').notNull(),
    status: text('status').notNull().default('pending'),
    decision: text('decision'),
    comment: text('comment'),
    decidedAt: timestamp('decidedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('pms_approval_entity_idx').on(t.entityType, t.entityId),
    approverIdx: index('pms_approval_approver_idx').on(t.approverId, t.status),
    tenantIdx: index('pms_approval_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_price_applications · 价格申请
 * 支持折扣审批流程
 */
export const pmsPriceApplications = pgTable(
  'pms_price_applications',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    opportunityId: text('opportunityId').notNull(),
    applicantId: text('applicantId').notNull(),
    productId: text('productId').notNull(),
    listPrice: numeric('listPrice').notNull(),
    requestedPrice: numeric('requestedPrice').notNull(),
    discountRate: numeric('discountRate').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    approvedPrice: numeric('approvedPrice'),
    approvedBy: text('approvedBy'),
    approvedAt: timestamp('approvedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    oppIdx: index('pms_price_opp_idx').on(t.opportunityId),
    statusIdx: index('pms_price_status_idx').on(t.status),
    tenantIdx: index('pms_price_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_contracts · 合同管理
 * 支持合同签订和审批
 */
export const pmsContracts = pgTable(
  'pms_contracts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    opportunityId: text('opportunityId').notNull(),
    contractNumber: text('contractNumber').notNull(),
    customerName: text('customerName').notNull(),
    totalAmount: numeric('totalAmount').notNull(),
    signedDate: text('signedDate'),
    effectiveDate: text('effectiveDate'),
    expiryDate: text('expiryDate'),
    status: text('status').notNull().default('draft'),
    signedBy: text('signedBy'),
    approvedBy: text('approvedBy'),
    approvedAt: timestamp('approvedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    oppIdx: index('pms_contract_opp_idx').on(t.opportunityId),
    numberIdx: uniqueIndex('pms_contract_number_idx').on(t.contractNumber),
    statusIdx: index('pms_contract_status_idx').on(t.status),
    tenantIdx: index('pms_contract_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_delivery_orders · 交付工单
 * 支持设备交付全流程管理
 */
export const pmsDeliveryOrders = pgTable(
  'pms_delivery_orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId').notNull(),
    contractId: text('contractId').notNull(),
    orderNumber: text('orderNumber').notNull(),
    customerName: text('customerName').notNull(),
    deliveryAddress: text('deliveryAddress').notNull(),
    status: text('status').notNull().default('pending'),
    scheduledDeliveryDate: text('scheduledDeliveryDate'),
    actualDeliveryDate: text('actualDeliveryDate'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    orgStatusIdx: index('pms_delivery_org_status_idx').on(t.orgId, t.status, t.createdAt),
    contractIdx: index('pms_delivery_contract_idx').on(t.contractId),
    numberIdx: uniqueIndex('pms_delivery_number_idx').on(t.orderNumber),
    tenantIdx: index('pms_delivery_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_delivery_tasks · 交付任务
 * 支持交付工单的子任务管理
 */
export const pmsDeliveryTasks = pgTable(
  'pms_delivery_tasks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    deliveryOrderId: text('deliveryOrderId').notNull(),
    type: text('type').notNull(),
    assignedTo: text('assignedTo').notNull(),
    assigneeType: text('assigneeType').notNull(),
    description: text('description').notNull(),
    dueDate: text('dueDate'),
    status: text('status').notNull().default('pending'),
    completedAt: timestamp('completedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    orderIdx: index('pms_task_order_idx').on(t.deliveryOrderId),
    assigneeIdx: index('pms_task_assignee_idx').on(t.assignedTo, t.status),
    tenantIdx: index('pms_task_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_equipment_sns · 设备SN码
 * 支持设备全生命周期追溯
 */
export const pmsEquipmentSns = pgTable(
  'pms_equipment_sns',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    snCode: text('snCode').notNull(),
    productId: text('productId').notNull(),
    productModel: text('productModel').notNull(),
    batchNumber: text('batchNumber'),
    manufacturedAt: text('manufacturedAt'),
    parentSNId: text('parentSNId'),
    deliveryOrderId: text('deliveryOrderId'),
    status: text('status').notNull().default('in_stock'),
    installedAt: text('installedAt'),
    warrantyExpiresAt: text('warrantyExpiresAt'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    snCodeIdx: uniqueIndex('pms_sn_code_idx').on(t.snCode),
    batchStatusIdx: index('pms_sn_batch_status_idx').on(t.batchNumber, t.status),
    deliveryIdx: index('pms_sn_delivery_idx').on(t.deliveryOrderId),
    tenantIdx: index('pms_sn_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_maintenance_records · 维保记录
 * 支持设备维保全流程
 */
export const pmsMaintenanceRecords = pgTable(
  'pms_maintenance_records',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    equipmentSNId: text('equipmentSNId').notNull(),
    type: text('type').notNull(),
    reportedBy: text('reportedBy').notNull(),
    assignedTo: text('assignedTo'),
    description: text('description').notNull(),
    status: text('status').notNull().default('pending'),
    scheduledAt: timestamp('scheduledAt', { precision: 3, mode: 'date' }),
    completedAt: timestamp('completedAt', { precision: 3, mode: 'date' }),
    customerFeedback: text('customerFeedback'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    snIdx: index('pms_maint_sn_idx').on(t.equipmentSNId),
    statusIdx: index('pms_maint_status_idx').on(t.status),
    expiryIdx: index('pms_maint_expiry_idx').on(t.scheduledAt, t.status),
    tenantIdx: index('pms_maint_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_dealer_org_profiles · 经销商组织档案
 * 扩展 organizations 表的经销商专属信息
 */
export const pmsDealerOrgProfiles = pgTable(
  'pms_dealer_org_profiles',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId').notNull(),
    contactName: text('contactName'),
    contactPhone: text('contactPhone'),
    contactEmail: text('contactEmail'),
    businessLicense: text('businessLicense'),
    registeredCapital: numeric('registeredCapital'),
    establishedDate: text('establishedDate'),
    coverageRegions: jsonb('coverageRegions').default([]),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    orgIdx: uniqueIndex('pms_dealer_org_idx').on(t.orgId),
    tenantIdx: index('pms_dealer_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_dealer_qualifications · 经销商资质
 * 支持五类资质管理
 */
export const pmsDealerQualifications = pgTable(
  'pms_dealer_qualifications',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    dealerOrgId: text('dealerOrgId').notNull(),
    type: text('type').notNull(),
    certificateNumber: text('certificateNumber'),
    issuedBy: text('issuedBy'),
    issuedDate: text('issuedDate'),
    expiryDate: text('expiryDate'),
    status: text('status').notNull().default('pending'),
    approvedBy: text('approvedBy'),
    approvedAt: timestamp('approvedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    dealerIdx: index('pms_qual_dealer_idx').on(t.dealerOrgId),
    typeIdx: index('pms_qual_type_idx').on(t.type, t.status),
    expiryIdx: index('pms_qual_expiry_idx').on(t.expiryDate, t.status),
    tenantIdx: index('pms_qual_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_product_catalog · 产品目录
 * 导入驱动设计，支持从外部系统导入
 */
export const pmsProductCatalog = pgTable(
  'pms_product_catalog',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    series: text('series').notNull(),
    seriesCode: text('seriesCode'),
    model: text('model').notNull(),
    modelCode: text('modelCode'),
    category: text('category'),
    specification: text('specification'),
    unit: text('unit'),
    listPrice: numeric('listPrice'),
    costPrice: numeric('costPrice'),
    minPrice: numeric('minPrice'),
    bomItems: jsonb('bomItems').default([]),
    parentModel: text('parentModel'),
    attributes: jsonb('attributes').default({}),
    source: text('source').default('manual'),
    sourceRefId: text('sourceRefId'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    seriesCategoryIdx: index('pms_product_series_cat_idx').on(t.series, t.category, t.status),
    modelIdx: index('pms_product_model_idx').on(t.model),
    tenantIdx: index('pms_product_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_quotes · 报价单 (三层文档模型: 方案→系统→明细, systems 存 jsonb)
 * 报价即凭证文档: 改价=新版本(version+1, 旧版 superseded)。
 * 验真: verifyCode 公开查询, 只回真伪+授权经销商 (不露价)。草稿 verifyCode 为空。
 */
export const pmsQuotes = pgTable(
  'pms_quotes',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId').notNull(),
    dealerOrgId: text('dealerOrgId').notNull(),
    opportunityId: text('opportunityId').notNull(),
    projectId: text('projectId'),
    issuerId: text('issuerId').notNull(),
    title: text('title').notNull(),
    customerName: text('customerName').notNull(),
    customerContact: text('customerContact'),
    scenario: text('scenario'),
    systems: jsonb('systems').default([]),
    currency: text('currency').notNull().default('CNY'),
    equipmentTotal: numeric('equipmentTotal').default('0'),
    materialTotal: numeric('materialTotal').default('0'),
    installTotal: numeric('installTotal').default('0'),
    freightTotal: numeric('freightTotal').default('0'),
    taxTotal: numeric('taxTotal').default('0'),
    serviceTotal: numeric('serviceTotal').default('0'),
    otherTotal: numeric('otherTotal').default('0'),
    totalAmount: numeric('totalAmount').default('0'),
    terms: jsonb('terms'),
    validUntil: timestamp('validUntil', { precision: 3, mode: 'date' }),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('draft'),
    verifyCode: text('verifyCode'),
    supersededById: text('supersededById'),
    issuedAt: timestamp('issuedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    opportunityIdx: index('pms_quote_opportunity_idx').on(t.opportunityId, t.status),
    dealerIdx: index('pms_quote_dealer_idx').on(t.dealerOrgId, t.status, t.createdAt),
    verifyIdx: uniqueIndex('pms_quote_verify_idx').on(t.verifyCode),
    tenantIdx: index('pms_quote_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_quote_templates · 报价方案模板库
 * 常用系统方案(系统+明细+条款)存为模板, 建报价时一键套用。
 * 归属: tenantId + orgId (创建组织); isShared=true → 租户内跨组织共享。
 */
export const pmsQuoteTemplates = pgTable(
  'pms_quote_templates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    scenario: text('scenario'),
    description: text('description'),
    systems: jsonb('systems').notNull().default([]),
    terms: jsonb('terms'),
    isShared: boolean('isShared').notNull().default(false),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('pms_quote_tpl_org_idx').on(t.tenantId, t.orgId),
    sharedIdx: index('pms_quote_tpl_shared_idx').on(t.tenantId, t.isShared),
  }),
);

/**
 * pms_selector_rulesets · 选型规则集 (P3 选型配置器, 配置驱动)
 * "研"团队以数据形式维护 inputFields(工况问卷) + rules(选型规则), 业务员填工况 → 引擎产出推荐。
 * inputFields/rules 存 jsonb; 状态 draft/published/archived。软删 archivedAt。
 */
export const pmsSelectorRulesets = pgTable(
  'pms_selector_rulesets',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    name: text('name').notNull(),
    category: text('category'),
    scenario: text('scenario'),
    description: text('description'),
    systemName: text('systemName'),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('draft'),
    inputFields: jsonb('inputFields').notNull().default([]),
    rules: jsonb('rules').notNull().default([]),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    publishedAt: timestamp('publishedAt', { precision: 3, mode: 'date' }),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    statusIdx: index('pms_selector_status_idx').on(t.tenantId, t.status),
    categoryIdx: index('pms_selector_category_idx').on(t.tenantId, t.category),
  }),
);

/**
 * pms_selector_ruleset_versions · 选型规则集已发布版本快照
 * 每次 publish 冻结一份 inputFields+rules 快照, 供审计追溯 / 回滚参考 (不就地覆盖丢历史)。
 */
export const pmsSelectorRulesetVersions = pgTable(
  'pms_selector_ruleset_versions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    rulesetId: text('rulesetId').notNull(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    scenario: text('scenario'),
    systemName: text('systemName'),
    inputFields: jsonb('inputFields').notNull().default([]),
    rules: jsonb('rules').notNull().default([]),
    publishedBy: text('publishedBy').notNull(),
    publishedAt: timestamp('publishedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    rulesetIdx: index('pms_selector_version_ruleset_idx').on(t.tenantId, t.rulesetId),
  }),
);

/**
 * pms_customer_accounts · 客户体系
 * 导入驱动设计，支持层级结构
 */
export const pmsCustomerAccounts = pgTable(
  'pms_customer_accounts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    name: text('name').notNull(),
    externalCode: text('externalCode'),
    type: text('type'),
    parentAccountId: text('parentAccountId'),
    level: integer('level').default(0),
    region: text('region'),
    channel: text('channel'),
    dealerOrgId: text('dealerOrgId'),
    attributes: jsonb('attributes').default({}),
    source: text('source').default('manual'),
    sourceRefId: text('sourceRefId'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    nameIdx: index('pms_customer_name_idx').on(t.name),
    parentIdx: index('pms_customer_parent_idx').on(t.parentAccountId),
    dealerIdx: index('pms_customer_dealer_idx').on(t.dealerOrgId),
    tenantIdx: index('pms_customer_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_alerts · 预警消息
 * 支持分级推送和升级阶梯
 */
export const pmsAlerts = pgTable(
  'pms_alerts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    message: text('message').notNull(),
    targetRole: text('targetRole'),
    targetUserId: text('targetUserId'),
    acted: boolean('acted').notNull().default(false),
    actedBy: text('actedBy'),
    actedAt: timestamp('actedAt', { precision: 3, mode: 'date' }),
    escalationLevel: integer('escalationLevel').default(0),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('pms_alert_entity_idx').on(t.entityType, t.entityId),
    severityIdx: index('pms_alert_severity_idx').on(t.severity, t.acted),
    targetIdx: index('pms_alert_target_idx').on(t.targetUserId, t.acted),
    tenantIdx: index('pms_alert_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_notification_rules · 分级推送规则
 * 支持角色×紧急度×渠道矩阵配置
 */
export const pmsNotificationRules = pgTable(
  'pms_notification_rules',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    name: text('name').notNull(),
    alertType: text('alertType').notNull(),
    severity: text('severity').notNull(),
    targetRole: text('targetRole').notNull(),
    channels: jsonb('channels').notNull().default([]),
    escalationSLA: integer('escalationSLA'),
    enabled: boolean('enabled').notNull().default(true),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    typeIdx: index('pms_notifrule_type_idx').on(t.alertType, t.severity),
    tenantIdx: index('pms_notifrule_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_rebate_policies · 返利政策
 * 支持阶梯规则配置
 */
export const pmsRebatePolicies = pgTable(
  'pms_rebate_policies',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    name: text('name').notNull(),
    productLine: text('productLine'),
    tiers: jsonb('tiers').notNull(),
    effectiveDate: text('effectiveDate').notNull(),
    expiryDate: text('expiryDate'),
    status: text('status').notNull().default('active'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    statusIdx: index('pms_rebate_status_idx').on(t.status),
    tenantIdx: index('pms_rebate_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_rebate_accruals · 返利计提
 * 支持返利计算和结算
 */
export const pmsRebateAccruals = pgTable(
  'pms_rebate_accruals',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    dealerOrgId: text('dealerOrgId').notNull(),
    policyId: text('policyId').notNull(),
    period: text('period').notNull(),
    salesAmount: numeric('salesAmount').notNull(),
    rebateAmount: numeric('rebateAmount').notNull(),
    status: text('status').notNull().default('pending'),
    settledBy: text('settledBy'),
    settledAt: timestamp('settledAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dealerPeriodIdx: index('pms_rebate_acc_dealer_period_idx').on(t.dealerOrgId, t.period),
    statusIdx: index('pms_rebate_acc_status_idx').on(t.status),
    tenantIdx: index('pms_rebate_acc_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_dealer_orders · 经销商订货
 * 支持在线订货流程
 */
export const pmsDealerOrders = pgTable(
  'pms_dealer_orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    dealerOrgId: text('dealerOrgId').notNull(),
    orderNumber: text('orderNumber').notNull(),
    items: jsonb('items').notNull(),
    totalAmount: numeric('totalAmount').notNull(),
    status: text('status').notNull().default('pending'),
    confirmedBy: text('confirmedBy'),
    confirmedAt: timestamp('confirmedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    dealerIdx: index('pms_order_dealer_idx').on(t.dealerOrgId, t.status),
    numberIdx: uniqueIndex('pms_order_number_idx').on(t.orderNumber),
    tenantIdx: index('pms_order_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_dealer_health_scores · 经销商健康分
 * 支持考核算法和自查
 */
export const pmsDealerHealthScores = pgTable(
  'pms_dealer_health_scores',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    dealerOrgId: text('dealerOrgId').notNull(),
    period: text('period').notNull(),
    totalScore: numeric('totalScore').notNull(),
    dimensions: jsonb('dimensions').notNull(),
    rank: text('rank'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    dealerPeriodIdx: uniqueIndex('pms_health_dealer_period_idx').on(t.dealerOrgId, t.period),
    tenantIdx: index('pms_health_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_performance_targets · 业绩目标
 * 支持目标分解和追踪
 */
export const pmsPerformanceTargets = pgTable(
  'pms_performance_targets',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId'),
    dealerOrgId: text('dealerOrgId'),
    // 多维运营轴
    dimension: text('dimension').notNull().default('org'),
    dimensionValue: text('dimensionValue'),
    period: text('period').notNull(),
    periodType: text('periodType').notNull().default('monthly'),
    targetType: text('targetType').notNull(),
    targetValue: numeric('targetValue').notNull(),
    targetCount: numeric('targetCount'),
    actualValue: numeric('actualValue').default('0'),
    actualCount: numeric('actualCount').default('0'),
    achievementRate: numeric('achievementRate').default('0'),
    yoyGrowth: numeric('yoyGrowth'),
    momGrowth: numeric('momGrowth'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    orgPeriodIdx: index('pms_target_org_period_idx').on(t.orgId, t.period),
    dealerPeriodIdx: index('pms_target_dealer_period_idx').on(t.dealerOrgId, t.period),
    dimensionIdx: index('pms_target_dimension_idx').on(t.tenantId, t.dimension, t.period, t.periodType),
    tenantIdx: index('pms_target_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_demand_gen_leads · 线索开发
 * 支持线索漏斗和转化追踪
 */
export const pmsDemandGenLeads = pgTable(
  'pms_demand_gen_leads',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    source: text('source').notNull(),
    customerName: text('customerName').notNull(),
    contactPhone: text('contactPhone'),
    region: text('region'),
    status: text('status').notNull().default('new'),
    assignedTo: text('assignedTo'),
    convertedOpportunityId: text('convertedOpportunityId'),
    convertedAt: timestamp('convertedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    sourceStatusIdx: index('pms_lead_source_status_idx').on(t.source, t.status),
    assignedIdx: index('pms_lead_assigned_idx').on(t.assignedTo),
    tenantIdx: index('pms_lead_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_key_product_campaigns · 主推产品推广
 * 支持推广目标和进展追踪
 */
export const pmsKeyProductCampaigns = pgTable(
  'pms_key_product_campaigns',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    productId: text('productId').notNull(),
    name: text('name').notNull(),
    targetSales: numeric('targetSales').notNull(),
    actualSales: numeric('actualSales').default('0'),
    startDate: text('startDate').notNull(),
    endDate: text('endDate').notNull(),
    status: text('status').notNull().default('active'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    productIdx: index('pms_campaign_product_idx').on(t.productId, t.status),
    dateIdx: index('pms_campaign_date_idx').on(t.startDate, t.endDate),
    tenantIdx: index('pms_campaign_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_equipment_telemetry · 设备遥测数据
 * 支持IoT数据接入和告警
 */
export const pmsEquipmentTelemetry = pgTable(
  'pms_equipment_telemetry',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    snCode: text('snCode').notNull(),
    timestamp: timestamp('timestamp', { precision: 3, mode: 'date' }).notNull(),
    metrics: jsonb('metrics').notNull(),
    alerts: jsonb('alerts').default([]),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    snTimeIdx: index('pms_telemetry_sn_time_idx').on(t.snCode, t.timestamp),
    tenantIdx: index('pms_telemetry_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_customer_feedback · 甲方反馈
 * 支持免登录触点和满意度收集
 */
export const pmsCustomerFeedback = pgTable(
  'pms_customer_feedback',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    snCode: text('snCode'),
    maintenanceRecordId: text('maintenanceRecordId'),
    type: text('type').notNull(),
    rating: integer('rating'),
    comment: text('comment'),
    contactInfo: text('contactInfo'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    snIdx: index('pms_feedback_sn_idx').on(t.snCode),
    maintIdx: index('pms_feedback_maint_idx').on(t.maintenanceRecordId),
    tenantIdx: index('pms_feedback_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_quote_recommendations · AI报价推荐
 * 预留接口，待恒热代码融入
 */
export const pmsQuoteRecommendations = pgTable(
  'pms_quote_recommendations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    opportunityId: text('opportunityId'),
    customerRequirements: jsonb('customerRequirements').notNull(),
    recommendations: jsonb('recommendations').notNull(),
    aiModel: text('aiModel'),
    status: text('status').notNull().default('draft'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (t) => ({
    oppIdx: index('pms_quote_opp_idx').on(t.opportunityId),
    tenantIdx: index('pms_quote_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_projects · 工程项目 (项目型销售核心父对象)
 * 一个项目挂多干系人 + 规格指定矩阵 + 多条报价/竞标商机.
 * 生命周期: lead→design→tender→awarded→delivery→warranty→closed | lost
 */
export const pmsProjects = pgTable(
  'pms_projects',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    orgId: text('orgId').notNull(), // 归属组织 (经销商/内部)
    projectCode: text('projectCode').notNull(), // 项目编号 (租户内唯一)
    projectName: text('projectName').notNull(),
    projectType: text('projectType').notNull().default('new_construction'),
    customerName: text('customerName'),
    customerAccountId: text('customerAccountId'),
    region: text('region'),
    channel: text('channel'),
    address: text('address'),
    addressGeo: jsonb('addressGeo'),
    designInstitute: text('designInstitute'), // 设计院 (快捷字段)
    stage: text('stage').notNull().default('lead'),
    status: text('status').notNull().default('active'),
    estimatedValue: numeric('estimatedValue'),
    ownerId: text('ownerId'), // 项目负责人 userId
    expectedTenderDate: text('expectedTenderDate'),
    expectedAwardDate: text('expectedAwardDate'),
    detectedAt: text('detectedAt'), // 项目发现日期
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    codeIdx: uniqueIndex('pms_project_code_idx').on(t.tenantId, t.projectCode),
    orgStageIdx: index('pms_project_org_stage_idx').on(t.orgId, t.stage, t.status),
    regionIdx: index('pms_project_region_idx').on(t.tenantId, t.region, t.stage),
    tenantIdx: index('pms_project_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_project_stakeholders · 项目干系人 (决策链地图)
 * 角色: owner(甲方)/architect(设计院)/design_engineer(设计工程师)/
 *       general_contractor(总包)/installer(安装商=买家)/distributor(经销商)/consultant/other
 */
export const pmsProjectStakeholders = pgTable(
  'pms_project_stakeholders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    projectId: text('projectId').notNull(),
    role: text('role').notNull(),
    name: text('name').notNull(),
    company: text('company'),
    title: text('title'),
    phone: text('phone'),
    email: text('email'),
    influence: text('influence').notNull().default('medium'), // high/medium/low
    isChampion: boolean('isChampion').notNull().default(false),
    isEconomicBuyer: boolean('isEconomicBuyer').notNull().default(false),
    notes: text('notes'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    projectIdx: index('pms_stakeholder_project_idx').on(t.projectId, t.role),
    tenantIdx: index('pms_stakeholder_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_spec_positions · 规格指定矩阵 (spec-in tracking · 暖通工程命脉)
 * 项目 × 设备族: 我方品牌状态 vs 竞品. 在设计选型阶段"把品牌写进图纸".
 * ourBrandStatus: not_specified/basis_of_design/specified/alternate/substituted/lost
 */
export const pmsSpecPositions = pgTable(
  'pms_spec_positions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    projectId: text('projectId').notNull(),
    equipmentFamily: text('equipmentFamily').notNull(), // 设备族 (冷水机组/空调箱/热泵...)
    ourBrandStatus: text('ourBrandStatus').notNull().default('not_specified'),
    ourProductSeriesCode: text('ourProductSeriesCode'),
    ourProductModel: text('ourProductModel'),
    competitorBrand: text('competitorBrand'),
    competitorModel: text('competitorModel'),
    estimatedValue: numeric('estimatedValue'),
    specStage: text('specStage').notNull().default('design'), // design/tender/awarded
    notes: text('notes'),
    createdBy: text('createdBy').notNull(),
    updatedBy: text('updatedBy'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    projectIdx: index('pms_spec_project_idx').on(t.projectId, t.equipmentFamily),
    statusIdx: index('pms_spec_status_idx').on(t.tenantId, t.ourBrandStatus),
    tenantIdx: index('pms_spec_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_tenders · 招投标记录 (项目型销售投标阶段)
 * FSM: preparing→submitted→opened→won | lost.
 */
export const pmsTenders = pgTable(
  'pms_tenders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    projectId: text('projectId').notNull(),
    tenderNo: text('tenderNo'), // 标段编号
    tenderName: text('tenderName').notNull(),
    tenderType: text('tenderType').notNull().default('open'), // open/invited/competitive_negotiation/single_source
    status: text('status').notNull().default('preparing'),
    bidAmount: numeric('bidAmount'), // 我方投标报价
    budgetAmount: numeric('budgetAmount'), // 招标控制价
    publishedAt: text('publishedAt'),
    submitDeadline: text('submitDeadline'),
    submittedAt: text('submittedAt'),
    openedAt: text('openedAt'),
    winnerName: text('winnerName'),
    ourRank: integer('ourRank'),
    result: text('result'),
    notes: text('notes'),
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    projectIdx: index('pms_tender_project_idx').on(t.projectId, t.status),
    tenantIdx: index('pms_tender_tenant_idx').on(t.tenantId),
  }),
);

/**
 * pms_submittals · 提交物/图纸版本管理
 * 技术方案/图纸/资质/商务标 的版本控制与审批 (supersedesId 链式).
 */
export const pmsSubmittals = pgTable(
  'pms_submittals',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId').notNull().default('default'),
    projectId: text('projectId').notNull(),
    tenderId: text('tenderId'),
    docType: text('docType').notNull().default('drawing'), // drawing/spec/technical_proposal/commercial_bid/qualification/other
    title: text('title').notNull(),
    version: integer('version').notNull().default(1),
    fileUrl: text('fileUrl'),
    status: text('status').notNull().default('draft'), // draft/submitted/approved/rejected/revision_required
    submittedTo: text('submittedTo'),
    submittedAt: text('submittedAt'),
    reviewedBy: text('reviewedBy'),
    reviewedAt: text('reviewedAt'),
    reviewNotes: text('reviewNotes'),
    supersedesId: text('supersedesId'), // 上一版本 id
    createdBy: text('createdBy').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
    archivedAt: timestamp('archivedAt', { precision: 3, mode: 'date' }),
  },
  (t) => ({
    projectIdx: index('pms_submittal_project_idx').on(t.projectId, t.docType),
    tenderIdx: index('pms_submittal_tender_idx').on(t.tenderId),
    tenantIdx: index('pms_submittal_tenant_idx').on(t.tenantId),
  }),
);

// ===========================================================================
// 薪酬绩效模块 comp_* (PRD §13) — 强类型表, 直连访问 (PMS 同款, 不走 TandemStore)
// 列名 snake_case 与 scripts/migrations/2026-comp-tables.mjs 的 DDL 对齐。
// 仅类型元数据; 不触发 DDL (建表由幂等迁移脚本负责, db:push 禁用)。
// ===========================================================================

export const compJobFamily = pgTable('comp_job_family', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  board: text('board').notNull(),
  name: text('name').notNull(),
  jobClass: text('job_class').notNull(),
  sequence: text('sequence').notNull(),
  reachableLevels: jsonb('reachable_levels').notNull().default([]),
  matrixVersion: text('matrix_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_job_family_tenant').on(t.tenantId),
}));

export const compSkillDef = pgTable('comp_skill_def', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  familyId: text('family_id').notNull(),
  name: text('name').notNull(),
  skillWage: integer('skill_wage').notNull().default(0),
  requiredAt: jsonb('required_at').notNull().default([]),
  source: text('source').notNull().default('案例佐证'),
  matrixVersion: text('matrix_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_skill_def_tenant').on(t.tenantId),
  familyIdx: index('idx_comp_skill_def_family').on(t.familyId),
}));

export const compGradeBand = pgTable('comp_grade_band', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  jobClass: text('job_class').notNull(),
  level: text('level').notNull(),
  familyId: text('family_id'),
  education: text('education'),
  experience: text('experience'),
  baseWage: integer('base_wage').notNull().default(0),
  skillWageCached: integer('skill_wage_cached').notNull().default(0),
  skillWageComputedAt: timestamp('skill_wage_computed_at', { withTimezone: true, mode: 'date' }),
  taskRatio: numeric('task_ratio').notNull().default('0'),
  taskWageStd: integer('task_wage_std').notNull().default(0),
  skillStep: integer('skill_step').notNull().default(0),
  taskStep: integer('task_step').notNull().default(0),
  adjustStep: integer('adjust_step').notNull().default(0),
  taskGears: jsonb('task_gears').notNull().default({}),
  title: text('title'),
  monthly: integer('monthly').notNull().default(0),
  annual: integer('annual').notNull().default(0),
  ratio: jsonb('ratio').notNull().default({}),
  matrixVersion: text('matrix_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_grade_band_tenant').on(t.tenantId),
  uq: uniqueIndex('uq_comp_grade_band').on(t.tenantId, t.jobClass, t.level, t.familyId),
}));

export const compMatrixVersion = pgTable('comp_matrix_version', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  version: text('version').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  publishedBy: text('published_by'),
  changelog: text('changelog'),
  status: text('status').notNull().default('draft'),
}, (t) => ({
  tenantIdx: index('idx_comp_matrix_version_tenant').on(t.tenantId),
}));

export const compEmployeeGrade = pgTable('comp_employee_grade', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  employeeId: text('employee_id').notNull(),
  familyId: text('family_id').notNull(),
  jobClass: text('job_class').notNull(),
  currentLevel: text('current_level').notNull(),
  education: text('education'),
  experience: text('experience'),
  baseWageSnapshot: integer('base_wage_snapshot').notNull().default(0),
  taskGear: text('task_gear').notNull().default('D'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true, mode: 'date' }),
  certifiedAgainstVersion: text('certified_against_version').notNull(),
}, (t) => ({
  tenantIdx: index('idx_comp_employee_grade_tenant').on(t.tenantId),
  empIdx: index('idx_comp_employee_grade_emp').on(t.employeeId),
}));

export const compGradeCertification = pgTable('comp_grade_certification', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  employeeId: text('employee_id').notNull(),
  familyId: text('family_id').notNull(),
  skillId: text('skill_id').notNull(),
  status: text('status').notNull().default('待认证'),
  evidence: text('evidence'),
  certifiedAt: timestamp('certified_at', { withTimezone: true, mode: 'date' }),
  certifiedAgainstVersion: text('certified_against_version').notNull(),
}, (t) => ({
  tenantIdx: index('idx_comp_cert_tenant').on(t.tenantId),
  empIdx: index('idx_comp_cert_emp').on(t.employeeId),
  uq: uniqueIndex('uq_comp_cert').on(t.tenantId, t.employeeId, t.skillId, t.certifiedAgainstVersion),
}));

export const compGradeChangeLog = pgTable('comp_grade_change_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  employeeId: text('employee_id').notNull(),
  nodeId: text('node_id').notNull(),
  cycle: text('cycle').notNull(),
  changeType: text('change_type').notNull(),
  fromGrade: text('from_grade'),
  toGrade: text('to_grade'),
  evidenceSnapshot: jsonb('evidence_snapshot').notNull().default({}),
  signatureState: text('signature_state').notNull().default('待签'),
  signedAt: timestamp('signed_at', { withTimezone: true, mode: 'date' }),
  appealState: text('appeal_state').notNull().default('none'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_change_tenant').on(t.tenantId),
  empIdx: index('idx_comp_change_emp').on(t.employeeId),
}));

export const compTaskCommitment = pgTable('comp_task_commitment', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  employeeId: text('employee_id').notNull(),
  familyId: text('family_id').notNull(),
  cycle: text('cycle').notNull(),
  commitmentType: text('commitment_type').notNull(),
  fromGear: text('from_gear'),
  toGear: text('to_gear').notNull(),
  taskWageDelta: integer('task_wage_delta').notNull().default(0),
  reason: text('reason'),
  status: text('status').notNull().default('proposed'),
  proposedBy: text('proposed_by'),
  approvedBy: text('approved_by'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'date' }),
  effectiveTo: timestamp('effective_to', { withTimezone: true, mode: 'date' }),
  evidenceSnapshot: jsonb('evidence_snapshot').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_commit_tenant').on(t.tenantId),
  empIdx: index('idx_comp_commit_emp').on(t.employeeId),
}));

export const compGradeReview = pgTable('comp_grade_review', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  employeeId: text('employee_id').notNull(),
  cycle: text('cycle').notNull(),
  reviewType: text('review_type').notNull(),
  okrPotentialScore: numeric('okr_potential_score'),
  kpiPerformanceScore: numeric('kpi_performance_score'),
  nineBoxRow: integer('nine_box_row'),
  nineBoxCol: integer('nine_box_col'),
  selfScore: numeric('self_score'),
  peerScore: numeric('peer_score'),
  managerScore: numeric('manager_score'),
  sourceWeights: jsonb('source_weights').notNull().default({}),
  review360CycleId: text('review360_cycle_id'),
  outcome: text('outcome'),
  snapshot: jsonb('snapshot').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_review_tenant').on(t.tenantId),
  empIdx: index('idx_comp_review_emp').on(t.employeeId),
  uq: uniqueIndex('uq_comp_review').on(t.tenantId, t.employeeId, t.cycle, t.reviewType),
}));

export const compMonthlySettlement = pgTable('comp_monthly_settlement', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  employeeId: text('employee_id').notNull(),
  period: text('period').notNull(),
  baseWage: integer('base_wage').notNull().default(0),
  skillWage: integer('skill_wage').notNull().default(0),
  taskWage: integer('task_wage').notNull().default(0),
  performance: integer('performance').notNull().default(0),
  attendance: numeric('attendance').notNull().default('1'),
  coefficient: numeric('coefficient').notNull().default('1'),
  gateFlags: jsonb('gate_flags').notNull().default({}),
  basisSnapshot: jsonb('basis_snapshot').notNull().default({}),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_settle_tenant').on(t.tenantId),
  empPeriodIdx: index('idx_comp_settle_emp_period').on(t.employeeId, t.period),
  uq: uniqueIndex('uq_comp_settle').on(t.tenantId, t.employeeId, t.period),
}));

export const compBudgetPool = pgTable('comp_budget_pool', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default'),
  departmentId: text('department_id').notNull(),
  period: text('period').notNull(),
  poolType: text('pool_type').notNull().default('lip'),
  baseAmount: integer('base_amount').notNull().default(0),
  hardCliff: boolean('hard_cliff').notNull().default(true),
  budgetCeiling: integer('budget_ceiling'),
  qualityCoefficient: numeric('quality_coefficient').notNull().default('1'),
  attendanceBasis: text('attendance_basis'),
  params: jsonb('params').notNull().default({}),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_comp_pool_tenant').on(t.tenantId),
  deptPeriodIdx: index('idx_comp_pool_dept_period').on(t.departmentId, t.period),
  uq: uniqueIndex('uq_comp_pool').on(t.tenantId, t.departmentId, t.period, t.poolType),
}));
