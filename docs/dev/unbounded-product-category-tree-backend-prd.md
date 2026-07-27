# Unbounded Product Category Tree Backend PRD

Status: draft-for-review
Date: 2026-07-25

## Problem Statement

Rhautt Nexus currently has product category fields that are too close to fixed website menu assumptions. Existing product data and previous category planning lean toward a limited depth structure such as `residential / heating-cooling / central-ac`, while the real operating need is a flexible product taxonomy that can grow with brands, product families, systems, application scenarios, and future website structures.

Operators need to maintain product categories as real backend data instead of relying on frontend simulated separation. A category tree must not be limited to three levels, must not limit the number of categories under any node, and must allow products to be attached to any category node, including intermediate nodes. The current frontend product selector can stay unchanged for now; this PRD defines the backend foundation required before the frontend consumes the richer taxonomy.

## Solution

Build a backend product category tree capability for brand product catalogs.

The backend will support an unbounded category tree per brand or catalog scope. Each category can have any number of child categories. A product can be bound to any category node, whether that node has children or not. Category bindings become first-class product catalog data and can later be consumed by the Everhot/Rheem/Ruud public sites and intelligent selector.

The first backend version must preserve current public site compatibility by continuing to expose legacy `cat`, `sys`, `websiteCategory`, and `categoryPath` fields where existing frontend code expects them. New tree-backed category data should be added without forcing frontend changes in this phase.

## User Stories

1. As a product operator, I want to create any number of categories under any product category, so that the catalog can match real product organization instead of fixed menu limits.
2. As a product operator, I want category depth to be unlimited, so that future product lines can introduce deeper hierarchies without schema changes.
3. As a product operator, I want to attach products to any category node, so that products can live under broad system categories or very specific subcategories depending on the business need.
4. As a product operator, I want category trees to be maintained in backend data, so that product organization is not simulated in frontend code.
5. As a brand operator, I want each brand's category structure to be independent, so that Everhot, Rheem, Ruud, and future brands can have different catalog trees.
6. As a backend integrator, I want product APIs to return category bindings and readable paths, so that public sites and selectors can later consume the taxonomy without querying implementation details.
7. As a backend integrator, I want existing `cat/sys` based consumers to keep working, so that current Everhot pages are not broken while the richer taxonomy is introduced.
8. As an operator, I want deletion and archival rules to protect product bindings, so that categories with attached products are not accidentally removed.
9. As an operator, I want inactive categories to remain visible for existing products but unavailable for new bindings, so that historical data remains understandable.
10. As a future selector consumer, I want products to expose category ancestry and product attributes, so that recommendation logic can distinguish residential, commercial, heating/cooling, water heating, and deeper product families from real backend data.

## Implementation Decisions

- Scope this PRD to backend data model, APIs, service behavior, migration, and tests.
- Do not modify the frontend selector, public site navigation, or product listing UI in this phase.
- Replace the previous "maximum three levels" category assumption with an unbounded tree.
- Model categories as adjacency-list records with `parentId`; add a stable way to compute ancestry and display paths.
- Do not constrain category count under any parent.
- Allow product-category bindings to reference any active category node, including nodes that have children.
- Support at least one primary category binding per product. The backend should not prevent future support for multiple category bindings, because a product may later need to appear under several catalog branches.
- Preserve existing public product projection fields used by current frontend code:
  - `cat`
  - `sys`
  - `websiteCategory`
  - `categoryPath`
- Add richer category output alongside those compatibility fields, such as:
  - category node id
  - category code or slug
  - category name
  - full ancestry
  - full path string
  - binding role, if multiple bindings are introduced
- Keep brand isolation. A product can only bind to categories in its own brand/catalog scope unless a future group catalog feature explicitly defines cross-brand aggregation.
- Category deletion should be soft-delete first. Hard deletion is out of scope unless no descendants and no product bindings exist.
- Category moves must prevent cycles.
- Category reads should support tree retrieval and flat retrieval. Tree retrieval is useful for management; flat retrieval with ancestry is useful for selectors and product queries.

## Data Model

Recommended category entity shape:

| Field | Purpose |
| --- | --- |
| `id` | Stable category id |
| `tenantId` | Tenant isolation |
| `brandCode` | Brand/catalog scope, such as `everhot`, `rheem`, `ruud` |
| `parentId` | Parent category id; null for root nodes |
| `code` | Stable operator-facing code within the parent scope |
| `slug` | Public/path-safe identifier, optional in first phase |
| `nameCn` | Chinese display name |
| `nameEn` | English display name, optional |
| `description` | Operator note |
| `sortOrder` | Sibling ordering |
| `status` | `active` / `inactive` |
| `createdAt` | Creation timestamp |
| `updatedAt` | Update timestamp |
| `deletedAt` | Soft delete timestamp |

