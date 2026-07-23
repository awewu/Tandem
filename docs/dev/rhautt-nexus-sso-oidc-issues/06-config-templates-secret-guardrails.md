# Issue 06: 本地/生产配置模板和密钥交付护栏

## Parent

`docs/dev/rhautt-nexus-sso-oidc-prd.md`

## What to build

Prepare the runtime configuration path for local and production SSO without committing secrets. Operators and developers should know exactly which values are required, which values differ between local and production, and where secrets must be injected.

The completed slice is verified by documentation, environment templates without secret values, and a search that proves known client secrets were not committed.

## Acceptance criteria

- [x] Runtime configuration supports issuer, client ID, client secret, redirect URI, scopes, and post-login redirect.
- [x] Local defaults/reference values include client ID `cli_mrvdz1yr8jfzrb8u`, callback `http://localhost:4000/api/v2/auth/sso/callback`, and post-login redirect `/hub`.
- [x] Production reference values include client ID `cli_mrve0bgvgnl2gkjg`, callback `https://nexus.rhautt.com/api/v2/auth/sso/callback`, and post-login redirect `/hub`.
- [x] No client secret value is written to repository files, frontend bundles, docs, tests, or snapshots.
- [x] Configuration docs explain that `/hub` is the business landing page and not the OIDC callback.
- [x] Configuration docs include a recommendation to rotate any client secret that was shared outside the intended secret-management channel.
- [x] Verification includes a scoped search for known secret substrings and reports the result.

## Implementation notes

- Runtime helper: `services/api/src/modules/auth/oidc-config.ts`
- Local template: `.env.nestjs.example` and `.env.example`
- Production templates: `.env.production.example`, `deploy/linux/.env.example`, and `deploy/windows/config/.env.production.example`
- Configuration docs: `docs/dev/rhautt-nexus-sso-oidc-config.md`
- Secret guard: `npm run guard:oidc-secrets`

## Blocked by

None - can start immediately.
