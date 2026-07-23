# Issue 03: 产品行内编辑、保存和上新闭环

## What to build

Add write-capable product row editing and new product creation to the native brand content console. Operators with write permission should be able to edit public slug, name/model, category, system/menu category, sort order, and core official website fields, then save changes back to the product catalog without overwriting unrelated metadata.

## Acceptance criteria

- [ ] Write-capable users can edit a product row and save it.
- [ ] New product creation creates a minimum publishable skeleton for the selected brand.
- [ ] Saved data preserves unrelated product metadata and only updates the intended brand website fields.
- [ ] Dirty state, save pending state, and save error state are visible in the UI.
- [ ] Read-only users cannot see or trigger save/create controls.
- [ ] Focused tests or a browser smoke prove edit/save and create behavior.

## Blocked by

- Issue 02: 品牌产品列表与 taxonomy 数据适配
