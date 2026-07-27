# 03 - Product catalog category binding fields

## What to build

Extend product catalog records so a product can bind to the current brand's category tree. Product queries should return enough category information for UI display and later website runtime use.

## Acceptance criteria

- [ ] Product brand metadata can store `categoryLevel1Id`, `categoryLevel2Id`, and optional `categoryLevel3Id`.
- [ ] Product read APIs return category IDs and a human-readable `categoryPath`.
- [ ] Product update APIs validate that selected category IDs belong to the product's brand.
- [ ] Product update APIs validate parent/child consistency across level 1, 2, and 3.
- [ ] Old fields such as `category`, `websiteMenuCategory`, and `system` remain supported for compatibility.
- [ ] Products without new category IDs still load and can be edited.
- [ ] Focused tests cover valid binding, cross-brand rejection, invalid hierarchy rejection, and old-field compatibility.

## Blocked by

Issues 01 and 02.
