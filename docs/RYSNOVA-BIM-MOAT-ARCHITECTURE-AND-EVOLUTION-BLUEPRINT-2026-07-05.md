# 瑞诺瓦技术支持 BIM · 护城河架构与演进蓝图（单一事实源）

> 状态：现行 · 2026-07-05 · 设计阶段（本文件不含实现代码）
> 定位：板块二第 3 件套「瑞诺瓦技术支持 BIM / Rysnova BIM」的**唯一收敛裁定 + 护城河定义 + 底座/DB 约束 + 演进路线**。
> 上级：`PROJECT-CHARTER.md` > `PRD-v2.md` > `platform-modules.json` > `CLAUDE.md`。
> 平级索引：`RHAUTT-NEXUS-DESIGN-INDEX-AND-ROADMAP.md`（W0–W6 总纲）、`RHAUTT-NEXUS-COMPETITIVE-AND-INTEGRATION-ANALYSIS.md`（造 vs 买）、`RHAUTT-NEXUS-DESIGN-CALC-RECLAIM-PLAN.md`（W1 精算归位）。
> 事实源：实读 `server/modules/rysnova-bim/*`、`services/api/src/modules/rysnova-bim/*`、`services/api/src/modules/design/*`、`server/core/*`、`packages/domain/hvac-kernels/*`、`services/calc-engine/*`、`revit-plugin/*`（2026-07-05）。
> 命名口径：对外锁定 `Rysnova BIM / 瑞诺瓦技术支持 BIM`；历史英文 slug `rysnova` 仅为迁移债务，不得成为新对外文案或新模块命名依据（宪章 §1）。

---

## 0. 为什么要这份文档（问题陈述）

护城河板块「专业与否的分水岭」当前存在**结构性"不伦不类"风险**，且有据可查：同一职能被拆成 **4 个并行 BIM 表面**、命名与语义漂移、护城河押点偏向"自研 3D/CFD 渲染"（与竞品正面拼且必输），而真正的专业根——**规范合规精算门禁**——的骨架已就绪却尚未接通。

本文件的作用：**先收敛概念、锁定护城河、固化底座/DB 约束**，让后续每一步进化都对齐单一事实源，不再各写各的。

---

## 0.5 战略主线：AI-native 对标并超越筑星云/优筑家（★ 核心竞争力，独立发展）

> 用户决断：本板块作为 Rysnova **独立核心竞争力**发展，借 **AI 之力在暖通 BIM 赛道对标并超越筑星云**（上海筑星云计算，2017，国内首家暖通云端 BIM；产品线：优筑家BIM / BIM Ultra / BIM APP / 项目云盘 / ERP）。

**对标结论**（据公开信息；登录墙后能力待实测，见 §10）：
- 筑星云护城河 = **8 年手工设计工具 + 数万素材族库 + 全流程 ERP**（获客→CRM→设计→施工→售后）。正面拼画布/素材/工具 = **必输**。
- **§10 实测判定（2026-07-06 用户确认）**：其暖通计算模块**已硬**——有标准依据、能出计算书、有校验拦截。"合规可辩护" = **入场券而非尖刀**（它有，我们必须有）。
- **尖刀收窄为：AI 生成 × 合规，切口 = 降低使用者难度（用户拍板★）**——优筑家的隐含前提是"你得有一个会用它的设计师"（布管/辅材/系统逐个手画，需培训）；我们把门槛降到"**不会设计的人也能出设计师级、合规可辩护的方案**"。它降低的是设计师的难度，我们降维到不需要设计师。"需求→AI 方案生成"位仍空（`BIM Brain` 仅 CAD→BIM 翻模）；第二差异 = 变更真相源回流 + 报价锁价 + 经销商经营一体化。

**超越命题（四条铁律）**：
1. **基础能力必修，不可避课（用户纠偏★）**：户型绘制/参数化管路/族库/出图清单等基础设计能力**必须补齐**——没有基础能力，AI 与合规只是包装。路径 = 站在 ThatOpen 开源底座上建，功能对标优筑家清单（§6.7），不从零造 3D 内核。
2. **换范式，不在成熟度上决战**：基础能力补齐后，用 AI 把"设计"从"人一笔笔画"变为"**AI 生成 + 人审**"——后来者弯道在此，不在和它拼 8 年工具打磨。
3. **AI × 合规 = 稀缺信任锚**：AI 会幻觉，市面 AI 出图"快但不敢施工"。我方 AI 产出**必过 `calc-gate` 国标硬闸 + 出 `verified` 计算书才能出图**——"快且合规可辩护、敢照施工"。**矛 = AI，盾 = 合规。**
4. **不从零造底层，自研差异层**：3D 内核/IFC/查看用开源（ThatOpen）；求解交 hvacpy `verified`；自研 = **HVAC 参数化几何层 + 合规判断 + 真相源 + 经营闭环 + AI 编排**。

**落地**：新增 `services/ai-design-engine`（§4.4）；路线新增 **W-BIM-AI** 波次（§7），承 W-BIM-1 合规门禁之后作为超越尖刀。**先实测（§10）→ 定尖刀 → 落地**。

## 0.6 板块名称 · 使命 · 愿景（2026-07-06 拍板）

- **名称**：对外品牌 **Rysnova 智设**（Rysnova AI Design）；技术命名空间沿用 `rysnova-bim`（不折腾代码）。
- **使命**：**让不会设计的人，也能做出设计师级、合规可辩护、敢照着施工的暖通方案。**（不会设计的人=经销商销售/技术支持[切口]；设计师级=§6.7 必修；合规可辩护=calc-gate+verified[入场券]；敢照着施工=信任锚[尖刀落点]）
- **愿景**：**让"AI 生成 + 人审"取代"人一笔笔画"，成为中国住宅舒适家暖通设计的新范式；每一份出图的方案，都带着可追溯的计算依据。**
- **口号**：五分钟，出一份敢照着施工的设计。
- **北极星指标**：首方案时长 ≤5 分钟 / 零培训上手率 / verified 方案占出图比例。
- **执行计划**：见 `docs/RYSNOVA-BIM-WORK-PLAN-2026-07.md`（工作计划表，单一执行账本）。

---

## 1. 定位锁定与护城河（不可动摇）

### 1.1 一句话定位

> **Rysnova BIM = 合规精算驱动的深化出图 + 单一真相源同步 + 报价联动 + 产物存证闭环。**
> 3D/IFC 查看能力用成熟开源承接，**不自研渲染引擎**。受众：设计师 / 技术支持（PRD）。IoT 边界：`lifecycle_handoff_only`。

### 1.2 四大护城河（竞品普遍弱，且代码已有骨架）

