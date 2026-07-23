# Native Brand Site Content Console PRD

## Status

- Date: 2026-07-22
- Triage label: `ready-for-agent`
- Issue storage convention: follow-up implementation issues for this PRD are under `docs/dev/native-brand-site-console-issues/`.
- Product: Rhautt Nexus / 瑞合数智枢纽
- Customer / group positioning: Rhautt Comfort / 瑞合瑞德暖通科技集团
- Primary app: `apps/dealer-workbench` on port 5000
- Reference app: `apps/brand-console` on port 5012

## Problem Statement

The Brand Website module currently lets operators manage official site master data and dynamically shows each configured brand site in the second-level navigation. However, clicking a concrete brand site such as Rheem, Ruud, Everhot, or a newly-created site such as `ces` still shows the brand-site master-data table filtered to one row.

That behavior is not the intended brand operations workflow. A concrete brand-site menu item should open that brand's website content management console: product rows, public slug, website categories, product images, official copy, structured website fields, status, ordering, and publication actions.

The existing 5012 Brand Console already contains much of this behavior for Everhot, but using an iframe or embedding `localhost:5012` would violate the current product and VI direction. The 5000 workbench must own the user experience natively, under the current Rhautt Nexus VI, route structure, authentication, and `/api/v2/*` backend direction.

## Solution

Build a native brand-site content console inside `apps/dealer-workbench`.

The user journey is:

1. User opens the Rhautt Nexus 5000 workbench.
2. User enters the Brand Website module.
3. User clicks a concrete brand site in the second-level menu, for example `/comfort/sites/everhot` or `/comfort/sites/ces`.
4. The right-side workspace shows a native brand content console for that brand.
5. The console exposes the functional capabilities currently represented in 5012 Brand Console, adapted to the 5000 VI and Nexus auth model.
6. The Brand Website master-data CRUD page remains at `/comfort/sites`.
7. The Brand Operations item remains pinned as the final second-level menu item.

The solution must not iframe, embed, or redirect into the 5012 app. The 5012 implementation may be used as a functional reference and as migration source material, but the resulting implementation must be native code in the 5000 workbench.

## User Stories

1. As a brand operator, I want clicking a specific brand website in the left menu to open that brand's content console, so that I can manage website content without leaving the Brand Website module.
2. As a brand operator, I want the concrete brand page to show the selected brand identity and site status, so that I know which brand I am editing.
3. As a brand operator, I want to see that brand's product library rows, so that I can review all products currently available to the brand website.
4. As a brand operator, I want to edit public slug, product name, model, category, system, menu category, status, sort order, and official copy, so that website data stays publishable.
5. As a brand operator, I want to create a new product row for the selected brand, so that a new product can be prepared for website publication.
6. As a brand operator, I want to save product edits inline, so that small content corrections do not require leaving the table.
7. As a brand operator, I want to put products on shelf and off shelf, so that the public website catalog can be controlled.
8. As a brand operator, I want to archive or delete products through the same permission model as the existing brand console, so that outdated content can be removed safely.
9. As a brand operator, I want to upload and replace a product main image, so that product list cards have correct visual assets.
10. As a brand operator, I want to manage detail images or gallery ordering, so that product detail pages can present complete image assets.
11. As a brand operator, I want to edit structured website fields such as specs, badges, features, highlights, certificates, FAQs, gallery links, and positioning terms, so that the public brand site has rich content.
12. As a brand operator, I want to generate or trigger the equivalent static backup / publish workflow for a brand, so that approved edits can flow to that brand site.
13. As a read-only operator, I want to view the console without write actions, so that reviewers can inspect content without changing it.
14. As a platform admin, I want write access to follow Nexus RBAC, so that 5012 local dev login rules are not copied into the production 5000 workbench.
15. As a brand manager, I want newly-created brand sites to appear in the menu and open the same native console, so that the workflow scales beyond Rheem/Ruud/Everhot.
16. As a developer, I want the implementation to reuse `/api/v2/*` backend contracts and route ownership, so that it does not add legacy inline routes or iframe shortcuts.
17. As a QA reviewer, I want automated and visual checks proving no iframe is used, so that the product remains native to the 5000 workbench.

