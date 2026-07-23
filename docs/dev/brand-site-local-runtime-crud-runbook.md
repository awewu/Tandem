# Brand Site Local Runtime CRUD Runbook

Status: implementation handoff

Parent PRD: `docs/dev/brand-site-local-runtime-crud-prd.md`

Issue set:

- `docs/dev/brand-site-local-runtime-crud-issues/01-brand-site-environment-addresses.md`
- `docs/dev/brand-site-local-runtime-crud-issues/02-public-brand-site-runtime-products.md`
- `docs/dev/brand-site-local-runtime-crud-issues/03-everhot-5011-runtime-loader.md`
- `docs/dev/brand-site-local-runtime-crud-issues/04-row-level-website-shelf-controls.md`
- `docs/dev/brand-site-local-runtime-crud-issues/05-simulated-non-product-materials.md`
- `docs/dev/brand-site-local-runtime-crud-issues/06-local-5011-e2e-smoke.md`

## Goal

This runbook explains how to run and verify the local Everhot closed loop:

1. Manage Everhot website product visibility in the `5000` brand website control panel.
2. Refresh the local Everhot website at `http://localhost:5011/`.
3. Confirm only products published to the Everhot website shelf are rendered from the public runtime endpoint.
4. Confirm the website remains usable by falling back to static generated product data when the runtime endpoint is unavailable.

This is a local development proof only. It does not publish to the production Everhot domain and does not replace the existing static generation pipeline.

## Services

Run these two local surfaces for the closed-loop proof.

| Surface | Port | Purpose | Command |
| --- | --- | --- | --- |
| Dealer workbench / brand website control panel | `5000` | Backend/admin surface for `/comfort/sites/everhot`, product rows, website shelf controls, and environment links | `pnpm --filter dealer-workbench dev` |
| Everhot local website | `5011` | Public Everhot website runtime target | `pnpm --dir apps/everhot-cn run dev` |

Open:

- Control panel: `http://localhost:5000/comfort/sites/everhot`
- Everhot website: `http://localhost:5011/`

The Everhot static server proxies same-origin `/api/v2/*` requests to its API target. By default `apps/everhot-cn/scripts/serve.js` uses `EVERHOT_API_TARGET`, then `NEXUS_API_ORIGIN`, then `http://localhost:5500`. If your local API origin is different, set `EVERHOT_API_TARGET` before starting the `5011` site.

## Environment Addresses

The 5000 control panel displays the current brand website environment links in `apps/dealer-workbench/src/app/comfort/[[...section]]/BrandSiteConsoleShell.tsx`.

The link labels are produced by `resolveBrandSiteEnvironmentLinks` in `apps/dealer-workbench/src/lib/brand-product-adapter.ts`:

- `测试环境` maps to `site.developmentUrl`, with an Everhot fallback of `http://localhost:5011/`.
- `生产环境` maps to `site.productionUrl`, with an Everhot fallback of `https://www.everhot.com.cn/`.

Brand site create/edit presets live in `apps/dealer-workbench/src/app/comfort/[[...section]]/BrandSitesManager.tsx`. The Everhot preset is:

- `developmentUrl`: `http://localhost:5011`
- `productionUrl`: `https://www.everhot.com.cn`
- `appKey`: `everhot-cn`

Operators see the quick-open links near the top of `http://localhost:5000/comfort/sites/everhot`.

## Product And Material Tabs

The brand website content panel has a `产品 / 其他素材` switch:

- `产品` keeps the product row table and product website fields.
- `其他素材` shows simulated non-product website material records, such as homepage hero, brand story, service banner, and footer credentials.

The `其他素材` tab is intentionally simulated. It is not backed by DAM and does not represent a production publishing workflow.

## Publish Or Hide A Product

In `http://localhost:5000/comfort/sites/everhot`, use the product row website shelf cell:

- `已上架`: the product has a published assignment for the current brand website.
- `未上架`: the product exists in the product catalog but has no website assignment.
- `已下架`: the product has a hidden website assignment and should not render on the public website.

Row action behavior:

- For `未上架` rows, click `上架`. The UI creates a brand-site product assignment through `POST /api/v2/brand-sites/:siteCode/product-assignments`, then publishes it through `POST /api/v2/brand-sites/:siteCode/product-assignments/:assignmentId/publish`.
- For `已下架` rows, click `上架`. The UI publishes the existing assignment.
- For `已上架` rows, click `下架`. The UI calls `POST /api/v2/brand-sites/:siteCode/product-assignments/:assignmentId/hide`.

