# Rhautt Nexus · 整合主蓝图 + 解耦重组方案（MASTER）

> 状态：待评审（架构主文档，统领各子设计）· 2026-06-29
> 🔒 阶段锁定（2026-06-30）：**数据层世界级地基（PostgreSQL RLS 多租户强隔离）已交付并本地真库验证**，见 Part 7。
> 角色：本文件是**唯一主蓝图**。下列子文档是细化，须服从本文件的分层与边界：
> - 数据口/完整性：`RHAUTT-NEXUS-MODULE-COMPLETENESS-AND-DATAPORT-BLUEPRINT.md`
> - 设计精算归位：`RHAUTT-NEXUS-DESIGN-CALC-RECLAIM-PLAN.md`
> - 线索交接层：`RHAUTT-NEXUS-LEAD-HANDOFF-DESIGN.md`
> - 生命周期状态：`RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md`
> - 品牌站集成：`EVERHOT-NEXUS-INTEGRATION-DESIGN.md`
> 事实源：实读仓库结构 · `platform-modules.json` · `PRD-v2.md` · `PROJECT-CHARTER.md`

---

# Part 0 · 现状混乱诚实盘点

根因：**一场半完成的迁移**——从「legacy Express + MongoDB + Vite 单体」迁向「NestJS + Postgres-RLS + pnpm 多包」目标，两者并行运行、三套构建工具叠加、目录严重外溢。

## 0.1 三套后端并存
| 层 | 位置 | 状态 | 问题 |
|---|---|---|---|
| **Legacy 单体** | `server/index.js` + `server/routes/*` + `server/core`(93 引擎) + `server/engines` + `server/v9` | **运行态**（`npm run dev`/`start` 实际跑它，Mongo） | 无 RLS、无领域边界、引擎与路由耦合 |
| **NestJS 目标** | `services/api`（main.ts、NestJS 11、TypeORM、RLS、boundary guard） | **可运行但未上位**（`dev:nestjs`，非默认） | 19 模块薄壳，逻辑未补 |
| **共享包** | `packages/{contracts,generated-client,domain/hvac-kernels,ui,visual-system,tokens}` | 正式分层，**部分内核已迁** | 迁移未完，server/core 仍有真身 |

## 0.2 三套前端并存
- `src/`：Vite React SPA（`App.jsx/pages/components`）= **当前 live 前端**（`dev:client`）。
- `frontend/`：散落 `*-v2.js` = **历史死代码**。
- `apps/*`：pnpm 工作区 8 应用（public-portal/dealer-workbench/business-console/designer-workbench/consumer-diagnosis/everhot-cn/customer-portal/nexus-console）= **目标按应用拆分**。

## 0.3 三套构建/工作区工具叠加
- `package.json`（npm + vite + electron，**无 packageManager 字段**）= live。
- `pnpm-workspace.yaml`（`apps/* packages/* services/*`）= 目标。
- `nx.json`（npmScope `rhautt-nexus`）= 第三套。

## 0.4 目录外溢（需归档/裁决）
`_archive` `archive` `legacy` `backups` `dist` `exports` `desktop` `revit-plugin` `commercial-hvac-design` `frontend` `src`（迁移后）`v9`，及多入口 `server-production.js`/`main.js`/`multi-port-launcher.js`/`websocket-server.js`/`index-fixed.js`/`simple.js`。

---

# Part 1 · 目标分层架构（整合蓝图）

## 1.1 单向分层（唯一合法依赖方向）
```
┌─ 表现层  apps/*  (品牌站 / 问诊 / 经销商工作台 / 客户门户 / 总部控制台)
│        ↓ 只through 数据口
├─ 契约层  packages/contracts + packages/generated-client  (OpenAPI 类型化客户端)
│        ↓
├─ 领域服务 services/api  (NestJS 领域模块：diagnosis/crm/quote/design/rysnova-bim/delivery/lifecycle/
│           intake/compliance/mdm/tenant/auth/workflow/analytics/notification/brand/product-catalog)
│        ↓ 只调内核，不重写算法
├─ 共享内核 packages/domain/hvac-kernels  (精算/报价等纯函数内核，可跨应用复用)
│        ↓
└─ 数据层  PostgreSQL(RLS 多租户) + 对象存储 + 单一 outbox 事件总线
```
**铁律**：上层只能向下依赖，禁止前端直连库、禁跨应用 import、禁领域服务重写内核算法（`platform-modules.principles` + `guard:nestjs-boundary`）。

