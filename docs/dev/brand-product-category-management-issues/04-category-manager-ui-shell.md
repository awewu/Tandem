# 04 - Dealer workbench product category manager shell

## What to build

Add the product category manager entry and page shell in dealer-workbench. This issue should create the navigation entry, route/view structure, brand selector, loading/empty/error states, and a category tree surface without implementing the full CRUD workflow if the backend API is not ready.

## Acceptance criteria

- [ ] Product module left navigation includes `产品分类`.
- [ ] The product category page is reachable from the products area.
- [ ] The page follows the current marketing console/Rheem Red UI style.
- [ ] The page has a brand selector for Rheem, Ruud, and Everhot.
- [ ] The page reserves a category tree area for level-1, level-2, and level-3 categories.
- [ ] The page has clear loading, empty, and error states.
- [ ] If the category API is available, the shell reads real data; otherwise it uses a narrowly scoped placeholder state without hard-coding final business behavior.
- [ ] dealer-workbench build passes.

## Blocked by

None - can start immediately. Avoid implementing backend or product binding behavior in this issue.
