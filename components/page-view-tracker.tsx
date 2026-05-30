'use client';

/**
 * PageViewTracker · 自动埋 page.view
 *
 * §SELF-USE-FIRST priority #2 · 看同事到底在 Tandem 哪些页面停留
 *
 * 挂在 app/layout.tsx, 任何 next/router push/replace 都会重新跑.
 * fire-and-forget, 失败不阻塞.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const enteredAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!pathname) return;
    if (pathname === lastPath.current) return;

    // 上一页 stay duration
    const stayMs = lastPath.current ? Date.now() - enteredAt.current : 0;

    const payload = {
      eventName: 'page.view',
      props: {
        path: pathname,
        prevPath: lastPath.current,
        prevStayMs: stayMs,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      },
    };

    // fire-and-forget · 不 await
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* ignore */ });

    lastPath.current = pathname;
    enteredAt.current = Date.now();
  }, [pathname]);

  return null;
}
