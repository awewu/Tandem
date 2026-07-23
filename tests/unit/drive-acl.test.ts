/**
 * 组织云盘 ACL 纯函数单测 (lib/drive/acl.ts)
 *
 * 覆盖: principal 归一化 / 用户 principal 集 / 有效权限继承 /
 *       canRead·canWrite (owner 恒通过 · dept·ministry·role·all 命中 · 跨部门不可见) /
 *       祖先链构造 (含防环)。
 */
import { describe, it, expect } from 'vitest';
import {
  normalizePrincipal,
  userPrincipals,
  resolveEffectivePermissions,
  canRead,
  canWrite,
  buildAncestorChain,
  type DriveNodeLike,
  type DriveAclUser,
} from '@/lib/drive/acl';

const alice: DriveAclUser = { id: 'u_alice', departmentId: 'dept_a', ministryId: 'min_hr', roles: ['employee'] };
const bob: DriveAclUser = { id: 'u_bob', departmentId: 'dept_b', ministryId: 'min_fin', roles: ['manager'] };

describe('normalizePrincipal', () => {
  it('裸 userId → user:', () => {
    expect(normalizePrincipal('u_alice')).toBe('user:u_alice');
  });
  it('已带前缀不变', () => {
    expect(normalizePrincipal('dept:dept_a')).toBe('dept:dept_a');
    expect(normalizePrincipal('all')).toBe('all');
    expect(normalizePrincipal('role:admin')).toBe('role:admin');
  });
});

describe('userPrincipals', () => {
  it('含 all / user / dept / ministry / role', () => {
    const p = userPrincipals(alice);
    expect(p.has('all')).toBe(true);
    expect(p.has('user:u_alice')).toBe(true);
    expect(p.has('dept:dept_a')).toBe(true);
    expect(p.has('ministry:min_hr')).toBe(true);
    expect(p.has('role:employee')).toBe(true);
  });
  it('缺省字段不产生对应 principal', () => {
    const p = userPrincipals({ id: 'u_x' });
    expect(Array.from(p).sort()).toEqual(['all', 'user:u_x']);
  });
});

describe('resolveEffectivePermissions · 继承', () => {
  it('子未设权 → 继承最近祖先; read/write 各自独立继承', () => {
    const chain: DriveNodeLike[] = [
      { id: 'child', ownerId: 'o', parentId: 'mid', permissions: {} },
      { id: 'mid', ownerId: 'o', parentId: 'root', permissions: { write: ['ministry:min_hr'] } },
      { id: 'root', ownerId: 'o', parentId: null, permissions: { read: ['dept:dept_a'] } },
    ];
    const { read, write } = resolveEffectivePermissions(chain);
    expect(Array.from(read)).toEqual(['dept:dept_a']);      // 从 root 继承
    expect(Array.from(write)).toEqual(['ministry:min_hr']); // 从 mid 继承
  });

  it('空集合视为未设 → 继续向上继承', () => {
    const chain: DriveNodeLike[] = [
      { id: 'child', ownerId: 'o', parentId: 'root', permissions: { read: [] } },
      { id: 'root', ownerId: 'o', parentId: null, permissions: { read: ['all'] } },
    ];
    expect(Array.from(resolveEffectivePermissions(chain).read)).toEqual(['all']);
  });

  it('裸 userId 归一化进集合', () => {
    const chain: DriveNodeLike[] = [
      { id: 'n', ownerId: 'o', permissions: { read: ['u_bob'] } },
    ];
    expect(resolveEffectivePermissions(chain).read.has('user:u_bob')).toBe(true);
  });
});

describe('canRead / canWrite', () => {
  it('owner 恒可读写 (无视 ACL)', () => {
    const chain: DriveNodeLike[] = [{ id: 'n', ownerId: 'u_alice', permissions: {} }];
    expect(canRead(chain, alice)).toBe(true);
    expect(canWrite(chain, alice)).toBe(true);
  });

  it('dept 授权 → 同部门可读, 跨部门不可读', () => {
    const chain: DriveNodeLike[] = [{ id: 'n', ownerId: 'someone', permissions: { read: ['dept:dept_a'] } }];
    expect(canRead(chain, alice)).toBe(true);  // alice ∈ dept_a
    expect(canRead(chain, bob)).toBe(false);   // bob ∈ dept_b
  });

  it('ministry 授权 → 同团队可读', () => {
    const chain: DriveNodeLike[] = [{ id: 'n', ownerId: 'x', permissions: { read: ['ministry:min_hr'] } }];
    expect(canRead(chain, alice)).toBe(true);
    expect(canRead(chain, bob)).toBe(false);
  });

  it('all 授权 → 任何人可读', () => {
    const chain: DriveNodeLike[] = [{ id: 'n', ownerId: 'x', permissions: { read: ['all'] } }];
    expect(canRead(chain, alice)).toBe(true);
    expect(canRead(chain, bob)).toBe(true);
  });

  it('role 授权 → 命中角色可写', () => {
    const chain: DriveNodeLike[] = [{ id: 'n', ownerId: 'x', permissions: { write: ['role:manager'] } }];
    expect(canWrite(chain, bob)).toBe(true);   // bob 是 manager
    expect(canWrite(chain, alice)).toBe(false);
  });

  it('read 授权不等于 write 授权', () => {
    const chain: DriveNodeLike[] = [{ id: 'n', ownerId: 'x', permissions: { read: ['dept:dept_a'] } }];
    expect(canRead(chain, alice)).toBe(true);
    expect(canWrite(chain, alice)).toBe(false);
  });

  it('继承的 dept 授权跨层生效', () => {
    const chain: DriveNodeLike[] = [
      { id: 'child', ownerId: 'x', parentId: 'root', permissions: {} },
      { id: 'root', ownerId: 'x', parentId: null, permissions: { read: ['dept:dept_a'] } },
    ];
    expect(canRead(chain, alice)).toBe(true);
    expect(canRead(chain, bob)).toBe(false);
  });
});

describe('buildAncestorChain', () => {
  it('自身在前, 依次向上到根', () => {
    const nodes: DriveNodeLike[] = [
      { id: 'a', ownerId: 'o', parentId: 'b' },
      { id: 'b', ownerId: 'o', parentId: 'c' },
      { id: 'c', ownerId: 'o', parentId: null },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(buildAncestorChain('a', byId).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('防环: 自引用/环不死循环', () => {
    const nodes: DriveNodeLike[] = [
      { id: 'a', ownerId: 'o', parentId: 'b' },
      { id: 'b', ownerId: 'o', parentId: 'a' },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const chain = buildAncestorChain('a', byId);
    expect(chain.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('缺失父节点即止', () => {
    const nodes: DriveNodeLike[] = [{ id: 'a', ownerId: 'o', parentId: 'missing' }];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(buildAncestorChain('a', byId).map((n) => n.id)).toEqual(['a']);
  });
});
