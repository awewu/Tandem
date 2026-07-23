# Rhautt Nexus SSO OIDC Configuration

## Scope

This document covers only runtime configuration for the Rhautt Nexus OIDC
client. It does not define login, callback, user binding, session creation, or
authorization behavior.

## Required Server Variables

Configure these variables only in server runtime environments such as
`.env.nestjs`, `.env.production`, Docker/Compose secrets, PM2 environment
files, or the production secret manager:

| Variable | Purpose |
| --- | --- |
| `OIDC_ISSUER` | OIDC issuer. Current value: `https://ai.rhautt.com`. |
| `OIDC_CLIENT_ID` | Nexus client ID issued by the IdP. |
| `OIDC_CLIENT_SECRET` | Confidential client secret. Must never be committed or exposed to browser code. |
| `OIDC_REDIRECT_URI` | Callback endpoint registered at the IdP. |
| `OIDC_SCOPES` | Requested scopes. Current value: `openid profile email roles org`. |
| `OIDC_POST_LOGIN_REDIRECT` | Nexus landing path after successful login. Current value: `/hub`. |

Optional variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OIDC_USERINFO_ENABLED` | `true` | Allows the callback implementation to call the discovered userinfo endpoint when claims are incomplete. |
| `OIDC_ALLOWED_REDIRECT_HOSTS` | empty | Comma-separated host allowlist for same-site redirect handling when a deployment needs explicit host checks. |
| `OIDC_ROLES_CLAIM` | `roles` | Upstream roles claim name used only as a hint. Nexus RBAC remains authoritative. |
| `OIDC_ORG_CLAIM` | `org` | Upstream org claim name used only as a hint. Nexus tenant/store/dealer context remains authoritative. |

## Local Reference

Use these non-secret values for local development:

```dotenv
OIDC_ISSUER=https://ai.rhautt.com
OIDC_CLIENT_ID=cli_mrvdz1yr8jfzrb8u
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=http://localhost:5000/api/v2/auth/sso/callback
OIDC_SCOPES=openid profile email roles org
OIDC_POST_LOGIN_REDIRECT=/hub
OIDC_USERINFO_ENABLED=true
OIDC_ALLOWED_REDIRECT_HOSTS=localhost:5000
OIDC_ROLES_CLAIM=roles
OIDC_ORG_CLAIM=org
```

Copy `.env.nestjs.example` to the ignored `.env.nestjs` file, then fill
`OIDC_CLIENT_SECRET` from the IdP or approved secret channel. Do not paste the
secret into docs, tests, snapshots, frontend `.env` files, or any `NEXT_PUBLIC_*`
variable.

## Production Reference

Use these non-secret values for production:

```dotenv
OIDC_ISSUER=https://ai.rhautt.com
OIDC_CLIENT_ID=cli_mrve0bgvgnl2gkjg
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=https://nexus.rhautt.com/api/v2/auth/sso/callback
OIDC_SCOPES=openid profile email roles org
OIDC_POST_LOGIN_REDIRECT=/hub
OIDC_USERINFO_ENABLED=true
OIDC_ALLOWED_REDIRECT_HOSTS=nexus.rhautt.com
OIDC_ROLES_CLAIM=roles
OIDC_ORG_CLAIM=org
```

Production operators must inject `OIDC_CLIENT_SECRET` through the same protected
channel used for `JWT_SECRET`, `PII_ENCRYPTION_KEY`, and database passwords. If
an OIDC client secret was shared outside the intended secret-management channel,
rotate that secret in `https://ai.rhautt.com/` before production launch.

## Callback vs. Landing Page

`OIDC_REDIRECT_URI` is the OIDC callback registered with the IdP. For Rhautt
Nexus it is `/api/v2/auth/sso/callback`.

`OIDC_POST_LOGIN_REDIRECT=/hub` is the business landing page after Nexus has
completed the callback, verified identity, created the local authenticated
state, and selected a safe redirect path. `/hub` must not be registered as the
OIDC callback.

## Verification

Run the scoped guard before committing OIDC configuration work:

```sh
npm run guard:oidc-secrets
```

When reviewers have known leaked secret substrings available in their secure
environment, provide them without printing the values:

```sh
OIDC_KNOWN_SECRET_SUBSTRINGS=comma-separated-substrings npm run guard:oidc-secrets
```

The guard scans tracked and non-ignored repository files, rejects committed
OIDC client-secret assignments, rejects secret references in browser-facing
surfaces, and reports whether any provided known secret substrings were found.
