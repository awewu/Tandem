# 瑞诺瓦板块功能完整性审计基线

> 状态：进行中 · 生成日期见 git · 打磨主线路线图
> 范围：板块二·瑞诺瓦/Rysnova 经销商赋能（问诊① · CRM② · BIM③）
> 上游事实源：`platform-modules.json` · `docs/RHAUTT-NEXUS-FEATURE-AND-GAP-LEDGER.md`
> 本文只记录「代码实现层」的断点，功能级遗憾以 FEATURE-AND-GAP-LEDGER 为准。

---

## 0. 路由拓扑（打磨前必读）

前端 `apps/*` → **Express 反向代理 `:3001`** → 两条去向：

1. **代理转发到 NestJS `:3300`**（`server/modules/productionMiddleware.js` 的 `NESTJS_MIGRATED_PREFIXES`）
   - 当前白名单：`/api/v2/auth` · `/api/v2/tenant` · `/api/v2/crm` · `/api/v2/quotation`
2. **其余 `/api/v2/*` 落 Express `v2.router.js`**
   - 已挂：auth · audit · contracts · crm · diagnosis · design · lifecycle · rysnova-bim · system-packs · analytics · governance · health · quotation

**双后端错位是本板块最大结构性问题**：NestJS（`services/api`）实现的域比 Express 更全（含 bim/brand/product-catalog/design 完整版/contract/delivery/rysnova-bim-sync），但代理白名单只放行了 4 个域，导致前端打到 NestJS 独有的域时全部落空。

---

## 1. dealer-workbench 前端调用 ↔ 后端对照表（②CRM 主线）

| 前端调用 | 代理去向 | 后端实现 | 判定 |
|---|---|---|---|
| `/api/v2/auth/*` | NestJS | NestJS auth ✅ | **通** |
| `/api/v2/crm/customers`·`/leads`·`/pipeline` | NestJS | NestJS crm ✅ | **通** |
| `/api/v2/crm/customers/:id`（客户360） | NestJS | NestJS `Get customers/:id` ✅ | **通** |
| `/api/v2/crm/opportunities/:id/stage`（拖拽换阶段） | NestJS | NestJS ✅ | **通** |
| `/api/v2/crm/opportunities/:id`（编辑商机） | NestJS | NestJS ✅ | **通** |
| `/api/v2/crm/interactions`（跟进） | NestJS | NestJS ✅ | **通** |
| `/api/v2/crm/opportunities/:id/sign`（签单触发BIM） | NestJS | NestJS ✅ | **通** |
| `/api/v2/quotation/generate`·`/econet-premium`·`/load-calc` | NestJS | NestJS quotation ✅ | **通** |
| `/api/v2/lifecycle/customer-projects` | Express v2 | Express lifecycle ✅ | **通** |
| `/api/v2/design/floor-plans`·`/projects`·`/projects/:id/floor-plan` | **Express v2** | Express design 仅 `workspace-state` ❌ / NestJS 有完整实现但**未代理** | **断① 错位** |
| `/api/v2/product-catalog/devices` | **Express v2** | v2.router 未挂 ❌ / NestJS 有但**未代理** | **断② 错位** |
| `/api/v2/bim/*`（stats/list/inherit/advance/bom…） | **Express v2** | v2.router 未挂 ❌ / NestJS 全套但**未代理** | **断③ 错位** |
| `/api/v2/brand`·`/brand/sync` | **Express v2** | v2.router 未挂 ❌ / NestJS 有但**未代理** | **断④ 错位** |
| `/api/tickets`·`/api/warranties`（售后） | 无 base | 无后端 | **断⑤ 未建**（明确占位） |

### 断点根因归类
- **断①②③④ = 同一根因**：NestJS 已实现，Express 代理白名单缺 `/api/v2/design`·`/product-catalog`·`/bim`·`/brand`。
  - 修法：验证 NestJS 这 4 域可运行后，加入 `NESTJS_MIGRATED_PREFIXES`。
  - ⚠️ 注意 `design` 双写：Express 有 `workspace-state`，NestJS 有 `floor-plans/projects/calc/releases`。整体代理前需确认 workspace-state 是否已在 NestJS 覆盖，否则会丢路由。
