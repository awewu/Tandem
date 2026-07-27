# 5000 营销系统控制台功能保留与废弃模块删除清单

来源：`docs/dev/dealer-workbench-hermes-style-ui-redesign-prd.md`、`docs/dev/hermes-tandem-vi-ui-design-audit.md`、`docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/00-existing-feature-inventory.md`

核对时间：2026-07-24

## 0. 结论

5000 当前定位已修正为营销系统控制台，不再是完整经营台。保留范围只包括：

- `/`：登录/营销控制台入口
- `/brand`：品牌运营
- `/comfort/sites`：品牌官网管理
- `/comfort/sites/[code]`：单品牌站控制台
- `/growth`：市场营销
- `/products`：产品
- `/accounts`：营销账号/权限

`/products` 是保留的营销系统核心页面，不能进入删除清单。

以下模块为 5000 废弃模块，后续删除 issue 必须删除页面/路由代码和所有可见入口：CRM、projects、design、BIM、finance、team、aftersales、Hub。

保留页面 UI 重做验收规则：只要本清单列出的入口、按钮、筛选、表单、上传、发布、分页、导入导出、跳转、权限态、loading/empty/error 状态缺失，保留营销 UI 重做不得验收通过。

## 1. 实际路由与导航核对

### 1.1 `apps/dealer-workbench/src/app` 当前路由快照

已核对当前页面路由文件：

| 路由 | 文件 | 处理 |
| --- | --- | --- |
| `/` | `apps/dealer-workbench/src/app/page.tsx` | 保留，作为登录/营销入口 |
| `/brand` | `apps/dealer-workbench/src/app/brand/page.tsx` | 保留 |
| `/comfort/*` | `apps/dealer-workbench/src/app/comfort/[[...section]]/page.tsx` | 保留营销官网管理子路由 |
| `/growth/*` | `apps/dealer-workbench/src/app/growth/[[...section]]/page.tsx` | 保留 |
| `/products` | `apps/dealer-workbench/src/app/products/page.tsx` | 保留，明确不删除 |
| `/accounts` | `apps/dealer-workbench/src/app/accounts/page.tsx` | 保留 |
| `/crm` | `apps/dealer-workbench/src/app/crm/page.tsx` | 删除 |
| `/projects` | `apps/dealer-workbench/src/app/projects/page.tsx` | 删除 |
| `/design` | `apps/dealer-workbench/src/app/design/page.tsx` | 删除 |
| `/design/pro` | `apps/dealer-workbench/src/app/design/pro/page.tsx` | 删除 |
| `/design/visualize` | `apps/dealer-workbench/src/app/design/visualize/page.tsx` | 删除 |
| `/bim` | `apps/dealer-workbench/src/app/bim/page.tsx` | 删除 |
| `/bim/[id]` | `apps/dealer-workbench/src/app/bim/[id]/page.tsx` | 删除 |
| `/bim/artifacts` | `apps/dealer-workbench/src/app/bim/artifacts/page.tsx` | 删除 |
| `/bim/deepen-queue` | `apps/dealer-workbench/src/app/bim/deepen-queue/page.tsx` | 删除 |
| `/bim/deepen/[projectId]` | `apps/dealer-workbench/src/app/bim/deepen/[projectId]/page.tsx` | 删除 |
| `/finance` | `apps/dealer-workbench/src/app/finance/page.tsx` | 删除 |
| `/team` | `apps/dealer-workbench/src/app/team/page.tsx` | 删除 |
| `/aftersales` | `apps/dealer-workbench/src/app/aftersales/page.tsx` | 删除 |
| `/hub` | `apps/dealer-workbench/src/app/hub/page.tsx` | 删除 |
| `/hub-console` | `apps/dealer-workbench/src/app/hub-console/page.tsx` | 删除 |
| `/mobile` | `apps/dealer-workbench/src/app/mobile/page.tsx` | 删除 as mobile entry page unless a retained marketing mobile shell explicitly replaces it |
| `/dashboard` | `apps/dealer-workbench/src/app/dashboard/page.tsx` | Remove from current nav/shell; retain only if replaced by a marketing-only overview |
| `/analytics` | `apps/dealer-workbench/src/app/analytics/page.tsx` | Remove from current nav/shell; retain only if replaced by marketing-only analytics |

