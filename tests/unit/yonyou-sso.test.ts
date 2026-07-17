import { describe, expect, it, vi } from 'vitest';
import {
  buildYonyouLoginCodeUrl,
  buildYonyouSsoRedirectUrl,
  getYonyouSsoLoginCode,
  getYonyouSsoConfig,
  type YonyouSsoConfig,
} from '@/lib/integrations/yonyou-sso';

vi.mock('@/lib/integrations/yonyou-token', () => ({
  getYonyouAccessToken: vi.fn(async () => ({
    accessToken: 'access-token',
    cached: false,
    expireSeconds: 7200,
    expiresAt: '2026-07-17T10:00:00.000Z',
  })),
}));

const config: YonyouSsoConfig = {
  apiBaseUrl: 'https://c4.yonyoucloud.com',
  thirdUcId: 'm6vk9j52',
  ssoBaseUrl: 'https://euc.yonyoucloud.com',
  loginService: 'https://c4.yonyoucloud.com/',
  loginPath: '/cas/thirdOauth2CodeLogin',
  loginCodePath: '/iuap-api-gateway/yonbip/yht/getThirdLoginCode',
  timeoutMs: 8000,
};

describe('Yonyou SSO helpers', () => {
  it('reads SSO config from env defaults', () => {
    const parsed = getYonyouSsoConfig({
      YONYOU_ERP_BASE_URL: 'https://c4.yonyoucloud.com',
      YONYOU_ERP_THIRD_UC_ID: 'm6vk9j52',
      YONYOU_ERP_TENANT_ID: 'tenant-001',
    } as unknown as NodeJS.ProcessEnv);

    expect(parsed).toMatchObject({
      apiBaseUrl: 'https://c4.yonyoucloud.com',
      thirdUcId: 'm6vk9j52',
      ssoBaseUrl: 'https://euc.yonyoucloud.com',
      loginService: 'https://c4.yonyoucloud.com/login?tenantId=tenant-001',
    });
  });

  it('builds the login code URL with access_token in query', () => {
    const url = buildYonyouLoginCodeUrl(config, {
      accessToken: 'token-with-special+/=',
    });

    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      'https://c4.yonyoucloud.com/iuap-api-gateway/yonbip/yht/getThirdLoginCode',
    );
    expect(parsed.searchParams.get('access_token')).toBe('token-with-special+/=');
  });

  it('builds the final Yonyou redirect URL', () => {
    const url = buildYonyouSsoRedirectUrl(config, 'one-time-code');
    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://euc.yonyoucloud.com/cas/thirdOauth2CodeLogin');
    expect(parsed.searchParams.get('thirdUCId')).toBe('m6vk9j52');
    expect(parsed.searchParams.get('code')).toBe('one-time-code');
    expect(parsed.searchParams.get('service')).toBe('https://c4.yonyoucloud.com/');
  });

  it('accepts Yonyou login-code responses with business code 200', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      code: '200',
      data: 'issued-login-code',
    })) as unknown as Response;

    await expect(getYonyouSsoLoginCode({
      userId: '1001',
      config,
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toBe('issued-login-code');
  });
});