| # | 护城河 | 现有骨架 | 竞品对照 |
|---|---|---|---|
| ① | **规范合规出图**：GB 底线必算硬闸 + 带出处 `verified` 计算单 | `design/calc-gate.ts`（软闸）+ `packages/domain/hvac-kernels` + `services/calc-engine`(hvacpy) | 鸿业强在规范图，但无租户化 SaaS + 报价联动 |
| ② | **单一真相源同步**：design↔产物 `in_sync/stale/proposed_change` + 变更回流 | `design-sync.service.ts` / `design_rysnova-bim_sync` 表 | 竞品多为单机工具，无跨角色真相源账本 |
| ③ | **报价联动锁价**：`design.changed → outbox → quote 重算`，守价格快照锁 | outbox + `opportunity_id` 软引用 | 酷家乐算量报价强，但非多租户经销商经营闭环 |
| ④ | **产物存证 + 客户签收**：content-hash + 对象存储 + 电子签存证（经销商自负合规，决议#4） | `artifact-storage.adapter` + 8 类产物审批状态机 + 客户签收 | 竞品普遍无合规存证 + 交付签收闭环 |

### 1.3 明确不做（防止"不伦不类"再生）

- **不自研 3D 渲染 / CFD 求解器**去和酷家乐 ML 布点、优筑点云正面拼——必输且分散精力。
- **不引入 AGPL**（xeokit 已排雷为 AGPL-3.0，禁入闭源主干）。
- **不做 IoT 控制平台本体**，只做生命周期交接。
- **不把"五恒"压成"五系统"**（五恒是验收维度，系统是独立交付设备，两层都如实体现）。

### 1.4 参数来源纪律（产品参数必须调用产品模块，严禁硬编码）★

> 用户要点#1：本模块要**调用产品模块的产品参数**。这是护城河可信度的地基——BOM/精算/报价/BIM 产物若各自内嵌设备数值，必然与产品库分叉、报价失真、精算不可辩护。

- **设备参数唯一来源 = 产品模块 product-catalog**（表 `products` + `price_list_items`；读入口 `ProductCatalogService`，**不得直查表**）：型号 / 品牌 / 品类 / `spec`(功率·能效·风量·水量·噪声等) / `listPrice`·`costPrice`·经销商 `dealer_price` / `assetRefs`(role=`bim` 的 Revit 族)。BIM/精算/报价只引用 `productId + snapshotVersion`，**不内嵌数值**。
- **门牌规则（模型B 第1律，实读校准）**：产品**写入**门牌须品牌运营租户 UUID（`requireWriteTenant` 拒绝 `rhautt_shared` 哨兵）；**读取**为 HQ 共享目录（`rhautt_shared` 哨兵不纳 RLS，直读）或品牌 UUID 租户经 `scoped()`(RLS) 读；`price_list_items/product_content/relations` 走 FORCE RLS。
- **反面教材（现状债务，须整改）**：`rysnova-bim-artifact.service.js` 的 `SYSTEM_FAMILY_DEFAULTS`（硬编码 brand/cost/model/baseEquipmentCost）、`LoadCalculationEngineV3` 的硬编码 `U=0.5`/内扰系数——均改为参数化引用。
- **围护/气候/材料参数**走参数化库（`envelopeDatabase` / `ChinaClimateDB`），**禁魔法常数与"放大系数"**。
- **产品参数变更 → 事件 → 关联产物/报价置 stale**（与 design 变更同机制），保证 BOM/报价/精算与产品库同源。

---

## 2. 现状事实（实读结论：4 个并行 BIM 表面）

| # | 位置 | 实际职能 | 关键端点 / 表 | 裁定（见 §4） |
|---|---|---|---|---|
| **A** | Legacy Express `server/modules/rysnova-bim/rysnova-bim-artifact.service.js`（**156KB**）+ `rysnova-bim.routes.js` | **产物注册与生命周期中枢**：8 类产物、审批状态机、content-hash、存储适配器、outbox、客户签收、深化包 | `/api/v2/rysnova-bim/artifacts*`、`/projects/:id/{customer-package,visual-artifacts,deliverable-artifacts,signoff-package,deepening-package}` | **真相源（迁移期主干）→ 逐步迁 NestJS** |
| **B** | NestJS `RysnovaController @Controller('rysnova-bim')` + `RysnovaService` + `rysnova-bim_artifacts` 表 | 产物服务的 NestJS 目标实现（与 A 语义对齐） | 同 A 的产物/项目端点 | **目标承接者（Target）** |
| **C** | NestJS `BimController @Controller('bim')` + `BimService` + `bim_projects` 表 | **名为 BIM，实为交付/生命周期追踪器**：报价承接→BOM→验收清单→IoT handoff→公开查询 | `/bim/inherit/:quotationId`、`/bim/:id/{advance,bom,acceptance,iot-package}`、`/bim/public/:code` | **交付语义，应归位 delivery/lifecycle 域** |
| **D** | NestJS `DesignSyncController` + `DesignSyncService` + `design_rysnova-bim_sync` 表 | **M12 单一真相源同步**（架构最有价值） | design↔artifact 同步账本 | **保留并强化为护城河②** |
| **E** | `server/core/*` 引擎群 | `RysnovaBIMCore`/`BIMExportEngine`/`RevitIntegrationEngine`/`HVAC3DVisualizationEngine`/`MultiDisciplineEngine`/`CFDSimulationEngine`/`CADImporterEngine` | 懒加载「生产孤儿候选」 | **自研 3D/CFD 深度存疑 → 评估替换/归档** |
| **F** | `revit-plugin/`（C#，.NET 4.8） | Revit 双向同步插件，三路合并冲突解决 | **`/api/rysnova-bim-bim/*`**（命名空间与 A/B 不一致）+ clash-detection/cfd/ifc/BVH | **命名空间对齐 + 云能力后端落地** |

### 2.1 关键事实校准

- **产物类型（A）**：`concept-effect-view / principle-diagram / construction-drawing / bim-model / bom / quantity-takeoff / standards-check / customer-report`；状态机 `draft→reviewing→approved→shared→superseded→archived`；`bim-model` 的 `contentKind:'bim'` 当前是**示意/占位，非参数化 IFC 几何**。
- **精算骨架已就绪但未接通（护城河①的缺口）**：`hvac-kernels` 已迁 7 内核（load-calc/hot-water/fresh-air+DOAS/hydraulic/heating/air-conditioning/quotation/noise），`calc-gate.ts` 是国标底线软闸（噪声 GB50118 / 同时系数·水力·结露 GB50736，`insufficient_data` 诚实不伪装通过），`services/calc-engine` 是 hvacpy/ASHRAE 可溯源微服务（`trust_level: verified/estimate/unverified`）。**但 `design.service` 仍走旧壳只调 `quickEstimate`，出图闸未统一强制**。
- **存储适配器（A）**：`MemoryArtifactStorageAdapter` + S3 兼容适配器；产物走对象存储 objectKey + content-hash，DB 存元数据（`rysnova-bim_artifacts.file_key`）。

---

## 3. "不伦不类"风险确诊（结构病根）

