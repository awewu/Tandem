# 恒热官网独立运营管理平台 MVP PRD

> 状态：Ready for issue breakdown
> Triage：`ready-for-agent`
> 日期：2026-07-16
> 目标环境：Windows Server
> 目标：当日下午完成产品目录管理闭环并上线
> 决策优先级：本文在“恒热官网后台归属、运行时依赖和发布方式”上取代旧的 Nexus 接入方案；恒热品牌定位、官网 VI、SEO/GEO 与静态站质量标准继续沿用现有官网总纲。

## Problem Statement

恒热官网当前位于 Rhautt Nexus 主仓库内，产品数据、图片同步、管理入口和发布脚本仍依赖 Nexus API、DAM 或仓库内的相对路径。该形态无法满足恒热官网独立上线、独立维护和独立故障隔离的要求，也不适合作为后续 Rheem、Ruud 等品牌官网可复用的管理平台基础。

品牌运营人员需要在独立管理端完成产品新增、编辑、删除、排序、上下架、图片与资料上传，并通过一次点击自动发布完整静态官网。官网访问不能依赖管理后台或数据库实时在线；发布失败不能影响当前线上版本；错误发布必须能够快速回滚。

Nexus 仍是集团通用业务后台和统一入口，但不再承载恒热官网内容管理业务。Nexus 未来只通过链接跳转到各品牌独立管理端。恒热官网管理平台必须拥有独立前端、独立后端、独立数据库、独立文件目录、独立账号和独立发布生命周期。

当前交付窗口仅允许建设“产品目录完整闭环”。完整页面 CMS、业务询盘、经销商、保修、SSO 和对象存储不属于本次上线范围。

## Solution

建设两个相互独立的项目：

1. **Everhot Public Website**：恒热面向公众的纯静态官网，独立仓库、独立构建、独立部署，不在浏览器运行时请求管理后台。
2. **Website Control Plane**：官网运营管理平台，采用独立全栈 Monorepo，包含管理端 Web、管理 API、数据库迁移、发布执行器和 Windows Server 部署配置。管理前端与 API 可以分别构建和部署。

一期工作流如下：

`管理员登录 -> 编辑产品/上传素材 -> 点击发布 -> 冻结内容快照 -> 生成内容发布包 -> 调用 Everhot 前端构建 -> 校验完整静态站 -> 切换当前版本`

发布过程全自动执行，不要求管理员登录服务器或手工复制文件。任何步骤失败时，当前线上版本保持不变。系统保留最近 3 个成功版本，并支持一键原子回滚。

现有 24 个产品和合法可用的产品素材通过一次性、可重复执行的迁移程序导入新平台。迁移完成并验收后，新平台成为恒热官网产品内容的唯一事实源；旧 Nexus 产品接口和 DAM 只作为迁移来源或历史回退，不再是运行时依赖。

## User Stories

