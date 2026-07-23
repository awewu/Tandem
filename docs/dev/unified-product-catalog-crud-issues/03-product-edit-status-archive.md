# Issue 03: Product catalog edit, status, and archive loop

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Add product update, status change, and archive behavior to the Product Catalog page. Operators with write permission should be able to edit product master fields, toggle active/inactive state, and archive products. These actions must update the same product records used by brand pages.

## Acceptance criteria

- [ ] Write-capable users can edit product name, model, category, and system.
- [ ] Product updates call `PATCH /api/v2/product-catalog/devices/:id`.
- [ ] Status changes update the product status without changing unrelated metadata.
- [ ] Archive action calls `DELETE /api/v2/product-catalog/devices/:id`.
- [ ] Archive is presented as soft deletion, not physical deletion.
- [ ] Product Catalog edits appear on the matching brand page after refresh.
- [ ] Brand page edits appear in Product Catalog after refresh.
- [ ] Dirty, saving, success, and error states are visible.
- [ ] Read-only users cannot trigger write actions.

## Blocked by

- Issue 01: Product catalog real-data CRUD shell
