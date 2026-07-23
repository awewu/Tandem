# Rhautt Nexus SSO OIDC PRD

## Status

- Date: 2026-07-22
- Triage label: `ready-for-agent`
- Issue storage convention: follow-up implementation issues for this PRD should be created under `docs/dev/`.
- Product: Rhautt Nexus / 瑞合数智枢纽
- Identity provider: `https://ai.rhautt.com/`
- Service provider / client: `https://nexus.rhautt.com/`

## Problem Statement

Rhautt Nexus currently needs to support company-internal single sign-on from the internal AI/Tandem identity system. Users who have already signed in at `https://ai.rhautt.com/` should be able to open Rhautt Nexus and land in the Nexus hub without entering another password.

The integration must not become a weak shortcut where another system appends `userId` or a raw token to a URL. Rhautt Nexus handles tenant-scoped business workflows and production `/api/v2/*` APIs, so SSO must establish a verified Nexus login state through standard OIDC Authorization Code flow, preserve tenant/auth context, and keep secrets on the server.

## Solution

Implement Rhautt Nexus as an OIDC confidential web client of `https://ai.rhautt.com/`.

The user journey is:

1. User is already logged in to `https://ai.rhautt.com/`.
2. User opens the Nexus SSO entry URL.
3. Nexus redirects the browser to the IdP authorization endpoint discovered from `https://ai.rhautt.com/.well-known/openid-configuration`.
4. The IdP returns an authorization `code` to the Nexus callback endpoint.
5. Nexus exchanges the `code` server-side, verifies the returned identity, binds or provisions the local Nexus user, creates a Nexus session/JWT, and redirects the user to `/hub`.

## Known OIDC Configuration

### IdP

- Issuer: `https://ai.rhautt.com`
- Discovery endpoint: `https://ai.rhautt.com/.well-known/openid-configuration`
- Requested scopes: `openid profile email roles org`

### Production Client

- App base URL: `https://nexus.rhautt.com`
- Client ID: `cli_mrve0bgvgnl2gkjg`
- Callback URL: `https://nexus.rhautt.com/api/v2/auth/sso/callback`
- Default post-login redirect: `https://nexus.rhautt.com/hub`
- SSO entry URL: `https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/hub`

### Local Client

- App base URL: `http://localhost:4000`
- Client ID: `cli_mrvdz1yr8jfzrb8u`
- Callback URL: `http://localhost:4000/api/v2/auth/sso/callback`
- Default post-login redirect: `http://localhost:4000/hub`
- SSO entry URL: `http://localhost:4000/api/v2/auth/sso/login?redirect=/hub`

### Secret Handling

The client secrets already issued by the IdP must not be committed to the repository or exposed to browser code. They must be provided only through server runtime configuration, such as environment variables or the production secret manager.

Because the secrets have been shared in chat during planning, rotate them in `https://ai.rhautt.com/` before production launch if this chat is not treated as a controlled secret channel.

## User Stories

1. As a Rhautt employee, I want to open Nexus from the internal AI system, so that I do not need to log in twice.
2. As a Rhautt employee, I want to land on `/hub` after SSO succeeds, so that I can immediately continue into the Nexus workbench.
3. As a Rhautt employee, I want deep links to survive login, so that a link to a Nexus business page returns me to that page after SSO.
4. As a Nexus admin, I want users to be bound by stable internal user IDs, so that account history and audit trails do not break when phone numbers or names change.
5. As a Nexus admin, I want local Nexus roles and permissions to remain authoritative, so that an upstream claim cannot silently grant production business privileges.
6. As a platform engineer, I want OIDC discovery to drive endpoint configuration, so that authorization, token, userinfo, and JWKS endpoints stay aligned with the IdP.
7. As a platform engineer, I want the callback to verify `state`, issuer, audience, signature, and expiry, so that forged callbacks cannot create sessions.
8. As a platform engineer, I want client secrets exchanged only on the server, so that browser users never receive confidential credentials.
9. As a security reviewer, I want SSO login and callback failures to be auditable, so that identity incidents can be investigated.
10. As a support engineer, I want clear failure pages or redirects for disabled SSO, missing claims, unauthorized users, and IdP errors, so that login failures can be diagnosed.
11. As a developer, I want a local OIDC client for `localhost:4000`, so that SSO can be verified before production deployment.
12. As a future implementation agent, I want follow-up issues to live under `docs/dev/`, so that this PRD and its execution tasks stay together.