1. **一职能四表面 + 命名/语义漂移**：产物服务有 Legacy(A) + NestJS(B) **双写**；`BimService`(C) 名为 BIM 实为交付；API 命名空间三套并存（`/api/v2/rysnova-bim` 、NestJS `/bim`、Revit `/api/rysnova-bim-bim`）。这是"看起来都有、拼起来不成体系"的根因。
2. **护城河押错点**：`HVAC3DVisualizationEngine`/`CFDSimulationEngine` 走自研，方向危险（竞品分析已判"不要正面拼渲染"）。
3. **真几何缺失**：无真正 IFC 参数化几何核，`bim-model` 是 SVG/示意——若把"专业"押在 3D 炫技，两头不到岸。
4. **专业根未接通**：合规精算门禁（护城河①）骨架齐但 `design.service` 未切换，导致"施工图分水岭"当前**无单一闸强制**。
5. **领域能力"伪深"（最隐蔽的不伦不类）**：`LoadCalculationEngineV3` 自称"PhD级/95%精度对标 Carrier HAP/Trane TRACE"，实读为估算+魔法系数（详见 §6.5）。宣称与实力不符，比缺功能更伤专业信誉。
6. **产品参数硬编码**：设备品牌/成本/型号写死在引擎与产物服务内，与产品库分叉（详见 §1.4）。

---

## 4. 目标架构与收敛裁定

### 4.1 分层与真相源

```
apps/rysnova-bim-workbench (设计师/技术支持 UI)  apps/designer-workbench
        │  (禁直连 server；只调 /api/v2/*)
        ▼
services/api  NestJS 模块 rysnova-bim（目标承接者）
   ├─ RysnovaService   产物注册/审批/存证/客户签收   ← 承接 Legacy(A)，A 迁完即下线
   ├─ DesignSyncService 单一真相源同步(M12)          ← 护城河②，保留强化
   └─（交付语义 C 归位 delivery/lifecycle 域，不留在 bim）
        │  AI 设计主线（矛 × 盾）
        ▼
services/ai-design-engine  LLM 编排：方案生成 / 合规审查 / 选型报价
   └─ 产出恒为 estimate/unverified → 必过 calc-gate + 人审签字 → 升 verified 方可出图
        │  调用下层内核（不自造算法/不自出合规结论）
        ▼
packages/domain/hvac-kernels（唯一算法内核） + services/calc-engine（hvacpy verified）
        │  design 为真相源；design.changed → 单一 outbox → quote 重算 / 产物置 stale
        ▼
PostgreSQL(RLS 结构化) + MongoDB(RysnovaArtifact 文档/设计上下文) + 对象存储(IFC/图纸/点云)
```

**真相源铁律**：`design`（DesignProject/FloorPlan/BOM/计算结果）是业务真相源；Rysnova 产物**派生登记**于 `design_rysnova-bim_sync`；变更走双向同步，**禁止静默分叉**。

### 4.2 收敛裁定表

| 对象 | 裁定 | 触发下线/归位条件 |
|---|---|---|
| A Legacy artifact.service(156KB) | 迁移期真相源 → 逐步迁入 B | B 通过契约测试 + 灰度100% + 观察2周（MASTER B4） |
| B NestJS RysnovaService/artifacts | **目标承接者** | 补齐 A 的能力对等 + 对象存储证据闸 |
| C BimService/bim_projects | **交付语义归位** delivery/lifecycle | 端点迁移 + 前端引用切换后，`bim` 仅保留 BIM 语义 |
| D DesignSyncService | 保留强化（护城河②） | `changeProposal` 升级 BCF 标准 |
| E core 3D/CFD 引擎 | 评估：真几何/仿真价值不足则**归档**，查看能力转 That Open Engine (MIT) | 竞品分析 §二/三 已给方向 |
| F Revit 插件 | 命名空间对齐 `/api/v2/rysnova-bim/*`；云能力(clash/ifc)后端落地 | 与 B 端点契约统一 |

### 4.3 命名空间统一（消除三套并存）

- 对外 API 统一 `/api/v2/rysnova-bim/*`。
- Revit 插件 `/api/rysnova-bim-bim/*` → 迁 `/api/v2/rysnova-bim/*`。
- NestJS `@Controller('bim')`（交付）迁出 → `delivery`/`lifecycle`；`rysnova-bim` 仅承载 BIM 语义。
- 表名遗留连字符（`rysnova-bim_artifacts`、`design_rysnova-bim_sync`）作为迁移债务登记，新表用下划线规范命名。

### 4.4 AI 设计引擎（`services/ai-design-engine`）技术设计

> 定位：独立微服务（与 `calc-engine` 同级），**LLM 编排层，不含算法真身**——只调 `hvac-kernels`/`calc-gate`/`product-catalog`/`calc-engine`。承 §0.5 超越命题。

**六大能力（全部产 draft → 审 → 出图）**：
1. **AI 方案生成**：户型 + 需求 → 系统选型 + 设备布局 + 管路草案。
2. **AI 负荷精算**：调 `calc-engine`(hvacpy) 出 `verified` 计算书。
3. **AI 合规审查**：`calc-gate` 硬闸结果 + LLM 解读国标 → 挑错 + 修改建议。
4. **AI 选型报价**：自然语言 → `product-catalog` `recommend`/`getDealerPrice`（§5.6） → 报价。
5. **AI 出图/BOM**：方案 → 施工图 + 清单（接 That Open / kernels）。
6. **AI 交付协同**：变更影响分析、客户自然语言问答、隐蔽工程追溯。

**信任状态机（防幻觉核心）**：
`ai_draft(unverified)` → `calc_gate_check` →（pass）`estimate` →（hvacpy 复算 + 人审签字）`verified` →（出图闸放行）。任一步 gate fail 或数据不足 → `insufficient_data`：**禁默认值伪装、禁 unverified 出图**。

**编排铁律**：
- LLM 只做"意图→参数→调用编排→解释"；**数值与合规判定一律由 kernels/gate 裁决，LLM 不得自出合规结论或编造计算值**（承 §6.5 诚实纪律）。
- 全程留痕：prompt / 模型版本 / kernel 版本 / gate 结果 / 人审签字 入审计（可辩护）。
- `trust_level` 与 §5.2 一致；AI 草稿存 MongoDB，`verified` 结果与产物走对象存储 content-hash；**不新增第二真相源，AI 结果回流 `design`**。

**接口契约（草案）**：
- `POST /ai-design/propose` `{floorPlan, requirements}` → `{draftId, proposal, trust:'unverified'}`
- `POST /ai-design/review` `{designId}` → `{gateResult, issues[], fixes[]}`
- `POST /ai-design/select-quote` `{designId}` → `{bom, priceBands, trust}`
- 出图仅经 `design` 域 `verified` 门禁（§7 W-BIM-1）。

