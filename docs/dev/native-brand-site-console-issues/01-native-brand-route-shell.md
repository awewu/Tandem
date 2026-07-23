# Issue 01: 品牌站点路由切换到原生内容控制台壳

## What to build

When an operator clicks a concrete brand site under Brand Website, `/comfort/sites/:brandCode` should render a native brand content console shell instead of the Brand Website master-data table filtered to one row.

The shell should show selected brand identity, site URL/status summary, top-level product-management affordances, and a clear placeholder for product rows. It must preserve `/comfort/sites` as the master-data CRUD page.

## Acceptance criteria

- [ ] `/comfort/sites` still renders Brand Website Management CRUD.
- [ ] `/comfort/sites/everhot` renders a native brand content console shell.
- [ ] `/comfort/sites/rheem`, `/comfort/sites/ruud`, and a synthetic new brand code route render the same shell scoped to that brand.
- [ ] The shell uses the current 5000 workbench VI and does not copy 5012 raw styling.
- [ ] The shell contains no `iframe` and does not embed or navigate to port 5012.
- [ ] Brand Operations remains last in the second-level menu.
- [ ] Focused build or smoke verification is documented.

## Blocked by

None - can start immediately.
