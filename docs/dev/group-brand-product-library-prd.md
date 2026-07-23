# Group Brand Product Library And Website Shelf PRD

## Status

- Date: 2026-07-22
- Triage label: `ready-for-agent`
- Product: Rhautt Nexus / 瑞合数智枢纽
- Customer / group positioning: Rhautt Comfort / 瑞合瑞德暖通科技集团
- Primary backend module: `services/api/src/modules/product-catalog`
- Related backend modules: `services/api/src/modules/brand-registry`, `services/api/src/modules/mdm`
- Primary apps: `apps/dealer-workbench`, `apps/public-portal`, brand sites such as `apps/rheem-cn`, `apps/ruud-cn`, `apps/everhot-cn`

## Problem Statement

Rhautt Comfort operates as a group with multiple equipment brands. Each brand has its own product lines, but the group official website also needs to present mixed product selections across brands. At the same time, each brand official website must only expose the products assigned to that website.

The current database already has product facts, localized product content, brand-site master data, and MDM global product identities. However, the model lacks an explicit relationship between a concrete website and the products shown on that website. As a result, website visibility, website category, public slug, display order, and brand-specific publishing rules are currently forced into product metadata or brand filters.

This PRD defines a design that uses the existing fields first, then adds one missing table: `site_product_assignments`.

## Design Principle

The product model must follow this responsibility split:

- `mdm_global_products` identifies the stable product identity across modules.
- `products` stores the operational product fact inside the product catalog.
- `product_content` stores localized marketing, SEO, and publish workflow content.
- `tenant_brand_sites` stores which websites exist.
- `site_product_assignments` stores which products each website displays and how they are displayed.

The rule is:

> Brand decides product ownership. Website decides product visibility.

## Existing Database Responsibilities

### `mdm_global_products`

This table is the product identity anchor. It should not drive official website layout or navigation directly.

Use existing fields as follows:

| Field | Responsibility |
|---|---|
| `global_product_id` | Stable cross-module product identifier for quotation, design, BOM, and dedupe. |
| `source_tier` | Distinguishes owned, shared, and tenant-private product sources. |
| `brand_slug` | Canonical brand ownership when known. |
| `sku` | Source SKU or model code. |
| `name` | Canonical product name. |
| `data_trust_level` | Whether the product is verified enough for design calculation and quotation. |
| `canonical_params` | Engineering-grade parameters used by design, sizing, BOM, and selection flows. |

### `products`

This table remains the product operation master table. It answers: what is this product?

Use existing fields as follows:

| Field | Responsibility |
|---|---|
| `tenant_id` | Group or brand operation tenant boundary. |
| `sku` | Product code, unique inside the tenant. |
| `name` | Standard product name. |
| `brand` | Product ownership brand, such as `rheem`, `ruud`, `everhot`. |
| `category` | Product category, such as residential hot water, commercial hot water, HVAC, water treatment. |
| `spec` | Technical facts: capacity, power, efficiency, dimensions, certifications, supported standards. |
| `positioning` | Structured business positioning: target segments, channels, personas, markets, application scenarios, pain points. |
| `asset_refs` | DAM references: main image, card image, detail images, specs, certificates, BIM files, manuals. |
| `product_key` | MDM-lite dedupe key for cross-source product matching. |
| `list_price` | Public or list price where applicable. |
| `cost_price` | Internal cost. Must not be exposed through public website APIs. |
| `currency` | Price currency. |
| `status` | Product lifecycle state, such as `active` or `archived`. |
| `meta` | Compatibility bucket for brand-specific legacy website fields. New durable website visibility data should move to `site_product_assignments`. |

### `product_content`

This table stores localized content and publish workflow. It answers: how should this product be described?

Use existing fields as follows:

