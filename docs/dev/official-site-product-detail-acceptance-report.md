# Official Site Product Detail Acceptance Report

Date: 2026-07-29

Scope: official website product detail only. This is not a mall, cart, checkout, or mini-program flow.

## Accepted Requirements

- Admin product create/edit exposes an official product detail rich-text field.
- Detail images can be uploaded through the existing file artifact upload path and inserted into rich text.
- Detail image guidance and preview use 750px-wide long-image rules with unrestricted height.
- Product content is persisted to PostgreSQL in `product_content.official_detail_html`.
- Admin edit reads product content back from the API and can clear an existing detail by saving empty content.
- Rheem and Ruud official product lists link to `/products/detail/?model=...`.
- Rheem and Ruud official detail pages request the brand product detail endpoint first and render `officialDetailHtml`.
- Official detail body is centered with a maximum width of 750px.
- Detail images render at `width: 100%; max-width: 750px; height: auto`.
- Products without detail content render a non-error empty state.
- Rich text is sanitized before persistence and again before official-site rendering.

## Files

- Backend field, API contract, sanitizer: `services/api/src/modules/product-catalog/`
- Admin product editor: `apps/dealer-workbench/src/app/products/page.tsx`
- Admin API helper: `apps/dealer-workbench/src/lib/api.ts`
- Official site rendering: `apps/rheem-cn/public/js/catalog.js`, `apps/ruud-cn/public/js/catalog.js`
- Official site 750px CSS: `apps/rheem-cn/public/css/catalog.css`, `apps/ruud-cn/public/css/catalog.css`
- Migration: `database/postgres/migrations/058_product_content_official_detail_html.sql`

## Verification Run

Passed:

- `TS_NODE_PROJECT=services/api/tsconfig.json node -r ts-node/register/transpile-only --test services/api/src/modules/product-catalog/*.nodetest.ts`
  - 38 tests passed.
- `node --test apps/dealer-workbench/scripts/static-official-product-detail-editor.test.js apps/dealer-workbench/scripts/static-official-site-product-detail-rendering.test.js apps/dealer-workbench/scripts/static-product-edit-category-binding.test.js`
  - 18 tests passed.
- `node --check apps/rheem-cn/public/js/catalog.js`
- `node --check apps/ruud-cn/public/js/catalog.js`
- `npm.cmd run harness:arch`
- `npm.cmd run harness:consolidation`
- `pnpm.cmd --filter dealer-workbench build`

Failed or blocked gates:

- `npm.cmd run guard:rheem-vi-production:strict`
  - Failed with 58 existing critical `fake-logo-lockup-language` findings.
- `npm.cmd run guard:ruud-vi`
  - Failed because `public/ruud-brand.css`, `public/dual-brand.css`, and `public/images/ruud-logo.svg` are missing.
- `npm.cmd run harness:integrity`
  - Failed because `audit/system-integrity-harness.js` is missing.
- `npm.cmd run harness:operational`
  - Failed because `audit/operational-readiness-harness.js` is missing.
- `npm.cmd run harness:evolution`
  - Failed because `audit/auto-evolution-loop.js` is missing.
- `npm.cmd run test:production-readiness`
  - Failed with pre-existing broad production readiness issues, including unavailable NestJS target proxy, missing `apps/designer-workbench` viewer files, missing release scripts, and code-size trunk classification blockers.

## Residual Risk

- No live browser/API manual check was run against a seeded real product in this pass.
- The implemented automated coverage validates the database save/readback contract, admin editor/static integration, official site rendering contract, 750px layout rules, empty state, and sanitizer negative cases.
