# brand-registry 模块 — 配置驱动的品牌注册表 API

> 目的：为 Rhautt 集团**持续新增更多品牌**预留统一模式。品牌基础要素（命名 / VI / NAP /
> 外链 / 交付方式）以**唯一事实源** `brand-registry.json`（仓库根）承载；本 API 只读暴露，
> 各品牌站与后台 `apps/brand-console` 消费，**禁止在前端硬编码品牌要素**。

## 与既有 `brand` 模块的区别
- `modules/brand`：Rheem 官网**内容抓取器**（news/products/trainings），auth 保护。
- `modules/brand-registry`（本模块）：**品牌注册表读取**，公开只读。

## 端点（全局前缀 `/api/v2`）
| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/v2/brands` | 品牌清单（摘要）+ 供应商元数据。支持 `?type=` `?selfBuilt=` 过滤 | 公开 |
| GET | `/api/v2/brands/_meta` | 治理元数据（供应商定位 / 已决 / 待决） | 公开 |
| GET | `/api/v2/brands/:slug` | 单品牌完整要素（fundamentals / VI / NAP / 外链） | 公开 |
| POST | `/api/v2/brands/reload` | 改注册表文件后强制重载缓存 | AuthGuard |
| GET/POST | `/api/v2/brand-sites/:siteCode/product-assignments` | 管理网站产品货架 | AuthGuard + RBAC |
| PATCH/DELETE | `/api/v2/brand-sites/:siteCode/product-assignments/:id` | 更新或归档货架项 | AuthGuard + RBAC |
| POST | `/api/v2/brand-sites/:siteCode/product-assignments/:id/publish` | 发布货架项 | AuthGuard + RBAC |
| POST | `/api/v2/brand-sites/:siteCode/product-assignments/:id/hide` | 下架货架项 | AuthGuard + RBAC |
| GET | `/api/v2/sites/:siteCode/products` | 网站公开产品列表 | 公开、限流、脱敏 |
| GET | `/api/v2/sites/:siteCode/products/:publicSlug` | 网站公开产品详情 | 公开、限流、脱敏 |

响应字段来源即 `brand-registry.json`；未提供的业务/法务信息以 `__TODO(...)__` 占位，前端应
渲染占位而非杜撰。

## 新增一个品牌（标准流程 · 零改代码）
1. 在 `brand-registry.json` 的 `brands[]` 增加一条，至少包含：
   `slug` `name_cn` `name_en` `domain` `type` `delivery` `selfBuilt` `app`
   `fundamentals.vi`（`tokenCss` + `primary`）`crossLinks`。
2. 新建 `packages/tokens/<slug>.css`（VI token，须与注册表 vi 值一致）。
3. 如为自建站：新建 `apps/<slug>/`，页面从 `/api/v2/brands/<slug>` 取要素渲染。
4. `POST /api/v2/brands/reload`（或等缓存过期）→ 品牌即出现在 `/api/v2/brands`。

## 路径解析
默认从进程 cwd / 模块目录逐级向上查找仓库根的 `brand-registry.json`；
容器/非常规部署可用环境变量 `BRAND_REGISTRY_PATH` 显式指定。

## 网站货架运行配置

公开网站 API 只连接 NestJS 后端，前端不得连接 PostgreSQL。后端通过
`SITE_<SITE_CODE>_TENANT_ID` 解析站点所属租户，例如集团站使用
`SITE_RHAUTT_GROUP_TENANT_ID`。未设置 `SITE_` 前缀时，兼容读取
`<SITE_CODE>_TENANT_ID`。数据库连接信息只允许存在于后端运行环境。
