/**
 * Launchpad (跳板入口) types · PRD §3.7
 *
 * 3 categories: business / comm / learning / custom
 * Cards launch external systems (CRM/ERP/IM/Wiki) with optional SSO.
 */

export type LaunchpadCategory = 'business' | 'comm' | 'learning' | 'custom';
export type LaunchpadStatus = 'active' | 'disabled';
export type SsoMode = 'none' | 'oidc' | 'saml' | 'redirect-token' | 'credential-vault';

export interface UnreadAdapterConfig {
  /** 适配器类型: webhook(外部主动推) / poll(定时拉) / none */
  type: 'webhook' | 'poll' | 'none';
  /** 拉取/推送 URL */
  url?: string;
  /** 轮询周期 (秒)，仅 poll 模式 */
  intervalSec?: number;
  /** Bearer / API key (服务端持有，仅 admin 可写) */
  apiKey?: string;
  /** JSONPath 提取计数字段，例 "data.count" */
  countPath?: string;
}

export interface LaunchpadApp {
  id: string;
  category: LaunchpadCategory;
  name: string;
  description: string | null;
  iconUrl: string | null;
  url: string;
  ssoMode: SsoMode;
  /** SSO 模式额外配置 (oidc client_id 等) — 服务端持有 */
  ssoConfig: Record<string, unknown> | null;
  /** 部门可见性: 空数组 = 全员可见; 否则匹配 user.dept ∈ visibleTo */
  visibleTo: string[];
  /** 角色可见性: 空数组 = 不限角色 */
  visibleToRoles: string[];
  /** 显示顺序 */
  order: number;
  /** AI 推荐用关键词 (与 KR/AP 做语义匹配) */
  recommendKeywords: string[];
  /** 未读角标适配器 */
  unreadAdapter: UnreadAdapterConfig | null;
  status: LaunchpadStatus;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchpadClick {
  id: string;
  appId: string;
  userId: string;
  clickedAt: string;
  /** 来源: home / launchpad / search / recommendation */
  source: string;
  tenantId: string;
}

export interface LaunchpadStats {
  appId: string;
  totalClicks: number;
  uniqueUsers: number;
  last7DaysClicks: number;
}

export interface LaunchpadAppWithBadge extends LaunchpadApp {
  /** 当前用户的未读计数 (从适配器或缓存读) */
  unreadCount?: number;
  /** AI 推荐分数 (0-1)，若被推荐 */
  recommendScore?: number;
  /** 推荐理由文案 */
  recommendReason?: string;
}
