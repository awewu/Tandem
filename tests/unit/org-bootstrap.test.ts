/**
 * 组织模型 bootstrap · 回归锁 (上下游 anchor org)
 *
 * 覆盖:
 *   - ensureAnchorOrg 幂等创建上游本部组织 (固定 ANCHOR_ORG_ID)
 *   - bootstrapOwnerIfMissing 在建 owner 时归属 internal/anchor
 *   - 无 owner env 时仍确保 anchor org 存在
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { ensureAnchorOrg, bootstrapOwnerIfMissing } from '@/lib/auth/bootstrap';
import { ANCHOR_ORG_ID } from '@/lib/types/organization';

const SAVED_ENV = { ...process.env };

describe('组织模型 bootstrap · anchor org', () => {
  beforeEach(() => {
    setStore(createInMemoryStore());
    delete process.env.TANDEM_BOOTSTRAP_OWNER_EMAIL;
    delete process.env.TANDEM_BOOTSTRAP_OWNER_PASSWORD;
    delete process.env.TANDEM_BOOTSTRAP_ORG_NAME;
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('ensureAnchorOrg 幂等创建固定 id 的 anchor 组织', async () => {
    await ensureAnchorOrg();
    const org = await getStore().organizations.get(ANCHOR_ORG_ID);
    expect(org).toBeTruthy();
    expect(org?.id).toBe(ANCHOR_ORG_ID);
    expect(org?.type).toBe('anchor');
    expect(org?.parentOrgId).toBeNull();

    // 再次调用不应重复创建 / 报错
    await ensureAnchorOrg();
    const all = await getStore().organizations.list();
    expect(all.filter((o) => o.id === ANCHOR_ORG_ID)).toHaveLength(1);
  });

  it('无 owner env 时也确保 anchor org 存在 (与建 owner 解耦)', async () => {
    await bootstrapOwnerIfMissing();
    const org = await getStore().organizations.get(ANCHOR_ORG_ID);
    expect(org).toBeTruthy();
  });

  it('建 owner 时归属 internal/anchor', async () => {
    process.env.TANDEM_BOOTSTRAP_OWNER_EMAIL = 'owner@test.local';
    process.env.TANDEM_BOOTSTRAP_OWNER_PASSWORD = 'Sup3rStr0ng!Pass#2026';
    process.env.TANDEM_BOOTSTRAP_OWNER_NAME = 'TestOwner';

    await bootstrapOwnerIfMissing();

    const user = await getStore().auth!.users.findByEmail('owner@test.local');
    expect(user).toBeTruthy();
    expect(user?.orgId).toBe(ANCHOR_ORG_ID);
    expect(user?.membershipType).toBe('internal');

    const org = await getStore().organizations.get(ANCHOR_ORG_ID);
    expect(org).toBeTruthy();
  });
});
