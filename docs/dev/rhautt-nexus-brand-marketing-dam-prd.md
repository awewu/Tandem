# Rhautt Nexus Brand Marketing DAM Extraction PRD

## Status

- Date: 2026-07-22
- Triage label: `ready-for-agent`
- Repository: `D:\Project\Red\rhautt_comfort`
- Remote: `http://192.1.1.208:8088/E01088/rhautt_comfort.git`
- Product name: **Rhautt Nexus / 瑞合数智枢纽**
- Customer / group positioning: **Rhautt Comfort / 瑞合瑞德暖通科技集团**
- Phase: Phase 1 independent repository reduction and product boundary clarification

## Problem Statement

当前 `enterprise_website` 中的 Rhautt Nexus 同时承载了品牌厂家、营销资料中台、客户赋能、AI 问诊、CRM、BIM 设计、交付、项目进度、售后、客户入口等多组团能力。随着后续产品化推进，这种大一统代码和入口会带来几个问题：

1. 品牌/厂家/营销资料中台与 CRM 客户赋能系统的开发节奏不同，继续混在同一套代码里会互相牵制。
2. 用户进入系统后会看到过多非当前系统目标的功能入口，影响品牌方、市场部门、产品资料运营人员的使用效率。
3. 后端 API、权限、菜单、数据模型混杂，后续独立部署、独立维护和独立验收成本高。
4. 如果第一阶段就抽共享账号、共享权限、共享文件存储或共享产品基础数据，会把拆分变成底座工程，拖慢品牌/厂家/营销资料中台的落地。

因此需要在 `D:\Project\Red\rhautt_comfort` 中把系统裁剪成一个独立的 Rhautt Nexus 品牌/厂家/营销资料中台，同时保留完整登录、账号、权限和后台开户能力。

## Solution

以当前复制出的 `rhautt_comfort` 仓库作为独立系统起点，采用“完整复制后做减法”的方式完成 Phase 1：

1. 保留软件平台品牌为 **Rhautt Nexus / 瑞合数智枢纽**。
2. 保留 **Rhautt Comfort / 瑞合瑞德暖通科技集团** 作为集团客户、门户和旗舰实例定位，不把它替换成软件系统名。
3. 保留完整登录界面、账号体系、角色权限体系、后台开户、账号启停、密码重置和当前认证会话能力。
4. 保留组团一“品牌厂家功能组”相关能力，形成品牌/厂家/营销资料中台。
5. 删除或隐藏组团二、组团三、组团四中与品牌/厂家/营销资料中台无关的业务入口。
6. 账号、权限、文件存储、产品基础数据均由该仓库自己的前后端维护，不抽共享服务，不依赖 CRM 仓库的 SDK 或共享数据库。
7. 第一阶段优先完成可独立启动、独立登录、独立访问、独立提交和独立部署的最小闭环，再逐步清理深层后端冗余模块。

目标不是重写系统，而是在新仓库中把现有 Rhautt Nexus 能力裁剪为一个边界清晰的品牌厂家营销资料中台。

## Product Boundary

### In Scope

Rhautt Nexus 品牌/厂家/营销资料中台应包含以下能力：

1. 登录与认证
2. 当前用户会话
3. 账号管理
4. 角色与权限管理
5. 品牌运营控制台
6. 产品库
7. 产品目录
8. 产品资料管理
9. DAM 素材库
10. 内容资产管理
11. 市场物料管理
12. 品牌产品库
13. 品牌官网管理
14. 上新 / 发布
15. 发布到站点
16. 市场营销 / 增长引擎
17. GEO 可见度
18. 文案 Copilot
19. 舆情雷达
20. 营销自动化
21. 运营中枢首页，只展示品牌/厂家/营销资料中台相关模块

### Must Stay Visible

以下入口必须在独立系统中保留可用：

1. Rhautt Nexus 登录页
2. Rhautt Nexus Hub / 工作台首页
3. 组团一品牌厂家功能组入口
4. 品牌运营控制台
5. 市场营销 / 增长引擎
6. 产品目录
7. 品牌官网
8. 品牌与市场中枢
9. 账号管理入口

### Must Be Removed Or Hidden In Phase 1

以下能力第一阶段不作为 `rhautt_comfort` 的可见产品功能：

1. AI 问诊获客
2. 舒适家 CRM + 交付
3. 技术 BIM 设计
4. CRM 漏斗
5. 方案设计
6. BIM 交付
7. 项目进度
8. 经营分析
9. 财务
10. 售后
11. 团队管理
12. 客户入口
13. 项目护照
14. 终端客户自助查看进度
15. 与 CRM 客户系统定位绑定的设计、报价、合同、施工、验收、生命周期 IoT 能力

这些功能后续归入 `D:\Project\Red\rhautt_crm` 对应的 CRM 客户系统仓库。

## User Stories

