# 07 - Product list category path and filtering

## What to build

Update product lists to display the complete category path and support category filtering using the new category tree fields. This should preserve existing brand filtering, pagination, keyword search, status filtering, and website shelf semantics.

## Acceptance criteria

- [ ] Product list category column displays paths such as `家用 / 热水系统` or `商用 / 热水系统 / 空气能热水器`.
- [ ] Products without new category IDs still show a compatible fallback or `未设置分类`.
- [ ] Category filters can filter by level-1, level-2, or level-3 category where backend APIs allow.
- [ ] Filtering preserves current brand scoping.
- [ ] Filtering reloads only the requested page and does not load all products at once.
- [ ] Website shelf state/actions remain separate from product catalog status.
- [ ] The normal desktop table has no visible horizontal scrollbar.
- [ ] Focused tests or smoke coverage prove path display and filter behavior.
- [ ] dealer-workbench build passes.

## Blocked by

Issues 03 and 06.