### 1.2 `apps/dealer-workbench/src/lib/workbench-navigation.ts` 当前导航快照

`WORKBENCH_NAV` 当前同时包含保留营销模块和废弃经营/交付模块。

保留导航项：

- `brand-sites`：`/comfort/sites`，children 包括 `/comfort/sites`、`/comfort/sites/rheem`、`/comfort/sites/ruud`、`/comfort/sites/everhot`、`/comfort/dam`、`/comfort/catalog`、`/comfort/publish`、`/brand`
- `growth`：`/growth`，children 包括 `/growth/geo`、`/growth/copywriter`、`/growth/sentiment`、`/growth/automation`、`/growth/materials`
- `product`：`/products`，children 包括 `/products?module=catalog`、`/products?module=materials`、`/products?module=base`
- `accounts`：`/accounts`

必须删除的导航项和 `navItemForPath` 分支：

- `dashboard`：`/dashboard`、`/analytics`
- `crm`：`/crm`
- `projects`：`/projects`
- `design`：`/design`、`/design/pro`、`/design/visualize`
- `bim`：`/bim`、`/bim/deepen-queue`、`/bim/artifacts`
- `finance`：`/finance`
- `team`：`/team`
- `aftersales`：`/aftersales`
- `hub-console`：`/hub-console`、`/mobile`、`/hub`

### 1.3 Visible Entry Points

Current visible entry points checked:

- `apps/dealer-workbench/src/components/DealerNav.tsx`
  - Desktop AppRail renders every `WORKBENCH_NAV` item.
  - Mobile bottom nav uses `const MOBILE_NAV = WORKBENCH_NAV`, so every obsolete nav item also appears on mobile.
  - `DealerNav` hides chrome on `/`, `/mobile`, and `/hub`; `/mobile` and `/hub` are themselves obsolete route pages.
- `apps/dealer-workbench/src/app/page.tsx`
  - Current login page defaults to `/brand` and SSO redirects to `/brand`.
  - No old workbench cards were found here during this pass.
- `apps/dealer-workbench/src/app/hub/page.tsx`
  - Obsolete as a route, but currently contains retained marketing cards for `/brand`, `/growth`, `/products`, `/comfort/sites`, `/comfort`, and `/accounts`.
  - Since Hub is deleted from 5000, any still-needed marketing quick cards must move to the retained `/` or a retained marketing overview before this file is removed.
- `apps/dealer-workbench/src/app/hub-console/page.tsx`
  - Obsolete as a route, but currently contains grouped marketing console cards and links for retained modules.
  - Same migration rule as `/hub`: keep marketing entry content only if moved into retained marketing routes.
- `apps/dealer-workbench/src/app/mobile/page.tsx`
  - Obsolete as a page; it currently posts a lead to `/api/v2/crm/leads`, so it is not part of the corrected marketing console.

## 2. Retained Marketing Feature Checklists

### 2.1 `/` Login / Marketing Console Entry

File: `apps/dealer-workbench/src/app/page.tsx`

Must retain:

- Account/password login through `auth.login`.
- Token/session bridge behavior via local token storage, `setToken`, and `/api/session/bridge`.
- SSO login button using `/api/v2/auth/sso/login?redirect=/brand`.
- `returnUrl` support, defaulting to `/brand`.
- Error messages for missing/failed SSO and unauthorized access.
- Link back to public website through `NEXT_PUBLIC_PORTAL_URL` or `WORKBENCH_PORTS.public`.
- Mobile behavior that hides the left brand panel.

Must remove or avoid adding:

- Any CRM/project/design/BIM/finance/team/aftersales/Hub quick entry.
- Any post-login default to obsolete modules.

### 2.2 `/brand` Brand Operations

File: `apps/dealer-workbench/src/app/brand/page.tsx`

Must retain:

- `PageHeader` title/subtitle and marketing brand operations context.
- Hero carousel from static `HERO_SLIDES` plus live `/api/v2/brand` news.
- Active campaigns cards from `CAMPAIGNS`, including status labels.
- Training archive list from `TRAININGS`, progress calculation, rebate/score display.
- Brand target/progress summary from `brandSummary()` and `BRAND_TARGETS`.
- Live resource links from `/api/v2/brand`: products, trainings, campaigns.
- Fallback external links: Rheem home, news, products, training.
- Loading/unauthenticated live data hint currently shown as "登录后加载官网实时内容".

Regression notes:

- No write forms or uploads were found in this page; it is currently a read/entry dashboard.
- UI redesign must not remove live `/api/v2/brand` data merge or fallback resources.

### 2.3 `/comfort/sites` Brand Website Management

Files:

- `apps/dealer-workbench/src/app/comfort/[[...section]]/page.tsx`
- `apps/dealer-workbench/src/app/comfort/[[...section]]/BrandSitesManager.tsx`

Must retain route behavior:

- `/comfort/sites` renders `BrandSitesManager` with `brandCode="all"`.
- `/comfort/sites/[code]` renders `BrandSiteConsoleShell`.
- `/comfort/sites/[code]/library` renders `SiteProductShelfManager`.
- Other `/comfort/*` paths currently embed `WORKBENCH_PORTS.nexus`; these should not be accepted as old Hub-style marketing scope unless explicitly retained as native marketing pages.

Must retain list/filter behavior:

- Brand filter presets for all/Rheem/Ruud/Everhot/Rhautt group.
- `brandSites.list({ includeDeleted: true })`.
- Active/deleted site distinction.
- Brand-site update event dispatch: `rhautt-brand-sites-updated`.
- Logo lookup per site through `brandSites.logo(site.id)`.

Must retain actions:

- New site action.
- Edit site action.
- Publish site action through `brandSites.publish`.
- Delete/archive site action through `brandSites.remove`.
- Restore action through `brandSites.restore`.
- Logo upload through `brandSites.uploadLogo`.
- Save site through `brandSites.create` and `brandSites.update`.
- Close/cancel modal/drawer behavior.

Must retain form fields/states:

- Brand/site preset selection.
- Site code/name/domain/local URL/sort/status and related site metadata fields currently captured by `SiteForm`.
- Logo file input and uploaded logo preview/status.
- Error notice, success notice, loading state, empty state.

### 2.4 `/comfort/sites/[code]` Single Brand Site Console

Files:

- `apps/dealer-workbench/src/app/comfort/[[...section]]/BrandSiteConsoleShell.tsx`
- `apps/dealer-workbench/src/app/comfort/[[...section]]/SiteProductShelfManager.tsx`
- `apps/dealer-workbench/src/lib/brand-product-adapter.ts`

Must retain page context:

- The page must display the current brand/site context and must not allow accidental cross-brand edits.
- Rhautt group behavior must preserve child-brand handling where already implemented.
- `canWriteBrandProducts` role gate must continue to separate write and read-only states.

Must retain product list and filters:

- Product list query from product catalog, including brand, tenant, keyword, status, category, page, and pageSize where implemented.
- Product facets/categories/statuses where provided by adapter data.
- Empty states for unknown brand and no products, including links back to `/comfort/sites` or `/products?module=catalog`.
- Loading and row-level error/success feedback.
- Normal desktop table must remain high-signal and not rely on visible horizontal scrolling.

Must retain product row data:

- SKU/product identity.
- Brand.
- Product/category/system taxonomy.
- Main image readiness and detail image references.
- Product catalog status, visually separate from website shelf status.
- Website shelf assignment status: `未上架`, `已上架`, `已下架`.
- Display order/menu group/public slug/site title/featured state where available.

Must retain actions:

- Edit product website fields.
- Save/cancel edited product fields.
- Enable/disable product catalog status where supported.
- Publish/shelf/hide product assignment where supported.
- Archive product or shelf assignment where supported.
- Create missing product assignment.
- Upload/replace/delete main image.
- Upload/delete/reorder detail images.
- Add/remove structured product content rows such as highlights/specs/features/FAQ/images where currently present.

Must retain shelf-manager behavior:

