# Brand Site Local Runtime CRUD Follow-ups

Parent PRD: `docs/dev/brand-site-local-runtime-crud-prd.md`

## Full Live-Stack Smoke

The current `pnpm.cmd --filter dealer-workbench smoke:local-5011:e2e` proof uses the existing Node + Playwright smoke harness and route-level mocks to keep the 5000 control-panel actions, 5011 runtime rendering, and fallback assertions deterministic.

A future hardening slice should add an optional live-stack variant that uses a real local API/database seed for `/api/v2/brand-sites/:siteCode/product-assignments` and `/api/v2/sites/:siteCode/products`, then runs the same 5000 -> 5011 assertions without Playwright route mocks. This is intentionally outside the current consistency pass because it changes runtime/test infrastructure rather than fixing documentation or label drift.

## Other Brand Runtime Loaders Paused

The current public runtime loader is implemented only inside `apps/everhot-cn` and is intentionally proven through the local `5011` site first.

Do not start Rheem, Ruud, or other brand runtime loaders from the current PRD. The current working scope is only Everhot product CRUD and the 5000 -> 5011 local loop.

## Legacy Everhot Catalog Scripts

The Everhot site package still owns Everhot-specific static sync/build scripts such as `apps/everhot-cn/scripts/fetch-products-from-nexus.mjs`, image sync helpers, and the local `5011` smoke. These are acceptable for the current Everhot-only proof.