- **断⑤ = 售后系统未建**：`aftersales` 需对接公司售后系统或新建 delivery/工单域。

### mock 回退现状（dealer-workbench 页面）
- 纯 mock（import `lib/*-data.ts`）：`products` · `projects` · `brand` · `crm`(部分) · `team` · `aftersales` · `finance` · `analytics`
- 真 API + 静默失败回退空：`bim/page`（`.catch(()=>{})`）
- 真 API：`dashboard` · `crm`(主流程) · `design/*`

---

## 2. ① 问诊 C 端（consumer-diagnosis）

| 层 | 现状 |
|---|---|
| 前端 | **已完整实现**（`page.tsx` 524 行）：落地页 + 四步流程（痛点→面积→留资→方案）。⚠️ 早期"仅骨架"判断有误 |
| 后端 | 完整：Express `diagnosis`（service 451 行，`/public/ai-analyze`·`/public/complete`·`/public/reports/:id`）+ NestJS diagnosis（reports/share-view/revoke）+ NestJS `ingress`（`/lead` 强制 consent）+ NestJS `compliance`（`/consent` 全套 PIPL 管理） |
| 断点 | 见下方「双面并存」 |

### 2.1 ⚠️ 关键：问诊存在「双面并存」

`apps/consumer-diagnosis/project.json` 标注 `build.status = "scaffold-only"` · `currentSurface = "public/pain-diagnosis.html"`。即：

- **线上锁定面 = `public/pain-diagnosis.html`（2414 行）**：调用权威 `/api/v2/diagnosis/public/complete`（落库报告+建商机+可分享报告+outbox），但**全页 0 处 consent/同意/隐私/授权** → **真正的 P0 PIPL 违规在这里**。且该页**无联系方式采集表单**，name/phone 从 localStorage 读取并以 `待跟进客户/13800000000` 兜底（联系方式采集在别处，位置待确认）。提交动作：`saveSolution()`（预约设计师深化）/`shareSolution()`。
- **Next 脚手架面 = `apps/consumer-diagnosis`（scaffold-only，未上线）**：走 ingress + 客户端自造方案。

### 已完成（本轮，落在脚手架面）
- ✅ PIPL 同意勾选（取消硬编码 `consent:true`，未勾选禁止提交 + 隐私政策/授权链接 + consentMeta）
- ✅ 多轮追问：房屋状态（新建/改造分支，PRD 需求采集）+ 常住人数，回流 ingress profile 与 ai-analyze

### 已完成（本轮，线上锁定面 `public/pain-diagnosis.html`）
- 🔎 **发现**：`rysnova-customer-name/phone` 在全仓**只读不写** → 线上问诊此前**从未采集真实联系方式**，一直用兜底 `待跟进客户/13800000000` 生成占位线索。
- ✅ **最佳体验方案**：在 `saveSolution()`/`shareSolution()` 触发 `/public/complete` 前，弹出 on-brand 的「联系方式 + 内联 PIPL 同意」`ensureContactAndConsent()`（沿用 `#E4002B` 调性，不改版式）。一举补齐"缺失的联系采集" + "P0 采集前授权"；同意随 payload `consent`/`consentMeta` 回传后端；localStorage 记录避免重复弹层。
- ✅ 新建政策页 `public/privacy.html` + `public/consent.html`（PIPL 结构：收集项/目的/期限/撤回/权利），链接用显式 `.html`（静态服务无 extensionless）。
- 🟡 **后续**：真正的服务端 consent 落库应调 NestJS `compliance/consent`，但该域未进代理白名单（同 A 根因）；当前仅随 payload 传递 + 前端留痕。

### 剩余（B）
- 🟡 问诊→经销商智能派单（按地域+品类+负载）：后端 `ingress`/CRM 归属逻辑，依赖运行时，未验证。

---

## 3. ③ BIM/设计师（rysnova-bim-workbench · designer-workbench）

| 层 | 现状 |
|---|---|
| rysnova-bim-workbench 前端 | **空壳**（仅 README + project.json） |
| designer-workbench 前端 | 仅骨架 |
| 后端 | 重：Express rysnova-bim（artifact-service 3855 行）+ NestJS rysnova-bim + `rysnova-bim/sync`（link/design-changed/propose-change/confirm/status）+ design（calc/releases/floor-plans） |
| 断点 | 前端未建；M12 `design↔rysnova-bim` 真相源 NestJS 侧 `rysnova-bim/sync` 已有雏形，需前端消费 + DB `design_rysnova-bim_sync` 表打通（migration 002 已落表） |

