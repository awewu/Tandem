'use client';

/**
 * ApiHydrator (A2.3 / A4 / P1-1)
 *
 * 在根 layout 挂载, 干两件事:
 *   1. 应用首次启动 (本会话还没拉过 API) → 调 useOneOnOneStore.loadFromApi() + useReview360Store.loadFromApi()
 *   2. P1-1: hydrate useMemoryStore 的个人记事本 (供 /chat baseline 注入).
 *
 * 历史: 早期版本顶部还显示过一条"A2 真后端已接通"banner, 已在 2026-05-29 移除
 * (迁移完成态过渡提示, 对新用户是纯噪音).
 */

import { useEffect, useRef } from 'react';
import { useOneOnOneStore, useReview360Store, useMemoryStore, useOrgStore, useOKRStore, type Memory } from '@/lib/store';
import { hydrateOkrFromApi } from '@/lib/store/okr-sync';
import { useOrgPeopleStore } from '@/lib/org/people-source';
import { useAuthStore } from '@/lib/hooks/use-current-user';

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
  const hydrateOrg = useOrgStore((s) => s.hydrateFromGovernance);
  const orgHydrated = useOrgStore((s) => s._hydrated);
  const fixturePeople = useOKRStore((s) => s.people);
  const setOrgPeopleFixture = useOrgPeopleStore((s) => s.setFixture);
  const hydrateOrgPeople = useOrgPeopleStore((s) => s.hydrateFromApi);
  const orgPeopleHydrated = useOrgPeopleStore((s) => s._hydrated);
  const user = useAuthStore((s) => s.user);
  const memHydratedRef = useRef(false);
  const okrHydratedRef = useRef(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // B4 (2026-05-31): OKR 读路径收敛 — 已登录时把本地 zustand 替换为后端真值
  // (后端无 objectives 时保留本地, 不破坏 demo/离线; 写路径仍本地 = Phase 2)
  useEffect(() => {
    if (okrHydratedRef.current || !user?.id) return;
    okrHydratedRef.current = true;
    void hydrateOkrFromApi();
  }, [user?.id]);

  // D-pragma (2026-05-31): 已登录时把 zustand fixture 替换为后端 governance 默认模板
  useEffect(() => {
    if (!user?.id || orgHydrated) return;
    void hydrateOrg();
  }, [user?.id, orgHydrated, hydrateOrg]);

  // E-pragma (2026-05-31): OrgPeople = 真用户 + fixture 合并
  useEffect(() => {
    setOrgPeopleFixture(fixturePeople);
  }, [fixturePeople, setOrgPeopleFixture]);
  useEffect(() => {
    if (!user?.id || orgPeopleHydrated) return;
    void hydrateOrgPeople();
  }, [user?.id, orgPeopleHydrated, hydrateOrgPeople]);

  // 纯 side-effect 组件, 不渲染任何 UI
  return null;
}
