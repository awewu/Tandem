# Everhot 后台落地方案（Nexus 对齐版）

> 状态：待批准执行 · 草案 v1
> 上级事实源：`PROJECT-CHARTER` > `PRD-v2` > `CLAUDE.md`；架构事实源：`docs/RHAUTT-NEXUS-REARCH-BLUEPRINT.md` + `docs/RHAUTT-NEXUS-MANAGEMENT-HUB.md` + `platform-modules.json`。本文若与上级冲突，以上级为准。
> 用途：把"Everhot 官网内容/图片/新闻可在网页后台管理，公网站实时读 API"落到 Nexus 平台上的**唯一实施事实源**。
> 选定路线：**公网站实时读 `/api/v2/*`（Option C）** + **后台并入 `nexus-console` 管理中枢**（hub §8 小团队推荐，待最终拍板，见 §12）。

---

## 0. 决策摘要（先读这一节）

| 维度 | 决策 | 依据 |
|---|---|---|
| 公网站取数 | **运行时读 `/api/v2/*`**，带**静态兜底** | 用户选 C；解耦铁律"应用经领域服务取数，不直连库" |
| 后台位置 | 并入现有 **`apps/nexus-console`**（Everhot 品牌管理模块） | hub §8 小团队推荐；`nexus-console` 已是控制台 + 已有 `backendFetch`/httpOnly cookie |
| ~~dealer-workbench~~ | **作废**：Everhot 内容不放 `dealer-workbench`（板块二 CRM） | 蓝图铁律：板块二不得管板块一资产 |
| 数据库 | **PostgreSQL**（schema `rhautt_nexus`，curated SQL 迁移） | `database/postgres/migrations/` 既有；`data-source.ts` 锁定 PG |
| 后端 | 现有 **`services/api`（NestJS+Fastify）** 立起来 | 已含 `product-catalog`/`file-artifact`/`auth`/`tenant`/`brand` 模块（source-contract-ready） |
| 图片/物料 | 走 **`file-artifact`（DAM）** 域 | hub §3：物料存储走 file-artifact/对象存储 |
| 品牌隔离 | `tenant_id` + `brand='everhot'` 维度 | `ProductEntity` 已自带 `tenantId`；多租户 RLS |

**关键认知**：选 C 不是"加个轻量后台"，而是**把 Nexus 后端平台跑起来**（装依赖 + 接 PG + 认证收敛）。这是地基，绕不开。

---

## 1. 现状事实（已核验，含文件出处）

**公网站 `apps/everhot-cn`（纯静态）**
- 产品数据：`public/js/products-data.js` → `window.EVERHOT_PRODUCTS`（注释已写明"后台/API 上线后用同结构替换即可"）。
- 字段约定：`slug, name, en, series, cat(residential|commercial), sys(water-heating|heating-cooling), icon, image, tagline, badges[], highlights[{label,value}], features[{title,desc}], specs[{k,v}], certs[], faqs[{q,a}]`。
- 渲染：`public/js/catalog.js` 全程读 `window.EVERHOT_PRODUCTS` / `window.EVERHOT_CATALOG`（**当前无任何 fetch**）。
- 图片：`window.EVERHOT_PRODUCT_IMAGES`（`product-images.js`）+ `data/product-image-manifest.json`，回退 `icon`。
- 新闻：**硬编码在 `public/index.html` `#news`**（无数据源）。

**后端 `services/api`（NestJS + Fastify，source-contract-ready，未装依赖/未跑）**
- 已注册模块（`src/modules/app.module.ts`）：`auth, tenant, crm, diagnosis, product-catalog, quote, design, rysnova-bim, brand, compliance, mdm, analytics, delivery, lifecycle, file-artifact, governance, notification, workflow`。
- 全局前缀 `api/v2`（`src/main.ts`），端口默认 `3300`。
- `product-catalog`：
  - `ProductEntity`（表 `products`）：`id, tenant_id(默认 rhautt_shared), sku, name, brand, category, spec(jsonb), list_price, cost_price, currency, status, meta(jsonb), 时间戳`；唯一索引 `(tenant_id, sku)`。
  - 端点：`GET /product-catalog/devices`、`GET /product-catalog/devices/:id`、`POST /product-catalog/devices`（**均 `AuthGuard` 保护**）。
  - 偏**经销商/CRM 目录**（含价格/价目表），**缺官网营销字段**（slug/tagline/features/faqs/highlights/图片）。
