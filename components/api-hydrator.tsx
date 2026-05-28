'use client';

/**
 * ApiHydrator (A2.3 / A4 / P1-1)
 *
 * 在根 layout 挂载, 干两件事:
 *   1. 应用首次启动 (本会话还没拉过 API) → 调 useOneOnOneStore.loadFromApi() + useReview360Store.loadFromApi()
 *      旧 localStorage demo 数据 (D5 已接受) 被丢弃, 真后端数据填入.
 *   2. P1-1: hydrate useMemoryStore 的个人记事本 (供 /chat baseline 注入).
 *   3. 顶部一次性 banner: 提示用户 demo 数据已迁移. 点击关闭后 sessionStorage 标记不再显示.
 */

import { useEffect, useRef, useState } from 'react';
import { useOneOnOneStore, useReview360Store, useMemoryStore, type Memory } from '@/lib/store';
import { useAuthStore } from '@/lib/hooks/use-current-user';

const BANNER_KEY = 'tandem-a2-banner-dismissed';

/** 把后端 MemoryEntry 转 UI Memory (与 /app/memories/page.tsx 的转换一致) */
function entryToUiMemory(e: any): Memory {
  return {
    id: e.id,
    title: e.title ?? '',
    content: e.body ?? '',
    category: (e.uiCategory ?? 'context') as Memory['category'],
    tags: Array.isArray(e.tags) ? e.tags : [],
    priority: (e.priority ?? 'medium') as Memory['priority'],
    createdAt: typeof e.createdAt === 'string' ? new Date(e.createdAt).getTime() : (e.createdAt ?? Date.now()),
    updatedAt: typeof e.updatedAt === 'string' ? new Date(e.updatedAt).getTime() : (e.updatedAt ?? Date.now()),
    version: e.version ?? 1,
    isActive: e.isActive ?? (e.status === 'active'),
    parentId: e.parentId ?? `cat-${e.uiCategory ?? 'context'}`,
  };
}

export function ApiHydrator() {
  const load1on1 = useOneOnOneStore((s) => s.loadFromApi);
  const hydrated1 = useOneOnOneStore((s) => s._hydrated);
  const load360 = useReview360Store((s) => s.loadFromApi);
  const hydrated360 = useReview360Store((s) => s._hydrated);
  const hydrateMemories = useMemoryStore((s) => s.hydrateMemories);
  const user = useAuthStore((s) => s.user);
  const memHydratedRef = useRef(false);

  const [bannerOpen, setBannerOpen] = useState(false);

  // P1-1: 拉个人 memory 注入 zustand, 供 /chat baseline system prompt 用
  useEffect(() => {
    if (memHydratedRef.current || !user?.id) return;
    memHydratedRef.current = true;
    (async () => {
      try {
        const r = await fetch(
          `/api/tandem/memory/list?ownershipLevel=personal&ownerUserId=${encodeURIComponent(user.id)}&detail=1&limit=500`,
          { cache: 'no-store', credentials: 'include' }
        );
        if (!r.ok) return;
        const j = await r.json();
        const items = Array.isArray(j.memories) ? j.memories.map(entryToUiMemory) : [];
        hydrateMemories(items);
      } catch {
        // 忽略, 离线 / 401 等都不阻塞 UI
      }
    })();
  }, [user?.id, hydrateMemories]);

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
