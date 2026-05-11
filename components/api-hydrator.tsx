'use client';

/**
 * ApiHydrator (A2.3 / A4)
 *
 * 在根 layout 挂载, 干两件事:
 *   1. 应用首次启动 (本会话还没拉过 API) → 调 useOneOnOneStore.loadFromApi() + useReview360Store.loadFromApi()
 *      旧 localStorage demo 数据 (D5 已接受) 被丢弃, 真后端数据填入.
 *   2. 顶部一次性 banner: 提示用户 demo 数据已迁移. 点击关闭后 sessionStorage 标记不再显示.
 *
 * 不主动 hydrate /memories /organization (后端尚未完全切, 见 A2-PROGRESS.md).
 */

import { useEffect, useState } from 'react';
import { useOneOnOneStore, useReview360Store } from '@/lib/store';

const BANNER_KEY = 'tandem-a2-banner-dismissed';

export function ApiHydrator() {
  const load1on1 = useOneOnOneStore((s) => s.loadFromApi);
  const hydrated1 = useOneOnOneStore((s) => s._hydrated);
  const load360 = useReview360Store((s) => s.loadFromApi);
  const hydrated360 = useReview360Store((s) => s._hydrated);

  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    // hydrate once
    if (!hydrated1) void load1on1();
    if (!hydrated360) void load360();

    // banner: 仅当 sessionStorage 没有 dismissed 标记时显示
    try {
      if (sessionStorage.getItem(BANNER_KEY) !== '1') {
        setBannerOpen(true);
      }
    } catch {
      // sessionStorage 不可用 (隐私模式等), 忽略
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bannerOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs flex items-center justify-between shadow-sm">
      <span>
        ⚙️ <strong>A2 真后端已接通</strong>:
        1on1 / 360 数据现在存数据库 (PostgreSQL),
        旧 localStorage demo 数据已弃用.
        <span className="ml-2 opacity-70">登录请走 /login (demo 模式默认 demo-user).</span>
      </span>
      <button
        type="button"
        className="ml-4 px-2 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40"
        onClick={() => {
          try {
            sessionStorage.setItem(BANNER_KEY, '1');
          } catch {
            // ignore
          }
          setBannerOpen(false);
        }}
      >
        知道了 ✕
      </button>
    </div>
  );
}
