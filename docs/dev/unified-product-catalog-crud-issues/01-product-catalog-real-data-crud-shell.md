# Issue 01: Product catalog real-data CRUD shell

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Build the first database-backed Product Catalog management page in the dealer workbench. Operators should be able to load real products from the product-catalog API, filter/search them, and see create/edit/archive affordances without depending on mock-only product arrays.

This slice should establish the page structure and real read path, while keeping the UI responsive and avoiding a bottom horizontal scrollbar.

## Acceptance criteria

- [ ] Product Catalog page reads products from `/api/v2/product-catalog/devices`.
- [ ] Page supports search by SKU, name, or model when backend query capability exists.
- [ ] Page supports brand filter for All, Rheem, Ruud, and Everhot.
- [ ] Page supports status filter for active, inactive, and archived where available.
- [ ] Product rows show brand, SKU/name/model, category/system, status, and actions.
- [ ] Normal desktop workbench width shows no bottom horizontal scrollbar.
- [ ] Read-only users can view the page without mutation controls.
- [ ] Focused build or smoke verification is documented.

## Blocked by

None - can start immediately.