## 1.2 两板块 + 底座（业务视图）
- **板块一·品牌管理**：`apps/{everhot-cn,rheem-cn,ruud-cn,public-portal}` + `product-catalog` + DAM。
- **板块二·瑞诺瓦赋能**：问诊/CRM/BIM 三件套 + 报价/交付/生命周期，承载经营闭环。
- **底座**：auth/tenant/compliance/mdm/workflow/analytics/file-artifact + `business-console`。

## 1.3 主数据脊柱（详见数据口蓝图 B.1，已拍板 opportunity 强制）
`intake_lead_id → customer_id → opportunity_id →（diagnosis_report/design/quotation/rysnova-bim_artifact）→ lifecycle_link_id`；`global_product_id` 由 mdm 贯穿。**所有经营产物必须挂 `opportunity_id`**。

## 1.4 承接总线（已拍板单一 outbox）
多品牌入口 + 问诊 + 联名子模板 → 统一 `POST /api/v2/intake/leads` → **单一 outbox** `lead.captured` → 赋能后端订阅承接 → 交接层派单 → CRM。新增入口=配置，不改后端。

## 1.5 三约束落地
- **多品牌汇入**：单口 + 单事件，`brand` 字段区分。
- **瑞诺瓦独立上线**：板块二数据口自洽，品牌站是可选上游、非必需依赖。
- **联名子模板=功能开关**（已拍板）：§4.7 身份层 + 能力开关表，授权矩阵驱动；阳谋=脱敏情报对等交换、经营明文守 RLS。

## 1.6 三件套数据库架构（独立 + 协同，已拍板定稿）

**总原则**：一个物理 PostgreSQL，按领域分表（模块化单体数据层）；三件套靠三件事协同、靠"无硬外键"独立。

**三件套范围**（已确认）：①问诊 ②CRM ③BIM 为独立软件件套；`design/quote/delivery/lifecycle` 为支撑模块。三件套**各自可独立上线，经 `opportunity_id` + outbox 协同**。

| 协同/隔离机制 | 作用 | 实现 |
|---|---|---|
| RLS 多租户 | 件套共享隔离契约 | 每表 `tenant_id/dealer_id/store_id` + 行级策略 |
| **软引用列（无 FK）** | 跨件套链接但不强耦合 | `opportunity_id` 等可空 varchar，**无外键约束**（实读确认：无 `@ManyToOne/@JoinColumn`） |
| 单一 outbox 事件 | 跨件套异步反应 | 不做跨域同步 join/调用 |
| 对象/文档存储 | BIM 大文件/图纸 | URL/key 引用（MongoDB 文档 + 对象存储） |

**表归属**：问诊→`diagnosis_report`；CRM→`customer`+`opportunity`(脊柱拥有者)+`interaction`；BIM→`rysnova-bim_artifacts`+`design_rysnova-bim_sync`；支撑→`design_projects`/`quotations`/`lifecycle_links`。

**状态一·独立**：每件套只操作自有表，跨件套软引用列=null；因无外键约束，缺别套表/数据不报错 ⇒ 各自独立可跑/可部署。问诊单用时联系人内嵌报告 `jsonb`，不依赖 CRM `customer` 表。

**状态二·协同**：软引用列写值，`opportunity_id` 为统一 join 键，CRM 为脊柱拥有者。
- 读（客户360）：**应用层聚合**各件套表（非 DB 外键 join）→ 缺某件套自动跳过。
- 写（问诊→CRM）：问诊发 outbox `diagnosis.report.created` → CRM 订阅建/挂 opportunity → 回填 `diagnosis_report.opportunity_id`。

**独立 vs opportunity 强制 的边界（已拍板）**：
- 决议#3「经营产物必须挂 opportunity」**仅作用于协同/经营态**。
- **纯工具独立态**（如问诊单用获客）产出**线索产物（pre-opportunity）**，挂 `intake_lead_id`；进入 CRM 时升格创建 opportunity 并回填。
- ⇒ "独立" 与 "opportunity 强制" 不冲突。

**铁律**：跨件套**只用"可空软引用列 + outbox 事件"链接，绝不用硬外键**；跨件套数据组合在**应用层聚合**，不在 DB 层 join 约束 ⇒ 件套可插拔，支撑联名子模板按功能开关增减件套。

---

# Part 2 · 解耦重组策略（Strangler Fig 绞杀式迁移）

**原则**：不大爆炸重写；**按领域逐块从 legacy 绞杀进 NestJS**，引擎逐个归位 kernels，前端逐应用迁入 apps，期间保持系统可运行。

