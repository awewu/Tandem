# Issue 10: Product CRUD RBAC and readiness gates

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Close the product CRUD delivery with RBAC, route ownership, and focused readiness gates. Product write actions must be available only to authorized roles or permissions, rejected server-side when unauthorized, and covered by the project's existing guard direction.

## Acceptance criteria

- [x] Product Catalog write actions are hidden or disabled for read-only users.
- [x] Backend rejects unauthorized create, update, and archive attempts.
- [x] Site product assignment guard rejects unauthorized writes.
- [x] New or changed API routes have route ownership where applicable.
- [x] Focused frontend build passes.
- [x] Relevant backend/product readiness tests pass or skipped gates are reported plainly.
- [x] PRD acceptance criteria are mapped to verification evidence.

## Verification

- 2026-07-23: focused TS nodetest command passed 18 tests across product CRUD RBAC, site shelf assignment guard/projection, brand product adapter RBAC, and simulated product import idempotency.
- 2026-07-23: `pnpm.cmd --filter dealer-workbench build` passed, including compile, TypeScript, static page generation, and build traces.
- 2026-07-23: `npm.cmd run guard:frontend-api-contract` passed with `failures=0`, `warnings=0`, and frontend database boundary `failures=0`.
- 2026-07-23: route ownership assertions for `/api/v2/product-catalog/devices`, `/api/v2/brand-sites/rheem/product-assignments`, and `/api/v2/sites/rheem/products` passed in `product-crud-rbac.nodetest.ts`.

## Blocked by

- Issue 02: Product catalog create with explicit brand selection
- Issue 03: Product catalog edit, status, and archive loop
- Issue 04: Enforce brand website shelf assignment rules
- Issue 05: Website display fallback projection