Recommended product-category binding shape:

| Field | Purpose |
| --- | --- |
| `id` | Stable binding id |
| `tenantId` | Tenant isolation |
| `productId` | Product catalog record id |
| `brandCode` | Product brand/catalog scope |
| `categoryId` | Bound category node id |
| `role` | `primary` for first phase; leaves room for `secondary`, `featured`, etc. |
| `sortOrder` | Optional ordering of products within a category |
| `createdAt` | Creation timestamp |
| `updatedAt` | Update timestamp |
| `deletedAt` | Soft delete timestamp |

The backend may store a denormalized `categoryPath` for compatibility and display, but the source of truth should be the category tree plus binding.

## API Contracts

Category management:

```text
GET    /api/v2/brand-product-categories?brandCode=everhot
POST   /api/v2/brand-product-categories
GET    /api/v2/brand-product-categories/:id
PATCH  /api/v2/brand-product-categories/:id
DELETE /api/v2/brand-product-categories/:id
GET    /api/v2/brand-product-categories/:id/usage
```

Expected behavior:

- `GET` can return either flat categories with ancestry or nested tree data.
- `POST` accepts `parentId` optionally and does not enforce a max depth.
- `PATCH` can rename, reorder, activate/inactivate, or move a category.
- `PATCH parentId` must reject cycles and cross-brand parent moves.
- `DELETE` soft-deletes only when policy allows it.
- `usage` returns product binding count and descendant binding count.

Product catalog integration:

```text
GET   /api/v2/product-catalog/devices?...categoryId=...
PATCH /api/v2/product-catalog/devices/:id
POST  /api/v2/product-catalog/devices
```

Expected behavior:

- Product reads include category binding data and full category path.
- Product writes can set or change the primary category binding.
- Filtering by `categoryId` supports at least exact category matching. Descendant-inclusive filtering should be explicit, for example `includeDescendants=true`.
- Existing filters for `category`, `categoryLevel1Id`, `categoryLevel2Id`, and `categoryLevel3Id` should remain compatible until callers migrate.

Public product projection:

```text
GET /api/v2/sites/:siteCode/products
GET /api/v2/brand/:slug/products
```

Expected behavior:

- Continue returning fields needed by current frontend consumers.
- Add non-breaking category tree metadata.
- Do not require frontend changes in this backend phase.

## Migration Decisions

- Existing category fields must not be removed in the first backend phase.
- Existing product records should be backfilled into category bindings where reliable mapping exists.
- Products that cannot be mapped should remain valid and be reported as uncategorized.
- Existing `meta.<brand>.cat`, `meta.<brand>.sys`, `websiteMenuCategory`, `categoryLevel1Id`, `categoryLevel2Id`, `categoryLevel3Id`, and `categoryPath` should be treated as compatibility inputs during migration.
- The previous three-level category data can be migrated into the unbounded tree as ordinary nodes, not as fixed levels.
- Seed data should be idempotent.
- Everhot examples such as `家用`, `商用`, `热水系统`, `采暖与制冷`, `家用中央空调`, `地暖系统`, `全热新风`, and `地源热泵` are seed/configuration examples, not hardcoded product taxonomy rules.

## Testing Decisions

- Add service-level tests for creating categories at depth greater than three.
- Add tests that allow any number of sibling categories under the same parent.
- Add tests that allow product binding to:
  - a root category
  - an intermediate category
  - a deep leaf category
- Add tests that reject category cycles.
- Add tests that reject cross-brand category binding.
- Add tests that deleting a category with product bindings is blocked or archived according to policy.
- Add tests that inactive categories remain readable for existing bound products.
- Add public projection tests proving current `cat/sys/categoryPath` consumers still receive compatible data.
- Add migration/backfill tests for existing category fields.
- Run relevant existing API unit tests and product catalog guards before claiming completion.

## Out of Scope

- No frontend selector changes in this phase.
- No public site navigation changes in this phase.
- No visual category tree management UI redesign in this PRD.
- No drag-and-drop category ordering requirement in the first backend phase.
- No hard limit on category depth.
- No fixed list of allowed product categories.
- No assumption that products can only bind to leaf categories.
- No cross-brand group catalog aggregation unless a later PRD defines it.

## Further Notes

The current Everhot selector still consumes `cat` and `sys`. The backend should continue feeding those compatibility fields until the frontend is intentionally moved to category-tree-aware recommendations.

The strategic direction is that intelligent selection should later use real backend category bindings plus product attributes, tags, positioning, application scenarios, capacity, and system metadata. This PRD creates the backend taxonomy foundation for that future state.
