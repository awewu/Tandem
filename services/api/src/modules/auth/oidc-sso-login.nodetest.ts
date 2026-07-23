import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { AuthController } from './auth.controller';
import {
  OidcSsoLoginService,
  SSO_REDIRECT_COOKIE,
  SSO_STATE_COOKIE,
} from './oidc-sso-login.service';

type Config = Record<string, string | undefined>;

const DISCOVERY = {
  authorization_endpoint: 'https://ai.rhautt.com/oauth2/authorize',
};

function service(config: Config = {}) {
  return new OidcSsoLoginService({
    get: (key: string) => config[key],
  } as any);
}

function withFetch(
  handler: (input: string, init?: RequestInit) => Promise<Partial<Response> & { json?: () => Promise<unknown> }>
) {
  const original = globalThis.fetch;
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ input: url, init });
    return handler(url, init) as Promise<Response>;
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function findCookie(cookies: string[], name: string): string {
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));
  assert.ok(cookie, `${name} cookie should be present`);
  return cookie;
}

function cookieValue(cookie: string): string {
  return decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';')));
}

test('OIDC login uses discovery from the configured issuer', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service({ OIDC_ISSUER: 'https://issuer.example/' }).createLoginRedirect('/hub');

    assert.equal(
      fetchMock.calls[0].input,
      'https://issuer.example/.well-known/openid-configuration'
    );
    assert.equal(new URL(result.location).origin, 'https://ai.rhautt.com');
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login fails closed when discovery fails', async () => {
  const fetchMock = withFetch(async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  }));
  try {
    await assert.rejects(() => service().createLoginRedirect('/hub'), /OIDC discovery failed/);
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login fails closed when discovery omits authorization endpoint', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => ({ issuer: 'https://ai.rhautt.com' }),
  }));
  try {
    await assert.rejects(
      () => service().createLoginRedirect('/hub'),
      /OIDC authorization endpoint missing/
    );
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login redirect contains authorization code parameters', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service({
      OIDC_CLIENT_ID: 'client-a',
      OIDC_REDIRECT_URI: 'http://localhost:5000/api/v2/auth/sso/callback',
      OIDC_SCOPES: 'openid profile',
    }).createLoginRedirect('/hub');

    const url = new URL(result.location);
    assert.equal(url.pathname, '/oauth2/authorize');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), 'client-a');
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'http://localhost:5000/api/v2/auth/sso/callback'
    );
    assert.equal(url.searchParams.get('scope'), 'openid profile');
    assert.equal(url.searchParams.get('state'), result.state);
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login defaults missing post-login redirect to /brand', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service().createLoginRedirect();
    assert.equal(result.redirect, '/brand');
    assert.equal(cookieValue(findCookie(result.cookies, SSO_REDIRECT_COOKIE)), '/brand');
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login default local client returns through localhost callback before requested same-site path', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service().createLoginRedirect('/hub');
    const url = new URL(result.location);

    assert.equal(url.searchParams.get('client_id'), 'cli_mrvdz1yr8jfzrb8u');
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'http://localhost:5000/api/v2/auth/sso/callback'
    );
    assert.equal(result.redirect, '/hub');
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login default production client returns through nexus callback before requested same-site path', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service({ NODE_ENV: 'production' }).createLoginRedirect('/hub');
    const url = new URL(result.location);

    assert.equal(url.searchParams.get('client_id'), 'cli_mrve0bgvgnl2gkjg');
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://nexus.rhautt.com/api/v2/auth/sso/callback'
    );
    assert.equal(result.redirect, '/hub');
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login normalizes external post-login redirects to /brand', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service().createLoginRedirect('https://example.com');
    assert.equal(result.redirect, '/brand');
    assert.equal(cookieValue(findCookie(result.cookies, SSO_REDIRECT_COOKIE)), '/brand');
  } finally {
    fetchMock.restore();
  }
});

test('OIDC login creates short-lived HTTP-only state cookie', async () => {
  const fetchMock = withFetch(async () => ({
    ok: true,
    json: async () => DISCOVERY,
  }));
  try {
    const result = await service().createLoginRedirect('/hub');
    const stateCookie = findCookie(result.cookies, SSO_STATE_COOKIE);

    assert.equal(result.state.length >= 32, true);
    assert.equal(new URL(result.location).searchParams.get('state'), result.state);
    assert.equal(cookieValue(stateCookie), result.state);
    assert.match(stateCookie, /Path=\/api\/v2\/auth\/sso/);
    assert.match(stateCookie, /Max-Age=300/);
    assert.match(stateCookie, /HttpOnly/);
    assert.match(stateCookie, /SameSite=Lax/);
  } finally {
    fetchMock.restore();
  }
});

test('AuthController exposes public GET SSO login and writes redirect response', async () => {
  const sso = {
    async createLoginRedirect() {
      return {
        location: 'https://ai.rhautt.com/oauth2/authorize?state=state-a',
        cookies: ['nx_sso_state=state-a; HttpOnly'],
      };
    },
  };
  const controller = new AuthController({} as any, sso as any);
  const headers: Record<string, unknown> = {};
  const response = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    header(name: string, value: unknown) {
      headers[name] = value;
      return this;
    },
    send() {
      return { statusCode: this.statusCode, headers };
    },
  };

  const result = await controller.ssoLogin('/hub', response);
  const handler = AuthController.prototype.ssoLogin;

  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, handler), true);
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), 'sso/login');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), RequestMethod.GET);
  assert.equal(result.statusCode, 302);
  assert.equal(headers.Location, 'https://ai.rhautt.com/oauth2/authorize?state=state-a');
  assert.deepEqual(headers['Set-Cookie'], ['nx_sso_state=state-a; HttpOnly']);
});

test('AuthController redirects SSO login failures to a diagnostic brand fallback', async () => {
  const sso = {
    async createLoginRedirect() {
      throw new Error('OIDC disabled');
    },
  };
  const controller = new AuthController({} as any, sso as any, {} as any);
  const headers: Record<string, unknown> = {};
  const response = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    header(name: string, value: unknown) {
      headers[name] = value;
      return this;
    },
    send() {
      return { statusCode: this.statusCode, headers };
    },
  };

  const result = await controller.ssoLogin('/hub', response);

  assert.equal(result.statusCode, 302);
  assert.equal(headers.Location, '/?returnUrl=%2Fbrand&ssoError=sso_unavailable');
});
