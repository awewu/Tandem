# Everhot Product CRUD Agent Prompts

## Concurrency rules

- Run concurrently editing agents in isolated git worktrees or isolated branches. Do not let multiple agents edit the same working tree.
- Read the repository `AGENTS.md`, `CLAUDE.md`, and the assigned issue completely before acting.
- Do not invoke any installed skill unless the user explicitly authorizes that skill for the run.
- Prioritize the fastest functional closed loop. Do not add PDF/technical-document uploads, approval workflows, rollback, operator logs, or extra security audit work.
- Reuse existing authentication, tenant isolation, product-catalog, file-artifact, and public brand API boundaries. Do not create a duplicate product backend.
- Preserve unrelated user changes. Keep the diff scoped to the assigned issue.
- Do not commit or push unless the parent agent explicitly asks. Report changed files, commands run, results, and remaining blockers.

## Wave 1 - Agent A - Basic CRUD

```text
Implement `.scratch/everhot-product-crud/issues/01-basic-product-crud.md` end to end.

Work from the existing NestJS product-catalog domain and the current Nexus management console. Do not create a new products module and do not extend the old standalone web-manager backend. Reuse the existing Everhot brand tenant and public brand product endpoints.

Deliver the smallest validated contract for name, model, stable slug, category, system category, series, summary, and tags. Preserve existing `meta.everhot` content through safe merge behavior. Implement list, create, edit, and delete semantics in the current management UI and public runtime response. Save must become visible through the public API without a static publish step.

Place the Everhot management page under the existing Website Management hierarchy. Clicking the Everhot logo or name in the site list must navigate to `/comfort/sites/everhot/products`, with a “网站管理 / Everhot / 产品管理” breadcrumb and a route back to the site list. Keep the existing site-row Edit action dedicated to domain, logo, and other site metadata. This is a UI ownership decision only; product writes must remain in D2 product-catalog.

Do not implement PDF/technical-document upload, review, rollback, logs, or broad refactors. Run focused backend, contract, management build, and observable CRUD/public-read tests. Report exact verification results and any integration point that Wave 1 Agent B must consume.
```

## Wave 1 - Agent B - Root Deployment

```text
Implement `.scratch/everhot-product-crud/issues/02-root-path-deployment.md`.

Own the Everhot independent-root deployment conversion. Remove the public-page dependency on `/everhot/` so `/`, `/products/`, product detail, scripts, styles, images, navigation, robots, sitemap, and canonical URLs work from the domain root. Fix the local server empty-base redirect loop and preserve mobile/desktop behavior.

Keep this task mechanical and scoped. Do not change product schema, management CRUD, PDF handling, or product business logic. Coordinate through the agreed runtime product contract but do not invent a competing API client. Run the Everhot build/link audit and browser checks at root-path URLs. Report any files likely to conflict with runtime integration.
```

## Wave 2 - Agent C - Status And Order

```text
Issue 01 must already be present in this worktree. Implement `.scratch/everhot-product-crud/issues/03-product-status-and-order.md` end to end.

Add the minimum active/inactive/archived behavior and stable non-negative website display order across persistence, NestJS management/public APIs, Nexus management UI, and Everhot runtime rendering. Active means visible, inactive means down, archived is the management delete result. Public lists and details must exclude inactive/archived products and sort consistently.

Do not build restore, approval, history, operator logs, or extra release gates. Do not touch images, specifications, highlights, or recommendations except where required to filter invalid public products. Run focused API/UI/runtime tests and report results.
```

## Wave 2 - Agent D - Product Images

```text
Issue 01 must already be present in this worktree. Implement `.scratch/everhot-product-crud/issues/04-product-images.md` end to end.

Reuse the current file-artifact/DAM foundation to support exactly one main image and multiple ordered detail images. Add management upload, preview, replacement, deletion, and ordering. Add a narrowly public image read path that only serves assets linked to active Everhot products. Render the main image on cards/details and the ordered gallery on the detail page, preserving the current missing-image fallback.

Do not implement PDF, specification-sheet, manual, BIM, or technical-document upload. Do not make the entire file-artifact controller public. Resolve the existing Fastify upload incompatibility only as far as image upload requires. Run focused file, API, UI, and browser tests and report results.
```

## Wave 2 - Agent E - Specs And Highlights

```text
Issue 01 must already be present in this worktree. Implement `.scratch/everhot-product-crud/issues/05-specs-and-highlights.md` end to end.

Add structured, ordered specification rows and product highlights to the validated product contract. In the Nexus management UI, use repeatable row controls with add, edit, delete, and ordering rather than raw JSON. Return the same order from the public detail API and render real data in the Everhot highlights, headline stats, and specification table. Empty collections must remove empty sections.

Do not add a new table unless the existing validated JSONB model cannot satisfy the acceptance criteria. Do not implement PDF or technical documents. Run focused validation, API, management UI, and public rendering tests and report results.
```

## Wave 2 - Agent F - Recommendations

```text
Issue 01 must already be present in this worktree. Implement `.scratch/everhot-product-crud/issues/06-product-recommendations.md` end to end.

Use the existing product-relations domain and add the minimum directed website recommendation semantics. The management UI must search/select other Everhot products, reject self/duplicates, remove items, and order them. The public detail response must return only active recommendation targets with slug, name, main image, tags, summary, and stable detail URL. The Everhot detail page must render that configured order and navigate correctly.

Do not replace configured recommendations with the current same-category first-three heuristic. Do not add AI recommendation, approval, logs, PDF, or unrelated relation types. Run focused relationship, public projection, management UI, and browser navigation tests and report results.
```

## Wave 3 - Agent G - Runtime Integration And E2E

```text
Issues 01 through 06 must already be present in this worktree. Implement `.scratch/everhot-product-crud/issues/07-runtime-consumers-and-e2e.md`.

Own final integration only. Make all Everhot product consumers use one asynchronous runtime public-product loader: homepage, category pages, detail, search, selector, comparison, and professional lookup. Prefer the Everhot deployment's same-origin API reverse proxy and do not hardcode a production API host. Add only necessary loading, failure, empty, and not-found states.

Begin the management-side demonstration from Website Management by clicking the Everhot logo or name and entering `/comfort/sites/everhot/products`. Do not introduce a second standalone Everhot management entry.

Exercise the complete observed workflow: create a product, edit content, upload images, set specifications/highlights, configure recommendations, set order, publish by active status, see it on the independent root-domain website, then down and delete it. Verify no static rebuild is required and no public page URL contains `/everhot/`.

Do not introduce PDF/technical-document upload, approval, rollback, operator logs, or a framework rewrite. Run the affected project gates plus desktop/mobile browser verification. Report exact commands, outcomes, skipped checks, and residual risks.
```

## Recommended launch order

1. Launch Agent A and Agent B concurrently in isolated worktrees.
2. Integrate and verify Issue 01 before starting Wave 2.
3. Launch Agents C, D, E, and F concurrently in isolated worktrees based on the same Issue 01 baseline.
4. Integrate Wave 2 changes in dependency order and resolve contract conflicts centrally.
5. Launch Agent G only after Issues 01 through 06 are integrated.
