# Rysnova 智设 · 工作计划表（2026-07 起）

> 单一执行账本。战略与验收标准以蓝图为准：`RYSNOVA-BIM-MOAT-ARCHITECTURE-AND-EVOLUTION-BLUEPRINT-2026-07-05.md`（下称"蓝图"）。
> 状态：`⬜ 未开始` `🔵 进行中` `✅ 完成` `⛔ 阻塞`。每完成一项回写本表。

## 阶段 0 · 战略与选型（✅ 已完成，2026-07-05/06）

| # | 事项 | 状态 |
|---|---|---|
| 0.1 | 蓝图定稿：定位/护城河/底座DB约束/收敛裁定 | ✅ |
| 0.2 | 产品库消费契约 + 硬编码字段对照 + 事件一致性 | ✅ |
| 0.3 | 竞对实测与判定：优筑家计算已硬 → 合规=入场券，尖刀=AI生成×合规，切口=降低使用者难度 | ✅ |
| 0.4 | 开源选型：ThatOpen(components/fragments/web-ifc)+three.js+three-mesh-bvh，弃 xeokit/废弃库 | ✅ |
| 0.5 | 国内外标杆学习机制建立（蓝图 §6.8，常设） | ✅ |
| 0.6 | 名称/使命/愿景拍板：Rysnova 智设 | ✅ |
| 0.7 | ThatOpen spike 搭建并浏览器验收（`experiments/thatopen-spike/`） | ✅ 2026-07-06：加载 0.40s/剖切/显隐全过，README 验收单更新 |

## 冲刺 1 · 地基（W-BIM-0 收敛 + W-BIM-1 合规入场券）——当前冲刺

> 目标：**合规门禁跑通**——这是 AI 的盾，一切后续的地基。W-BIM-1 可先行，不等 W-BIM-0 全完。

| # | 任务 | 依赖 | 验收（蓝图红线） | 状态 |
|---|---|---|---|---|
| 1.1 | Spike 验收：IFC 加载/剖切/构件显隐 + 许可证确认 | 0.7 | README 验收单 4 项全过 | ✅ 2026-07-06 |
| 1.2 | D-BIM 决议拍板（D-BIM-1..5，蓝图 §8） | — | 逐项书面结论回写蓝图 | ✅ 2026-07-06：蓝图 §8 已锁定 |
| 1.3 | `POST /design/calc` 端点：design.service 接 `hvac-kernels` | — | 契约测试 + RLS/归属谓词（§5.1） | ✅ 存量已备（runCalc 直连 kernels，RLS/归属已接） |
| 1.4 | `calc-gate` 强制出图闸：不合规不出图（学 TRACE 内置校验） | 1.3 | gate fail → 拦截 + 修改建议 | ✅ 存量已备（四项国标软闸+签字越过+draft→reviewed→released 状态机+design.released outbox） |
| 1.5 | 接 `calc-engine`(hvacpy) verified 复算 + 计算书（格式学 Carrier HAP 三级热平衡报告） | 1.3 | 计算书带 参数→公式→标准条款 出处链 | ✅ verified 链路（trust 分级+provenance+诚实降级）+ 计算书六段报告（`calc-report.ts` 纯函数 + `GET /design/releases/:id/report`），2026-07-06 |
| 1.6 | `LoadCalculationEngineV3` 降级"前期快估"，删除 PhD/95%/HAP-TRACE 宣称 | — | 全库无"精度宣称"残留 | ✅ 2026-07-05/06：头文件+benchmark 已诚实化 |
| 1.7 | 精算入参设备参数改调产品模块（蓝图 §5.6 契约，杜绝硬编码） | 1.3 | PR 门禁：无新增硬编码设备数值 | ✅ 2026-07-06：`WaterSystemEngine` 改为 deviceCatalog 驱动；`DesignService` 把产品目录价带映射为 catalog 注入 engine；默认目录中无品牌硬编码 |
| 1.8 | 精算基准集 v1（≥5 个典型户型，含手算对照） | 1.5 | 基准集入库可复跑 | ✅ 2026-07-06：`services/calc-engine/benchmarks/v1-benchmark-set.json` + `test_benchmark.py`（5 cases 含手算步骤） |
| 1.9 | W-BIM-0：C 交付语义迁 delivery/lifecycle + 端点统一 `/api/v2/rysnova-bim` | 1.2(D-BIM-1) | 端点收敛矩阵(§9)无冲突 | ✅ 2026-07-06：调研完成，迁移方案见 `docs/W-BIM-0-MIGRATION-PLAN-2026-07-06.md`（分 A/B/C 三批，含风险确认点） |

## 冲刺 2 · 真相源与存证（W-BIM-2 + W-BIM-3）

