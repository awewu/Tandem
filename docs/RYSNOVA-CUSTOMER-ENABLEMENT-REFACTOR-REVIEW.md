# Rysnova · 客户赋能功能板块重构评审文档

> **文档性质**：架构评审，供决策/优先级讨论使用，不是实施规范  
> **事实源**：实读 `services/api/src/modules/**`、`server/routes/*.js`、`server/modules/**`、`apps/*/src/**`、`product-module-registry.js`、`platform-modules.json`、`module-boundary.ts`  
> **日期**：2026-07-03  
> **作者**：Cascade（由代码证据驱动，非推测）  
> **关联文档**：`docs/RHAUTT-NEXUS-FEATURE-AND-GAP-LEDGER.md`（功能缺口）、`docs/RHAUTT-NEXUS-MODULE-COMPLETENESS-AND-DATAPORT-BLUEPRINT.md`（完整性评分）、`docs/RYSNOVA-SAAS-EVOLUTION-PLAN.md`（产品路线图）

---

## 目录

1. [诊断：为什么「乱」——代码证据](#1-诊断为什么乱代码证据)
2. [已实现功能全景盘点](#2-已实现功能全景盘点)
3. [功能归位矩阵](#3-功能归位矩阵)
4. [结构断裂点与遗憾清单](#4-结构断裂点与遗憾清单)
5. [重构分阶段实施计划](#5-重构分阶段实施计划)
6. [各阶段风险与决策点](#6-各阶段风险与决策点)
7. [验收门与回归测试标准](#7-验收门与回归测试标准)
8. [评审问题清单（需人工决策）](#8-评审问题清单需人工决策)

---

## 1. 诊断：为什么「乱」——代码证据

「乱」不是功能不足，而是**同一功能被实现在错误的位置、并行实现了多次、相互无感知**。以下用代码证据说明。

### 1.1 三层运行时并存，互不衔接

| 层 | 入口 | 规模 | 是否为生产主路 |
|---|---|---|---|
| Legacy Express | `server-production.js` → `server/routes/*.js` | ~8,000 行路由 | **是**，当前唯一生产运行时 |
| NestJS | `services/api/src/` | ~4,800 行 | 否，`npm run dev:nestjs` 独立启动 |
| Static HTML | `public/*.html`（~80个） | 不计 | 是（前端静态面） |

`package.json` 中 `start:api` / `dev:nestjs` 均为独立启动命令，未被 `server-production.js` `require`。两套服务器监听**不同端口**，客户端视角有两个 API 根地址。

### 1.2 客户签收：同一功能出现在 4 个位置

```
位置 A  services/api/src/modules/rysnova-bim/rysnova-bim.controller.ts
        GET  /api/v2/rysnova-bim/projects/:id/customer-package
        POST /api/v2/rysnova-bim/projects/:id/deliverable-artifacts
        POST /api/v2/rysnova-bim/projects/:id/signoff-package
        POST /api/v2/rysnova-bim/projects/:id/customer-signoff
        GET  /api/v2/rysnova-bim/projects/:id/deepening-package

位置 B  server/modules/rysnova-bim/rysnova-bim-artifact.service.js
        async generateDeliverableArtifacts(scope, projectId, data)   // L1773
        async generateSignoffPackage(scope, projectId, data)         // L1827
        async confirmCustomerSignoff(scope, projectId, data)         // L2597
        async buildDeepeningPackage(scope, projectId)                 // L3614

位置 C  server/modules/comfort-domain/comfortDomainFacade.js
        含客户签收调用逻辑（getComfortDomainFacade + 签收流转）

位置 D  services/api/src/modules/lifecycle/lifecycle.service.ts
        async markAccepted(user, contractId, body)   // 语义等价于客户签收
        async buildIotHandoffPackage(user, contractId)
```

**后果**：前端调哪个都可能对，但状态更新、事件发布、数据落点不一致，客户签收在 BIM 数据库 namespace 里，而它的语义归属是合同/生命周期域。

### 1.3 CRM 被绕开：进线未走 CRM 主路

```
ingress.controller.ts   POST /api/v2/ingress/lead
  → 直接插库，不调用 crm.service.ts 的 createLead()
  → crm 的归属规则/撞单裁决均被跳过

server/routes/crm.js    POST /customers  (617行独立实现)
  → 与 services/api/src/modules/crm/ 完全平行，无调用关系
```

### 1.4 施工/工单：legacy 完整，NestJS 零实现

| 域 | Legacy 实现 | NestJS |
|---|---|---|
| 施工工地/任务/验收 | `construction.js` 614行 | **无对应模块** |
| 工单 | `workorders.js` 315行 | **无对应模块** |
| module-boundary.ts | — | construction 域未声明 |

二期 NestJS 设计了 crm/delivery/lifecycle，但跳过了施工和工单，导致 lifecycle 的「验收」悬空——lifecycle 写了 `markAccepted()`，但没有 construction 域产生「施工完工」事件来驱动它。

### 1.5 报价两个版本并存

```
server/routes/quotations.js   525行  (v1 完整 CRUD + 审批流)
server/routes/quotation-v2.js 307行  (v2 生成+BOM路径+多版本对比)
services/api/src/modules/quote/ (NestJS，第三套实现)
```

三套之间：v1 和 v2 共享同一数据库表但路径不同；NestJS quote 的 `persist/list` 与 v1 的 CRUD 写同一 `quotations` 表但读路径不同，导致 dealer-workbench 调 NestJS 获取的列表与后台 legacy 管理面的列表结果有差异。

### 1.6 BIM 与 design 边界模糊

```
server/routes/design.js          737行  含：负荷算、选型、布局、材料、3D、AI匹配
server/routes/rysnova-bim.js     599行  含：同样的负荷算、规范检查、智能布线
server/routes/design-runtime.routes.js  186行  又一套负荷算 + 选型
```

`design` 和 `rysnova-bim` 各自实现了负荷计算，参数结构不同，结果可能不一致。

---

## 2. 已实现功能全景盘点

> 符号说明：✅ 完整实现 · ⚠️ 部分实现/有重复 · ❌ 未实现/只有壳

### 2.1 NestJS 各域实现现状

| 域 | 行数(估) | 主要端点 | 实现完整度 | 核心问题 |
|---|---|---|---|---|
| `diagnosis` | ~350 | complete / reports / share-view / revoke | ✅ 壳完整 | LLM 未接；问诊→CRM 派单断路 |
| `crm` | ~435 | leads / customers / pipeline / opportunities / sign | ⚠️ 60% | 归属规则/撞单/交接缺失；ingress 绕行 |
| `ingress` | ~80 | POST /lead | ⚠️ 薄壳 | 不调用 crm，独立落库 |
| `quote` | ~380 | generate / load-calc / guardrail / persist / lock | ⚠️ 65% | 电子签约/收款节点缺；与 legacy 重复 |
| `design` | ~290 | load-calc / calc / releases / floor-plans / projects | ⚠️ 35% | 仅桥接 1 个计算引擎；5系统精算缺 |
| `rysnova-bim` | ~991 | BIM CRUD / BOM / 图纸 / IoT包 / **客户包/签收** | ⚠️ 70% | 客户签收错放此域 |
| `delivery` | ~309 | contract CRUD / send/sign/activate/fulfill + generate | ⚠️ 50% | 合同模板/电签/PDF 缺；客户交付包缺 |
| `lifecycle` | ~470 | handover / acceptance / handoff-package / customer-projects | ⚠️ 55% | 无 construction 事件驱动；IoT 为 mock |
| `workflow` | ~219 | list / get BIM project workflow | ❌ 查询壳 | 无事件订阅，无 saga 逻辑 |
| `analytics` | ~120 | overview | ✅ 基础完整 | — |
| `notification` | ~130 | list / markRead | ✅ 基础完整 | — |
| `file-artifact` | ~200 | upload / download / list / delete | ✅ 完整 | — |
| `governance` | ~100 | agent-progress | ⚠️ 占位 | 审计日志结构有，查询弱 |

### 2.2 Legacy 各路由实现现状

| 文件 | 行数 | 覆盖功能 | 与 NestJS 关系 |
|---|---|---|---|
| `crm.js` | 617 | 客户 CRUD / 商机 / 漏斗 / 看板 | **重复**：与 NestJS crm 平行 |
| `quotations.js` | 525 | 报价 CRUD / 智能生成 / 审批 / 导出 | **重复**：与 NestJS quote 平行 |
| `quotation-v2.js` | 307 | v2 生成 / BOM / 多版本对比 | **部分重复**：BOM路径 NestJS 无 |
| `contracts.js` | 721 | 合同模板 / 电签 / 审批流 / PDF | **补充**：NestJS delivery 比它薄 |
| `construction.js` | 614 | 工地 / 施工任务 / 进度 / 验收 / 质检 | **孤岛**：NestJS 无对应 |
| `workorders.js` | 315 | 工单 CRUD / 派单 / 完工 / 统计 | **孤岛**：NestJS 无对应 |
| `design.js` | 737 | 负荷算 / 选型 / 布局 / 材料 / 3D | **重复**：与 NestJS design + rysnova-bim.js 三路并行 |
| `rysnova-bim.js` | 599 | 完整计算引擎 / 智能布线 / 导出 | **重复**：与 design.js 算量部分重叠 |
| `rysnova-bim-runtime.routes.js` | 290 | 多专业 / CFD / BIM集成 / 碰撞检测 | **扩展**：NestJS rysnova-bim 无这些 |
| `design-runtime.routes.js` | 186 | 心跳 / 模板库 / 图纸同步 / 选型 | **重复**：与 design.js 部分重叠 |
| `delivery.js` | 53 | generate / docs | **被 NestJS 覆盖** |
| `journey.routes.js` | 91 | 客户旅程 / 阶段推进 / 沟通 / 关闭 | **归位目标**：应归入 NestJS crm |
| `closed-loop.routes.js` | 67 | 闭环模板 / 场景 / 批量运行 | **演示代码**：与 enterprise-loop 重复 |
| `enterprise-loop.routes.js` | 43 | 跑场景 / 批量 / 角色看板 | **演示代码**：与 closed-loop 重复 |
| `packagePurchase.js` | 59 | 系统包报价 / 下单 | **待归位**：归入 quote 或 catalog |

### 2.3 前端 Apps 实现现状

| App | 实现页面 | 接入哪个 API 层 | 状态 |
|---|---|---|---|
| `dealer-workbench` | dashboard / crm / design / design/pro / design/visualize / bim / bim/[id] / analytics / finance / aftersales / projects / team / products / brand / mobile（17页） | NestJS（主） | ✅ 最完整，是主战场 |
| `designer-workbench` | calc / sync（2页） | NestJS design | ⚠️ 仅精算+同步，BIM 工程视图缺 |
| `customer-portal` | page / dashboard（壳） | **无接入** | ❌ 壳，未连任何 API |
| `consumer-diagnosis` | page（壳） | **无接入** | ❌ 壳 |
| `nexus-console` | board / session / sidebar | NestJS | ✅ 管理面板完整 |
| `rysnova-bim-workbench` | **0 文件** | — | ❌ 空目录（注册表与现实不符） |

---

## 3. 功能归位矩阵

> 标注：`当前位置` → `目标域` · 行动类型：**迁移** / **合并** / **剥离** / **新建** / **退役**

### 3.1 客户赋能核心链路归位

| 功能 | 当前散落位置 | 目标归位 | 行动 | 优先级 |
|---|---|---|---|---|
| 交付包生成（deliverable-artifacts） | rysnova-bim.controller ＋ bim-artifact.service | NestJS `delivery` | **剥离**：delivery 新增端点，BIM 改转发 | P1 |
| 客户包查询（customer-package） | rysnova-bim.controller ＋ bim-artifact.service | NestJS `delivery` | **剥离** | P1 |
| 签收包生成（signoff-package） | rysnova-bim.controller ＋ lifecycle.service 双实现 | NestJS `lifecycle` | **合并去重**：lifecycle 扩充，BIM 改转发 | P1 |
| 客户签收确认（customer-signoff） | rysnova-bim.controller ＋ bim-artifact.confirmSignoff ＋ lifecycle.markAccepted 三路 | NestJS `lifecycle` | **合并去重** | P1 |
| 深化包（deepening-package） | rysnova-bim.controller ＋ bim-artifact.buildDeepeningPackage | NestJS `rysnova-bim` **保留** | BIM 产物，语义正确，无需迁移 | — |
| 客户旅程管理 | legacy journey.routes.js | NestJS `crm` | **迁移** | P2 |
| 进线捕获 | ingress + crm 双写 | NestJS `crm`（ingress 作薄代理） | **合并**：ingress 调 crm.createLead() | P1 |

### 3.2 CRM 经营链路归位

| 功能 | 当前位置 | 目标 | 行动 | 优先级 |
|---|---|---|---|---|
| 客户 CRUD / 互动 / 商机 | legacy crm.js(617L) ＋ NestJS crm 双实现 | NestJS `crm` | **合并**：legacy→NestJS，legacy 挂 deprecated | P2 |
| 漏斗 / 销售看板 / 统计 | legacy crm.js（NestJS 缺） | NestJS `crm` | **迁移** | P2 |
| 客户旅程 / 阶段 / 沟通记录 | legacy journey.routes.js | NestJS `crm` | **迁移** | P2 |
| 归属规则 / 撞单裁决 | **无实现** | NestJS `crm` 新增服务 | **新建** | P2 |

### 3.3 施工/工单链路（最大结构缺口）

| 功能 | 当前位置 | 目标 | 行动 | 优先级 |
|---|---|---|---|---|
| 工地管理 / 施工任务 / 进度 / 质检 | legacy construction.js(614L)，NestJS 无 | 新建 NestJS `construction` 域 | **新建域 + 迁移** | P1.5 |
| 工单 CRUD / 派单 / 完工 / 统计 | legacy workorders.js(315L)，NestJS 无 | NestJS `construction`（工单子模块） | **新建域 + 迁移** | P1.5 |
| lifecycle 验收驱动 | lifecycle.markAccepted 悬空 | 消费 construction 的「施工完工」事件 | **事件打通** | P1.5 |

### 3.4 报价/合同链路归位

| 功能 | 当前位置 | 目标 | 行动 | 优先级 |
|---|---|---|---|---|
| 报价 CRUD + 审批流 | legacy quotations.js(525L) ＋ NestJS quote | NestJS `quote` | **合并**：扩充 NestJS | P2 |
| BOM 路径报价 / 多版本对比 | legacy quotation-v2.js(307L) | NestJS `quote` | **迁移**（BOM路径NestJS未有） | P2 |
| 合同模板 / 电子签章 / 审批流 / PDF | legacy contracts.js(721L，NestJS无） | NestJS `delivery` | **迁移扩充** | P2 |
| 系统包购买 | legacy packagePurchase.js(59L) | NestJS `quote`（system-pack 类型） | **归位** | P3 |

### 3.5 设计/BIM 链路边界划清

| 功能 | 当前位置 | 目标域 | 边界规则 |
|---|---|---|---|
| 负荷计算 / 精算 | design.js ＋ rysnova-bim.js ＋ design-runtime.routes.js 三路 | NestJS `design` | 唯一计算源；BIM 消费 design Release 产物 |
| 设备选型 / AI 匹配 | design.js ＋ design-runtime.routes.js 双路 | NestJS `design` | 合并入 design |
| 布局生成 / 材料 / 3D | legacy design.js | NestJS `design` | 迁移 |
| BIM 项目 / BOM / 图纸 | NestJS rysnova-bim ✅ | 保留 | 正确位置 |
| 智能布线 | legacy rysnova-bim.js(unique) | NestJS `rysnova-bim` | 迁移（NestJS无此实现） |
| 碰撞检测 / CFD / BIM集成 | legacy rysnova-bim-runtime.routes.js | NestJS `rysnova-bim` | 迁移 |
| design-sync（设计稿同步） | NestJS rysnova-bim/design-sync.* | NestJS `design` | **归位**：design→bim 的产物推送，属 design 域职责 |

### 3.6 闭环编排归位

| 功能 | 当前位置 | 目标 | 行动 |
|---|---|---|---|
| 业务闭环 saga | closed-loop.routes.js ＋ enterprise-loop.routes.js（演示） | NestJS `workflow` | 退役演示路由；workflow 实现事件订阅链 |
| 项目工作流查询 | NestJS workflow（已有）| 保留 + 扩充 | 升级为真实 saga 状态机 |

### 3.7 前端 Apps 归位

| App | 现状 | 目标 | 行动 |
|---|---|---|---|
| `dealer-workbench` | 17页，最完整 | 继续主战场 | 持续丰富；接 construction/workflow API |
| `designer-workbench` | calc+sync，孤立 | 并入 dealer-workbench 或保留专用 | **评审决策点 #1**（见第8节） |
| `customer-portal` | 壳，3页 | 接入 diagnosis/delivery/lifecycle | 实质化 |
| `consumer-diagnosis` | 壳，入口 | 接入 diagnosis API | 实质化 |
| `rysnova-bim-workbench` | 空目录 | 删除目录 OR 指向 designer-workbench | **评审决策点 #2** |

---

## 4. 结构断裂点与遗憾清单

### 4.1 一级断裂（直接影响业务流转）

| 编号 | 断裂描述 | 影响 | 修复难度 |
|---|---|---|---|
| B-1 | 客户签收数据落入 BIM namespace，不属于 delivery/lifecycle | 客户签收数据无法随合同/生命周期独立提取或迁移 | 中 |
| B-2 | ingress 进线不经 CRM 归属规则 | 同一客户多次进线可能建多个 lead，撞单无裁决 | 低 |
| B-3 | lifecycle.markAccepted 无 construction 事件驱动，只能手动调用 | 施工完工→验收链路必须人工触发，无法自动化 | 高（需先建 construction 域） |
| B-4 | workflow.service 无事件订阅，无法驱动闭环流转 | 「工作流」是查询面板，不是真 saga | 中 |
| B-5 | customer-portal 是空壳，无法向客户展示任何数据 | 客户端的问诊结果、交付包、项目状态均无展示面 | 低（接口已有，只缺前端接入） |

### 4.2 二级断裂（功能重复/维护成本）

| 编号 | 断裂描述 | 量化 |
|---|---|---|
| D-1 | CRM 双实现：legacy crm.js(617L) ＋ NestJS crm | 任何 CRM 改动需同步两处 |
| D-2 | 报价三实现：quotations.js ＋ quotation-v2.js ＋ NestJS quote | 数据可能写入同一表但读路径不同，产生不一致 |
| D-3 | 负荷计算三路：design.js ＋ rysnova-bim.js ＋ design-runtime.routes.js | 结果可能不一致，用户在不同页面算出不同值 |
| D-4 | closed-loop.routes ＋ enterprise-loop.routes 重复演示代码 | 43+67=110行无生产价值代码持续维护 |
| D-5 | design-sync 孤立于 rysnova-bim 模块 | 设计同步的事件不能被 design 域感知和响应 |

### 4.3 结构遗憾（二期开发时的合理选择，现需演进）

| 编号 | 遗憾描述 | 形成原因 | 演进方向 |
|---|---|---|---|
| R-1 | BIM 承接了客户签收：当时 BIM 是最大模块，就近放了签收逻辑 | 二期 delivery/lifecycle 还薄，BIM 先行 | P1 剥离，BIM 改转发 |
| R-2 | 施工/工单没有进入 NestJS：二期重心在数字化设计端 | 合理，施工是线下重，后端化优先级低 | P1.5 补建 construction 域 |
| R-3 | workflow 停留在查询层：二期先把各域壳子建完再做编排 | 合理，防止过早抽象 | P4 升级为事件驱动 saga |
| R-4 | customer-portal 只建了壳：二期前端资源优先 dealer-workbench | 合理，dealer 是主用户 | P5 实质化 |
| R-5 | ingress 独立落库：为了简单快速接线 | 合理，解耦短期收益 | P1 改为代理 crm，消除双写 |

---

## 5. 重构分阶段实施计划

### P0 · 事实源自洽（预计 0.5 天，零运行时变动）

**目标**：让声明文件（注册表/Blueprint/边界文件）与代码现实一致。

| 任务 | 文件 | 具体改动 |
|---|---|---|
| P0-1 | `product-module-registry.js` | 注册 `rysnovaCrm`：namespace=`rysnova-crm`，targetApp=`dealer-workbench`+`customer-portal`，ownedTables=[customers, opportunities, contracts]，apiNamespace=`/api/v2/crm` |
| P0-2 | `product-module-registry.js` | `rysnovaBim.targetApp` 改为 `apps/designer-workbench` |
| P0-3 | `product-module-registry.js` | `rysnovaBim.standaloneAliases` 删除 `/rysnova-bim-bim` |
| P0-4 | `module-boundary.ts` | 补声明 `construction` 域（owner, namespace, requiresTenantScope: true） |
| P0-5 | `platform-modules.json` | suite #3 BIM 的 `apps` 字段加 `apps/designer-workbench` |

**验收**：`npm run guard:all` 全绿（module-independence / nestjs-boundary / prd-code-crosswalk）。

---

### P1 · 客户赋能归位（预计 3-4 天）

**目标**：客户签收/交付数据移出 BIM namespace，归入 delivery / lifecycle。

**P1-1 · delivery 新增客户交付包端点**

```
POST /api/v2/delivery/projects/:projectId/deliverable-artifacts
GET  /api/v2/delivery/projects/:projectId/customer-package
```

实现：调用 `file-artifact` 服务拉取 BIM 产物（通过 `moduleNamespace=rysnova-bim` 过滤），组装客户包，存入 delivery namespace。

**P1-2 · lifecycle 扩充签收端点**

```
POST /api/v2/lifecycle/projects/:projectId/signoff-package   （新增，与 handover/:id/acceptance 互补）
POST /api/v2/lifecycle/projects/:projectId/customer-signoff  （新增，调 markAccepted + outbox 发布）
```

合并 `bim-artifact.service.js` 中的 `generateSignoffPackage`/`confirmCustomerSignoff` 逻辑。

**P1-3 · BIM 清理**

- `rysnova-bim.controller.ts` 的 `customer-package`/`deliverable-artifacts`/`signoff-package`/`customer-signoff` 四个端点改为 HTTP 308 永久重定向到新地址（保持向后兼容 30 天）。
- `deepening-package` 保留（纯 BIM 产物，语义正确）。

**P1-4 · outbox 补齐**

- `delivery` 的 `deliverable.ready` 事件（写操作后发布）
- `lifecycle` 的 `signoff.confirmed` 事件（签收后发布）
- 两者均走 `outbox` 模块（已有基础设施）

**P1-5 · ingress 改代理**

```typescript
// ingress.service.ts
async captureLead(dto) {
  return this.crmService.createLead(dto);  // 代理 crm，不再独立落库
}
```

**验收**：
- BIM namespace 不再增长客户签收数据
- delivery/lifecycle 端点通过 Postman/curl 测试
- outbox 事件可在 `governance` 的 `agent-progress` 查到

---

### P1.5 · 施工/工单域补建（预计 2-3 天）

**目标**：填补 NestJS 中最大的结构缺口。

**P1.5-1 · 新建 NestJS `construction` 域**

```
services/api/src/modules/construction/
  construction.module.ts
  construction.controller.ts   (工地 CRUD / 任务 / 进度 / 质检 / 验收)
  construction.service.ts
  workorder.controller.ts      (工单 CRUD / 派单 / 完工 / 统计)
  workorder.service.ts
  construction-site.entity.ts
  workorder.entity.ts
```

端点覆盖（迁移自 legacy）：

```
GET  /construction/sites
POST /construction/sites
GET  /construction/sites/:id
PUT  /construction/sites/:id/progress
POST /construction/sites/:id/acceptance
POST /construction/quality/checks
GET  /workorders
POST /workorders
POST /workorders/:id/assign
POST /workorders/:id/complete
GET  /workorders/statistics/overview
```

**P1.5-2 · 事件打通**

施工完工（`construction.task.completed`）→ lifecycle 消费 → 自动调用 `advanceInTx`

**验收**：
- legacy construction.js / workorders.js 功能可用 NestJS 端点替代
- lifecycle.markAccepted 可由 construction 事件自动触发

---

### P2 · 报价/合同/CRM 收敛（预计 3-4 天）

**P2-1 · NestJS quote 扩充**

迁移自 legacy quotations.js + quotation-v2.js：

```
POST /quotation/:id/approve       (审批流)
POST /quotation/:id/clone         (克隆)
POST /quotation/from-bom          (BOM 路径，v2 独有)
POST /quotation/compare-versions  (多版本对比，v2 独有)
GET  /quotation/pricing-models    (定价模型)
GET  /quotation/region-factors    (区域系数)
```

**P2-2 · NestJS delivery 扩充合同功能**

迁移自 legacy contracts.js（721L）：

```
GET  /contract/templates
POST /contract/:id/sign-url       (电子签章获取签署链接)
GET  /contract/:id/pdf
GET  /contract/stats/overview
```

**P2-3 · NestJS crm 扩充**

迁移自 legacy crm.js + journey.routes.js：

```
GET  /crm/funnel
GET  /crm/dashboard
GET  /crm/customers/:id/journey
POST /crm/customers/:id/journey/communication
PATCH /crm/customers/:id/journey/:stage
POST /crm/customers/:id/journey/close
```

**P2-4 · design-sync 归入 design 域**

```
# 移动文件
services/api/src/modules/rysnova-bim/design-sync.*
  → services/api/src/modules/design/design-sync.*
```

`rysnova-bim.module.ts` 移除 DesignSyncController 依赖；`design.module.ts` 引入。

**验收**：`npm run guard:all` 含 nestjs-boundary-check 全绿。

---

### P3 · 设计/BIM 层收敛（预计 3-4 天）

**P3-1 · NestJS design 扩充**

迁移自 legacy design.js（737L）：

```
POST /design/device-selection        (设备选型)
POST /design/layout/generate         (平面布局)
POST /design/materials/generate      (材料清单)
POST /design/visualization/3d        (3D 可视化)
POST /design/ai-matching             (AI 方案匹配)
```

**P3-2 · NestJS rysnova-bim 扩充工程能力**

迁移自 legacy rysnova-bim.js + rysnova-bim-runtime.routes.js：

```
POST /rysnova-bim/smart-route        (智能布线，legacy 独有)
GET  /rysnova-bim/smart-route/systems
POST /rysnova-bim/clash-detection    (碰撞检测)
POST /rysnova-bim/cfd-simulation     (CFD 仿真)
POST /rysnova-bim/bim-integration    (外部 BIM 集成)
POST /rysnova-bim/code-compliance    (规范检查)
```

**P3-3 · 边界硬性规则写入 module-boundary.ts**

```typescript
design: {
  canProduce: ['DesignRelease'],
  cannotConsume: ['BimProject'],  // design 不依赖 BIM，单向
},
'rysnova-bim': {
  canConsume: ['DesignRelease'],  // BIM 继承 design 产物
  cannotProduce: ['CustomerPackage'],  // 禁止 BIM 再产生客户包
}
```

**验收**：负荷计算三路合一，dealer-workbench 和 designer-workbench 算出同一结果。

---

### P4 · Workflow Saga 化（预计 2-3 天）

**目标**：workflow 从查询面板升级为事件驱动的状态机。

**事件链（基于已有 outbox 基础设施）**：

```
diagnosis.completed
  └─→ crm.lead_qualified (CRM 推进商机)
       └─→ design.release.created (设计放行)
            └─→ rysnova-bim.project.inherited (BIM 项目创建)
                 └─→ delivery.deliverable.ready (交付包就绪)
                      └─→ contract.signed (合同签署)
                           └─→ construction.task.started (施工开始)
                                └─→ construction.task.completed (施工完工)
                                     └─→ lifecycle.handover.created (交接创建)
                                          └─→ lifecycle.accepted (验收完成)
                                               └─→ lifecycle.iot.handoff (IoT 交接)
```

**P4-1** · `workflow.service.ts` 实现事件订阅器（监听上述事件，更新 `WorkflowInstanceEntity` 状态）  
**P4-2** · 退役 `closed-loop.routes.js` / `enterprise-loop.routes.js`（标记 deprecated，60天后删除）  
**P4-3** · `apps/nexus-console` 或 `dealer-workbench/projects` 消费 `/workflow` 端点，渲染项目闭环进度

**验收**：从问诊完成到 IoT 交接，workflow 实例状态自动推进，无需手动调用。

---

### P5 · 客户面实质化（预计 2 天）

**apps/customer-portal 接入实际 API**：

```typescript
// 客户问诊报告
GET /api/v2/diagnosis/reports/:reportId/share-view   // 已有，加 token 鉴权

// 客户交付包（P1 新建后可用）
GET /api/v2/delivery/projects/:projectId/customer-package

// 客户项目状态
GET /api/v2/lifecycle/customer-projects   // 已有

// 客户签收（P1 新建后可用）
POST /api/v2/lifecycle/projects/:projectId/customer-signoff
```

`public/customer-share.html` 和 `public/customer-view.html` 改为重定向到 `customer-portal`。

---

### P6 · 运行时收敛 Strangler（长期，滚动推进）

**原则**：每迁一个 legacy 路由文件完成后，在 `contracts/architecture/production-route-target-module-map.json` 标记 `retired: true`。

**迁移顺序**（由易到难）：

```
第一批（NestJS 已覆盖）：
  server/routes/delivery.js → 标记 retired
  server/routes/design-runtime.routes.js → 标记 retired（design 扩充后）
  server/routes/closed-loop.routes.js → 标记 retired（P4 后）
  server/routes/enterprise-loop.routes.js → 标记 retired（P4 后）

第二批（扩充后覆盖）：
  server/routes/crm.js → delivery.js → quotations.js → quotation-v2.js → contracts.js

第三批（新建域覆盖）：
  server/routes/construction.js → workorders.js

第四批（复杂路由）：
  server/routes/design.js → rysnova-bim.js → rysnova-bim-runtime.routes.js
```

**验收**：`npm run guard:all` 的 `production-route-target-map-check` 中 `retired` 路由不被访问计数。

---

## 6. 各阶段风险与决策点

| 阶段 | 风险 | 缓解措施 |
|---|---|---|
| P0 | 注册 rysnovaCrm 触发 module-independence-check 新规则 | 先只加声明，不加 owned tables，下一轮再补 |
| P1 | BIM 端点 308 重定向可能打断现有前端（dealer-workbench/bim 页面已在调用） | 先保持 BIM 端点存活（加 `@deprecated` 注释）而非 308，手动排查前端调用后再换 |
| P1.5 | construction 新域的数据库 schema 设计影响 delivery/lifecycle 的已有 tenant 结构 | construction 用独立表前缀 `construction_`，不动现有表 |
| P2 | 报价三合一可能导致 dealer-workbench 前端的报价列表 API 路径变化 | 保持旧路径 301 转发至少 60 天 |
| P3 | 负荷计算三路合一时，结果精度可能因参数格式差异出现微小偏差 | 先做 A/B 对比测试，新端点结果 diff < 0.5% 后再切换 |
| P4 | workflow saga 引入 eventual consistency，前端项目状态可能有延迟 | nexus-console 加轮询/SSE，延迟可接受范围 < 3s |
| P6 | Legacy 路由逐步退役过程中可能有未被追踪的直接调用（尤其 public/*.html 中的硬编码 URL） | P5 优先清理 public/*.html，建立 URL 审计扫描 |

---

## 7. 验收门与回归测试标准

### 7.1 每个 P 阶段完成的必跑命令

```bash
# 命名/边界/依赖守卫（全部）
npm run guard:all

# 生产就绪套件
npm test

# 重新生成证据（命名变更后已过期）
npm run release:provenance
```

### 7.2 NestJS 编译验证

```bash
cd services/api && npx tsc --noEmit
```

### 7.3 Legacy 语法验证

```bash
find server -name "*.js" -not -path "*/node_modules/*" | xargs node --check
```

### 7.4 关键业务流端到端测试（手动/Postman）

| 流程 | 验证要点 |
|---|---|
| 问诊→CRM | diagnosis.complete → crm.lead 创建 → opportunity 推进 |
| 报价→合同 | quote.lock → contract.create → contract.sign |
| 设计→BIM | design.release → rysnova-bim.inherit → bom.export |
| 交付→签收 | delivery.deliverable_ready → lifecycle.signoff → lifecycle.accepted |
| 施工→验收 | construction.complete → lifecycle.markAccepted（P1.5 后） |

### 7.5 数据命名空间隔离验证

```sql
-- 验收完成后，客户签收数据应在 delivery/lifecycle namespace，不在 rysnova-bim
SELECT module_namespace, count(*) FROM file_artifacts
WHERE entity_type IN ('customer_signoff', 'signoff_package')
GROUP BY module_namespace;
-- 期望：0 行 module_namespace = 'rysnova-bim'
```

---

## 8. 评审问题清单（需人工决策）

以下问题需要你的决策，影响实施路径：

**Q1 · designer-workbench 的归属**

`apps/designer-workbench` 目前是独立 Next.js app（calc + sync 两页），接的是 NestJS design 域。

- 选项 A：保留独立，作为「设计师专用精算工作台」品牌面（对外独立 URL）
- 选项 B：整合进 `dealer-workbench/design/pro`（dealer 内的高级设计页），消除两套路由

**Q2 · rysnova-bim-workbench 目录处理**

空目录，当前注册表错误指向它。

- 选项 A：删除空目录，注册表指向 `designer-workbench`（P0-2 已处理注册表，此为物理清理）
- 选项 B：保留作为「未来独立 BIM 工作台」占位（需明确上线时间节点）

**Q3 · 施工/工单的对外产品定位**

`construction` 域是否作为 Rysnova 可独立销售的「施工管理模块」，还是仅作为内部赋能工具（dealer 内用）？

- 影响：独立产品 → 需进 `product-module-registry.js`，加边界合同；内部工具 → 作为 `rysnovaBim` 模块的子功能即可

**Q4 · customer-portal 的产品定位**

C 端客户门户是否作为独立产品上线（独立域名/品牌），还是嵌入 dealer 工作台的「客户视角」？

- 影响：独立产品 → 注册为 `rysnovaCustomerPortal` 模块；嵌入 → 作为 dealer-workbench 内的只读视图

**Q5 · workflow saga 的实现时机**

P4 的 saga 化依赖 P1（outbox 补齐）和 P1.5（construction 事件）全部完成后才有完整链路。

- 选项 A：P1/P1.5 完成后再做 P4（串行，约 2-3 个月后）
- 选项 B：P4 先做框架（订阅器 + 状态机架构），对无事件的节点先用手动触发占位，逐步替换（并行推进）

**Q6 · Legacy 退役节奏**

Legacy Express 路由退役是否设定硬截止日期（如 2026-Q4），还是按功能模块逐步自然退役？

- 硬截止 → 需要投入集中资源做全量迁移测试
- 自然退役 → 风险是长期双轨维护成本

---

*文档版本：v1.0 · 2026-07-03 · 待评审*  
*下一步：根据 Q1-Q6 决策，锁定 P0 实施范围，开始执行*
