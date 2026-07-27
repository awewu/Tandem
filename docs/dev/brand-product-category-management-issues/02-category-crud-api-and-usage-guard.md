# 02 - Brand product category CRUD API and usage guard

## What to build

Add API endpoints and service logic for managing brand-specific product category trees. Operators must be able to list, create, edit, disable, and soft-delete categories, while deletion is blocked when products are already bound to a category.

## Acceptance criteria

- [ ] `GET /api/v2/brand-product-categories?brandCode=everhot` returns the selected brand tree ordered by `sortOrder`.
- [ ] `POST /api/v2/brand-product-categories` creates level-1, level-2, or level-3 categories.
- [ ] `PATCH /api/v2/brand-product-categories/:id` updates name, code, slug, sort order, status, and description.
- [ ] `DELETE /api/v2/brand-product-categories/:id` performs soft delete.
- [ ] `GET /api/v2/brand-product-categories/:id/usage` returns how many products are bound to that category.
- [ ] API rejects creating level 4 categories.
- [ ] API rejects level/parent mismatches, such as a level-2 category without a level-1 parent.
- [ ] API prevents duplicate `code` under the same brand and parent.
- [ ] Deleting a category with bound products is rejected with a clear message.
- [ ] Focused backend tests cover list/create/update/disable/delete/usage behavior.

## Blocked by

Issue 01 for the final entity/table. Service and controller shape can be drafted in parallel if the implementation stays flexible.
