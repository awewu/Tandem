# Everhot 后台接入 Rhautt Nexus 设计方案

> 状态：待评审（设计阶段，不含实现代码） · 2026-06-29
> 事实源对齐：`platform-modules.json` · `docs/RHAUTT-NEXUS-REARCH-BLUEPRINT.md` · `docs/RHAUTT-NEXUS-MANAGEMENT-HUB.md` · `docs/DATABASE-BACKEND-ARCHITECTURE.md` · `database/postgres/migrations/001_rhautt_nexus_core_ledger.sql`
> 决议：Everhot 的"后台"接入 Nexus 共享底座（板块一·品牌运营库 ③ + DAM/file-artifact），**废弃独立 SQLite**。

---

## 1. 背景与结论

### 1.1 发现
- Everhot 是**板块一·Rhautt 品牌管理**下的**自建独立品牌站**（`apps/everhot-cn`，域名 `everhot.com.cn`，基路径 `/everhot`），当前为**纯静态站**（`scripts/serve.js --port 4011`），`data/` 下仅有图片清单 JSON，**无运行时数据库**。
- 产品数据现存于前端可替换层 `apps/everhot-cn/public/js/products-data.js`（`window.EVERHOT_PRODUCTS`），文件头已明确"后台/API 上线后只需用同结构数据替换"。
- Nexus 已具备目标底座：`product-catalog` 领域服务（`ProductEntity` 已是 tenant-aware）+ `file-artifact`（DAM/对象存储）+ PG 多租户 RLS 账本（target contract）。

### 1.2 结论
独立 SQLite **不符合**架构：会绕过多租户 RLS、审计、DAM 与可拆库的 namespace 分区（见 `DATABASE-BACKEND-ARCHITECTURE.md` §3/§9，`001_rhautt_nexus_core_ledger.sql` RLS 段）。Everhot 后台应：

1. **写入**：经管理入口 `apps/brand-console` → 领域服务 `/api/v2/product-catalog` + `/api/v2/file-artifact`（DAM）。
2. **读出**：构建期由发布管线从 API 拉取，**生成** `products-data.js`，保持静态站 SEO 与独立部署。
3. **禁止**：站点前端直连数据库 / 跨应用 import（铁律见 `RHAUTT-NEXUS-REARCH-BLUEPRINT.md` §6）。

---

## 2. 解耦铁律约束（本方案必须满足）

来源 `platform-modules.json` `platform.principles` 与蓝图 §1：

- **不吞并**：Nexus 只供给非视觉骨架；Everhot 站点 UI/VI 完全独立，**静态站形态与调性不变**。
- **依赖单向向下**：`应用(everhot-cn) → 非视觉骨架 → 领域服务(/api/v2/*) → 数据`；同层禁横向耦合。
- **namespace 留拆库路径**：Everhot 品牌内容保留 `brand=everhot` 维度，可独立导出。
- **DAM 走 file-artifact**：物料/产品图入对象存储，不落静态仓库为唯一事实源。

---

## 3. 数据归属与命名空间

### 3.1 归属
| 维度 | 取值 | 说明 |
|---|---|---|
| 板块 | 板块一 · 品牌管理 | `platform-modules.json` sections[0] |
| 数据库 | ③ 品牌运营库（各品牌独立产品库 + DAM） | 非板块二赋能体系库 |
| 领域服务 | `product-catalog` · `file-artifact` | `services/api/src/modules/*` |
| 管理入口 | `apps/brand-console`（planned-light） | 非 `nexus-console`，非站点本身 |

### 3.2 租户与品牌维度（关键取舍）
Everhot 产品库是**总部品牌营销内容**，非经销商 CRM 数据。建议：

- `tenant_id` = **品牌运营租户**（HQ/品牌运营，`tenant_type='hq'`，见 `001_...sql` `tenants.tenant_type`），而非经销商租户。
- `brand` = `'everhot'`（`ProductEntity.brand`，区分 rhautt/rheem/ruud）。
- 复用唯一键 `@Index(['tenantId','sku'], unique)`（`product-catalog.entity.ts:4`）→ Everhot SKU 在品牌运营租户内唯一。
- RLS 仍生效：读写经 `current_tenant_id()` 注入（`001_...sql:8-14`）。

