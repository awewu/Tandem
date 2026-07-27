# 06 - Product edit category binding

## What to build

Update product editing surfaces so products bind to the brand category tree through level-1, level-2, and optional level-3 selectors instead of relying on free text category/menu fields.

## Acceptance criteria

- [ ] Product edit UI loads active categories for the current product brand.
- [ ] Product edit UI shows a level-1 selector, level-2 selector filtered by level 1, and optional level-3 selector filtered by level 2.
- [ ] Level 1 is required.
- [ ] Level 2 is recommended/required for publish readiness according to the existing product rules.
- [ ] Level 3 is optional.
- [ ] Historical inactive bindings remain visible with an inactive warning.
- [ ] Saving persists category IDs to the product catalog record.
- [ ] Old text fields remain available only where needed for compatibility and do not override selected category IDs.
- [ ] Focused interaction tests or smoke coverage prove save/load behavior.
- [ ] dealer-workbench build passes.

## Blocked by

Issues 02, 03, and 04.
