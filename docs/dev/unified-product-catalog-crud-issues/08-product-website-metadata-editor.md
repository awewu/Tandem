# Issue 08: Product website metadata editor

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Add editing support for website-oriented metadata on product records while keeping shelf-specific fields separate. Operators should be able to maintain brand metadata such as public slug, series, tagline, website category, display order, badges, and official English name.

## Acceptance criteria

- [ ] Product metadata editor updates brand-scoped metadata without overwriting other brands' metadata.
- [ ] Editor supports public slug, series, tagline, website category, display order, badges, and official English name.
- [ ] Product master facts remain separate from shelf-specific overrides.
- [ ] Backend validation errors for slug conflicts are surfaced in the UI.
- [ ] Changes made in Product Catalog are visible on the brand page after refresh.
- [ ] Changes made on brand page are visible in Product Catalog after refresh.

## Blocked by

- Issue 03: Product catalog edit, status, and archive loop
