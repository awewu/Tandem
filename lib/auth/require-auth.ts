/**
 * requireAuth · A2 endpoint 统一鉴权 wrapper (D4 决策强制)
 *
 * 用法:
 *   export async function GET(req: NextRequest) {
 *     const auth = requireAuth(req);
 *     if (auth instanceof NextResponse) return auth;  // 401
 *     const { userId, tenantId, roles, mfaVerified } = auth;
 *     ...
 *   }
 *
 * Demo 模式 (显式 opt-in, 仅 ALLOW_DEMO_AUTH=1 才开):
 *   未登录时回退到 demo 用户 'demo-user' / tenant 'default' / roles=['admin'].
 *   默认/未设 = 关闭 (走真实登录). 生产环境 (NODE_ENV=production) 无论如何强制关闭.
 */

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ACCESS, verifyAccessToken } from './session';
import { DEMO_FULL_ROLES } from './roles';
import { verifyAccessTokenForApiSync } from '@/lib/oidc/tokens';

export interface AuthContext {
  userId: string;
  email: string;
  tenantId: string;
  roles: string[];
  mfaVerified: boolean;
  authType?: 'cookie' | 'oidc_bearer' | 'demo';
  clientId?: string;
  scopes?: string[];
  /** 是否走的 demo 回退 (e2e/dev 用) */
  demo: boolean;
}

const DEMO_FALLBACK: AuthContext = {
  userId: 'demo-user',
  email: 'demo@tandem.local',
  tenantId: 'default',
  roles: DEMO_FULL_ROLES,
  mfaVerified: false,
  authType: 'demo',
  scopes: [],
  demo: true,
};

function isDemoAllowed(): boolean {
  // 生产环境永远关闭 demo 回退.
  if (process.env.NODE_ENV === 'production') return false;
  // 显式 opt-in: 只有 ALLOW_DEMO_AUTH=1 才开 (默认/未设 = 关), 防误配把 admin 白送.
  return process.env.ALLOW_DEMO_AUTH === '1';
}

function bearer(req: NextRequest): string | null {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) return authz.slice(7).trim();
  return null;
}

function methodNeedsWrite(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function hasAny(scopes: string[], allowed: string[]): boolean {
  return allowed.some((s) => scopes.includes(s));
}

function scopeForPath(path: string, write: boolean): string[] {
  if (path.startsWith('/api/okr/') || path === '/api/tandem-okr' || path.startsWith('/api/tandem-okr/')) {
    return write ? ['api.write', 'okr.write'] : ['api.read', 'okr.read'];
  }
  if (path.startsWith('/api/kpi/')) {
    return write ? ['api.write', 'kpi.write'] : ['api.read', 'kpi.read'];
  }
  return write ? ['api.write'] : ['api.read'];
}

function requireApiScope(req: NextRequest, scopes: string[]): NextResponse | null {
  const required = scopeForPath(req.nextUrl.pathname, methodNeedsWrite(req.method));
  if (hasAny(scopes, required)) return null;
  return NextResponse.json(
    { error: 'insufficient_scope', required, requires: required },
    {
      status: 403,
      headers: { 'WWW-Authenticate': `Bearer error="insufficient_scope", scope="${required.join(' ')}"` },
    },
  );
}

/**
 * 必须登录: 返回 AuthContext 或 401 NextResponse.
 * 调用方 `if (auth instanceof NextResponse) return auth;`
 */
export function requireAuth(req: NextRequest): AuthContext | NextResponse {
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (payload) {
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId ?? 'default',
      roles: payload.roles ?? [],
      mfaVerified: payload.mfa ?? false,
      authType: 'cookie',
      scopes: [],
      demo: false,
    };
  }

  const apiToken = bearer(req);
  const apiPayload = apiToken ? verifyAccessTokenForApiSync(apiToken) : null;
  if (apiPayload) {
    const scopes = (apiPayload.scope ?? '').split(/\s+/).filter(Boolean);
    const forbidden = requireApiScope(req, scopes);
    if (forbidden) return forbidden;
    return {
      userId: apiPayload.sub,
      email: apiPayload.email ?? `${apiPayload.sub}@oidc.local`,
      tenantId: apiPayload.tenant ?? 'default',
      roles: apiPayload.roles ?? [],
      mfaVerified: apiPayload.mfa ?? false,
      authType: 'oidc_bearer',
      clientId: apiPayload.client_id,
      scopes,
      demo: false,
    };
  }

  if (isDemoAllowed()) return DEMO_FALLBACK;
  if (apiToken) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Bearer access token invalid, expired or not enabled for Tandem API access' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } },
    );
  }
  return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
}

/**
 * 角色守卫. 任一 role 命中即可.
 */
export function requireRole(
  ctx: AuthContext,
  allowed: string[]
): NextResponse | null {
  if (ctx.demo) return null; // demo 模式有全角色
  const ok = ctx.roles.some((r) => allowed.includes(r));
  if (!ok) {
    return NextResponse.json({ error: 'forbidden', requires: allowed }, { status: 403 });
  }
  return null;
}
