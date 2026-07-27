# 5000 Dealer Workbench existing feature retention checklist

Source issue: `docs/dev/dealer-workbench-hermes-style-ui-redesign-issues/00-existing-feature-inventory.md`

This is a pre-redesign inventory for `apps/dealer-workbench`. The Hermes-style UI redesign cannot be accepted if any listed route, entry point, control, form, upload/import/export action, pagination control, publish/shelf action, permission state, loading state, empty state, or error state disappears unless a follow-up issue explicitly removes it.

This inventory is documentation-only. It does not redesign UI, change CSS, alter APIs, or change business behavior.

## Verification snapshot

Inventory date: 2026-07-24

Route source checked:

- `apps/dealer-workbench/src/app`
- `apps/dealer-workbench/src/components`
- `apps/dealer-workbench/src/lib/workbench-navigation.ts`
- `apps/dealer-workbench/package.json`
- `apps/dealer-workbench/scripts`

Route list was verified by enumerating every `page.tsx` under `apps/dealer-workbench/src/app`. API route files under `src/app/api` are excluded from UI scope.

## Global shell and navigation

Files:

- `apps/dealer-workbench/src/app/layout.tsx`
- `apps/dealer-workbench/src/components/DealerNav.tsx`
- `apps/dealer-workbench/src/lib/workbench-navigation.ts`

Retention checklist:

- [ ] Keep `DealerNav` plus `TopBar` shell on authenticated workbench pages.
- [ ] Keep `DealerNav` hidden on `/`, `/mobile`, and `/hub`.
- [ ] Keep left primary navigation entries from `WORKBENCH_NAV`: brand sites, growth, products, accounts.
- [ ] Keep subnavigation collapse/expand with persisted `localStorage` key `rhautt-subnav-collapsed`.
- [ ] Keep active state for product query modules: `/products?module=catalog`, `/products?module=materials`, `/products?module=base`.
- [ ] Keep dynamic brand-site subnav entries loaded from active, non-deleted brand sites.
- [ ] Keep account trigger, profile display, role label, logout menu, and logout behavior.
- [ ] Keep mobile bottom nav entries for products, brand, and accounts.
- [ ] Keep auth profile cache read/write through `localStorage.user`.

## Current route inventory

| Runtime route | App route file | Current UI surface | Retention level |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | Login and SSO entry | Detailed |
| `/dashboard` | `src/app/dashboard/page.tsx` | Workbench KPI dashboard, quick links, load calculator | Detailed |
| `/crm` | `src/app/crm/page.tsx` | CRM funnel board, analytics, detail drawer | Listed |
| `/projects` | `src/app/projects/page.tsx` | Project delivery kanban | Listed |
| `/design` | `src/app/design/page.tsx` | Embedded simple 2D designer iframe | Design/BIM |
| `/design/pro` | `src/app/design/pro/page.tsx` | Native CAD editor page | Design/BIM |
| `/design/visualize` | `src/app/design/visualize/page.tsx` | Visualization tabs and simulations | Design/BIM |
| `/bim` | `src/app/bim/page.tsx` | BIM project list and stage operations | Design/BIM |
| `/bim/[id]` | `src/app/bim/[id]/page.tsx` | BIM project detail, viewer, BOM, checklist, IoT handoff | Design/BIM |
| `/bim/artifacts` | `src/app/bim/artifacts/page.tsx` | Deepening artifact library | Design/BIM |
| `/bim/deepen-queue` | `src/app/bim/deepen-queue/page.tsx` | Deepening project queue | Design/BIM |
| `/bim/deepen/[projectId]` | `src/app/bim/deepen/[projectId]/page.tsx` | Deepening workbench and IFC viewer | Design/BIM |
| `/products` | `src/app/products/page.tsx` | Product catalog/materials/base modules | Detailed |
| `/brand` | `src/app/brand/page.tsx` | Brand operations dashboard | Listed |
| `/comfort` and `/comfort/*` | `src/app/comfort/[[...section]]/page.tsx` | Catch-all comfort workspace; non-`sites` paths embed legacy workspace | Listed |
| `/comfort/sites` | `src/app/comfort/[[...section]]/BrandSitesManager.tsx` | Brand-site master-data CRUD | Detailed |
| `/comfort/sites/[code]` | `src/app/comfort/[[...section]]/BrandSiteConsoleShell.tsx` | Single brand-site console and product shelf controls | Detailed |
| `/comfort/sites/[code]/library` | `src/app/comfort/[[...section]]/SiteProductShelfManager.tsx` | Site product assignment shelf library | Detailed |
| `/growth`, `/growth/geo`, `/growth/copywriter`, `/growth/sentiment`, `/growth/automation`, `/growth/materials` | `src/app/growth/[[...section]]/page.tsx` | Native marketing/growth modules | Detailed |
| `/accounts` | `src/app/accounts/page.tsx` | Admin account and role management | Detailed |
| `/finance` | `src/app/finance/page.tsx` | Finance and receivables risk dashboard | Listed |
| `/team` | `src/app/team/page.tsx` | Team performance leaderboard | Listed |
| `/aftersales` | `src/app/aftersales/page.tsx` | Aftersales ticket and warranty ledger | Listed |
| `/mobile` | `src/app/mobile/page.tsx` | Mobile quick lead and quote flow | Listed |
| `/hub` | `src/app/hub/page.tsx` | Role-filtered launcher / SSO hub | Listed |
| `/hub-console` | `src/app/hub-console/page.tsx` | Parent/child menu architecture preview | Listed |
| `/analytics` | `src/app/analytics/page.tsx` | Business analytics dashboard | Listed |

