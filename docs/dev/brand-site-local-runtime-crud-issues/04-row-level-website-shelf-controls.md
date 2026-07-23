# Row-Level Website Shelf State Controls in Product Area

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## What to build

In the 5000 brand website product area, add a small row-level website shelf status/control for each product. The control must show whether the product is `已上架`, `未上架`, or `已下架` for the current brand website, and should allow a permitted operator to publish or hide the product on that website.

This must stay separate from product catalog active/inactive status. A product can exist in the catalog without being visible on the website.

## Acceptance criteria

- [ ] Each product row shows website shelf status as `已上架`, `未上架`, or `已下架`.
- [ ] A small row-level control can publish an unlisted product to the current brand website.
- [ ] A small row-level control can hide a published product from the current brand website.
- [ ] The control uses brand-site product assignment APIs where possible instead of only changing local UI state.
- [ ] Catalog active/inactive status remains separate from website shelf visibility.
- [ ] A focused UI interaction test or smoke proves the publish/hide calls and resulting state labels.
- [ ] `pnpm --filter dealer-workbench build` passes.

## Blocked by

None - can start immediately.
