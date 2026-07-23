/**
 * 飞书功能追赶类型定义 (Feishu Catch-up Types)
 *
 * 文档协作 / 日历会议 / 云盘 / 通知
 */

// ---------------------------------------------------------------------------
// Document (文档协作)
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  title: string;
  content: string;        // Yjs/Tiptap JSON or plain text
  type: 'doc' | 'sheet' | 'slide';
  ownerId: string;
  tenantId: string;
  permissions: {
    read?: string[];     // User.id[]
    write?: string[];    // User.id[]
    publicAccess?: boolean; // true = 同租户所有人可读
  };
  version: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  /**
   * DOC-2 (charter §四 文档板块): 已发起的 Memory 升级 promotion id (反向链接).
   * 防止同一文档重复发起升级提议.
   */
  spawnedPromotionId?: string;
  /**
   * DOC-4 (charter §四 文档板块): 已发起的议事 Decision Card id (反向链接).
   * 防止同一文档重复发起议事.
   */
  spawnedDecisionCardId?: string;
}

// ---------------------------------------------------------------------------
// CalendarEvent (日历/会议)
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;        // ISO 8601
  endAt: string;
  timezone: string;
  allDay: boolean;
  recurringRule?: Record<string, unknown> | null; // RRULE JSON
  ownerId: string;
  attendees: string[];    // User.id[]
  attendeeEmails?: string[];
  externalAttendeeEmails?: string[];
  reminderMinutes?: number | null;
  seriesId?: string | null;
  recurrenceIndex?: number | null;
  location?: string | null;
  meetingUrl?: string | null;
  calendarSource: 'manual' | 'feishu' | 'google' | 'outlook';
  externalId?: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// DriveFile (云盘)
// ---------------------------------------------------------------------------

/**
 * 组织云盘节点角色 (预设目录树语义). 见 lib/drive/provision.ts.
 *   dept_root/ministry_root — 部门/团队根目录
 *   personal_home           — 员工个人主目录 (工作用, 非私人; 私人记事在「搭子手抄」)
 *   dept_share/company_share — 部门/公司共享区
 */
export type DriveNodeRole =
  | 'dept_root'
  | 'ministry_root'
  | 'personal_home'
  | 'dept_share'
  | 'company_share';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;           // bytes
  parentId?: string | null; // folder ID
  ownerId: string;
  tenantId: string;
  storageKey: string;     // MinIO/S3 object key
  storageUrl?: string | null;
  /**
   * ACL. read/write 元素为 principal:
   *   'user:<id>' | 'dept:<id>' | 'ministry:<id>' | 'role:<r>' | 'all'
   * 裸 userId 向后兼容, 按 'user:' 解释 (见 lib/drive/acl.ts normalizePrincipal)。
   * 子节点未显式设权时继承最近祖先目录 ACL (resolveEffectivePermissions)。
   */
  permissions: {
    read?: string[];
    write?: string[];
  };
  version: number;
  isFolder: boolean;
  /** 预设目录树语义标记 (可空 = 普通用户节点) */
  nodeRole?: DriveNodeRole | null;
  /** 是否参与中央 AI 蒸馏 (默认 true; 工作云盘内容属公司, 可蒸馏 → 组织记忆) */
  distillable?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Notification (通知中心)
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  userId: string;         // receiver
  type: 'mention' | 'system' | 'reminder' | 'approval';
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null; // context { docId, eventId, ... }
  readAt?: string | null;
  dismissedAt?: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'in-app' | 'email' | 'sms' | 'push';
  sourceId?: string | null;
  sourceType?: string | null;
  tenantId: string;
  createdAt: string;
}