## Functional Requirements

### SSO Entry

1. Nexus must expose `GET /api/v2/auth/sso/login`.
2. The endpoint must accept an optional `redirect` query parameter.
3. If `redirect` is absent, Nexus must use `/hub`.
4. `redirect` must only allow same-site paths beginning with `/`; absolute external URLs must be rejected or normalized to `/hub`.
5. The endpoint must generate a one-time `state` value and store it in an HTTP-only cookie or server-side transient store.
6. The endpoint must redirect to the IdP authorization endpoint with `response_type=code`, configured `client_id`, configured `redirect_uri`, requested scopes, and `state`.

### OIDC Callback

1. Nexus must expose `GET /api/v2/auth/sso/callback`.
2. The callback must reject requests missing `code` or `state`.
3. The callback must compare returned `state` with the value created by the login endpoint.
4. The callback must exchange the authorization code server-side using the configured client ID, client secret, and redirect URI.
5. The callback must validate the identity response before creating a Nexus session.
6. After success, the callback must clear transient SSO cookies and redirect to the original safe `redirect` path or `/hub`.

### Identity Verification

1. Nexus must read OIDC metadata from the discovery endpoint.
2. Nexus must verify `id_token` signature using JWKS when an `id_token` is returned.
3. Nexus must validate issuer equals `https://ai.rhautt.com`.
4. Nexus must validate audience equals the active Nexus client ID.
5. Nexus must validate token expiry and issued-at tolerance.
6. Nexus must use `sub` as the primary external identity key unless the IdP contract provides a stronger stable internal employee ID claim.
7. Nexus may call `userinfo_endpoint` to obtain profile, email, roles, and org claims when they are not fully present in the ID token.

### User Binding And Provisioning

1. Nexus must bind SSO identities to local Nexus users through a stable external identity mapping.
2. The external identity mapping must include provider, issuer, external subject, local user ID, first login time, last login time, and last seen profile snapshot.
3. Existing users may be matched by a configured admin-approved identifier only during first binding.
4. If no local user exists, the first implementation must either create a restricted active user with minimum permissions or place the user into a pending authorization state. The chosen behavior must be explicit in implementation issues.
5. Local Nexus roles, permissions, modules, tenant ID, dealer ID, store ID, and customer ID remain authoritative for Nexus authorization.
6. Upstream `roles` and `org` claims may be stored and used as hints, but they must not directly bypass Nexus RBAC.

### Session Creation

1. After verified SSO, Nexus must issue the same kind of local login result used by existing `/api/v2/auth/login` flows.
2. The authenticated user must work with existing `GET /api/v2/auth/me`.
3. Existing frontend API clients that send the Nexus token must continue to work.
4. Browser cookies, if used, must be HTTP-only, SameSite `Lax` or stricter, secure in production, and scoped to Nexus.

### Configuration

Runtime configuration must support at least:

- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI`
- `OIDC_SCOPES`
- `OIDC_POST_LOGIN_REDIRECT`
- optional `OIDC_USERINFO_ENABLED`
- optional `OIDC_ALLOWED_REDIRECT_HOSTS`
- optional claim mapping keys for roles and org

Environment-specific expected values:

| Environment | Client ID | Redirect URI | Post-login redirect |
| --- | --- | --- | --- |
| local | `cli_mrvdz1yr8jfzrb8u` | `http://localhost:4000/api/v2/auth/sso/callback` | `/hub` |
| production | `cli_mrve0bgvgnl2gkjg` | `https://nexus.rhautt.com/api/v2/auth/sso/callback` | `/hub` |

