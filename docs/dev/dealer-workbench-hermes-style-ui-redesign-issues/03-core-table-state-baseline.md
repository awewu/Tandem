# 03 - Core table, status, loading, empty, and error baseline

## What to build

Create reusable table/list and state patterns for retained 5000 marketing pages so later page redesign issues can preserve function while making the UI consistent.

## Scope

- Establish a standard visual pattern for:
  - page section header
  - filter/search toolbar
  - table/list shell
  - row hover and row actions
  - status pills
  - loading state
  - empty state
  - error state
  - pagination footer
- Use Rheem Red `#E4002B` as the primary accent and semantic colors for business states.
- Use `lucide-react` icons for state and action visuals.
- Apply to a very narrow example only if needed to prove the classes/components work.

## Acceptance criteria

- [ ] A reusable pattern exists for table/list shell and filter toolbar.
- [ ] Status pills distinguish brand accent from semantic states.
- [ ] Loading, empty, and error states are visually clear and reusable.
- [ ] Pagination footer pattern supports previous/next/current/total without assuming full data load.
- [ ] Normal desktop table guidance avoids visible horizontal scrollbars.
- [ ] No retained marketing page loses filters, pagination, upload/import/export, publish/shelf, or row actions.
- [ ] `pnpm.cmd --dir apps/dealer-workbench run build` passes if UI/CSS code is touched.

## Blocked by

None - can start immediately. Issue 01 is useful context but not a hard blocker.

## Out of scope

- Do not redesign `/comfort/sites`, `/brand`, `/products`, `/accounts`, or `/growth` wholesale.
- Do not change backend query contracts.
- Do not alter product catalog, brand site shelf state, or image upload behavior.
