# Product Category Tree Table Lazy Loading PRD

Status: draft-for-review
Date: 2026-07-25

## Problem Statement

当前产品分类管理页使用卡片式目录展示，适合少量、固定层级的分类，但不适合真实产品分类树。新的产品分类体系要求分类深度不限制、每个节点下分类数量不限制、任意节点都可以挂产品，也可以继续新增子分类。现有展示方式会在分类增长后变得难以浏览、难以操作，也无法自然支持懒加载。

产品运营需要一个类似 Element Plus Table 树形数据的管理界面：以表格行展示分类节点，点击展开时懒加载子节点，并在每行提供新增、修改、删除操作。后端必须提供对应的树查询、懒加载、CRUD、删除保护和使用情况接口。

## Solution

建设产品分类树表格管理能力。

后台产品分类页从卡片式目录改为树形表格。首屏只加载根节点；用户展开某一行时，前端按该节点 `parentId` 请求后端加载子节点。每一行展示分类名称、编码、排序、状态、产品挂载数量、子节点状态和操作按钮。操作按钮至少包括“新增下级”“修改”“删除”。页面顶部保留“新增根分类”。

后端提供无深度限制的分类树接口和节点 CRUD 接口。新增分类时不限制层级深度；删除分类时必须检查当前节点、后代节点和产品绑定使用情况，避免误删。

## User Stories

1. As a product operator, I want to view product categories in a tree table, so that I can scan large category structures efficiently.
2. As a product operator, I want root categories to load first, so that the page remains fast when the category tree is large.
3. As a product operator, I want child categories to load only when I expand a row, so that unlimited-depth category trees remain manageable.
4. As a product operator, I want every category row to show add, edit, and delete actions, so that I can maintain the tree from the row I am working on.
5. As a product operator, I want to add a child category under any category node, so that category depth is not artificially restricted.
6. As a product operator, I want to edit a category's name, code, status, sort order, and description, so that category metadata stays accurate.
7. As a product operator, I want deletion to be blocked when a category or its descendants have products, so that product classification data is not lost.
8. As a backend integrator, I want a parentId-based lazy-load API, so that frontend tree tables can request only the nodes they need.
9. As a backend integrator, I want APIs to expose `hasChildren`, so that the table can display expand controls without preloading all descendants.
10. As a future selector integrator, I want category APIs to keep product binding counts, so that later recommendation and filtering work can reason about taxonomy usage.

## Implementation Decisions

- Scope includes backend APIs and the management page display mode for product categories.
- Existing public website pages and intelligent selector behavior are out of scope for this PRD.
- The category tree must remain unbounded in depth.
- The number of categories under any node must not be limited by business logic.
- Any node can have both products and children.
- Use a tree table display instead of card-based nested panels.
- Use lazy loading by `parentId`.
- Use `hasChildren` on each row so the frontend can show an expand affordance without fetching descendants.
- Keep row actions visible in the table operation column:
  - add child
  - edit
  - delete
- Keep a page-level action for adding a root category.
- Backend must reject category moves that create cycles.
- Backend must reject cross-brand parent-child relationships.
- Deletion should be soft-delete or blocked according to usage; hard delete is not required for the first implementation.

## Data Shape

Tree table row response:

| Field | Purpose |
| --- | --- |
| `id` | Category id |
| `brandCode` | Brand scope |
| `parentId` | Parent category id, null for root |
| `nameCn` | Chinese category name |
| `nameEn` | Optional English name |
| `code` | Category code |
| `slug` | Optional public slug |
| `sortOrder` | Sibling order |
| `status` | `active` / `inactive` |
| `description` | Optional note |
| `hasChildren` | Whether the row can be expanded |
| `directProductCount` | Products directly bound to this node |
| `descendantProductCount` | Products bound below this node |
| `createdAt` | Creation time |
| `updatedAt` | Update time |

The frontend tree table should treat `children` as absent until a row is expanded. The lazy-loaded child response can then be attached to that row.

## API Contracts

### List Categories

```text
GET /api/v2/brand-product-categories?brandCode=everhot&parentId=root
GET /api/v2/brand-product-categories?brandCode=everhot&parentId=<categoryId>
```

Behavior:

- `parentId=root` or empty parent loads root categories.
- A category id loads direct children only.
- Response includes `hasChildren`, `directProductCount`, and `descendantProductCount`.
- Results are ordered by `sortOrder`, then name/code.
- No max-depth assumption.

### Create Category

```text
POST /api/v2/brand-product-categories
```

Body fields:

```json
{
  "brandCode": "everhot",
  "parentId": null,
  "nameCn": "采暖与制冷",
  "nameEn": "Heating & Cooling",
  "code": "heating-cooling",
  "slug": "heating-cooling",
  "sortOrder": 20,
  "status": "active",
  "description": ""
}
```

Behavior:

- `parentId` can be null for root categories.
- `parentId` can point to any active category in the same brand.
- No depth limit.
- Same parent should not allow duplicate `code`.

### Update Category

```text
PATCH /api/v2/brand-product-categories/:id
```

Behavior:

- Can update name, code, slug, sort order, status, description, and parent.
- Parent move must reject cycles.
- Parent move must reject cross-brand moves.
- Inactive category remains readable for existing product bindings.

### Delete Category

```text
DELETE /api/v2/brand-product-categories/:id
```

Behavior:

- If the node or descendants have product bindings, return a blocking error with usage details.
- If the node has child categories, either block deletion or require explicit archival behavior. First implementation should prefer blocking unless product owner confirms cascade archive.
- If safe, soft-delete the category.

### Usage Check

```text
GET /api/v2/brand-product-categories/:id/usage
```

Response includes:

```json
{
  "categoryId": "cat-id",
  "directProductCount": 3,
  "descendantProductCount": 12,
  "childCategoryCount": 4,
  "canDelete": false,
  "blockingReason": "category_or_descendants_have_products"
}
```

## UI Requirements

The product category management page should use a tree table.

Columns:

- Category name
- Code
- Sort order
- Status
- Direct product count
- Descendant product count
- Updated time
- Actions

Actions:

- `新增下级`: opens create dialog with current row as parent.
- `修改`: opens edit dialog for current row.
- `删除`: calls usage check or delete endpoint and handles blocked deletion.

Page-level actions:

- `新增根分类`: opens create dialog with no parent.
- Brand selector if the current product module supports multiple brands.

Lazy loading behavior:

- Initial load requests root rows.
- Expand row requests direct children by `parentId`.
- Expanded children are cached in the table state until refresh.
- If create/update/delete affects a visible parent, refresh that parent node's children.

Empty states:

- No root categories: show an empty table state with `新增根分类`.
- No children after expansion: show no child rows and remove/disable expansion affordance if appropriate.
- Delete blocked: show product/category usage reason instead of silently failing.

## Testing Decisions

- Backend tests:
  - root category list returns only root nodes.
  - child list returns only direct children for `parentId`.
  - rows include `hasChildren`.
  - create supports depth greater than three.
  - create supports unlimited siblings by not enforcing category-count limits.
  - update rejects parent cycles.
  - update rejects cross-brand parent moves.
  - delete blocks categories with direct products.
  - delete blocks categories with descendant products.
  - usage endpoint reports product and child counts.
- Frontend tests:
  - page renders table layout instead of card layout.
  - expanding a row calls the lazy-load API with that row id.
  - row actions render for every category row.
  - add child opens a dialog with parent preselected.
  - blocked delete displays the backend reason.
- Run focused product category tests first, then relevant product catalog API tests.

## Out of Scope

- No changes to Everhot/Rheem/Ruud public website navigation.
- No changes to `/products/selector/` intelligent selector behavior.
- No drag-and-drop ordering requirement.
- No hard-delete workflow.
- No bulk import/export.
- No product binding UI redesign beyond showing counts and preserving future integration points.

## Acceptance Criteria

1. Product category management no longer uses the card-style directory layout.
2. Product category management displays categories in a tree table.
3. Root categories load without loading the entire tree.
4. Expanding a category lazy-loads only its direct children.
5. Every category row has add, edit, and delete actions.
6. Operators can add a root category.
7. Operators can add a child category under any node.
8. Operators can edit category metadata.
9. Operators cannot delete categories that have direct product bindings.
10. Operators cannot delete categories whose descendants have product bindings.
11. Backend does not enforce max category depth.
12. Backend does not enforce max child count per category.
13. Existing public product API compatibility fields remain available.