## Detailed route checklists

### `/`

Files:

- `apps/dealer-workbench/src/app/page.tsx`

Retention checklist:

- [ ] Keep manual login form with account/phone input and password input.
- [ ] Keep SSO login button and redirect to `/api/v2/auth/sso/login?redirect=/brand`.
- [ ] Keep `returnUrl` handling from query string after manual login.
- [ ] Keep `/api/session/bridge` POST after manual login.
- [ ] Keep token/user persistence through `@rhautt/shared-auth` and `localStorage`.
- [ ] Keep error alert for login and SSO error query codes.
- [ ] Keep loading state on submit.
- [ ] Keep public-portal return link using `NEXT_PUBLIC_PORTAL_URL` or `WORKBENCH_PORTS.public`.

### `/dashboard`

Files:

- `apps/dealer-workbench/src/app/dashboard/page.tsx`

Retention checklist:

- [ ] Keep date/workbench announcement strip.
- [ ] Keep KPI cards linked to `/crm` and `/bim`: monthly leads, active BIM projects, delivered projects, pending follow-up.
- [ ] Keep quick links: `/crm`, `/design`, `/bim`, `/products`, `/projects`, `/analytics`.
- [ ] Keep quick load calculator form: area input, city input, estimate button, loading state, JSON result display.
- [ ] Keep CRM recent leads panel with empty state and link to `/crm`.
- [ ] Keep API calls to `crm.listCustomers`, `bim.stats`, and `quotation.loadCalc`.

### `/comfort/sites`

Files:

- `apps/dealer-workbench/src/app/comfort/[[...section]]/page.tsx`
- `apps/dealer-workbench/src/app/comfort/[[...section]]/BrandSitesManager.tsx`

Retention checklist:

- [ ] Keep route dispatch: `/comfort/sites` renders `BrandSitesManager`.
- [ ] Keep KPI cards for total, active/published, inactive, archived sites.
- [ ] Keep brand filter buttons: all, Rheem, Ruud, Everhot, plus active dynamic sites from API.
- [ ] Keep top actions: refresh and create site.
- [ ] Keep table columns: brand, logo, URL, delivery type, publish/status, sort order, actions.
- [ ] Keep external URL links with new-tab behavior.
- [ ] Keep loading row and empty row inside the table.
- [ ] Keep error and success notices.
- [ ] Keep row edit action.
- [ ] Keep row enable/disable action.
- [ ] Keep row archive action with confirmation.
- [ ] Keep row restore action for archived sites.
- [ ] Keep create/edit dialog fields: code, status, Chinese name, English name, app key, delivery type, development URL, production URL, sort order, logo upload, note.
- [ ] Keep logo upload input accepting PNG, JPEG, WebP, and SVG.
- [ ] Keep create mode code presets for Rheem, Ruud, and Everhot.
- [ ] Keep code field disabled in edit mode.
- [ ] Keep required validation and pattern on site code.

