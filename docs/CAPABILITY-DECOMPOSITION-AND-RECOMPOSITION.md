# 能力解耦与重组蓝图（世界级领域编排）

> 版本：v1.0 · 2026-06-24
> 状态：重构起盘依据。配合 PROJECT-CHARTER.md 第 5/8 章使用。
> 方法：以代码为真相（scripts/capability-extract.js + reverse-capability-audit.js 实测），从原子功能反推领域，再科学重组。
> 事实基础：107 个引擎文件 / 1908 个方法；56 个路由文件 / 599 个 HTTP 端点。

---

## 0. 为什么要解耦重组

当前后端功能强大但组织混乱，典型病灶（实测）：

- 上帝路由：business-domain 一个文件横跨合同/物料/CRM/产品/促销/报价/运维/IoT/Rysnova/AI 十个领域（50 端点）；core-api 把 auth/问诊/户型/设计/BIM/语音揉在一起（40 端点）；supreme-api 重复 IoT/能源/孪生/AI（23 端点）。
- 能力无单一 owner（跨文件重复暴露）：ai 散在 4 个路由文件、export 散在 7 个、design 散在 3 个、products 散在 4 个、health/stats 散在 6 个。
- 多代并存：QuotationEngine / QuotationEngine-v2 / QuoteEngine / ValueBasedQuotationEngine 四套报价；PainPointDiagnosisEngine 与 V3；LoadCalculationEngine 与 V3；RoleSystem 与 V2。
- 上帝对象：Hammer（78 方法）、EvolutionMechanism（50 方法）、SelfCheckOrchestrator 等基础设施类与业务引擎混放在 server/core。

解耦原则：一个能力只有一个 owner 模块；一个端点只在一个领域路由出现；多代实现择一为准、其余归档；基础设施与业务领域分离。

---

## 1. 原子能力分层模型

把 1908 个方法 / 599 个端点按职责拆到三层，避免"业务逻辑、计算内核、基础设施"混为一谈：

```text
能力层 A · 领域业务 (Domain Services)      对应 NestJS 15 模块，暴露 API
能力层 B · 计算内核 (Calculation Kernels)  纯函数式选型/负荷/水力/CFD 计算，被领域服务调用，不直接暴露 API
能力层 C · 平台基础设施 (Platform Infra)    缓存/监控/持久化/部署/自检/演进，横切支撑，不属任何业务域
```

这一分层是重组的骨架：API 只从 A 层出；A 调 B 做计算；A/B 都依赖 C 的横切能力；C 不反向依赖业务。

---

## 2. 领域业务层（A）：15 模块的能力归属

下表把实测的引擎与端点重组到宪章 15 个 NestJS 模块。每个模块给出：拥有的计算内核（B 层）、收编的端点领域、需要消除的重复/多代。