> 待拍板：是否给 Everhot 单独开 `tenant`（品牌级隔离）vs 复用 `rhautt_shared` + `brand` 字段过滤。推荐**单独品牌运营租户**，便于未来独立拆库。

---

## 4. 字段映射（everhot → product-catalog）

现状 `window.EVERHOT_PRODUCTS` 条目字段 → `ProductEntity`（`product-catalog.entity.ts`）：

| everhot 字段 | Nexus 落点 | 说明 |
|---|---|---|
| `slug` | `meta.slug` + 派生 `sku` | 详情页 `?model=slug`；`sku` 可用 slug 或 `EW-*` 型号 |
| `name` | `name` | 中文名 |
| `en` / `series` | `meta.en` / `meta.series` | 系列标签 |
| `cat`(residential/commercial) | `meta.cat` | 受众分类 |
| `sys`(water-heating/heating-cooling) | `category` | 映射到 `category` 主分类 |
| `icon` / `image` | `meta.icon` / `meta.image` | `image` 上线改为 file-artifact objectKey |
| `tagline` / `badges` | `meta.tagline` / `meta.badges` | 营销文案 |
| `highlights` / `features` | `spec.highlights` / `spec.features` | 结构化卖点 |
| `specs`(k/v) | `spec.specs` | 规格表 |
| `certs` / `faqs` | `spec.certs` / `meta.faqs` | 认证与 FAQ（FAQ 供 GEO/结构化数据） |
| 价格 | `list_price`/`cost_price`/`currency` | 品牌站默认不展示价；保留字段，置 0/隐藏 |
| — | `status`='active' | 上下架开关 |

> 富内容（highlights/features/specs/certs/faqs）统一进 `spec`/`meta` 两个 `jsonb`，无需改实体表结构。图片资产从内联 URL 收敛到 **file-artifact**（`module='rhautt-shared-platform'` 或品牌分区，`artifact_type` 走自有素材）。

---

## 5. API 契约（/api/v2）

### 5.1 复用现有（`product-catalog.controller.ts`，已 `@UseGuards(AuthGuard)`）
- `GET  /api/v2/product-catalog/devices?tenantId&category&status&q` → 列表
- `GET  /api/v2/product-catalog/devices/:id` → 详情
- `POST /api/v2/product-catalog/devices` → upsert（按 `tenantId+sku`）

### 5.2 需新增（设计建议，本次不实现）
- **公开读端点**（无鉴权、只读、脱敏）：`GET /api/v2/brand/everhot/products` → 供构建期发布管线与（可选）SEO 预渲染。与受保护的 `product-catalog/devices`（后台编辑）分离，避免把 AuthGuard 暴露给匿名站点。
- **DAM 上传**：复用 `file-artifact.controller.ts` 上传产品图，返回 `objectKey`，写回 `meta.image`。
- **发布/上下架**：`POST /api/v2/brand/everhot/products/:id/publish`（驱动 outbox 事件 → 触发站点重建）。

> 边界：站点前端**不直接**调 `product-catalog/devices`（受保护、含成本价）。匿名读走 §5.2 公开只读端点或构建期产物。

---

## 6. 读出策略：静态站如何拿到数据

Everhot 是静态站（SEO + 基路径 `/everhot` + 独立部署），**推荐构建期生成**，而非运行时前端请求：

```
brand-console 编辑 ──写──▶ /api/v2/product-catalog (PG, RLS, 审计)
                                   │
                          publish (outbox 事件)
                                   ▼
              发布管线: GET /api/v2/brand/everhot/products
                                   ▼
        生成 apps/everhot-cn/public/js/products-data.js (同结构)
                                   ▼
                  geo-build + link-audit + 静态部署
```

- 与现有 `npm run build`（`everhot-cn/package.json`：`geo && audit`）天然衔接，新增一步 `fetch-products`。
- 站点 HTML/渲染代码零改动（`products-data.js` 注释已承诺可替换）。
- 保留**离线回退**：API 不可达时用上次生成的 `products-data.js`（与现有 SVG 回退一致）。

> 备选（不推荐为主）：运行时 `fetch` 公开只读端点 → 牺牲 SEO 与静态独立性。

---

## 7. 迁移路线（分阶段，可独立验证）