## Implementation Decisions

1. Implement the Nexus SSO endpoints inside the target auth module for `/api/v2/auth`; do not add new inline business routes to the production server entry file.
2. Keep the OIDC exchange server-side. The frontend only navigates to the SSO entry URL and receives a normal Nexus authenticated state after callback completion.
3. Use OIDC discovery and JWKS instead of hardcoding authorization, token, userinfo, or key endpoints.
4. Add a dedicated external identity binding model or equivalent schema extension rather than overloading phone number as the SSO primary key.
5. Preserve current tenant isolation and RLS expectations when reading or updating the local user after SSO.
6. SSO provisioning must not grant broad business access by default. Missing role/tenant mapping is a controlled failure or a restricted user state, not an implicit platform admin.
7. Store IdP tokens only as needed for the login transaction. Do not persist access tokens or refresh tokens in the first version unless a later requirement needs delegated API access.
8. Do not request `offline_access` for the first version.
9. Add route ownership coverage for the `/api/v2/auth/sso/*` surface as part of the implementation verification.
10. The first version does not require single logout. Nexus logout can remain local unless a later IdP logout contract is provided.

## Testing Decisions

1. Add focused backend tests for login redirect construction, callback validation, token exchange handling, safe redirect enforcement, and user binding behavior.
2. Mock OIDC discovery, token endpoint, userinfo endpoint, and JWKS in tests; do not depend on live `https://ai.rhautt.com/` for unit tests.
3. Add a callback test that rejects mismatched or missing `state`.
4. Add a callback test that rejects invalid issuer, invalid audience, expired token, and bad signature.
5. Add a safe redirect test proving `https://external.example` cannot be used as a post-login redirect.
6. Add a provisioning/binding test for an existing local user and a first-time SSO user.
7. Add an integration smoke path for local configuration using the local client once the IdP registration is confirmed.
8. Run the project auth and production readiness gates before claiming implementation complete.

Expected verification commands after implementation:

- `npm run test:api-units`
- `npm run test:production-readiness`
- `npm run guard:routes`
- `npm run harness:arch`

## Out Of Scope

1. SAML, CAS, and custom token-login protocols.
2. Single logout / front-channel logout / back-channel logout.
3. Long-lived refresh token storage or delegated access to AI/Tandem APIs.
4. Replacing all existing password, SMS, and admin-created account flows.
5. Granting Nexus business roles directly from IdP roles without local mapping.
6. Public third-party SSO providers outside the company internal IdP.

## Acceptance Criteria

1. Visiting `https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/hub` starts OIDC login and returns an already-authenticated company user to `https://nexus.rhautt.com/hub`.
2. Visiting `http://localhost:4000/api/v2/auth/sso/login?redirect=/hub` uses the local client and returns to `http://localhost:4000/hub`.
3. `GET /api/v2/auth/me` succeeds after SSO callback creates the Nexus authenticated state.
4. Missing or mismatched `state` fails closed and does not create a Nexus session.
5. Invalid issuer, audience, signature, or expired token fails closed.
6. A malicious external `redirect` value cannot send the user outside Nexus after login.
7. Client secrets are absent from committed files and browser bundles.
8. First-time users follow the configured binding/provisioning policy and do not receive broad permissions by default.
9. SSO login events and failures are observable enough for support and security review.
10. The implemented route remains under `/api/v2/auth` and satisfies the route ownership guard.

## Further Notes

The existing Brand Console contains a lightweight OIDC Authorization Code implementation that can inform the Nexus implementation, but the Nexus production path must integrate with the main auth module, local user model, tenant context, and `/api/v2/auth/me` behavior.

The IdP registration should confirm that the configured callback URLs exactly match the values in this PRD. `/hub` is the post-login business page, not the OIDC callback.
