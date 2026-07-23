# Issue 08: 本地到生产的 SSO 验收烟测

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Run and document the real acceptance smoke for the company IdP integration. The test must prove local and production client registrations work with their exact callback URLs and that authenticated users land in Nexus Hub.

This issue is marked HITL because it may need real IdP access, active callback allowlists, runtime secrets injected outside the repository, and production/staging operator coordination.

## Acceptance criteria

- [ ] Local smoke starts from `http://localhost:4000/api/v2/auth/sso/login?redirect=/hub` and lands on `http://localhost:4000/hub`.
- [ ] Production smoke starts from `https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/hub` and lands on `https://nexus.rhautt.com/hub`.
- [ ] `GET /api/v2/auth/me` succeeds after both local and production SSO where applicable.
- [ ] The IdP registration callback values exactly match the implemented callback URLs.
- [ ] Smoke evidence records success or exact failure details without exposing secrets or raw tokens.
- [ ] Any IdP claim mismatch is documented as a follow-up issue under `docs/dev/`.
- [ ] Final verification reports the commands run and any checks skipped.

## Blocked by

- Issue 03: OIDC Callback 换码、验签和 Nexus 会话
- Issue 04: `/hub` 登录落点和前端会话衔接
- Issue 05: SSO 失败处理、审计和安全负例
- Issue 07: 路由归属、架构守卫和生产就绪检查
