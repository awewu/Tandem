import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getYonyouMaterialConfig,
  listYonyouMaterialCategories,
  listYonyouMaterialProducts,
  mapYonyouMaterialCategory,
  mapYonyouMaterialToProduct,
  type YonyouMaterialConfig,
} from '@/lib/integrations/yonyou-material';
import { resetYonyouAccessTokenCacheForTests } from '@/lib/integrations/yonyou-token';

const config: YonyouMaterialConfig = {
  baseUrl: 'https://c1.yonyoucloud.com/',
  appKey: 'unit-test-app-key',
  appSecret: 'unit-test-secret',
};

describe('Yonyou material readonly client', () => {
  beforeEach(() => {
    resetYonyouAccessTokenCacheForTests();
  });

  it('maps finished-goods material records to PMS products for display', () => {
    const product = mapYonyouMaterialToProduct({
      id: 1700194312096055299,
      code: 'Z66007',
      name: { simplifiedName: '运输鉴定费' },
      manageClassCode: 'G',
      manageClassName: '成品',
      productLineName: '家用净水',
      productLineCode: 'FW',
      specification: 'RHPD180',
      unitName: '台',
      brandName: 'Rheem',
      stopStatus: false,
      modifyTime: '2026-07-24 17:25:35',
    });

    expect(product).toMatchObject({
      id: 'Z66007',
      series: '家用净水',
      seriesCode: 'FW',
      model: '运输鉴定费',
      modelCode: 'Z66007',
      category: '成品',
      specification: 'RHPD180',
      unit: '台',
      status: 'active',
      source: 'ys',
      sourceRefId: '1700194312096055300',
      sourceUpdatedAt: '2026-07-24 17:25:35',
      attributes: {
        categoryCode: 'G',
        categoryName: '成品',
        brand: 'Rheem',
      },
    });
  });

  it('maps YS material category records for the sidebar tree', () => {
    const category = mapYonyouMaterialCategory({
      id: 'cat-1',
      code: 'AC',
      name: { simplifiedName: '热泵空调主机' },
      parent: 'G',
      order: 3,
      level: 2,
      isEnabled: true,
      orgId: '666666',
    });

    expect(category).toEqual({
      id: 'cat-1',
      code: 'AC',
      name: '热泵空调主机',
      parentId: 'G',
      order: 3,
      level: 2,
      isEnabled: true,
      orgId: '666666',
    });
  });

  it('calls only the material list endpoint with finished-goods category filters', async () => {
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
          recordList: [{ id: 'p1', code: 'Z66007', name: { simplifiedName: '只读成品' } }],
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await listYonyouMaterialProducts({
      config,
      pageIndex: 1,
      pageSize: 20,
      code: 'Z66007',
      categoryCode: 'G',
      enabled: true,
      fetchImpl,
    });

    expect(result.products).toHaveLength(1);
    const materialRequest = requested.find((item) => item.url.includes('/yonbip/digitalModel/product/integration/querylist'));
    expect(materialRequest).toBeTruthy();
    expect(materialRequest?.url).toContain('access_token=readonly-token');
    expect(materialRequest?.init?.method).toBe('POST');
    expect(JSON.parse(String(materialRequest?.init?.body))).toEqual({
      pageIndex: 1,
      pageSize: 20,
      productCodeList: ['Z66007'],
      managerClassCodeList: ['G'],
      stopStatus: false,
    });
    expect(requested.some((item) => /save|enable|disable|delete|audit|stop|submit|updat/i.test(item.url))).toBe(false);
  });

  it('calls only the material category tree endpoint', async () => {
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
            code: 'G',
            name: { simplifiedName: '成品' },
            level: 1,
            isEnabled: true,
          },
        ],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const categories = await listYonyouMaterialCategories({
      config,
      pageIndex: 1,
      pageSize: 100,
      fetchImpl,
    });

    expect(categories).toHaveLength(1);
    const categoryRequest = requested.find((item) => item.url.includes('/yonbip/digitalModel/managementclass/newtree'));
    expect(categoryRequest).toBeTruthy();
    expect(categoryRequest?.url).toContain('access_token=readonly-token');
    expect(categoryRequest?.init?.method).toBe('POST');
    expect(JSON.parse(String(categoryRequest?.init?.body))).toEqual({
      pageIndex: 1,
      pageSize: 100,
    });
    expect(requested.some((item) => /save|enable|disable|delete|audit|stop|submit|updat/i.test(item.url))).toBe(false);
  });

  it('uses YonSuite API prefix without duplicating yonbip', async () => {
    const env = {
      YONSUITE_TOKEN_URL: 'https://yon.example.com/token',
      YONSUITE_API_BASE: 'https://yon.example.com',
      YONSUITE_API_PREFIX: '/iuap-api-gateway/yonbip',
      YONSUITE_APP_KEY: 'suite-key',
      YONSUITE_APP_SECRET: 'suite-secret',
      YONSUITE_PRODUCT_ROOT_CATEGORY_CODES: 'G',
    } as unknown as NodeJS.ProcessEnv;

    const configFromEnv = getYonyouMaterialConfig(env);
    expect(configFromEnv).toMatchObject({
      baseUrl: 'https://yon.example.com',
      apiPrefix: '/iuap-api-gateway/yonbip',
      tokenUrl: 'https://yon.example.com/token',
      productRootCategoryCodes: ['G'],
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

    await listYonyouMaterialProducts({
      config: configFromEnv,
      pageIndex: 1,
      pageSize: 10,
      fetchImpl,
    });

    expect(requested.map((item) => item.url)).toContain(
      'https://yon.example.com/iuap-api-gateway/yonbip/digitalModel/product/integration/querylist?access_token=suite-readonly-token',
    );
  });

  it('falls back to readonly material query paths when the default path is missing', async () => {
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
      if (url.includes('/yonbip/digitalModel/product/integration/querylist')) {
        return new Response(JSON.stringify({ code: '404', message: 'Not found' }), { status: 404 });
      }
      return new Response(JSON.stringify({
        code: '200',
        message: '操作成功',
        data: {
          pageIndex: 1,
          pageSize: 20,
          pageCount: 1,
          recordCount: 1,
          recordList: [{ id: 'p1', code: 'Z66007', name: { simplifiedName: '回退成品' } }],
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await listYonyouMaterialProducts({
      config,
      pageIndex: 1,
      pageSize: 20,
      categoryCode: 'G',
      fetchImpl,
    });

    expect(result.products[0].model).toBe('回退成品');
    expect(requested[0].url).toContain('/getAccessToken');
    expect(requested.slice(1).map((item) => item.url)).toEqual([
      'https://c1.yonyoucloud.com/yonbip/digitalModel/product/integration/querylist?access_token=readonly-token',
      'https://c1.yonyoucloud.com/yonbip/digitalModel/product/newlistrange?access_token=readonly-token',
    ]);
    expect(requested.some((item) => /save|enable|disable|delete|audit|stop|submit|updat/i.test(item.url))).toBe(false);
  });
});
