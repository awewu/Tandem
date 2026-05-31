import { describe, it, expect } from 'vitest';
import { mergePeople } from '@/lib/org/people-source';

describe('mergePeople (真用户 + fixture 合并)', () => {
  it('真用户 → 转 OrgPerson, departmentId → ministryId, source=auth', () => {
    const r = mergePeople(
      [{ id: 'u1', name: '张三', email: 'z@a.com', departmentId: 'd-tech' }],
      [],
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: 'u1',
      name: '张三',
      email: 'z@a.com',
      ministryId: 'd-tech',
      source: 'auth',
    });
  });

  it('真用户优先, fixture 同 id 被覆盖', () => {
    const r = mergePeople(
      [{ id: 'u1', name: '真张三', departmentId: 'd-tech' }],
      [{ id: 'u1', name: '虚拟张三', ministryId: 'm-fe' }],
    );
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('真张三');
    expect(r[0].source).toBe('auth');
  });

  it('fixture 中 id 不冲突 → 原样保留, source=fixture', () => {
    const r = mergePeople(
      [{ id: 'u1', name: '真张三', departmentId: 'd-tech' }],
      [{ id: 'p2', name: '虚拟李四', ministryId: 'm-fe' }],
    );
    expect(r).toHaveLength(2);
    expect(r.find((p) => p.id === 'u1')!.source).toBe('auth');
    expect(r.find((p) => p.id === 'p2')!.source).toBe('fixture');
  });

  it('真用户 departmentId=null → ministryId 空, source=auth', () => {
    const r = mergePeople(
      [{ id: 'u1', name: '张三', departmentId: null }],
      [],
    );
    expect(r[0].ministryId).toBeUndefined();
    expect(r[0].source).toBe('auth');
  });

  it('空真用户 + 空 fixture → 空数组', () => {
    expect(mergePeople([], [])).toEqual([]);
  });

  it('保持顺序: 真用户在前, fixture 在后', () => {
    const r = mergePeople(
      [{ id: 'u1', name: 'A', departmentId: 'd' }, { id: 'u2', name: 'B', departmentId: 'd' }],
      [{ id: 'p1', name: 'C', ministryId: 'm' }],
    );
    expect(r.map((p) => p.id)).toEqual(['u1', 'u2', 'p1']);
  });
});
