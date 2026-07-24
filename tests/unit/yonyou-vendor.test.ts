import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getYonyouVendorListConfig,
  listYonyouVendorDealerProfiles,
  mapYonyouVendorToDealerProfile,
  type YonyouVendorListConfig,
} from '@/lib/integrations/yonyou-vendor';
import { resetYonyouAccessTokenCacheForTests } from '@/lib/integrations/yonyou-token';

const config: YonyouVendorListConfig = {
  baseUrl: 'https://c1.yonyoucloud.com/',
  appKey: 'unit-test-app-key',
  appSecret: 'unit-test-secret',
};

describe('Yonyou vendor readonly client', () => {
  beforeEach(() => {
    resetYonyouAccessTokenCacheForTests();
  });

  it('maps YS vendor records to PMS dealer profiles for display', () => {
    const profile = mapYonyouVendorToDealerProfile({
      id: 1891832769614080,
      code: 'l0020011',
      name: '供应商11',
      stop: false,
      vendorclass_name: '供应商分类002',
      org_name: '企业账号级',
      creditcode: 'JC01X00001',
      vendoremail: 'test@yonyou.com',
      vendoraddress: '北京市海淀区',
      legalBody: '王宝强',
      registerFund: '2000000',
      foundDate: '2021-11-01 00:00:00',
      pubts: '2020-08-29 10:31:48',
      contactsList: [
        { contactname: '王宝强', contactmobile: '15701656475', defaultcontact: true },
      ],
    });

    expect(profile).toMatchObject({
      id: '1891832769614080',
      orgId: '1891832769614080',
      code: 'l0020011',
      name: '供应商11',
      contactName: '王宝强',
      contactPhone: '15701656475',
      contactEmail: 'test@yonyou.com',
      businessLicense: 'JC01X00001',
      registeredCapital: 2000000,
      establishedDate: '2021-11-01',
      coverageRegions: ['企业账号级', '供应商分类002'],
      source: 'ys',
      status: 'active',
      address: '北京市海淀区',
      legalBody: '王宝强',
      sourceUpdatedAt: '2020-08-29 10:31:48',
    });
  });

  it('calls only the documented vendor list endpoint', async () => {
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
          pageIndex: 1,
          pageSize: 20,
          pageCount: 1,
          recordCount: 1,
          recordList: [{ id: 'v1', code: 'V001', name: '只读供应商' }],
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await listYonyouVendorDealerProfiles({
      config: { ...config, vendorOrgIds: ['666666'], manageOrgIds: ['888888'] },
      pageIndex: 1,
      pageSize: 20,
      code: 'V001',
      fetchImpl,
    });

    expect(result.profiles).toHaveLength(1);
    const vendorRequest = requested.find((item) => item.url.includes('/yonbip/digitalModel/vendor/list'));
    expect(vendorRequest).toBeTruthy();
    expect(vendorRequest?.url).toContain('access_token=readonly-token');
    expect(vendorRequest?.init?.method).toBe('POST');
    expect(JSON.parse(String(vendorRequest?.init?.body))).toEqual({
      pageIndex: 1,
      pageSize: 20,
      vendororg: ['666666'],
      org: ['888888'],
      code: 'V001',
    });
    expect(requested.some((item) => /save|enable|disable|delete|audit/i.test(item.url))).toBe(false);
  });

  it('uses YonSuite API prefix without duplicating yonbip', async () => {
    const env = {
      YONSUITE_TOKEN_URL: 'https://yon.example.com/token',
      YONSUITE_API_BASE: 'https://yon.example.com',
      YONSUITE_API_PREFIX: '/iuap-api-gateway/yonbip',
      YONSUITE_APP_KEY: 'suite-key',
      YONSUITE_APP_SECRET: 'suite-secret',
    } as unknown as NodeJS.ProcessEnv;

    const configFromEnv = getYonyouVendorListConfig(env);
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

    await listYonyouVendorDealerProfiles({
      config: configFromEnv,
      pageIndex: 1,
      pageSize: 10,
      fetchImpl,
    });

    expect(requested.map((item) => item.url)).toContain(
      'https://yon.example.com/iuap-api-gateway/yonbip/digitalModel/vendor/list?access_token=suite-readonly-token',
    );
  });
});
