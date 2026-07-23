# Issue 04: Real `其他素材` API and UI integration

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## Type

AFK

## Dependencies

- Phase 1 simulated `其他素材` tab

## Recommended parallel wave

Wave 1

## What to build

Replace the simulated `其他素材` tab with a real brand-scoped API and UI integration for non-product website materials such as homepage hero, brand story, service banner, and footer credentials. Operators should be able to view real material records for the current brand site, update basic replacement metadata, and see clear empty/loading/error states without confusing these records with product catalog data.

This issue does not need to deliver full DAM production readiness unless the existing project already has a suitable DAM-backed contract. It should establish a production-shaped API boundary and remove the hard-coded simulated records from the runtime path.

## Acceptance criteria

- [ ] A brand-scoped `/api/v2/*` API contract exists for listing and updating non-product website materials.
- [ ] Route ownership is registered or confirmed for the material API.
- [ ] The `其他素材` tab reads real records for the current brand site instead of hard-coded simulated data.
- [ ] Material records are scoped by brand/site and cannot leak Rheem, Ruud, or Everhot records across sites.
- [ ] Operators can update the intended basic material metadata or replacement reference through the UI.
- [ ] Loading, empty, read-only, write-denied, success, and error states are visible and in Chinese.
- [ ] Focused backend/API and UI tests cover brand scoping and the material edit flow.
- [ ] Dealer-workbench build passes.

## Blocked by

Phase 1 simulated `其他素材` tab.

