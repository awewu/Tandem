'use client';

/**
 * useBackDismiss · 让浮层(抽屉/模态/底部 sheet)响应「安卓硬件返回键 / 浏览器返回」关闭,
 * 而不是直接后退/退出整个 App —— 这是移动端最违背原生直觉的缺口 (手机没有 Esc 键).
 *
 * 原理 (业界通用 history-trap 范式):
 *   - 浮层打开时 pushState 压入一个"哨兵"历史条目;
 *   - 用户按返回键 → 触发 popstate → 调 onClose() 关闭浮层 (消费掉哨兵);
 *   - 若浮层由其它方式关闭 (点 X / 遮罩 / 选项), cleanup 检测哨兵仍在栈顶 → 补一次 back() 清理,
 *     避免历史栈里堆积空条目.
 *
 * 用法:
 *   useBackDismiss(open, onClose);
 *
 * 注意:
 *   - onClose 用 ref 固定, 故即使父组件传内联箭头函数也不会导致 effect 反复重建 (反复 pushState).
 *   - 对"点链接即导航并关闭"的导航抽屉, 极端情况下返回栈可能多一个同 URL 条目 (多按一次返回),
 *     但行为仍严格优于现状 (现状是按返回直接退出 App). 非导航类浮层无此问题.
 */

import { useEffect, useRef } from 'react';

const SENTINEL = '__tandemOverlay';

export function useBackDismiss(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    window.history.pushState({ [SENTINEL]: true }, '');
    const onPop = () => onCloseRef.current();
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      // 关闭非由返回键触发 → 哨兵仍在栈顶 → 补一次 back 清理
      if (typeof window !== 'undefined' && window.history.state?.[SENTINEL]) {
        window.history.back();
      }
    };
  }, [open]);
}
