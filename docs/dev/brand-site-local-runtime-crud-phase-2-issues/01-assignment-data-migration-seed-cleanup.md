# Issue 01: Clean and reconcile existing brand-site product assignments

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## Type

AFK

## Dependencies

- Phase 1 local runtime CRUD implementation is complete.

## Recommended parallel wave

Wave 0

## What to build

Create a repeatable cleanup path for existing brand-site product assignments so Rheem, Ruud, and Everhot website shelves start from deterministic, brand-safe data. The completed behavior should reconcile existing records, remove or quarantine invalid cross-brand assignments, preserve intentional published/hidden states where they can be proven, and seed any required local smoke records without relying on manual database edits.

This issue is about data correctness and repeatability. It must preserve the distinction between product catalog status and website shelf visibility.

## Acceptance criteria

- [ ] Rheem, Ruud, and Everhot concrete brand sites have no cross-brand product assignments after cleanup.
- [ ] Published, hidden, draft, archived, deleted, and unassigned cases are deterministic enough for local runtime smoke tests.
- [ ] Cleanup is repeatable and safe to run more than once in local/staging-like environments.
- [ ] Any quarantined or removed assignments are reported with enough detail for operators to review.
- [ ] Group website assignment rules remain separate and are not incorrectly constrained to a single brand.
- [ ] Focused backend/data tests cover valid same-brand assignments and invalid cross-brand records.
- [ ] The narrowest relevant product/brand-site gate passes, or any skipped gate is documented.

## Blocked by

Phase 1 local runtime CRUD implementation is complete.

