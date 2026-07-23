# Unified Product Catalog CRUD And Brand Website Shelf PRD

## Status

- Date: 2026-07-23
- Triage label: `ready-for-agent`
- Product: Rhautt Nexus / 瑞合数智枢纽
- Customer / group instance: Rhautt Comfort / 瑞合瑞德暖通科技集团
- Primary app: `apps/dealer-workbench`
- Primary backend module: `services/api/src/modules/product-catalog`
- Related backend module: `services/api/src/modules/brand-registry`
- Related existing PRDs:
  - `docs/dev/native-brand-site-console-prd.md`
  - `docs/dev/group-brand-product-library-prd.md`

## Problem Statement

The current brand-site console can create and edit products from a brand page, and the backend already exposes product-catalog CRUD-style APIs. However, the product management workflow is not yet unified from the operator perspective.

Operators need two entry points that manage the same product master data:

- A brand website page where adding a product automatically binds the product to the current brand.
- A product catalog page where operators can CRUD products across brands and manually choose which brand a product belongs to.

Both entry points must read and write the same product records, so edits from either side are visible after refresh. Website display must be generated from product records plus website shelf assignments, with sensible default fallback values when website-specific fields are missing.

The current product catalog UI also must not rely on horizontal scrolling. It should adapt to the page width using responsive layout, wrapping, compact controls, or card/list views.

## Goal

Build a real database-backed product catalog CRUD page and align it with brand website product management.

The end state is:

1. Product catalog is the single product master data source.
2. Brand pages can create products with automatic brand binding.
3. Product catalog can create products with manual brand selection.
4. Brand website shelves only show products from their own brand.
5. The group website shelf can show products from multiple brands.
6. Website display is composed from product records plus website shelf configuration.
7. Missing website fields fall back to existing product values.
8. Existing simulated product data is imported into the real product catalog database.
9. Product catalog UI is responsive and does not expose a bottom horizontal scrollbar.

## Non-Goals

- Do not replace the existing product-catalog backend module with a new service.
- Do not create duplicate product rows per city or per website.
- Do not make brand websites aggregate other brands' products.
- Do not physically delete products from the database; deletion remains archive-style.
- Do not use iframe-based management UI.
- Do not implement a marketing landing page for product CRUD.

## Core Domain Rules

### Product Ownership

Product ownership is determined by `products.brand` and the brand operation tenant.

Allowed product brands for this phase:

- `rheem`
- `ruud`
- `everhot`

The product catalog page may manage all supported brands. A concrete brand website page may only manage the selected brand.

### Website Visibility

Website visibility is controlled by `site_product_assignments`, not by duplicating product records.

Rules:

- Brand website `rheem` may only assign and display `brand = rheem`.
- Brand website `ruud` may only assign and display `brand = ruud`.
- Brand website `everhot` may only assign and display `brand = everhot`.
- Group website `rhautt-group` may assign and display supported brands: `rheem`, `ruud`, `everhot`.

Backend must enforce these rules. Frontend filters are not enough.

### Single Source Of Truth

Both pages write the same product row:

- Brand page product creation calls product-catalog create with an implicit brand.
- Product catalog page product creation calls product-catalog create with an explicit selected brand.
- Brand page product edits and product catalog edits update the same product record.
- Website shelf edits update only website assignment fields.

## User Stories

1. As a brand operator, I want to add a product from a Rheem/Ruud/Everhot brand page without choosing a brand, so that the product is automatically bound to the current brand.
2. As a product operator, I want a product catalog CRUD page where I can choose a brand when creating a product, so that I can manage all brand products in one place.
3. As a product operator, I want edits made in the product catalog to appear on the matching brand page after refresh, so that the two entry points stay synchronized.
4. As a brand operator, I want edits made on the brand page to appear in the product catalog after refresh, so that product master data is not duplicated.
5. As a brand website operator, I want the brand website shelf to only accept products from the same brand, so that the Rheem website cannot accidentally show Ruud or Everhot products.
6. As a group website operator, I want the group website shelf to accept multiple supported brands, so that the group site can present the full brand matrix.
7. As a website operator, I want products with missing website-specific fields to still display with product defaults, so that incomplete website metadata does not block operations.
8. As an operator, I want the product catalog page to fit the current page width without horizontal scrolling, so that the workflow is usable on normal workbench screens.
9. As a developer, I want existing simulated products imported into the real product database, so that frontend CRUD operates against durable data.

