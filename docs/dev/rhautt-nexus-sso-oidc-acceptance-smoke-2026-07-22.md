# Rhautt Nexus SSO OIDC Acceptance Smoke - 2026-07-22

## Scope

Issue: `docs/dev/rhautt-nexus-sso-oidc-issues/08-local-production-sso-acceptance-smoke.md`

This smoke checked the real IdP discovery document, local SSO route behavior, safe redirect negatives, production first-hop availability, and the final guard/test commands. It does not record or expose any `client_secret`, authorization code, raw access token, raw ID token, state value, or cookie value.

## Configuration Under Test

IdP issuer: `https://ai.rhautt.com`

Discovery: `https://ai.rhautt.com/.well-known/openid-configuration`

Local client:
- app URL: `http://localhost:4000`
- client_id: `cli_mrvdz1yr8jfzrb8u`
- callback: `http://localhost:4000/api/v2/auth/sso/callback`
- SSO entry: `http://localhost:4000/api/v2/auth/sso/login?redirect=/hub`
- post-login landing: `http://localhost:4000/hub`

Production client:
- app URL: `https://nexus.rhautt.com`
- client_id: `cli_mrve0bgvgnl2gkjg`
- callback: `https://nexus.rhautt.com/api/v2/auth/sso/callback`
- SSO entry: `https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/hub`
- post-login landing: `https://nexus.rhautt.com/hub`

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| IdP discovery | Pass | Node `fetch` returned HTTP 200. Issuer was `https://ai.rhautt.com`; authorization endpoint, token endpoint, and JWKS URI were present. |
| Local OIDC env completeness | Blocked | `.env.nestjs` and `.env` did not define `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `OIDC_SCOPES`, or `OIDC_POST_LOGIN_REDIRECT`; `.env.local` was absent. Real local callback/token exchange cannot be completed without server-side secret injection. |
| Local service bind on `localhost:4000` | Blocked | Sandbox bind failed with `EACCES` on `0.0.0.0:4000` and `127.0.0.1:4000`. Escalated service start created a Node process, but direct HTTP calls returned HTTP 500 for `/api/v2/health` and `/api/v2/auth/sso/login?redirect=/hub`. The temporary process was stopped. |
| Local SSO first hop, in-process | Pass | Fastify inject returned `/api/v2/health` HTTP 200 and `/api/v2/auth/sso/login?redirect=/hub` HTTP 302 to `https://ai.rhautt.com/api/oidc/authorize`. Non-sensitive OIDC params matched: `client_id=cli_mrvdz1yr8jfzrb8u`, `response_type=code`, `redirect_uri=http://localhost:4000/api/v2/auth/sso/callback`, `scope=openid profile email roles org`; a state parameter was present but not recorded. |
| Local callback URL consistency | Pass for constructed login URL | The local authorization request used `http://localhost:4000/api/v2/auth/sso/callback`, matching the known local IdP client callback value. |
| Local `/hub` landing | Not verified | Real IdP login and token callback were blocked by missing local OIDC runtime secret/account and unhealthy bound local HTTP service. |
| Local `GET /api/v2/auth/me` after SSO | Not verified | Requires successful real local callback/session issuance, which was blocked. |
| Local unsafe redirect negative | Pass in-process | `redirect=https://evil.example/out` still produced an IdP authorization redirect using the Nexus callback; the external URL was not used as a browser redirect target. |
| Local missing code/state negative | Pass in-process | Callback without an authorization code returned HTTP 302 to a local safe fallback with an SSO error marker and cleared transient SSO cookies. Audit emitted `failureReason=missing_code`. No session was observed in this negative route-level smoke. |
| Production first hop | Fail/blocking | `https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/hub` returned HTTP 404 with JSON content and no `Location` header. Production SSO could not proceed to the IdP. |
| Production callback URL consistency | Not verified live | Expected callback is `https://nexus.rhautt.com/api/v2/auth/sso/callback`, but production login entry is not currently exposed, so the live authorization request could not be inspected. |
| Production `/hub` landing | Not verified | Blocked by production login entry HTTP 404 and lack of production login/deployment operator flow. |
| Production `GET /api/v2/auth/me` after SSO | Not verified | Blocked by production login entry HTTP 404 and lack of completed production SSO session. |
| Secret/token leakage in smoke output | Pass for inspected outputs | Smoke output and this report do not include client secrets, authorization codes, raw access tokens, raw ID tokens, raw state values, or cookie values. |

## Final Checks

| Command | Result | Key output |
| --- | --- | --- |
| `npm.cmd run guard:routes` | Fail | `MODULE_NOT_FOUND`: `audit/product-consolidation-harness.js`. The route guard did not reach route ownership evaluation. |
| `npm.cmd run test:api-units` | Fail on Windows script syntax | `'TS_NODE_PROJECT' is not recognized...`; script uses POSIX env assignment and `find`. |
| PowerShell equivalent of API units | Pass | `205/205` tests passed. SSO unit coverage included login discovery, safe redirect, state cookie, callback validation, failure reason logging, and fail-closed session behavior. |
| `npm.cmd run test:production-readiness` | Fail | Summary from JSON run: 83 suites total, 59 passed, 24 failed; 450 tests total, 392 passed, 50 failed. Failures are existing production-readiness/legacy/evidence/rysnova-bim items, including missing `audit/architecture-harness.js`, missing `audit/operational-readiness-harness.js`, missing `audit/product-consolidation-harness.js`, code-size trunk guard failures, legacy surface ownership failures, and product/viewer contract failures. |
| `npm.cmd run harness:arch` | Fail | `MODULE_NOT_FOUND`: `audit/architecture-harness.js`. |

## Commands Run

- `node -e "<discovery and production first-hop fetch>"`
- `node -e "<sanitized OIDC env-key presence check>"`
- `node scripts/start-api.js` with local SSO non-secret env values and `PORT/API_PORT=4000`
- `node -r ts-node/register/transpile-only -e "<Fastify inject local SSO smoke>"`
- `npm.cmd run guard:routes`
- `npm.cmd run test:api-units`
- PowerShell equivalent: `node -r ts-node/register/transpile-only --test <services/api/src/**/*.nodetest.ts>`
- `npm.cmd run test:production-readiness`
- `node node_modules/jest/bin/jest.js test/production-readiness --runInBand --silent --json --outputFile <scratch file>`
- `npm.cmd run harness:arch`

## Blockers

1. Local real E2E smoke is blocked until OIDC runtime env is injected outside the repository, especially `OIDC_CLIENT_SECRET`, and the local bound service is healthy on `http://localhost:4000`.
2. Production real E2E smoke is blocked because `https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/hub` returns HTTP 404 and does not redirect to `https://ai.rhautt.com`.
3. Final production readiness gates are still red because required audit harness files and several existing readiness evidence/contracts are missing or failing.
4. Real IdP user/account behavior, claim mapping, local user binding, `/hub` landing, and post-login `GET /api/v2/auth/me` remain unverified in live local and production flows.

## Launch Readiness Assessment

Rhautt Nexus SSO OIDC is not yet ready to declare production launch-ready. The code-level SSO unit coverage and in-process first-hop/negative smoke are strong, and IdP discovery is reachable, but the required real local and production acceptance flows did not complete. Production currently fails at the SSO entry URL with HTTP 404, and the final route/architecture/production-readiness gates are not green.