1. As a brand administrator, I want to sign in with an independent local account, so that I can operate Everhot without depending on Nexus availability.
2. As a brand administrator, I want to see all products and their publication status, so that I can understand the current catalog at a glance.
3. As a brand administrator, I want to create a product with a unique slug, so that the website can expose a stable product detail URL.
4. As a brand administrator, I want to edit product names, categories, systems, series and taglines, so that catalog content remains accurate.
5. As a brand administrator, I want to edit specifications, badges, features and highlights as ordered structured lists, so that different product types can retain their own content shape.
6. As a brand administrator, I want to configure product SEO fields, so that generated product pages remain discoverable.
7. As a brand administrator, I want to sort products, so that product grids follow the intended commercial priority.
8. As a brand administrator, I want to enable or disable products, so that discontinued products can be removed from the public catalog without deleting their history.
9. As a brand administrator, I want to delete a draft product that has never been published, so that accidental records do not pollute the catalog.
10. As a brand administrator, I want published products to be protected from destructive deletion, so that existing public URLs and release history remain recoverable.
11. As a brand administrator, I want to upload a card image and a specification image separately, so that each image appears in the correct website location.
12. As a brand administrator, I want to upload product documents, so that authorized technical material can be associated with a product.
13. As a brand administrator, I want invalid, oversized or executable files to be rejected, so that the server is not exposed through the upload surface.
14. As a brand administrator, I want one click to publish all current product changes, so that I do not need to run build or deployment commands manually.
15. As a brand administrator, I want to see publish progress and final logs, so that I can determine whether the website actually changed.
16. As a brand administrator, I want failed publication to leave the current website untouched, so that content or build errors do not cause an outage.
17. As a brand administrator, I want to see the latest 3 successful releases, so that I can identify the currently deployed version and recent history.
18. As a brand administrator, I want to roll back to a recent successful release with one click, so that a bad publication can be reversed quickly.
19. As a website visitor, I want the catalog and product details to render without calling the management API, so that the website remains fast and available during backend downtime.
20. As a website visitor, I want existing product slugs and URLs to remain valid after migration, so that bookmarks and search results do not break.
21. As an operator, I want application data, uploads and releases to live outside application deployment directories, so that service upgrades do not erase persistent data.
22. As an operator, I want services to restart automatically on Windows Server, so that machine restarts do not require manual recovery.
23. As an operator, I want health status and publish logs, so that API, database, storage and publisher failures can be diagnosed.
24. As an operator, I want a verified pre-cutover release and an unchanged legacy fallback, so that production can be restored if the cutover fails.
25. As a Nexus user, I want a stable link to the Everhot management frontend, so that Nexus can act as a navigation hub without sharing authentication or business code.
26. As a platform maintainer, I want brand-specific settings to be configuration rather than hard-coded logic, so that the platform can later be deployed independently for another brand.

## Implementation Decisions

### System And Repository Boundaries

- The Everhot public website is extracted into its own repository and release lifecycle.
- Website Control Plane is a second independent full-stack Monorepo containing the admin Web application, API, shared contracts, database migrations, publisher and deployment scripts.
- The existing computer asset management project remains unchanged. Its authentication, Flyway and Spring conventions may be used as reference or selectively extracted, but asset, workflow, repair, inventory and mobile domains must not enter Website Control Plane.
- The existing Nexus repository remains unchanged by extraction. Files are copied and verified; source files are not moved or deleted as part of the MVP.
- Nexus integration is link-only. Browser navigation targets the management frontend, and that frontend calls its own API.

### Technology Baseline

- Backend: Java 17, Spring Boot 3.2, Spring Security, JWT, Bean Validation, Flyway and PostgreSQL.
- Admin frontend: Vue 3, Vite and Ant Design Vue, following the reusable technical conventions already proven by the existing management project.
- PostgreSQL is the durable product metadata store. Redis and Flowable are not required for the MVP.
- The platform is deployed on Windows Server. API and any long-running publisher process must run under a Windows service wrapper or equivalent supervised process.
- Public static output may be served by the available Windows web server, but release switching must not expose a partially copied directory.

### Authentication And Authorization

- MVP uses an independent local username/password login and server-issued JWT session.
- Any authenticated administrator may edit and publish directly. Editor/publisher role separation and approval workflow are deliberately deferred.
- Passwords are hashed; bootstrap credentials and JWT secrets are supplied by environment or deployment secret configuration and are never committed.
- Authentication design leaves a standard OIDC extension point for a later Nexus SSO integration, but no Nexus token is accepted in the MVP.

### Product Domain

- Stable, queryable fields are stored as columns: identifier, brand, slug, Chinese name, English name, audience category, system category, series, tagline, status, sort order, SEO title, SEO description and timestamps.
- Variable product content is stored as JSONB under validated schemas: specifications, badges, features and highlights.
- Product assets and documents are separate records associated with products. Asset roles distinguish at least card image, specification image and document.
- Slug is unique within the brand instance and remains immutable after first successful publication unless an explicit redirect strategy is introduced later.
- Published products are soft-disabled or archived instead of physically deleted.
- The website exporter preserves the current public contract, including `en`, `cat`, `sys`, `icon`, `name`, `slug`, `image`, `specs`, `badges`, `series`, `tagline`, `features` and `highlights`.

### API Contract

