'use client';

/**
 * DesktopSession — 桌面端 (Tauri) 长会话 keep-alive.
 *
 * 需求 (§desktop 登录持久化):
 *   - 原则上一直保持登录.
 *   - 连续一周不活跃 (不开应用) → 重新登录.
 *   - 手动退出 → 立即失效 (由 /api/auth/logout 撤销会话).
 *
 * 实现: 仅在 Tauri webview 内运行 (web 端 isTauri()=false, 此组件空转, 不影响 web).
 *   - 应用打开/此组件挂载 → 立即续期一次 (顺延 7 天滑动窗口).
 *   - 每 6 小时定时续期 (远小于 7 天窗口, 活跃期间永不掉线).
 *   - 窗口重新获得焦点 / 标签可见 → 续期 (节流 5 分钟, 避免频繁打扰).
 *
 * web 端不挂 keep-alive 且 /api/auth/refresh 仅认 desktop header → web 维持 24h 现状.
 */

import { useEffect, useRef } from 'react';
import { isTauri, refreshDesktopSession } from '@/lib/desktop/client';

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时
const FOCUS_THROTTLE_MS = 5 * 60 * 1000; // 焦点续期节流 5 分钟

export function DesktopSession() {
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    const doRefresh = () => {
      if (cancelled) return;
      lastRefreshRef.current = Date.now();
      void refreshDesktopSession();
    };

    // 应用打开立即续期一次 (顺延滑动窗口 + 刷新可能临近过期的 access).
    doRefresh();

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
  }, []);

  return null;
}
