# Issue 05: SSO 失败处理、审计和安全负例

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Harden the SSO feature so failures are safe, diagnosable, and auditable. Nexus must fail closed for forged callbacks, invalid tokens, unsafe redirects, disabled users, and IdP errors, while producing enough structured logs or audit records for support and security review.

The completed slice proves that the happy path from Issue 03 is not the only tested behavior.

## Acceptance criteria

- [ ] Mismatched or missing `state` never creates a Nexus session.
- [ ] Invalid issuer, invalid audience, bad signature, expired token, and token exchange errors fail closed.
- [ ] Unsafe post-login redirects cannot send users outside Nexus.
- [ ] Disabled, inactive, or unauthorized local users cannot obtain a Nexus session through SSO.
- [ ] SSO success and terminal failure events are logged or audited without storing client secrets or full raw tokens.
- [ ] Failure responses redirect to a safe Nexus page or return a safe structured error appropriate to the request type.
- [ ] Focused tests cover the negative cases and prove secrets are not included in logs.

## Blocked by

- Issue 01: OIDC 登录入口、发现配置和安全跳转
- Issue 03: OIDC Callback 换码、验签和 Nexus 会话
