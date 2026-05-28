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
const HEADER_REQ_ID = 'x-request-id';

/** Edge-safe 16-hex request id (Web Crypto). */
function genReqId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** \u767d\u540d\u5355: \u4ee5\u8fd9\u4e9b\u524d\u7f00\u5f00\u5934\u7684 /api \u8bf7\u6c42 \u00b7 \u4e0d\u9700 auth */
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/health',
  '/api/integrations/health',
  '/api/llm-health',
];

/** UI 公开路由前缀: 未登录也能访问 (登录注册自身、静态资源) */
const PUBLIC_UI_PREFIXES = [
  '/login',
  '/register',
  '/privacy',
  '/_next/',
  '/favicon',
  '/manifest',
  '/icon',
  '/robots',
  '/sitemap',
  '/brand/',
  '/sw.js',              // PWA service worker · 必须以 JS MIME 公开, 否则浏览器拒绝注册
  '/workbox-',           // (future) workbox 拆分 chunk
  '/.well-known/',       // ACME / Apple App Site Association etc.
];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function isPublicUi(path: string): boolean {
  return PUBLIC_UI_PREFIXES.some((p) => path.startsWith(p));
}

function isDemoAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_DEMO_AUTH !== '0';
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 请求 ID: 复用上游 trace id, 或生成新的
  const reqId = req.headers.get(HEADER_REQ_ID) || genReqId();
  const baseHeaders = new Headers(req.headers);
  baseHeaders.set(HEADER_REQ_ID, reqId);

  function withReqId(res: NextResponse): NextResponse {
    res.headers.set(HEADER_REQ_ID, reqId);
    return res;
  }

  const token = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = token ? await verifyAccessTokenEdge(token) : null;

  // ──────── UI 路由 ────────
  if (!path.startsWith('/api/')) {
    // 公开 UI 路由 (登录/注册/静态资源) 直接放行
    if (isPublicUi(path)) return withReqId(NextResponse.next());

    // 已登录 → 透传
    if (payload) return withReqId(NextResponse.next());

    // 未登录: 重定向到 /login?next=<原路径>
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path + (req.nextUrl.search || ''));
    return withReqId(NextResponse.redirect(url));
  }

  // ──────── /api/* ────────
  if (isPublic(path)) {
    return withReqId(NextResponse.next({ request: { headers: baseHeaders } }));
  }

  if (payload) {
    baseHeaders.set('x-tandem-user-id', payload.sub);
    baseHeaders.set('x-tandem-tenant-id', payload.tenantId);
    baseHeaders.set('x-tandem-roles', payload.roles.join(','));
    return withReqId(NextResponse.next({ request: { headers: baseHeaders } }));
  }

  if (isDemoAllowed()) {
    return withReqId(NextResponse.next({ request: { headers: baseHeaders } }));
  }

  return withReqId(
    NextResponse.json(
      { error: 'unauthenticated', hint: 'login required', requestId: reqId },
      { status: 401 },
    ),
  );
}

export const config = {
  /**
   * 同时拦截 UI 与 /api · 排除 _next 静态资源 / favicon / 公共 brand 资源
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};