---

## 3.5 关键定性：dealer-workbench 是「React 候选面」，尚未转正

`npm run guard:frontend-api-contract` 结果：`activeCalls=18 · reactServiceCalls=53 · failures=0 · warning: React service layer remains candidate surface`。

含义：dealer-workbench 等 Next.js 应用**不在主生产面**，其断点路由不会触发守卫失败——是「已知候选态」，非生产故障。转正需满足 CLAUDE.md 三条件：
1. `npm run test:production-readiness` 全通过
2. `npm run guard:frontend-api-contract` 无 unmatched
3. `ENABLE_REACT_CANDIDATE=true` staging 跑 `guard:browser-visual` 无失败

因此 A 的本质 = **推动候选面转正**，而非补线上 bug。

### 运行时依赖（执行 A 前的前置）
- NestJS 起法：`npm run dev:nestjs`（ts-node，端口 `:3300`），**依赖 PostgreSQL**
- Express 反代起法：`npm start`（`server-production.js`，端口 `:3001`）
- 前端：`apps/dealer-workbench` Next.js
- 当前环境这三者均未运行；补代理白名单前需先能启动 NestJS+PG 验证 4 域可用
- 代理白名单编辑受 `guard:production-trunk-isolation` 治理，属主干路由变更，需谨慎

## 3.9 A 执行记录（跑真链路 · 已验证）

环境：PostgreSQL(:5432) + NestJS(:3300, ts-node) 均在本机运行；账号种子见下。

### 排障根因链（重要）
1. **迁移权限**：`public.schema_migrations` 属 `tiechuishan`、`rhautt_nexus` schema 由超级用户建 → `rhautt` 无权。已 `ALTER TABLE ... OWNER TO rhautt` + `GRANT USAGE/CREATE/EXECUTE ON SCHEMA rhautt_nexus TO rhautt`。
2. **NestJS auth 库为空**：登录读 `rhautt_nexus.users`（PIPL 表，phone_hash/phone_encrypted），但所有旧 seed 只写 legacy `public.users`。→ 新增 `scripts/db/seed-nestjs-auth.js`（复刻 compliance.pii 的 hashPII/encryptPII，超级用户绕 RLS 播种）。账号：`13900000001/Dealer@2026`(dealer_admin)、`13900000002/Design@2026`、`13900000003/Sales@2026`。
3. **★ 运行时 schema 错配（核心根因）**：`services/api/src/modules/app.module.ts` 的 `TypeOrmModule.forRoot` **漏设 `schema`** → 运行时用默认 `public`（旧/空表），而 curated 迁移与 `data-source.ts` 都在 `rhautt_nexus`。`bim_projects` 仅存在于 rhautt_nexus → 查询落空 500。**已修**：加 `schema: process.env.POSTGRES_SCHEMA || 'rhautt_nexus'`，与 data-source.ts 对齐。

### 验证结果（重启 NestJS 后）
| 域 | 直连 :3300 | 经代理 harness :3009→:3300 |
|---|---|---|
| brand | ✅ 200 | ✅ 200 |
| product-catalog/devices | ✅ 200 | ✅ 200 |
| bim / bim/stats | ✅ 200（修复前 500）| ✅ 200 |
| design/projects | ✅ 200 | ✅ 200 |
| auth/login | ✅ 200 | ✅ 200（经代理登录成功）|

- **代理白名单已补**（`server/modules/productionMiddleware.js`）：新增 `/api/v2/brand`·`/product-catalog`·`/bim`·`/design`。用生产同款 `createNestJsProxyMiddleware` 的临时 harness 证明 Express→NestJS 转发对四域全部 200（含带 JWT + JSON body）。
- 注：四域数据为空（rhautt_nexus 业务表仅种子了 auth）；路由链路已通，需另行播种 demo 业务数据方能看到内容。

### A 去 mock 进度（逐页）
页面接线现状：`products/brand` 已「真优先 fallback mock」；`projects` 仅 import；`crm/analytics` 纯 mock；`team/finance/aftersales` 无可用后端。