- Authentication API supports login, current-session lookup and logout.
- Product API supports paged list, detail, create, update, draft delete, status change and sort update.
- Asset API supports validated upload, metadata lookup and association with a product.
- Publish API starts at most one publication for a site at a time and exposes progress, result and logs.
- Release API lists successful releases, identifies the active release and performs rollback.
- Health API reports application, database, persistent storage and publisher readiness without exposing secrets.
- All error responses use a stable error code, human-readable message and correlation identifier.

### Persistent File Storage

- A `StorageProvider` abstraction is mandatory. The MVP implementation stores files on Windows Server disk; a future implementation may use MinIO or another S3-compatible service without changing business logic.
- Upload and release roots are configurable absolute paths outside application binaries and source checkouts.
- Database records store relative object keys and metadata, never machine-specific absolute paths.
- Uploads use temporary files followed by validated finalization. Allowed MIME type, extension, file size and checksum are verified before association.
- Executable content and path traversal are rejected. Download responses use safe content types and filenames.
- Upload and release directories are included in the Windows Server backup plan.

### Publishing And Static Site Generation

- Clicking Publish freezes an immutable content snapshot and assigns a release ID.
- The content snapshot produces a versioned content package containing product data, asset references and a manifest with counts and checksums.
- The Everhot frontend's own build process consumes the package and produces a complete versioned static site. The backend does not assemble page HTML itself.
- Build gates include product schema validation, expected product count, duplicate slug detection, missing asset detection, subtype page generation, GEO/SEO generation and link audit.
- The complete static output is built in a staging release directory. Only a successful, validated directory may become active.
- Windows release switching uses versioned directories and a same-volume current-release pointer, junction or host adapter. Requests must observe either the previous complete release or the new complete release, never a partially copied site.
- A failed content export, frontend build, validation or switch leaves the active release unchanged and records actionable logs.
- The platform retains the latest 3 successful releases. Activating a fourth successful release deletes the oldest inactive successful release only after the new release is verified active.
- Rollback reactivates a retained successful release without rebuilding it and records the operator and result.
- The public website has no runtime dependency on Website Control Plane, PostgreSQL or Nexus.

### Migration And Cutover

- A one-time importer reads all 24 existing products and preserves every supported field and slug.
- Import is idempotent. Running it twice does not create duplicate products or assets.
- Only owned or explicitly authorized production assets may be imported for public release. Existing third-party-branded placeholder images are not production-approved.
- Migration produces a machine-readable report containing source count, imported count, skipped records, validation errors and checksum or semantic comparison results.
- Before cutover, the new platform publishes a candidate static release to a non-production URL or port for data, route and visual acceptance.
- Production cutover changes only the active site target. The previous site remains available as the emergency fallback until post-cutover acceptance completes.

### Windows Server Operations

- Required runtimes, PostgreSQL connectivity, service identities, ports, firewall rules, static host bindings and persistent directories are documented before deployment.
- Services run with least-privilege accounts. The API can write uploads and release working directories; the static host only needs read access to successful releases.
- Start, stop, restart, status and log collection are available through documented PowerShell scripts or Windows service controls.
- Machine restart recovery is part of production acceptance.
- The release switch mechanism must work without Unix-only symlink commands or shell assumptions.

## Testing Decisions

- Tests assert externally visible behavior and contracts rather than implementation details.
- Product domain tests cover unique slug enforcement, required fields, status transitions, ordered JSONB content validation and protection against deleting published records.
- API integration tests run against PostgreSQL and cover login, unauthorized access, CRUD, upload validation, publish concurrency and stable error responses.
- Migration tests import the existing fixture twice and verify exactly 24 products, no duplicates, unchanged slugs and semantic equality of all website fields.
- Storage tests verify allowed uploads, rejected executable/path traversal inputs, checksum recording and persistence across API restart.
- Export contract tests compare generated product objects with the structure consumed by the existing Everhot catalog renderer.
- Publish end-to-end tests start from an admin edit and finish by serving the changed value from the generated static website.
- Failure-injection tests force export, build, validation and switch failures independently and verify the previous active release remains served.
- Rollback tests publish at least two distinct releases, roll back and verify the old content is served without rebuilding.
- Retention tests publish four successful releases and verify only the latest three successful releases remain while the active release is never deleted.
- Static website acceptance covers the homepage, catalog, selector, search, compare, product detail and generated subtype pages.
- Link audit must report no broken internal links or missing production assets.
- Browser smoke tests verify desktop and mobile rendering and compare the extracted site against the current site for unintended visual regressions.
- Runtime dependency testing stops the API and PostgreSQL after a successful publish and verifies the public website still renders product content and images.
- Windows deployment acceptance restarts the machine or all services and verifies login, database records, uploaded files, active site and release history persist.
- Production cutover is complete only after edit, upload, publish, failed-publish protection and rollback have each been observed on the target environment.

