'use client';

/**
 * MobileSession — 移动端 (Capacitor) 长会话 keep-alive.
 *
 * 与 DesktopSession 同构 (§desktop 登录持久化策略):
 *   - 原则上一直保持登录.
 *   - 连续一周不活跃 (不开应用) → 重新登录.
 *   - 手动退出 → 立即失效.
 *
 * 仅在 Capacitor WebView 内运行 (web 端 isCapacitor()=false, 此组件空转).
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isCapacitor, refreshMobileSession } from '@/lib/capacitor/client';

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FOCUS_THROTTLE_MS = 5 * 60 * 1000;

export function MobileSession() {
  const pathname = usePathname() ?? '';
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    if (!isCapacitor()) return;
    if (pathname === '/login' || pathname.startsWith('/login/') || pathname === '/register' || pathname.startsWith('/register/')) return;

    let cancelled = false;

    const doRefresh = () => {
      if (cancelled) return;
      lastRefreshRef.current = Date.now();
      void refreshMobileSession();
    };

    const interval = setInterval(doRefresh, REFRESH_INTERVAL_MS);

    const onActive = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastRefreshRef.current < FOCUS_THROTTLE_MS) return;
      doRefresh();
    };

    window.addEventListener('focus', onActive);
    document.addEventListener('visibilitychange', onActive);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onActive);
      document.removeEventListener('visibilitychange', onActive);
    };
  }, [pathname]);

  return null;
}