### `/comfort/sites/[code]`

Files:

- `apps/dealer-workbench/src/app/comfort/[[...section]]/page.tsx`
- `apps/dealer-workbench/src/app/comfort/[[...section]]/BrandSiteConsoleShell.tsx`

Retention checklist:

- [ ] Keep route dispatch: `/comfort/sites/[code]` renders `BrandSiteConsoleShell`.
- [ ] Keep fallback site context for known brands if site master data is missing.
- [ ] Keep site summary/status context and environment links.
- [ ] Keep static site publish/backup action using `brandSites.publish`, including unsupported state, loading state, success log, and failure log.
- [ ] Keep group-site child-brand binding controls and save action for `rhautt-group`.
- [ ] Keep content tabs for products and materials.
- [ ] Keep product filters: keyword, status, category, page size.
- [ ] Keep pagination: current item range, previous page, next page, and server-backed `page` / `pageSize`.
- [ ] Keep product table columns: product, category/menu, image assets, website shelf, sort/content, actions.
- [ ] Keep create product skeleton panel and validation.
- [ ] Keep product row edit and modal edit entry.
- [ ] Keep base product metadata editing: name, model, category, system, public slug, series, tagline, website category, display order, badges, official English name.
- [ ] Keep structured website content editing and save action.
- [ ] Keep dirty/clean, saving, success, and error row feedback states.
- [ ] Keep product status action for active/inactive.
- [ ] Keep product archive action.
- [ ] Keep main image upload/replace and delete actions.
- [ ] Keep detail image upload, delete, and move up/down actions.
- [ ] Keep website shelf state labels separate from catalog status: unlisted, published, hidden.
- [ ] Keep website shelf publish action, creating assignment first if needed.
- [ ] Keep website shelf hide action for published assignments.
- [ ] Keep shelf loading, busy, success, and error feedback.
- [ ] Keep read/write permission state from `auth.me()` and `canWriteBrandProducts`.
- [ ] Keep read-only rendering when the current role cannot write.
- [ ] Keep materials panel for current site content placeholders/resources.

### `/comfort/sites/[code]/library`

Files:

- `apps/dealer-workbench/src/app/comfort/[[...section]]/page.tsx`
- `apps/dealer-workbench/src/app/comfort/[[...section]]/SiteProductShelfManager.tsx`

Retention checklist:

- [ ] Keep route dispatch: `/comfort/sites/[code]/library` renders `SiteProductShelfManager`.
- [ ] Keep page action back to `/comfort/sites/[code]/library` product source library entry.
- [ ] Keep site switcher nav across active sites.
- [ ] Keep counts for published, draft, hidden assignments.
- [ ] Keep refresh action.
- [ ] Keep add product action only for write-capable roles.
- [ ] Keep read-only badge for non-write roles.
- [ ] Keep create form product picker, brand picker for group site, product search, product loading, product error, no-match help, selected-product help.
- [ ] Keep advanced manual ID inputs for product UUID and product tenant UUID.
- [ ] Keep assignment fields: public slug, website category, menu group, display order, site title, site summary, featured checkbox.
- [ ] Keep assignment table columns: website display, product, group, status, order, actions.
- [ ] Keep row edit, publish, hide, archive actions.
- [ ] Keep archive confirmation.
- [ ] Keep edit dialog with save/cancel.
- [ ] Keep loading row, empty row, error notice, and success notice.
- [ ] Keep write permission from `auth.me()` and `canWriteBrandProducts`.

### `/products`

Files:

- `apps/dealer-workbench/src/app/products/page.tsx`

Retention checklist:

