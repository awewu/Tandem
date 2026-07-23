# Issue 03: Ruud local runtime website integration

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## Type

AFK

## Dependencies

- `01-assignment-data-migration-seed-cleanup`
- Phase 1 public brand-site runtime product endpoint

## Recommended parallel wave

Wave 1

## What to build

Connect the local Ruud website runtime to the brand-site public product endpoint so a Ruud operator can manage website shelf state in the `5000` control panel and observe published Ruud products on the local Ruud website. The integration should mirror the Everhot local runtime pattern while using Ruud-specific site code, environment links, static fallback data, and product normalization.

This issue must keep Ruud behavior independent from Rheem and Everhot website runtime assumptions.

## Acceptance criteria

- [ ] The Ruud local website requests the site-scoped runtime endpoint for Ruud products in local development.
- [ ] Only products published to the Ruud website shelf render from the runtime response.
- [ ] Hidden, draft, archived, deleted, unassigned, and non-Ruud products do not render through the Ruud runtime path.
- [ ] The Ruud website keeps a static data fallback when the runtime endpoint is unavailable or invalid.
- [ ] The `5000` Ruud brand website control panel exposes the correct testing and production environment links.
- [ ] A focused smoke proves the `5000 -> Ruud local website` product visibility loop.
- [ ] The relevant website build/audit and dealer-workbench build pass, or skipped gates are documented.

## Blocked by

- `01-assignment-data-migration-seed-cleanup`
- Phase 1 public brand-site runtime product endpoint

