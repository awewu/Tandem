# 04 - Obsolete module page/code deletion

## What to build

Delete obsolete non-marketing modules from the 5000 dealer-workbench page/route code and clean related unused references. Product must remain.

## Scope

Delete or clean 5000 code for these obsolete modules:

- CRM customers: `/crm`
- Projects: `/projects`
- Design: `/design`, `/design/pro`, `/design/visualize`
- BIM: `/bim`, `/bim/*`
- Finance: `/finance`
- Team: `/team`
- Aftersales: `/aftersales`
- Hub: `/hub`, `/hub-console`

Primary likely areas:

- `apps/dealer-workbench/src/app`
- `apps/dealer-workbench/src/lib/workbench-navigation.ts`
- `apps/dealer-workbench/src/components/DealerNav.tsx`
- homepage/mobile/quick-entry components that expose obsolete modules
- module-specific data/components only when no retained marketing page imports them

## Acceptance criteria

- [ ] Obsolete page/route files for CRM, projects, design, BIM, finance, team, aftersales, and Hub are removed or made non-routable.
- [ ] Product code and `/products` remain intact.
- [ ] Brand website, market growth, products, and marketing accounts/permissions remain reachable.
- [ ] Navigation, mobile nav, homepage cards, and quick entries do not reference obsolete modules.
- [ ] No retained marketing page imports deleted module-specific files.
- [ ] Visiting obsolete paths no longer renders old business pages; Next 404 or a deliberate marketing-console redirect is acceptable.
- [ ] `pnpm.cmd --dir apps/dealer-workbench run build` passes.

## Blocked by

Issue 00 is strongly recommended so the deletion list is explicit. Issue 02 is useful context for final navigation shape.

## Out of scope

- Do not delete `/products`.
- Do not delete brand website, growth, or account functionality.
- Do not change backend APIs or database schema.
- Do not redesign retained marketing pages.