> **✅ 已实现并端到端验证（2026-07-01）：P1 + P3 全链路跑通。**
> - **公开只读端点**：`services/api/src/modules/product-catalog/product-catalog.public.controller.ts` → `GET /api/v2/brand/everhot/products`（无鉴权、脱敏、回读 `meta.everhot`）。
> - **导入脚本**：`apps/everhot-cn/scripts/sync-products-to-nexus.mjs`（铸 dev JWT → 幂等 upsert by sku，完整对象存 `meta.everhot`）。**24/24 入库，二次运行仍 24（幂等）**。
> - **构建期 fetch**：`apps/everhot-cn/scripts/fetch-products-from-nexus.mjs`（公开端点 → 重生成 `products-data.js` 数组，保留头注释与 `EVERHOT_CATALOG` 工具块；**端点不可达时离线回退保留原文件**）。已接入 `apps/everhot-cn/package.json` 的 `build`。
> - **无损往返**：重生成后 24 个产品逐字段语义一致，仅 `jsonb` 键序变化（站点按字段名读取，无影响）。
> - **完整后台启动**：`npm run dev:nestjs`（`services/api/src/main.ts`，整体 AppModule）**已可正常启动**——124 条路由映射、health 列全 17 个模块边界、公开端点返回 24、鉴权端点无 token 返 401。早前一次 `EventConsumersService` 解析 `CrmService` 的 DI 报错，根因是 `event-consumers.module.ts` 残留的 `CrmModule` 无用导入 + ts-node 增量编译旧缓存（该 service 早已不注入 CrmService）；现模块与 service 已一致、无残留导入，问题不复现。
>
> **✅ P2 产品图入 DAM 亦已端到端跑通（2026-07-01）：**
> - **DAM 表补建**：`public.uploaded_files`（本环境 API 走 `public` schema——非 RLS 工作副本，`public.tenants` 为空；故表按 `FileArtifactEntity` 形态建：`tenant_id varchar` 无 FK，与 `public.products` 一致，用 `tenant='rhautt_shared'`）。迁移 `008_entity_drift_reconciliation.sql` 建的是 `rhautt_nexus.uploaded_files`（uuid FK + FORCE RLS），与运行时 `public` schema 不是同一张——生产切 `rhautt_nexus`/RLS 时需先补 Everhot 品牌租户 UUID。
> - **Fastify 安全上传/读取**：原 `FileInterceptor`（@nestjs/platform-express）+ stream `@Res` 在 Fastify 下失效（实测上传 415）。新增 `POST /file-artifact/upload-base64` 与 `GET /file-artifact/:id/base64`（纯 JSON，ops 令牌）。
> - **脚本**：`sync-product-images-to-dam.mjs`（图 → DAM，回写 `meta.imageArtifactId/imageObjectKey/imageRole`；**默认只传 manifest `owned:true` 授权图**，`--include-placeholders` 才含 dev 占位图）；`fetch-product-images-from-dam.mjs`（DAM → 静态资源 + 重生成 `product-images.js` 卡片图/参数长图两张映射；**离线回退**）。已接入 `build`。
> - **验证**：14 张（10 卡片 + 4 参数长图）入 DAM，构建期拉回，**md5 14/14 字节无损**，`product-images.js` 映射与原一致，站点资源 HTTP 200。
> - **⚠️ 授权底线**：本次用 `--include-placeholders` 跑的是带「瑞美/Rheem」字样的 dev 占位图，**仅本地验证**。正式上线前须换自有/授权白底图并在 `product-image-manifest.json` 对应条目标 `"owned": true`（默认管线只放行 owned）。
>
> **✅ P4 brand-console 品牌运营后台亦已端到端跑通（2026-07-01）：**
> - **新应用**：`apps/brand-console`（Next.js 16 App Router，端口 4012，复用 root `node_modules`，无需安装）。内部 admin 工具，自有 UI，不吞并被管主站（RHAUTT-NEXUS-MANAGEMENT-HUB §3/§7 铁律）。
> - **BFF 架构**：`src/lib/brand.ts` 服务端持 `JWT_SECRET`，铸 `tenantId=rhautt_shared` 的 brand-service 令牌调 Nexus API；令牌/密钥**从不下发浏览器**（httpOnly cookie 会话，沿用 nexus-console 模式）。
> - **能力**：`/api/products`（列表 / 编辑 / 上新 / 上下架，**安全合并 `meta.everhot` 不覆盖无损往返对象**）、`/api/images`（产品图 base64 → DAM + 回写 meta）、`/api/publish`（spawn `fetch-products-from-nexus.mjs` + `fetch-product-images-from-dam.mjs` 重生成静态站）。
> - **闭环验证**：控制台改 `everwarm-c26` tagline → 保存入库 → 发布 → `products-data.js` 重生成 → **站点(4011)实际返回新文案**；`everwarm-pro` 下架→公开端点 24→23、上架→回 24。
> - **待办**：生产接本仓自有 auth/SSO + RBAC（现为内部 dev 登录门，不依赖跨仓 CRM 仓库或共享服务）；切 RLS/rhautt_nexus schema 时补 Everhot 租户 UUID。
>
> **✅ P5 生产鉴权 SSO/RBAC + RLS 就绪（2026-07-01，代码就绪·env 驱动）：**
> - **本仓自有 SSO（OIDC）**：`apps/brand-console/src/lib/brand.ts` 新增标准 OIDC Authorization Code Flow（`discovery`/`ssoAuthorizeUrl`/`ssoExchange`，仅用 `fetch`+现有 `jsonwebtoken`，**零新依赖**）；新增路由 `api/session/sso`（发起+CSRF state cookie）与 `api/session/callback`（校验 state→换码→userinfo→建会话）。`AUTH_MODE=sso|dev`：配了 `SSO_ISSUER` 即走 SSO，否则 dev 账号密码回退。IdP 令牌只在服务端交换，**不下发浏览器**。
> - **RBAC**：角色 `brand_admin`（可写/发布）/`brand_viewer`（只读），由 IdP 组（`SSO_ADMIN_GROUPS`/`SSO_VIEWER_GROUPS`）映射；**双层校验**——BFF 路由 `products/images/publish` 的写操作 `canWrite()` 拦截（403），UI（`Console.tsx`）对只读角色隐藏上新/发布/行内写并置字段只读。不在授权组 → 拒绝登录。
> - **RLS 数据面就绪**：`product-catalog.service.ts` 新增 `scoped()`——tenantId 为 **UUID**（品牌运营租户）时在 `withRlsTransaction` 内读写（`SET LOCAL app.tenant_id`，令 RLS 覆盖表/`audit_logs`/`outbox` 按租户强隔离）；为**共享哨兵**（`rhautt_shared`）时直读，**dev/未启用 RLS 行为不变**（向后兼容）。schema 早已 env 可切（`app.module.ts`：`POSTGRES_SCHEMA||'rhautt_nexus'`）。
> - **真实操作者归因**：`nexus(path, init, actor)` 令服务令牌 `userId=登录用户`，使 RLS `app.actor_id` 与审计归因到实际操作者。
> - **Everhot 品牌运营租户**：迁移 `009_everhot_brand_tenant.sql` 种子固定 UUID `e5e40000-0000-4000-8000-000000000001`（`tenant_type='hq'`，幂等，`public` 工作副本环境自动跳过）。
> - **本地验证**：`tsc --noEmit` 对 `services/api` 与 `apps/brand-console` **均零类型错误**；dev 模式登录/RBAC 行为与既有一致。
> - **⚠️ 生产注入项（代码留接口，非我方可造）**：真实 IdP 的 `SSO_ISSUER/CLIENT_ID/CLIENT_SECRET/REDIRECT_URI` 与组名；生产 `rhautt_nexus` DB + 应用迁移；把 `BRAND_TENANT`（brand-console）与 `EVERHOT_TENANT_ID`（everhot 脚本/公开端点）切到 Everhot 租户 UUID。
>
> **生产激活清单（RLS 切换，须成对执行，见迁移 009 注释）** — 完整可执行 runbook 见
> `docs/EVERHOT-BACKEND-ACTIVATION-CHECKLIST.md`（含待补输入表、逐步命令、冒烟与回滚）：
> 1. 部署 `POSTGRES_SCHEMA=rhautt_nexus`，`node scripts/db/apply-migrations.js` 应用至 `009`（种子租户）。
> 2. 设 `EVERHOT_TENANT_ID` 与 brand-console `BRAND_TENANT` = `e5e40000-0000-4000-8000-000000000001`。
> 3. 开启迁移 009 中默认注释的「产品行 repoint」块（把 `brand='everhot'` 行归属到该租户），或用等价一次性 SQL。
> 4. 配置 `SSO_*` 并置 `BRAND_CONSOLE_AUTH_MODE=sso`；在 IdP 建 `everhot-admin`/`everhot-viewer` 组。
> 5. 冒烟：SSO 登录 → 角色正确 → viewer 只读、admin 可发布 → 公开端点返回本租户产品。

