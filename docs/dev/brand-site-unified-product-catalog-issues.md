# Brand Site Unified Product Catalog Issues

Source PRD: `docs/dev/brand-site-unified-product-catalog-prd.md`

These issues are published under `docs/dev/brand-site-unified-product-catalog-issues/`. Each issue is a vertical slice with a demonstrable behavior.

## Issue List

| Issue | Title | Type | Blocked by | Parallel wave |
| --- | --- | --- | --- | --- |
| 01 | Brand-filtered product listing for Rheem, Ruud, and Everhot | AFK | None | Wave 0 |
| 02 | Paginated product query and brand console pagination controls | AFK | None | Wave 0 |
| 03 | Responsive no-horizontal-scroll brand product table | AFK | 01 | Wave 1 |
| 04 | Full product edit modal/drawer from brand pages | AFK | 01 | Wave 1 |
| 05 | Row-level website shelf state and assignment enforcement | AFK | 01 | Wave 1 |
| 06 | Website menu group options from brand navigation categories | AFK | 01 | Wave 1 |
| 07 | Everhot 5011 published-product runtime proof | AFK | 05 | Wave 2 |
| 08 | End-to-end smoke and regression coverage | AFK | 02, 03, 04, 05, 06, 07 | Wave 3 |

## Parallel Execution

### Wave 0: can start immediately

1. `01-brand-filtered-product-listing`
2. `02-paginated-product-query`

Notes:

- `01` is the core brand-filtered product behavior.
- `02` can run in parallel if it stays focused on query contract and pagination controls. It should integrate with `01` before completion.

### Wave 1: after brand-filtered list exists

1. `03-responsive-no-horizontal-scroll-table`
2. `04-full-product-edit-modal`
3. `05-row-level-shelf-state`
4. `06-menu-group-options`

Notes:

- These touch the same brand console UI and should keep patches narrow.
- Lowest merge friction path: run `03` with one functional issue, then batch the other two.
- `05` may also touch backend brand/site assignment validation.

### Wave 2: after shelf state contract is stable

1. `07-everhot-5011-runtime-proof`

### Wave 3: final proof

1. `08-e2e-smoke-and-regression`

## First Batch Parallel Agent Prompts

### Agent A: Issue 01

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/01-brand-filtered-product-listing.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: make `/comfort/sites/rheem`, `/comfort/sites/ruud`, and `/comfort/sites/everhot` list product catalog records filtered by the current brand. Product data must come from the product catalog, not a separate website-only list. Keep website shelf state separate. Verify with focused backend/frontend checks and dealer-workbench build if UI is touched.
```

### Agent B: Issue 02

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/02-paginated-product-query.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: add or complete pagination/search/filter behavior for brand product lists so the console does not load all products at once. Support page, pageSize, keyword, status, and category where existing APIs allow. Preserve brand filtering. Verify with focused tests and dealer-workbench build if UI is touched.
```

## Next Batch Parallel Agent Prompts

### Agent C: Issue 03

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/03-responsive-no-horizontal-scroll-table.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: redesign the brand product table so normal desktop workbench widths do not show a horizontal scrollbar. Use compact columns and move dense data into actions/edit modal. Match current Rhautt Nexus / Rheem VI. Verify with a screenshot or browser check at normal desktop width plus dealer-workbench build.
```

### Agent D: Issue 04

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/04-full-product-edit-modal.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: clicking edit/modify from a brand product row opens a modal or drawer above the page, not inline expansion. The modal edits the same product catalog record and groups fields into base information, website display, images/materials, specs, selling points/FAQ, and shelf state where existing data supports it. Verify save behavior with focused interaction coverage and dealer-workbench build.
```

### Agent E: Issue 05

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/05-row-level-shelf-state.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: row-level controls show and transition `未上架`, `已上架`, and `已下架` for the current brand website. Shelf state must use brand-site product assignments, while product information stays in the product catalog. Backend must reject cross-brand assignment where needed. Verify with focused backend/interaction tests.
```

### Agent F: Issue 06

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/06-menu-group-options.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: replace free-text menu group editing with brand-aware menu group options where available. For Everhot, include the website navigation categories shown in the PRD context, such as 家用中央空调, 地暖系统, 全热新风, 热水系统, 燃气冷凝壁挂炉, 零冷水燃气热水器, 空气能热水器, 容积式燃气热水器, 电热水器, and 采暖热水两联供. Verify the options appear in the edit modal/drawer.
```

## Final Batch Prompt

### Agent G: Issue 07

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/07-everhot-5011-runtime-proof.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: prove `http://localhost:5011/` reads published Everhot products from the public runtime endpoint and excludes unlisted/hidden products. Runtime failure must fall back to static data. Do not implement Rheem/Ruud website runtimes unless they already share this exact path. Verify with the Everhot runtime smoke.
```

### Agent H: Issue 08

```text
Implement docs/dev/brand-site-unified-product-catalog-issues/08-e2e-smoke-and-regression.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-unified-product-catalog-prd.md, and the issue file first. Scope: add final smoke/regression coverage for the whole flow: product exists in catalog, appears under its brand page, edits save to the same product record, shelf state controls website visibility, table has no normal-width horizontal scroll, pagination works, and Everhot 5011 shows only published Everhot products. Run the narrowest relevant gates and report any failures.
```
