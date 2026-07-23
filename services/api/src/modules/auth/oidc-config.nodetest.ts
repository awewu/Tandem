import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OIDC_LOCAL_REFERENCE,
  OIDC_PRODUCTION_REFERENCE,
  assertOidcRuntimeConfig,
  readOidcRuntimeConfig,
} from './oidc-config';

test('OIDC config reads the local client reference without exposing a secret default', () => {
  const config = readOidcRuntimeConfig({
    OIDC_ISSUER: OIDC_LOCAL_REFERENCE.issuer,
    OIDC_CLIENT_ID: OIDC_LOCAL_REFERENCE.clientId,
    OIDC_REDIRECT_URI: OIDC_LOCAL_REFERENCE.redirectUri,
    OIDC_SCOPES: OIDC_LOCAL_REFERENCE.scopes,
    OIDC_POST_LOGIN_REDIRECT: OIDC_LOCAL_REFERENCE.postLoginRedirect,
  });

  assert.equal(config.issuer, 'https://ai.rhautt.com');
  assert.equal(config.clientId, 'cli_mrvdz1yr8jfzrb8u');
  assert.equal(config.clientSecret, '');
  assert.equal(config.redirectUri, 'http://localhost:5000/api/v2/auth/sso/callback');
  assert.deepEqual(config.scopes, ['openid', 'profile', 'email', 'roles', 'org']);
  assert.equal(config.postLoginRedirect, '/brand');
});

test('OIDC config documents the production client reference', () => {
  assert.equal(OIDC_PRODUCTION_REFERENCE.clientId, 'cli_mrve0bgvgnl2gkjg');
  assert.equal(
    OIDC_PRODUCTION_REFERENCE.redirectUri,
    'https://nexus.rhautt.com/api/v2/auth/sso/callback'
  );
  assert.equal(OIDC_PRODUCTION_REFERENCE.postLoginRedirect, '/brand');
});

test('OIDC config requires a server-side client secret for activation', () => {
  assert.throws(
    () =>
      assertOidcRuntimeConfig({
        OIDC_ISSUER: OIDC_LOCAL_REFERENCE.issuer,
        OIDC_CLIENT_ID: OIDC_LOCAL_REFERENCE.clientId,
        OIDC_REDIRECT_URI: OIDC_LOCAL_REFERENCE.redirectUri,
        OIDC_SCOPES: OIDC_LOCAL_REFERENCE.scopes,
        OIDC_POST_LOGIN_REDIRECT: OIDC_LOCAL_REFERENCE.postLoginRedirect,
      }),
    /OIDC_CLIENT_SECRET/
  );

  assert.throws(
    () =>
      assertOidcRuntimeConfig({
        OIDC_ISSUER: OIDC_LOCAL_REFERENCE.issuer,
        OIDC_CLIENT_ID: OIDC_LOCAL_REFERENCE.clientId,
        OIDC_CLIENT_SECRET: 'replace-with-secret-manager-value',
        OIDC_REDIRECT_URI: OIDC_LOCAL_REFERENCE.redirectUri,
        OIDC_SCOPES: OIDC_LOCAL_REFERENCE.scopes,
        OIDC_POST_LOGIN_REDIRECT: OIDC_LOCAL_REFERENCE.postLoginRedirect,
      }),
    /server-side secret channel/
  );
});
