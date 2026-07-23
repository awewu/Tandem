# Issue 08: 多品牌空态、菜单联动和验收守卫

## What to build

Finalize multi-brand behavior and verification for the native brand-site content console. Newly-created brand sites should appear in the second-level menu, open a brand-scoped native console, show products when configured, and show a useful empty state when not configured. Brand Operations must remain the final menu item.

## Acceptance criteria

- [ ] A newly-created active brand site appears in the second-level menu above Brand Operations.
- [ ] Clicking a newly-created brand site opens a native console scoped to that brand.
- [ ] Brands without products show an actionable empty state.
- [ ] Existing brands still open their native consoles.
- [ ] Brand Operations remains the final second-level menu item.
- [ ] Browser or automated smoke confirms no iframe on `/comfort/sites/:brandCode`.
- [ ] `npm run build` for `apps/dealer-workbench` passes.
- [ ] Relevant frontend API contract and route ownership checks are run or explicitly reported if skipped.

## Blocked by

- Issue 01: 品牌站点路由切换到原生内容控制台壳
- Issue 02: 品牌产品列表与 taxonomy 数据适配
- Issue 03: 产品行内编辑、保存和上新闭环
- Issue 04: 上架/下架、删除/归档和权限门禁
- Issue 05: 主图、详情图和素材引用管理
- Issue 06: 结构化官网内容编辑器迁移
- Issue 07: 品牌发布/静态备份原生动作
