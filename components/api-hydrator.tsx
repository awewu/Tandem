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
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname() ?? '';
  const load1on1 = useOneOnOneStore((s) => s.loadFromApi);
  const hydrated1 = useOneOnOneStore((s) => s._hydrated);
  const load360 = useReview360Store((s) => s.loadFromApi);
  const hydrated360 = useReview360Store((s) => s._hydrated);
  const hydrateMemories = useMemoryStore((s) => s.hydrateMemories);
  const hydrateOrg = useOrgStore((s) => s.hydrateFromGovernance);
  const orgHydrated = useOrgStore((s) => s._hydrated);
  const hydrateHrDepts = useOrgStore((s) => s.hydrateHrDepts);
  const hrDeptsHydrated = useOrgStore((s) => s._hrHydrated);
  const fixturePeople = useOKRStore((s) => s.people);
  const setOrgPeopleFixture = useOrgPeopleStore((s) => s.setFixture);
  const hydrateOrgPeople = useOrgPeopleStore((s) => s.hydrateFromApi);
  const orgPeopleHydrated = useOrgPeopleStore((s) => s._hydrated);
  const user = useAuthStore((s) => s.user);
  const memHydratedRef = useRef(false);
  const okrHydratedRef = useRef(false);
  const shouldHydratePeopleSignals =
    pathname === '/1on1' ||
    pathname.startsWith('/1on1/') ||
    pathname === '/360' ||
    pathname.startsWith('/360/') ||
    pathname === '/analytics' ||
    pathname.startsWith('/analytics/') ||
    pathname === '/insights' ||
    pathname.startsWith('/insights/');

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
    if (!shouldHydratePeopleSignals) return;
    // hydrate once
    if (!hydrated1) void load1on1().catch((err) => console.warn('[api-hydrator] 1on1 hydrate skipped:', err));
    if (!hydrated360) void load360().catch((err) => console.warn('[api-hydrator] 360 hydrate skipped:', err));
  }, [shouldHydratePeopleSignals, hydrated1, hydrated360, load1on1, load360]);

  // OKR 数据收敛 (B4 + 2026-06-17 去 localStorage): DB 是唯一真值, 登录后从后端拉取
  // objectives/keyResults/cycles/checkIns/initiatives. 写操作走 okr-sync.ts persist* helper.
  useEffect(() => {
    if (okrHydratedRef.current || !user?.id) return;
    okrHydratedRef.current = true;
    void hydrateOkrFromApi(true);
  }, [user?.id]);

  // D-pragma (2026-05-31): 已登录时把 zustand fixture 替换为后端 governance 默认模板
  useEffect(() => {
    if (!user?.id || orgHydrated) return;
    void hydrateOrg();
    if (!hrDeptsHydrated) void hydrateHrDepts();
  }, [user?.id, orgHydrated, hydrateOrg, hrDeptsHydrated, hydrateHrDepts]);

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
