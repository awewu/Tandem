# Local 5011 End-to-End CRUD Smoke and Guard Coverage

Status: completed

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## What to build

Add the final local closed-loop proof for Everhot 5011. The smoke should demonstrate that an operator can manage website product visibility in the 5000 brand website control panel, refresh `http://localhost:5011/`, and observe only products that are published to the Everhot website shelf.

The proof should also cover the runtime fallback behavior so the 5011 website remains usable if the local runtime endpoint is unavailable.

## Acceptance criteria

- [x] The smoke starts from or targets the 5000 brand website control panel and the 5011 Everhot website.
- [x] It proves `已上架` products appear on the local 5011 website.
- [x] It proves `未上架` or `已下架` products do not appear on the local 5011 website.
- [x] It proves the 5011 site falls back to static data if the runtime endpoint is unavailable.
- [x] The test report or command output is easy for future agents to find.
- [x] Relevant product, brand-site, and website build/smoke gates pass or failures are documented.

## Verification

Completed on 2026-07-23.

- `pnpm.cmd --filter dealer-workbench build` passed.
- `pnpm.cmd --dir apps/everhot-cn run smoke:runtime-products` passed.
- `node node_modules\jest\bin\jest.js test/production-readiness/product-catalog-contract.test.js --runInBand` passed.
- `$env:TS_NODE_PROJECT='services/api/tsconfig.json'; node -r ts-node/register/transpile-only --test --test-name-pattern "Everhot public site products|route owner" services/api/src/modules/brand-registry/site-product-assignment.nodetest.ts services/api/src/modules/product-catalog/product-crud-rbac.nodetest.ts` passed.
- `pnpm.cmd --filter dealer-workbench smoke:local-5011:e2e` passed and wrote `runtime-logs/local-5011-e2e-smoke.json`.

Note: `npm.cmd run test:api-units -- --test-name-pattern="Everhot public site products"` was attempted first but failed before running tests because the repo script uses Unix-style `TS_NODE_PROJECT=...` environment assignment, which is not valid under Windows `cmd.exe`. The focused tests above were rerun with PowerShell environment assignment.

## Blocked by

- `01-brand-site-environment-addresses`
- `02-public-brand-site-runtime-products`
- `03-everhot-5011-runtime-loader`
- `04-row-level-website-shelf-controls`
- `05-simulated-non-product-materials`
