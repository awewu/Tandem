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