- `/comfort/sites/[code]/library` site switcher.
- Counts for published/draft/hidden shelf items.
- Refresh action.
- Add product action.
- Product picker with brand picker and product search.
- Row actions: edit, publish, hide, archive.
- Form fields: product selection, public slug, site title, website category, menu group, display order, featured flag/status.
- Read-only state when `canWrite` is false.

### 2.5 `/growth` Marketing Growth

File: `apps/dealer-workbench/src/app/growth/[[...section]]/page.tsx`

Must retain routes/sections:

- `/growth` defaults to GEO.
- `/growth/geo`
- `/growth/copywriter`
- `/growth/sentiment`
- `/growth/automation`
- `/growth/materials`

Must retain visible modules:

- GEO visibility analysis.
- Copywriting Copilot.
- Sentiment radar.
- Marketing automation.
- Marketing materials library.

Must retain visible content/actions:

- Section status pill: running/review/risk/config/download states.
- Marketing KPI cards for GEO, copywriter, sentiment, automation.
- Native panels, not iframe-embedded external pages.
- Copywriter candidate list with publish/review-oriented statuses.
- Sentiment table with source, signal, tone.
- Automation flow cards and status.
- Materials cards with type/title/status and "查看" links to retained marketing destinations such as `/brand`, `/products?module=materials`, `/comfort/sites/everhot`.
- GEO table with keyword, intent, rank, visibility.

Known gaps:

- No server mutation, upload, import/export, or pagination behavior was observed in this page during inventory.
- If future UI adds those behaviors, they must be listed before redesign acceptance.

### 2.6 `/products` Product Marketing Catalog

File: `apps/dealer-workbench/src/app/products/page.tsx`

Must retain modules:

- `catalog` via `/products?module=catalog`.
- `materials` via `/products?module=materials`.
- `base` via `/products?module=base`.

Must retain data sources:

- `brandSites.list()` for dynamic brand options.
- `products.list()` for product catalog queries.
- `products.taxonomy()` where used.
- Existing fallback static `PRODUCTS`, `CATEGORIES`, and `SYSTEM_PACKS` where used.
- Tenant mapping for Rheem/Ruud/Everhot.

Must retain filters/search:

- Keyword search.
- Brand filter.
- Category filter.
- Status filter: all/active/inactive/archived.
- Module tabs.
- Reset/clear filter behavior.

Must retain catalog actions:

- New product form for users with write permission.
- Required validation for brand, name, SKU/model seed, category, system.
- Edit row action.
- Save/cancel row editing.
- Enable/disable product status.
- Archive product with confirmation.
- Row success/error/saving feedback.
- Action notice area.
- Read-only badge/state when user cannot write.

Must retain form fields:

- Product name.
- Model.
- Category.
- System.
- Public slug.
- Series.
- Tagline.
- Website category/menu category.
- Display order.
- Badges.
- Official English name.

Must retain materials/base behavior:

- Product materials readiness table: asset count, main-image readiness, positioning readiness, SEO readiness.
- Product category/base summary metrics.
- System pack cards and pricing/saving display where currently shown.

Pagination note:

- Product catalog currently queries `page=1&pageSize=100` and filters client-side across supported product brands. The PRD says product pagination/search/filter must not regress; future redesign should either preserve the current behavior or move to backend pagination only with explicit acceptance.

### 2.7 `/accounts` Marketing Accounts / Permissions

File: `apps/dealer-workbench/src/app/accounts/page.tsx`

Must retain access/permissions:

- `auth.me()` bootstrap.
- Redirect unauthenticated users to `/?returnUrl=/accounts`.
- Allow only platform/hq/dealer admin family as currently implemented.
- Denied state for unauthorized roles.
- `manageableRoles` split between brand admins and dealer admins until marketing-only roles are explicitly revised.

Must retain filters:

- Search by name/phone.
- Role filter.
- Status filter.
- Query button.
- Enter-to-search from search field.

Must retain table data/actions:

- Name.
- Masked phone/contact.
- Role label.
- Status: active/inactive/suspended.
- Last login date.
- Locked marker.
- Stop/enable account.
- Suspend/unsuspend account.
- Edit role.
- Reset password.
- Row operations call `adminUsers.update`.

