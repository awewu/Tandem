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

'use client';

import { usePathname } from 'next/navigation';
import { BossAiFab } from './boss-ai-fab';
import { BossAiDrawer } from './boss-ai-drawer';
import { BossAiWelcome } from './boss-ai-welcome';
import { BossAiLayoutAdjuster } from './boss-ai-layout-adjuster';

/**
 * §作用域 (2026-05-30): Tandem AI 只在 3 个核心工作页面可用
 *   /tandem · 个人工作台 (主舞台 + 召唤分身)
 *   /okr    · 事半 (目标推进时随手问方向)
 *   /im     · 沟通 (议事/IM 中临门一脚问 AI)
 *
 * 其它页面不挂 FAB / drawer / welcome, 让用户专注页面任务,
 * 避免每个页面都飘 AI 入口造成视觉/认知噪音.
 */
const ALLOWED_PREFIXES = ['/tandem', '/okr', '/im'];

function isAllowed(pathname: string | null): boolean {
  if (!pathname) return false;
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function BossAiMount() {
  const pathname = usePathname();
  if (!isAllowed(pathname)) return null;
  return (
    <>
      <BossAiLayoutAdjuster />
      <BossAiFab />
      <BossAiDrawer />
      <BossAiWelcome />
    </>
  );
}

export { useBossAi, type PendingPrompt } from './use-boss-ai';
export type { ExamplePrompt } from './example-prompts';
export { AskBossButton } from './ask-boss-button';