**体验北极星（切口：降低使用者难度，§0.5 用户拍板）**：
1. **输入极简**：户型图拍照/CAD 上传 + 自然语言需求（"预算 15 万、五恒、主卧要安静"）——不要求用户会画图。
2. **默认即专业**：生成方案自带负荷计算/管径选型/合规校验，用户无需知道 GB50736 是什么。
3. **改动即重算**：任何修改自动触发重算重审，用户永远不手动"跑计算"。
4. **角色阶梯**：销售 5 分钟出谈单方案(estimate) → 技术支持一键升 verified → 设计师只处理 AI 标记的 `insufficient_data` 项。
5. **输出即交付**：方案+计算书+报价+施工图一次生成，不要求用户在多个模块间搬运。

**度量指标**：首方案时长（目标 ≤ 5 分钟）、零培训上手率、人工操作步数（vs 优筑家手布管路径）——与优筑家的对比基准集按此三项评测。

---

## 5. 底座与数据库约束（★ 用户明确要求：每一步进化都须遵守）

> 这些是硬约束，不是建议。任一步 PR 未过对应门禁即不放行。

### 5.1 多租户与归属（防 IDOR）

- BIM 全表挂 `tenant_id` + **FORCE RLS**，读写走 `withRlsTransaction`（`SET LOCAL` → `tenant_id = current_tenant_id()`）。RLS 地基已本机验证（`db:rls-proof` 6/6，MASTER Part 7）。
- RLS 仅兜 tenant；`bim_projects`/`rysnova-bim_artifacts` 有 `dealer_id`/`store_id`，**所有按 id 读写须叠加归属谓词**（`ownershipScope`），不存在或不属于该经销商一律抛 404，不泄露存在性。
- 跨租户公开读（客户凭码查进度）走 **SECURITY DEFINER** 函数（`rhautt_nexus.bim_public_lookup`）绕 FORCE RLS，绕过面收敛到最小查询。

### 5.2 数据分层与大产物

- **PostgreSQL**：结构化（项目/BOM/成本/验收/同步账本/校验结果）。
- **MongoDB**：`RysnovaArtifact` 文档、设计上下文、AI 草稿/对话。
- **对象存储（file-artifact）**：IFC/图纸/点云/PPT 等大产物；DB 只存**元数据 + content-hash(sha256) + objectKey**。受 `guard:object-storage-evidence`（外部往返证据 `finalLaunchEligible`）约束。

### 5.3 事件与一致性

- **单一 `outbox_events`**（`mdm_outbox_events` 已并入，`event_source`/`aggregate_type` 区分）；Postgres 事务性 outbox + 轮询投递（C1，不引 MQ）。
- 跨件套**软引用**（`intake_lead_id → customer_id → opportunity_id → 产物 → lifecycle_link_id`），**无硬外键**，应用层聚合。

### 5.4 边界与门禁

- `apps` 禁直连 `server`；禁重写 kernels；禁跨应用 import（`guard:nestjs-boundary`）。
- 新逻辑写 `services/api/src/modules/`，不再往 `server/modules/` 加。
- 每步必过：`guard:postgres-rls-behavior` · `guard:object-storage-evidence` · `guard:nestjs-boundary` · `guard:rysnova-bim-production-ux` · `test:contracts`(OpenAPI) · `test:tenant-isolation`(RLS)。

### 5.5 产品参数一致性（数据层，配合 §1.4）

- 产品库表 `products`（默认 `tenant_id='rhautt_shared'` 共享目录直读；品牌运营行在 UUID 租户下经 RLS scoped）为设备参数单一事实源；BIM 产物/精算/报价存 `productId + snapshotVersion`，不复制数值。
- 签单锁价时对所引用产品参数做**快照**（价格快照锁）。
- **产品变更事件（待建，W-BIM-2 前置）**：当前 `ProductCatalogService.upsert` 未发 outbox；须补 `product.updated` 经单一 `outbox_events` 广播 → 关联未锁定产物/报价置 `stale`/待复算（与 design 变更同机制）。

### 5.6 BIM→产品模块消费契约（要点#1 落地，只读消费）

> 唯一入口 = `product-catalog` 服务；BIM/精算/报价**不得直查 `products` 表**，不复制数值。

| 需求 | 端点 / 服务方法 | 返回 | 备注 |
|---|---|---|---|
| 单件设备参数 | `GET /product-catalog/devices/:id`（`get`） | 完整 `ProductEntity`（`spec/brand/category/listPrice/costPrice/assetRefs`） | 内部（经销商侧）可含 cost |
| 按品类/关键词筛选 | `GET /product-catalog/devices?category=&q=&status=active`（`list`） | 上架列表（严格 AND + 定位维度） | — |
| 画像/痛点选型推荐 | `POST /product-catalog/recommend` | 脱敏卡 + `matchScore`（**无 cost**） | 消费方须把系统语义映射为 taxonomy code 传入，D2 语义无关 |
| 系统价格带（初步报价） | `priceBandsForSystems()`（服务内） | 各系统 `listPrice` 分布，无匹配 `priced:false` | 牌价，公开安全 |
| 经销商成交价 | `getDealerPrice(tenantId,dealerId,productId)` | `{listPrice, dealerPrice}` | `dealer_price` 受 FORCE RLS |
| BIM 族 / 参数表 / 认证 | `product.assetRefs`（role=`bim`/`spec`/`cert`） | DAM `artifactId + objectKey` | 只存引用 |

**契约铁律**：① 系统→taxonomy code 的语义映射由消费方（BIM/报价）持有并传入，`product-catalog` 保持语义无关（防耦合）；② 无匹配/无价 → `priced:false`/`insufficient_data`，**不臆造默认值**。

### 5.7 硬编码 → 产品/定额来源对照（整改 `SYSTEM_FAMILY_DEFAULTS` / `LoadCalcV3`）

> 关键：`SYSTEM_FAMILY_DEFAULTS` 混装了三类，**不能全塞进 product-catalog**——设备身份/价格归产品库，工程定额归定额库，规范归标准库。

**A. 设备身份与价格 → product-catalog**

| 现硬编码 | 迁往 |
|---|---|
| `brand` | `products.brand` |
| `equipmentName` / `model` | `products.name` / `spec.model`（或 `sku`） |
| `baseEquipmentCost` | `products.costPrice`；成交价经 `getDealerPrice → dealer_price` |
| `category` | `products.category` |
| 能效/风量/水量/噪声等设备参数 | `products.spec.*`（约定字段，须定 spec schema） |
| BIM 族 | `products.assetRefs[role=bim]` |

**B. 工程定额与规范 → 不属产品库，另置**

| 现硬编码 | 归属 |
|---|---|
| `pipePerArea` / `valveBase` / `laborPerArea` | **工程定额库**（installation quota，另建；非 product-catalog） |
| `standards`（GB 55020/50736…） | **calc-gate / 标准库**（规范判定，非产品字段） |
| `LoadCalcV3` 的 `U=0.5` / 内扰系数 / 气候 | **参数化围护/气候库**（`envelopeDatabase` / `ChinaClimateDB`），禁魔法常数 |

