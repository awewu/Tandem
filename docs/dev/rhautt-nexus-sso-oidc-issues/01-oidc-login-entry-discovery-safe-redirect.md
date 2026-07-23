# Issue 01: OIDC 登录入口、发现配置和安全跳转

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Build the first end-to-end SSO entry path for Rhautt Nexus: a user opens `/api/v2/auth/sso/login?redirect=/hub`, Nexus validates that the post-login redirect is a safe same-site path, creates an anti-CSRF `state`, discovers the IdP authorization endpoint from `https://ai.rhautt.com/.well-known/openid-configuration`, and redirects the browser to the IdP with the correct OIDC Authorization Code parameters.

This issue intentionally stops before callback code exchange or Nexus session creation. Its completed behavior is observable by calling the login endpoint and inspecting the redirect location and transient state handling.

## Acceptance criteria

- [ ] `GET /api/v2/auth/sso/login` exists under the auth module and is marked public.
- [ ] The endpoint uses OIDC discovery from the configured issuer instead of hardcoding authorization/token/userinfo/JWKS endpoints.
- [ ] The endpoint sends `response_type=code`, active `client_id`, active `redirect_uri`, requested scopes, and `state`.
- [ ] `redirect=/hub` is preserved for the later callback.
- [ ] Missing `redirect` defaults to `/hub`.
- [ ] External redirects such as `https://example.com` are rejected or normalized to `/hub`.
- [ ] Generated `state` is stored in an HTTP-only cookie or equivalent server-side transient store with a short lifetime.
- [ ] Focused tests cover discovery success, discovery failure, redirect URL construction, default redirect, external redirect rejection, and state creation.

## Blocked by

None - can start immediately.
