# 02 - Marketing shell and navigation pruning

## What to build

Redesign and prune the 5000 shell toward a Hermes-style marketing system console. The shell should keep only marketing-related entries and remove obsolete operations/engineering/finance modules from visible navigation. Product must remain.

## Scope

- Primary likely files:
  - `apps/dealer-workbench/src/components/DealerNav.tsx`
  - `apps/dealer-workbench/src/lib/workbench-navigation.ts`
  - `apps/dealer-workbench/src/app/layout.tsx`
  - `apps/dealer-workbench/src/app/globals.css`
- Use Rheem Red `#E4002B` for active indicators, focus rings, and primary navigation emphasis.
- Fix Chinese navigation text where touched.
- Preserve visible entries for `/comfort`, `/brand`, `/products`, `/accounts`, and `/growth`.
- Remove CRM, projects, design, BIM, finance, team, aftersales, and Hub from AppRail, SubSidebar, mobile nav, homepage cards, and quick entries.
- Keep product navigation and `/products` route access.
- Keep mobile navigation usable.
- Preserve account menu/logout behavior.

## Acceptance criteria

- [ ] AppRail, Topbar, and SubSidebar visually match the Hermes-style workbench direction.
- [ ] Only marketing-system top-level module entries remain visible.
- [ ] CRM, projects, design, BIM, finance, team, aftersales, and Hub no longer appear in visible navigation or quick entries.
- [ ] Product remains visible and `/products` remains reachable.
- [ ] Active state works for route and query-based modules such as `/products?module=catalog`.
- [ ] SubSidebar collapse state still persists.
- [ ] Brand-site dynamic nav entries still load and remain scoped.
- [ ] Account menu and logout still work.
- [ ] Mobile routes retain navigation access.
- [ ] `pnpm.cmd --dir apps/dealer-workbench run build` passes.

## Blocked by

None - can start immediately. Issue 00 is useful context but not a hard blocker.

## Out of scope

- Do not redesign page contents.
- Do not remove retained marketing routes.
- Do not physically delete obsolete page files in this issue; that is covered by `04-obsolete-module-code-deletion`.
- Do not change auth/session APIs.
- Do not implement new page features.
