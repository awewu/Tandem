# Issue 03: OIDC Callback 换码、验签和 Nexus 会话

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Complete the core SSO login loop. After the IdP redirects back to `/api/v2/auth/sso/callback`, Nexus must verify `state`, exchange the authorization code server-side, validate the returned identity, resolve or provision the local Nexus user through the SSO binding policy, issue the normal Nexus authenticated state, and redirect the browser to `/hub` or the original safe redirect.

The completed slice proves that a verified company identity can become a working Nexus login and that `GET /api/v2/auth/me` succeeds after SSO.

## Acceptance criteria

- [x] `GET /api/v2/auth/sso/callback` exists under the auth module and is public.
- [x] Missing `code` or `state` fails closed and does not create a Nexus session.
- [x] Returned `state` must match the state created by the login endpoint.
- [x] The authorization code is exchanged server-side using client ID, client secret, and exact redirect URI.
- [x] `id_token` is validated for signature, issuer, audience, and expiry when returned.
- [x] `userinfo_endpoint` may be called when required claims are not fully present in the ID token.
- [x] The callback resolves a local user through the binding/provisioning policy and issues the same local auth shape as existing Nexus login flows.
- [x] `GET /api/v2/auth/me` works with the resulting Nexus authenticated state.
- [x] The callback clears transient SSO cookies after success or terminal failure.
- [x] Focused tests cover successful callback, bad state, token exchange failure, invalid issuer, invalid audience, expired token, bad signature, and `/me` compatibility.

## Implementation notes

- Callback route and response handling: `services/api/src/modules/auth/auth.controller.ts`
- Callback service: `services/api/src/modules/auth/oidc-sso-callback.service.ts`
- Local Nexus session reuse: `services/api/src/modules/auth/auth.service.ts`
- Focused tests: `services/api/src/modules/auth/oidc-sso-callback.nodetest.ts`

## Blocked by

- Issue 01: OIDC 登录入口、发现配置和安全跳转
- Issue 02: SSO 外部身份绑定和受限首登策略
