import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAnchorOrg } from '@/lib/auth/bootstrap';
import {
  isYonyouCustomerConfigured,
  listYonyouCustomerDealerProfiles,
} from '@/lib/integrations/yonyou-customer';
import { resolveDealerOrgId } from '@/lib/pms/dealer-resolver';
import type { PmsAuthResult } from '@/lib/pms/pms-auth';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import { ANCHOR_ORG_ID } from '@/lib/types/organization';

vi.mock('@/lib/integrations/yonyou-customer', () => ({
  isYonyouCustomerConfigured: vi.fn(),
  listYonyouCustomerDealerProfiles: vi.fn(),
}));

function auth(): PmsAuthResult {
  return {
    userId: 'u_internal',
    email: 'internal@test.local',
    tenantId: 'default',
    roles: ['admin'],
    mfaVerified: true,
    demo: false,
    isInternal: true,
    isDealer: false,
    visibleOrgIds: [],
    orgId: ANCHOR_ORG_ID,
  } as PmsAuthResult;
}

describe('PMS 经销商引用解析', () => {
  beforeEach(async () => {
    vi.mocked(isYonyouCustomerConfigured).mockReturnValue(false);
    vi.mocked(listYonyouCustomerDealerProfiles).mockReset();
    setStore(createInMemoryStore());
    await ensureAnchorOrg();
  });

  it('按本地经销商组织名称或ID解析', async () => {
    await getStore().organizations.create({
      id: 'dealer_shanghai_ruihe',
      name: '上海瑞和经销商',
      type: 'downstream',
      parentOrgId: ANCHOR_ORG_ID,
      category: 'dealer',
      tenantId: 'default',
      status: 'active',
      createdAt: '2026-08-03T00:00:00.000Z',
      createdBy: 'u_internal',
    });

    await expect(resolveDealerOrgId(auth(), '上海瑞和经销商')).resolves.toBe('dealer_shanghai_ruihe');
    await expect(resolveDealerOrgId(auth(), 'dealer_shanghai_ruihe')).resolves.toBe('dealer_shanghai_ruihe');
  });

  it('批量导入只填经销商名称时，也能从YS经销商管理数据解析并落本地组织', async () => {
    vi.mocked(isYonyouCustomerConfigured).mockReturnValue(true);
    vi.mocked(listYonyouCustomerDealerProfiles).mockResolvedValue({
      pageIndex: 1,
      pageSize: 10,
      pageCount: 1,
      recordCount: 1,
      records: [],
      profiles: [{
        id: 'YS-SH-RH',
        orgId: 'YS-SH-RH',
        code: 'YS-SH-RH',
        name: '上海瑞和经销商',
        source: 'ys',
        status: 'active',
        coverageRegions: [],
      }],
    });

    const resolved = await resolveDealerOrgId(auth(), '上海瑞和经销商');

    expect(resolved).toMatch(/^org_/);
    const org = await getStore().organizations.get(resolved!);
    expect(org).toEqual(expect.objectContaining({
      name: '上海瑞和经销商',
      category: 'dealer',
      status: 'active',
    }));
  });

  it('不会把YS停用经销商解析为有效归属', async () => {
    vi.mocked(isYonyouCustomerConfigured).mockReturnValue(true);
    vi.mocked(listYonyouCustomerDealerProfiles).mockResolvedValue({
      pageIndex: 1,
      pageSize: 10,
      pageCount: 1,
      recordCount: 1,
      records: [],
      profiles: [{
        id: 'YS-STOPPED',
        orgId: 'YS-STOPPED',
        code: 'YS-STOPPED',
        name: '停用经销商',
        source: 'ys',
        status: 'stopped',
        coverageRegions: [],
      }],
    });

    await expect(resolveDealerOrgId(auth(), '停用经销商')).resolves.toBeNull();
  });
});
