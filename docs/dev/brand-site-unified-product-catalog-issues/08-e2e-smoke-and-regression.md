# 08 - End-to-end smoke and regression coverage

## What to build

Add final smoke and regression coverage for the unified catalog-to-brand-site flow. The checks should prove product catalog records appear under the matching brand, edits save to the same product record, shelf state controls website visibility, pagination works, the table has no normal-width horizontal scroll, and Everhot `5011` shows only published Everhot products.

## Acceptance criteria

- [ ] A product catalog record appears under the matching concrete brand page.
- [ ] Editing product fields from the brand page persists to the product catalog record.
- [ ] Publishing a product changes the current brand site's website shelf state to `已上架`.
- [ ] Hiding a product changes the current brand site's website shelf state to `已下架`.
- [ ] Pagination/search/filter behavior works without loading every product at once.
- [ ] The normal desktop brand product table has no visible horizontal scrollbar.
- [ ] Everhot `5011` shows published Everhot products and excludes hidden/unlisted products.
- [ ] Runtime fallback behavior remains intact.
- [ ] Narrow relevant gates are run and any failures are reported honestly.

## Blocked by

- 02 - Paginated product query and brand console pagination controls.
- 03 - Responsive no-horizontal-scroll brand product table.
- 04 - Full product edit modal/drawer from brand pages.
- 05 - Row-level website shelf state and assignment enforcement.
- 06 - Website menu group options from brand navigation categories.
- 07 - Everhot 5011 published-product runtime proof.