1. As a Rhautt Nexus user, I want to see the software name remain Rhautt Nexus, so that the system identity stays consistent with the existing platform positioning.
2. As a Rhautt Comfort headquarters user, I want to log in through the existing login page, so that I can continue using familiar account credentials.
3. As a platform admin, I want account creation, disabling, role assignment, and password reset to remain available, so that the independent system can operate without relying on another repository.
4. As a brand operator, I want a brand operations console, so that I can manage brand content, product positioning, materials, and publication status from one place.
5. As a product data operator, I want to manage the product library, so that product models, categories, specifications, images, and sales materials stay accurate.
6. As a marketing operator, I want a DAM素材库, so that images, documents, campaign assets, website materials, and product media can be centrally managed.
7. As a marketing operator, I want market material DAM and brand product library features, so that marketing content can be reused across campaigns and brand sites.
8. As a content operator, I want publication workflows, so that approved product and marketing content can be published to the corresponding brand site.
9. As a marketing manager, I want GEO visibility, copy Copilot, sentiment radar, and marketing automation entries, so that growth work remains part of the marketing system.
10. As a headquarters user, I want unrelated CRM, AI diagnosis, BIM, delivery, after-sales, and customer portal entries removed from the hub, so that the system is focused and easy to navigate.
11. As a developer, I want `rhautt_comfort` to be an independent Git repository, so that Rhautt Nexus brand marketing work can evolve without affecting CRM customer system development.
12. As a backend developer, I want this repository to own its own auth, permissions, file storage, product data, and APIs, so that it does not depend on shared services or shared SDKs.
13. As a release owner, I want the system to start and pass focused smoke checks after reduction, so that deletion does not break login or retained brand modules.
14. As a future CRM developer, I want CRM-related code to be removed from the visible Rhautt Nexus brand system, so that the CRM repository has a clean separate product direction.

## Functional Requirements

### Login And Account Permissions

1. The system must keep the existing Rhautt Nexus login page available as the primary entry.
2. The system must keep the existing password login flow unless a later PRD replaces it.
3. The system must keep current session validation through the existing auth/me style behavior.
4. The system must keep account administration for creating users, assigning roles, enabling or disabling users, and resetting passwords.
5. The system must keep role-based access control for retained pages and APIs.
6. Removing CRM/BIM/customer functionality must not remove permissions required by retained brand, product, DAM, marketing, and account-management modules.
7. If a retained page depends on a generic admin permission, that permission may remain even if the old label references platform operations, but the visible UI copy should be adjusted in later cleanup.

### Hub And Navigation

1. The hub must present Rhautt Nexus as the software platform name.
2. The hub must show only the brand/厂家/营销资料中台 product modules plus account management.
3. The hub must not show group two customer enablement modules in the Rhautt Comfort repository.
4. The hub must not show group four customer entrance modules in the Rhautt Comfort repository.
5. Platform operations entries unrelated to account and permission management must be hidden in Phase 1.
6. The first visible workbench after login should orient the user around brand operations, product materials, DAM, and marketing publication.

### Brand / Manufacturer / Marketing Modules

1. Brand operations console must remain accessible.
2. Product library and product catalog capabilities must remain accessible.
3. DAM / asset library capabilities must remain accessible.
4. Brand website management and publication capabilities must remain accessible.
5. Brand and market center capabilities must remain accessible.
6. Marketing growth features should remain as module entries even if some subfeatures require later backend hardening.
7. Retained modules must not deep-link to removed CRM/BIM/customer pages.

### Backend And API Ownership

1. Retained production APIs should stay under `/api/v2/*` where production code already follows that direction.
2. New business logic must be implemented in the existing target module direction instead of adding new inline business routes to the production entry.
3. Route ownership must remain declared for retained routes.
4. APIs used only by removed CRM/BIM/customer modules should be removed, disabled, or left unreachable from active navigation during Phase 1.
5. Backend cleanup should proceed in layers: first remove active UI reachability, then remove unused API contracts, then remove unused modules after focused tests prove no retained feature depends on them.

### Data Ownership

1. `rhautt_comfort` owns its own users, roles, permissions, files, products, content assets, marketing assets, publication records, and brand site data.
2. `rhautt_comfort` must not depend on `rhautt_crm` for shared auth, shared permission checks, shared product data, shared DAM, or shared storage.
3. A future data migration may duplicate records between systems, but no shared database table is required by this PRD.
4. Product library data in this system is the brand/marketing source of truth for content and materials, not the CRM quote or delivery source of truth.

## Implementation Decisions

