# Issue 06: Import simulated products into product catalog

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Identify the current simulated product sources used by the workbench and import them into the real product-catalog database through an idempotent seed/import path. After this slice, Product Catalog CRUD should operate against durable API data rather than mock-only arrays.

## Acceptance criteria

- [x] Current simulated product source or sources are identified and documented.
- [x] Import maps each product to brand, tenantId, SKU, name, category, status, spec, and brand metadata where available.
- [x] Import is idempotent by `tenantId + sku`.
- [x] Import does not duplicate existing products.
- [x] Imported products are visible from `/api/v2/product-catalog/devices`.
- [x] Imported products appear in the Product Catalog page.
- [x] Import path can be rerun safely in local development.
- [x] Verification output records how many products were created or updated.

## Verification

- 2026-07-23: `node scripts/product-catalog/import-simulated-products-to-catalog.js` connected to the local PostgreSQL target and reported `sourceProducts=10`, `created=0`, `updated=10`, `failed=0`.
- 2026-07-23: authenticated `GET /api/v2/product-catalog/devices` checks returned imported records for Rheem, Ruud, and Everhot; imported marker counts were Rheem 3, Ruud 1, Everhot 6.
- 2026-07-23: live Product Catalog page verification found imported SKUs `RP-16kW-INV`, `RU-20kW`, `FA-350-HR`, and `ECONET-HUB`.

## Blocked by

None - can start immediately.
