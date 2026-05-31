/**
 * Ownership SSOT (2026-05-31 · D-pragma)
 *
 * 解决问题:
 *   - `Objective.ownerId` 接受 `'team:<ministryId>'` / `'person:<id>'` / 裸 id 三种格式
 *   - 这套解析逻辑此前在 5+ 处复制 (okr-alignment-tree, okr-dashboard, analytics, ...).
 *   - 一旦 schema 变更, 需要五处同步, 极易漂移.
 *
 * 本模块为唯一权威解析器:
 *   - resolveOwner(ownerId, ctx) → { kind, name, deptId, deptName, ministryId, ministryName }
 *   - 调用方仅依赖这一个函数, 不再自己 split 'team:' / 'person:'.
 *
 * 依赖关系:
 *   - 输入纯数据 (people + departments), 不耦合 zustand. 调用方自行从 useOrgStore / useOKRStore 注入.
 *   - 与服务端 / 客户端均兼容 (无 'use client', 无 React 依赖).
 */

import type { Department } from '@/lib/types/governance';

export interface PersonLike {
  id: string;
  name: string;
  /** 兼容字段: ministry.id 或 department.id */
  ministryId?: string;
}

export type OwnerKind = 'person' | 'team' | 'unknown';

export interface ResolvedOwner {
  kind: OwnerKind;
  name: string;
  /** 解析出的部门 (一级) id, 跨部门高亮 / swimlane 用 */
  deptId?: string;
  deptName?: string;
  /** 解析出的 ministry (二级) id, 部分场景需要 */
  ministryId?: string;
  ministryName?: string;
  /** 个人 owner 时的 personId */
  personId?: string;
}

interface DeptIndex {
  deptId: string;
  deptName: string;
  ministryId?: string;
  ministryName?: string;
}

/** 构建 (ministry.id | department.id) → 部门索引. 同时支持把 ministry id 解析回 dept */
export function buildDeptIndex(departments: Department[]): Map<string, DeptIndex> {
  const map = new Map<string, DeptIndex>();
  for (const d of departments) {
    map.set(d.id, { deptId: d.id, deptName: d.name });
    for (const m of d.ministries) {
      map.set(m.id, {
        deptId: d.id,
        deptName: d.name,
        ministryId: m.id,
        ministryName: m.name,
      });
    }
  }
  return map;
}

/**
 * 解析 ownerId.
 * 支持三种格式:
 *   - 'team:<ministryOrDeptId>' → kind=team
 *   - 'person:<personId>' → kind=person
 *   - 裸 id → 优先按 person 解析, 命中失败再按 ministry 解析, 最终 unknown
 */
export function resolveOwner(
  ownerId: string | undefined | null,
  ctx: { people: PersonLike[]; deptIndex: Map<string, DeptIndex> },
): ResolvedOwner {
  if (!ownerId) return { kind: 'unknown', name: '未指派' };

  if (ownerId.startsWith('team:')) {
    const id = ownerId.slice(5);
    const hit = ctx.deptIndex.get(id);
    if (hit) {
      return {
        kind: 'team',
        name: hit.ministryName ?? hit.deptName,
        deptId: hit.deptId,
        deptName: hit.deptName,
        ministryId: hit.ministryId,
        ministryName: hit.ministryName,
      };
    }
    return { kind: 'team', name: id };
  }

  const pId = ownerId.startsWith('person:') ? ownerId.slice(7) : ownerId;
  const person = ctx.people.find((p) => p.id === pId);
  if (person) {
    const dept = person.ministryId ? ctx.deptIndex.get(person.ministryId) : undefined;
    return {
      kind: 'person',
      name: person.name,
      personId: person.id,
      deptId: dept?.deptId,
      deptName: dept?.deptName,
      ministryId: dept?.ministryId,
      ministryName: dept?.ministryName,
    };
  }

  // 裸 id 但 person 找不到 → 尝试当 ministry 解析
  const dept = ctx.deptIndex.get(pId);
  if (dept) {
    return {
      kind: 'team',
      name: dept.ministryName ?? dept.deptName,
      deptId: dept.deptId,
      deptName: dept.deptName,
      ministryId: dept.ministryId,
      ministryName: dept.ministryName,
    };
  }

  return { kind: 'unknown', name: pId };
}

/** 渲染 owner 显示标签: '[部门] 名称' 或 '名称' */
export function formatOwnerLabel(owner: ResolvedOwner, opts?: { includeDept?: boolean }): string {
  const includeDept = opts?.includeDept ?? false;
  if (!includeDept || !owner.deptName) return owner.name;
  return `[${owner.deptName}] ${owner.name}`;
}

/** 从 person.ministryId 反查所属一级部门. 用于部门统计. */
export function resolvePersonDept(
  person: PersonLike,
  deptIndex: Map<string, DeptIndex>,
): DeptIndex | undefined {
  if (!person.ministryId) return undefined;
  return deptIndex.get(person.ministryId);
}
