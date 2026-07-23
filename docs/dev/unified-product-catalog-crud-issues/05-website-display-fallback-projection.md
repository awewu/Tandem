# Issue 05: Website display fallback projection

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Unify the public website display projection so website product cards and details are composed from product records plus shelf assignments. Missing website-specific fields should fall back to product defaults instead of producing empty or broken display data.

## Acceptance criteria

- [ ] Missing shelf title falls back to localized product name or product name.
- [ ] Missing shelf summary falls back to product tagline or product category.
- [ ] Missing website category falls back to product brand metadata category or product category.
- [ ] Missing public slug falls back to product brand slug or SKU.
- [ ] Missing display order falls back to product metadata order or zero.
- [ ] Missing main image falls back to a safe placeholder.
- [ ] Projection does not expose cost price or internal-only fields.
- [ ] Focused tests cover products with partial website metadata.

## Blocked by

None - can start immediately.
