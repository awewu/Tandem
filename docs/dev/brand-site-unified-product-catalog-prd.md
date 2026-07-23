# Brand Site Unified Product Catalog PRD

Status: ready-for-agent
Date: 2026-07-23

## Problem Statement

Rhautt Nexus current product-to-brand-site workflow is still confusing for operators. A product can be created in the product catalog, but the brand website console does not yet behave like a complete same-record editing surface for each brand. Operators need to see Rheem, Ruud, and Everhot products from the same product catalog, edit the same product record from the brand page, and then decide whether that product is visible on the matching brand website.

The current brand website product assignment UI also exposes too little product information. It behaves more like website shelf metadata editing than full product management. This creates the impression that the product catalog and website products are two separate datasets.

The brand-site product table must also become a proper workbench surface. It should fit the page width without a horizontal scrollbar, follow the current Rhautt Nexus / Rheem VI, use a modal or drawer for editing rather than inline expansion, and handle large product lists through pagination.

## Solution

Implement Option A: each concrete brand website console directly edits complete product master data while keeping website shelf state as a separate per-site visibility record.

The product catalog remains the single source of truth for product information. Brand pages filter the catalog by brand:

- `/comfort/sites/rheem` shows `brand = rheem` products.
- `/comfort/sites/ruud` shows `brand = ruud` products.
- `/comfort/sites/everhot` shows `brand = everhot` products.

Editing a product from any brand page updates the same product catalog record. Website shelf controls only update the current site assignment, including whether the product is `not listed`, `published`, or `hidden`.

The brand product list should use a responsive, compact table without a visible horizontal scrollbar on normal workbench desktop widths. Dense fields move into a top-layer edit modal or drawer. Product lists are paginated and searchable instead of loading every product at once.

Everhot `5011` remains the first runtime proof target: it reads published Everhot products from the public site products API, with static fallback when the runtime API fails. Rheem and Ruud backend/admin brand filtering should be implemented now; their website runtime loaders can be handled separately unless the existing sites already share the Everhot runtime pattern.

## User Stories

1. As a brand operator, I want the Everhot brand website console to show only Everhot product catalog records, so that I can manage Everhot website products from one place.
2. As a brand operator, I want the Rheem brand website console to show only Rheem product catalog records, so that each brand page owns its own brand data.
3. As a brand operator, I want the Ruud brand website console to show only Ruud product catalog records, so that product management is consistent across supported brands.
4. As a product operator, I want products created in the central product catalog to appear on the correct brand page, so that the catalog is the single product source.
5. As a brand operator, I want edits made on a brand page to update the same product catalog record, so that website and catalog product data do not drift.
6. As a brand operator, I want to edit full product information from the brand page, including base information, website display fields, images, specs, selling points, and FAQ, so that I do not need to jump between pages for normal website maintenance.
7. As a brand operator, I want product website visibility to be controlled separately from product master data, so that editing product information does not automatically publish it.
8. As a brand operator, I want row-level shelf controls for `未上架`, `已上架`, and `已下架`, so that I can quickly decide whether a product is shown on the current brand website.
9. As a website visitor, I want the Everhot local website to show only published Everhot products, so that the website reflects the brand console shelf state.
10. As a brand operator, I want the product table to fit without a horizontal scrollbar, so that the page stays usable on normal admin screens.
11. As a brand operator, I want editing to open in a modal or drawer above the page, so that the table does not expand into a hard-to-scan layout.
12. As a brand operator, I want pagination, search, and filters, so that large product lists remain manageable.
13. As a brand operator, I want website menu group fields to use brand website menu options where available, so that products can be placed into real navigation categories instead of free-typed values.
14. As an operator, I want the UI to match the existing Rhautt Nexus / Rheem VI, so that the feature feels like part of the current workbench.

## Implementation Decisions

- Product master data remains in the product catalog module.
- Website visibility remains in brand-site product assignments.
- Brand pages must filter by normalized `brand` and the brand operation tenant where the backend requires a tenant.
- The supported brand codes for this PRD are `rheem`, `ruud`, and `everhot`.
- Concrete brand pages must not require choosing a brand when creating or editing products. The current page brand supplies the brand.
- Product catalog pages can still support explicit brand selection for cross-brand operators.
- Product edits from brand pages update product fields such as SKU, name, model, series, category, system, product status, website metadata, specs, selling points, FAQ, and asset references where the existing product module supports those fields.
- Website shelf edits update only assignment fields such as public slug, website category, menu group, display order, featured flag, site title, site summary, and assignment status.
- Backend APIs must enforce brand/site compatibility. A Rheem site cannot publish a Ruud or Everhot product, and likewise for Ruud and Everhot.
- Product list requests must support pagination. The brand console should request only the current page.
- The responsive table should show a small set of high-signal columns: product identity, category/menu, image readiness, website shelf status, sort/order signal, and actions.
- Detailed editing belongs in a modal or drawer, not inline row expansion.
- The modal/drawer should group fields into product base information, website display, images/materials, specs, selling points/FAQ, and shelf state.
- The UI must follow the current admin VI and existing component conventions. Avoid a marketing-style layout, oversized cards, and one-off color themes.
- The current `产品 / 其他素材` switch remains. `其他素材` can continue as simulated data until a real non-product material API is planned.
- Everhot `5011` continues to be the first runtime verification target. It should read published Everhot products and fall back to static data when the runtime API fails.

## Testing Decisions

- Add or update backend contract tests for brand-filtered product listing and brand/site assignment enforcement.
- Add or update backend tests proving the public site product endpoint returns only published products for the requested site.
- Add or update frontend tests or smoke coverage for Rheem, Ruud, and Everhot brand pages showing brand-filtered products.
- Add or update UI checks proving the brand product table does not expose a horizontal scrollbar at normal desktop workbench width.
- Add or update frontend interaction coverage proving edit opens a modal or drawer and saves product catalog fields.
- Add or update frontend interaction coverage for row-level shelf transitions: `未上架`, `已上架`, and `已下架`.
- Add or update pagination coverage proving the brand page requests and renders one page at a time.
- Keep the Everhot local runtime smoke: update or publish in `5000`, refresh `http://localhost:5011/`, and observe only published Everhot products.
- Run narrow gates first: focused backend nodetests, dealer-workbench build, Everhot runtime smoke, then any broader existing product or brand-site guard if touched.

## Out of Scope

- Replacing the product catalog module with a new service.
- Creating separate website-only product records.
- Real production publishing to live Rheem, Ruud, or Everhot domains.
- Full DAM implementation for non-product website materials.
- Approval workflow, rollback, operator audit expansion, or release governance beyond existing behavior.
- Building Rheem/Ruud website runtime loaders unless they can reuse an existing public site product runtime with minimal wiring.
- Physical deletion of products. Product removal remains archive-style.

## Further Notes

This PRD uses three separate concepts:

- Product master data: one product catalog record.
- Brand ownership: the product belongs to `rheem`, `ruud`, or `everhot`.
- Website shelf state: the current brand site decides whether the product is listed, published, or hidden.

The desired operator mental model is simple: add or edit a product once, see it under the matching brand, and control website visibility from that brand page.