- `file-artifact`（DAM）：`POST /file-artifact/upload`（multipart，`entityType`/`entityId` query）、`GET /file-artifact`、删除/下载；`AuthGuard` 保护。
- `brand`：`GET /brand`、`POST /brand/sync`（service/controller，无 entity）。
- 数据库：`src/data-source.ts` → PG，schema `rhautt_nexus`，`synchronize:false`，迁移由 `scripts/db/apply-migrations.js` 执行 curated SQL（现有 `001_core_ledger / 002_compliance_mdm_designsync / 003_quotation_price_snapshot`）。

**管理控制台 `apps/nexus-console`（真 Next.js app）**
- `src/lib/api.ts`：`backendFetch()` → NestJS `:3300` + `/api/v2`，JWT 存 **httpOnly cookie `nx_token`**，后端不可达时优雅降级。
- 已有 `Sidebar / SessionBar / LiveHealth / Panel` 等组件与 `boards.ts`。

---

## 2. 目标架构与数据流

```
[浏览器/公网访客]
   │ 1) 运行时 GET（只读、公开、按 brand=everhot 过滤）
   ▼
apps/everhot-cn (静态)  ──fetch──▶  /api/v2/public/everhot/*   ◀── 静态兜底(products-data.js)
                                          │ (CDN 缓存 + 无需登录)
[运营/管理员]                              ▼
apps/nexus-console ──backendFetch(JWT)──▶ services/api (NestJS, :3300, /api/v2)
   (Everhot 品牌管理模块)                   ├─ product-catalog / brand-content 域（营销产品模型）
                                          ├─ file-artifact 域（图片/物料 DAM）
                                          ├─ auth / tenant（多租户 RLS）
                                          ▼
                                   PostgreSQL  schema rhautt_nexus（③品牌运营库）
```

**解耦铁律落地**：`everhot-cn` 与 `nexus-console` 都**不直连数据库**，只经 `/api/v2/*`；公网读走**公开只读端点**，后台写走**鉴权端点**。

---

## 3. 领域模型（差距分析 + 新增）

`ProductEntity` 不足以承载官网营销内容。两种方案：

- **方案 A（推荐）**：新增 **`brand-content` 领域**（独立于 CRM 目录），承载官网富内容，与 `product-catalog`（价格/SKU/CRM）**解耦但可经 `sku`/`slug` 关联**。
- 方案 B：扩展 `ProductEntity.meta(jsonb)` 塞营销字段（快但脏，混淆 CRM 与营销边界，不利演进）。

### 3.1 新表（schema `rhautt_nexus`，方案 A）

`brand_products` — 官网营销产品
```
id            uuid pk
tenant_id     text  not null            -- 多租户隔离
brand         text  not null            -- 'everhot'（品牌维度）
slug          text  not null            -- 详情页 ?model=slug
name          text  not null
en            text
series        text
cat           text  -- residential|commercial
sys           text  -- water-heating|heating-cooling
tagline       text
badges        jsonb default '[]'        -- string[]
highlights    jsonb default '[]'        -- [{label,value}]
features      jsonb default '[]'        -- [{title,desc}]
specs         jsonb default '[]'        -- [{k,v}]
certs         jsonb default '[]'        -- string[]
faqs          jsonb default '[]'        -- [{q,a}]
hero_media_id uuid  -> brand_media.id   -- 主图（DAM）
sku           text                      -- 可空，关联 CRM products.sku
status        text default 'draft'      -- draft|published|archived
sort_order    int  default 0
seo           jsonb default '{}'        -- {title,description,jsonld}
created_at / updated_at / published_at
unique (tenant_id, brand, slug)
```

`brand_media` — 官网媒资（薄封装，引用 file-artifact）
```
id            uuid pk
tenant_id / brand
artifact_id   uuid  -> file-artifact.entity（真实文件）
url           text                       -- 公开可读 URL（CDN/对象存储）
alt           text
kind          text  -- product|news|hero|gallery
created_at
```

