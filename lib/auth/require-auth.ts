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
 * Demo 模式 (ALLOW_DEMO_AUTH=1):
 *   未登录时回退到 demo 用户 'demo-user' / tenant 'default' / roles=['admin'].
 *   生产环境必须不设 ALLOW_DEMO_AUTH (或 =0).
 */

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ACCESS, verifyAccessToken } from './session';

export interface AuthContext {
  userId: string;
  email: string;
  tenantId: string;
  roles: string[];
  mfaVerified: boolean;
  /** 是否走的 demo 回退 (e2e/dev 用) */
  demo: boolean;
}

const DEMO_FALLBACK: AuthContext = {
  userId: 'demo-user',
  email: 'demo@tandem.local',
  tenantId: 'default',
  roles: ['admin', 'manager', 'employee', 'champion', 'steward'],
  mfaVerified: false,
  demo: true,
};

function isDemoAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_DEMO_AUTH !== '0';
}

/**
 * 必须登录: 返回 AuthContext 或 401 NextResponse.
 * 调用方 `if (auth instanceof NextResponse) return auth;`
 */
export function requireAuth(req: NextRequest): AuthContext | NextResponse {
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) {
    if (isDemoAllowed()) return DEMO_FALLBACK;
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return {
    userId: payload.sub,
    email: payload.email,
    tenantId: payload.tenantId ?? 'default',
    roles: payload.roles ?? [],
    mfaVerified: payload.mfa ?? false,
    demo: false,
  };
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
