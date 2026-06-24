'use client';

/**
 * MobileViewportFixes · iOS 软键盘兜底
 *
 * 安卓靠 viewport 的 interactive-widget=resizes-content 自动处理键盘遮挡;
 * iOS Safari 不 resize 布局视口, 键盘会悬浮盖住底部输入框. 这里用 visualViewport +
 * focusin 兜底: 输入框聚焦后, 等键盘动画落定, 把它滚动到可视区中部.
 *
 * 仅在支持 visualViewport 且为触摸设备时生效, 不影响桌面.
 */

import { useEffect } from 'react';

export function MobileViewportFixes() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      const editable =
        tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable || tag === 'SELECT';
      if (!editable) return;
      // 等键盘弹出与布局稳定 (iOS 键盘动画 ~300ms)
      window.setTimeout(() => {
        try {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          /* ignore */
        }
      }, 320);
    }

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  return null;
}
