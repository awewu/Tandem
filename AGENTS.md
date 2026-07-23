# Rhautt Nexus Agent Rules

Always-loaded rules only. Put background, audits, roadmaps, and long product memory in `docs/AGENT-MEMORY.md`; read it only when the task needs it.

## Product

- Platform name: **Rhautt Nexus / 瑞合数智枢纽**.
- Customer/group instance: **Rhautt Comfort / 瑞合瑞德暖通科技集团**. Do not use it as the software platform name.
- Vendor: **Rysnova / 瑞诺瓦**. Delivered instances are white-labeled and marked `Powered by Rysnova`.
- Rheem / Ruud / Everhot are equipment brands.
- Product work serves: `lead -> diagnosis -> design -> system pack -> quote -> contract -> construction -> acceptance -> lifecycle IoT care`.

## Architecture

- Current production entry: `server-production.js`; do not add inline business routes except compatibility paths.
- Current v2 modules: `server/modules/*`; every route must have an owner in `server/modules/routeOwnership.js`.
- New production APIs use `/api/v2/*`.
- Target API: NestJS + PostgreSQL + TypeScript in `services/api/`.
- New business logic belongs in `services/api/src/modules/`, not legacy `server/modules/`, unless preserving compatibility.
- Keep legacy `server/` serving until the matching NestJS module passes contract tests.

## Domain

- Rheem/Rhautt system packs must include standards metadata: `level`, `edition`, `softwareCheck`.
- China mandatory general codes come first; older design standards are detailed references only.
- Lifecycle IoT handover must preserve customer, home, contract, installed devices, capabilities, warranty, service plan, and binding status.
- MongoDB-backed tenant isolation is the production target. Demo/in-memory fallback is not production readiness.

## Verify

- For product, backend, standards, or lifecycle changes, run the relevant existing gate before claiming completion.
- Common gates: `npm run harness:arch`, `npm run harness:consolidation`, `npm run harness:integrity`, `npm run harness:operational`, `npm run harness:evolution`, `npm run test:production-readiness`.
- React candidate promotion also requires `npm run guard:frontend-api-contract` and staging `ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual`.
- If a gate is skipped or fails, report it plainly.

## Token

- Start from the user-named module or path; inventory the repo only when scope is unknown.
- Use scoped `rg` searches with result limits. Read targeted ranges instead of whole large manifests or logs.
- Use path-scoped `git status` / `git diff`; avoid repo-wide status output until a Git baseline exists.
- Default excludes live in `.rgignore`; never search generated output, dependencies, or all of `docs/` by default.
- Run the narrowest relevant test or gate first. Run broad suites only for cross-module or release work.
- Do not spawn specialist agents unless the user explicitly requests delegation or parallel agent work.

## Design

- Rheem Red is `#E4002B`, not `#C41230`.
- Token sources: `public/css/rheem-official-tokens.css` and `public/design-tokens/rheem-official.tokens.json`.
- Production VI release gate: `npm run guard:rheem-vi-production:strict` must pass with zero critical/high findings.
