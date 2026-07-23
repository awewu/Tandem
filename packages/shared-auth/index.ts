/**
 * Shared Dev SSO utility for the Rhautt Nexus platform.
 * All apps on localhost share the same `nx_token` cookie.
 *
 * Usage (client-side):
 *   import { getDevSession, clearDevSession } from '@rhautt/shared-auth';
 *   const session = getDevSession(); // { userId, role, permissions } | null
 *
 * Usage (server-side in Next.js):
 *   import { getServerDevSession } from '@rhautt/shared-auth/server';
 */

export const NX_COOKIE_NAME = 'nx_token';

/**
 * Cookie 作用域属性（生产跨子域 SSO 的关键）。
 * - 本地开发：不设 Domain，SameSite=Lax，cookie 在 localhost 各端口天然共享。
 * - 生产：设 NEXT_PUBLIC_COOKIE_DOMAIN=.rhautt.com（父域），使
 *   dealer.rhautt.com / design.rhautt.com / console.rhautt.com 共享同一登录态；
 *   同时开启 Secure（仅 HTTPS 下发）。
 * 读取顺序兼容 Next(NEXT_PUBLIC_*) 与通用 process.env。
 */
function readEnv(key: string): string | undefined {
  try {
    return typeof process !== 'undefined' ? (process.env?.[key] as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

function cookieScopeAttrs(): string {
  const domain = readEnv('NEXT_PUBLIC_COOKIE_DOMAIN');
  const secure = readEnv('NEXT_PUBLIC_COOKIE_SECURE') === 'true';
  let attrs = 'path=/;SameSite=Lax';
  if (domain) attrs += `;Domain=${domain}`;
  if (secure) attrs += ';Secure';
  return attrs;
}

export interface DevSession {
  userId: string;
  role: string;
  permissions: string[];
  exp: number;
  env: string;
}

/**
 * Read the shared dev session from the nx_token cookie (client-side only).
 */
export function getDevSession(): DevSession | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/(?:^|; )nx_token=([^;]*)/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.env !== 'dev') return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return {
      userId: payload.sub,
      role: payload.role,
      permissions: payload.permissions || [],
      exp: payload.exp,
      env: payload.env,
    };
  } catch {
    return null;
  }
}

/**
 * Clear the shared dev session cookie.
 */
export function clearDevSession(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${NX_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;${cookieScopeAttrs()}`;
}

/**
 * Check if the current session has a specific role.
 */
export function hasRole(role: string): boolean {
  const session = getDevSession();
  if (!session) return false;
  if (session.permissions.includes('*')) return true;
  return session.role === role || session.permissions.includes(role);
}

/**
 * Role constants for type safety.
 */
export const ROLES = {
  ADMIN: 'admin',
  MARKETING: 'marketing',
  SALES: 'sales',
  DESIGNER: 'designer',
  DEALER_OWNER: 'dealer_owner',
} as const;

/**
 * Store the raw JWT in a shared cookie so all apps on the same domain can use it.
 * Use SameSite=Lax so cookies are sent across localhost ports during dev.
 */
export function setToken(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${NX_COOKIE_NAME}=${encodeURIComponent(token)};${cookieScopeAttrs()}`;
}

/**
 * Read the raw JWT from the shared cookie.
 */
export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + NX_COOKIE_NAME + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Clear the shared token cookie.
 */
export function clearToken(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${NX_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;${cookieScopeAttrs()}`;
}

/**
 * 全局「返回门户」悬浮按钮（客户端组件）。各子应用根 layout 引入即可实现
 * 模块 → 统一门户(/hub) 的回程跳转，配合 SSO cookie 免登直达。
 */
export { default as HubReturnButton } from './HubReturnButton';
