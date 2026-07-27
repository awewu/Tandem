# 01 - Rheem Red design tokens and base UI primitives

## What to build

Switch the 5000 dealer-workbench visual baseline to Rheem Red `#E4002B` and establish reusable base UI primitives that future page redesign issues can use without duplicating styles.

## Scope

- Update `apps/dealer-workbench/src/app/globals.css` token baseline so `brand-*` uses Rheem Red `#E4002B` and an appropriate light/dark scale.
- Keep semantic colors separate from brand color.
- Normalize reusable classes for buttons, cards, inputs/selects, status pills, loading, empty, error, toolbar, and table containers.
- Preserve existing page behavior and markup wherever possible.
- Keep Rhautt green only as optional secondary/business auxiliary color, not global UI accent.

## Acceptance criteria

- [ ] `brand-500` or equivalent primary token maps to Rheem Red `#E4002B`.
- [ ] Main button, active/focus, important link, and nav emphasis styles use Rheem Red tokens.
- [ ] Error/delete/danger states use semantic danger, not brand token by default.
- [ ] Reusable classes exist for primary/secondary buttons, cards, status pills, loading, empty, error, and table shell.
- [ ] Existing 5000 routes still render.
- [ ] `pnpm.cmd --dir apps/dealer-workbench run build` passes.

## Blocked by

None - can start immediately.

## Out of scope

- Do not redesign whole pages.
- Do not remove or rename business actions.
- Do not change backend APIs, database, upload behavior, product pagination, or shelf state logic.
