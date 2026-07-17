'use client';

import { useEffect } from 'react';
import { isCapacitor } from '@/lib/capacitor/client';

/**
 * PWA Service Worker 注册 + 自动更新提示.
 * 挂到 root layout 即可.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isCapacitor()) return;
    if (!('serviceWorker' in navigator)) return;

    const clearTandemCaches = async () => {
      if (!('caches' in window)) return;
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('tandem-')).map((key) => caches.delete(key)));
    };

    if (process.env.NODE_ENV !== 'production') {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        ),
        clearTandemCaches(),
      ]);
      return;
    }

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[pwa] sw register failed', err);
    });
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);
  return null;
}
