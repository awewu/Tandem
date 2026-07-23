# Issue 02: Product catalog create with explicit brand selection

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Add product creation to the Product Catalog page. Unlike the brand page, this entry point must require the operator to choose the product brand. The selected brand must resolve to the correct brand operation tenant and write through the existing product-catalog create endpoint.

The created product should immediately appear in both the Product Catalog page and the matching brand page after refresh.

## Acceptance criteria

- [ ] Create form requires choosing Rheem, Ruud, or Everhot.
- [ ] Brand selection maps to the correct brand operation tenant ID.
- [ ] Create form captures at least name, model or SKU seed, category, and system.
- [ ] Create action calls `POST /api/v2/product-catalog/devices`.
- [ ] Created product has the selected brand and correct tenant scope.
- [ ] Created product appears in the Product Catalog list after refresh.
- [ ] Created product appears on the matching `/comfort/sites/:brandCode` page after refresh.
- [ ] Create errors from backend validation are shown to the operator.

## Blocked by

- Issue 01: Product catalog real-data CRUD shell
