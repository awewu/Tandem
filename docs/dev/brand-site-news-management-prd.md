# PRD：品牌官网资讯管理 CRUD

## Problem Statement

当前官网前台存在“恒热资讯 / News & Insights”展示模块，但资讯内容仍偏静态化，运营人员无法在后台统一维护。品牌运营需要在“品牌官网管理 → 具体品牌官网内容控制台”中直接管理每个品牌官网的资讯内容，并保证后台维护的数据与官网前台展示一致。

## Solution

在品牌官网内容控制台中新增“资讯”Tab，与“产品”“其他素材”并列。运营人员可在该入口对当前品牌官网的资讯进行 CRUD 管理。官网前台资讯模块改为读取后台资讯数据，但展示样式必须保持当前视觉效果一致。

## User Stories

1. As a brand operator, I want to manage Everhot news in the Everhot brand-site console, so that news content can be maintained without code changes.
2. As a brand operator, I want to create news with title, summary, body, cover image, publish date, status, and sort order, so that new brand updates can be published to the website.
3. As a brand operator, I want to edit existing news, so that copy, images, dates, and publishing status can be corrected.
4. As a brand operator, I want to archive or delete news, so that obsolete content no longer appears on the website.
5. As a brand operator, I want to publish and hide news independently, so that drafts or hidden articles are not shown on the public website.
6. As a website visitor, I want the “News & Insights” section to keep its current visual format, so that the front-site experience does not regress.
7. As a developer, I want mock news data to match the current front-site cards and images, so that development and visual validation start from the current expected display.

## Functional Requirements

- Add a “资讯” Tab in the brand-site content console near the existing “产品” and “其他素材” tabs.
- Scope all news records by `brandCode` or `siteCode`.
- Support list, create, update, delete/archive, publish, hide, and ordering controls.
- Support searching by title and summary.
- Support filtering by status: all, draft, published, hidden, archived.
- Support pagination and sorting by publish date and display order.
- Use uploaded or selected image assets as cover images.
- Public website only displays published, non-deleted news.

## Data Model

Recommended fields:

- `id`
- `brandCode` or `siteCode`
- `title`
- `summary`
- `body`
- `coverImageArtifactId`
- `coverImageUrl`
- `publishedAt`
- `slug`
- `status`
- `sortOrder`
- `isFeatured`
- `createdAt`
- `updatedAt`
- `deletedAt`

Recommended statuses:

- `draft`
- `published`
- `hidden`
- `archived`

## Mock Data Requirements

Development mock data must match the current front-site display and use the same images currently visible in the frontend cards.

Seed data must be committed as project migration files under `database/postgres/migrations/`. Do not rely on manual database edits for this feature.

1. `2026-06`
   - Title: `恒热中国官网全新升级上线`
   - Summary: `以更清晰的产品架构与服务体验，连接每一个家庭与项目。`
   - Image: same as the current first news card image.
2. `2026-05`
   - Title: `恒热商用热水方案亮相行业展会`
   - Summary: `大功率连续供热系统获酒店与公寓项目方关注。`
   - Image: same as the current second news card image.
3. `2026-04`
   - Title: `如何为大户型选择中央采暖系统`
   - Summary: `从热负荷计算到设备选型的完整选购指南。`
   - Image: same as the current third news card image.

## Frontend Display Requirements

- The public “恒热资讯 / News & Insights” section must keep the current layout and visual treatment.
- Preserve current card image ratio, border radius, spacing, typography, date, title, summary, and “查看全部资讯 →” placement.
- Homepage shows a fixed number of published news items, initially latest or ordered top 3.
- “查看全部资讯” opens the full news list page.
- Hidden, draft, archived, or deleted records must not appear on the public site.

## Backend API Requirements

Recommended API contracts:

- `GET /api/v2/brand-sites/:siteCode/news`
- `POST /api/v2/brand-sites/:siteCode/news`
- `GET /api/v2/brand-sites/:siteCode/news/:id`
- `PATCH /api/v2/brand-sites/:siteCode/news/:id`
- `DELETE /api/v2/brand-sites/:siteCode/news/:id`
- `POST /api/v2/brand-sites/:siteCode/news/:id/publish`
- `POST /api/v2/brand-sites/:siteCode/news/:id/hide`

Backend behavior:

- Enforce brand or site isolation.
- Admin endpoints can query all statuses subject to permissions.
- Public consumption endpoints should return only published, non-deleted records.
- Delete should prefer soft delete or archive unless hard delete is explicitly required later.

## Admin Frontend Requirements

- Add a “资讯” tab to the current brand-site content console.
- Provide a news table with search, status filter, pagination, and actions.
- Provide create and edit forms.
- Cover image should support selecting or uploading a file artifact.
- Slug is a system/internal field and should not be displayed to brand operators.
- Actions should include edit, publish, hide, archive/delete.
- The current selected brand/site determines the news scope.

## Testing Decisions

- Verify backend CRUD contracts by creating, editing, publishing, hiding, and archiving a news record.
- Verify brand isolation: Everhot news must not appear under Rheem or Ruud.
- Verify public query behavior: only published, non-deleted news is returned.
- Verify admin query behavior: draft and hidden records can be managed by authorized users.
- Verify public front-site visual regression: the mock data renders with the same layout and images as the current “News & Insights” module.
- Verify console workflow: a newly published news item appears on the public site without code changes.

## Acceptance Criteria

- Brand-site console includes a visible “资讯” Tab.
- Everhot news CRUD works from the Everhot brand-site console.
- News records are brand/site scoped.
- Public website reads news from data instead of hard-coded cards.
- Current visual format of the “恒热资讯 / News & Insights” section remains unchanged.
- Mock news data content and images match the current frontend display.
- Published news appears on the public site.
- Draft, hidden, archived, and deleted news does not appear on the public site.

## Out of Scope

- Full rich-text editor implementation beyond the basic body field.
- Multi-language content workflow.
- SEO automation beyond storing basic slug and fields.
- Public comment, likes, or social sharing.
- Cross-brand syndicated news publishing.

## Further Notes

- The feature should follow the existing Rhautt Nexus brand-site management architecture.
- New business logic should prefer the target API direction under NestJS/PostgreSQL/TypeScript where applicable.
- Legacy server compatibility should be preserved until matching contract coverage exists.