- ✅ **products（竖切样板，已完成并验证）**：新增 `scripts/db/seed-demo-products.js` 播种 10 个产品到 `rhautt_nexus.products`（`tenant_id='rhautt_shared'` HQ 共享目录，不走 RLS）；对齐 `products/page.tsx` 映射到真实 API 形状（`spec.text` / `costPrice` / `meta.stock`）。`/devices` 返回 10 条、6 分类齐全。系统方案包（SYSTEM_PACKS）无后端，保留 mock。
- 🟢 **brand（已核对，部分接线，其余合法保留 mock）**：核对结论——`GET /api/v2/brand`（`brand.service.ts` 抓 rheem.com.cn，6h 缓存+兜底，`AuthGuard`）返 **4 真实字段** `news/products/trainings/campaigns`（均为 HQ 官网内容：标题+URL）。原页面**只用了 `live.news`**（2 张 Hero），`products/trainings/campaigns` 三个真实字段**被完全丢弃**，右栏「快速资源」4 条死链全指 `/brand`。
  - ✅ **本次修复**：`brand/page.tsx` 新增 `liveResources`，把抓取的 products/trainings/campaigns 汇成「Rheem 官网直达」真实外链（无 `live` 回退 `FALLBACK_RESOURCES` 官网栏目，未登录提示登录加载），三个真实字段不再浪费。
  - 🔴 **合法保留 mock（后端缺失，非前端缺口）**：`brand-data.ts` 的 `BRAND_TARGETS`（GMV 目标/返点率）、`CAMPAIGNS.joined/incentive/status`、`TRAININGS.completedBy/totalReps/deadline`、`brandSummary` 属**经销商返点/培训台账域**，带参与状态/完成度/返点合同语义，**后端无表无端点**——与 team/finance/aftersales 同类，需先建返点域后端方可去 mock。HQ 抓取内容不携带这些语义，无法 1:1 替换这些卡片。
- ✅ **crm（已完成并验证）**：根因是**迁移 008_entity_drift_reconciliation 从未应用**（其 §1 正是补 `opportunities.dealer_id`）。补跑迁移前需把 `opportunities`/`quotations` 的 owner 改给 `rhautt`（原属超级用户，rhautt 无法 ALTER），随后 `apply-migrations.js` 成功应用 008（+ 008_design_releases）。crm/pipeline 由 500→200。新增 `scripts/db/seed-demo-crm.js` **走真实 API 播种**（`POST /crm/leads` 建 16 客户+商机含 PIPL 哈希/生命周期/outbox，再 `PUT /crm/opportunities/:id` 设 8 阶段/金额/概率）。pipeline 16 条、8 阶段齐全，crm 页经 `loadPipeline` 显示真数据。
- ✅ **projects（已完成并验证）**：新增 `scripts/db/seed-demo-bim.js` 播种 8 个 `bim_projects`（覆盖 6 阶段 inherited→iot_delivered；`customer_id` NN 但无 FK，用随机 uuid；超级用户 socket 绕 RLS）。修正 `projects-data.ts::bimToProject`（`paidValue` 从写死 0 改读真实 `paid_value`；`systemFamilies` 数组安全处理）。`/bim` 返回 8 条、`/bim/stats` total 8/6阶段齐全，看板与回款率显示真数据。
- ✅ **analytics（已迁 PG 并运行时验证）**：`analytics.service.ts` 原委托遗留 Express/Mongoose（`server/modules/analytics`，MongoDB/内存），已**重写为 PG 直查**——`withRlsTransaction` 内参数化原生 SQL 聚合 `dealers/stores/users/customers/opportunities`，返回同形状 `totals/stages/dealerPerformance`。要点：表名**显式 `${schema}.` 限定**（否则非限定名走 search_path=public 的无 RLS 空表）；单事务单连接**顺序执行**（并发会争用同一 pg 连接）；HQ 角色看租户全量、其余按 dealer/store 收窄。**注**：前端 `analytics/page.tsx` 早已用 `/crm/pipeline`（真 PG）构建、不调此端点，故此为修复孤儿端点 500 + 去 Mongoose，非前端阻塞。
  - ✅ **运行时验证（PORT=3300 POSTGRES_SYNCHRONIZE=false）**：`GET /api/v2/analytics/overview` **HTTP 200**，返回 `storageMode:"postgres"`、`customers:16`、`staff:3`、8 阶段齐全、`pipeline:7,025,000`（`wonAmount:740000`/`quotedAmount:540000`）。`dealers:0/stores:0` 属实——`dealers`/`stores` 表全库 0 行（demo 未播种），非代码缺陷。`tsc` 0 错误。
  - 🐛 **修复参数绑定 bug**：`staff` 查询原用条件拼接 `$1/$2`，当 dealer/store 均 null 时 SQL 无占位符却仍传 2 参 → `bind message supplies 2 parameters, but prepared statement requires 0`。改为与其余查询一致的恒定 `($1::text IS NULL OR ...)` 占位符模式。
