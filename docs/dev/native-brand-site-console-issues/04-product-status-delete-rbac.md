# Issue 04: 上架/下架、删除/归档和权限门禁

## What to build

Bring over the product status and removal behaviors from the 5012 reference into the native 5000 console. Operators with write permission should be able to put a product on shelf, take it off shelf, and delete/archive it according to backend policy. Read-only users should be safely gated.

## Acceptance criteria

- [ ] Product status is visible in the native list using current VI badge styles.
- [ ] Write-capable users can toggle active/inactive status.
- [ ] Write-capable users can delete/archive a product after confirmation.
- [ ] Read-only users cannot trigger status or delete actions.
- [ ] Server-side API policy also rejects unauthorized writes.
- [ ] Success and failure messages are visible and consistent with 5000 workbench UI.

## Blocked by

- Issue 02: 品牌产品列表与 taxonomy 数据适配
