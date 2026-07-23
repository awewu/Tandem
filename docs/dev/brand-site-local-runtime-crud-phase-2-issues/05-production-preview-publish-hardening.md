# Issue 05: Production preview and publish hardening

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## Type

HITL

## Dependencies

- `01-assignment-data-migration-seed-cleanup`
- `02-rheem-local-runtime-website-integration`
- `03-ruud-local-runtime-website-integration`
- `04-real-other-materials-api-ui-integration`

## Recommended parallel wave

Wave 2 / Final

## What to build

Harden brand website preview and publish behavior after Rheem, Ruud, Everhot, product assignments, and real non-product materials all have local runtime paths. Operators should have a clear, brand-scoped preview of what will publish, guardrails that prevent accidental cross-brand or wrong-environment publishing, and a repeatable verification path before production-facing actions.

This issue is HITL because production preview/publish work may require staging or production operator coordination, runtime configuration, allowlists, and secrets that must stay outside the repository.

## Acceptance criteria

- [ ] Preview clearly distinguishes testing environment and production environment for Rheem, Ruud, and Everhot.
- [ ] Publish actions are brand-scoped and cannot publish Rheem data to Ruud/Everhot, Ruud data to Rheem/Everhot, or Everhot data to Rheem/Ruud.
- [ ] Product website shelf state and non-product material state are both included in the preview/publish readiness surface.
- [ ] Operators see clear Chinese confirmation, blocked, success, and failure states before any production-facing publish action.
- [ ] Production secrets, credentials, allowlists, and live publish targets are not committed to the repository or exposed to browser code.
- [ ] A live-stack local smoke exists for the `5000 -> website runtime` assertions using a real local API/database seed without Playwright route mocks.
- [ ] Existing static fallback behavior remains available when runtime endpoints fail.
- [ ] Relevant production readiness, frontend API contract, website build/audit, and brand-site smoke gates pass, or skipped HITL checks are documented with the missing external dependency.

## Blocked by

- `01-assignment-data-migration-seed-cleanup`
- `02-rheem-local-runtime-website-integration`
- `03-ruud-local-runtime-website-integration`
- `04-real-other-materials-api-ui-integration`