- 🔴 **发现：dev 启动 synchronize 隐患（独立于 analytics）**：`app.module` 的 `synchronize` 默认 `NODE_ENV!=='production'`→dev 为 true；当 DB schema 与实体漂移（如 `users` 上有实体未声明的 FK）时，启动会 `DROP FOREIGN KEY` 而 `rhautt` 非属主 → `must be owner of table users`，**NestJS 无法启动**。规避：`POSTGRES_SYNCHRONIZE=false`（schema 本由 curated 迁移管理）。根治建议：把默认改为 false。另注：`main.ts` 端口取自 `PORT` env，未设时回退 `:3001`（Express 代理端口），dev 需显式 `PORT=3300`。
- 🟢 **team（复核纠偏：非纯 mock，已真实派生）**：`team/page.tsx` 实际用 `/api/v2/crm/pipeline`（真 PG）按 `ownerUserId` 聚合出销售排行/成交/待跟进，`REPS` mock 仅空库回退。**真正缺后端的只是人员 HR 属性**（个人目标 `monthlyTarget`、提成率 `commissionRate`、认证级 `certLevel`）——目前这些在前端按常量兜底。要去尽 mock 需建「员工/目标/提成」域后端（net-new）。
- 🟢 **finance（复核纠偏：非纯 mock，已真实派生）**：`finance/page.tsx` 用 `/api/v2/bim`（真 PG）项目算应收账龄/集中度/回款，且经 `bim.updatePaid` **回写**真实回款额；`RECEIVABLES` mock 仅空库回退。**真正缺后端的只是采购订单(PO)**（`PURCHASE_ORDERS` 向 Rhautt 采购，无表无端点）与合同应收到期日（现按 createdAt+90d 合成）。去尽 mock 需建「采购单/应收」域后端（net-new）。
- ⚪ **aftersales**：后端未建（待接公司售后系统，`api.ts` 已留 `afFetch` 占位，未配置时静默回退）→ 维持 mock。
- 🟡 **net-new 域（团队HR / 采购PO / 返点rebate）**：均为**新功能**（无既有表），非"去 mock 打磨"。需先定 schema 再逐域建（migration+entity+service+controller+module+前端接线）。

### C 板块进展（BIM/设计器）
- ✅ **M12 同步状态视图（新建前端 + 后端补明细）**：后端 M12 事件驱动闭环此前已就位（`design.released` → 消费者置派生 `stale`），但**无前端可视**。本轮：
  - 后端 `design-sync.service.ts::getSyncStatus` **加法扩展**返回逐产物 `links[]`（`syncId/artifactId/artifactVersion/designVersion/syncState/changeProposal/reviewedBy/updatedAt`，按 `updatedAt` DESC），原聚合 `states/allInSync` 不变。
  - 前端 `apps/designer-workbench/src/lib/api.ts` 扩 `sync` 客户端（`status`(typed `SyncStatus`)/`link`/`designChanged`/`proposeChange`/`confirm`）。
  - 新建 `apps/designer-workbench/src/app/sync/page.tsx`：查询某 designId → 概览（产物数/真相源/`allInSync` 闸）+ 三态计数（已同步/已过期/待确认）+ 逐产物明细行；`stale` 行可「提交工程回流建议」、`proposed_change` 行可填新版本「确认变更 → 回同步」，闭合 M12 双向同步。含工具面板（登记派生产物 / 模拟 design 变更置过期），空库亦可演示闭环。
  - 首页 `page.tsx` 新增「M12 同步真相源」工具卡（ready）；网格 4→5 列。`tsc`（designer-workbench）0 错误。
