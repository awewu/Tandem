# Brand Site Local Runtime CRUD Phase 2 Issues

Status: paused - do not execute for the current Everhot-only product CRUD scope.

This file is retained as historical planning context only. The current working scope is limited to Everhot product CRUD and the local `5000 -> 5011` loop. Do not start Rheem, Ruud, other brand runtime loaders, or real `其他素材` API work from this file unless the user explicitly reopens Phase 2.

Source PRD: `docs/dev/brand-site-local-runtime-crud-prd.md`

Phase 1 handoff:

- `docs/dev/brand-site-local-runtime-crud-issues.md`
- `docs/dev/brand-site-local-runtime-crud-runbook.md`
- `docs/dev/brand-site-local-runtime-crud-followups.md`

These Phase 2 issues follow the local Markdown convention and are published under `docs/dev/brand-site-local-runtime-crud-phase-2-issues/`. Each issue is a thin vertical slice that leaves demonstrable behavior behind. Phase 2 assumes the Everhot local `5000 -> 5011` closed loop is complete and focuses on multi-brand runtime adoption, real non-product materials, production preview/publish hardening, and existing assignment data cleanup.

## Issue List

| Issue | Title | Type | Blocked by | Recommended parallel wave |
| --- | --- | --- | --- | --- |
| 01 | Clean and reconcile existing brand-site product assignments | AFK | Phase 1 complete | Wave 0 |
| 02 | Rheem local runtime website integration | AFK | 01, Phase 1 public runtime endpoint | Wave 1 |
| 03 | Ruud local runtime website integration | AFK | 01, Phase 1 public runtime endpoint | Wave 1 |
| 04 | Real `其他素材` API and UI integration | AFK | Phase 1 simulated `其他素材` tab | Wave 1 |
| 05 | Production preview and publish hardening | HITL | 01, 02, 03, 04 | Wave 2 / Final |

## Parallel Execution

### Wave 0: data foundation

1. `01-assignment-data-migration-seed-cleanup`

Notes:

- Run this first so Rheem, Ruud, and Everhot website shelves all start from clean, brand-safe assignment data.
- This issue should produce repeatable migration/seed behavior rather than a one-off manual database edit.

### Wave 1: multi-brand runtime and real material data

1. `02-rheem-local-runtime-website-integration`
2. `03-ruud-local-runtime-website-integration`
3. `04-real-other-materials-api-ui-integration`

Notes:

- Rheem and Ruud can run in parallel after Issue 01 because they should consume the same public runtime product contract and remain brand-scoped.
- The real `其他素材` API can run in parallel with the website runtime integrations if it avoids broad edits to the same console shell.
- If merge friction is a concern, run one brand website integration in parallel with Issue 04, then do the second brand site.

### Wave 2 / Final: production confidence

1. `05-production-preview-publish-hardening`

Notes:

- This issue is marked HITL because production preview/publish hardening may require operator confirmation, live URL allowlists, runtime secrets, or staging credentials that should not be committed.
- It should include the follow-up live-stack smoke from `docs/dev/brand-site-local-runtime-crud-followups.md`: the same `5000 -> local website` assertions should be runnable against a real local API/database seed without Playwright route mocks.

## First Batch Agent Prompt

### Agent A: Issue 01

```text
Implement docs/dev/brand-site-local-runtime-crud-phase-2-issues/01-assignment-data-migration-seed-cleanup.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-local-runtime-crud-prd.md, docs/dev/brand-site-local-runtime-crud-runbook.md, docs/dev/brand-site-local-runtime-crud-followups.md if present, and the issue file first. Scope: add repeatable migration/seed cleanup for existing Rheem, Ruud, and Everhot brand-site product assignments so each concrete brand site only contains products from the same brand and published/hidden/unassigned states are deterministic. Do not modify Phase 1 implementation code outside the issue scope. Verify with focused backend/data tests and the narrowest relevant product/brand-site gate.
```

## Execution Notes

- New production APIs must use `/api/v2/*` and must have route ownership.
- Do not add inline business routes to `server-production.js`.
- Keep brand website logic brand-scoped; Rheem, Ruud, and Everhot must not share hard-coded local website assumptions.
- Product catalog existence, catalog active/inactive status, and brand website shelf visibility remain separate concepts.
- The `其他素材` Phase 2 implementation must replace the simulated UI data with a real API contract without claiming full DAM production readiness unless the issue explicitly delivers it.
- Production preview/publish work must not commit secrets, production credentials, or irreversible publish actions.
