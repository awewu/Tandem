import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildYonyouStringToSign,
  buildYonyouTokenUrl,
  getYonyouTokenConfig,
  getYonyouAccessToken,
  isYonyouTokenConfigured,
  resetYonyouAccessTokenCacheForTests,
  signYonyouParams,
  type YonyouTokenConfig,
} from '@/lib/integrations/yonyou-token';

const config: YonyouTokenConfig = {
  baseUrl: 'https://c1.yonyoucloud.com/',
  appKey: '41832a3d2df94989b500da6a22268747',
  appSecret: 'unit-test-secret',
};

describe('Yonyou token client', () => {
  beforeEach(() => {
    resetYonyouAccessTokenCacheForTests();
  });

  it('builds the documented string-to-sign by sorted parameter names', () => {
    expect(buildYonyouStringToSign({
      timestamp: 1568098531823,
      appKey: config.appKey,
      signature: 'ignored',
    })).toBe('appKey41832a3d2df94989b500da6a22268747timestamp1568098531823');
  });

  it('signs with HmacSHA256, base64, then URL encoding', () => {
    const params = { appKey: config.appKey, timestamp: 1568098531823 };
    const expected = encodeURIComponent(
      createHmac('sha256', config.appSecret)
        .update('appKey41832a3d2df94989b500da6a22268747timestamp1568098531823', 'utf8')
        .digest('base64'),
    );

    expect(signYonyouParams(params, config.appSecret)).toBe(expected);
  });

  it('builds the upgraded self-app token URL without double-encoding signature', () => {
    const url = buildYonyouTokenUrl(config, 1568098531823);
    const expectedSignature = signYonyouParams({
      appKey: config.appKey,
      timestamp: 1568098531823,
    }, config.appSecret);

    expect(url).toBe(
      `https://c1.yonyoucloud.com/iuap-api-auth/open-auth/selfAppAuth/base/v1/getAccessToken` +
      `?appKey=${config.appKey}&timestamp=1568098531823&signature=${expectedSignature}`,
    );
    expect(url).not.toContain('%25');
  });

  it('accepts YonSuite environment variable aliases', () => {
    const env = {
      YONSUITE_TOKEN_URL: 'https://yon.example.com/token',
      YONSUITE_API_BASE: 'https://yon.example.com',
      YONSUITE_API_PREFIX: '/iuap-api-gateway/yonbip',
      YONSUITE_APP_KEY: 'suite-key',
      YONSUITE_APP_SECRET: 'suite-secret',
    } as unknown as NodeJS.ProcessEnv;

    expect(isYonyouTokenConfigured(env)).toBe(true);
    expect(getYonyouTokenConfig(env)).toMatchObject({
      baseUrl: 'https://yon.example.com',
      appKey: 'suite-key',
      appSecret: 'suite-secret',
      tokenUrl: 'https://yon.example.com/token',
    });
    expect(buildYonyouTokenUrl(getYonyouTokenConfig(env), 1568098531823))
      .toContain('https://yon.example.com/token?appKey=suite-key&timestamp=1568098531823&signature=');
  });

  it('fetches and caches a successful token response', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      code: '00000',
      message: '成功！',
      data: { access_token: 'token-with-special+/=', expire: 7200 },
    }), { status: 200 })) as unknown as typeof fetch;

    const first = await getYonyouAccessToken({ config, fetchImpl, now: 1_700_000_000_000 });
    const second = await getYonyouAccessToken({ config, fetchImpl, now: 1_700_000_060_000 });

    expect(first).toMatchObject({
      accessToken: 'token-with-special+/=',
      expireSeconds: 7200,
      cached: false,
    });
    expect(first.accessToken).toBe('token-with-special+/=');
    expect(second.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a sanitized request error when Yonyou returns a failure code', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      code: '10001',
      message: 'invalid signature',
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(getYonyouAccessToken({ config, fetchImpl, now: 1_700_000_000_000 }))
      .rejects
      .toMatchObject({
        name: 'YonyouTokenRequestError',
        details: {
          code: '10001',
          yonyouMessage: 'invalid signature',
        },
      });
  });
});