- [ ] Keep query module routing for `catalog`, `materials`, and `base`.
- [ ] Keep module tab/buttons for product catalog, product materials, and catalog foundation.
- [ ] Keep API-backed product catalog queries to `/api/v2/product-catalog/devices`.
- [ ] Keep all-brand behavior requesting Rheem, Ruud, and Everhot with tenant IDs.
- [ ] Keep search input.
- [ ] Keep category filter.
- [ ] Keep brand filter.
- [ ] Keep status filter: all, active, inactive, archived.
- [ ] Keep API connection badge showing loading, success, or API failure.
- [ ] Keep stats cards: total, stock, new, average margin.
- [ ] Keep create product action and form for write-capable roles.
- [ ] Keep create fields: brand, name, model/SKU seed, category, system.
- [ ] Keep create validation, submit loading, and error display.
- [ ] Keep catalog empty state with reset filters action.
- [ ] Keep product rows/cards with brand, SKU/model, name, category, system, price/margin, and status.
- [ ] Keep product row edit action.
- [ ] Keep product metadata edit fields: name, model, category, system, public slug, series, tagline, website category, display order, badges, official English name.
- [ ] Keep dirty state, reset action, save action, success feedback, and error feedback.
- [ ] Keep status toggle action for active/inactive.
- [ ] Keep archive action and archived disabled state.
- [ ] Keep permissions through `auth.me()` and `canWriteBrandProducts`.
- [ ] Keep materials view with asset, main image, positioning, and website-base readiness table.
- [ ] Keep catalog foundation view with category rows and system pack grid.
- [ ] Keep fallback product data when live API returns no rows.
- [ ] Keep current behavior that page size is fixed in API queries at `pageSize=100`; no UI pagination exists on this page today.

### `/growth` and `/growth/*`

Files:

- `apps/dealer-workbench/src/app/growth/[[...section]]/page.tsx`
- `apps/dealer-workbench/src/lib/workbench-navigation.ts`

Runtime sections:

- `/growth` defaults to GEO.
- `/growth/geo`
- `/growth/copywriter`
- `/growth/sentiment`
- `/growth/automation`
- `/growth/materials`

Retention checklist:

- [ ] Keep catch-all section routing and default to GEO for unknown or empty section.
- [ ] Keep subnav entries from `WORKBENCH_NAV`: GEO, copywriter, sentiment, automation, materials.
- [ ] Keep page header status pill for active section.
- [ ] Keep hero/summary panel with section icon, title, subtitle, primary metric, and active status.
- [ ] Keep overview metrics for GEO, copywriter, sentiment, and automation.
- [ ] Keep weekly progress side panel.
- [ ] Keep publish queue side panel.
- [ ] Keep GEO keyword table.
- [ ] Keep copywriter task list and status badges.
- [ ] Keep sentiment table.
- [ ] Keep automation workflow list with conversion pill.
- [ ] Keep materials grid with status, brand, format, updated date, and "view resource" links.
- [ ] Keep all sections native in 5000 and do not replace them with iframe embeds.
- [ ] Keep the current no-form/no-mutation scope; redesign should not invent new marketing CRUD in this issue.

### `/accounts`

Files:

- `apps/dealer-workbench/src/app/accounts/page.tsx`

Retention checklist:

- [ ] Keep auth bootstrap through `auth.me()` and `adminUsers.list()`.
- [ ] Keep redirect to `/?returnUrl=/accounts` when unauthenticated.
- [ ] Keep denied state for roles other than platform admin, HQ admin, and dealer admin.
- [ ] Keep role-sensitive manageable-role list: platform/HQ can manage all roles; dealer admin can manage dealer roles.
- [ ] Keep header current identity display.
- [ ] Keep return-to-hub link.
- [ ] Keep new account button disabled unless authorized.
- [ ] Keep filters: search by name/phone, role select, status select, query button.
- [ ] Keep account table columns: name, masked phone, role, status, last login, actions.
- [ ] Keep locked indicator.
- [ ] Keep loading row and empty row.
- [ ] Keep error and success banners.
- [ ] Keep row actions: disable, enable, suspend, unsuspend, edit role, reset password.
- [ ] Keep create modal fields: phone, name, role, initial password.
- [ ] Keep create validations: China mobile pattern, name required, role required, password length >= 8.
- [ ] Keep role modal with allowed roles and disabled save when unchanged.
- [ ] Keep reset-password modal with password length >= 8.
- [ ] Keep modal cancel/close and busy states.