`brand_news` — 官网新闻
```
id / tenant_id / brand
slug          text
title         text
summary       text
body          text (markdown/html)
cover_media_id uuid -> brand_media.id
date          date
status        text default 'draft'
created_at / updated_at / published_at
unique (tenant_id, brand, slug)
```

> 图片本体仍由 `file-artifact`（DAM）存储/版本；`brand_media` 只做"官网投放视图 + 公开 URL"映射，符合 hub §3"物料存储走 file-artifact"。

### 3.2 与现有 `products-data.js` 字段一一对应
新表字段刻意**复刻** `EVERHOT_PRODUCTS` 字段名，使**前端渲染零改动**（仅把数据来源从 `window.EVERHOT_PRODUCTS` 换成 fetch 结果）。

---

## 4. API 契约（`/api/v2`）

### 4.1 公开只读（无需登录，供 `everhot-cn` 运行时调用）
```
GET /api/v2/public/everhot/products            -> { items:[ {slug,name,...,image} ] }   # status=published
GET /api/v2/public/everhot/products/:slug      -> { ...product, media:[...] }
GET /api/v2/public/everhot/news                -> { items:[ {slug,title,summary,date,cover} ] }
GET /api/v2/public/everhot/news/:slug          -> { ...news }
```
- 强制 `tenant_id` + `brand='everhot'` + `status='published'`；仅返回前端所需字段（不泄露价格/成本）。
- 响应可缓存（`Cache-Control` + ETag），便于 CDN。

### 4.2 后台读写（`AuthGuard` + RBAC，供 `nexus-console`）
```
GET    /api/v2/brand-content/everhot/products            # 含 draft
POST   /api/v2/brand-content/everhot/products            # 新建/更新（upsert by slug）
PATCH  /api/v2/brand-content/everhot/products/:id
DELETE /api/v2/brand-content/everhot/products/:id
POST   /api/v2/brand-content/everhot/products/:id/publish
... 同形 news ...
POST   /api/v2/file-artifact/upload?entityType=brand_media&entityId=<slug>   # 已存在，复用
GET    /api/v2/file-artifact?entityType=brand_media&entityId=<slug>
```

### 4.3 鉴权/CORS
- 公开端点：允许 `everhot.com.cn` 跨域（CORS 白名单），匿名。
- 后台端点：`nexus-console` 经 `backendFetch` 带 httpOnly cookie `nx_token` → Bearer（BFF 注入）。

---

## 5. 数据库迁移计划

新增 curated SQL（沿用现有约定，**不**用 TypeORM synchronize）：
```
database/postgres/migrations/004_everhot_brand_content.sql
  - CREATE TABLE rhautt_nexus.brand_products / brand_media / brand_news
  - 索引：unique(tenant_id,brand,slug)；index(brand,status)
  - RLS：启用行级安全，按 current_tenant_id()（沿用 001 的 tenant 函数）
  - 触发器：updated_at
```
执行：`node scripts/db/apply-migrations.js`（与现有 001–003 同链路）；RLS 验证用 `scripts/db/rls-apply-proof.js`。

---

## 6. 公网站接入（`everhot-cn`）

**改动点（小而隔离）**：
1. 新增 `public/js/data-source.js`：
   - 启动时 `fetch('/api/v2/public/everhot/products')`；成功 → 写 `window.EVERHOT_PRODUCTS`；失败/超时 → **保留 `products-data.js` 静态兜底**。
   - 同理新闻：成功则用 API 渲染 `#news`，失败用现硬编码。
2. `catalog.js` 渲染逻辑**不动**（已读 `window.EVERHOT_PRODUCTS`），仅确保数据就绪后再渲染（Promise/事件）。
3. 配置 API 基址（`window.EVERHOT_API_BASE`），dev 指向 `:3300`，prod 指向网关域。

**SEO 取舍（C 的代价）**：纯客户端 fetch 对 SEO 不友好。三选一（建议先 b）：
- a) 公开端点 + CDN 缓存，配 `prerender`/SSG 快照；
- b) **构建期预取**：`everhot-cn` 构建时拉 API 写入 `products-data.js`（兼顾静态 SEO + 后台可管），运行时再增量刷新；← 推荐折中
- c) 后续把 `everhot-cn` 升级为 SSR/Next（重，暂不做）。

