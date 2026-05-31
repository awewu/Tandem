import { describe, it, expect } from 'vitest';
import { buildDeptIndex, resolveOwner, formatOwnerLabel } from '@/lib/org/ownership';
import type { Department } from '@/lib/types/governance';

const M = (id: string, name: string) => ({
  id, name, tag: id, description: '', agents: [] as string[],
});
const deps: Department[] = [
  {
    id: 'd-tech',
    name: '技术部',
    pillar: 'execution',
    ministries: [M('m-fe', '前端组'), M('m-be', '后端组')],
  },
  {
    id: 'd-prod',
    name: '产品部',
    pillar: 'decision',
    ministries: [M('m-pm', '产品组')],
  },
];

const people = [
  { id: 'p1', name: '张三', ministryId: 'm-fe' },
  { id: 'p2', name: '李四', ministryId: 'm-pm' },
  { id: 'p3', name: '王五', ministryId: 'd-tech' }, // 直接挂在一级部门
  { id: 'p4', name: '赵六' }, // 没挂部门
];

describe('buildDeptIndex', () => {
  it('同时索引 department.id 和 ministry.id', () => {
    const idx = buildDeptIndex(deps);
    expect(idx.get('d-tech')?.deptName).toBe('技术部');
    expect(idx.get('d-tech')?.ministryId).toBeUndefined();
    expect(idx.get('m-fe')?.deptId).toBe('d-tech');
    expect(idx.get('m-fe')?.ministryName).toBe('前端组');
    expect(idx.has('not-exist')).toBe(false);
  });
});

describe('resolveOwner', () => {
  const idx = buildDeptIndex(deps);

  it('team:<ministryId> → 解出 dept + ministry', () => {
    const r = resolveOwner('team:m-fe', { people, deptIndex: idx });
    expect(r.kind).toBe('team');
    expect(r.deptId).toBe('d-tech');
    expect(r.ministryId).toBe('m-fe');
    expect(r.name).toBe('前端组');
  });

  it('team:<departmentId> → kind=team, ministryId 空', () => {
    const r = resolveOwner('team:d-prod', { people, deptIndex: idx });
    expect(r.kind).toBe('team');
    expect(r.deptId).toBe('d-prod');
    expect(r.ministryId).toBeUndefined();
    expect(r.name).toBe('产品部');
  });

  it("person:<id> → 解出 dept (经 person.ministryId)", () => {
    const r = resolveOwner('person:p1', { people, deptIndex: idx });
    expect(r.kind).toBe('person');
    expect(r.personId).toBe('p1');
    expect(r.deptId).toBe('d-tech');
    expect(r.ministryName).toBe('前端组');
  });

  it('裸 personId → 视为 person', () => {
    const r = resolveOwner('p2', { people, deptIndex: idx });
    expect(r.kind).toBe('person');
    expect(r.personId).toBe('p2');
    expect(r.deptName).toBe('产品部');
  });

  it('裸 ministryId (没匹配 person) → 视为 team', () => {
    const r = resolveOwner('m-be', { people, deptIndex: idx });
    expect(r.kind).toBe('team');
    expect(r.deptId).toBe('d-tech');
    expect(r.ministryName).toBe('后端组');
  });

  it('Person.ministryId = department.id 直接挂部门', () => {
    const r = resolveOwner('p3', { people, deptIndex: idx });
    expect(r.kind).toBe('person');
    expect(r.deptId).toBe('d-tech');
    expect(r.ministryId).toBeUndefined();
  });

  it('person 没挂部门 → deptId 空', () => {
    const r = resolveOwner('p4', { people, deptIndex: idx });
    expect(r.kind).toBe('person');
    expect(r.deptId).toBeUndefined();
  });

  it('完全找不到 → unknown', () => {
    const r = resolveOwner('whatever-xyz', { people, deptIndex: idx });
    expect(r.kind).toBe('unknown');
  });

  it('null / undefined / 空串 → unknown 未指派', () => {
    expect(resolveOwner(null, { people, deptIndex: idx }).kind).toBe('unknown');
    expect(resolveOwner(undefined, { people, deptIndex: idx }).kind).toBe('unknown');
    expect(resolveOwner('', { people, deptIndex: idx }).name).toBe('未指派');
  });

  it('team:<未知 id> → kind=team, name=raw id, dept 空', () => {
    const r = resolveOwner('team:no-such', { people, deptIndex: idx });
    expect(r.kind).toBe('team');
    expect(r.name).toBe('no-such');
    expect(r.deptId).toBeUndefined();
  });
});

describe('formatOwnerLabel', () => {
  const idx = buildDeptIndex(deps);

  it('默认不带部门前缀', () => {
    const r = resolveOwner('p1', { people, deptIndex: idx });
    expect(formatOwnerLabel(r)).toBe('张三');
  });

  it('includeDept=true 带 [部门] 前缀', () => {
    const r = resolveOwner('p1', { people, deptIndex: idx });
    expect(formatOwnerLabel(r, { includeDept: true })).toBe('[技术部] 张三');
  });

  it('没 dept 时即使 includeDept 也只返回 name', () => {
    const r = resolveOwner('p4', { people, deptIndex: idx });
    expect(formatOwnerLabel(r, { includeDept: true })).toBe('赵六');
  });
});