| 阶段 | 内容 | 验证 | 状态 |
|---|---|---|---|
| P0 | 确认/补 Everhot 品牌 `tenant` 种子；明确 `brand=everhot` 维度 | schema guard | 现用 `tenant=rhautt_shared` + `brand=everhot`（共享目录，直读无 RLS） |
| P1 | 导入脚本：`products-data.js` → `POST /product-catalog/devices`（幂等 upsert by sku） | 列表数与源一致 | ✅ 24/24，幂等 |
| P2 | 产品图迁移 file-artifact，`meta.image*` 改 objectKey/artifactId | DAM 可取图 | ✅ 14/14 字节无损往返（dev 占位图，待换授权白底图） |
| P3 | 公开只读端点 + 发布管线生成 `products-data.js` | 构建产物与 API 一致；站点零改动渲染 | ✅ 无损往返 |
| P4 | brand-console 接管编辑/上新/上下架/发布 | 后台改→发布→站点更新闭环 | ✅ `apps/brand-console`（4012）闭环已验证 |
| P5 | 统一以 Nexus 为事实源，无直连 DB | guard 守边界 | ✅ 站点仍静态，脚本走 API |
| P6 | 生产 SSO/RBAC + RLS 就绪（Everhot 品牌运营租户） | tsc 零错误；dev 回退不变 | ✅ 代码就绪·env 驱动；生产密钥/IdP/DB 待注入（见激活清单） |

