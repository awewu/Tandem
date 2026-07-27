# 00 - Marketing scope inventory and obsolete module removal checklist

## What to build

Update the 5000 inventory for the corrected product scope. 5000 is now a marketing system console, not a full operations workbench. The inventory must protect retained marketing functionality and clearly identify obsolete non-marketing modules whose page/route code and visible entry points should be deleted.

## Output

- `docs/dev/dealer-workbench-marketing-console-feature-retention-checklist.md`

## Scope

- Inspect `apps/dealer-workbench/src/app`, `apps/dealer-workbench/src/components`, and `apps/dealer-workbench/src/lib/workbench-navigation.ts`.
- Document retained marketing routes: `/`, `/brand`, `/comfort/sites`, `/comfort/sites/[code]`, `/growth`, `/products`, and `/accounts`.
- For retained marketing pages, list visible modules, navigation entries, primary actions, row actions, filters, forms, upload/import/export actions, pagination, publish/shelf actions, role/permission states, loading/empty/error states, and known smoke/build gates.
- Document obsolete modules to delete from 5000 page/route code and visible entry points: CRM, projects, design, BIM, finance, team, aftersales, and Hub.
- Explicitly mark `/products` as retained and not part of the deletion list.
- Add the output under `docs/dev` and reference the corrected PRD.

## Acceptance criteria

- [ ] Retained marketing routes are listed.
- [ ] `/comfort/sites`, `/comfort/sites/[code]`, `/brand`, `/growth`, `/products`, and `/accounts` have detailed feature-retention checklists.
- [ ] CRM, projects, design, BIM, finance, team, aftersales, and Hub are listed as obsolete 5000 modules to delete.
- [ ] `/products` is clearly listed as retained.
- [ ] The checklist identifies obsolete page/route files and where obsolete modules currently appear in navigation, mobile nav, homepage cards, or quick entries.
- [ ] Existing smoke scripts relevant to retained marketing pages are listed.
- [ ] The checklist clearly says retained marketing UI redesign cannot be accepted if a listed retained feature is missing.
- [ ] No UI redesign or business logic changes are made in this issue.

## Blocked by

None - can start immediately.

## Out of scope

- Do not change CSS.
- Do not redesign shell/navigation.
- Do not alter APIs, database, product behavior, image upload, shelf state, or pagination.
