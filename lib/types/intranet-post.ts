/**
 * Intranet Post · 公告/政策/大事记/福利 (P3-10)
 *
 * 4 类内容:
 *   - announcement: 公告 (全员广播, 短期时效)
 *   - policy:       政策 (HR/制度, 可强制已读)
 *   - event:        大事记 (公司里程碑, 永久存档)
 *   - benefit:      福利 (体检/团建/餐补, 持续性)
 *
 * 强制已读 (mandatoryRead=true) 用于政策类: 用户首次看到 banner, 未读账户在
 * /intranet 首页持续提醒, 直到点 "我已知晓" 写入 readBy 数组.
 */

export type IntranetPostType = 'announcement' | 'policy' | 'event' | 'benefit';

export interface IntranetPost {
  id: string;
  type: IntranetPostType;
  title: string;
  /** Markdown 正文 */
  body: string;
  /** 摘要 (可由 AI 生成或手填; 列表页展示用) */
  summary?: string;
  /** 强制已读 (政策类常用); true 时 readBy 为已读用户 id 集合 */
  mandatoryRead: boolean;
  /** 已读用户 id 列表 */
  readBy: string[];
  /** 发布时间 ISO; null = 草稿 */
  publishedAt: string | null;
  /** 发布人 (admin/HR userId) */
  publishedBy: string;
  /** 取消发布时间 (软删除) */
  archivedAt?: string | null;
  /** 附件 URL 列表 (Drive 链接) */
  attachments?: string[];
  /** 标签 (e.g. ['Q4-2026', '工程部']) */
  tags?: string[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export const INTRANET_POST_TYPE_LABELS: Record<IntranetPostType, string> = {
  announcement: '公告',
  policy: '政策',
  event: '大事记',
  benefit: '福利',
};