## Functional Requirements

### Navigation And Page Ownership

1. `/comfort/sites` remains the Brand Website master-data CRUD page.
2. `/comfort/sites/:brandCode` opens a native brand content console for `brandCode`.
3. The second-level Brand Website menu shows:
   - Brand Website Management first.
   - Active brand sites in configured `sortOrder`.
   - Brand Operations last.
4. The selected brand site page must show active navigation state for that brand.
5. Archived brand sites must not appear as active second-level brand console entries.

### Native UI And VI

1. The page must be implemented in native React/Next code inside the 5000 workbench.
2. The page must not contain `iframe` or embed 5012.
3. The page must use the existing Rhautt Nexus / dealer-workbench VI tokens, card, table, button, badge, and layout patterns.
4. The page must avoid copying 5012's raw visual style if it conflicts with the current 5000 VI.
5. The page should use dense enterprise workbench layout, not a marketing landing-page layout.

### Product List And Editing

1. The console must list products for the selected brand.
2. The list must support search by product name, SKU, public slug, or series when backend capability exists.
3. The list must show at least:
   - SKU
   - public slug
   - name / model
   - category
   - system
   - website menu category
   - status
   - sort order
   - image state
   - detail editor affordance
   - row actions
4. Inline edits must support saving a product row.
5. Edits must merge brand-specific website metadata without overwriting unrelated product metadata.
6. On-shelf/off-shelf actions must be available to users with write permission.
7. Delete/archive actions must be available to users with write permission and should fail closed when backend policy rejects them.
8. New product creation must create a minimum publishable skeleton for the selected brand.

### Images And Assets

1. The console must allow setting or replacing the main product image.
2. The console must allow deleting a main image when the user has write permission.
3. The console must support detail/gallery image references and ordering when backend capability exists.
4. Upload and image persistence must use the Nexus file-artifact / product-catalog API direction, not browser-only state.
5. Image operations must remain tenant and brand scoped.

### Structured Website Content

1. The console must support editing specs as key/value rows.
2. The console must support editing badges.
3. The console must support editing features as title/description rows.
4. The console must support editing highlights.
5. The console must support editing official English name/copy fields where present.
6. The console must support icon/image/spec-image/gallery/certs/FAQ website fields where present.
7. The console must support positioning taxonomy terms using the existing product-catalog taxonomy where present.
8. The UI can ship progressively, but each completed slice must preserve the final data shape and avoid throwaway one-off fields.

### Publish / Static Backup

1. The native console must expose the equivalent of 5012's "generate static backup" / publish action.
2. The publish action must be brand-aware; it cannot be hardcoded only to Everhot unless the issue explicitly limits the first slice to Everhot.
3. The publish action must return an operator-readable log or status.
4. Publish must be protected by write permission.
5. Publish implementation must not shell out to brand-site scripts from browser code. Any script execution must remain server-side and controlled.

### Auth And RBAC

1. The 5000 workbench authenticated user and Nexus RBAC are authoritative.
2. The 5012 local dev login and cookie session must not be copied as the production auth path.
3. Users without write permission must be able to view read-only content where permitted.
4. Write actions must be hidden or disabled for read-only users and must also be rejected server-side.
5. Route ownership and API boundary checks must cover any new `/api/v2/*` routes.

### Multi-Brand Behavior

1. The console must work for existing brands: Rheem, Ruud, Everhot.
2. The console must work for newly-created brand sites such as `ces` after enough product/tenant mapping exists.
3. If a brand has no products or lacks data binding, the page must show an actionable empty state instead of falling back to another brand.
4. Brand-specific metadata must be keyed by the selected brand slug or an explicitly mapped product brand, not globally hardcoded to `everhot`.
5. Tenant mapping and brand code normalization must be explicit.

