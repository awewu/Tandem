'use client';

import { useEffect } from 'react';

/**
 * PWA Service Worker 注册 + 自动更新提示.
 * 挂到 root layout 即可.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[pwa] sw register failed', err);
      });
  }, []);
  return null;
}
