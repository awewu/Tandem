# Rhautt Nexus · 双实现收敛台账（Legacy ↔ Target）

> 状态：现行台账 · 建立 2026-07-03
> 作用：登记每个「遗留静态页（生产在跑）↔ 目标模块化应用（在建）」双实现配对的**当前真相源 / 切换条件 / 归档时机**，避免迁移期两套代码真相源漂移与烂尾。
> 上位：本台账是 `RHAUTT-NEXUS-DESIGN-INDEX-AND-ROADMAP.md` 路线图 **W5 前端迁移 / W6 收尾** 的执行明细。
> 数据来源（反推自代码，2026-07-03）：`public/legacy-surface-manifest.json`、`public/index.html`（枢纽 D0–D5）、`apps/*/src`（路由/组件/`/api/v2` 接线数）、`scripts/agent-guards/active-navigation-check.js`。

---

## 0. 术语与判定规则

- **双实现**：同一业务能力同时存在「遗留 `public/*.html`」与「目标 `apps/*`（React/Next）」两套代码。
- **收敛**：最终每个能力只保留一个真相源（原则上为目标应用），遗留页移入 `archive` 并下线。
- **当前真相源**：现在以哪套为准。迁移未完成前，**生产导航挂的 active 遗留页 = 当前真相源**。
- **成熟度**（目标应用）：`空壳`（无 src）< `骨架`（单页/占位）< `部分`（有路由无真数据或功能不全）< `较完整`（多路由 + 接 `/api/v2` 真数据）。
- **切换前置（通用四闸）**：① 功能对齐遗留页；② 接 `/api/v2` 真数据（非 mock）；③ guard 通过（`navigation` / `active-page-static` / `portal-architecture` / `module-independence`）；④ 数据/入口迁移就绪。四闸全绿 → 网关切流 → 遗留页移 `archive`。

---

## 1. 收敛台账（主表）

| # | 能力 | 遗留实现（当前真相源·active） | 目标实现（`apps/`） | 目标成熟度 | `/api/v2` 接线 | 差距 / 切换阻塞 | 波次 |
|---|---|---|---|---|---|---|---|
| C1 | 经营工作台（CRM/报价/施工/财务） | `business-console.html`（1241 行） | `dealer-workbench`（13 路由：crm·design·finance·projects·aftersales·analytics·bim·products·team·mobile…） | **较完整** | 9 文件 | 目标最成熟；需逐路由对齐遗留功能 + 数据迁移 | W2–W4 |
| C1b | 经营工作台（重复目标） | 同上 | `business-console`（`console` 单路由） | 骨架 | 2 文件 | **与 dealer-workbench 职责重叠**，须二选一（建议废弃本 app，归并入 dealer-workbench） | W5 |
| C2 | AI 暖通问诊 | `pain-diagnosis.html`（2414 行，全站最大） | `consumer-diagnosis`（单 `page.tsx`） | **骨架** | 1 文件 | 目标仅占位；2414 行问诊逻辑/精算未迁 | W1 相关 |
| C3 | 客户项目门户 | `customer-view.html` + `customer-share.html` | `customer-portal`（`dashboard` + `page`） | 部分 | 2 文件 | 缺分享页/免登呈现；生命周期状态未接 | W4 |
| C4 | 设计·图纸（Rysnova/BIM） | `rysnova-bim-designer.html`(1991) · `designer.html`(1417) · `floorplan-bim.html`(1472) | `rysnova-bim-workbench`（**空壳·无 src**） + `designer-workbench`（`calc` + `page` + 12 legacy html） | **空壳 / 骨架** | 1 文件 | 最大缺口：主目标 `rysnova-bim-workbench` 无任何代码；精算/图纸/BIM 全在遗留页 | W1 / W5 |
| C5 | 集团官网（D1） | `index-ready.html`（navigable） | `public-portal`（Next：about·contact·products·professional·solutions·privacy + sitemap/robots，:4005） | 部分（静态营销站） | **0 文件** | 纯静态、未接后端；作为品牌站可独立，但需确认与遗留首页职责边界 | W5 |
| C6 | 管理中枢 / 枢纽 console（D0） | `index.html`（枢纽） + `staff-portal.html` | `nexus-console`（Next：`[board]` 动态路由 + api） | 部分 | 4 文件 | 定位为编排壳（不托管三件套 UI）；见 PAGE-EVOLUTION-AUDIT E0–E3 | W5 |
| C7 | 品牌管理（D1） | 枢纽 D1 磁贴（无独立遗留页） | `brand-console`（Next：api + page） | 骨架 | 2 文件 | 功能未成形 | W5 |
| C8 | Rheem / Ruud 品牌站（D1） | `rheem-platform-v3.html` · `four-brand-demo.html`（navigable） | `rheem-cn`（1 html） · `ruud-cn`（1 html） | **桩** | 0 | 仅占位 html；枢纽 D1 现已改指外链 `rheem.com.cn` / `ruud.com.cn` | 未排期 |
| C9 | 产品中心（D2 · 独立一级域） | `products.html`（static-inventory·navigable） | `product-catalog` 后端模块 + `everhot-cn`（58 页参考站） | 部分 | — | 真相源为后端 product-catalog；前端 `products.html` 待迁；见 `D2-PRODUCT-FACT-BASE-BLUEPRINT.md` | D2 工作流 |
| C10 | 增长中枢（D5） | `growth-hub.html`（static-inventory·navigable，工作台已上线） | `growth` 后端模块（geo-analyzer/ai-gateway/attribution/brand-brain/opinion-*） | 部分（后端实） | — | **前后端语义错位**：前端标「规划中」，后端 growth 模块已大量落地 | 见 BOARD-3 蓝图 |

