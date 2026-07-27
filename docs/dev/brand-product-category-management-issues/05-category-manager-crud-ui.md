# 05 - Category manager CRUD UI

## What to build

Complete the dealer-workbench category manager interactions after the category API exists. Operators should be able to create, edit, disable, delete, and sort categories across all three supported levels.

## Acceptance criteria

- [ ] Operators can add level-1 categories.
- [ ] Operators can add level-2 categories under a level-1 category.
- [ ] Operators can add optional level-3 categories under a level-2 category.
- [ ] Operators cannot add level-4 categories.
- [ ] Operators can edit name, code, slug, sort order, status, and description.
- [ ] Operators can disable categories.
- [ ] Delete calls the usage guard and shows a clear message when products are bound.
- [ ] UI prevents choosing inactive categories as new binding targets where applicable.
- [ ] Loading, saving, empty, and error states are clear.
- [ ] dealer-workbench build passes.

## Blocked by

Issues 02 and 04.