| Field | Responsibility |
|---|---|
| `product_id` | Product being described. |
| `locale` | Locale such as `zh-CN` or `en-US`. |
| `name` | Localized display name. |
| `display_currency` | Display currency for public content. |
| `seo` | SEO/GEO fields: title, description, canonical, OG image, keywords. |
| `gtin` / `mpn` | Structured product identifiers for public schema data. |
| `marketing` | Public marketing content: headline, subhead, feature benefits, highlights, FAQ. |
| `status` | Content workflow state: `draft`, `review`, `scheduled`, `published`. |
| `published_at` / `scheduled_at` | Public release timing. |

### `tenant_brand_sites`

This table stores official websites and brand site configuration. It answers: which website exists?

Use existing fields as follows:

| Field | Responsibility |
|---|---|
| `tenant_id` | Group or tenant boundary. |
| `code` | Website code, such as `rheem`, `ruud`, `everhot`, `rhautt-group`. |
| `name_cn` / `name_en` | Website display name. |
| `app_key` | Owning frontend app or delivery target. |
| `delivery_type` | Self-hosted or external site. |
| `development_url` / `production_url` | Site URLs. |
| `logo_artifact_id` | Site logo asset. |
| `sort_order` | Console navigation order. |
| `status` | Whether the website is active. |

## New Table: `site_product_assignments`

The missing model is a website shelf table. It answers: which products does this website show and how?

### Entity Shape