- ✅ **2D 户型画布持久化接线（复核纠偏：画布已存在，缺的是接后端）**：`components/Editor2D.tsx`（Konva：画墙/放设备/拖拽/删除/DXF 导出）+ 完整数据模型 `lib/floorplan.ts`（墙/门/窗/家具/设备/房间 + 样板户型）本已存在，`design/pro` 已挂载——但**纯本地、无持久化**，作品即用即丢且与 design 项目真相源脱节；后端 `saveFloorPlan/getLatestPlan/listProjects`（RLS）却早已就绪。本轮：改造 `design/pro/page.tsx` 接 dealer-workbench `design` 客户端——项目下拉载入最近户型（`rowToPlan` 重建 jsonb 行）、命名+保存到 design 项目（M12 真相源锚点）、新图/示例户型；`Editor2D` 经 `key` 重挂载入、`onChange` 收集当前图。`tsc`（dealer-workbench）0 错误。注：`design/page.tsx` 的「简易设计」仍 iframe 遗留 `designer.html`（Express 静态），专业版走 React `Editor2D`。

### A 期间发现的独立后端 Bug
- ✅ **crm/pipeline 500（已修）**：根因非缺列，而是**迁移 008 未应用**（008 已含 `opportunities.dealer_id`）。修法：`opportunities`/`quotations` owner 改 `rhautt` → `apply-migrations.js` 补跑 008。已 200。
- ✅ **analytics/overview 500（已修并验证）**：原走 Mongoose（PG UUID 当 Mongo ObjectId 转换失败）。已重写为 PG 直查，`GET /analytics/overview` 返 200 + `storageMode:postgres`（见上）。
- 🟡 **server-production.js boot 失败**：`engines.templateEngine.initialize is not a function`（环境相关，与代理无关）。
- 🟡 **迁移环境**：本机 `opportunities`/`quotations`（及早前 `schema_migrations`）owner 为超级用户而非 `rhautt`，导致 `apply-migrations.js` ALTER 失败。生产部署应确保业务表 owner = 应用角色。

## 4. 打磨路线（D→A→B→C）

- **D 审计基线**：本文（进行中）
- **A dealer-workbench 对齐**：
  1. 验证 NestJS `design/product-catalog/bim/brand` 可运行
  2. 补代理白名单（处理 design 双写）
  3. 逐页去 mock，改真 API，跑通 CRM→报价→合同→施工→IoT
  4. 售后域决策（对接 vs 新建）
- **B 问诊 C 端**：建问诊 UI + PIPL 同意(P0) + 多轮追问 + 问诊→派单
- **C BIM/设计师**：建前端 + M12 真相源打通