## Implementation Decisions

1. Keep `apps/brand-console` as reference implementation only; do not iframe or embed it.
2. Implement the native UI under `apps/dealer-workbench`, using `/comfort/sites/:brandCode` as the selected brand console route.
3. Keep `/comfort/sites` as the master-data CRUD table for brand sites.
4. Reuse existing 5000 navigation behavior where brand-site menu entries come from `/api/v2/brand-sites`.
5. Implement a brand-aware data adapter for product list, product updates, image operations, taxonomy, and publish actions.
6. Prefer existing `/api/v2/product-catalog/*`, `/api/v2/brand-sites/*`, and file-artifact APIs before adding new API contracts.
7. Any new production API must live under `/api/v2/*` and have route ownership.
8. Do not add new inline business routes to `server-production.js`.
9. Preserve 5012's functional behaviors but translate them to current 5000 VI and Nexus RBAC.
10. Treat the first implementation as a migration and consolidation, not a visual clone.

## Testing Decisions

1. Test external behavior: navigation, product list loading, edit/save, status toggle, image operation, publish action, and permission gating.
2. Add a focused no-iframe check for `/comfort/sites/:brandCode`.
3. Add a route/API contract check proving active UI calls map to backend routes.
4. Add tests or smoke checks for at least one existing brand and one newly-created/synthetic brand empty state.
5. Mock backend product and image APIs in component tests where possible; do not depend on 5012 for tests.
6. Use browser verification for menu ordering and selected brand route behavior.
7. Run production-readiness and architecture gates for any backend or route changes.

Expected verification commands after implementation:

- `npm run build` from `apps/dealer-workbench`
- `npm run guard:frontend-api-contract`
- `npm run guard:routes`
- `npm run harness:arch`
- `npm run test:production-readiness` when backend contracts change

## Acceptance Criteria

1. `/comfort/sites` still shows the brand-site master-data CRUD page.
2. `/comfort/sites/everhot` opens a native brand content console instead of a one-row filtered site table.
3. `/comfort/sites/rheem` and `/comfort/sites/ruud` open native brand content console pages for those brands.
4. A newly-created active brand site appears in the second-level menu above Brand Operations and opens a brand-scoped native console.
5. Brand Operations remains the last second-level menu item.
6. The native console includes the product list and core row fields from the 5012 Brand Console reference.
7. Write-capable users can save product edits, create products, toggle on-shelf/off-shelf state, delete/archive products, manage main images, and trigger publish/static backup where backend support exists.
8. Read-only users cannot perform write actions.
9. The page contains no iframe and does not embed or redirect into port 5012.
10. The implementation uses current 5000 VI components/tokens and remains visually consistent with the rest of the workbench.
11. Active frontend API calls map to backend routes.
12. Focused build and smoke checks pass before claiming completion.

## Out Of Scope

1. Rebuilding the public brand websites themselves.
2. Replacing all product-catalog backend models.
3. Full DAM redesign beyond image and asset operations needed by this console.
4. Replacing Nexus auth or SSO.
5. Migrating every 5012 internal implementation detail if it is not part of the operator-visible content workflow.
6. Adding iframe or cross-app embed compatibility as a fallback.
7. Public anonymous product browsing behavior.

## Further Notes

The 5012 Brand Console is currently Everhot-oriented and contains hardcoded concepts such as `BRAND=everhot`, `BRAND_TENANT`, and Everhot static-site scripts. The native 5000 implementation must generalize these concepts through brand-site configuration or a clear brand-to-tenant mapping.

If full multi-brand publish is not possible in the first development pass, the implementation should still create a brand-aware interface and ship Everhot publish as a clearly-scoped first supported brand, with unsupported brands showing an honest disabled state.
