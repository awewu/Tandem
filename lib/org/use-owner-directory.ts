'use client';

import { useCallback, useMemo } from 'react';
import { useOKRStore } from '@/lib/store/okr';
import { useOrgStore } from '@/lib/store/org';
import { useOrgPeopleStore } from './people-source';
import {
  buildDeptIndex,
  formatOwnerDisplay,
  resolveOwner,
  type PersonLike,
  type ResolvedOwner,
} from './ownership';

/**
 * 事半内所有人员/团队显示的统一数据源.
 * 真实组织用户优先, OKR fixture 仅补缺, 避免旧页面把 user_xxx 直接展示出来.
 */
export function useOwnerDirectory() {
  const orgPeople = useOrgPeopleStore((s) => s.people);
  const fixturePeople = useOKRStore((s) => s.people);
  const departments = useOrgStore((s) => s.departments);

  const people = useMemo<PersonLike[]>(() => {
    const result: PersonLike[] = [];
    const seen = new Set<string>();
    for (const p of orgPeople) {
      result.push({ id: p.id, name: p.name, ministryId: p.ministryId });
      seen.add(p.id);
    }
    for (const p of fixturePeople) {
      if (seen.has(p.id)) continue;
      result.push({ id: p.id, name: p.name, ministryId: p.ministryId });
    }
    return result;
  }, [fixturePeople, orgPeople]);

  const deptIndex = useMemo(() => buildDeptIndex(departments), [departments]);

  const resolve = useCallback(
    (ownerId: string | undefined | null): ResolvedOwner =>
      resolveOwner(ownerId, { people, deptIndex }),
    [deptIndex, people],
  );

  const nameOf = useCallback(
    (ownerId: string | undefined | null): string =>
      formatOwnerDisplay(ownerId, resolve(ownerId)),
    [resolve],
  );

  const ownerNameById = useMemo<Record<string, string>>(() => {
    const names: Record<string, string> = {};
    for (const p of people) {
      names[p.id] = p.name;
      names[`person:${p.id}`] = p.name;
    }
    for (const d of departments) {
      names[d.id] = `[团队] ${d.name}`;
      names[`team:${d.id}`] = `[团队] ${d.name}`;
      for (const m of d.ministries) {
        names[m.id] = `[团队] ${m.name}`;
        names[`team:${m.id}`] = `[团队] ${m.name}`;
      }
    }
    names.system = '系统';
    names.__company__ = 'CompanyBrain';
    return names;
  }, [departments, people]);

  return useMemo(
    () => ({ people, departments, deptIndex, resolve, nameOf, ownerNameById }),
    [departments, deptIndex, nameOf, ownerNameById, people, resolve],
  );
}
