# Issue 09: Group website multi-brand product picker

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Update the group website shelf workflow so `rhautt-group` can add products from multiple supported brands. The picker should make brand choice explicit for the group site, while concrete brand sites remain locked to their own brand.

## Acceptance criteria

- [ ] `rhautt-group` product picker can filter or tab between Rheem, Ruud, and Everhot.
- [ ] `rhautt-group` can create shelf assignments for supported brands.
- [ ] Concrete brand sites do not show a cross-brand picker.
- [ ] Group shelf rows show product brand clearly.
- [ ] Group shelf assignment saves public slug, category, menu group, order, featured flag, title, and summary.
- [ ] Backend guard from Issue 04 remains authoritative.

## Blocked by

- Issue 04: Enforce brand website shelf assignment rules
