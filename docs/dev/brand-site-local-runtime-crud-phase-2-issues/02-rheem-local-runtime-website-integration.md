# Issue 02: Rheem local runtime website integration

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

Connect the local Rheem website runtime to the brand-site public product endpoint so a Rheem operator can manage website shelf state in the `5000` control panel and observe published Rheem products on the local Rheem website. The integration should follow the Everhot local runtime pattern while using Rheem-specific site code, environment links, static fallback data, and product normalization.

This issue must not hard-code Everhot or `5011` assumptions into the shared runtime contract.

## Acceptance criteria

- [ ] The Rheem local website requests the site-scoped runtime endpoint for Rheem products in local development.
- [ ] Only products published to the Rheem website shelf render from the runtime response.
- [ ] Hidden, draft, archived, deleted, unassigned, and non-Rheem products do not render through the Rheem runtime path.
- [ ] The Rheem website keeps a static data fallback when the runtime endpoint is unavailable or invalid.
- [ ] The `5000` Rheem brand website control panel exposes the correct testing and production environment links.
- [ ] A focused smoke proves the `5000 -> Rheem local website` product visibility loop.
- [ ] The relevant website build/audit and dealer-workbench build pass, or skipped gates are documented.

## Blocked by

- `01-assignment-data-migration-seed-cleanup`
- Phase 1 public brand-site runtime product endpoint

