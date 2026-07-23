# Unified Product Catalog CRUD Issue Breakdown

Parent PRD: `docs/dev/unified-product-catalog-crud-prd.md`

## Issues

1. `docs/dev/unified-product-catalog-crud-issues/01-product-catalog-real-data-crud-shell.md`
2. `docs/dev/unified-product-catalog-crud-issues/02-product-create-brand-selection.md`
3. `docs/dev/unified-product-catalog-crud-issues/03-product-edit-status-archive.md`
4. `docs/dev/unified-product-catalog-crud-issues/04-brand-site-assignment-brand-guard.md`
5. `docs/dev/unified-product-catalog-crud-issues/05-website-display-fallback-projection.md`
6. `docs/dev/unified-product-catalog-crud-issues/06-import-simulated-products-to-catalog.md`
7. `docs/dev/unified-product-catalog-crud-issues/07-responsive-product-catalog-no-horizontal-scroll.md`
8. `docs/dev/unified-product-catalog-crud-issues/08-product-website-metadata-editor.md`
9. `docs/dev/unified-product-catalog-crud-issues/09-group-website-multibrand-picker.md`
10. `docs/dev/unified-product-catalog-crud-issues/10-rbac-and-production-readiness-gates.md`

## First Parallel Batch

These can start together:

- Issue 01: Product catalog real-data CRUD shell
- Issue 04: Enforce brand website shelf assignment rules
- Issue 05: Website display fallback projection
- Issue 06: Import simulated products into product catalog

Issue 01 creates the product catalog UI baseline. Issue 04 and Issue 05 are backend/public projection slices with minimal dependency on the page shell. Issue 06 can independently prepare durable seed data.

## Follow-Up Batch

- Issue 02 after Issue 01.
- Issue 03 after Issue 01.
- Issue 07 after Issue 01.
- Issue 08 after Issue 03.
- Issue 09 after Issue 04.
- Issue 10 after the core implementation slices.
