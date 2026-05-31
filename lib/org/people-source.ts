/**
 * Org People Source · E-pragma (2026-05-31)
 *
 * 解决问题:
 *   - IM 通讯录、按部门一键建群此前用 useOKRStore.people (zustand fixture).
 *   - 真实登录用户在 auth.users 表里, 通过 /api/org/users 暴露; 此前没接进 IM.
 *
 * 设计:
 *   - 单独维护 useOrgPeopleStore (zustand, 不持久化) 作"真用户 + fixture 合并"的缓存.
 *   - hydrateFromApi() 拉 /api/org/users; 离线/401 时退回纯 fixture.
 *   - mergePeople() 把 auth user 映射成 PersonLike, 真用户覆盖 fixture (id 命中时).
 *   - 暴露纯函数 mergePeople 便于单元测试.
 *
 * 字段映射 (User → Person):
 *   - id           ← user.id
 *   - name         ← user.name
 *   - email        ← user.email (privacy redactor 已抹白同事邮箱)
 *   - ministryId   ← user.departmentId (语义: User.departmentId 可指向 Department.id 或 Ministry.id;
 *                                       与 Person.ministryId 的 "可指向二级或一级" 完全一致)
 */

import { create } from 'zustand';
import type { PersonLike } from './ownership';

export interface OrgPerson extends PersonLike {
  email?: string;
  /** 来源标记: 'auth' = 真用户, 'fixture' = zustand 兜底 */
  source: 'auth' | 'fixture';
}

interface AuthUserRow {
  id: string;
  name: string;
  email?: string | null;
  departmentId?: string | null;
}

/** 把 auth user 行转 OrgPerson */
function authToPerson(u: AuthUserRow): OrgPerson {
  return {
    id: u.id,
    name: u.name,
    email: u.email ?? undefined,
    ministryId: u.departmentId ?? undefined,
    source: 'auth',
  };
}

/**
 * 合并真用户 + fixture: 真用户优先, fixture 仅补缺.
 * 纯函数, 单元测试友好.
 */
export function mergePeople(
  authUsers: AuthUserRow[],
  fixturePeople: PersonLike[],
): OrgPerson[] {
  const out: OrgPerson[] = [];
  const seen = new Set<string>();
  for (const u of authUsers) {
    out.push(authToPerson(u));
    seen.add(u.id);
  }
  for (const p of fixturePeople) {
    if (seen.has(p.id)) continue;
    out.push({
      id: p.id,
      name: p.name,
      ministryId: p.ministryId,
      source: 'fixture',
    });
  }
  return out;
}

interface OrgPeopleStore {
  /** 已合并好的人列表 (真用户优先) */
  people: OrgPerson[];
  /** 是否拉过 /api/org/users (即使 401/空也算, 防重复 fetch) */
  _hydrated: boolean;
  /** fixture 缓存 (来自 useOKRStore.people 的快照, 防止重渲染抖动) */
  _fixture: PersonLike[];
  /** 设置 fixture (UI 层 useEffect 同步进来) */
  setFixture: (people: PersonLike[]) => void;
  /** 拉真用户并合并 */
  hydrateFromApi: () => Promise<void>;
}

export const useOrgPeopleStore = create<OrgPeopleStore>((set, get) => ({
  people: [],
  _hydrated: false,
  _fixture: [],
  setFixture: (fixture) => {
    const merged = mergePeople(
      // 已 hydrated 时 _authUsers 缓存在 people 里 (filter source=auth);
      // 简化: 重新从当前 people 提取 auth, 与新 fixture 合并
      get().people.filter((p) => p.source === 'auth') as AuthUserRow[],
      fixture,
    );
    set({ _fixture: fixture, people: merged });
  },
  hydrateFromApi: async () => {
    if (get()._hydrated) return;
    try {
      const r = await fetch('/api/org/users', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!r.ok) {
        set({ _hydrated: true });
        return;
      }
      const j = await r.json();
      const users: AuthUserRow[] = Array.isArray(j?.users) ? j.users : [];
      const merged = mergePeople(users, get()._fixture);
      set({ people: merged, _hydrated: true });
    } catch {
      set({ _hydrated: true });
    }
  },
}));
