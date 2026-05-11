'use client';

/**
 * useCurrentUser — 全局当前用户 hook.
 *
 * 设计 (2026-05-10 · A1):
 *  - 单一来源, 替换散落的 ME = 'me' 硬编码
 *  - 客户端 cache (zustand, 不 persist — 每个会话重取以反映角色变更)
 *  - 自动按需 fetch /api/auth/me
 *  - personId: OKR / 1on1 / 360 等业务模型的 Person.id
 *      · 现阶段 demo 默认 'me' (匹配 useOKRStore.people 中的种子)
 *      · A2 完成后会从 auth user.id 映射到真实 Person.id
 *
 * 用法:
 *   const { user, loading } = useCurrentUser();
 *   const myId = useCurrentUserId();
 */

import { useEffect } from 'react';
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  mfaVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** unauthenticated / http_xxx / network */
  error: string | null;
  /** 已经发起过一次 fetch (避免重复请求) */
  fetched: boolean;
  /** OKR-side Person.id; demo 默认 'me'. A2 之后会自动对齐 auth user.id. */
  personId: string;
  fetchMe: () => Promise<void>;
  setPersonId: (id: string) => void;
  /** 测试或登出后清空 */
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  fetched: false,
  personId: 'me',

  fetchMe: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (!r.ok) {
        set({
          user: null,
          loading: false,
          fetched: true,
          error: r.status === 401 ? 'unauthenticated' : `http_${r.status}`,
        });
        return;
      }
      const data = await r.json();
      const user: AuthUser | null = data?.user ?? null;
      // 暂时不改 personId — 等 A2 把 Person 和 User 对齐后再用 user.id.
      // 现在保留 'me', 这样所有现有 demo 数据仍然能联动.
      set({ user, loading: false, fetched: true, error: null });
    } catch (e) {
      set({
        loading: false,
        fetched: true,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  setPersonId: (id) => set({ personId: id }),

  reset: () =>
    set({ user: null, loading: false, fetched: false, error: null, personId: 'me' }),
}));

/**
 * 拿当前登录用户 (会自动按需 fetch /api/auth/me).
 *
 * loading=true 时 user 为 null; error 不为空时也是 null.
 */
export function useCurrentUser() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const fetched = useAuthStore((s) => s.fetched);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (!fetched && !loading) {
      void fetchMe();
    }
  }, [fetched, loading, fetchMe]);

  return { user, loading, error };
}

/**
 * 拿当前用户对应的 Person.id (OKR / 1on1 / 360 业务实体 id).
 *
 * 现在统一回 'me' (demo); A2 之后改为 auth user → Person 映射.
 * 用这个 hook 替换所有 `const ME = 'me'` 写法.
 */
export function useCurrentUserId(): string {
  return useAuthStore((s) => s.personId);
}

/**
 * 是否登录 (服务端 cookie session 有效).
 */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => !!s.user);
}