| 模块 | 拥有的计算内核(B) | 收编端点领域 | 消除的重复/多代 |
|---|---|---|---|
| auth | DataEncryption | /auth /login /me | RoleSystem→RoleSystemV2（择 V2）|
| tenant | - | 租户/经销商/门店 scope | 从各 CRM/运营路由抽离 tenant 逻辑统一到此 |
| crm | CRMSalesManager, FissionTrackingEngine, ChannelManagementEngine | /crm /customers /campaigns /coupons | business-domain 内 CRM 段、core-api customer 段并入 |
| diagnosis | PainPointDiagnosisEngineV3, LLMDiagnosisEngine, SmartBrainEngine, AIMatchingEngine, VoiceInteractionEngine | /pain-diagnosis /solution-match /ai-consultant /voice-interaction | PainPoint V1→V3；AI 问诊类端点从 business-domain/supreme-api/core-api 统一回此 |
| product-catalog | DeviceSelectionEngine, HouseTypeLibrary, ChinaCitiesDatabase, ChinaClimateDB, ProfessionalStandardsLibrary, Material | /products /materials /house-types /standards | products 散在 4 文件→统一；materials 合并 |
| quote | QuotationEngine-v2(择一), ValueBasedQuotationEngine, PromotionEngine, CommercialTaxEngine, CurrencyEngine | /quote /quotes /quotation-v2 /pricing /promotion | 四套报价引擎收敛为 1 主 + 价值定价策略；pricing 跨文件统一 |
| design | 见第 3 节计算内核（负荷/水力/五大系统+控制/3D/图纸/CAD） | /design/* /visualization /drawings | design 散在 3 文件→统一；2D 轻工具与 Rysnova 深化分界 |
| rysnova-bim | RysnovaBIMCore, CADEntityRecognizer, CADImporter, RevitIntegrationEngine, CFDSimulationEngine, TechnicalDeliveryGenerator, 协同(Yjs/Collaboration/VersionControl/DrawingSync) | /rysnova-bim /rysnova-bim-bim /bim-export | rysnova-bim-bim 散在 2 文件→统一；core-api 内 BIM 段并入 |
| delivery | ConstructionManager | /construction /workorders /field-services /acceptance /settlement /material-movement | business-domain 内合同施工段并入 |
| lifecycle | IoTPlatform, EconetEngine, DigitalTwinEngine, MqttBrokerEngine, DevicePositioningEngine, MonitoringSystem(业务侧) | /iot /econet /twin /operation/devices /device-positioning | supreme-api 的 iot/twin 段、business-domain 的 operation 段统一回此 |
| analytics | IndustryPlatformEngine, ReportGenerator, ReportEngine, TriEnergySystem, 能耗碳 | /analytics /reports /dashboard /energy /operation/...energy | dashboard/stats/energy 跨文件统一；report 多版本择一 |
| governance | SelfCheckOrchestrator, EvolutionMechanism, FeedbackCollector, 审计 | /governance /qa /evolution /logs /audit | 自检/演进/审计统一；从 ops/platform runtime 抽离 |
| file-artifact | ExportEngine, PPTExportEngine, TemplateEngine, TemplateLibrary, SolutionTemplateEngine, DrawingSVGRenderer | /export /exports /templates /share /generate | export 散在 7 文件、templates 散在 3 文件、generate 散在 5 文件→全部统一到产物服务 |
| notification | WebhookEngine | /webhook /notify | 从散落 inline 调用收敛 |
| workflow | WorkflowEngine, WorkflowOrchestrator, EnterpriseClosedLoopEngine, ClosedLoopEngine, SmartRoutingEngine, AgentCoordinator, SystemCoordinationEngine | /workflows /closed-loop /coordination /smart-route /agent | 闭环/编排/路由统一；enterprise-loop 与 closed-loop 合并 |

---

## 3. 计算内核层（B）：被领域调用的纯计算

这些是平台真正的技术资产（暖通工程计算），应抽为无副作用、可单测、可被任意领域服务调用的内核，不直接挂 API。

| 内核 | 能力 | 现状文件 | 收敛动作 |
|---|---|---|---|
| 负荷计算 | 热/冷负荷、逐时负荷 | LoadCalculationEngine, LoadCalculationEngineV3, HourlyLoadEngine | V1→V3 择一，逐时并入 |
| 热水 | 中央热水/循环/管径选型 | HotWaterEngine | 保留 |
| 采暖 | 地暖/水系统/分区 | HeatingSystemEngine, ReheatModuleEngine | 保留，再热模块并入 |
| 净水/水系统 | 前置/中央/末端 | WaterSystemEngine | 保留 |
| 新风/DOAS | 新风量/热回收/合规 | FreshAirProEngine, DOASComplianceEngine | 保留 |
| 空调/全空气 | 冷负荷/风量/室内机 | AirConditioningEngine, FiveConstantEngine | 保留，五恒并入或并列 |
| 水力 | 管网水力建模 | HydraulicEngine, HydraulicModelingEngine | 二选一收敛 |
| CFD | 流体仿真 | CFDSimulationEngine | 归 rysnova-bim/design 调用 |
| 一键计算 | 编排多内核出方案 | OneClickCalculationEngine, ThreeTierEngine | 作为 design 模块的 orchestrator |
| 三能源 | 三能源系统协同 | TriEnergySystem | 归 analytics/能源调用 |
| 3D/图纸 | 渲染/布局/可视化/图纸 | Renderer3DEngine, Layout3DEngine, HVAC3DVisualizationEngine, Visualization3DEngine, DrawingEngine, AISceneGenerator | 多套 3D 收敛为 1 渲染内核 + 1 图纸内核 |

原则：B 层不依赖 HTTP、不依赖租户上下文（上下文由 A 层注入），保证可测试、可复用、可被未来 Go/Rust 重计算服务替换。

---

## 4. 平台基础设施层（C）：横切支撑

从 server/core 中剥离出来，不属于任何业务域，统一进 NestJS 基础设施/公共模块或独立 infra 包：

| 能力 | 现状文件 | 去向 |
|---|---|---|
| 缓存 | CacheEngine, CacheLayer, CalculationCache | 统一缓存抽象（Redis 驱动）|
| 持久化 | DatabasePersistenceEngine, UnifiedDatabase | 收敛为 repository 层（Postgres/Mongo）|
| 监控/性能 | MonitoringSystem, PerformanceMonitor, PerformanceMonitorEngine, HeartbeatMonitor | 统一可观测性（observability）|
| 部署 | DeploymentManager | DevOps/infra，移出业务代码 |
| 数据备份 | DataBackupScheduler, DataBackupEngine | infra 定时任务 |
| 自检/演进 | SelfCheckOrchestrator, EvolutionMechanism | 归 governance（治理域，介于 A/C）|
| 测试夯实 | Hammer（78 方法） | 测试/质量工具，移出 server/core 到 scripts/test |
| 定位 | LocationService | 公共服务或 product-catalog 调用 |
| 单位换算 | UnitConverter | 公共工具库 |

---

## 5. 重组前后对照（治混乱）

| 病灶 | 现状 | 重组后 |
|---|---|---|
| 上帝路由 | business-domain(50)/core-api(40)/supreme-api(23) 跨领域混装 | 拆散到对应领域模块，删除上帝路由 |
| AI 能力分散 | ai 端点散在 4 文件 | 统一到 diagnosis（问诊 AI）与各域内显式调用 |
| 导出分散 | export 散在 7 文件 | 统一到 file-artifact 产物服务 |
| 报价多代 | 4 套报价引擎 | quote 模块 1 主引擎 + 价值定价策略 |
| 3D 多代 | 5+ 套 3D/可视化引擎 | 1 渲染内核 + 1 图纸内核 |
| 健康检查分散 | health/stats 散在 6 文件 | 统一 health 模块 + 各模块标准 health 探针 |
| 基础设施混入业务 | 缓存/监控/备份/部署在 server/core | 剥离到 infra/可观测性层 |

---

## 6. 落地顺序（与宪章第 8 章重构路线对齐）

1. 冻结事实：本蓝图 + capability-extract + reverse-capability-audit 三份报告作为基线，任何删除前先比对。
2. 建计算内核层 B：把暖通计算内核抽为纯函数包（packages/domain 或 services/api kernels），加单测。
3. 建领域模块 A：按第 2 节归属，在 NestJS 逐模块落地，端点从上帝路由迁入，旧路由转 legacy-compat 再删。
4. 剥离基础设施 C：缓存/监控/持久化/部署统一，业务代码不再直接 new 这些类。
5. 收敛多代实现：每组多代择一为准，其余进 legacy/ 归档，guard 防止再次引用。
6. 契约对齐：每个迁入端点先进 OpenAPI，再供前端调用（契约优先）。

每步都要求 guard/harness/test 全绿，且 routeOwnership 注册表与本蓝图保持一致。
