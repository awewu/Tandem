'use client';

/**
 * MobileViewportFixes · iOS 软键盘兜底
 *
 * 移动端软键盘弹出时, 不压缩整个应用壳; 隐藏底部导航并只做就近滚动.
 * 避免 scrollIntoView(center) 把表单整体顶上去, 造成键盘上方大块留白.
 *
 * 仅在支持 visualViewport 且为触摸设备时生效, 不影响桌面.
 */

import { useEffect } from 'react';

export function MobileViewportFixes() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    let focusedEditable: HTMLElement | null = null;
    let clearTimer: number | undefined;

    function isEditable(el: HTMLElement | null): el is HTMLElement {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable || tag === 'SELECT';
    }

    function updateKeyboardInset() {
      if (root.dataset.mobilePreviewKeyboard === 'true') return;
      if (!vv) {
        root.style.setProperty('--visual-keyboard-inset', '0px');
        root.style.setProperty('--visual-viewport-height', `${window.innerHeight}px`);
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--visual-keyboard-inset', `${Math.round(inset)}px`);
      root.style.setProperty('--visual-viewport-height', `${Math.round(vv.height)}px`);
    }

    function isInsideFixedComposer(el: HTMLElement | null): boolean {
      return Boolean(el?.closest('.im-composer-bar'));
    }

    function scrollFocusedIntoView() {
      if (!focusedEditable || isInsideFixedComposer(focusedEditable)) return;
      try {
        focusedEditable.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch {
        /* ignore */
      }
    }

    function markKeyboardOpen() {
      updateKeyboardInset();
      root.classList.add('keyboard-open');
    }

    function maybeMarkKeyboardClosed() {
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        if (root.dataset.mobilePreviewKeyboard === 'true') return;
        if (isEditable(document.activeElement as HTMLElement | null)) return;
        root.classList.remove('keyboard-open');
        root.style.setProperty('--visual-keyboard-inset', '0px');
        root.style.setProperty('--visual-viewport-height', `${window.innerHeight}px`);
        focusedEditable = null;
      }, 120);
    }

    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement | null;
      if (!isEditable(el)) return;
      focusedEditable = el;
      markKeyboardOpen();
      window.setTimeout(scrollFocusedIntoView, 320);
    }

    function onFocusOut() {
      maybeMarkKeyboardClosed();
    }

    function onViewportResize() {
      if (!focusedEditable || !vv) return;
      updateKeyboardInset();
      const keyboardLikelyOpen = vv.height < window.innerHeight - 120;
      if (keyboardLikelyOpen) markKeyboardOpen();
      window.setTimeout(scrollFocusedIntoView, 80);
    }

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', onViewportResize);
    return () => {
      window.clearTimeout(clearTimer);
      root.classList.remove('keyboard-open');
      root.style.setProperty('--visual-keyboard-inset', '0px');
      root.style.setProperty('--visual-viewport-height', `${window.innerHeight}px`);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', onViewportResize);
    };
  }, []);

  return null;
}