---

## 7. 后台 UI（`nexus-console` 内 Everhot 品牌管理模块）

- 路由：`/brand/everhot/products`（列表/搜索/状态筛选）、`/brand/everhot/products/[slug]`（编辑：基础信息 + highlights/features/specs/faqs 动态表单 + 图片上传 + 预览 + 发布）、`/brand/everhot/news`。
- 复用：`backendFetch`、`Sidebar/Panel/SessionBar`、httpOnly cookie 鉴权。
- 图片：拖拽上传 → `file-artifact/upload` → 落 `brand_media` → 选为 `hero_media_id`/gallery。
- 操作：保存草稿 / 预览（指向公开端点 draft 预览模式）/ 发布 / 归档。
- 菜单按 RBAC（品牌运营角色可见板块一）。

---

## 8. 认证 / RBAC（P0 强依赖）

hub §7、admin-console 迁移 §5 已定：**先做 P0 认证收敛**（NestJS 单一认证 + 全局 Guard + RBAC + 租户范围）再上后台，否则放大安全面。
- 角色：`platform_admin/hq_admin`（全可见）、品牌运营（仅板块一）、平台运维（仅板块二）。
- Everhot 模块需要：品牌运营角色 + `tenant_id` 范围校验。

---

## 9. 部署与基建

- **PostgreSQL**：本地 docker 或托管实例；env：`DATABASE_URL` 或 `POSTGRES_HOST/PORT/USER/PASSWORD/DB`（见 `data-source.ts`）。
- **services/api**：补 `package.json`/装依赖 → `npm run build/start` 监听 `:3300`；跑迁移；健康检查 `GET /api/v2/health`（`HealthController` 已在）。
- **nexus-console**：env `NEXUS_API_URL`/`NEXUS_API_PREFIX`；部署为内部 admin。
- **everhot-cn**：静态托管 + CDN；网关把 `/api/v2/public/*` 反代到 services/api，并配 CORS。
- 容器编排/可观测/guard：纳入既有 governance 链路（后续）。

---

## 10. 种子迁移（现有数据 → DB）

一次性脚本：解析 `apps/everhot-cn/public/js/products-data.js` → upsert 到 `brand_products`（brand='everhot', status='published'）；把 `data/product-image-manifest.json` / `assets/img/products/*` 导入 `file-artifact` + `brand_media`，回填 `hero_media_id`。新闻从 `index.html #news` 抽取为 `brand_news` 初始 3 条。

---

## 11. 里程碑（每阶段可独立验收）

| 阶段 | 内容 | 验收 |
|---|---|---|
| **A 地基** | services/api 装依赖+接 PG+跑 001–003 迁移；P0 认证收敛 | `GET /api/v2/health` 200；登录拿到 JWT；越权用例通过 |
| **B 领域** | 写 `004` 迁移 + `brand-content` 域（实体/服务/控制器）+ 公开只读端点 | 种子后 `GET /public/everhot/products` 返回真实数据 |
| **C 后台** | `nexus-console` Everhot 模块：列表/编辑/图片上传/发布 | 后台改字段+传图+发布 → 公开端点即变 |
| **D 公网站** | `everhot-cn` 接 API + 静态兜底（+构建期预取做 SEO） | 断网回退静态；联网读 API；详情页/新闻一致 |

依赖顺序：A → B →（C ∥ D）。

---

## 12. 风险与待你拍板

- **后台形态（hub §8 开口）**：并入 `nexus-console`（本方案默认，省事）vs 新建独立 `apps/brand-console`（蓝图更纯粹）。
- **SEO**：选 C 后，是否采用 §6-b"构建期预取"折中（推荐）。
- **基建**：是否现在提供/部署 PostgreSQL 实例（A 阶段前置硬依赖）。
- **认证 P0**：是否先做认证收敛（强依赖，影响排期）。
- **Everhot 红**：`#E4002B`(token) vs `#C8102E`/`#BF1924`（与现站点，蓝图 §8 仍开口）——影响 VI token，不影响后端，但建议同期定。

> 拍板上述 5 项后，从**里程碑 A** 开第一刀。
