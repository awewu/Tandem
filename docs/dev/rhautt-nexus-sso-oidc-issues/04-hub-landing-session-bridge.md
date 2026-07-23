# Issue 04: `/hub` 登录落点和前端会话衔接

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Make the user-facing SSO entry experience land cleanly in Nexus Hub. A user entering from `https://ai.rhautt.com/` through the production SSO URL should complete SSO and see `/hub` authenticated, while local development should behave the same at `http://localhost:4000/hub`.

This issue is about the browser-facing experience after the backend SSO session exists. It must not reimplement OIDC or expose IdP tokens to the frontend.

## Acceptance criteria

- [ ] Production SSO entry URL returns the user to `https://nexus.rhautt.com/hub` after successful login.
- [ ] Local SSO entry URL returns the user to `http://localhost:4000/hub` after successful login.
- [ ] Existing frontend API clients can call `/api/v2/auth/me` after SSO without a second password login.
- [ ] Deep links with safe same-site redirects return to the requested Nexus path.
- [ ] Frontend code never receives or stores the IdP client secret, authorization code, or raw long-lived IdP tokens.
- [ ] User-visible failure fallback is clear enough for support when SSO is disabled or the user is unauthorized.
- [ ] Focused browser or route-level tests cover `/hub` landing and a safe deep-link redirect.

## Blocked by

- Issue 03: OIDC Callback 换码、验签和 Nexus 会话