These website shelf states are separate from product catalog `active` / `inactive` / `archived` status. Editing product facts does not automatically publish the product to the website shelf.

## Runtime Product Loading On 5011

The runtime loader is in `apps/everhot-cn/public/js/catalog.js`.

During local development, the loader:

1. Detects local runtime by hostname (`localhost`, `127.0.0.1`, or `::1`) unless overridden by `window.EVERHOT_RUNTIME_PRODUCTS`.
2. Requests the site-scoped public endpoint first:
   `GET /api/v2/sites/everhot/products?locale=zh-CN`
3. Falls back to the compatible brand endpoint:
   `GET /api/v2/brand/everhot/products?locale=zh-CN`
4. Normalizes runtime products into the existing website product shape.
5. Reinstalls `window.EVERHOT_CATALOG` so existing product listing, detail, search, selector, and professional lookup consumers keep working.

If both runtime endpoints fail, return an invalid response, or `fetch` is unavailable, the loader leaves the existing static generated `window.EVERHOT_PRODUCTS` data in place and sets `window.EVERHOT_PRODUCTS_STATUS` to `fallback`.

Outside local runtime, the loader does not fetch by default. It uses the existing static generated data and sets status to `static`.

The static generation pipeline remains intact:

- `apps/everhot-cn/scripts/fetch-products-from-nexus.mjs`
- `apps/everhot-cn/public/js/products-data.js`
- `apps/everhot-cn/package.json` `build` script

## Public Runtime Endpoint

The site-scoped public endpoint is owned by the brand-site product assignment module:

- List: `GET /api/v2/sites/:siteCode/products`
- Detail: `GET /api/v2/sites/:siteCode/products/:publicSlug`

For Everhot local runtime, it returns only products with published Everhot website assignments. Draft, hidden, archived, deleted, unassigned, and website-unsafe/internal fields are excluded from the public website response.

The compatible legacy brand endpoint remains available:

- List: `GET /api/v2/brand/:slug/products`
- Detail: `GET /api/v2/brand/:slug/products/:sku`

## Verification Commands

Commands used for the implemented local runtime CRUD work:

```powershell
pnpm.cmd --filter dealer-workbench build
```

```powershell
node node_modules\jest\bin\jest.js --runTestsByPath test/production-readiness/product-catalog-contract.test.js --runInBand
```

```powershell
pnpm.cmd --dir apps/everhot-cn run smoke:runtime-products
```

```powershell
pnpm.cmd --dir apps/everhot-cn run audit
```

```powershell
pnpm.cmd --filter dealer-workbench smoke:local-5011:e2e
```

The local 5011 E2E command writes its proof report to `runtime-logs/local-5011-e2e-smoke.json`.

Optional URL overrides:

```powershell
$env:DEALER_WORKBENCH_URL='http://localhost:5000'
$env:EVERHOT_SITE_URL='http://localhost:5011'
```

Expected live E2E proof:

- The 5000 control panel shows `已上架`, `未上架`, and `已下架` product shelf states.
- Publishing a `未上架` Everhot smoke product makes it appear on `5011`.
- Hiding an `已上架` Everhot smoke product removes it from `5011`.
- `已下架` Everhot smoke products do not appear on `5011`.
- Blocking both `GET /api/v2/sites/everhot/products` and the compatible `GET /api/v2/brand/everhot/products` endpoint makes the 5011 page fall back to static product data.

## Troubleshooting

- If `5011` renders only static data, inspect `window.EVERHOT_PRODUCTS_STATUS` in the browser console. `fallback` means runtime endpoints failed; `static` means the page did not consider itself local runtime.
- If `5011` cannot reach the API, confirm `EVERHOT_API_TARGET` / `NEXUS_API_ORIGIN` points to the running API origin used by the local stack.
- If products show in the 5000 table but not on `5011`, confirm the row website shelf state is `已上架`, not just catalog `active`.
- If environment links are missing, confirm the Everhot brand site has `developmentUrl` / `productionUrl` configured, or that the fallback in `brand-product-adapter.ts` still includes Everhot.

## Suggested Skills

- Use `diagnose` if the live 5000/5011 smoke fails or a product appears in the wrong shelf state.
- Use `handoff` when transferring this runbook plus current command output to a fresh agent.