## Design and BIM retention

### `/design`

Files:

- `apps/dealer-workbench/src/app/design/page.tsx`

Retention checklist:

- [ ] Keep top toolbar with simple 2D design title.
- [ ] Keep link to `/design/visualize`.
- [ ] Keep iframe source `${NEXT_PUBLIC_API_URL}/designer.html`.
- [ ] Keep iframe full remaining height and `allow="clipboard-write"`.

### `/design/pro`

Files:

- `apps/dealer-workbench/src/app/design/pro/page.tsx`
- `apps/dealer-workbench/src/components/Editor2D.tsx`

Retention checklist:

- [ ] Keep project selector and load latest saved plan.
- [ ] Keep plan name input.
- [ ] Keep save action to `design.saveFloorPlan`.
- [ ] Keep new blank plan action.
- [ ] Keep sample apartment action.
- [ ] Keep links back to `/design` and to `/design/visualize`.
- [ ] Keep loading, success, error, and busy states.
- [ ] Keep canvas/editor tools: select, wall, equipment.
- [ ] Keep equipment type palette.
- [ ] Keep selected delete action.
- [ ] Keep DXF export action.
- [ ] Keep clear action.
- [ ] Keep grid, snapping, wall length labels, equipment drag, cursor display, right-click wall drawing cancel.

### `/design/visualize`

Files:

- `apps/dealer-workbench/src/app/design/visualize/page.tsx`
- `apps/dealer-workbench/src/components/SolutionViewer.tsx`
- `apps/dealer-workbench/src/components/FloorPlanPro.tsx`
- `apps/dealer-workbench/src/components/FloorHeatViz.tsx`
- `apps/dealer-workbench/src/components/PipeNetworkViz.tsx`
- `apps/dealer-workbench/src/components/AirflowSim.tsx`

Retention checklist:

- [ ] Keep saved-project selector.
- [ ] Keep loading state while loading project plan.
- [ ] Keep demo/real plan status pill.
- [ ] Keep tabs: 3D solution, blueprint, floor heat, pipe network, airflow.
- [ ] Keep lazy component loading fallback.
- [ ] Keep back link to `/design`.
- [ ] Keep simulation controls inside child components, including floor heat spacing and supply-temperature controls, pipe-network system toggles and sliders, and 3D/canvas interactions.

### `/bim`

Files:

- `apps/dealer-workbench/src/app/bim/page.tsx`

Retention checklist:

- [ ] Keep KPI cards: total projects, in progress, delivered, inherited this month.
- [ ] Keep links to `/bim/deepen-queue` and `/bim/artifacts`.
- [ ] Keep inherit-from-quote form with quote ID input, enter-key behavior, inherit button, busy state, and success/error message.
- [ ] Keep status filter buttons.
- [ ] Keep refresh button.
- [ ] Keep loading state and empty state.
- [ ] Keep project table columns: quotation number, customer, city, systems, BOM count, status, actions.
- [ ] Keep row actions: open detail, export BOM, advance stage.
- [ ] Keep `bim.exportBom` file download behavior.

### `/bim/[id]`

Files:

- `apps/dealer-workbench/src/app/bim/[id]/page.tsx`
- shared viewer package `@rhautt/bim-viewer`

Retention checklist:

- [ ] Keep back link to `/bim`.
- [ ] Keep stage progress indicator.
- [ ] Keep advance-stage action while project is not IoT delivered.
- [ ] Keep IoT package download action when project is delivered.
- [ ] Keep assignee input and assign action.
- [ ] Keep drawing URL display, drawing URL input, and save action.
- [ ] Keep BIM IFC viewer area and loading fallback.
- [ ] Keep BOM table and Excel export action.
- [ ] Keep BOM total calculation.
- [ ] Keep acceptance checklist grouped by system and toggle action.
- [ ] Keep project-delivered panel and IoT package JSON download.
- [ ] Keep error, saving, and advancing states.