> ✅ 无双实现、已达目标态的 active 页（保留、不进收敛）：`login.html`、`privacy.html`、`consent.html`。

---

## 2. 处置决议

- **D-1（C1b 去重）**：`apps/business-console` 与 `apps/dealer-workbench` 职责重叠。**决议：以 `dealer-workbench` 为经营工作台唯一目标**，`business-console` app 归并/废弃，避免三实现（遗留页 + 两 app）。
- **D-2（C4 补缺口）**：`rysnova-bim-workbench` 空壳是全局最大缺口。W1「精算归位」内核已迁 `packages/domain/hvac-kernels`，但**前端工作台无载体**；需先立骨架再承接 `rysnova-bim-designer.html` 的图纸/BIM/精算 UI。
- **D-3（C8 降级）**：`rheem-cn` / `ruud-cn` 桩站在枢纽已改外链承接，**从收敛主线降级为「未排期」**，不阻塞 W5/W6。
- **D-4（C10 对齐口径）**：D5 前端文案改为与后端 growth 模块实际能力一致（去掉「纯规划」措辞），或明确标注「后端已就绪·前端接线中」。
- **D-5（真相源纪律）**：收敛完成前，**任何能力的功能变更以「当前真相源」列为准**；目标 app 侧改动须回填本台账，禁止两侧各改各的。

---

## 3. 收敛顺序（对齐 W0→W6）

1. **W5 前端迁移**：按成熟度从高到低切换 —— C1（dealer-workbench，最近）→ C3 → C6 → C5 → C7；期间执行 D-1 去重。
2. **W1 关联**：C2 问诊、C4 设计/图纸依赖精算内核归位，随 W1 推进。
3. **W6 收尾**：每完成一对切换，遗留页从 `legacy-surface-manifest.json` 的 `active`/`static-inventory` 移入 `archive`，网关下线；全部完成后 `public/*.html` 巨石页归档。
4. **门禁**：每次切换必须通过通用四闸（见 §0）+ `guard:all:nonvisual`。

---

## 3B. D4「客户与赋能」解耦专章（R-1~R-6 · 已采纳 2026-07-03）

### 背景：为何 D4 曾「彻底搞乱」
三条轴缠在一起 —— **阶段**（闭环 5 段）×**角色**（经销商/设计师/客户/总部）×**载体**（每格 3–5 个重复遗留页 + 6 个重叠 app）。~50 个遗留页触碰 D4，却只挤进枢纽 4 磁贴；后端再被 Express:3001 ↔ NestJS:3300 双后端 + 代理白名单错位切成两半。

