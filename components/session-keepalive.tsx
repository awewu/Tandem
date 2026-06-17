'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 会话保活 · 静默续期 access token
 *
 * 背景: access token (tandem_at) 仅 15 分钟硬过期, refresh token (tandem_rt) 30 天.
 *   过去无刷新端点, 15 分钟后 middleware 见 token 失效 → UI 跳 /login (自动登出).
 *
 * 策略:
 *   - 每 13 分钟 (< 15 min TTL) POST /api/auth/refresh, 用 refresh cookie 换发新 access.
 *   - 标签页重新可见时立即续一次 (休眠期间可能已跨过 13 分钟).
 *   - 仅在已登录区域运行 (跳过 /login /register 等公开页, 避免无谓 401).
 *   - refresh 返回 401 = refresh 也失效, 端点已清 cookie, 此处跳登录.
 */

const REFRESH_INTERVAL_MS = 13 * 60 * 1000;
const REFRESH_PATH = '/api/auth/refresh';

// 公开页前缀: 不需要保活 (与 middleware PUBLIC_UI_PREFIXES 对齐的子集)
const PUBLIC_PREFIXES = ['/login', '/register', '/forbidden', '/privacy'];

function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

// 单飞: 同一时刻只允许一个刷新请求, 并发的 401 / 心跳共用同一 promise.
let inFlightRefresh: Promise<boolean> | null = null;

/**
 * 调用 /api/auth/refresh 换发新 token. 返回是否成功 (true=续期成功).
 * 多处并发触发时复用同一在途请求, 避免重复轮转 refresh token.
 */
function refreshOnce(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const res = await fetch(REFRESH_PATH, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

function redirectToLogin(): void {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

// 同源 + /api/ 请求才拦截; 排除 refresh 自身 (防循环) 与登录端点.
function shouldIntercept(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    if (!u.pathname.startsWith('/api/')) return false;
    if (u.pathname === REFRESH_PATH) return false;
    if (u.pathname.startsWith('/api/auth/')) return false;
    return true;
  } catch {
    return false;
  }
}

let fetchPatched = false;

/**
 * 给全局 fetch 套 401 兜底: 同源业务 API 收到 401 时, 刷新一次再重试原请求.
 * 重试仍 401 = refresh 也失效 → 跳登录. 只在客户端打一次补丁.
 */
function installFetchInterceptor(): void {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await originalFetch(input, init);
    if (res.status !== 401) return res;

    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!shouldIntercept(url)) return res;

    const ok = await refreshOnce();
    if (!ok) {
      redirectToLogin();
      return res;
    }
    // 续期成功 → 重试一次原请求 (init 未被消费, 可安全复用)
    return originalFetch(input, init);
  };
}

export function SessionKeepAlive() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    installFetchInterceptor();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isPublicPath(pathname)) return;

    let cancelled = false;

    async function heartbeat() {
      const ok = await refreshOnce();
      if (!cancelled && !ok) redirectToLogin();
    }

    const timer = window.setInterval(heartbeat, REFRESH_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === 'visible') void heartbeat();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  return null;
}
