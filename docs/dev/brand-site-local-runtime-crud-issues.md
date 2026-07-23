# Brand Site Local Runtime CRUD Issues

Source PRD: `docs/dev/brand-site-local-runtime-crud-prd.md`

These issues follow the local Markdown convention and are published under `docs/dev/brand-site-local-runtime-crud-issues/`. Each issue is a thin vertical slice that should leave a demonstrable behavior behind.

## Issue List

| Issue | Title | Type | Blocked by | Parallel wave |
| --- | --- | --- | --- | --- |
| 01 | Brand site environment addresses and quick preview | AFK | None | Wave 0 |
| 02 | Public brand-site runtime product endpoint | AFK | None | Wave 0 |
| 03 | Everhot 5011 runtime product loader with static fallback | AFK | 02 | Wave 1 |
| 04 | Row-level website shelf state controls in product area | AFK | None | Wave 0 |
| 05 | Simulated non-product website materials tab | AFK | None | Wave 0 |
| 06 | Local 5011 end-to-end CRUD smoke and guard coverage | AFK | 01, 02, 03, 04, 05 | Wave 2 |

## Parallel Execution

### Wave 0: can start immediately

1. `01-brand-site-environment-addresses`
2. `02-public-brand-site-runtime-products`
3. `04-row-level-website-shelf-controls`
4. `05-simulated-non-product-materials`

Notes:

- `01`, `04`, and `05` may touch the same brand site console UI. They can run in parallel only if each agent keeps changes narrowly scoped and avoids broad formatting.
- `02` is backend/API contract work and can run independently from the UI issues.
- If you want lowest merge friction, run `02` in parallel with one UI issue, then batch the remaining UI issues.

### Wave 1: after public endpoint contract exists

1. `03-everhot-5011-runtime-loader`

Notes:

- This can begin with a mocked endpoint shape, but should not be completed until `02` defines the final public response contract.

### Wave 2: final local closed-loop proof

1. `06-local-5011-e2e-smoke`

Notes:

- This validates the whole loop: change/assign in `5000`, refresh `http://localhost:5011/`, and observe only website-published Everhot products.

## First Batch Parallel Agent Prompts

### Agent A: Issue 01

```text
Implement docs/dev/brand-site-local-runtime-crud-issues/01-brand-site-environment-addresses.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-local-runtime-crud-prd.md, and the issue file first. Scope: show brand-site environment addresses in the current 5000 brand website control panel, labeled exactly `测试环境` and `生产环境`, with quick-open links/buttons. Everhot testing environment must resolve to `http://localhost:5011/`. Do not hard-code the feature as only 5011; keep it brandCode/site-code scoped. Preserve existing product CRUD behavior. Verify with dealer-workbench build and a focused UI/static test or inspection.
```

### Agent B: Issue 02

```text
Implement docs/dev/brand-site-local-runtime-crud-issues/02-public-brand-site-runtime-products.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-local-runtime-crud-prd.md, and the issue file first. Scope: add or expose a `/api/v2/*` public brand-site runtime products endpoint for local website consumption. For Everhot, it must return only products published to the Everhot website shelf by combining product catalog data with brand-site product assignments. Do not expose internal-only product fields such as costs. Register/confirm route ownership. Verify with a focused backend/contract test.
```

### Agent C: Issue 04

```text
Implement docs/dev/brand-site-local-runtime-crud-issues/04-row-level-website-shelf-controls.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-local-runtime-crud-prd.md, and the issue file first. Scope: in the 5000 brand website product area, add a small row-level website shelf status/control showing `已上架`, `未上架`, or `已下架`. The control should create/publish/hide the current brand site's product assignment through existing brand-site assignment APIs where possible. Keep product catalog active/inactive status separate from website shelf state. Verify with dealer-workbench build and a focused interaction test or smoke.
```

### Agent D: Issue 05

```text
Implement docs/dev/brand-site-local-runtime-crud-issues/05-simulated-non-product-materials.md.

Read AGENTS.md, CLAUDE.md, docs/dev/brand-site-local-runtime-crud-prd.md, and the issue file first. Scope: complete the `产品 / 其他素材` switch so `其他素材` shows simulated non-product website material records such as homepage hero, brand story, service banner, and footer credentials. This is a UI-only simulated-data slice; do not add real DAM APIs. Preserve the product tab behavior. Verify with dealer-workbench build and a focused UI/static test or inspection.
```

## Execution Notes

- New production APIs must use `/api/v2/*` and must have route ownership.
- Do not add inline business routes to `server-production.js`.
- The first real website runtime target is Everhot local `http://localhost:5011/`.
- Current execution is Everhot-only. Do not start Rheem/Ruud or other brand runtime work from this issue set.
- Product catalog existence, catalog active/inactive status, and brand website shelf visibility are separate concepts.