## 2.1 后端解耦：legacy `server/` → `services/api`
- **路由对路由绞杀**：每个 `server/routes/X.js` 找到目标领域模块，在 `services/api` 实现等价数据口后，**网关层把 /api/v2/X 切到 NestJS**，旧路由置 deprecated→删除。
- **引擎归位**：`server/core/*` 与 `server/engines/*` 中的纯算法 → `packages/domain/hvac-kernels`（精算优先，见 calc-reclaim）；有状态/编排逻辑 → 对应 NestJS service。
- **数据迁移**：Mongo → Postgres(RLS)；按领域表迁移，挂租户列。
- **死引擎裁决**：93+10 引擎逐个 keep/migrate/archive（需《Legacy 引擎归位裁决表》，见待办）。

## 2.2 内核解耦：server/core 真身 → kernels
- 已是薄壳的（LoadCalc/HotWater/FreshAir/DOAS/Heating/AirConditioning/Hydraulic/Quotation）→ 删壳，调用方直连 `packages/domain/hvac-kernels`。
- 仍是真身的（OneClick/CalculationEngine/FiveConstant/WaterSystem/CommercialTax + 新建 noise）→ 迁入 kernels（calc-reclaim Part 7）。

## 2.3 前端解耦：`src/` + `frontend/` → `apps/*`
- `frontend/*-v2.js` → 归档（死代码）。
- `src/`（Vite SPA）按受众拆分迁入 `apps/*`：问诊页→consumer-diagnosis、设计/报价→dealer/designer-workbench、客户视图→customer-portal、总部→business-console/nexus-console、品牌→everhot-cn 等。
- 所有 app 经 `packages/generated-client` 调数据口，不内嵌业务逻辑。

## 2.4 构建工具收敛：三套 → 一套
- **保留 pnpm workspace**（`pnpm-workspace.yaml` 已覆盖 apps/packages/services），作为唯一工作区。
- **nx 二选一**：要么 nx 作 task runner 叠加在 pnpm 上（保留），要么移除 nx.json（简化）——待拍板。
- 根 `package.json` 收敛：拆出各 app/service 自己的 package.json，根只留工作区编排；电子桌面/revit 拆为独立包。

## 2.5 目录归档
`_archive`/`archive`/`legacy`/`backups`/`dist`/`exports` → 统一 `archive/`（或删）；多 server 入口收敛为单一启动；`commercial-hvac-design`/`revit-plugin`/`desktop` → 独立 `apps/` 或 `tools/`。

---

# Part 3 · 重组后目标目录形态
```
rhautt-nexus/
├─ apps/                      # 表现层（每个独立可部署）
│   ├─ everhot-cn / rheem-cn / ruud-cn / public-portal   (板块一)
│   ├─ consumer-diagnosis / dealer-workbench / designer-workbench / customer-portal  (板块二)
│   └─ business-console / nexus-console                  (底座/总部)
├─ services/
│   └─ api/                   # 唯一后端（NestJS，领域模块 + RLS）
│       └─ src/modules/{diagnosis,crm,quote,design,rysnova-bim,delivery,lifecycle,
│                        intake,compliance,mdm,tenant,auth,workflow,analytics,...}
├─ packages/
│   ├─ contracts/             # OpenAPI / 事件契约
│   ├─ generated-client/      # 类型化客户端
│   ├─ domain/hvac-kernels/   # 唯一算法内核（精算/报价/noise…）
│   ├─ ui / visual-system / tokens
├─ tools/  (revit-plugin, desktop, scripts)
├─ archive/  (legacy server/, frontend/, src/, 旧引擎 — 冻结只读)
└─ pnpm-workspace.yaml (唯一工作区)
```

---

# Part 4 · 迁移波次（对齐已拍板优先级）