## Functional Requirements

### Product Catalog CRUD Page

1. Provide a product catalog management page in `apps/dealer-workbench`.
2. The page must read from `/api/v2/product-catalog/devices`.
3. The page must support filtering/searching by:
   - brand
   - status
   - category
   - SKU
   - product name
   - model
4. The page must support creating a product.
5. Product creation must require selecting a brand.
6. Brand selection must map to the correct brand operation tenant ID.
7. Product creation must call `POST /api/v2/product-catalog/devices`.
8. The page must support editing core fields:
   - name
   - SKU or generated SKU behavior where allowed by backend
   - model
   - category
   - system
   - status
   - list price where available
   - website metadata fields where available
9. The page must support archive/delete action by calling `DELETE /api/v2/product-catalog/devices/:id`.
10. Delete must be presented as archive, not physical deletion.
11. The page must show operation feedback for create, update, status change, and archive.
12. The page must respect RBAC. Users without write permission can view but cannot mutate.

### Brand Page Product Creation

1. On `/comfort/sites/rheem`, product creation must implicitly use `brand = rheem`.
2. On `/comfort/sites/ruud`, product creation must implicitly use `brand = ruud`.
3. On `/comfort/sites/everhot`, product creation must implicitly use `brand = everhot`.
4. The brand page must not show a brand selector for these concrete brand sites.
5. The created product must appear in product catalog after refresh.
6. The brand page must continue to use product-catalog APIs rather than local browser state.

### Product Synchronization

1. Product catalog and brand pages must display the same product record for the same product ID.
2. Editing shared product fields from either page must persist to `products`.
3. Website shelf fields must persist to `site_product_assignments`.
4. Product record changes must not silently overwrite website shelf overrides.
5. Website shelf changes must not overwrite product master facts.

### Website Shelf Rules

1. Brand website shelf product picker must only list products from the same brand.
2. Group website shelf product picker may list supported products from Rheem, Ruud, and Everhot.
3. Backend assignment creation must reject invalid brand/site combinations.
4. Backend assignment update must not allow changing the linked product after creation.
5. A shelf row can override:
   - public slug
   - website category
   - menu group
   - display order
   - featured flag
   - site title
   - site summary
   - small website-specific metadata in `siteMeta`

### Website Display Composition

Website-facing product cards and detail data are composed from:

1. Product master record.
2. Product localized/marketing content where available.
3. Website shelf assignment.

Fallback rules:

| Website field | Fallback |
|---|---|
| Display title | `assignment.siteTitle` -> product content name -> `products.name` |
| Display summary | `assignment.siteSummary` -> product tagline -> `products.category` |
| Public slug | `assignment.publicSlug` -> product brand meta slug -> `products.sku` |
| Website category | `assignment.websiteCategory` -> product brand meta website category -> `products.category` |
| Menu group | `assignment.menuGroup` -> product system -> empty |
| Display order | `assignment.displayOrder` -> product brand meta display order -> product sort order -> `0` |
| Main image | product main asset ref -> product brand meta image -> default placeholder |
| Badges | product brand meta badges -> empty list |

Missing website-specific fields must not break the product list or detail page.

### Simulated Data Import

1. Identify current simulated product data used by the product catalog or brand pages.
2. Convert the simulated data into product-catalog seed records.
3. Each imported product must have:
   - brand
   - tenantId
   - SKU
   - name
   - category
   - status
   - spec fields where available
   - brand metadata where available
4. Import must be idempotent by `tenantId + sku`.
5. Import must not duplicate existing database products.
6. Imported data must be visible through `/api/v2/product-catalog/devices`.
7. After import, the UI must stop relying on mock-only product arrays for CRUD behavior.

### Responsive UI Requirement

The product catalog CRUD page must not use a bottom horizontal scrollbar as the primary layout solution.

Requirements:

1. No forced large `min-width` table that exceeds the page.
2. No `overflow-x: auto` on the main product CRUD table unless used only for a narrow fallback mode that is not visible on normal desktop workbench width.
3. Long values must wrap, truncate, or move into secondary detail views.
4. Dense columns can be moved into:
   - expandable row details
   - side drawer
   - edit modal
   - compact stacked card layout on small screens
