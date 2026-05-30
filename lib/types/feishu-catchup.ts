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
  permissions: {
    read?: string[];
    write?: string[];
  };
  version: number;
  isFolder: boolean;
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