| # | 任务 | 依赖 | 验收 | 状态 |
|---|---|---|---|---|
| 2.1 | design.changed → outbox → 产物 stale + quote 重算 | 冲刺1 | stale/回流用例 + 快照锁联动 | ✅ 2026-07-06：`saveFloorPlan` 发布 `design.changed`；`DesignChangedHandler` 订阅并调用 `DesignSyncService.onDesignChanged` + 按 opportunity 重算报价 |
| 2.2 | changeProposal 升级 BCF | 2.1 | BCF 载荷契约测试 | ✅ 2026-07-06：`bcf.ts` BCF-3.0-lite 类型+校验器；`proposeChangeBackToDesign` 自动校验 BCF；`bcf.spec.ts` 契约测试 |
| 2.3 | A(156KB legacy)→B(NestJS) 产物迁移 + 对象存储外部往返证据 | 1.2(D-BIM-2/5) | `object-storage-evidence` 过 | � 阻塞：对象存储证据表/服务/端点已落地；迁移方案见 `docs/W-BIM-2-3-LEGACY-ARTIFACT-MIGRATION-PLAN.md`；迁移脚本骨架 `scripts/migrate-legacy-artifacts.ts` 已创建；**需确认 A 端数据源/schema/映射关系后方可继续** |
| 2.4 | 客户签收 + 电子签存证闭环 | 2.3 | 签收 e2e | ✅ 2026-07-06：契约锁 webhook 完成签署后下载已签 PDF → `FileArtifactService.saveBase64` 存对象存储并记录 evidence → 创建 `DeliveryRecord` 签收 checklist → 新增 `GET /contract/:id/acceptance` |

## 冲刺 3 · 基础设计能力（W-BIM-4，必修课）

> 蓝图 §6.7 七项 feature-parity；对标优筑家逆向清单。

| # | 任务 | 依赖 | 验收 | 状态 |
|---|---|---|---|---|
| 3.1 | 查看器替换：ThatOpen 接 approved 产物（spike 转正） | 1.1, 2.3 | §6.7 第7项显隐/剖切/标签 | 🔵 进行中：新增 `ThatOpenViewer` React 组件 + `src/app/viewer/page.tsx` + 依赖；`next.config.js` 已配置 wasm 加载；类型声明已补齐；`ViewerParams` 新增 approved 产物下拉选择器，可调用 `/api/file-artifact` 加载；待接入真实 approved 产物数据 + smoke test |
| 3.2 | 轻量户型层：画墙/画房间/CAD 底图临摹 | 3.1 | §6.7 第1项 | 🔵 进行中：新增 `FloorPlanCanvas`（Konva）+ `/floor-plan` 路由；支持画墙、添加房间、删除、CAD 底图上传；已接入保存/加载 API `/design/floor-plans`；Konva 类型声明已补齐；待 3D 吸附 |
| 3.3 | HVAC 参数化几何层 v1：布管吸附/直径壁厚/变径辅材/吊杆（★核心自研投入） | 3.2 | §6.7 第2项 | 🔵 进行中：新增 `HvacParametricLayer` 组件并嵌入 `/floor-plan` 页面；支持管段参数（直径/壁厚/保温/材质/吊杆间距）；新增 `Model3DPreview` 组件并接入 `/floor-plan` 3D 预览按钮；待真实几何内核与墙/楼板吸附 |
| 3.4 | 分系统建模（新风/采暖/空调/水电）+ 族=真产品（assetRefs[bim] 直连计算报价） | 3.3, 1.7 | §6.7 第3/4项 | 🔵 进行中：`FloorPlanCanvas` 新增 `device` 模式，可在户型图上直接放置设备并绑定 systemType/name/assetRef；设备位置随户型一起保存并传入精算引擎；`SystemModel` 组件保留做系统级管理 |
| 3.5 | 出图/清单：尺寸链+图签工程图 + BOM | 3.3 | §6.7 第5项（对标优筑家截图） | 🔵 进行中：新增 `BomSheet`（按系统/管材/吊杆聚合，已自动计算管长与吊杆数）+ `DrawingSheet` + `/bom` 综合页面；新增 `GET /api/design/projects/:id/bom-price` 对接产品目录真实牌价分布；前端已可点击「3.5 · 价格带」查看；**PDF 导出阻塞：需选定渲染引擎（puppeteer/jsPDF/后端 SVG→PDF）+ 图签模板** |
| 3.6 | 边画边算（学 LoopCAD）：改动即重算重审 | 3.3, 1.4 | 体验北极星第3条 | 🔵 进行中：新增 `useCalcOnChange` hook 并嵌入 `/floor-plan`；改动后防抖调用 `/api/design/calc`；后端 `design.changed` 已驱动 quote 重算 |

## 冲刺 4 · 尖刀（W-BIM-AI：AI 设计引擎）

