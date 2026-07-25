import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getYonyouCustomerListConfig,
  listYonyouCustomerCategories,
  listYonyouCustomerDealerProfiles,
  mapYonyouCustomerCategory,
  mapYonyouCustomerToDealerProfile,
  type YonyouCustomerListConfig,
} from '@/lib/integrations/yonyou-customer';
import { resetYonyouAccessTokenCacheForTests } from '@/lib/integrations/yonyou-token';

const config: YonyouCustomerListConfig = {
  baseUrl: 'https://c1.yonyoucloud.com/',
  appKey: 'unit-test-app-key',
  appSecret: 'unit-test-secret',
};

describe('Yonyou customer readonly client', () => {
  beforeEach(() => {
    resetYonyouAccessTokenCacheForTests();
  });

  it('maps YS customer records to PMS dealer profiles for display', () => {
    const profile = mapYonyouCustomerToDealerProfile({
      id: 1700194312096055299,
      code: 'CUST001',
      name: { simplifiedName: '成都福斯帆特电子技术有限公司' },
      shortname: { simplifiedName: '福斯帆特' },
      customerClassName: '货运代理',
      countryName: '中国',
      regionCode: '四川',
      creditCode: '91510116MA6APNNTX9',
      leaderName: '毛伟锋',
      contactName: '张三',
      contactTel: '18080436316',
      email: 'customer@example.com',
      address: { simplifiedName: '中国（四川）自由贸易试验区成都市双流区' },
      money: '2000000',
      buildTime: '2021-06-23 00:00:00',
      stopStatus: false,
      modifyTime: '2026-07-24 17:25:35',
    });

    expect(profile).toMatchObject({
      id: 'CUST001',
      orgId: 'CUST001',
      code: 'CUST001',
      name: '成都福斯帆特电子技术有限公司',
      contactName: '张三',
      contactPhone: '18080436316',
      contactEmail: 'customer@example.com',
      businessLicense: '91510116MA6APNNTX9',
      registeredCapital: 2000000,
      establishedDate: '2021-06-23',
      coverageRegions: ['中国', '四川', '货运代理'],
      source: 'ys',
      status: 'active',
      customerClassName: '货运代理',
      address: '中国（四川）自由贸易试验区成都市双流区',
      legalBody: '毛伟锋',
      sourceUpdatedAt: '2026-07-24 17:25:35',
    });
  });

  it('maps YS customer category records for the sidebar tree', () => {
    const category = mapYonyouCustomerCategory({
      id: 'cat-1',
      code: 'JY',
      name: { simplifiedName: '家用' },
      parent: 'root',
      order: 3,
      level: 2,
      isEnabled: true,
      orgId: '666666',
    });

    expect(category).toEqual({
      id: 'cat-1',
      code: 'JY',
      name: '家用',
      parentId: 'root',
      order: 3,
      level: 2,
      isEnabled: true,
      orgId: '666666',
    });
  });

  it('calls only the documented customer list endpoint', async () => {
    const requested: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requested.push({ url, init });
      if (url.includes('/getAccessToken')) {
        return new Response(JSON.stringify({
          code: '00000',
          message: '成功',
          data: { access_token: 'readonly-token', expire: 7200 },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        code: '200',
        message: '操作成功',
        data: {
          pageIndex: '1',
          pageSize: '20',
          pageCount: '1',
          recordCount: '1',
          recordList: [{ id: 'c1', code: 'C001', name: { simplifiedName: '只读客户' } }],
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await listYonyouCustomerDealerProfiles({
      config,
      pageIndex: 1,
      pageSize: 20,
      code: 'C001',
      name: '只读客户',
      customerClassCode: 'JY',
      stopStatus: false,
      fetchImpl,
    });

    expect(result.profiles).toHaveLength(1);
    const customerRequest = requested.find((item) => item.url.includes('/yonbip/digitalModel/merchant/newlistrange'));
    expect(customerRequest).toBeTruthy();
    expect(customerRequest?.url).toContain('access_token=readonly-token');
    expect(customerRequest?.init?.method).toBe('POST');
    expect(JSON.parse(String(customerRequest?.init?.body))).toEqual({
      pageIndex: 1,
      pageSize: 20,
      code: 'C001',
      name: '只读客户',
      customerClassCode: 'JY',
      stopStatus: false,
      filterPotential: false,
    });
    expect(requested.some((item) => /save|enable|disable|delete|audit|stop/i.test(item.url))).toBe(false);
  });

  it('calls only the documented customer category tree endpoint', async () => {
    const requested: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requested.push({ url, init });
      if (url.includes('/getAccessToken')) {
        return new Response(JSON.stringify({
          code: '00000',
          message: '成功',
          data: { access_token: 'readonly-token', expire: 7200 },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        code: '200',
        message: '操作成功',
        data: [
          {
            id: 'cat-1',
            code: 'JY',
            name: { simplifiedName: '家用' },
            level: 1,
            isEnabled: true,
          },
        ],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const categories = await listYonyouCustomerCategories({
      config,
      pageIndex: 1,
      pageSize: 100,
      fetchImpl,
    });

    expect(categories).toHaveLength(1);
    const categoryRequest = requested.find((item) => item.url.includes('/yonbip/digitalModel/custcategory/newtree'));
    expect(categoryRequest).toBeTruthy();
    expect(categoryRequest?.url).toContain('access_token=readonly-token');
    expect(categoryRequest?.init?.method).toBe('POST');
    expect(JSON.parse(String(categoryRequest?.init?.body))).toEqual({
      pageIndex: 1,
      pageSize: 100,
    });
    expect(requested.some((item) => /save|enable|disable|delete|audit|stop/i.test(item.url))).toBe(false);
  });

  it('uses YonSuite API prefix without duplicating yonbip', async () => {
    const env = {
      YONSUITE_TOKEN_URL: 'https://yon.example.com/token',
      YONSUITE_API_BASE: 'https://yon.example.com',
      YONSUITE_API_PREFIX: '/iuap-api-gateway/yonbip',
      YONSUITE_APP_KEY: 'suite-key',
      YONSUITE_APP_SECRET: 'suite-secret',
    } as unknown as NodeJS.ProcessEnv;

    const configFromEnv = getYonyouCustomerListConfig(env);
    expect(configFromEnv).toMatchObject({
      baseUrl: 'https://yon.example.com',
      apiPrefix: '/iuap-api-gateway/yonbip',
      tokenUrl: 'https://yon.example.com/token',
    });

    const requested: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requested.push({ url, init });
      if (url.includes('/token')) {
        return new Response(JSON.stringify({
          code: '00000',
          message: '成功',
          data: { access_token: 'suite-readonly-token', expire: 7200 },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        code: '200',
        message: '操作成功',
        data: {
          pageIndex: 1,
          pageSize: 10,
          pageCount: 1,
          recordCount: 0,
          recordList: [],
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    await listYonyouCustomerDealerProfiles({
      config: configFromEnv,
      pageIndex: 1,
      pageSize: 10,
      fetchImpl,
    });

    expect(requested.map((item) => item.url)).toContain(
      'https://yon.example.com/iuap-api-gateway/yonbip/digitalModel/merchant/newlistrange?access_token=suite-readonly-token',
    );
  });
});
