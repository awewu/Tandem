'use client';

/**
 * BossAiLayoutAdjuster · drawer 打开时压缩主内容区, 不让 drawer 盖住页面
 *
 * 实现:
 *   - useBossAi().isOpen → toggle body.bossai-open
 *   - CSS (globals.css) 在 md+ 让 <main> padding-right: 420px (drawer 宽度)
 *   - mobile (<md) 不调整: drawer 是全屏覆盖, 主内容自然遮蔽
 *
 * 这样桌面下 drawer 打开后页面不再被遮挡, 而是平滑缩小, 跟 IDE side panel 体验一致.
 */

import { useEffect } from 'react';
import { useBossAi } from './use-boss-ai';

export function BossAiLayoutAdjuster() {
  const { isOpen } = useBossAi();

  useEffect(() => {
    const cls = 'bossai-open';
    if (isOpen) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
    return () => document.body.classList.remove(cls);
  }, [isOpen]);

  return null;
}
