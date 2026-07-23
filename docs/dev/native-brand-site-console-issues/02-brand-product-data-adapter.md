# Issue 02: 品牌产品列表与 taxonomy 数据适配

## What to build

Create the brand-aware data adapter used by the native content console to load product rows and taxonomy for the selected `brandCode`.

The adapter should reuse existing Nexus `/api/v2/*` contracts where possible, keep auth in the 5000 workbench model, and return a UI-ready shape that matches the fields needed from the 5012 reference: SKU, public slug, name/model, category, system, website menu category, status, sort order, image state, and structured metadata readiness.

## Acceptance criteria

- [ ] The native console can load product rows for Everhot without using 5012.
- [ ] The adapter resolves brand-site metadata and selected brand code explicitly.
- [ ] Unknown or newly-created brands without products show an actionable empty state, not another brand's products.
- [ ] Taxonomy values are available to the UI where backend support exists.
- [ ] The adapter does not copy 5012 session cookies, local dev login, or browser-exposed service tokens.
- [ ] Active API calls map to existing backend routes or documented new `/api/v2/*` routes.

## Blocked by

None - can start immediately.