```ts
@Entity('site_product_assignments')
@Index(['tenantId', 'siteId', 'productId'], { unique: true })
@Index(['tenantId', 'siteId', 'publicSlug'], { unique: true })
export class SiteProductAssignmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  @Column({ type: 'varchar', nullable: true }) brand: string | null;
  @Column({ name: 'public_slug' }) publicSlug: string;
  @Column({ name: 'website_category', type: 'varchar', nullable: true }) websiteCategory: string | null;
  @Column({ name: 'menu_group', type: 'varchar', nullable: true }) menuGroup: string | null;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @Column({ name: 'is_visible', default: true }) isVisible: boolean;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({ default: 'draft' }) @Index() status: 'draft' | 'published' | 'hidden';
  @Column({ name: 'site_title', type: 'varchar', nullable: true }) siteTitle: string | null;
  @Column({ name: 'site_summary', type: 'text', nullable: true }) siteSummary: string | null;
  @Column({ name: 'site_meta', type: 'jsonb', default: () => "'{}'::jsonb" }) siteMeta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### Field Responsibilities

| Field | Responsibility |
|---|---|
| `site_id` | The website that owns this shelf row. |
| `product_id` | The product shown by this website. |
| `brand` | Redundant brand snapshot for query speed and guard checks. |
| `public_slug` | URL slug for this website. Same product can have different slugs on different sites. |
| `website_category` | Website-facing category or menu filter. It does not replace `products.category`. |
| `menu_group` | Optional navigation group, such as residential, commercial, solutions, featured. |
| `display_order` | Website product list order. |
| `is_visible` | Fast visibility flag for website catalog queries. |
| `is_featured` | Homepage or featured area flag. |
| `status` | Website shelf workflow state. |
| `site_title` | Optional site-specific card or page title. |
| `site_summary` | Optional site-specific listing summary. |
| `site_meta` | Small website-specific extension bucket. Must not duplicate product facts. |

## Taxonomy Mapping

The website filter model should consume existing product fields instead of creating a separate website-only taxonomy.

| UI Filter | Source Field |
|---|---|
| Product type, such as residential or commercial | `products.category` and `products.positioning.targetSegments` |
| Product series | Prefer `products.meta.series` for the current phase; later promote to a durable `series` column or dictionary if it becomes a governed dimension. |
| Application scenario | `products.positioning.applicationScenarios` |
| Product features | `product_content.marketing.highlights`, `products.meta.highlights`, or governed feature terms if added later. |
| Search | `products.sku`, `products.name`, `products.category`, `products.meta.series`, `product_content.name`, `product_content.marketing`, `site_product_assignments.publicSlug`. |
| Website menu category | `site_product_assignments.websiteCategory`. |

## Website Behavior

### Brand Website

A brand website such as Rheem, Ruud, or Everhot must only show rows assigned to its own `tenant_brand_sites` record.

Query rule:

```text
tenant_brand_sites.code = requested site code
site_product_assignments.site_id = tenant_brand_sites.id
site_product_assignments.is_visible = true
site_product_assignments.status = published
products.status = active
product_content.status = published when localized content exists
```

### Group Website

The group website, for example `rhautt-group`, can show mixed products from multiple brands, but only if those products are assigned to the group website shelf.

This avoids accidental cross-brand leakage and gives operators explicit control over group-level presentation.

### Product Detail

Product detail should be resolved by `site code + public slug`, not by product SKU alone.

Resolution order:

1. Find active `tenant_brand_sites` by `code`.
2. Find published visible `site_product_assignments` by `siteId` and `publicSlug`.
3. Join `products` by `productId`.
4. Pick localized `product_content` by requested locale, fallback to default locale, then fallback to product facts.

## API Requirements

All new production API routes must live under `/api/v2/*` and have route ownership.

### Protected Console APIs

```text
GET    /api/v2/brand-sites/:siteCode/product-assignments
POST   /api/v2/brand-sites/:siteCode/product-assignments
PATCH  /api/v2/brand-sites/:siteCode/product-assignments/:assignmentId
DELETE /api/v2/brand-sites/:siteCode/product-assignments/:assignmentId
POST   /api/v2/brand-sites/:siteCode/product-assignments/:assignmentId/publish
POST   /api/v2/brand-sites/:siteCode/product-assignments/:assignmentId/hide
```

These routes are for operators in `apps/dealer-workbench` or a future native brand console. They must enforce tenant scope and RBAC.

### Public Website APIs

```text
GET /api/v2/sites/:siteCode/products
GET /api/v2/sites/:siteCode/products/:publicSlug
```

These public routes must return a sanitized projection:

```ts
interface PublicWebsiteProduct {
  siteCode: string;
  slug: string;
  sku: string;
  brand: string | null;
  name: string;
  category: string | null;
  websiteCategory: string | null;
  menuGroup: string | null;
  summary: string;
  image?: string;
  gallery?: unknown[];
  specs?: Record<string, unknown>;
  positioning?: unknown;
  marketing?: unknown;
  seo?: unknown;
  jsonLd?: Record<string, unknown>;
}
```

The public projection must never expose `costPrice`, unpublished content, deleted assignments, internal audit fields, or tenant-private data.

## Console Requirements

The brand website console must support:

1. Listing products assigned to the selected website.
2. Searching by SKU, product name, public slug, product series, and website category.
3. Assigning an existing product to the selected website.
4. Creating a product and assigning it to the selected website in one workflow when the operator has permission.
5. Editing `publicSlug`, `websiteCategory`, `menuGroup`, `displayOrder`, `isVisible`, `isFeatured`, `siteTitle`, and `siteSummary`.
6. Editing product facts through existing product-catalog APIs when the operator is in product-maintainer mode.
7. Editing localized marketing content through existing `product_content` APIs.
8. Showing clear empty states when a website has no assignments.
9. Preventing a brand website from silently falling back to another brand's product catalog.
10. Supporting the group website as a mixed-brand shelf.

## Migration Strategy

1. Keep existing `products.meta.everhot` fields working for backward compatibility.
2. Introduce `site_product_assignments` without deleting existing metadata.
3. Backfill assignments for existing brand products:
   - `tenant_brand_sites.code = everhot` gets current Everhot visible products.
   - `tenant_brand_sites.code = rheem` gets current Rheem visible products.
   - `tenant_brand_sites.code = ruud` gets current Ruud visible products.
4. Use existing `meta.everhot.slug` and `meta.everhot.displayOrder` as initial assignment values where present.
5. After public website routes consume assignments, treat `products.meta.<brand>.slug` and `displayOrder` as legacy fallback only.
6. Do not remove migrated metadata until brand-site contract tests prove equivalent behavior.

## Data Integrity Rules

1. A website can only display products through `site_product_assignments`.
2. A brand website must not show products from another brand unless explicitly allowed by a site policy.
3. The group website may show mixed-brand products, but only through explicit assignments.
4. `publicSlug` must be unique per website.
5. `productId` must be unique per website assignment.
6. Assignment publication does not override `product_content` publication. Both gates must be respected.
7. Product facts must not be duplicated into `site_meta` except for small site-specific display overrides.
8. Internal price and cost fields must never be returned by public APIs.
9. Deleted or inactive websites must not expose public product lists.
10. Archived products must not appear in public website catalogs even if the assignment is still published.

## Implementation Decisions

1. Do not add inline routes to `server-production.js`.
2. Implement new business logic under `services/api/src/modules/product-catalog` or a closely related NestJS module.
3. Register any new production routes in the route ownership registry.
4. Reuse `ProductEntity`, `ProductContentEntity`, `BrandSiteEntity`, and `GlobalProductEntity` instead of replacing them.
5. Keep `mdm_global_products` as identity and engineering data, not website presentation.
6. Keep `product_content` as the localized content and publish workflow owner.
7. Keep website-specific category, visibility, slug, and ordering in `site_product_assignments`.
8. Public brand APIs may keep existing `/api/v2/brand/:slug/products` during transition, but the target public API should resolve by website code.

## User Stories

1. As a group operator, I want to manage one product library across multiple brands, so that products are not duplicated for each website.
2. As a brand operator, I want my brand website to show only products assigned to that website, so that the public catalog is controlled.
3. As a group marketing operator, I want the group website to mix selected products from multiple brands, so that group-level pages can present a complete solution portfolio.
4. As a product manager, I want product facts and website display settings separated, so that changing website sorting does not change engineering product data.
5. As a content operator, I want localized marketing content to stay in the product content workflow, so that drafts and scheduled releases remain governed.
6. As a developer, I want public website APIs to return a sanitized projection, so that internal cost and tenant fields are never leaked.
7. As a QA reviewer, I want tests proving each website only sees its assigned products, so that cross-brand leakage is caught.

## Acceptance Criteria

1. The PRD is implemented without changing the meaning of existing `products`, `product_content`, `tenant_brand_sites`, or `mdm_global_products` fields.
2. `site_product_assignments` exists with unique constraints for `tenantId + siteId + productId` and `tenantId + siteId + publicSlug`.
3. Brand websites list only products assigned to their own site.
4. The group website can list mixed-brand products only through explicit assignments.
5. Public product detail resolves by `siteCode + publicSlug`.
6. Public APIs never return `costPrice`, unpublished content, hidden assignments, or archived products.
7. Existing Everhot-style metadata can be backfilled into assignments.
8. Existing `/api/v2/brand/:slug/products` behavior remains compatible during migration or has a documented replacement path.
9. The native brand-site console can manage assignment fields without overwriting product facts.
10. The data model supports the filters shown in the current website reference: product type, product series, application scenario, product features, and keyword search.

## Verification Plan

Run the relevant project gates after implementation:

```text
npm run harness:arch
npm run harness:integrity
npm run test:production-readiness
npm run guard:frontend-api-contract
```

Add focused tests for:

1. Site assignment uniqueness.
2. Brand website visibility isolation.
3. Group website mixed-brand visibility.
4. `siteCode + publicSlug` detail resolution.
5. Public projection redaction.
6. Backward-compatible migration from legacy `products.meta.<brand>` fields.

## Out Of Scope

1. Redesigning all product taxonomies into separate dictionary tables.
2. Rebuilding public brand websites.
3. Replacing the current product-catalog module.
4. Removing legacy `products.meta.everhot` fields immediately.
5. Changing MDM ownership or source-tier semantics.
6. Replacing DAM or file-artifact storage.