**缺口规则**：产品库或定额库缺字段 → 精算/报价走 `insufficient_data` 诚实路径，**禁默认值伪装通过**（承 `calc-gate` 语义）。

---

## 6. 竞品对齐与造 vs 买（据竞品分析文档）

| 能力 | 决策 | 选型 | 许可证 |
|---|---|---|---|
| 3D / IFC 查看器 | **买/集成，不自研** | That Open Engine `@thatopen/components`+`fragments` + web-ifc + three | MIT / MPL-2.0 ✅ |
| 精算引擎可信化 | 集成（独立 Python 微服务） | hvacpy(ASHRAE) → `services/calc-engine` | MIT ✅ |
| 变更回流标准化 | 采标准替自定义 jsonb | BCF（BIM Collaboration Format） | 开放标准 |
| 价格护栏/规则 | 集成 | json-rules-engine | ISC ✅ |
| 点云高端层（对标优筑） | P2 评估 | That Open / Potree(BSD) | 非 AGPL |
| ~~xeokit~~ | **禁入**（AGPL-3.0） | — | ❌ |

**风险闸**：所有引入项先过许可证审查（GPL/AGPL 禁入闭源主干）+ SBOM 登记。

> 用户要点#2：**3D 与算法都去公开市场选优秀开源，不全自研——太复杂、也拼不过垂类巨头**。据此，`LoadCalculationEngineV3` 的第一性原理逐时精算**降级**（不对外宣称精度），逐时/精算交 `services/calc-engine`(hvacpy, ASHRAE 可溯源) 出 `verified`；3D/几何交 That Open Engine。平台只保留**合规判定门禁 + 出处链 + 报价联动**这三件竞品都弱、我方真懂的事。

---

## 6.5 领域能力诚实体检（★ 我们是否真懂暖通设计）

> 用户要点#3：本模块的挑战是"我们是不是真的懂暖通空调设计"。护城河的本质不是代码，而是**把暖通设计的标准与优化逻辑正确编码**。以下是实读内核后的诚实结论，分"真懂 / 伪深"两类，不粉饰。

### 6.5.1 系统标准层级（合规底线，必须先对）

标准优先级（宪章级：中国强制通用规范先行，旧设计标准仅作详细参考）：

1. **国家强制通用规范（GB 55xxx，底线红线，最先）**：GB 55015 建筑节能、GB 55020 建筑给水排水、GB 55037 建筑防火等——不可越过。
2. **国家标准 GB 50xxx（设计规范）**：GB 50736 民用建筑供暖通风与空调、GB 50019、GB 50118 民用建筑隔声、GB 50015 建筑给排水、GB 5749 生活饮用水卫生、GB 50242 等。
3. **ASHRAE 62.1/90.1/55、协会/行业指南**：仅作**方法来源与详细参考**，不得凌驾国标。
4. **企标**：可更严收紧，**不可更松**（`calc-gate` 的 override 只允许收紧阈值）。

### 6.5.2 我们**真懂**的（护城河级，编码正确、可辩护）

以 `DOASComplianceEngine` + `calc-gate.ts` + `noise` kernel 为证——这些是"专业 vs 玩具"的真分水岭，且竞品普遍不做：

- **温湿度独立控制（DOAS）**：送风 22℃ 不承担室内显热、负荷分离、温湿度独立——理念正确编码。
- **DOAS↔辐射协调防结露**：送风温度须高于辐射表面 ≥3℃、露点 ≤10℃——物理正确、可判定。
- **热回收能效门槛**：SRE≥75% / LRE≥60%（ASHRAE 90.1）、再热模块必需、深度除湿露点 ≤10℃——标准可溯源。
- **必算硬闸（施工图分水岭）**：噪声 GB50118、同时使用系数 GB50736(0.6–1.0)、水力平衡偏差 ≤±15%、结露余量 ≥1℃——软闸 + 签字越过 + `insufficient_data` 诚实不伪装通过。

**结论**：合规判定与工程判断这一层，是真能力，应作为护城河核心持续加固。

### 6.5.3 **伪深**处（必须诚实降级，勿对外宣称）

以 `LoadCalculationEngineV3` 为证（自称"PhD级 / 95%精度对标 Carrier HAP、Trane TRACE"）：

- 实读为**工程估算 + 魔法系数**：`U=0.5` 硬编码平均U值、围护逐时 `* 10 // 放大系数`、热容 `surfaceArea*50 // 估算值`、8760 为"简化"日峰值×曲线、Hybrid 用 `RTS×0.6+Harmonic×0.4` 任意加权再自称"提高精度"（**方法学不成立**：两个近似平均不产生更高精度）。
- 定义了 `envelopeDatabase` 却未在计算中调用；气候仅 ~12 城硬编码（**非宣称的 200+**）。
- **结论**：**"95%精度对标 HAP/TRACE" 不可辩护，是夸大**——这正是"不伦不类"的领域版本：宣称 PhD 级，实为估算。
- **处置**：不与 HAP/TRACE 正面拼第一性原理精算；逐时/精算交 `services/calc-engine`(hvacpy, ASHRAE 可溯源) 出 `verified`，平台保留 compliance gate + 出处链。LoadCalcV3 降级为"方案前期快估"，**去除一切精度/PhD/对标宣称**。

### 6.5.4 设计优化：护城河应体现的工程判断（而非渲染）

真正体现"懂设计"的，是这些优化维度被正确权衡并**留痕可溯**：

- **系统选型判断**：辐射+DOAS vs 风机盘管+新风；温湿度独立 vs 混合承担——初投资/舒适/能效落差如实呈现，不藏。
- **负荷不简单累加**：多区必给同时使用系数（否则设备过大、能效差、结露风险↑）。
- **水力平衡**：最不利环路偏差 ≤±15%，否则平衡阀 / 重选管径。
- **结露风险闭环**：冷表面温 vs 室内露点余量 ≥1℃，恒湿维度独立除湿。
- **能效与运行**：热回收效率、部分负荷、SCOP/IPLV；报价联动呈现全生命周期成本。

优化产物必须**可追溯到标准与计算单（verified）并回流真相源（BCF）**，才叫"专业深化"，否则只是好看的图。

### 6.5.5 诚实差距表

| 能力 | 现状 | 裁定 |
|---|---|---|
| DOAS / 结露 / 噪声 / 同时系数 / 水力 合规判定 | 真懂、编码正确 | 护城河核心，加固 |
| 温湿度独立控制 / 辐射协调 | 真懂 | 加固 |
| 第一性原理逐时负荷精算 | 伪深（估算+魔法系数+夸大宣称） | 降级 + 交 hvacpy `verified` |
| 设备选型 / 能效精算 | 依赖设备参数，当前部分硬编码 | 参数改调产品模块（§1.4） |
| 3D / 几何 / CFD | 自研浅 | 交 That Open，勿自研 |

