import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSsoProxyTarget,
  DEFAULT_SSO_API_ORIGIN,
  resolveSsoApiOrigin,
  setCookieHeaders,
} from './proxy';

test('SSO proxy defaults to the NestJS API origin', () => {
  assert.equal(resolveSsoApiOrigin({}), DEFAULT_SSO_API_ORIGIN);
});

test('SSO proxy preserves path and query when forwarding to NestJS', () => {
  const target = buildSsoProxyTarget(
    ['callback'],
    'http://localhost:5000/api/v2/auth/sso/callback?code=a&state=b',
    { API_URL: 'http://localhost:5500/' },
  );

  assert.equal(
    target,
    'http://localhost:5500/api/v2/auth/sso/callback?code=a&state=b',
  );
});

test('SSO proxy prefers NEXUS_API_URL over API_URL', () => {
  const target = buildSsoProxyTarget(['login'], 'http://localhost:5000/api/v2/auth/sso/login', {
    API_URL: 'http://localhost:5500',
    NEXUS_API_URL: 'http://127.0.0.1:3301',
  });

  assert.equal(target, 'http://127.0.0.1:3301/api/v2/auth/sso/login');
});

test('SSO proxy copies set-cookie headers', () => {
  const headers = new Headers();
  headers.append('set-cookie', 'nx_sso_state=a; Path=/api/v2/auth/sso; HttpOnly');

  assert.deepEqual(setCookieHeaders(headers), [
    'nx_sso_state=a; Path=/api/v2/auth/sso; HttpOnly',
  ]);
});
