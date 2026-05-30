'use client';

/**
 * BossAi · 全局挂载入口 (mount once in app/layout.tsx)
 *
 * 提供:
 *  - 浮动按钮 (右下角胶囊)
 *  - 抽屉对话窗 (右侧 420px / mobile 全屏)
 *  - ⌘J 快捷键
 *  - 历史持久化 (localStorage)
 *
 * 任何页面无需引入子组件, 只要 layout 挂了就全应用可用.
 */

import { BossAiFab } from './boss-ai-fab';
import { BossAiDrawer } from './boss-ai-drawer';
import { BossAiWelcome } from './boss-ai-welcome';

export function BossAiMount() {
  return (
    <>
      <BossAiFab />
      <BossAiDrawer />
      <BossAiWelcome />
    </>
  );
}

export { useBossAi, type PendingPrompt } from './use-boss-ai';
export type { ExamplePrompt } from './example-prompts';