---

## 6.6 竞争错位：对标筑星云/优筑家（攻其空白，避其资产）

> **§10 实测已判定（用户确认）**：优筑家计算模块已硬（标准依据/计算书/校验拦截均备）。**合规 = 入场券，尖刀 = AI 生成×合规，切口 = 降低使用者难度**：它要你养一个会它的设计师；我们让不会设计的销售/技术支持也能 5 分钟出设计师级、合规可辩护的方案——**敢照着施工的 AI 设计，零门槛**。

| 维度 | 筑星云/优筑家（8 年） | Rysnova BIM（错位） |
|---|---|---|
| 设计画布/绘图工具 | 成熟（临摹户型/画墙/参数化管路/辅材吸附/吊杆） | **必修补齐**：ThatOpen 底座上建（§6.7 功能对标清单），再叠 AI 生成 |
| 素材/族库 | **已有品牌厂商真实族库（尺寸/外观/设备参数可查）★官网实证** | "族=真产品"不再独有；差异升级 = **族参数直连 kernels 计算 + 报价锁价**（其族参数是否喂计算/报价联动，§10 实测） |
| 全流程 ERP | 获客→CRM→设计→施工→售后 | 已有经营闭环，不作主打差异 |
| 国标合规硬闸 + 计算书 | **已具备（§10 实测确认：标准依据 + 计算书 + 校验拦截）** | **入场券必修**：`calc-gate`+`verified` 达 parity；差异仅在出处链深度（hvacpy 逐时精算 + 参数→公式→条款全链留痕） |
| **变更真相源 + 锁价** | 未突出（联动深度可继续实测） | ★ 第二差异：`design-sync` 回流 + 报价快照锁 |
| **AI 生成 + 合规背书（★ 唯一尖刀）** | `BIM Brain` 实为 **AI 翻模（二维CAD→三维BIM 识图/构件生成）★官网实证**，非方案生成 | ★ **"需求→AI 方案生成"位仍空**；AI生成×国标硬闸×verified出处×报价闭环 一体化 = W-BIM-AI 主攻 |

**外部坐标补充（实测/学习对象）**：
- **InstalSystem 5**（波兰 InstalSoft）：计算驱动专业 BIM（建模+负荷计算+辐射冷暖交互式计算选型+IFC），其推广语录直接把优筑家(YZJ)归为"画图BIM"、自许"符合标准、结果确定、有数据支撑"——**我方"合规可辩护"路线的现成国外样板，首要学习对标**。
- **PKPM-AIChecker / Fast AI 审图**：国内 AI 规范审查已有玩家，"合规检查"非无人区；我方独特性靠**暖通经销商场景的一体化闭环**，非单点审图。
- **筑星云 viewer 技术栈实证**（view.zhuxingyun.com 前端产物）：React(webpack) + 自研 `dogfish` 引擎 worker——同样是"web 开源生态 + 自研几何/渲染层"路线，印证我方 ThatOpen 路径正当。

### 6.7 基础能力必修清单（★ 对标优筑家逆向；没有基础能力，包装无用）

> 用户纠偏：这些都要学、都要有——错位是"不在成熟度上决战"，不是缺课。底座 = `@thatopen/components`+`fragments`+`web-ifc`+`three-mesh-bvh`；自研仅 HVAC 参数化几何层。

| # | 能力（对标优筑家实证功能） | 我方路径 |
|---|---|---|
| 1 | 户型绘制：临摹户型图/画墙/画房间/多层别墅 | ThatOpen 上自建轻量户型层（或导入 CAD/点云底图） |
| 2 | 参数化管路：类型/材料/**直径/壁厚**/颜色/工作平面；连接点吸附布管；变径辅材自动吸附；拆分/吊杆 | **自研 HVAC 参数化几何层**（three.js 之上，核心投入） |
| 3 | 分系统建模：新风/采暖(PE/PB/PERT，DN/De)/空调/水电 | 同上，系统层语义接 `hvac-kernels` |
| 4 | 族库：品牌真实族（优筑家**已有**，尺寸/外观/设备参数可查） | 族 = 真产品（`products.assetRefs[bim]`，§5.6）；**差异在族参数直连计算与报价，非族本身** |
| 5 | 出图/清单：工程图含**尺寸链+图签（A3/比例/设计审核栏）★截图实证**、材料清单、全景渲染 | kernels 出 BOM + ThatOpen 出图/DXF；渲染不拼高精，够用即可 |
| 6 | 云端协同：保存/多端查看/版本 | `fragments` 流式加载 + 对象存储 + design-sync |
| 7 | 查看器体验（★截图实证）：分楼层/分系统/分构件显隐与透明度、回路引线标签（长度/管径/DN）、运行模拟播放（谈单利器） | ThatOpen hider/clipping/标注可覆盖显隐与标签；**我方标签升级：点开即见计算依据（负荷/流量/压降/标准条款）** |

**验收口径**：以优筑家公开功能为 feature-parity 基线，逐项对勾；差异化不在"画得更好"，在 **族=真产品 + 画完即算（kernels）+ 算完即审（calc-gate）+ 审完即报价**。

### 6.8 国内外同类产品持续学习机制（★ 用户要求：常设机制，非一次性）

> 节奏：**每个 W-BIM 波次启动前刷新对应标杆行**；每季度全表扫描一次新品/新版本。证据（截图/报告样张/功能清单）归档 `docs/competitor-evidence/`，结论回写本表与 §10。

**标杆登记册（2026-07 首轮）**：

