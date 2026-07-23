# Brand Site Local Runtime CRUD PRD

Status: ready-for-agent

## Problem Statement

Rhautt Nexus 的品牌官网内容控制台目前还不能让后台修改真正作用到官网运行页面。用户在 `5000` 后台看到“产品 / 其他素材 / 官网上架设置”等入口，但 `5011` Everhot 官网仍未适配后台数据源，导致产品 CRUD、官网上架状态和官网页面展示之间没有形成闭环。

品牌官网管理也缺少清晰的环境地址模型。每个品牌官网都应该能维护并快速打开两个目标地址：`测试环境` 用于本地开发和联调，例如 Everhot 的 `http://localhost:5011/`；`生产环境` 用于正式官网，例如 Everhot 线上域名。后台 CRUD 和预览必须明确当前面向哪个品牌、哪个官网环境，避免只把 `5011` 当成一个写死页面。

## Solution

先实现 Everhot 本地开发闭环：`5000` 品牌官网控制台管理产品资料、官网上架状态和模拟素材；`5011` Everhot 官网在本地开发时读取后台公开官网数据接口，并根据官网货架状态展示产品。

品牌官网控制台显示两个环境地址：

- `测试环境`: 本地开发官网地址，Everhot 第一阶段为 `http://localhost:5011/`。
- `生产环境`: 正式官网地址，Everhot 第一阶段使用品牌站点配置中的生产 URL。

产品区保留当前产品资料列表，并在每个产品行尾部增加一个小按钮/状态控件，用于设置该产品是否上架到当前品牌官网。状态至少包含：

- `已上架`: 产品已发布到当前品牌官网货架。
- `未上架`: 产品存在于产品库，但尚未加入官网货架。
- `已下架`: 产品曾加入官网货架，但当前被隐藏，不在官网展示。

“其他素材”先使用模拟数据展示，覆盖除产品外的官网可替换内容，例如首页主视觉、品牌故事图文、服务 Banner、页脚资质素材。后续再接入真实素材 API。

## User Stories

1. As a brand operator, I want to see the testing and production URLs for the current brand site, so that I can quickly preview local changes and compare them with the live site.
2. As a brand operator, I want Everhot testing URL to point to `http://localhost:5011/`, so that local product changes can be verified against the current 5011 website.
3. As a brand operator, I want the product list to show whether each product is `已上架`, `未上架`, or `已下架`, so that I can understand which products appear on the website.
4. As a brand operator, I want a small row-level button to publish a product to the current brand website, so that I do not need to leave the product area for common shelf decisions.
5. As a brand operator, I want a small row-level button to hide a product from the current brand website, so that removing website visibility is fast and explicit.
6. As a brand operator, I want product CRUD to remain separate from website shelf status, so that editing product data does not automatically publish it to the website.
7. As a brand operator, I want the 5011 website to consume published Everhot products from Nexus in local development, so that refreshing the website reflects backend changes.
8. As a brand operator, I want unpublished or hidden products to be excluded from 5011 website display, so that the website reflects shelf state.
9. As a brand operator, I want the current implementation to focus only on Everhot product CRUD and the local 5011 website loop, so that this phase can finish without expanding to other brands.
10. As a brand operator, I want a `产品 / 其他素材` switch in the website content control area, so that product data and non-product website materials are managed separately.
11. As a brand operator, I want “其他素材” to show simulated website material records first, so that the UI flow can be validated before the real asset API is implemented.
12. As a developer, I want this implementation scoped to Everhot local 5011, so that we can prove and operate the current Everhot product CRUD loop without starting other brand work.

## Implementation Decisions

- This phase is Everhot-only. Keep the code safe for existing brand pages, but do not implement Rheem/Ruud runtime loaders or other brand CRUD work in this PRD.
- Add or expose `测试环境` and `生产环境` fields in the current brand site control panel. Existing `developmentUrl` should map to `测试环境`; existing `productionUrl` should map to `生产环境`.
- Everhot local testing environment must be configured as `http://localhost:5011/` for the first local runtime proof.
- Keep product master data in the product catalog. Product CRUD updates product fields such as name, model, category, images, sort order, and website content metadata.
- Keep website visibility in brand-site product assignments. The row-level website shelf button should create, publish, hide, or reflect assignment state for the current brand site.
- The product row must display website shelf state independently from product catalog status. Catalog status such as active/inactive is not the same as website shelf state.
- Add a local public website data endpoint for the brand site runtime. For Everhot, the 5011 site should request only products published for the Everhot website.
- The public website data endpoint must not expose internal-only product fields such as costs or privileged metadata.
- The 5011 website should prefer the local runtime API during development and fall back to current static generated product data when the API is unavailable.
- The “其他素材” tab remains simulated in this PRD. It should model the categories of non-product website content without claiming production DAM integration.
- Existing route ownership and `/api/v2/*` conventions must be preserved for production APIs.

## Testing Decisions

- Add or update a focused backend contract test proving that the public brand-site product endpoint returns only products that are published to the current brand website.
- Add or update a frontend test for the brand site control panel showing the `测试环境` and `生产环境` address labels and their quick-open links.
- Add or update a frontend test for product row shelf states: `已上架`, `未上架`, and `已下架`.
- Add or update a frontend interaction test proving the row-level shelf button calls the brand-site assignment API rather than only changing local UI state.
- Add a 5011 local runtime smoke test proving the Everhot website can render products from the local public endpoint and fall back to static data if the endpoint is unavailable.
- Run the narrowest relevant gate first for this feature: dealer-workbench build, product/brand-site contract tests, then any existing product or website readiness gate if touched.

## Out of Scope

- Real production publishing to the live Everhot domain.
- Full DAM-backed implementation for non-product materials.
- Rheem/Ruud or any other brand runtime integration.
- Real product CRUD for brands other than Everhot.
- Replacing the existing static generation pipeline entirely.
- Security, approval workflow, rollback system, or operator audit expansion beyond existing project behavior.

## Further Notes

This PRD intentionally separates three concepts:

- Product exists in the product catalog.
- Product is active/inactive as catalog data.
- Product is visible/hidden on a specific brand website.

The first implementation should prove the local loop for Everhot 5011: update or assign in `5000`, refresh `http://localhost:5011/`, and observe website-visible product changes.
