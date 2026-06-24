'use client';

/**
 * ScrollRestoration · 记忆并恢复移动端主滚动容器的滚动位置
 *
 * Next App Router 默认的滚动恢复针对 window scroller; 但本应用移动端真正滚动的是
 * <main id="tandem-shell-main">, 故返回上一页 (列表→详情→返回) 时不会回到原位.
 * 这里按 pathname 存取 main.scrollTop, 修复"返回后回到列表顶部"的割裂感.
 *
 * - 进入某路由: 若有记忆值则恢复 (带几帧重试, 等客户端列表渲染出高度), 否则回到顶部.
 * - 离开/滚动时: 持续记录该路由的 scrollTop.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const positions = new Map<string, number>();

export function ScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById('tandem-shell-main');
    if (!el) return;

    const saved = positions.get(pathname);
    if (saved != null && saved > 0) {
      let tries = 0;
      const restore = () => {
        el.scrollTop = saved;
        // 客户端列表可能还没渲染出足够高度 → 重试几帧直到滚动落位
        if (Math.abs(el.scrollTop - saved) > 2 && tries++ < 20) {
          requestAnimationFrame(restore);
        }
      };
      requestAnimationFrame(restore);
    } else {
      el.scrollTop = 0;
    }

    const save = () => positions.set(pathname, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => {
      save();
      el.removeEventListener('scroll', save);
    };
  }, [pathname]);

  return null;
}
