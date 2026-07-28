'use client';

/**
 * CapacitorShell · 移动端 (Capacitor) 原生能力适配层
 *
 * 在 Capacitor WebView 内生效, web 端空转 (isCapacitor() = false 时所有 effect 无操作).
 * 职责:
 *   1. Android 返回键: 监听 backButton 事件 → history.back() 或退出 App
 *   2. 状态栏: 配置 WebView 覆盖状态栏, 页面 CSS 统一处理安全区
 *   3. 外部链接: 拦截 target=_blank / 外域链接 → 系统浏览器打开
 *
 * 依赖 @capacitor/app, @capacitor/status-bar, @capacitor/browser — 均为 Capacitor 运行时插件,
 * 在 web 端 import 不报错 (Capacitor 平台检测在 non-native 下 no-op).
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isCapacitor } from '@/lib/capacitor/client';

const CAPACITOR_CHUNK_RELOAD_KEY = 'tandem:capacitor-chunk-reload-at';

export function CapacitorShell() {
  const pathname = usePathname() ?? '';
  const isShouchaoRoute = pathname === '/shouchao' || pathname.startsWith('/shouchao/');

  useEffect(() => {
    if (!isCapacitor()) return;

    const clearWebCaches = async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    };

    void clearWebCaches();

    const reloadAfterChunkFailure = (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason ?? '');
      if (!message.includes('ChunkLoadError') && !message.includes('Loading chunk')) return;
      const lastReload = Number(window.sessionStorage.getItem(CAPACITOR_CHUNK_RELOAD_KEY) ?? '0');
      if (Date.now() - lastReload < 10_000) return;
      window.sessionStorage.setItem(CAPACITOR_CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => reloadAfterChunkFailure(event.error ?? event.message);
    const onUnhandledRejection = (event: PromiseRejectionEvent) => reloadAfterChunkFailure(event.reason);

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!isCapacitor()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      // 标记 Capacitor 环境。统一使用 overlay 状态栏并由 CSS 留出安全区;
      // 独立手抄是白底工具型界面, 只切换状态栏颜色和图标风格。
      document.documentElement.classList.add('is-capacitor');
      document.documentElement.classList.add('capacitor-overlay-statusbar');

      // 1. 状态栏
      try {
        await StatusBar.setStyle({ style: isShouchaoRoute ? Style.Light : Style.Dark });
        await StatusBar.setBackgroundColor({ color: isShouchaoRoute ? '#FFFFFF' : '#0E0E0E' });
        await StatusBar.setOverlaysWebView({ overlay: true });

        // Android 原生层会用 density 转换后注入 CSS px。
        // 这里仅做兜底: 如果原生变量尚未注入, 才使用插件返回值。
        const info = await StatusBar.getInfo();
        const currentInset = getComputedStyle(document.documentElement)
          .getPropertyValue('--capacitor-status-bar-height')
          .trim();
        if ((!currentInset || currentInset === '0px') && info && typeof info.height === 'number' && info.height > 0) {
          const fallbackHeight = info.height > 48
            ? Math.round(info.height / Math.max(window.devicePixelRatio || 1, 1))
            : Math.round(info.height);
          document.documentElement.style.setProperty('--capacitor-status-bar-height', `${fallbackHeight}px`);
          document.documentElement.style.setProperty('--capacitor-effective-top-inset', `${fallbackHeight}px`);
        }
      } catch {
        /* iOS may reject some calls */
      }

      // 2. Android 返回键
      const handleBack = ({ canGoBack }: { canGoBack: boolean }) => {
        if (canGoBack) {
          window.history.back();
          return;
        }
        // 无历史 → 退出 App (Android 惯例: 返回键退到桌面)
        void App.exitApp();
      };

      const listener = await App.addListener('backButton', handleBack);

      // 3. 外部链接拦截: 点击 a[target=_blank] 或外域链接 → 系统浏览器
      const onClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement)?.closest('a');
        if (!target) return;
        const href = target.getAttribute('href');
        if (!href) return;
        if (/^https?:\/\//i.test(href)) {
          try {
            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin) {
              e.preventDefault();
              void Browser.open({ url: href, toolbarColor: '#0E0E0E' });
            }
          } catch {
            /* invalid URL, let default handle */
          }
        }
      };
      document.addEventListener('click', onClick, true);

      cleanup = () => {
        listener.remove().catch(() => undefined);
        document.removeEventListener('click', onClick, true);
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [isShouchaoRoute]);

  return null;
}
