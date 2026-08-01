import { describe, expect, it } from 'vitest';
import { mergeDealerProfilesWithOrganizations } from '@/lib/pms/dealer-options';
import type { Organization } from '@/lib/types/organization';

function org(overrides: Partial<Organization>): Organization {
  return {
    id: 'org_default',
    name: '默认组织',
    type: 'downstream',
    parentOrgId: 'org_anchor_default',
    category: 'dealer',
    tenantId: 'default',
    status: 'active',
    createdAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('PMS 经销商选项', () => {
  it('没有 PMS 档案时，从组织中的经销商生成下拉选项', () => {
    const options = mergeDealerProfilesWithOrganizations([], [
      org({ id: 'org_anchor_default', name: '总部', type: 'anchor', category: undefined, parentOrgId: null }),
      org({ id: 'dealer_huadong', name: '华东建材连锁', category: 'dealer' }),
      org({ id: 'supplier_suzhou', name: '苏州供应商', category: 'supplier' }),
    ]);

    expect(options).toEqual([
      expect.objectContaining({
        orgId: 'dealer_huadong',
        orgName: '华东建材连锁',
        category: 'dealer',
        source: 'organization',
      }),
    ]);
  });

  it('已有 PMS 档案时，使用档案并补充组织名称，不重复追加组织选项', () => {
    const options = mergeDealerProfilesWithOrganizations(
      [{ id: 'profile_1', orgId: 'dealer_huadong', contactName: '张三' }],
      [org({ id: 'dealer_huadong', name: '华东建材连锁', category: 'dealer' })],
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toEqual(expect.objectContaining({
      id: 'profile_1',
      orgId: 'dealer_huadong',
      orgName: '华东建材连锁',
      contactName: '张三',
      source: 'pms',
    }));
  });
});