### 解耦三标尺（阶段 × 角色 → 唯一载体）
| 角色 | 唯一目标载体 | 定位 |
|---|---|---|
| 经销商内部 | `dealer-workbench` | 全阶段后台主台（唯一） |
| 设计师 | `designer-workbench`(+rysnova-bim 内核) | 仅②设计深化 |
| 客户（对客/免登） | `customer-portal` | 进度/验收/保修只读 |
| 公域获客(C端) | `consumer-diagnosis`/`pain-diagnosis.html` | ①问诊，**属 D3 上游**，成交迁入 |
| 总部（跨经销商） | 业务 rollup | **属 D0/D5，不属 D4** |

### 解耦矩阵（阶段 → dealer-workbench 路由 → 收敛掉的遗留页）
| 阶段(状态) | dealer-workbench 路由 | 归档遗留页 |
|---|---|---|
| ①获客(lead/diagnosis/solution-drafted) | `crm` | crm-dashboard·sales-crm-module·sales·customers·customer-journeys·channel-dashboard·smart-routing |
| ②设计(design-in-progress) | `design`→`designer-workbench` | rysnova-bim-designer·designer·designer-legacy·floorplan-bim·design-review·bim-viewer·drawing-*(3)·technical-drawings·revit-integration·3d-walkthrough·device-*(2) |
| ③报价合同(quote-*/contract) | `finance` | quotation-pro·quotation-v2·quotations·material-quotation-system·oneclick-calc·package-purchase·simple-proposal·contract-management·solution-*(4) |
| ④施工交付(construction/acceptance) | `projects` | construction-management·construction-dashboard·construction-schedule·delivery-center |
| ⑤服务生命周期(handoff/active/service) | `aftersales` | service-tickets·operation-maintenance·maintenance-schedule·predictive-maintenance·workorders·technical-support·econet-dashboard |

对客侧（同数据另一视角，进 `customer-portal`）：customer-view·customer-share。

### 决议（R-1~R-6，全部采纳）
- **R-1 单主台**：经销商侧 5 阶段全部收敛进 `dealer-workbench` 的 5 路由，~40 遗留页归档。
- **R-2 剥离问诊**：`pain-diagnosis` 归位 D3 公域获客；D4 只接成交后迁入的 customer；删除 D4 面板问诊混列。
- **R-3 剥离总部**：`business-console.html` 跨经销商 rollup 移至总部视图(D0/D5)；经销商经营台并入 `dealer-workbench`（= D-1 去重）。
- **R-4 补设计缺口**：`designer-workbench` 已有 /calc+签章(E2E 通)；`rysnova-bim-workbench` 空壳待补 2D 画布/BOM（= D-2）。
- **R-5 修双后端错位**：把 `design/product-catalog/bim/brand` 补进 Express 代理白名单（四域直连已验 200）。D4「看着有页点了空」的技术根因。
- **R-6 对客分离**：客户视角只进 `customer-portal`，与经销商台同数据不同面。

### 附加：UI/VI 一并进化（2026-07-03 追加）
- **公域面(public/*.html)**：受 `guard:ui-vi` 强约束——须 `rc-scope`+`data-brand` + `rhautt-comfort-tokens.css`，禁 demo/AI 措辞与遗留页链接。
- **React 目标 app**：不在 `guard:ui-vi` 覆盖内，按设计系统 token 单一真相源（`rheem-official-tokens.css`）对齐 `globals.css`，见 `RHAUTT-NEXUS-PAGE-EVOLUTION-AUDIT.md` P0 令牌收敛。

---

## 4. 维护

- 每完成一对收敛或状态变化，更新本表对应行的「当前真相源 / 成熟度 / 差距」。
- 新增双实现配对时追加行，并同步 `RHAUTT-NEXUS-DESIGN-INDEX-AND-ROADMAP.md` §1 文档地图。
