'use client';

/**
 * CapacitorShell · 移动端 (Capacitor) 原生能力适配层
 *
 * 在 Capacitor WebView 内生效, web 端空转 (isCapacitor() = false 时所有 effect 无操作).
 * 职责:
 *   1. Android 返回键: 监听 backButton 事件 → history.back() 或退出 App
 *   2. 状态栏: 配置 StatusBar 样式 (深色背景, 不覆盖 WebView)
 *   3. 外部链接: 拦截 target=_blank / 外域链接 → 系统浏览器打开
 *
 * 依赖 @capacitor/app, @capacitor/status-bar, @capacitor/browser — 均为 Capacitor 运行时插件,
 * 在 web 端 import 不报错 (Capacitor 平台检测在 non-native 下 no-op).
 */

import { useEffect } from 'react';
import { isCapacitor } from '@/lib/capacitor/client';

export function CapacitorShell() {
  useEffect(() => {
    if (!isCapacitor()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ App }, { StatusBar, Style }, { Browser }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/browser'),
      ]);

      // 标记 Capacitor 环境, 供 CSS 使用 (状态栏安全区、底部安全区等)
      document.documentElement.classList.add('is-capacitor');

      // 1. 状态栏: 深色背景, 不覆盖 WebView
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0E0E0E' });
        await StatusBar.setOverlaysWebView({ overlay: false });

        // 读取实际状态栏高度并注入 CSS 变量,
        // 解决 server.url 远端模式下 overlaysWebView 偶发不生效的问题.
        const info = await StatusBar.getInfo();
        if (info && typeof info.height === 'number' && info.height > 0) {
          document.documentElement.style.setProperty(
            '--capacitor-status-bar-height',
            `${info.height}px`,
          );
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
  }, []);

  return null;
}