---

## 8. 安全与治理
- **鉴权收敛**：brand-console 生产接**共享 OIDC SSO**（`AUTH_MODE=sso`，`brand.ts` OIDC 流），dev 账号密码仅回退；后台写经 `AuthGuard` + **RBAC 双层**（BFF 路由 `canWrite()` 403 + UI 角色门），角色由 IdP 组映射（`RHAUTT-NEXUS-MANAGEMENT-HUB.md` §6）；公开读端点脱敏（隐藏 `cost_price`）。
- **令牌不落浏览器**：IdP 令牌只在服务端交换；会话为 httpOnly JWT cookie；数据面服务令牌服务端铸造，`userId=登录用户`（审计归因真实操作者）。
- **审计**：写操作落 `audit_logs`（`001_...sql:649`），租户隔离强制；actor 归因经 `app.actor_id`。
- **RLS**：uuid 租户读写经 `scoped()`→`withRlsTransaction` 设 `app.tenant_id`，由 `current_tenant_id()` 强隔离；共享哨兵目录直读（`products` 为非 RLS 共享 HQ 目录，跨品牌共享，**不强开 FORCE RLS**）。Everhot 品牌运营租户 UUID 见迁移 `009`。schema 由 `POSTGRES_SCHEMA` 切换。
- **素材授权**：`data/product-image-manifest.json` 已记录第三方素材风险——迁移 DAM 时只入**自有/授权白底图**。

---

## 9. 待拍板开口项
1. Everhot 数据租户：**单独品牌运营租户**（推荐）vs 复用 `rhautt_shared`+`brand` 过滤。
2. 读出方式：**构建期生成**（推荐，保 SEO）vs 运行时公开 API。
3. 是否本次纳入 `brand-console`（蓝图列为 planned-light）还是先只做导入脚本 + 公开只读端点。
4. `sku` 取值：直接用 `slug` vs 用型号（`EW-C26` 等，需补全型号字典）。

---

## 10. 不做什么（防越界）
- 不把 Nexus/brand-console 的 UI 强加给 Everhot 站点（铁律 1/2）。
- 不在 everhot-cn 内引入数据库/ORM/SQLite。
- 不让站点前端直连 PG 或调用受保护后台端点。
- 不建跨站共享 UI 组件库。