5. Buttons must remain visible without horizontal scrolling.
6. Mobile/narrow viewport can use card layout or stacked rows.

## Recommended UI Shape

### Product Catalog Page

Top controls:

- Search input.
- Brand segmented selector: All, Rheem, Ruud, Everhot.
- Status filter.
- Category filter.
- Add product button.

Main list:

- Use responsive table or dense list, not horizontal scroll.
- Primary columns:
  - product identity: SKU, name, model
  - brand
  - category/system
  - status
  - image/content readiness
  - actions

Secondary details:

- Website metadata, specs, pricing, positioning, and image details can be edited in an expandable row or drawer.

### Create Product Form

Required fields:

- brand
- name
- model or SKU seed
- category
- system

Optional first-slice fields:

- public slug
- series
- tagline
- website category
- badges
- list price
- main image

### Brand Page

The existing brand page creation panel remains brand-scoped:

- No brand selector.
- Uses current brand code.
- Same product create endpoint.
- Same fallback rules.

### Website Shelf Page

For concrete brand sites:

- Product picker only shows the current brand.
- No cross-brand selector.

For `rhautt-group`:

- Product picker shows brand tabs or brand filter.
- Supports Rheem, Ruud, and Everhot.

## Backend Requirements

### Product Catalog

Use existing endpoints:

```text
GET    /api/v2/product-catalog/devices
GET    /api/v2/product-catalog/devices/:id
POST   /api/v2/product-catalog/devices
PATCH  /api/v2/product-catalog/devices/:id
DELETE /api/v2/product-catalog/devices/:id
```

Required backend behavior:

1. Write requires `platform_admin`, `hq_admin`, or `brand_admin`.
2. Product write requires a brand operation tenant UUID.
3. Brand must match the selected tenant's brand.
4. New product must have SKU and name after normalization.
5. `tenantId + sku` remains the upsert key.
6. Public slug uniqueness must be enforced within brand and tenant scope.
7. Archive must set product status to `archived`.
8. Product mutations must remain RLS-scoped and audited.

### Site Product Assignment

Add or confirm backend guard:

```text
if siteCode in ['rheem', 'ruud', 'everhot']:
  product.brand must equal siteCode

if siteCode == 'rhautt-group':
  product.brand must be one of ['rheem', 'ruud', 'everhot']
```

Invalid combinations must fail server-side even if a caller bypasses the UI.

## Acceptance Criteria

1. Product catalog page can create a Rheem product by selecting Rheem.
2. The created Rheem product appears on `/comfort/sites/rheem` after refresh.
3. Creating a product from `/comfort/sites/ruud` creates a Ruud-bound product without showing a brand selector.
4. The created Ruud product appears in the product catalog after refresh.
5. Rheem brand website shelf cannot assign a Ruud product.
6. Ruud brand website shelf cannot assign a Rheem product.
7. Everhot brand website shelf cannot assign Rheem or Ruud products.
8. `rhautt-group` website shelf can assign Rheem, Ruud, and Everhot products.
9. Missing website title displays the product name.
10. Missing website summary displays tagline or category fallback.
11. Missing website category displays product category fallback.
12. Product archive removes the product from normal active lists but does not physically delete it.
13. Imported mock products are visible from `/api/v2/product-catalog/devices`.
14. Running the product catalog page at normal desktop workbench width shows no bottom horizontal scrollbar.
15. Write controls are hidden or disabled for read-only users and rejected by backend if called directly.

## Verification

Run the narrowest relevant checks first:

```text
pnpm.cmd --filter dealer-workbench build
npm run guard:frontend-api-contract
npm run test:production-readiness
```

For backend assignment guard changes, add or update focused tests around:

- product-catalog create/update/archive
- site-product-assignment create guard
- public website fallback projection

If broad gates are too expensive during implementation, report skipped gates explicitly.

## Open Questions

1. Should SKU be editable after creation, or should it be immutable once the product exists?
2. Should product catalog first slice support price fields, or defer price editing to a later quote/pricing workflow?
3. Which simulated product source is authoritative for initial import if multiple mock sources exist?
4. Should `rhautt-group` be allowed to override product title/summary per brand group, or only per product shelf row?
5. Should city-specific display rules live in `siteMeta`, `positioning.markets`, or a future dedicated city availability table?
