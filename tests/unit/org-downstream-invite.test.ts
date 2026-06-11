/**
 * 上下游邀请流 · 回归锁 (企业微信式供应链模型)
 *
 * 覆盖:
 *   - createDownstreamOrg 挂在 anchor 下
 *   - inviteDownstreamMember 生成绑定 orgId + membershipType 的邀请码
 *   - registerWithInvite 用该邀请码注册 → 用户权威归属下游组织 (非按角色推断)
 *   - 不能用下游邀请流邀请到 anchor
 *   - backfillUserOrgs 存量用户回填
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  ensureAnchorOrg,
  backfillUserOrgs,
} from '@/lib/auth/bootstrap';
import {
  createDownstreamOrg,
  inviteDownstreamMember,
  listDownstreamOrgs,
  suspendOrg,
  OrgError,
} from '@/lib/auth/organizations';
import { registerWithInvite } from '@/lib/auth/native';
import { ANCHOR_ORG_ID } from '@/lib/types/organization';

const STRONG_PW = 'Sup3rStr0ng!Pass#2026';

describe('上下游邀请流', () => {
  beforeEach(async () => {
    setStore(createInMemoryStore());
    await ensureAnchorOrg();
  });

  it('createDownstreamOrg 建下游组织, 挂在 anchor 下', async () => {
    const org = await createDownstreamOrg({
      name: '华东经销商A',
      category: 'dealer',
      createdBy: 'admin@test.local',
    });
    expect(org.type).toBe('downstream');
    expect(org.parentOrgId).toBe(ANCHOR_ORG_ID);
    expect(org.status).toBe('active');

    const list = await listDownstreamOrgs();
    expect(list.map((o) => o.id)).toContain(org.id);
  });

  it('inviteDownstreamMember + registerWithInvite → 用户权威归属下游组织', async () => {
    const org = await createDownstreamOrg({ name: '供应商B', category: 'supplier', createdBy: 'admin' });
    const inv = await inviteDownstreamMember({
      orgId: org.id,
      email: 'dealer@partner.com',
      invitedById: 'admin',
    });
    expect(inv.membershipType).toBe('upstream_downstream');

    await registerWithInvite({
      email: 'dealer@partner.com',
      name: '经销商小王',
      password: STRONG_PW,
      inviteCode: inv.inviteCode,
    });

    const user = await getStore().auth!.users.findByEmail('dealer@partner.com');
    expect(user).toBeTruthy();
    expect(user?.orgId).toBe(org.id);
    expect(user?.membershipType).toBe('upstream_downstream');
    // 拿外部角色, 不是 internal employee
    expect(user?.membershipType).not.toBe('internal');
  });

  it('individual 组织邀请 → 成员身份 individual', async () => {
    const org = await createDownstreamOrg({ name: '个体张三', type: 'individual', createdBy: 'admin' });
    const inv = await inviteDownstreamMember({ orgId: org.id, email: 'z@s.com', invitedById: 'admin' });
    expect(inv.membershipType).toBe('individual');
  });

  it('不能用下游邀请流邀请到 anchor', async () => {
    await expect(
      inviteDownstreamMember({ orgId: ANCHOR_ORG_ID, email: 'x@y.com', invitedById: 'admin' }),
    ).rejects.toBeInstanceOf(OrgError);
  });

  it('停用的下游组织不能再邀请', async () => {
    const org = await createDownstreamOrg({ name: '门店C', type: 'downstream', createdBy: 'admin' });
    await suspendOrg(org.id, 'admin');
    await expect(
      inviteDownstreamMember({ orgId: org.id, email: 'a@b.com', invitedById: 'admin' }),
    ).rejects.toMatchObject({ code: 'org_suspended' });
  });

  it('backfillUserOrgs: 内部角色→internal/anchor, 外部→pending', async () => {
    const store = getStore();
    await store.auth!.users.create({ email: 'emp@corp.com', name: '员工', roles: ['employee'], tenantId: 'default' });
    await store.auth!.users.create({ email: 'ext@x.com', name: '外部', roles: ['guest'], tenantId: 'default' });

    const res = await backfillUserOrgs();
    expect(res.updated).toBeGreaterThanOrEqual(2);

    const emp = await store.auth!.users.findByEmail('emp@corp.com');
    expect(emp?.membershipType).toBe('internal');
    expect(emp?.orgId).toBe(ANCHOR_ORG_ID);

    const ext = await store.auth!.users.findByEmail('ext@x.com');
    expect(ext?.membershipType).toBe('pending');
  });

  it('backfillUserOrgs: 已有 membershipType 的用户不被覆盖', async () => {
    const store = getStore();
    await store.auth!.users.create({
      email: 'd@x.com',
      name: '下游',
      roles: ['guest'],
      tenantId: 'default',
      orgId: 'org_x',
      membershipType: 'upstream_downstream',
    });
    await backfillUserOrgs();
    const u = await store.auth!.users.findByEmail('d@x.com');
    expect(u?.membershipType).toBe('upstream_downstream');
    expect(u?.orgId).toBe('org_x');
  });
});
