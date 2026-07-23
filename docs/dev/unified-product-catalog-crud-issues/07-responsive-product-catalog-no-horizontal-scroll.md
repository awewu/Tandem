# Issue 07: Product Catalog responsive layout without horizontal scroll

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Make the Product Catalog CRUD page fit the workbench viewport without relying on a bottom horizontal scrollbar. Dense product information should be organized into primary row content plus expandable details, drawer, modal, or stacked cards where needed.

## Acceptance criteria

- [x] Product Catalog page has no forced large table `min-width`.
- [x] Normal desktop workbench width shows no bottom horizontal scrollbar.
- [x] Long SKU/name/model/category values wrap, truncate, or move to details without breaking layout.
- [x] Row action buttons remain visible without horizontal scrolling.
- [x] Narrow viewport uses stacked layout, expandable rows, or cards.
- [x] Visual smoke or screenshot confirms no horizontal scrollbar on the target page.

## Verification

- 2026-07-23: `node apps/dealer-workbench/scripts/smoke-product-catalog-scroll.js` passed at 1366px viewport with `bodyScrollWidth=1366`, `docScrollWidth=1366`, `hasHorizontalOverflow=false`, and `wideElements=[]`.
- 2026-07-23: screenshot evidence written to `audit/product-catalog-no-horizontal-scroll.png`.
- 2026-07-23: live Product Catalog page verification with real API data also reported `hasHorizontalOverflow=false`.

## Blocked by

- Issue 01: Product catalog real-data CRUD shell
