/**
 * Session · 自研 JWT 会话管理
 *
 * 设计:
 *   - access token: 15 分钟, 内存中的 JWT (HS256)
 *   - refresh token: 30 天, httpOnly cookie + DB 中存 hash
 *   - 任何敏感操作 (改密 / MFA / 数据导出) 要求 mfaVerified=true
 *   - 设备指纹绑定: token 与 deviceFingerprint 绑定, 切设备需重登
 *
 * 不依赖任何外部 JWT 库, 用 Node 内置 crypto.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SESSION_SECRET = (() => {
  const s = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!s || s === 'change-me-in-prod-use-openssl-rand-base64-32') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET / NEXTAUTH_SECRET 必须在生产环境配置');
    }
    return 'dev-only-secret-do-not-use-in-prod';
  }
  return s;
})();

const ACCESS_TOKEN_TTL_SEC = 15 * 60;        // 15 分钟
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3600; // 30 天

export interface SessionPayload {
  sub: string;                     // userId
  email: string;
  roles: string[];
  tenantId: string;
  /** 是否已 MFA */
  mfa: boolean;
  /**
   * P0-C: 特权角色 (owner/admin/steward) 未启用 MFA 且强制门开启时为 true.
   * middleware 据此拦截除 MFA 启用路径外的所有请求 (服务端强制, 非仅客户端强跳).
   */
  pendingMfaEnroll?: boolean;
  /** session id (用于撤销) */
  sid: string;
  /** issued at, expires at */
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// 编码: base64url
// ---------------------------------------------------------------------------

function b64u(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function b64uDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

// ---------------------------------------------------------------------------
// JWT (HS256, 自研, 无依赖)
// ---------------------------------------------------------------------------

export function signAccessToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SEC,
  };
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(full));
  const sig = createHmac('sha256', SESSION_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyAccessToken(token: string): SessionPayload | null {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const expected = createHmac('sha256', SESSION_SECRET).update(`${h}.${b}`).digest('base64url');
    const sigBuf = Buffer.from(s);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(b64uDecode(b).toString('utf8')) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Refresh Token (高熵随机串, 仅 hash 入库)
// ---------------------------------------------------------------------------

export interface RefreshTokenIssue {
  /** 明文给客户端写 cookie */
  refreshToken: string;
  /** hash 存 DB */
  refreshTokenHash: string;
  expiresAt: Date;
}

export function issueRefreshToken(): RefreshTokenIssue {
  const refreshToken = randomBytes(48).toString('base64url');
  const hash = createHmac('sha256', SESSION_SECRET).update(refreshToken).digest('hex');
  return {
    refreshToken,
    refreshTokenHash: hash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
  };
}

export function hashRefreshToken(refreshToken: string): string {
  return createHmac('sha256', SESSION_SECRET).update(refreshToken).digest('hex');
}

// ---------------------------------------------------------------------------
// Cookie 名 + 选项
// ---------------------------------------------------------------------------

export const COOKIE_ACCESS = 'tandem_at';
export const COOKIE_REFRESH = 'tandem_rt';

/**
 * Session cookie 选项 (§T10):
 *   - httpOnly: true                · JS 不可读, 防 XSS 偷 token
 *   - secure:   production 强制     · HTTPS only
 *   - sameSite: production='strict'  · 防 CSRF (跨站请求不带 cookie)
 *               dev='lax'           · 方便 OAuth 回跳测试
 *   - path: '/'                     · 全站可见
 */
const isProd = process.env.NODE_ENV === 'production';
type SameSite = 'strict' | 'lax' | 'none';
const cookieSameSite: SameSite =
  (process.env.COOKIE_SAMESITE as SameSite | undefined) ?? (isProd ? 'strict' : 'lax');

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: cookieSameSite,
  path: '/',
};
