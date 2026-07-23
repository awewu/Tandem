# Issue 02: SSO 外部身份绑定和受限首登策略

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Build the local Nexus identity binding contract for internal SSO. A verified OIDC subject from `https://ai.rhautt.com` must resolve to a local Nexus user through a stable provider/issuer/subject mapping. If no mapping exists, the service must apply an explicit first-login policy that is safe for production: either create a restricted user or place the user into a pending authorization state.

This issue should make the binding behavior testable without requiring a live OIDC callback. The completed behavior proves that verified external identity can become a local user decision while preserving tenant/RLS and Nexus RBAC rules.

## Acceptance criteria

- [ ] A persistent external identity mapping exists or an equivalent schema extension is defined.
- [ ] The mapping includes provider, issuer, external subject, local user ID, first login time, last login time, and last seen profile snapshot.
- [ ] Lookup by provider + issuer + subject returns the intended local Nexus user only when the binding is active.
- [ ] First-time SSO users follow one explicit policy: restricted active user or pending authorization.
- [ ] Upstream `roles` and `org` claims are stored only as hints/profile data and do not directly grant Nexus permissions.
- [ ] Tenant ID, role, permissions, modules, dealer ID, store ID, and customer ID remain governed by the local Nexus user model.
- [ ] Focused tests cover existing binding lookup, missing binding first-login behavior, inactive/disabled binding rejection, and role-claim non-escalation.

## Blocked by

None - can start immediately.
