/**
 * 全局 auth gate · G1 V1 GA \u963b\u585e\u9879\u4fee\u590d (\u6e90\u4e8e AUDIT-2026-05-10.md \u00a72.1 P1)
 *
 * \u8bbe\u8ba1:
 *   - \u4ec5\u751f\u6548\u4e8e /api/* (UI \u9875\u9762\u4ecd\u4f9d\u8d56\u5404\u81ea\u8def\u7531\u8bbf\u95ee\u63a7\u5236)
 *   - \u767d\u540d\u5355: /api/auth/* (\u767b\u5f55\u672a\u767b\u5f55\u90fd\u8981\u8bbf), /api/health*, /api/integrations/health, /api/llm-health
 *   - demo \u6a21\u5f0f (ALLOW_DEMO_AUTH != '0' \u4e14\u975e production): \u65e0 cookie \u4e5f\u653e\u884c, \u7531 requireAuth fallback
 *   - \u751f\u4ea7\u6a21\u5f0f: \u65e0\u6709\u6548 access token \u2192 401 (\u9759\u9ed8\u8fd4 JSON, \u4e0d redirect, \u907f\u514d\u7834\u574f API \u8c03\u7528\u65b9)
 *
 * \u4e0e endpoint-level requireAuth \u7684\u5173\u7cfb:
 *   - middleware = \u7b2c\u4e00\u5c42 (\u62e6\u622a anonymous traffic)
 *   - requireAuth = \u7b2c\u4e8c\u5c42 (\u8bb0\u5f55 userId/roles/tenantId \u4f9b\u4e1a\u52a1\u4f7f\u7528)
 *   - \u4e24\u5c42\u90fd\u8981, \u907f\u514d single point of failure
 *
 * Edge runtime: \u4f9d\u8d56 lib/auth/session-edge.ts (Web Crypto), \u4e0d\u80fd import Node crypto.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessTokenEdge } from '@/lib/auth/session-edge';

const COOKIE_ACCESS = 'tandem_at';

/** \u767d\u540d\u5355: \u4ee5\u8fd9\u4e9b\u524d\u7f00\u5f00\u5934\u7684 /api \u8bf7\u6c42 \u00b7 \u4e0d\u9700 auth */
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/health',
  '/api/integrations/health',
  '/api/llm-health',
];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function isDemoAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_DEMO_AUTH !== '0';
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // \u4ec5\u51fa\u624b /api/*
  if (!path.startsWith('/api/')) return NextResponse.next();
  if (isPublic(path)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = token ? await verifyAccessTokenEdge(token) : null;

  if (payload) {
    // \u6709\u6548 token: \u900f\u4f20\u8eab\u4efd\u4fe1\u606f\u5230\u4e0b\u6e38 (header injection, \u9519\u8eab\u4efd\u88ab requireAuth \u518d\u9a8c)
    const headers = new Headers(req.headers);
    headers.set('x-tandem-user-id', payload.sub);
    headers.set('x-tandem-tenant-id', payload.tenantId);
    headers.set('x-tandem-roles', payload.roles.join(','));
    if (payload.workspaceId) {
      headers.set('x-tandem-workspace-id', payload.workspaceId);
    }
    return NextResponse.next({ request: { headers } });
  }

  if (isDemoAllowed()) {
    // demo \u6a21\u5f0f: \u653e\u884c, \u4e0b\u6e38 requireAuth fallback \u5230 demo-user
    return NextResponse.next();
  }

  // \u751f\u4ea7\u6a21\u5f0f \u00b7 \u65e0 token \u00b7 \u62d2
  return NextResponse.json(
    { error: 'unauthenticated', hint: 'login required' },
    { status: 401 },
  );
}

export const config = {
  /**
   * \u53ea\u751f\u6548\u4e8e /api/* \u00b7 \u907f\u514d\u4e0e \u9875\u9762\u8def\u7531/_next/static \u51b2\u7a81
   */
  matcher: ['/api/:path*'],
};