1. Use `D:\Project\Red\rhautt_comfort` as the independent Rhautt Nexus brand/marketing repository.
2. Keep the software platform name as Rhautt Nexus / 瑞合数智枢纽 across product UI, docs, and release language.
3. Treat Rhautt Comfort / 瑞合瑞德暖通科技集团 as the customer/group instance positioning and not as the software product name.
4. Do not create shared auth, shared permission, shared file storage, shared product-data services, or shared SDKs between `rhautt_comfort` and `rhautt_crm` in Phase 1.
5. Start reduction from active front-end navigation and hub modules because that is the fastest way to prevent users from entering out-of-scope workflows.
6. Preserve account management even though it originally appears in platform operations, because this independent system must be able to manage its own users and permissions.
7. Keep relevant brand-console, product-catalog, public brand site, content, asset, and marketing capabilities as the retained domain surface.
8. Remove or hide dealer CRM, consumer diagnosis, designer workbench, Rysnova BIM, customer portal, and lifecycle/customer project surfaces from active Rhautt Nexus brand-system navigation.
9. Deeper backend removal should follow dependency evidence, not broad deletion. A module can remain in code temporarily if it is unreachable from active navigation and still needed for build stability.
10. Initial PRD success is defined by a focused independent system boundary, not by perfect repository minimalism on day one.

## Testing Decisions

1. Test retained external behavior, not internal deletion counts.
2. Verify login page loads and authenticates with the existing auth flow.
3. Verify account management remains reachable for authorized admin roles.
4. Verify the hub no longer displays CRM, AI diagnosis, BIM, delivery, after-sales, and customer portal modules.
5. Verify retained brand/marketing/product/DAM entries still open their target pages.
6. Verify retained pages do not call missing backend routes.
7. Run route ownership checks for retained `/api/v2/*` routes.
8. Run frontend API contract checks after navigation cleanup.
9. Run production readiness tests after any backend module deletion.
10. If visual navigation is changed, run browser visual guard or a focused Playwright smoke for the hub and login page.

Expected verification commands after implementation:

- `npm run test:production-readiness`
- `npm run guard:frontend-api-contract`
- `npm run guard:routes`
- `npm run harness:arch`
- Optional visual check after UI changes: `ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual`

## Acceptance Criteria

1. `D:\Project\Red\rhautt_comfort` is an independent Git working tree with the Rhautt Comfort remote bound.
2. The product UI continues to identify the software platform as Rhautt Nexus / 瑞合数智枢纽.
3. Users can reach and use the login page.
4. Authenticated users can reach the Rhautt Nexus hub.
5. Authorized administrators can reach account management and perform account/role/permission maintenance flows supported by the current implementation.
6. The hub displays brand/厂家/营销资料中台 modules and account management.
7. The hub does not display customer赋能三件套, AI 问诊获客, CRM, BIM, project delivery, after-sales, or customer portal modules.
8. Product library, product catalog, DAM/material library, brand website, market center, and marketing growth entries remain visible.
9. Retained entries do not navigate to removed CRM/BIM/customer pages.
10. No new shared service or shared SDK is introduced between `rhautt_comfort` and `rhautt_crm`.
11. Focused verification commands are run and reported honestly before implementation is claimed complete.

## Out Of Scope

1. Naming the future CRM customer system.
2. Implementing or cleaning `D:\Project\Red\rhautt_crm`.
3. Building shared account, permission, storage, product-data, or DAM services.
4. Migrating to a common monorepo package strategy.
5. Rewriting the entire backend into a minimal new service in Phase 1.
6. Replacing existing login with a new identity provider.
7. Full visual redesign of retained brand/marketing modules.
8. Full removal of every unused file or historical archive from the repository.
9. CRM quote, contract, construction, acceptance, lifecycle IoT, and BIM feature delivery.
10. Publishing or pushing the new repository to remote without explicit release approval.

## Rollout Plan

### Phase 1A: Repository Baseline

1. Keep `rhautt_comfort` as the independent repository.
2. Confirm remote binding.
3. Confirm local secrets, SSL keys, dependency folders, and build artifacts are not committed.
4. Make an initial repository baseline commit only after review and approval.

### Phase 1B: Active Navigation Reduction

1. Update the hub to show only Rhautt Nexus brand/厂家/营销资料中台 modules and account management.
2. Hide group two, unrelated group three entries, and group four entries.
3. Ensure retained links resolve correctly.

### Phase 1C: Retained Domain Hardening

1. Verify brand console, product catalog, product library, DAM, market center, website management, and publication flows.
2. Fix missing route ownership or API contract gaps for retained modules.
3. Remove deep links into CRM/BIM/customer workflows.

### Phase 1D: Backend Reduction

1. Identify APIs and backend modules used only by removed visible surfaces.
2. Remove or disable unreachable modules only after tests show retained modules do not depend on them.
3. Keep auth, user, role, permission, file, product, DAM, marketing, and publication APIs owned by this repository.

### Phase 1E: Verification And Remote Publication

1. Run focused verification gates.
2. Commit the reduced Rhautt Nexus brand/marketing system.
3. Push to `rhautt_comfort.git` only after explicit approval.

## Further Notes

This PRD intentionally chooses independence over shared infrastructure. Duplication between `rhautt_comfort` and `rhautt_crm` is acceptable in Phase 1 because the main product risk is unclear system ownership, not duplicated code.

The first implementation should avoid large rewrites. The correct early move is to reduce active navigation, preserve login and account permissions, keep retained brand/marketing workflows usable, and then clean deeper backend and repository layers with evidence.