Must retain modals/forms:

- Create account modal: phone, name, password, role, validation, busy state.
- Edit role modal: allowed role list, disabled save when unchanged, busy state.
- Reset password modal: minimum length validation and busy state.
- Error banner and success banner.

Marketing-scope cleanup:

- The visible "返回 Hub" link should be removed or redirected to a retained marketing entry because `/hub` is obsolete.
- Role vocabulary should eventually be pruned to marketing roles only, but not in this inventory issue.

## 3. Obsolete Module Deletion Checklist

### 3.1 CRM

Delete page/route files:

- `apps/dealer-workbench/src/app/crm/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `crm`.
- `navItemForPath('/crm')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/crm`.

Delete now-unused code if no retained marketing import remains:

- `apps/dealer-workbench/src/components/CrmBoard.tsx`
- `apps/dealer-workbench/src/components/CrmDrawer.tsx`
- `apps/dealer-workbench/src/components/CrmAnalytics.tsx`
- `apps/dealer-workbench/src/lib/crm-data.ts`
- CRM-only exports in `apps/dealer-workbench/src/lib/api.ts`
- CRM-only analytics helpers in `apps/dealer-workbench/src/lib/analytics-data.ts`

### 3.2 Projects

Delete page/route files:

- `apps/dealer-workbench/src/app/projects/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `projects`.
- `navItemForPath('/projects')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/projects`.

### 3.3 Design

Delete page/route files:

- `apps/dealer-workbench/src/app/design/page.tsx`
- `apps/dealer-workbench/src/app/design/pro/page.tsx`
- `apps/dealer-workbench/src/app/design/visualize/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `design`.
- `navItemForPath('/design')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/design`, `/design/pro`, `/design/visualize`.

Delete now-unused code if no retained marketing import remains:

- `apps/dealer-workbench/src/components/Editor2D.tsx`
- `apps/dealer-workbench/src/components/SolutionViewer.tsx`
- `apps/dealer-workbench/src/components/FloorPlanPro.tsx`
- `apps/dealer-workbench/src/components/AirflowSim.tsx`
- `apps/dealer-workbench/src/components/FloorHeatViz.tsx`
- `apps/dealer-workbench/src/components/PipeNetworkViz.tsx`
- Design-only exports in `apps/dealer-workbench/src/lib/api.ts`

### 3.4 BIM

Delete page/route files:

- `apps/dealer-workbench/src/app/bim/page.tsx`
- `apps/dealer-workbench/src/app/bim/[id]/page.tsx`
- `apps/dealer-workbench/src/app/bim/artifacts/page.tsx`
- `apps/dealer-workbench/src/app/bim/deepen-queue/page.tsx`
- `apps/dealer-workbench/src/app/bim/deepen/[projectId]/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `bim`.
- `navItemForPath('/bim')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/bim` or `/bim/*`.

Delete now-unused code/dependencies if no retained marketing import remains:

- `apps/dealer-workbench/src/components/BimIfcViewer.tsx`
- BIM/Rysnova BIM exports in `apps/dealer-workbench/src/lib/api.ts`
- `@rhautt/bim-viewer` dependency from `apps/dealer-workbench/package.json` if no retained page imports it.
- BIM WASM copy needs from `scripts/copy-wasm.js` only if no retained route uses BIM.

### 3.5 Finance

Delete page/route files:

- `apps/dealer-workbench/src/app/finance/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `finance`.
- `navItemForPath('/finance')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/finance`.

### 3.6 Team

Delete page/route files:

- `apps/dealer-workbench/src/app/team/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `team`.
- `navItemForPath('/team')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/team`.

### 3.7 Aftersales

Delete page/route files:

- `apps/dealer-workbench/src/app/aftersales/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `aftersales`.
- `navItemForPath('/aftersales')` branch.
- Mobile nav entry inherited from `WORKBENCH_NAV`.
- Any homepage/Hub/Hub-console card or quick entry to `/aftersales`.

Delete now-unused code if no retained marketing import remains:

- `apps/dealer-workbench/src/lib/aftersales-data.ts`
- Aftersales exports in `apps/dealer-workbench/src/lib/api.ts`

### 3.8 Hub And Mobile Entry

Delete page/route files:

- `apps/dealer-workbench/src/app/hub/page.tsx`
- `apps/dealer-workbench/src/app/hub-console/page.tsx`
- `apps/dealer-workbench/src/app/mobile/page.tsx`

Delete visible entries:

- `WORKBENCH_NAV` item `hub-console`.
- `navItemForPath('/hub-console')` branch.
- `hub-console` children for `/hub-console`, `/mobile`, `/hub`.
- `DealerNav` exemptions for `/mobile` and `/hub` after route deletion.
- Any links to `/hub`, including the current `/accounts` "返回 Hub" link.

Migration before deletion:

- If the retained marketing module cards from `/hub` or `/hub-console` are still wanted, move them into retained `/` or a retained marketing overview before deleting Hub files.
- Do not keep `/hub` as a visible workaround; corrected PRD says Hub is out of 5000 scope.

### 3.9 Dashboard / Analytics

Current PRD retention table does not include `/dashboard` or `/analytics`, while the PRD allows only "营销控制台必要的首页/总览". Therefore:

- Remove current `WORKBENCH_NAV` `dashboard` entry and `navItemForPath` branches.
- Remove visible `/dashboard` and `/analytics` entries from mobile nav.
- Delete `apps/dealer-workbench/src/app/dashboard/page.tsx` and `apps/dealer-workbench/src/app/analytics/page.tsx`, or replace them only through a separate marketing-only overview issue.
- Do not preserve current operations overview semantics under the corrected marketing console scope.

## 4. Navigation Cleanup Checklist

When the deletion issue runs, verify all of the following:

- `WORKBENCH_NAV` contains only retained marketing modules: brand websites/brand operations, growth, products, accounts.
- `navItemForPath` has no branches for `/dashboard`, `/analytics`, `/crm`, `/projects`, `/design`, `/bim`, `/finance`, `/team`, `/aftersales`, `/hub-console`.
- `DealerNav` AppRail no longer renders obsolete modules.
- `DealerNav` mobile bottom nav no longer renders obsolete modules.
- `/mobile` and `/hub` exemptions are removed from `DealerNav` if those routes are deleted.
- Login default and SSO redirect stay on retained marketing route `/brand` or another retained marketing entry.
- `/accounts` no longer links to `/hub`.
- Any retained marketing quick entries formerly housed in `/hub` or `/hub-console` are moved before those files are deleted.

## 5. Smoke / Build Gates

Package scripts currently exposed by `apps/dealer-workbench/package.json`:

- `pnpm.cmd --dir apps/dealer-workbench run build`
- `pnpm.cmd --dir apps/dealer-workbench run smoke:local-5011:e2e`

Relevant existing marketing/product/brand smoke or static scripts found under `apps/dealer-workbench/scripts`:

- `smoke-local-5011-e2e.js`
- `smoke-native-brand-console.js`
- `smoke-native-brand-console-images.js`
- `smoke-brand-product-edit-modal.js`
- `smoke-brand-product-status-rbac.js`
- `smoke-brand-publish.js`
- `smoke-brand-site-row-shelf-controls.js`
- `smoke-product-catalog-scroll.js`
- `static-brand-filtered-product-listing.test.js`
- `static-menu-group-options.test.js`
- `static-site-materials-tab.test.js`
- `static-responsive-brand-product-table.test.js`

Deletion acceptance gates:

- Dealer workbench build must pass after obsolete route deletion.
- Build must not contain imports from deleted route/component files.
- Retained marketing smoke coverage above must still pass or be explicitly replaced by equivalent marketing smoke coverage.
- Visiting obsolete module paths should show Next default 404 or a deliberate redirect to a retained marketing route, never the old page.

## 6. Do Not Change In This Issue

This inventory issue must not:

- Redesign UI.
- Delete files.
- Change CSS.
- Change APIs, database, product behavior, image upload behavior, shelf state, or pagination.
- Remove `/products`.