| 标杆 | 类型 | 核心能力（已抓取实证） | 我们学什么 | 对应波次 |
|---|---|---|---|---|
| 优筑家/筑星云（国内） | 住宅暖通云 BIM | 参数化管路/品牌族库/计算模块/AI 翻模/工程图 | feature-parity 基线（§6.7） | W-BIM-4 |
| InstalSystem 5（波兰） | 计算驱动专业 BIM | 负荷计算+辐射冷暖交互式计算选型+IFC | "符合标准、结果确定、数据支撑"的产品化 | W-BIM-1 |
| **Carrier HAP v6**（美） | 负荷/能耗精算 | ASHRAE Heat Balance、EnergyPlus 引擎、62.1 通风、系统/分区/房间三级热平衡报告 | **计算书报告体系标杆**（verified 出处链学它） | W-BIM-1 |
| **Trane TRACE 3D Plus**（美） | 设计+能耗分析 | EnergyPlus、ASHRAE 140 合规、90.1/LEED 向导、临摹户型、**TOPSS 厂商设备数据直连**、**内置校验智能防错**、20 方案并比 | 设备数据直连计算（=族参数直连）；**内置校验拦截先例**；多方案比选 | W-BIM-1/AI |
| **MagiCAD**（芬） | 专业 MEP BIM | 验证过的海量厂商产品库、Revit 深度集成、选型计算一体 | 厂商库+计算一体化；**其"学习曲线陡"= 我方切口反证** | W-BIM-4/5 |
| **LoopCAD**（加） | 住宅辐射采暖 | **自动盘管生成（自动绕障碍）**、**边画边算负荷（Manual J/F280/ASHRAE 认证）**、水力计算、材料清单+报价、OEM 厂商版 | **W-BIM-AI 最直接功能对标**：自动生成+画完即算已被实现，是"规则自动化"成熟先例 | **W-BIM-AI** |
| **LG LATS 全家桶**（韩） | 厂商选型+自动设计 | LATS Load（**新手也能算负荷**）/HVAC 选型校验/CAD **自动布管+自动选型+自动放机**/Revit/Airflow（**非专家做 CFD**）/Control | **厂商系"降低使用者难度"已在跑**；自动设计=规则引擎先例；我方=多品牌+经销商版 LATS | W-BIM-AI |
| **Daikin VRV Xpress / DST**（日） | 厂商选型 | 选型后**自动生成管路图+接线图**、自动出 BIM/Revit 模型+规格书，面向销售人员 | 面向销售的极简选型流（切口同源） | W-BIM-AI |
| Johnson Controls（美） | 楼控+设计工具 | 待抓取（用户点名） | 控制设计/楼宇自控与设计联动 | 待研 |
| PKPM-AIChecker / Fast AI 审图（国内） | AI 规范审查 | 规范合规性检查 | 审图不是无人区，做暖通专项差异 | W-BIM-1 |

**首轮机制性结论（改判两件事）**：
1. **W-BIM-AI 去风险**：自动盘管（LoopCAD）、自动布管选型放机（LATS CAD）、自动管路接线图（VRV Xpress）都是**已验证的规则自动化**——我方 AI 引擎 = **规则自动化打底 + LLM 意图/编排层**，不是纯 LLM 赌博（§4.4 编排铁律的又一依据）。
2. **切口全球同频**：LG"新手也能算"、Daikin"面向销售"、MagiCAD"学习曲线陡"被诟病——**"降低使用者难度"是国际厂商正在抢的位**，我方差异 = 多品牌中立 + 经销商经营闭环 + 中国住宅舒适家场景 + 国标合规。

**深水区纪律（★ 用户拍板 2026-07-06：禁闭门造车）**：
自此进入技术深水区，**每个重大技术决策（参数 schema / 几何算法 / 计算方法 / AI 编排构型）落地前，必须先引外部参照，设计说明须带"外部参照"段**，无参照不动工。参照源登记：
- **开源实现**：ThatOpen 官方 examples/docs、Speckle（BIM 数据平台范式）、IfcOpenShell、FreeCAD Arch/BIM workbench（参数化几何参照）
- **标准文本**：GB 50736/50118/JGJ142、ASHRAE HOF/62.1/Manual J（计算方法出处）
- **产品实证**：本登记册标杆（LoopCAD 自动盘管逻辑、LATS 自动布管、HAP 报告体系）+ `docs/competitor-evidence/`
- **社区**：OSArch（开源 AEC 社区）、ThatOpen 社区——疑难杂症先搜后问

---

## 7. 演进路线（W-BIM，逐一进化；每步须过 §5 门禁）

| 波次 | 内容 | 依赖 | 验收红线 |
|---|---|---|---|
| **W-BIM-0 收敛正名** | C 交付语义迁 delivery/lifecycle；统一 `/api/v2/rysnova-bim`；A↔B 双写登记与切换计划；表名债务登记 | — | 端点收敛矩阵(§9)无冲突 + 契约测试通过 |
| **W-BIM-1 接通精算门禁（护城河①，最高 ROI）** | `design.service` 切 `hvac-kernels` + `calc-gate` 强制出图闸 + 接 `calc-engine` 的 `verified`；未迁真身(OneClick/FiveConstant/WaterSystem/CommercialTax)先迁 kernels；**`LoadCalculationEngineV3` 降级为"方案前期快估"并删除一切 PhD/95%/对标 HAP-TRACE 宣称**；精算入参的设备参数改调产品模块(§1.4) | W1 | 精算基准集 + `POST /design/calc` + verified 门禁生效 + 无"精度宣称"残留 |
| **W-BIM-2 真相源同步标准化（护城河②）** | `design-sync` 的 `changeProposal` 升级 BCF；`design.changed → outbox → 产物 stale + quote 重算` | W-BIM-1 | design↔产物 stale/回流用例 + 快照锁联动 |
| **W-BIM-3 产物对象存储化 + 存证（护城河④）** | A→B 产物迁移；对象存储外部往返证据；客户签收 + 电子签存证 | W-BIM-0 | `object-storage-evidence` 外部往返 + 签收闭环 |
| **W-BIM-4 3D 底座 + 基础设计能力（必修）** | 自研 `HVAC3DVisualizationEngine` → `@thatopen/components`+`fragments`+web-ifc（web-ifc-three/viewer 已废弃勿用）；E 引擎评估归档；**按 §6.7 清单补齐户型/参数化管路基础能力（HVAC 参数化几何层自研）** | W-BIM-3 | 查看器接 approved 产物 + 许可证审查 + §6.7 feature-parity 逐项对勾 |
| **W-BIM-5 Revit 命名空间对齐 + 云能力落地** | F 插件迁 `/api/v2/rysnova-bim`；clash/ifc 云能力后端契约统一 | W-BIM-4 | Revit↔平台契约测试 + 双向同步 e2e |
| **W-BIM-AI 唯一尖刀：AI 设计引擎（★ §10 已判定成立）** | 建 `services/ai-design-engine`（§4.4）：AI 方案生成 / 合规审查 / 选型报价；信任状态机 `unverified→estimate→verified`；防幻觉门禁（LLM 不自出合规结论/计算值） | W-BIM-1（合规门禁=入场券，优筑家已有故必修） | AI 方案必过 calc-gate + 出 verified 才出图；全程留痕可辩护；基准集对比筑星云 |

**依赖主线**：`W-BIM-0 ─┬─ W-BIM-1(护城河根，可先行)`；`W-BIM-0 → W-BIM-3 → W-BIM-4 → W-BIM-5`；`W-BIM-2` 承 1；**`W-BIM-AI` 承 W-BIM-1（合规门禁是 AI 的盾），且须先过 §10 实测**。

**贯穿全程的两条纪律**（每波都查）：① 产品参数只引用产品模块（§1.4/§5.5），PR 增量禁新增硬编码设备数值；② 算法/3D 优先集成开源（§6），自研须书面论证不可替代性（对应 D-BIM-4）。

---

## 8. 已拍板 D-BIM 决议（2026-07-06 锁定，用户"全按建议"）

以下五项决议已拍板，后续实现不再重开讨论；若执行中发现新约束，须提交变更申请（CHG）并附外部参照。

