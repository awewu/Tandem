# Issue 07: 路由归属、架构守卫和生产就绪检查

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Ensure the SSO implementation satisfies Rhautt Nexus production architecture rules. The new SSO route surface must remain under `/api/v2/auth`, be covered by route ownership, avoid new inline business routes in the production server entry, and pass the relevant guard and production readiness checks.

The completed slice proves the feature is not only functional, but also acceptable for the current migration architecture.

## Acceptance criteria

- [ ] `/api/v2/auth/sso/login` and `/api/v2/auth/sso/callback` are covered by the existing `/api/v2/auth` route ownership entry or an explicit equivalent owner.
- [ ] No new business route logic is added inline to `server-production.js`.
- [ ] New production auth logic lives in the target auth module area.
- [ ] Route ownership guard passes.
- [ ] Relevant auth/API tests pass.
- [ ] Production readiness tests are run or any blockers are reported with exact failure output.
- [ ] Architecture harness is run or any blockers are reported with exact failure output.

## Blocked by

- Issue 01: OIDC 登录入口、发现配置和安全跳转
- Issue 03: OIDC Callback 换码、验签和 Nexus 会话
- Issue 06: 本地/生产配置模板和密钥交付护栏