## Out of Scope

- Homepage banners, navigation, brand-story pages, footer and unrestricted page CMS.
- Drag-and-drop page building or direct HTML/Markdown source editing.
- Leads, dealers, warranty registration, CRM, orders, service and after-sales workflows.
- Nexus-hosted backend modules, shared Nexus tokens or runtime dependence on Nexus APIs.
- OIDC SSO, editor/publisher role separation, dual approval and Flowable workflows.
- MinIO, OSS, CDN migration or multi-region asset replication.
- A shared multi-brand runtime instance. The platform is reusable code, but each brand is deployed as an independent instance with its own database and storage boundary.
- Mobile management application.
- Rewriting the Everhot public website in React, Next.js or Vue during the MVP extraction.
- Pricing, inventory or other real-time website data.
- Replacement or licensing of missing production product photography; approved assets are a business input and a production go/no-go requirement.

## Further Notes

### Delivery Priority

The MVP is a tracer-bullet product loop. Work that does not contribute to `edit -> upload -> publish -> static website -> rollback` is deferred even if it would be desirable in a mature CMS.

Suggested issue sequence:

1. Extract and baseline the independent Everhot static website.
2. Scaffold the independent Website Control Plane Monorepo and local authentication.
3. Implement PostgreSQL product schema, API contracts and idempotent 24-product importer.
4. Implement disk-backed asset storage and product asset associations.
5. Implement product administration UI and direct publish action.
6. Implement immutable content packages and Everhot static build integration.
7. Implement Windows version switching, 3-release retention and one-click rollback.
8. Add contract, migration, failure-injection and browser end-to-end tests.
9. Create Windows Server deployment and recovery runbook.
10. Deploy candidate, complete go/no-go checks, cut over and verify fallback.

Dependencies: `1 -> 3`, `2 -> 3`, `3 -> 4 -> 5`, `1 + 3 + 4 -> 6 -> 7`, and `5 + 6 + 7 -> 8 -> 9 -> 10`.

### Same-Day Schedule

- 10:00-11:00: independent website extraction and baseline verification.
- 11:00-12:30: control-plane foundation, schema and migration.
- 12:30-14:30: product CRUD, uploads and admin UI.
- 14:30-16:00: static publication, retention and rollback.
- 16:00-16:40: end-to-end and failure acceptance.
- 16:40: production go/no-go decision.
- 16:40-17:30: Windows Server deployment and cutover.
- 17:30-18:00: production smoke test and rollback verification.

This schedule assumes Windows Server access, PostgreSQL, Java 17, Node.js, static hosting, writable persistent disks and approved product assets are available when the corresponding issue begins. Missing server access, database credentials or approved assets moves production cutover out of the schedule but does not block completion of a deployable release package.

### Production Go/No-Go

Production switch is allowed only when all of the following are true:

- 24 products are imported without loss and all existing slugs remain unchanged.
- An administrator can sign in, edit a product, upload an approved image and publish once without server access.
- The generated website passes schema, GEO/SEO and link audits.
- Product list and detail pages serve expected content and no required asset returns 404.
- A forced failed publication leaves the active website unchanged.
- A real rollback changes the served website back to a retained release.
- API and server restart do not lose product data, uploads, active release or release history.
- The legacy static site remains intact and its recovery procedure has been verified.

### Existing Documentation Relationship

Existing Everhot documentation remains useful for brand positioning, static rendering contracts, current product fields, build scripts, GEO/SEO rules and visual acceptance. Statements that require Nexus to own Everhot product data, DAM, authentication or publishing are superseded by this PRD. The independent Website Control Plane becomes the content fact source after cutover; Nexus remains a navigation and business-platform hub.
