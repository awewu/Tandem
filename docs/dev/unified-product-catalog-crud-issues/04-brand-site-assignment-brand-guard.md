# Issue 04: Enforce brand website shelf assignment rules

## Parent

`docs/dev/unified-product-catalog-crud-prd.md`

## What to build

Enforce website shelf brand rules on the backend and reflect them in the UI. A concrete brand website can only assign products from its own brand. The group website can assign supported products from Rheem, Ruud, and Everhot.

This rule must be enforced server-side so direct API callers cannot attach the wrong brand to a brand website.

## Acceptance criteria

- [ ] Rheem website assignment rejects non-Rheem products.
- [ ] Ruud website assignment rejects non-Ruud products.
- [ ] Everhot website assignment rejects non-Everhot products.
- [ ] `rhautt-group` assignment accepts Rheem, Ruud, and Everhot products.
- [ ] Website product picker only lists allowed products for the current site.
- [ ] Invalid assignment attempts return a clear backend error.
- [ ] Focused backend tests cover allowed and rejected brand/site combinations.

## Blocked by

None - can start immediately.