### C 执行记录（进行中）
- **勘查结论**：C 后端已完整且精良（E2E 验证）：`POST /design/calc`（负荷+七系统+五恒维度+必算校验闸+releasable/requiresOverride+免责）、签章状态机 `createRelease(draft)→review→signOverride→release(released)`（`design.service.ts`）、M12 `design↔rysnova-bim` 真相源 `design-sync.service.ts`（link/onDesignChanged→stale/proposeChange/confirm/status，API `/api/v2/rysnova-bim/sync`）。**缺口=前端**：`apps/designer-workbench`/`rysnova-bim-workbench` 为空壳。
- ✅ **designer-workbench 精算/签章前端（已完成并 E2E 验证）**：新建 `src/lib/api.ts`（auth+design.calc/releases+sync）、`src/app/calc/page.tsx` 旗舰页（入参→一键精算→七系统/五恒维度达标表/必算校验闸→起草→评审→签字越过→免责放行）、扩充 `globals.css`（品牌令牌+组件类）、首页加 `/calc` 入口（其余工具标「规划中」）。为规避 CORS，`next.config.js` 加 `rewrites` 把同源 `/api/*` 服务端转发到 NestJS(3300)。`next build` 通过；dev(4003) E2E：`/`·`/calc`=200，经 4003 登录取 token、authed `/design/calc`=200 返完整数据。
- ✅ **M12 接线（已完成并 E2E 验证）**：
  - **越权修复**：`DesignSyncController` 加 `AuthGuard`，全部端点 `tenantId` 改取 `req.user`（原取 body/param，任意租户可越权）；`status` 路由 `:tenantId/:designId` → `:designId`。前端 `sync.status(designId)` 同步。
  - **事件驱动接线**（方向正确：rysnova-bim 派生自 design，故 design 不直连 rysnova-bim）：`DesignService.releaseDesign` 事务内发 `design.released`（outbox，`designId=projectId`、版本锚点=releaseId）；`EventConsumersService` 订阅 `design.released` → 调 `DesignSyncService.onDesignChanged` 把派生产物置 `stale`。装配：`DesignModule→MdmModule`、`EventConsumersModule→RysnovaModule`。
  - **修复既有派发 bug**：`mdm_outbox_events` 为 FORCE RLS，`dispatchPending` 裸查询看不到租户级 pending 事件（影响所有消费者）。改为按租户在 RLS 事务内派发（`dispatchPending(limit, tenantId)`）；`/mdm/event-bus/dispatch` 加 AuthGuard 按 JWT 租户派发。全租户扇出仍由 Temporal 驱动。
  - **修复前端 apiFetch bug**：无 body 的 POST 不再带 `Content-Type: application/json`（Fastify 会 400），否则 `design.review()` 在浏览器必失败。
  - **E2E（3300 直连）**：login→saveFloorPlan(designId)→sync.link(in_sync)→无token status=401→createRelease→review→release→dispatch(processed 19/delivered 19)→status **stale=1, allInSync=false**。TS 类型检查 0 错误，designer 前端 `next build` 通过。
- 🟡 **C 剩余**：(1) 前端加 M12 同步状态视图（后端 `/rysnova-bim/sync/status/:designId` 已就绪）；(2) 2D 户型画布编辑器（后端画布/BOM 未就绪，最大工作量，暂缓）；(3) `design_rysnova-bim_sync.artifact_id` 实体标 varchar 但 DB 为 uuid（漂移，非阻塞）。

---

## 5. 方向纠偏（2026-07 · 对齐锁定路线，撤回"去 mock 建后端"臆造）

> 触发：曾提议为 team/finance/brand 的前端 mock **新建后端域**（团队HR提成 / 采购PO / 返点rebate）。经复核**权威事实源**（`RENOVA-ENABLEMENT-LOCKED-SPEC.md`、`RHAUTT-NEXUS-DEV-DIRECTION-FINAL.md`、`RHAUTT-NEXUS-FEATURE-AND-GAP-LEDGER.md`）确认：**这三个域均不在规划内**，属从遗留 mock 反推的臆造，已撤回、不建。

- **纠偏结论**：前端有 mock ≠ 规划要做该功能。本审计"逐页去 mock"的隐含目标（凡 mock 皆建后端）**与锁定路线不符**——路线优先级是**闭环主线 + P0 合规闸 + P1 接缝 + 拆件套**，非填满每张 mock 卡。
- **规划口径（`FEATURE-AND-GAP-LEDGER`）**：② CRM 的"财务"= 对客 `quote` 闭环（BOM/税/毛利·分期·发票/结算·快照），**无"经销商向 Rhautt 采购PO"**；**无 team 提成域**；返点/GMV 属板块一品牌管理但台账亦**未列**。故 team/finance 页的对应 mock 属**合法占位**，不因"完整性"强建后端。
- **真实优先级**：P0=M14 合规（PIPL 同意/数据保留/等保）；P1=M12 真相源、M15 总线/MDM、问诊→派单、电子合同、design 精度基线、SSO/审计、拆 ③BIM 出 dealer-workbench；P2/P3=客户360/SLA/毛利护栏/施工留证/DigitalTwin 等。