| 波次 | 目标 | 依赖决议 | 验收 |
|---|---|---|---|
| **W0 防回退** | 立 boundary guard + 冻结 legacy 写入；建网关把 /api/v2 路由到 NestJS | — | 新功能只进 NestJS；guard CI 红线 |
| **W1 精算归位** | design 五系统 + 必算硬校验闸 + 内核迁 kernels | 决议#1 精算优先 | 七系统结果对齐基准集；闸阻断生效 |
| **W2 经营脊柱** | 交接层 intake + 单一 outbox + opportunity 强制 + CRM 归属/撞单 | 决议#2/#3 | lead 端到端归属；撞单留审计 |
| **W3 报价财务** | 电子签(经销商) + 收款节点 + 报价快照锁联动 | 决议#4 责任归经销商 | 报价→合同→收款跑通 |
| **W4 交付闭环** | delivery + lifecycle + IoT handoff（去 mock） | — | 验收→IoT 生命周期可走通 |
| **W5 前端迁移** | src/ → apps/*；frontend/ 归档 | — | 各 app 经 generated-client 调口 |
| **W6 收尾** | 构建工具收敛 + 目录归档 + legacy 下线 | 待拍板 nx | 单后端单工作区，legacy 只读冻结 |

> 问诊 LLM 接入排 W2 之后（决议#1 精算优先于 LLM）。
>
> 🔒 **横切地基（已锁定）**：W2/W4 数据迁移所依赖的 **PostgreSQL RLS 多租户强隔离地基**已先行交付并验证（Part 7）。后续各波次的领域表迁移直接复用该地基（建表挂 `tenant_id` + FORCE RLS + 写入方走 `withRlsTransaction`），不再重复造数据隔离机制。

---

# Part 5 · 防回退守护栏
- ✅ **`guard:nestjs-boundary` 已扩展并验证（2026-06-30 W0-b）**：新增 3 条分层规则——① 禁 `apps/*` 直连 `server/*`；② 禁跨应用 import；③ 禁 `services/api` 新增 reach-in `server/core|server/engines`（应走 `packages/domain/hvac-kernels`）。现有 4 处 reach-in（design 的 LoadCalcV3、quote 的 EconetPricing/Export/Promotion）列为**基线告警**（W1 精算归位后清零）。当前 `0 violations / 4 warnings`，exit 0。
- 冻结期：`server/` 标 deprecated 只读，新增功能一律进 `services/api`。
- 契约测试：`test:contracts`（OpenAPI）+ `test:tenant-isolation`（RLS）作迁移红线。

---

# Part 6 · 已拍板决议（2026-06-30，重组基线）
1. **网关策略 = Nginx 反代渐进切流**：`/api/v2/*` 按路由灰度指向 NestJS，未迁路由回落 legacy；前端无感，可逐路由回滚。W0 据此建网关。
2. **构建工具 = 只留 pnpm workspace，移除 nx**：`pnpm-workspace.yaml`（apps/packages/services）为唯一工作区；删 `nx.json`，避免三套叠加。
3. **数据迁移 = 逐表双写→校验→切读**：非一次性导入；保持系统可运行、可回滚，符合绞杀原则。影响 W2/W4 节奏按表推进。
4. **legacy 下线判据**：某 `server/routes/X` 的 NestJS 等价口须 **通过契约测试 + 灰度 100% + 观察期 2 周** 方可删除旧路由；全部绞杀后才删 `server/`。
5. **apps 拆分粒度 = 先整体迁后拆**：`src/` 先整体迁为一个 app 跑通，再按受众（问诊/工作台/客户/总部/品牌）拆分；降低一次性风险。

### 决议传导
- **W0 解锁**：建 Nginx 网关 + 移除 nx + 立 boundary guard，即可启动绞杀。
- **W1 精算归位**：不依赖网关，可与 W0 并行先行（见 calc-reclaim Part 7）。
- **数据迁移**：W2/W4 各领域表按"双写→校验→切读"三步走。

---

# Part 7 · 🔒 已锁定阶段成果 —— 数据层世界级地基（2026-06-30）

> 本节为**权威阶段锁定记录**：范围内的成果已交付并经本地真库验证，作为后续波次的不可回退地基。

## 7.1 范围（已交付）
1. **迁移驱动的目标 schema**（`database/postgres/migrations/`，`schema_migrations` 漂移保护 + 独立事务）：
   - `001` 核心账本 · `002` compliance/mdm/design-sync · `003` 报价快照
   - `004` 补建 5 张此前「无迁移」业务表 + 立即强 RLS（`interactions`/`diagnosis_sessions`/`design_projects`/`floor_plans`/`bim_projects`）
   - `005` 阶段二 6 张表强 RLS（`delivery_records`/`rysnova-bim_artifacts`/`lifecycle_links`/`notifications`/`analytics_events`/`price_list_items`）
   - `006` `contracts` 增列 `dealer_id`/`terms`（ContractService 持久化）
2. **运行时强隔离链路（闭环）**：`TenantContextInterceptor`（AsyncLocalStorage，全局 `APP_INTERCEPTOR`）→ `withRlsTransaction()`（事务内参数化 `SET LOCAL app.tenant_id`，注入安全）→ RLS 策略 `tenant_id = current_tenant_id()`。
3. **写入方采用**：13 个租户作用域服务已走 `withRlsTransaction`（crm/quote/file-artifact/diagnosis/design/design-sync/bim/compliance/product-catalog/delivery-contract…）。
4. **工具与可复现**：`scripts/db/apply-migrations.js`（幂等运行器）+ `rls-apply-proof.js`；`db:migrate` / `db:migrate:status` / `db:migrate:dry-run` / `db:rls-proof`。

## 7.2 验证证据（本地真库，全绿）
- `db:rls-proof` **6/6**：跨租户**写被拒**（PG `42501`）、跨租户**读隔离**（0 行）、关键表 **FORCE RLS** 生效。
- 守卫 0 failures：`guard:postgres-target-schema` / `guard:postgres-rls-behavior` / `guard:target-api-boot-smoke`。
- 提交基线：`658db6b`（feat(db): enforce tenant RLS at DB layer + migrations 004/005）；`006` 为并行交付。
- 证据落盘：`evidence/database/local-rls-apply-proof.{json,md}`、`docs/DATABASE-WORLD-CLASS-DELIVERY.md`、`docs/DATABASE-GAP-ANALYSIS.md`。

## 7.3 锁定铁律（后续波次复用，不再重造）
- 任何新增租户表：建表必挂 `tenant_id`（uuid REFERENCES tenants）+ `ENABLE/FORCE RLS` + `tenant_isolation` 策略。
- 任何租户作用域读写：必经 `withRlsTransaction`，禁裸 repository 直连库。
- 共享目录（`products`，`tenant_id='rhautt_shared'` 哨兵）与单写主数据（`mdm_*`，scope 策略）为**有意例外**，不纳入 uuid 租户隔离。

## 7.4 特权/引导态路径（已收口，migration 007）
> 复盘发现：实体在 dev synchronize 下与迁移 schema 漂移（users/tenants/stores），迁移驱动（staging/prod）下会先于 RLS 因「列不存在」报错；且 FORCE RLS 会阻断预认证登录与公开查询。已按「迁移为准 + PIPL」收口：
- **实体↔迁移对账**：`UserEntity` 改 PIPL 模型（`phone_hash`+`phone_encrypted`+`display_name`，`permissions` jsonb）；`TenantEntity.type`→`tenant_type`；`007` 补 `users.login_attempts/lock_until/customer_id`、`stores.manager_user_id`。
- **auth 预认证**：登录按 `phone_hash`（`compliance.pii.hashPII`）经 **SECURITY DEFINER 函数** `auth_lookup_user_by_phone_hash()` 跨租户命中（绕 FORCE RLS）；命中后已知 `tenantId`，登录态写回/改密/刷新均走 `withRlsTransaction` 绑定租户。
- **tenant 引导**：`dealers/stores` 读写全部走 `withRlsTransaction({tenantId})`；`tenants` 表无 RLS（HQ 跨租户管理）维持直读。
- **bim 公开读**：`publicLookup` 改用 SECURITY DEFINER 函数 `bim_public_lookup()`。
- **验证**：`tsc` green；7 迁移整链应用；功能证明（回滚事务）——非属主+无 GUC 直读 users=0（RLS 拦截）、SECURITY DEFINER 函数返回 1（绕过生效）；`db:rls-proof` 6/6；守卫 `target-schema`/`rls-behavior`/`boot-smoke`/`nestjs-boundary` 无新失败。
- ⚠️ **部署约束**：SECURITY DEFINER 绕过 FORCE RLS 要求函数 owner 具 BYPASSRLS（迁移执行角色）；应用以**非属主最小权限角色**连接、仅调用这些函数。
- **已知 V1 限制**：`UNIQUE(tenant_id, phone_hash)` 允许同号跨租户，多租户同号登录消歧待补（auth.service TODO(P1)）。

## 7.5 仍开口（运维/裁定，需外部输入）
- **P0 上线闸**：非本地 `POSTGRES_STAGING_URL` 的 `release:postgres-staging:smoke`（产出 `finalLaunchDatabaseProof`）；生产**非属主最小权限角色** + 迁移执行角色 BYPASSRLS 的部署落位。
- **PII 方案统一**：`crm` 自带的 HMAC `hashPhone`/明文 `phoneEncrypted` 与规范 `compliance.pii`（SHA-256 + AES-GCM）分叉，待统一到单一 PII 工具（P2）。
- **架构裁定**：`mdm_outbox_events` 与 `outbox_events` 是否合并为单一 outbox（P2）。