### `/bim/artifacts`

Files:

- `apps/dealer-workbench/src/app/bim/artifacts/page.tsx`

Retention checklist:

- [ ] Keep projectId filter input and filter button.
- [ ] Keep loading state, error state, and empty state.
- [ ] Keep artifact table columns: type, name, status, version, projectId, generated time.
- [ ] Keep type/status label mappings.

### `/bim/deepen-queue`

Files:

- `apps/dealer-workbench/src/app/bim/deepen-queue/page.tsx`

Retention checklist:

- [ ] Keep stats cards from deepening stats.
- [ ] Keep loading, error, and empty states.
- [ ] Keep project cards with status, city, area, opportunity ID, and link to `/bim/deepen/[projectId]`.

### `/bim/deepen/[projectId]`

Files:

- `apps/dealer-workbench/src/app/bim/deepen/[projectId]/page.tsx`
- `apps/dealer-workbench/src/components/BimIfcViewer.tsx`

Retention checklist:

- [ ] Keep queue back link.
- [ ] Keep handoff-ready/deepening status badge.
- [ ] Keep loading, success, and error notices.
- [ ] Keep signed-material readiness checklist and missing-artifact list.
- [ ] Keep deepening actions: generate visual, generate deliverable/BOM, advance/verify.
- [ ] Keep next-actions list.
- [ ] Keep BIM 3D viewer header with artifact context.
- [ ] Keep artifact-based IFC load from `/api/v2/file-artifact/[artifactId]/base64`.
- [ ] Keep local IFC file upload.
- [ ] Keep fit-view action.
- [ ] Keep viewer statuses: idle, loading, ready, error.
- [ ] Keep OrbitControls interactions: rotate, zoom, pan.
- [ ] Keep local WASM IFC parsing.

## Listed route retention

### `/crm`

Files:

- `apps/dealer-workbench/src/app/crm/page.tsx`
- `apps/dealer-workbench/src/components/CrmAnalytics.tsx`
- `apps/dealer-workbench/src/components/CrmBoard.tsx`
- `apps/dealer-workbench/src/components/CrmDrawer.tsx`

Retention checklist:

- [ ] Keep CRM analytics panel.
- [ ] Keep CRM board with opportunity selection and stage-change callback.
- [ ] Keep loading state.
- [ ] Keep drawer open/close and update flow.
- [ ] Keep drawer stage move actions, editable fields, quote selection, sign action, note textarea, note save, and design/project links.

### `/projects`

Files:

- `apps/dealer-workbench/src/app/projects/page.tsx`

Retention checklist:

- [ ] Keep KPI cards.
- [ ] Keep drag/drop kanban columns from `PROJ_STAGES`.
- [ ] Keep project cards with customer, value, city/system, milestone progress, overdue indicator, installer, and payment ratio.
- [ ] Keep drag-to-stage behavior and backend advance sync when moving forward in non-demo mode.
- [ ] Keep horizontal kanban scroll.

### `/brand`

Files:

- `apps/dealer-workbench/src/app/brand/page.tsx`

Retention checklist:

- [ ] Keep hero carousel with static campaign slides and live Rheem news slides.
- [ ] Keep active campaign cards.
- [ ] Keep training archive/progress rows.
- [ ] Keep GMV/rebate KPI panel.
- [ ] Keep summary KPI panel.
- [ ] Keep rebate incentive card.
- [ ] Keep official-site resource links using live resources or fallback links.
- [ ] Keep external links opening in a new tab when applicable.

### `/finance`

Files:

- `apps/dealer-workbench/src/app/finance/page.tsx`

Retention checklist:

- [ ] Keep finance/risk KPI cards.
- [ ] Keep receivables aging distribution.
- [ ] Keep purchase order panel.
- [ ] Keep receivables detail table.
- [ ] Keep editable paid amount cell, enter/escape keyboard behavior, save button, optimistic local override, `bim.updatePaid`, and SWR mutate.
- [ ] Keep fallback mock data when BIM API has no receivable rows.

### `/team`

Files:

- `apps/dealer-workbench/src/app/team/page.tsx`

Retention checklist:

- [ ] Keep KPI cards.
- [ ] Keep live pipeline-derived leaderboard when API data exists.
- [ ] Keep mock team fallback.
- [ ] Keep ranked sales rows with rank, avatar, name, role, certification level, progress, deals, commission, and follow-up tasks.

### `/aftersales`

Files:

- `apps/dealer-workbench/src/app/aftersales/page.tsx`

Retention checklist:

- [ ] Keep KPI cards.
- [ ] Keep ticket list ordered open before done.
- [ ] Keep dispatch flow: dispatch button, staff select, optimistic status update, API dispatch call.
- [ ] Keep complete action for in-progress tickets and API status update.
- [ ] Keep warranty ledger from delivered BIM projects or fallback data.
- [ ] Keep due-service warning state.

### `/mobile`

Files:

- `apps/dealer-workbench/src/app/mobile/page.tsx`

Retention checklist:

- [ ] Keep 3-step mobile flow: customer info, pain selection, quote result.
- [ ] Keep back-step control.
- [ ] Keep customer fields: name, phone, area, city, address.
- [ ] Keep pain multi-select cards.
- [ ] Keep load calculation call to `/api/v2/quotation/load-calc`.
- [ ] Keep generated package options.
- [ ] Keep save-to-CRM action to `/api/v2/crm/leads` with bearer token.
- [ ] Keep share action using `navigator.share` or clipboard fallback.
- [ ] Keep validation alerts for incomplete info and missing pain points.
- [ ] Keep saved/loading states.

### `/hub`

Files:

- `apps/dealer-workbench/src/app/hub/page.tsx`
- `apps/dealer-workbench/src/app/hub/session-bridge.ts`

Retention checklist:

- [ ] Keep session resolution and redirect fallback to `/?returnUrl=/brand&ssoError=missing_session`.
- [ ] Keep role-filtered clusters and modules.
- [ ] Keep module cards and feature deep links.
- [ ] Keep white-label brand variables.
- [ ] Keep dynamic brand logos loaded from active brand sites with logo artifacts and resolved URLs.
- [ ] Keep logout action clearing token and user cache.
- [ ] Keep loading state.

### `/hub-console`

Files:

- `apps/dealer-workbench/src/app/hub-console/page.tsx`

Retention checklist:

- [ ] Keep fixed shell preview with rail, parent module menu, child menu, and canvas.
- [ ] Keep parent module selection resetting child selection.
- [ ] Keep child menu and child chip selection.
- [ ] Keep active URL preview for target port/path.
- [ ] Keep architecture preview and placeholder copy that target pages are not embedded yet.

### `/analytics`

Files:

- `apps/dealer-workbench/src/app/analytics/page.tsx`

Retention checklist:

- [ ] Keep KPI row.
- [ ] Keep GMV actual vs target chart.
- [ ] Keep conversion funnel chart.
- [ ] Keep channel, city, and product-mix bar panels.
- [ ] Keep seasonal demand chart.
- [ ] Keep live analytics loading with fallback datasets.

### `/comfort` and non-sites `/comfort/*`

Files:

- `apps/dealer-workbench/src/app/comfort/[[...section]]/page.tsx`

Retention checklist:

- [ ] Keep catch-all behavior for non-`sites` comfort paths.
- [ ] Keep embedded workspace iframe behavior for legacy comfort sections.
- [ ] Keep section suffix encoding.
- [ ] Before redesigning shell/navigation, verify whether `WORKBENCH_PORTS.nexus` is intentionally provided elsewhere or is currently an undefined legacy target.

## Upload, import, export, publish, and shelf action index

Uploads:

- [ ] `/comfort/sites`: site logo upload.
- [ ] `/comfort/sites/[code]`: product main image upload/replace.
- [ ] `/comfort/sites/[code]`: product detail image upload.
- [ ] `/bim/deepen/[projectId]`: local IFC file upload.
- [ ] `BimIfcViewer`: local IFC file upload and artifact base64 load.

Imports:

- [ ] `/bim`: inherit project from quotation ID.
- [ ] `/design/pro`: load latest floor plan from selected project.
- [ ] `/design/visualize`: load saved project plan.
- [ ] `/comfort/sites/[code]/library`: select existing product into website shelf assignment.

Exports/downloads:

- [ ] `/design/pro`: export DXF.
- [ ] `/bim`: export BOM.
- [ ] `/bim/[id]`: export BOM Excel.
- [ ] `/bim/[id]`: download IoT package JSON.
- [ ] `/mobile`: share link through native share or clipboard.

Publish/shelf:

- [ ] `/comfort/sites/[code]`: static site publish/backup.
- [ ] `/comfort/sites/[code]`: publish/hide product on current website shelf.
- [ ] `/comfort/sites/[code]/library`: publish/hide/archive website shelf assignment.
- [ ] `/growth/materials`: keep visible material statuses such as downloadable, publishable, review-needed.

Pagination:

- [ ] `/comfort/sites/[code]`: retain server-backed product pagination and page-size selector.
- [ ] `/products`: no UI pagination today; retain current fixed API `pageSize=100` behavior unless a separate issue changes it.
- [ ] `/comfort/sites`: no UI pagination today.
- [ ] `/comfort/sites/[code]/library`: no UI pagination today.

## Permission and role states

- [ ] `DealerNav`: account menu must keep profile and logout behavior.
- [ ] `/accounts`: platform admin, HQ admin, and dealer admin are allowed; other roles see denied state.
- [ ] `/accounts`: platform/HQ can manage all roles; dealer admin can manage dealer roles only.
- [ ] `/products`: write controls depend on `canWriteBrandProducts(auth.me())`.
- [ ] `/comfort/sites/[code]`: write controls depend on `canWriteBrandProducts(auth.me())`.
- [ ] `/comfort/sites/[code]/library`: write controls depend on `canWriteBrandProducts(auth.me())`.
- [ ] `/hub`: modules are filtered by role.
- [ ] `/mobile`: CRM lead save sends bearer token when available.

## Existing smoke and build gates relevant to 5000

Build/dev commands:

- [ ] `pnpm.cmd --dir apps/dealer-workbench run build`
- [ ] `pnpm.cmd --dir apps/dealer-workbench run dev`
- [ ] `pnpm.cmd --dir apps/dealer-workbench run dev:raw`
- [ ] `pnpm.cmd --dir apps/dealer-workbench run start`
- [ ] Root convenience command: `npm run dev:dealer`

Dealer-workbench smoke scripts found under `apps/dealer-workbench/scripts`:

- [ ] `node apps/dealer-workbench/scripts/smoke-local-5011-e2e.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-native-brand-console.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-native-brand-console-images.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-brand-publish.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-brand-product-edit-modal.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-brand-product-status-rbac.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-brand-site-row-shelf-controls.js`
- [ ] `node apps/dealer-workbench/scripts/smoke-product-catalog-scroll.js`
- [ ] `node apps/dealer-workbench/scripts/static-responsive-brand-product-table.test.js`
- [ ] Package script: `pnpm.cmd --dir apps/dealer-workbench run smoke:local-5011:e2e`

PRD-level redesign gates to run when UI changes begin:

- [ ] `pnpm.cmd --dir apps/dealer-workbench run build`
- [ ] Focused smoke script for each touched module above.
- [ ] Screenshot checks for desktop and mobile viewports for each touched page.
- [ ] No new heavyweight UI dependency unless approved separately.

## Redesign acceptance rule

For every redesigned page:

1. Check this document before editing UI.
2. Copy that page's checklist into the implementation issue or PR notes.
3. Verify each retained item manually or by smoke/build automation.
4. Reject the redesign if a listed function is missing, hidden, blocked, or semantically changed without a separate approved issue.