- **D-BIM-1** C 交付语义归位目标域：**并入现有 `delivery` / `lifecycle` 模块**。`bim_projects` 不再承载交付语义，仅作为项目容器/索引；交付生命周期、签收、验收、IoT 套餐由 `delivery` / `lifecycle` 正交承接。`W-BIM-0` 负责端点收敛与双写切换。
  - 行动项：建立 `delivery.rysnova_bim_releases` 视图；`bim_projects` 删除 `delivery_status`、`signoff` 字段，改为 `project_id` 引用。
- **D-BIM-2** A(156KB) 迁 B 的粒度：**按产物类型分批迁**，禁止整体迁移。顺序：releases → artifacts → drawings → quotes；每批迁移后进入 **2 周双写观察期**，以 `checksum` + `integrity` 断言 100% 通过为切换信号。
  - 行动项：在 `delivery` 模块新增 `legacy_bim_artifact_id` 与 `artifact_integrity` 表；`W-BIM-0` 完成登记与回滚脚本。
- **D-BIM-3** BCF 采用范围：**仅 `changeProposal` 载荷结构**，不实现完整 OpenCDE BCF API。优先用 `design-sync` 的 `changeProposal` + `outbox` 完成变更通知、产物 stale 标记与报价重算。
  - 行动项：定义 `design.change_proposal` JSON Schema（含 `topic_guid`、`comment`、`viewpoint_snapshot`、`stale_targets`）；`W-BIM-2` 实现消费端。
- **D-BIM-4** E 引擎处置：**`RysnovaBIMCore` / `MultiDisciplineEngine` 归档评估，不做 3D 底座**。经 ThatOpen + fragments + web-ifc 替代性评估，其多专业协调价值可被开源栈 + 自研 HVAC 参数化几何层覆盖，无不可替代性证据。
  - 行动项：创建 `docs/adr/D-BIM-4-engine-archival.md` 记录评估结论；`W-BIM-4` 用 `@thatopen/components` 重建查看器，旧 E 引擎代码移入 `archive/bim-legacy-engine/` 并加只读标记。
- **D-BIM-5** 对象存储 provider（生产）：**S3 兼容接口**。生产默认 AWS S3；国区合规要求切换至阿里云 OSS（同样 S3 兼容）。开发/CI 使用 MinIO。外部往返证据（桶策略、上传/下载日志、跨区复制测试）存档于 `object-storage-evidence/`。
  - 行动项：新增 `packages/infra/object-storage` 抽象层；`W-BIM-3` 完成 MinIO 本地证据与 S3 生产证据各一份。

---

## 9. 附录 · 端点收敛矩阵（当前 → 目标）

| 当前 | 职能 | 目标 |
|---|---|---|
| `POST /api/v2/rysnova-bim/artifacts`（A/B） | 产物创建 | 保留（NestJS B 承接） |
| `GET /api/v2/rysnova-bim/artifacts/:id/{integrity,download,download/content}` | 产物完整性/下载 | 保留 |
| `POST /api/v2/rysnova-bim/projects/:id/{visual,deliverable,signoff}-artifacts` | 产物生成 | 保留 |
| `POST /api/v2/rysnova-bim/projects/:id/customer-signoff` | 客户签收 | 保留（护城河④） |
| NestJS `POST /bim/inherit/:quotationId` | 报价承接 | 迁 `delivery` |
| NestJS `PUT /bim/:id/{advance,acceptance,iot-package}` | 交付/验收/IoT | 迁 `delivery`/`lifecycle` |
| NestJS `GET /bim/public/:code` | 客户凭码查进度 | 迁 `delivery`（SECURITY DEFINER 保留） |
| Revit `/api/rysnova-bim-bim/*` | Revit 同步/clash/ifc | 迁 `/api/v2/rysnova-bim/*` |
| `POST /design/calc`（W-BIM-1 新增） | 精算+出图闸 | `design` 域，喂 verified 门禁 |
| `POST /ai-design/{propose,review,select-quote}`（W-BIM-AI 新增） | AI 方案生成/合规审查/选型报价 | `ai-design-engine`，产出经 verified 门禁出图 |

---

## 10. 附录 · 筑星云/优筑家实测清单（★ 先实测，再定尖刀）

> 目的：验证"合规可辩护"是否**真为其空白**（§0.5/§6.6 的尖刀成立前提）。注册 `uzhujia.com` / `accounts.zhuxingyun.com` 试用号，按项打勾取证（截图存档）。

**A. 负荷与精算**
- [ ] 有无冷/热负荷计算？逐时还是估算？
- [ ] 依据哪套标准（GB50736/ASHRAE）？是否可见公式/参数？
- [ ] 是否输出可下载计算书？计算书是否标注出处/标准条款？
- [ ] ★截图已证：地暖回路标签仅几何统计（长度/管径，全 20mm）——**实测回路长度/管径背后有无房间负荷与水力平衡依据**（回路 60.76~76.76m 离散 16m，有无平衡校核？）

**B. 合规校验**
- [ ] 有无国标规范校验（噪声/同时系数/水力/结露/新风量）？
- [ ] 不合规是**拦截出图**还是仅提示？
- [ ] 有无独立"合规报告"产物？

**C. 选型与报价**
- [ ] 选型是否基于负荷自动匹配？多品牌还是绑定单一品牌？
- [ ] 是否出报价？报价与设计变更是否联动？

**D. 变更与真相源**
- [ ] 改设计后，报价/清单/图纸是否自动置为"待更新"？
- [ ] 有无变更影响分析 / 版本比对？

**E. AI 能力**
- [ ] 有无 AI 自动生成方案 / 自动布局 / 自然语言交互？
- [ ] AI 产出是否有合规校验背书？

**F. 外部标杆对照**
- [ ] 对照 **InstalSystem 5**：优筑家 vs InstalSystem vs 我方，在"计算/标准/数据支撑"三维的差距（InstalSystem 为合规可辩护路线现成样板）。
- [ ] 实测 `BIM Brain 图灵版` 与 `CAD审图大师`：AI 生成/审图深度，是否落到国标硬闸+出处。

**G. 结论判定（✅ 已判定，2026-07-06 用户实测确认）**
- [x] 其合规/精算**已硬**（标准依据/计算书/校验拦截均备）→ 触发"重评尖刀切点"分支。
- **判定结果**：合规精算 = **入场券**（W-BIM-1 照做，目标 parity+出处链更深）；**尖刀收窄为 AI 生成×合规**（W-BIM-AI，"需求→方案生成"位仍空）；第二差异 = 变更真相源+报价锁价+经销商经营一体化（D 类联动深度可继续实测）。
- 基础能力仍照 §6.7 建，不受影响。

---

> 变更本文件需同步更新 `RHAUTT-NEXUS-DESIGN-INDEX-AND-ROADMAP.md` 的文档地图与决议总账。本蓝图不含实现代码；进入实现期按 §7 波次逐一推进，每步遵守 §5 底座/DB 约束。
