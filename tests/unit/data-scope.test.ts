/**
 * Data Scope SSOT + registry 强制 · 回归锁 (P1-C)
 *
 * 覆盖:
 *   - checkDataScope 纯逻辑: 本人/他人 × personal/team/department/company × 特权/非特权
 *   - skillRegistry.execute 对声明 dataScope 的 skill 强制拦截跨用户访问
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkDataScope, hasDataPrivilege } from '@/lib/auth/data-scope';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { skillRegistry } from '@/lib/taf/skills';
import type { Skill } from '@/lib/taf/skills/registry';

describe('checkDataScope · 纯逻辑边界', () => {
  it('本人 personal → 放行', () => {
    const r = checkDataScope({ actorUserId: 'u1', actorRoles: ['employee'], level: 'personal', targetUserId: 'u1' });
    expect(r.allowed).toBe(true);
  });

  it('未指定 target 的 personal → 放行', () => {
    const r = checkDataScope({ actorUserId: 'u1', actorRoles: ['employee'], level: 'personal' });
    expect(r.allowed).toBe(true);
  });

  it('普通员工访问他人 personal → 拦截', () => {
    const r = checkDataScope({ actorUserId: 'u1', actorRoles: ['employee'], level: 'personal', targetUserId: 'u2' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('他人');
  });

  it('manager 访问他人 personal → 放行 (特权)', () => {
    const r = checkDataScope({ actorUserId: 'mgr', actorRoles: ['manager'], level: 'personal', targetUserId: 'u2' });
    expect(r.allowed).toBe(true);
  });

  it('普通员工访问他人 team → 拦截', () => {
    const r = checkDataScope({ actorUserId: 'u1', actorRoles: ['employee'], level: 'team', targetUserId: 'u2' });
    expect(r.allowed).toBe(false);
  });

  it('普通员工访问 department / company → 拦截', () => {
    expect(checkDataScope({ actorUserId: 'u1', actorRoles: ['employee'], level: 'department' }).allowed).toBe(false);
    expect(checkDataScope({ actorUserId: 'u1', actorRoles: ['employee'], level: 'company' }).allowed).toBe(false);
  });

  it('steward / admin / owner 访问 company → 放行', () => {
    for (const role of ['steward', 'admin', 'owner']) {
      expect(checkDataScope({ actorUserId: 'x', actorRoles: [role], level: 'company' }).allowed).toBe(true);
    }
  });

  it('hasDataPrivilege: 仅 manager/steward/admin/owner', () => {
    expect(hasDataPrivilege(['employee'])).toBe(false);
    expect(hasDataPrivilege(['guest'])).toBe(false);
    expect(hasDataPrivilege(['employee', 'manager'])).toBe(true);
  });
});

describe('skillRegistry.execute · dataScope 架构强制', () => {
  const probe: Skill<{ ownerId?: string }, unknown> = {
    id: 'test.scoped_read',
    description: 'scoped read probe',
    tags: ['test'],
    zone: 'green',
    proxyAllowed: true,
    dataScope: { level: 'personal', targetUserArg: 'ownerId' },
    estimatedTokens: 1,
    schema: { type: 'function', function: { name: 'test_scoped_read', description: 'probe', parameters: { type: 'object', properties: {} } } },
    execute: async ({ ownerId }) => ({ ok: true, data: { read: ownerId } }),
  };

  let empId = '';
  let mgrId = '';

  beforeEach(async () => {
    setStore(createInMemoryStore());
    // 注册被测用户: 普通员工 + 主管 (create 自生成 id, 捕获后作 ctx.userId)
    const emp = await getStore().auth.users.create({ email: 'u1@t.local', tenantId: 'default', roles: ['employee'] } as never);
    const mgr = await getStore().auth.users.create({ email: 'mgr@t.local', tenantId: 'default', roles: ['manager'] } as never);
    empId = (emp as { id: string }).id;
    mgrId = (mgr as { id: string }).id;
    if (skillRegistry.has('test.scoped_read')) skillRegistry.unregister('test.scoped_read');
    skillRegistry.register(probe);
  });

  it('员工读自己的数据 → 放行', async () => {
    const r = await skillRegistry.execute('test.scoped_read', { ownerId: empId }, { userId: empId, tenantId: 'default', isProxy: false });
    expect(r.ok).toBe(true);
  });

  it('员工读他人数据 → 数据边界拦截', async () => {
    const r = await skillRegistry.execute('test.scoped_read', { ownerId: 'someone-else' }, { userId: empId, tenantId: 'default', isProxy: false });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('数据边界拦截');
  });

  it('主管读他人数据 → 放行 (特权)', async () => {
    const r = await skillRegistry.execute('test.scoped_read', { ownerId: empId }, { userId: mgrId, tenantId: 'default', isProxy: false });
    expect(r.ok).toBe(true);
  });

  it('未传 ownerId → 放行 (无具体目标, 不破坏既有读全量行为)', async () => {
    const r = await skillRegistry.execute('test.scoped_read', {}, { userId: empId, tenantId: 'default', isProxy: false });
    expect(r.ok).toBe(true);
  });
});
