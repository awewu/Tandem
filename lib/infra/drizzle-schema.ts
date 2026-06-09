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
