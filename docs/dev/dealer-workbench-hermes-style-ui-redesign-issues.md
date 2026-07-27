# Dealer Workbench Marketing Console UI Redesign Issues

Source PRD: `docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md`

These issues are published under `docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/`. The scope is now a focused 5000 marketing console, not a full dealer operations workbench.

## Confirmed Decisions

- 5000 global UI accent is Rheem Red `#E4002B`.
- 5000 should become a marketing system console.
- Keep marketing-related modules: brand websites, market growth, products, and marketing accounts/permissions.
- Keep the product module.
- Delete these modules from 5000 page/route code and visible entry points: CRM, projects, design, BIM, finance, team, aftersales, and Hub.
- Retained marketing features must not regress.

## Issue List

| Issue | Title | Type | Blocked by | Parallel wave |
| --- | --- | --- | --- | --- |
| 00 | Marketing scope inventory and obsolete module removal checklist | AFK | None | Wave 0 |
| 01 | Rheem Red design tokens and base UI primitives | AFK | None | Wave 0 |
| 02 | Marketing shell and navigation pruning | AFK | 00 optional | Wave 0 |
| 03 | Marketing table, status, loading, empty, and error baseline | AFK | 01 optional | Wave 0 |
| 04 | Obsolete module page/code deletion | AFK | 00, 02 | Wave 1 |
| 05 | Brand website console pages redesign | AFK | 00, 01, 02, 03, 04 | Wave 2 |
| 06 | Market growth pages redesign | AFK | 00, 01, 02, 03, 04 | Wave 2 |
| 07 | Product and marketing account pages redesign | AFK | 00, 01, 02, 03, 04 | Wave 2 |
| 08 | Final marketing-console regression and obsolete-entry proof | AFK | 05, 06, 07 | Wave 3 |

## First Batch Parallel Execution

### Wave 0: can start immediately

1. `00-existing-feature-inventory`
2. `01-rheem-red-design-tokens`
3. `02-shell-navigation-redesign`
4. `03-core-table-state-baseline`

Notes:

- `00` should document retained marketing features and obsolete module files/routes to delete.
- `01` should stay focused on tokens and reusable primitives.
- `02` should prune shell/navigation so 5000 no longer exposes non-marketing modules.
- `03` should create reusable marketing table/state patterns without redesigning whole pages.

## First Batch Parallel Agent Prompts

### Agent A: Issue 00

```text
Implement docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/00-existing-feature-inventory.md.

Read AGENTS.md, CLAUDE.md, docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md, docs/dev/hermes-tandem-vi-ui-design-audit.md, and the issue file first. Scope: update the inventory for the corrected 5000 scope. 5000 is now a marketing system console, not a full operations workbench. Retain brand websites, market growth, products, and marketing accounts/permissions. Create feature-retention checklists for retained marketing pages and a deletion checklist for CRM, projects, design, BIM, finance, team, aftersales, and Hub page/route files, navigation entries, mobile entries, homepage cards, quick entries, and related now-unused code. Do not redesign UI or delete files in this issue. Verify by checking the documented route/nav list against apps/dealer-workbench/src/app and apps/dealer-workbench/src/lib/workbench-navigation.ts.
```

### Agent B: Issue 01

```text
Implement docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/01-rheem-red-design-tokens.md.

Read AGENTS.md, CLAUDE.md, docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md, docs/dev/hermes-tandem-vi-ui-design-audit.md, and the issue file first. Scope: switch the 5000 marketing console design token baseline to Rheem Red #E4002B and add/normalize reusable base UI primitives for buttons, cards, inputs, status pills, loading, empty, and error states. Do not redesign full pages or remove features. Preserve retained marketing behavior. Run dealer-workbench build because UI/CSS is touched.
```

### Agent C: Issue 02

```text
Implement docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/02-shell-navigation-redesign.md.

Read AGENTS.md, CLAUDE.md, docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md, docs/dev/hermes-tandem-vi-ui-design-audit.md, and the issue file first. Scope: redesign/prune the 5000 shell/navigation into a marketing system console using Rheem Red #E4002B. Keep visible navigation for brand websites, market growth, products, and marketing accounts/permissions. Remove CRM, projects, design, BIM, finance, team, aftersales, and Hub from AppRail, SubSidebar, mobile nav, homepage cards, and quick entries. Do not delete page files in this issue unless docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/04-obsolete-module-code-deletion.md has also been explicitly assigned. Fix navigation Chinese text where touched. Do not redesign individual page contents beyond shell fit. Run dealer-workbench build and focused navigation/smoke checks if available.
```

### Agent D: Issue 03

```text
Implement docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/03-core-table-state-baseline.md.

Read AGENTS.md, CLAUDE.md, docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md, docs/dev/hermes-tandem-vi-ui-design-audit.md, and the issue file first. Scope: establish reusable 5000 marketing-console table/list, status pill, loading, empty, and error patterns with Rheem Red #E4002B accent and lucide icons. Keep changes narrow; do not redesign brand/product/account/growth pages wholesale. Preserve retained marketing pagination, filters, upload/import/export, and publish/shelf actions. Run dealer-workbench build if UI is touched.
```

### Agent E: Issue 04

```text
Implement docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/04-obsolete-module-code-deletion.md.

Read AGENTS.md, CLAUDE.md, docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md, docs/dev/hermes-tandem-vi-ui-design-audit.md, docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/00-existing-feature-inventory.md, and the issue file first. Scope: delete obsolete 5000 modules from page/route code and related unused references: CRM, projects, design, BIM, finance, team, aftersales, and Hub. Product must be retained. Remove corresponding directories/files under apps/dealer-workbench/src/app where safe, clean navigation/home/mobile/quick-entry references, and remove now-unused module-specific components/data only when not referenced by retained marketing pages. Do not delete product, brand website, growth, or account functionality. Run dealer-workbench build and report failures exactly.
```

## Later Batch Prompt Seeds

Use these after Wave 0 lands:

- Issue 05: brand website console pages, including `/comfort/sites`, `/comfort/sites/[code]`, and `/brand`.
- Issue 06: market growth pages under `/growth`.
- Issue 07: `/products` and `/accounts`.
- Issue 08: final proof that retained marketing features work and obsolete modules no longer appear in 5000 navigation, homepage entry points, or routable pages.
