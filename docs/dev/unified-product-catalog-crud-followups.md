# Unified Product Catalog CRUD Followups

Audit date: 2026-07-23

## Closed Follow-Ups

1. Product Catalog "All brands" aggregates supported brand tenants.
   - Evidence: `apps/dealer-workbench/src/app/products/page.tsx` issues separate product-catalog requests for Rheem, Ruud, and Everhot when `brandFilter === 'all'`.
   - Verification: `node apps/dealer-workbench/scripts/smoke-product-catalog-scroll.js` observed three requests, each with its brand and tenantId.

2. Browser-level no-horizontal-scroll verification is complete.
   - Evidence: `audit/product-catalog-no-horizontal-scroll.png`.
   - Verification: smoke metrics reported `viewportWidth=1366`, `bodyScrollWidth=1366`, `docScrollWidth=1366`, `hasHorizontalOverflow=false`, and `wideElements=[]`.

3. Imported mock products are script-, database-, API-, and page-visible.
   - Evidence: `scripts/product-catalog/import-simulated-products-to-catalog.js` maps `apps/dealer-workbench/src/lib/products-data.ts` into product-catalog seed records with idempotency key `tenantId + sku`.
   - Verification: dry-run reported `sourceProducts=10`, `created=0`, `updated=10`, `failed=0`; authenticated API checks saw imported marker counts Rheem 3, Ruud 1, Everhot 6; live page text included imported SKUs `RP-16kW-INV`, `RU-20kW`, `FA-350-HR`, and `ECONET-HUB`.

## Gate Evidence

- Focused TS nodetest: 18 passed, 0 failed.
- `pnpm.cmd --filter dealer-workbench build`: passed.
- `npm.cmd run guard:frontend-api-contract`: passed with frontend API contract failures 0 and frontend database boundary failures 0.