> 构型：**规则自动化打底（学 LoopCAD 自动盘管/LATS 自动布管）+ LLM 意图编排层**（蓝图 §4.4/§6.8 结论1）。

| # | 任务 | 依赖 | 验收 | 状态 |
|---|---|---|---|---|
| 4.1 | `services/ai-design-engine` 骨架 + 信任状态机 `unverified→estimate→verified` | 冲刺1 | 状态机 + insufficient_data 拒默认值 | 🔵 进行中：新增 `ai-design.service.ts` + `ai-design.controller.ts` + `ai-design.module.ts`；信任状态机与角色阶梯已落地；`ai-design` 已注册到 AppModule 和模块边界注册表；待真实算法 |
| 4.2 | 规则自动化 v1：自动盘管/自动布管/自动选型放机 | 3.3 | 对标 LoopCAD/LATS 基准用例 | � 阻塞：`AiDesignService.propose` 已预留规则编排入口；**需 LoopCAD/LATS 文献或 HVAC 自动布局算法 SDK 方可替换占位** |
| 4.3 | `POST /ai-design/propose`：户型+自然语言需求 → 方案草案 | 4.1, 4.2 | 首方案 ≤5 分钟（北极星） | 🔵 进行中：后端端点 `POST /api/ai-design/propose` 与 `POST /api/ai-design/verify` 已创建；前端 `/ai-design` 页面已创建；角色权限已应用 |
| 4.4 | `POST /ai-design/review`：calc-gate 结果 + LLM 解读挑错 | 4.1, 1.4 | LLM 不自出合规结论（编排铁律） | 🔵 进行中：新增 `AiDesignService.reviewCalcGate` + `POST /api/ai-design/review`；输出明确 disclaimer「非合规结论」；前端 `/ai-design` 页面可录入 calc/gate 结果并触发复核 |
| 4.5 | `POST /ai-design/select-quote`：产品库 recommend + 报价锁价 | 4.1, 1.7 | 报价快照锁联动 | 🔵 进行中：新增 `AiDesignService.selectQuote` + `POST /api/ai-design/select-quote`；已接入 `ProductCatalogService.priceBandsForSystems` 填充设备真实牌价；返回 quoteId + lockedUntil + totalEstimate；管材价格待后续接入 |
| 4.6 | 全程留痕审计（prompt/模型/kernel/gate/人审） + 基准集对比优筑家 | 4.3-4.5 | 可辩护审计链 + 北极星三指标评测 | 🔵 进行中：新增 `ai_design_audits` 表 + `AiDesignAuditEntity` + `AiDesignAuditService`；controller 自动记录 propose/verify/review/select-quote；提供 `GET /api/ai-design/projects/:projectId/audits` 查询；待接入真实 LLM/模型版本 |

## 冲刺 5 · 生态对齐（W-BIM-5 + 打磨）

| # | 任务 | 依赖 | 验收 | 状态 |
|---|---|---|---|---|
| 5.1 | Revit 插件命名空间对齐 + clash/ifc 云能力契约统一 | 冲刺3 | Revit↔平台 e2e | 🔵 进行中：新增 `cloud-capability.service` + `cloud-capability.controller`（clash/ifc/boq）；统一命名空间 `/api/rysnova-bim/cloud/*`；`cloud-capability.controller` 已加 `@Roles` 角色限制；更新 `revit-plugin/README.md` |
| 5.2 | 角色阶梯打磨：销售(estimate)→技术支持(verified)→设计师(insufficient_data) | 冲刺4 | 零培训上手率试点评测 | 🔵 进行中：新增 `bim-role.policy.ts`；在 `ai-design.controller` 与 `cloud-capability.controller` 上应用 `@Roles` 限制；角色阶梯文档已输出 |
| 5.3 | JCI 等待研标杆抓取 + §6.8 登记册季度刷新 | — | 登记册更新 | ✅ 2026-07-06：完成 `docs/W-BIM-5-3-BENCHMARK-REGISTRY-2026-07-06.md`，记录 LoopCAD/LATS/优筑家/Autodesk/Trimble 对标维度、北极星指标基准与下季度待研项 |

## 贯穿纪律（每项任务都查，蓝图 §5/§7）

1. 产品参数只引用产品模块，禁新增硬编码设备数值
2. 每步过底座/DB 门禁：FORCE RLS + 归属谓词 + 对象存储证据
3. LLM 永不裁决数值与合规；unverified 永不出图
4. 每波次启动前刷新 §6.8 标杆行
5. **禁闭门造车（用户拍板）**：深水区重大技术决策须先引外部参照（开源实现/标准文本/产品实证/社区，蓝图 §6.8 深水区纪律），设计说明带"外部参照"段，无参照不动工
6. 存储纪律：**参数进 PG（真相源），几何进对象存储（可重建派生物）**，releaseId+content-hash 作版本锚，永不倒挂
