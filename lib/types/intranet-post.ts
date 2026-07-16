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

export interface IntranetAttachment {
  id: string;
  name: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  /** 鉴权后的站内读取地址 */
  url: string;
}

export interface IntranetPost {
  id: string;
  type: IntranetPostType;
  title: string;
  /** Markdown 正文 */
  body: string;
  /** 摘要 (可由 AI 生成或手填; 列表页展示用) */
  summary?: string;
  /** 16:9 封面图；支持 https URL、站内路径或压缩后的 data URL */
  coverImage?: string;
  /** 强制已读 (政策类常用); true 时 readBy 为已读用户 id 集合 */
  mandatoryRead: boolean;
  /** 已读用户 id 列表 */
  readBy: string[];
  /** 打开过文章详情的用户 id 列表；与强制已读确认分开统计 */
  viewedBy?: string[];
  /** 发布时间 ISO; null = 草稿 */
  publishedAt: string | null;
  /** 发布人 (admin/HR userId) */
  publishedBy: string;
  /** 发布时姓名快照；账号迁移或离职后仍保留历史署名 */
  publishedByName?: string;
  /** 取消发布时间 (软删除) */
  archivedAt?: string | null;
  /** 正文附件，按数组顺序在详情页内嵌展示 */
  attachments?: Array<IntranetAttachment | string>;
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