### P0 进展 · M14 PIPL 采集前授权（已完成，`tsc` 0 错误）
- **纠偏发现**：`compliance` 后端本已全建（`POST /api/v2/compliance/consent` + `pipl_consents` 表 + RLS + 保留策略），但 **C 端问诊留资从不写入该存证**——`ingress.captureLead` 仅用布尔 `consent` 拦截、**丢弃 `consentMeta`**，PIPL 第13/14条"同意须可追溯"未满足；前端是内联勾选，非"采集前授权"，且 `purpose` 用了非法值 `marketing_consent`。
- **后端接线**：`ComplianceService` 加 `recordConsentInTx(em, dto)`；`IngressModule` 引入 `ComplianceModule`，`captureLead` 在**同一 RLS 事务**内于建线索后写 `pipl_consents`（`subjectId=customerId`、IP 经 `hashPII` 不存明文、UA、`purpose` 仅收合法枚举默认 `diagnosis_intake`、`ttlDays=365`），使"采集"与"同意"原子可追溯；controller 透传 `user-agent`。
- **前端**（`apps/consumer-diagnosis`）：新增**采集前授权弹层**——任一问诊入口经 `startIntake` 门控，未授权先弹层（隐私政策+授权书链接、同意/暂不），同意即 `setConsent(true)` 并 `localStorage` 留存（撤回同样便捷）；修正 `consentMeta.purpose→diagnosis_intake`。`consumer-diagnosis` `tsc` 0 错误、API `ingress/compliance` 0 错误。

### P1 进展 · 问诊→经销商智能派单（已完成接线，`tsc` 0 错误 / 迁移+种子已落库）
> 依据 `RHAUTT-NEXUS-LEAD-HANDOFF-DESIGN.md` §3/§5/§6：ToC 公域留资进「获客暂存池」租户后，系统态按 **地域+品类+负载** 打分派单给经销商，落决策审计。
- **迁移 `015_dispatch_routing.sql`**（已 `db:migrate` 落库）：
  - `dispatch_dealer_directory` — 派单路由目录，**foundation 行 `tenant_id=NULL` 全租户可读**（仅路由字段：省/市/可服务品类/合约等级/容量/负载，**无 PII、无成本价**）。绕开 `dealers` 表 FORCE-RLS 跨租户读不到的障碍；`dealer_id` UNIQUE 幂等。
  - `dispatch_routing_decisions` — 派单决策审计，落获客池租户、**ENABLE+FORCE RLS 租户隔离**，存候选打分明细/命中经销商/规则/理由，供申诉复盘。
- **模块 `dispatch/`**：`DealerDirectoryEntity`+`RoutingDecisionEntity`、`DispatchService.routeCapturedLeadInTx(em,{tenantId,customerId})`（事务内打分：city=40/省=15/品类=20+10·overlap/合约S15·A10·B5/负载惩罚=load/capacity·20；须能服务所需品类或问诊未选品类时地域可达才可派；stamp 归属回 pool 内 customer/opportunity + 目录 `active_load++`）、只读控制器 `GET /api/v2/dispatch/{decisions,directory}`（`AuthGuard`）。boot-smoke 分支已挂 mock provider。
- **事件接线**：`EventConsumersService` 订阅 `ingress` 已发的 `lead.captured`（payload 带 `customerId`），在 pool 租户 RLS 事务内（system actor）调 `routeCapturedLeadInTx`；已归属客户不重复派单（幂等）。`DispatchModule` 注册进 `app.module` 与 `event-consumers.module`。
- **种子**：`scripts/db/seed-dispatch-directory.js` 播 6 家 demo 经销商目录（成都/上海/杭州/北京/南京/深圳，固定 UUID 幂等）——已执行，foundation 行=6。
- **验证**：API `tsc` 0 错误；`guard:postgres-target-schema`/`postgres-rls-behavior`/`target-api-boot-smoke` 全绿。**live E2E 待 API 重启**（当前 3300 进程早于本次接线）：重启后经 `/api/v2/ingress/leads`（带同意+city=成都/上海）触发 `lead.captured`→总线派发→`GET /api/v2/dispatch/decisions` 应见 `status=routed` 命中对应城市经销商。
- 🟡 **开口项**：(1) `ingress` 留资 profile 未携带问诊所选 `systems`/`province`，故当前退化为**地域打分**（品类匹配需后续把诊断维度并入 lead profile）；(2) 派单仅 stamp 归属、lead 仍留 pool，**跨租户物理迁移落库**（pool→经销商租户）留待系统态迁移作业；(3) 撞单去重/申诉工作流（HANDOFF §4）未接。
