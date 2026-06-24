/**
 * lib/oidc/types.ts · OIDC IdP 数据模型 SSOT
 *
 * Tandem 作为标准 OpenID Connect 提供方 (IdP):
 *   - 其他项目通过授权码流程 (Authorization Code + PKCE) 接入
 *   - 组织结构 (部门 / 角色 / 汇报线) 作为标准 claims 下发, 成为公司级共享目录
 *
 * 持久化: KvStore (与 lib/org/departments.ts 同款通用 JSON 表), 多租户隔离.
 */

export type OAuthGrantType = 'authorization_code' | 'refresh_token';
export type OAuthClientType = 'confidential' | 'public';
export type CodeChallengeMethod = 'S256' | 'plain';

/**
 * 已注册的接入方应用 (relying party).
 * client_id = OAuthClient.id.
 */
export interface OAuthClient {
  /** client_id (对外公开) */
  id: string;
  name: string;
  description?: string;
  /** confidential: 服务端应用, 持有 secret; public: SPA/移动端, 仅 PKCE */
  type: OAuthClientType;
  /** sha256(client_secret) hex; public client 为 null */
  secretHash: string | null;
  /** 允许的回调地址 (精确匹配, 防开放重定向) */
  redirectUris: string[];
  /** 登出后允许跳转的地址 (精确匹配) */
  postLogoutRedirectUris: string[];
  /** 该 client 可申请的 scope 白名单 */
  allowedScopes: string[];
  grantTypes: OAuthGrantType[];
  /** true: 受信内部项目, 跳过用户授权同意页 (默认 true) */
  skipConsent: boolean;
  tenantId: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/** 授权码 (一次性, 短时效 ~60s) */
export interface OAuthAuthCode {
  /** code 明文即 id (高熵随机, 一次性消费) */
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  /** 空格分隔 */
  scope: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: CodeChallengeMethod;
  /** 用户完成认证的时刻 (epoch sec), 写入 id_token auth_time */
  authTime: number;
  /** epoch ms */
  expiresAt: number;
  consumed: boolean;
  tenantId: string;
  createdAt: string;
}

/** 刷新令牌 (offline_access scope 时颁发, 旋转策略) */
export interface OAuthRefreshToken {
  /** sha256(refresh_token) hex 即 id (明文不入库) */
  id: string;
  clientId: string;
  userId: string;
  scope: string;
  /** epoch ms */
  expiresAt: number;
  revoked: boolean;
  tenantId: string;
  createdAt: string;
}

/** 支持的 scope 全集 (SSOT) */
export const SUPPORTED_SCOPES = [
  'openid',          // 必选, 触发 OIDC
  'profile',         // name / job_title / updated_at
  'email',           // email / email_verified
  'offline_access',  // 颁发 refresh_token
  'roles',           // Tandem 角色 + tenant
  'org',             // 组织结构: 部门 / 部门路径 / 上级 / 工号
] as const;

export type SupportedScope = (typeof SUPPORTED_SCOPES)[number];

/** 默认授予新 client 的 scope */
export const DEFAULT_CLIENT_SCOPES: string[] = ['openid', 'profile', 'email', 'roles', 'org'];
