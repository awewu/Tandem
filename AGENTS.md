# Rhautt Nexus Agent Rules

Always-loaded only. Put background in `docs/AGENT-MEMORY.md`; read only when needed.

## Product

- Platform **Rhautt Nexus / 瑞合数智枢纽**; instance **Rhautt Comfort / 瑞合瑞德暖通科技集团**; vendor **Rysnova / 瑞诺瓦** (`Powered by Rysnova`).
- Rheem/Ruud/Everhot are equipment brands.
- Flow: `lead -> diagnosis -> design -> system pack -> quote -> contract -> construction -> acceptance -> lifecycle IoT care`.

## Architecture

- Production entry `server-production.js`; no inline business routes except compatibility.
- v2 routes: `/api/v2/*` with owners in `server/modules/routeOwnership.js`.
- Target API: NestJS/PostgreSQL/TypeScript in `services/api/`; new business logic in `services/api/src/modules/`.
- Keep legacy `server/` until matching NestJS contract tests pass.

## Domain

- Rheem/Rhautt packs require `level`, `edition`, `softwareCheck`; China mandatory general codes first.
- Lifecycle IoT handover preserves customer/home/contract/devices/capabilities/warranty/service plan/binding status.
- Production tenant isolation is MongoDB-backed; demo/in-memory is not production-ready.

## Verify

- For product/backend/standards/lifecycle changes, run relevant existing gates before claiming completion.
- Common gates: `npm run harness:arch`, `npm run harness:consolidation`, `npm run harness:integrity`, `npm run harness:operational`, `npm run harness:evolution`, `npm run test:production-readiness`.
- React promotion also needs `npm run guard:frontend-api-contract` and staging `ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual`.
- Report skipped/failed gates.

## Token

- Start from user-named paths; inventory only if scope is unknown.
- Use scoped `rg -m`/globs; read ranges, not whole manifests/logs.
- Path-scope `git status`/`git diff`; avoid repo-wide output until needed.
- Respect `.rgignore`; do not default-search generated output, dependencies, or `docs/`.
- Run narrow tests first; broad suites only for cross-module/release work.
- No specialist agents unless explicitly requested.

## Design

- Rheem Red `#E4002B`; tokens: `public/css/rheem-official-tokens.css`, `public/design-tokens/rheem-official.tokens.json`.
- Production VI: `npm run guard:rheem-vi-production:strict`, zero critical/high findings.
