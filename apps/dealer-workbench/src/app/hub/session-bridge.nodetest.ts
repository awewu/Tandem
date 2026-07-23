import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedUserName, hubLoginFallback, resolveHubSession } from './session-bridge';

test('hub session bridge accepts server-side Nexus cookie session without a readable browser token', async () => {
  const decision = await resolveHubSession(
    async () => ({ role: 'sales', userId: 'user-001' }),
    null,
  );

  assert.deepEqual(decision, {
    status: 'authenticated',
    role: 'sales',
    name: '',
  });
});

test('hub session bridge keeps cached display name as a UI hint only', async () => {
  const decision = await resolveHubSession(
    async () => ({ role: 'designer', userId: 'user-002', name: 'Server Name' }),
    JSON.stringify({ name: 'Cached Name', token: 'ignored-local-token' }),
  );

  assert.deepEqual(decision, {
    status: 'authenticated',
    role: 'designer',
    name: 'Cached Name',
  });
});

test('hub session bridge redirects missing session to a diagnostic login fallback', async () => {
  const decision = await resolveHubSession(async () => {
    throw new Error('401');
  });

  assert.deepEqual(decision, {
    status: 'redirect',
    location: '/?returnUrl=%2Fbrand&ssoError=missing_session',
    reason: 'missing_session',
  });
});

test('hub login fallback only keeps same-site return paths', () => {
  assert.equal(hubLoginFallback('/crm/customer/1'), '/?returnUrl=%2Fcrm%2Fcustomer%2F1&ssoError=missing_session');
  assert.equal(hubLoginFallback('https://evil.example'), '/?returnUrl=%2Fbrand&ssoError=missing_session');
  assert.equal(hubLoginFallback('//evil.example'), '/?returnUrl=%2Fbrand&ssoError=missing_session');
});

test('cached user helper ignores malformed or token-like storage payloads', () => {
  assert.equal(cachedUserName('{bad json'), '');
  assert.equal(cachedUserName(JSON.stringify({ client_secret: 'secret', access_token: 'raw-token' })), '');
});
