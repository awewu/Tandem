# Rhautt Nexus 产品需求文档（PRD v2.0）

> 版本：v2.0 · 2026-06-25 · 重构起盘统一 PRD
> 上级事实源：PROJECT-CHARTER.md（v1.4）。本 PRD 是宪章的需求展开，二者冲突以宪章为准。
> 依据：宪章 v1.4、docs/CAPABILITY-DECOMPOSITION-AND-RECOMPOSITION.md、audit/asset-ledger.md、docs/STRUCTURE-ASSET-LEDGER.md、docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md。
> 收敛：本 PRD 取代散落的 PRD-CURRENT.md、PRODUCT-SCOPE.md、docs/ 下多份 PRD 的对外效力（降级为历史附录，见第 9 章）。

## 1. 产品定位与边界

一句话定位：Rhautt Nexus（瑞合数智枢纽）是瑞合瑞德暖通科技集团的数字化中枢/管理平台，统筹品牌管理、网站协同、经销商赋能、CRM、分析与资料中心，为各独立网站供给共享底座；它不吞并任何独立网站。

品牌层级（不可变，详见宪章第 1/1.2 章）：

- Rhautt Comfort / 瑞合瑞德暖通科技集团 = 集团表述，非软件名。
- Rhautt Nexus / 瑞合数智枢纽 = 对内工程底座/控制平面（多租户、auth、品牌注册、共享底座、总部分析），不作对外产品名直接示人。
- 瑞诺瓦 / Rysnova = 经销商赋能体系品牌对（瑞诺瓦=中文名，Rysnova=英文名），中立第三方行业软件形态；下辖问诊/CRM/BIM 三件套。
- 瑞合瑞德集团官网 rhautt.com、Rheem/Ruud/Everhot 设备品牌站 = 各自独立网站。

产品组织两大板块（详见宪章 1.2）：

- 板块一 · Rhautt 旗下各品牌运营体系：集团官网 + 设备品牌站群 + 物料 DAM（对内，挂集团/设备品牌）。
- 板块二 · 瑞诺瓦 / Rysnova 经销商赋能阳谋体系（对外中立第三方形态）：1）瑞诺瓦 AI 问诊 / Rysnova AI Diagnosis（C 端）；2）瑞诺瓦舒适家居 CRM / Rysnova Comfort-Home CRM（界面默认展示 Rhautt 旗下品牌，经销商可自由加入其他品牌）；3）瑞诺瓦技术支持 BIM / Rysnova BIM。

三条边界铁律：设备品牌不能写成系统品牌；Rhautt Nexus 是对内底座不直接对外冠名；外链旧站是过渡占位，终态全部深度托管由我们重开发。

## 2. 用户与受众

| 受众 | 入口应用 | 核心诉求 |
|---|---|---|
| 终端业主（C 端） | 瑞诺瓦 AI 问诊、集团官网 | 痛点诊断、系统方案、预算/月供/ROI |
| 已签约客户 | 客户门户 | 方案/报价/订单/施工/验收/保修/IoT 状态 |
| 暖通设计师/销售 | 设计师工作台 | 2D 设计、选型、BOM、报价、促销、分享 |
| 技术支持/经销商技术 | Rysnova 工作台 | BIM 深化、系统图、施工图、Revit/CAD |
| 经销商/门店/总部 | 经销商台、业务控制台 | 多租户 CRM、报价、产品、促销、施工、总部汇总 |
| 各品牌 C 端/行业 | Rheem/Ruud/Everhot 品牌站 | 品牌展示、产品矩阵、留资回流问诊 |

### 2.1 角色 × 数据可见范围（RBAC + 租户作用域）

受众映射到角色，角色叠加租户作用域决定可见数据。这是 auth + tenant 模块的需求基线，直接支撑第 6 章的 RLS 隔离。

| 角色 | 作用域 | 可见数据范围 | 写权限 |
|---|---|---|---|
| 业主/访客（C 端） | 无租户 | 自己的问诊、方案、留资 | 仅本人提交 |
| 已签约客户 | customer 自身 | 自己的方案/订单/施工/工单/保修 | 仅本人发起的服务请求 |
| 设计师/销售 | store 内 | 本门店客户、商机、报价、设计 | 本门店业务对象 |
| 门店管理者 | store | 本门店全量经营数据 | 本门店配置与人员 |
| 经销商管理者 | dealer（含旗下 store） | 本经销商所有门店汇总 | 本经销商范围 |
| 总部运营 | tenant 全域 | 跨经销商汇总分析（聚合/脱敏） | 平台级配置、品牌注册 |
| 技术支持（Rysnova） | 按授权项目 | 被指派项目的 BIM/图纸/交付物 | 被指派项目交付物 |
| 平台管理员 | 平台 | 治理/审计/演进/质量（不含明文业务隐私） | 平台治理对象 |

铁律：除总部聚合视图外，任何角色都不得跨 dealer/store 边界读取明细；总部跨经销商视图必须走聚合/脱敏，且由 RLS + 审计双重保证。
## 3. 核心业务闭环（需求级）

产品价值由闭环衡量，不由页面数量衡量。四条主闭环（详见宪章第 4 章）：

1. C 端获客到成交：集团官网 → 瑞诺瓦问诊 → 痛点采集 → 三档方案 → 配置设备 → 留资进 CRM → 销售跟进 → 2D 设计/报价 → 签约。
2. 设计到交付：设计师台 → BOM/报价/合同 → Rysnova 深化 → 图纸/系统图/材料 → 施工/验收/结算 → 客户门户可见。
3. 交付到生命周期：合同/交付物 → LifecycleLink → 资产/家庭/设备/保修/服务计划 → IoT 控制平台衔接（仅交接）。
4. 经销商经营到总部分析：门店经营 → CRM 360/漏斗/报价转化/促销/施工 → tenant/dealer/store/role scope → 总部跨经销商汇总。

验收判据：线索 → 痛点问诊 → 设计 → 系统方案 → 报价 → 合同 → 施工 → 验收 → 生命周期 IoT 关怀，端到端可走通。

## 4. 功能需求（按 15 领域模块）

功能需求以宪章 15 个 NestJS 模块为骨架，能力归属与多代收敛见 docs/CAPABILITY-DECOMPOSITION-AND-RECOMPOSITION.md 第 2-4 节。每个模块的需求要点：

| 模块 | 需求要点 | 计算内核(B) | 多代收敛 |
|---|---|---|---|
| auth | 登录、角色、权限、加密 | DataEncryption | RoleSystem→V2 |
| tenant | 租户/经销商/门店 scope、隔离 | - | 从各路由抽离统一 |
| crm | 客户 360、商机漏斗、活动、优惠券、裂变、渠道 | CRMSalesManager/Fission/Channel | business-domain CRM 段并入 |
| diagnosis | 痛点采集、AI 诊断、方案匹配、语音 | PainPointV3/LLM/SmartBrain/AIMatching/Voice | PainPoint V1→V3，AI 端点回收 |
| product-catalog | 产品/材料/户型/标准/气候数据 | DeviceSelection/HouseType/ChinaCities/ChinaClimate/Standards | products 4 文件统一 |
| quote | 报价、价值定价、促销、税费、币种 | QuotationEngine-v2/ValueBased/Promotion/Tax/Currency | 4 套报价收敛为 1 主+策略 |
| design | 负荷/水力/五大系统+控制/3D/图纸/CAD | 见蓝图第 3 节 | design 3 文件统一，3D 多代收敛 |
| rysnova-bim | BIM 深化、CAD/Revit、CFD、技术交付、协同 | RysnovaBIMCore/CAD/Revit/CFD/Delivery | rysnova-bim-bim 2 文件统一 |
| delivery | 施工、工单、现场、验收、结算、材料流转 | ConstructionManager | business-domain 施工段并入 |
| lifecycle | IoT 交接、Econet、数字孪生、设备定位 | IoT/Econet/Twin/DevicePositioning | supreme-api iot/twin 段回收 |
| analytics | 分析、报表、看板、能耗碳、三能源 | Industry/Report/TriEnergy | dashboard/stats/energy 统一 |
| governance | 自检、演进、反馈、审计、QA | SelfCheck/Evolution/Feedback | 从 ops/platform runtime 抽离 |
| file-artifact | 导出、模板、分享、产物生成 | Export/PPT/Template/SVG | export 7 文件、generate 5 文件统一 |
| notification | webhook、通知 | WebhookEngine | 从 inline 收敛 |
| workflow | 工作流、闭环、编排、智能路由 | Workflow/ClosedLoop/SmartRouting/Coordinator | enterprise-loop 与 closed-loop 合并 |

### 4.1 双栖模块边界（瑞诺瓦 / Rysnova）

diagnosis 与 rysnova-bim 不是普通领域模块：它们是可被集团官网/品牌站导流嵌入、又保留独立产品/数据/API owner/独立上线能力的双栖模块（宪章 3.1，机器可读边界见 contracts/product-modules/）。

| 模块 | dataNamespace | apiNamespace | standalone alias | 独立上线要求 |
|---|---|---|---|---|
| 瑞诺瓦 AI 问诊 | rysnova | /api/v2/diagnosis | /rysnova、/rysnova-ai、/rysnova-diagnosis | 独立 app shell、独立 logo 策略、外部域名部署证明 |
| Rysnova 技术支持/BIM | rysnova-bim | /api/v2/rysnova-bim | /rysnova-bim、/rysnova-bim-bim、/rysnova-bim-workbench | 同上 |

约束：共享 tenant/dealer/store/user/audit/outbox/对象存储/工作流/CRM/报价/生命周期底座允许，但必须保留 moduleNamespace/dataNamespace/productNamespace，为未来独立拆库与单独部署留路径。历史英文 slug（如 rysnova）仅作迁移债务，不得成为新增对外文案或新模块命名依据。

### 4.2 核心数据实体与关系

实测 30 个数据模型，主干分三组。所有业务实体默认带 tenant_id（支撑第 6 章 RLS）。

租户树（隔离骨架）：

```text
Tenant（集团/平台租户）
  └─ Dealer（经销商）
       └─ Store（门店）
            └─ User（员工：设计师/销售/管理者）
```

成交链（C 端到合同）：

```text
Lead/留资 → Customer(V2) → Opportunity(商机) → Quotation(V2)(报价)
   → Contract(V2)(合同) → WorkOrder/ConstructionTask(施工) → 验收/结算
问诊侧：DiagnosisReport（痛点诊断）→ 方案 → 进 Opportunity
设计侧：Project / DesignWorkspaceState → CalculationResult → BOM(Material/Product)
```

生命周期与交付（交付到 IoT）：

```text
Contract → LifecycleLink（生命周期桥）→ Device（已装资产）→ 保修/服务计划
Rysnova：RysnovaArtifact（BIM/图纸/系统图交付物）
可靠性：OutboxEvent（事务外发件箱）、AuditLog（审计）、Workflow（流程态）
```

实体归属与多代收敛：Customer/Quotation/Contract/User 均有 V1 与 V2（CustomerV2/QuotationV2/ContractV2/UserV2），V2 为准，V1 随领域迁移退役；contract.model.js / customer.model.js / Journey.model.js 为文档型（Mongo）模型，按 moduleNamespace 分区。详细 ERD 见 docs/DATABASE-BACKEND-ARCHITECTURE.md 与 docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md。

### 4.3 暖通领域深度：五大系统一键计算 + 控制（design 模块核心）

design 模块不是泛化的"设计功能"，而是五大暖通系统的一键计算选型体系，外加横切的智能控制（吸收自 150-TEAM-6-SYSTEMS、COMPLETE-CALCULATION-SYSTEM-v2.0、各空气/水系统规格）。

建模纠偏：历史文档把 DOAS 误列为与"制冷/全空气"平级的第六大系统。实际上 DOAS（专用室外空气系统）是空气系统中新风的一种高级设计标准/产品档次（温湿度独立控制，ASHRAE 62.1/90.1），归属新风域，不单列为系统。空气侧统一为一个"空气系统"域，内含制冷/全空气与新风两类负荷，新风再分常规新风与 DOAS 两档。

| 系统 | 计算代号 | 核心计算 | 标准依据 |
|---|---|---|---|
| 热水系统 | CALC-HS | 中央热水负荷、循环、管径选型 | GB 50736 / 行业热水规范 |
| 净水/水系统 | CALC-WT | 软水/前置/中央净水/末端直饮 三级架构 | 水质标准 |
| 空气系统 | CALC-AIR | 制冷/全空气：冷负荷、风量、室内机选型、五恒；新风：新风量、热回收（常规新风 / DOAS 两档） | GB 50736 附录A 气象参数 / ASHRAE 62.1·90.1 |
| 供暖系统 | CALC-HEAT | 地暖/水系统/分区、再热模块 | 采暖设计规范 |
| 控制系统（横切） | CALC-CTRL | 各系统智能控制、联动、五恒协调 | 默认附带于成套方案 |

空气系统两档新风（吸收自 DOAS-Design-Standard、PRODUCT-DIFFERENTIATION-DOAS）：

| 档次 | 送风温度(夏) | 负荷承担 | 热回收 | 与辐射配合 | 适用 |
|---|---|---|---|---|---|
| 常规高效新风 | 16-18℃ | 混合承担 | 60-85% | 良好 | 中高端住宅 |
| DOAS 专用室外空气 | 22℃（接近室温） | 仅新风负荷（温湿独立控制） | SRE≥75% / LRE≥60% | 完美（最佳配合五恒+辐射） | 高端住宅/别墅 |

领域需求要点：

- 一键计算：用户输入户型/地区/需求 → 自动调用对应内核 → 输出三档方案（基础/推荐/旗舰）+ 设备 BOM + 预算/月供/ROI。
- 标准符合：负荷计算基于 GB 50736-2012 附录A 室外计算气象参数（数据资产 ChinaClimateDB，焓值由心理测量公式实时计算）；新风通风量按 ASHRAE 62.1（Vbz = Rp×P + Ra×A），DOAS 热回收按 ASHRAE 90.1。
- 新风选型必须显式区分常规新风与 DOAS 两档，避免历史文档那种"把标准当系统"的混淆；DOAS 选型默认带再热模块。
- 即插即用系统包（RHEEM-PLUG-AND-PLAY-SYSTEM-PACKS）：中央热水/采暖/全空气三条锚点路由，智能控制默认附带；产品矩阵与销售话术按痛点匹配（WATER-SYSTEM-PRODUCT-MATRIX）。
- 计算精度验证体系：每个内核有精度验证基线，计算结果可单测可回归。
- 全屋系统级协调（同时使用系数）：五大系统不得各算各的简单相加。负荷汇总必须引入同时使用系数（diversity factor）做系统级叠加（冷热负荷、新风与辐射耦合、峰值错峰），避免过度选型导致报价虚高，否则「工程级计算」差异化（4.4）站不住。
- 落地必算项（施工图分水岭）：除负荷/选型外，必须计算噪声（室内噪声级）、水力平衡与管路压损、结露/露点风险联动（尤其辐射末端 + 新风），这三项决定能否真出施工图。
- 计算责任与复核边界：一键计算结果带精度免责声明 + 人工复核签章字段；提供「设计师/总工复核」状态与可选第三方设计院复核接口。精度基线显式对标 GB 50736 算例与厂商样本工况，留可回归基准数据集。
- 旧房改造诊断分支：问诊与计算区分新建 vs 改造。改造分支采集拆改限制、层高、管井/点位、原系统残值等劝退点，避免默认按新建模型出方案（改善型住宅是高端主力客群）。
- 全生命周期总持有成本（TCO）：方案输出在预算/月供/ROI 之外，给十年能耗 + 维保 + 更换的 TCO 账，作为高端业主核心决策依据与对抗低价竞品的武器。

### 4.4 竞品差异化定位（产品优势锚点）

对标海尔水暖通、A.O.史密斯 AI-LiNK（COMPETITOR-ANALYSIS-HAIER-AOSMITH、INDUSTRY-COMPETITOR-RESEARCH）。差异化锚点：

- 全链路闭环：竞品多停在选型或 IoT 单点，本平台贯通问诊→设计→报价→交付→生命周期 IoT 全闭环。
- 多品牌中枢：竞品单品牌，本平台是多设备品牌（Rheem/Ruud/Everhot+新增）统一中枢 + 经销商赋能。
- 标准级计算：五大系统基于国标/ASHRAE 的工程级计算，非营销级估算。
- 经销商物料同源：UI/VI/SI 与市场物料从设计系统同源生成，竞品无此能力。

护城河可持续性（防御论述）：「全链路闭环」「多品牌中枢」是窗口期优势、竞品可复制；真正难复制的结构性壁垒是「标准级计算（工程内核 + 国标/ASHRAE 精度基线 + 可回归）」「物料同源（设计系统驱动）」与「产品/价格情报网（5.5 产品主数据汇聚 + 4.6 调用量采集沉淀的跨租户行业情报）」，差异化重心显式压到这三项。对「竞品也开放第三方录入/也做免费工具」的回应是：本平台的留客不靠功能阉割，靠真实价值差（自动精算、整包质保、物料同源、交付速度），这一价值差正是阳谋成立的前提（宪章 1.1）。
### 4.5 三层产品目录与数据可信度（product-catalog 模块核心）

product-catalog 不只是产品/材料库，而是承载赋能线渠道战略（宪章 1.1）的核心数据结构。产品分三层来源，每层有不同的可信度、定价与能力授权：

| 层级 | 来源 | 定价模型 | 数据可信度 | 享受能力 | 可见范围 |
|---|---|---|---|---|---|
| 我方认证产品 | 各品牌产品库为权威源（SKU/参数/价格/上新），product-catalog 只读同步（见 5.4/宪章 5.5.2） | 品牌库基准价 + 租户零售价 | 已验证（参数权威） | 全自动精算 + 整包质保 + 物料同源 + 一键成套包 | 全租户可见 |
| 共享库 | 总部统一维护的第三方常见品类（带基准价） | 总部基准价 + 租户零售价 | 参数已校准（非我方背书） | 进 BOM/报价/导出；不驱动精算 | 全租户可调用 |
| 租户私有 | 经销商自录第三方/自有产品 | 租户自定价 | 标「参数未验证」 | 仅进 BOM/报价；不驱动精算 | 默认仅本租户 |

数据可信度标记（红线落点）：

- 每个 SKU 带 `dataTrustLevel`（verified / calibrated / unverified）与 `sourceTier`（owned / shared / tenant-private）。
- 仅 `verified` 产品可作为精算内核（design 模块 CALC-*）的权威输入；`calibrated`/`unverified` 只能进 BOM 与报价快照，并在界面如实标注「参数未验证」。
- 精算参数契约（verified 才算得出）：品牌库同步的产品必须带精算所需工程参数字段（如热泵 COP/制热量曲线、水力阻力、噪声级、新风量/热回收效率等），仅营销参数不足以判定 verified。product-catalog 定义「精算必填参数集」契约，品牌库缺字段的 SKU 降级为 calibrated，不得驱动 CALC-*。
- 第三方数据不得回写或污染精算内核可信链；精算结果与第三方报价行在数据上分层存储。
- 权威源单写收口（与 5.4/宪章 5.5 一致）：我方认证产品的 SKU/参数/价格由各品牌产品库唯一写入，product-catalog 只持只读同步副本 + 三层目录视图，不在 catalog 二次录入认证产品，杜绝双写。共享库由总部维护、租户私有由经销商录入，两者不进品牌库。
- 共享库竞品商标/授权责任归属：共享库可含竞品常见品类，商标使用、参数来源与责任主体由总部统一承担并留授权/声明记录；标注「参数来源：行业公开 / 非品牌授权背书」，避免经销商或平台承担侵权风险（阳谋合法前提）。

定价两层模型（用户拍板）：

- 总部基准价（成本/指导价）由总部对共享库与认证产品维护，作为底价与情报基线。
- 经销商在基准价之上自由设零售价（租户作用域），总部不强制零售价，只通过调用量/转化采集行业情报。
- 基准价信任条款：总部基准价用于底价与情报基线，经销商成本结构与零售价策略受租户隔离保护，总部仅获聚合/脱敏的行业情报，不得用于反向挤压单一经销商渠道（阳谋的「安全感」落地）。

### 4.6 渠道转化与情报采集（赋能线增长内核）

落实宪章 1.1 的「公开价值落差驱动迁移」，全部为正向可见机制，无隐藏降权：

- 方案完整度评分：按我方认证产品在 BOM 中的占比与关键系统覆盖给出完整度分，向经销商透明展示「补齐哪些项可享自动精算/整包质保」。
- 等效替换建议：对租户私有/共享库的第三方产品，给出我方认证产品的等效替换项与价值差（精算、质保、物料、交付速度），经销商可一键替换，也可保留第三方。
- 调用量与转化采集：采集共享库调用量、第三方品类分布、替换接受率、我方产品占比变化，沉淀为行业情报与转化漏斗。
- 转化仪表盘：向总部呈现跨租户的迁移趋势（我方占比、替换接受率、品类渗透），向经销商呈现自身的完整度与增值收益，双向透明。
- 对等回报（阳谋安全感落地）：调用量/情报采集不是单向抽水，经销商也获得对自己有用的匿名行业基准（如本地区某品类均价区间、渗透率、替换接受率参考），形成对等的数据交换，与 4.5 基准价信任条款一致。
- 红线复述：所有引导基于真实价值差与透明规则；第三方产品的基础录入/报价/导出体验必须无差别好用，不得为制造迁移而劣化。

### 4.7 经销商联合品牌身份（tenant 模块扩展）

落实宪章 1.1 联合品牌，强化「独立第三方赋能」对外观感：

- 租户身份层支持「品牌-门店」联合展示名（如「瑞美-蓝蜗牛（苏州）舒适家居体验官」），由 `tenantDisplayName` + 关联品牌/资质构成。
- 经销商工作台与对客界面（报价/方案/分享页）按租户联合身份呈现，体现经销商主体，而非平台或集团主体。
- 联合身份是展示与品牌授权层，不改变 4.2 的租户树隔离与 RBAC 作用域；展示名不得突破 dealer/store 数据边界。
- 赋能线对客物料默认呈现经销商主体 + 中立行业工具形态，集团/设备品牌背书走弱位置如实标注（宪章 2.4 赋能线豁免）。
- 对客呈现统一规则（消除 4.6 中立形态 vs 4.7 联合身份的歧义）：C 端问诊/方案/分享页对业主统一呈现为「经销商联合主体（如 瑞美-蓝蜗牛）+ 中立行业工具」，二者不冲突——联合身份是经销商商业主体，中立形态是软件平台属性；业主看到的是「这家经销商在用一套专业舒适家系统工具」，集团/平台不抢经销商的对客主体位。
- 物料下载分级授权（DAM）：UI/VI/SI 与市场物料按品牌 × 经销商授权关系分级下载，不同品牌经销商可见物料不同；下载权限矩阵由 product-modules + brand-registry 授权驱动，留下载审计。

### 4.8 CRM 线索归属与抢客规则（crm 模块）

经销商最痛的经营纠纷，必须有明确规则（4.2 租户树隔离是基础，但归属/交接规则需单列）：

- 线索归属判定：线索按来源（问诊/官网/门店/裂变渠道）+ 首触门店/销售落归属；归属规则可配置（首触优先 / 区域优先 / 分配优先）。
- 跨门店撞单：同一客户被多门店/销售触达时触发撞单检测与裁决流程，依归属规则 + 时间戳判定，留审计。
- 销售离职交接：人员离职时其名下线索/客户按规则回收并交接到门店或指定继任，不随离职带走；交接留痕。
- 边界：归属与交接均在 dealer/store 作用域内，不突破 4.2 隔离；总部仅见聚合。

### 4.9 财务闭环（quote 模块扩展）

成交落地的财务层，当前 quote 仅到税费/币种，必须补齐否则无法真实成交：

- 金融分期/月供：月供需对接金融方（分期/消费贷），PRD 锁定「可插拔金融渠道适配层」，具体金融方由商务确定后配置；月供展示需标注资方与年化。
- 发票：支持增值税专用发票 / 普通发票开具信息采集与对接。
- 结算：支持对公结算、定金/进度款/尾款分期收款节点，与 delivery 施工节点联动。
- 合规：金融与发票数据进合规与审计范围（见 5.3）。
- 报价价格快照锁定（与 5.4/宪章 5.5 产品同步流交叉）：报价生成即对所选 SKU 价格/参数打快照锁定，品牌库改价只影响此后的新报价，不自动改写已发出/待签报价；在途报价如需跟价须经销商显式确认重算，避免自动跟涨撕毁报价信任。

### 4.10 设计与深化的单一真相源（design ↔ rysnova-bim）

4.2 同时存在 design 侧（Project/CalculationResult/BOM）与 rysnova-bim 侧（RysnovaArtifact），必须定义唯一权威源与同步规则，避免两套数据打架：

- 单一真相源：同一项目以 design 侧的方案/BOM/计算结果为业务真相源；Rysnova 深化在其基础上派生，深化产生的工程修正回写需走变更评审回流 design。
- 变更双向同步：design 变更通知 Rysnova 重做受影响深化；Rysnova 工程修正以「变更建议」回流，经确认后更新 design，禁止两侧静默分叉。
- 交付物可追责：RysnovaArtifact 支持版本冻结、审图签章、回滚；施工现场只能取到「已冻结最新版」。
- BIM 核心价值项：rysnova-bim 模块显式包含碰撞检测、净高分析、管线综合，不止导出模型。
- 图纸 IP：图纸知识产权与可用性归属在合同层约定（经销商离场后的图纸使用权），落 file-artifact + 合同条款。
- 数字孪生几何源归一（与 4.11 DigitalTwin 接缝）：孪生场景的几何/BIM 元素以 Rysnova BIM 产物为来源，DigitalTwin 的 BIM→场景解析是消费方而非独立建模源，避免与 4.10 单一真相源形成第三套数据。

### 4.11 重点能力引擎成熟度（实测，区分已实现与占位）

下列引擎均确认需要、已裁定 KEEP（宪章 8.3），但成熟度不同，重构时区别对待，避免把占位当成品：

| 引擎 | 模块 | 已实现 | 占位/待补 |
|---|---|---|---|
| IoTPlatform | lifecycle | 设备注册/上报/指令/订阅/规则引擎/统计，6 个 supreme-api 端点已挂；业务编排可用（约 50-60%） | broker(MQTT)、设备发现、指令下发为模拟；状态在内存未落库。按 lifecycle_handoff_only 补外部 IoT 平台交接契约 + 落库 |
| DigitalTwinEngine | lifecycle | 场景/BIM→场景解析、实时同步、管路计算、能耗模拟、视图组装（约 40-50%） | load3DEngine 占位（未接 Three.js）；analyzeCameraImage 摄像头 AI 为随机数 mock；未落库。补真三维引擎 + 真实/外包摄像头 AI |
| LLM/SmartBrain/Voice | diagnosis | 问诊 AI 编排（Voice 为浏览器端） | AI 端点随 diagnosis 收口；真实模型接入按落地确认 |
| TriEnergySystem | analytics | 三能源/能耗碳分析 | 数据准确性需背书（对外报送合规） |
| CFD/TechnicalDelivery | rysnova-bim | CFD 仿真、技术交付生成 | 与 BIM 深化协同 |
| ChinaClimateDB/ChinaCities | product-catalog | GB 50736 气象/城市数据资产（精算权威输入） | — |
| Fission/Channel | crm | 裂变追踪、渠道管理 | — |

迁移铁律：标「占位/mock」的部分（IoT broker、3D 引擎、摄像头 AI 随机数）迁入时必须替换为真实数据源或显式标注 demo，不得当成品上线。

运行数据反哺精算（闭环反向价值，规划项）：lifecycle 侧 IoT 回流的真实运行能耗/工况可用于校准 design 精算模型（实测 vs 计算），形成「生命周期→设计」反向校准回路；校准只产出模型修正建议，不自动改写 verified 参数，须经标准复核确认（守 4.5 可信链）。

### 4.12 架构一致性约束（落实宪章 1.3/1.4 工程接缝）

补齐工程/架构红队（红队文档 Gem 7/8）暴露的可落地性接缝：

- AI 三引擎主入口裁定：diagnosis 推理以 LLMDiagnosisEngine 为唯一编排入口；SmartBrain 为其下的领域知识/匹配能力、Voice 为浏览器端语音输入适配；三者不各自独立对外，避免推理职责重叠。
- product_id 三态状态机：产品在 owned（认证）/ shared（共享库）/ tenant-private（租户私有）三态间的流转受控——私有→共享需总部收编评审、共享→认证需品牌库纳管 + 精算参数达标；态变只新增映射不改历史，已发出报价永远引用其下单时的 SKU 快照与态，杜绝追溯漂移。
- BIM 几何依赖有向无环：几何唯一源为 design 方案，经 Rysnova 深化派生，DigitalTwin 仅消费 Rysnova 产物；依赖链 design→Rysnova→DigitalTwin 单向无环，任何回写以 4.10 变更建议回流，禁止 C→A 直接改源。
- 精算参数契约校验位置：品牌库→catalog 同步在管道入库前校验「精算必填参数集」；缺字段 SKU 降级 calibrated 并告警，校验失败入死信队列人工核，不静默丢弃。
- 板块二扩张机制（对称补齐宪章 2.3 品牌扩张）：新增赋能线产品（继问诊/CRM/BIM 之后的第 4 件套）走「产品注册 + 复用赋能库底座 + 独立 namespace」流程，配置优先、必要时开发新模块；与品牌扩张并列为两条扩张路径。

## 5. 非功能需求

- 多租户隔离：混合分层（标准档 RLS 行级 / 强隔离档 schema / 物理隔离档独立库），所有业务写入带 tenant_id，跨租户查询被 RLS 拒绝并有自动化测试证明。详见宪章 5.4。
- 隔离档位触发规则：默认标准档 RLS；当租户满足合规要求（如金融/大客户数据分级）、数据量或性能阈值、或商务约定独立部署时，升级到 schema/物理隔离档。触发条件与升级流程在 tenant 模块配置化，不靠个案决定。
- 契约优先：每个生产 API 先在 OpenAPI 表达，前端只调用已声明接口；前后端永不漂移。
- 容量目标：经销商并发 500+、设计师/销售/服务 2000+、用户/客户档案 100000+。
- 可访问性与质量基线：响应式、WCAG AA、SEO、性能由 L1/L2 共享底座统一保证。
- 设计系统：世界级标准（Storybook + 可视化回归 + 品牌主题切换预览 + 经销商物料同源生成），详见宪章 6.5。

### 5.1 契约覆盖率（关键工程缺口，必须量化收口）

现状基线（2026-06-25 实测）：后端实测 599 个端点，但 OpenAPI（contracts/openapi/rhautt-nexus-v2.openapi.json）仅声明 104 个 operations / 93 路径 / 187 schemas，契约覆盖率约 17%。

这意味着"契约优先"目前只对 17% 的接口成立，其余 83% 端点处于契约外、前后端可能漂移。这是平台最大的隐性工程风险，必须显式收口：

- 目标：生产端点 OpenAPI 覆盖率 100%（端点进契约后前端才可调用）。
- 路径：随领域模块迁移同步补契约——每迁入一个端点到 NestJS 模块，用 @nestjs/swagger 自动产出 OpenAPI，再生成 client（packages/generated-client）。
- 阶段指标：按 quote / diagnosis / crm / design / rysnova-bim / delivery / lifecycle / analytics 模块顺序，每模块迁移完成时其端点契约覆盖率达 100%，并纳入 guard:generated-client、guard:frontend-api-contract。
- 验收：guard 校验"前端调用的 API 全部在 OpenAPI 已声明"，unmatched = 0（当前 route-owner-check 报告 frontend unmatched = 31，需随迁移清零）。
- 发布硬门槛（P0）：生产端点 OpenAPI 覆盖率与 frontend unmatched=0 是上线发布闸，不排到 P5 之后；任一未达标则阻断生产发布。否则「契约优先」验收（第 8 章）自相矛盾。

### 5.2 可观测性与 SLO（非功能需求）

重组蓝图 C 层的统一可观测性提升为显式非功能需求：

- 可用性 SLO：核心 C 端问诊与经销商台 API 月可用性 ≥ 99.9%；非核心后台 ≥ 99.5%。
- 延迟 SLO：问诊/报价等交互 API P95 < 800ms；报表/分析类 P95 < 3s。
- 错误预算：按 SLO 计错误预算，超预算冻结非紧急发布。
- 统一可观测性：结构化日志（带 tenant_id/trace_id）、指标、分布式追踪三件套；缓存/监控/备份从业务代码剥离到 infra 层（见第 7 章）。
- 告警：SLO 违约、RLS 拒绝异常、outbox 积压、退役矩阵失败均接告警。
### 5.3 中国合规（上线法律前置，必补专章）

业务涉及真实业主 PII + 经销商经营 + 金融/发票数据，合规是上线前置，非可选项：

- 等保 2.0：平台按等保二级（视数据规模评估三级）定级、备案、测评，安全要求纳入架构验收。
- 数据安全法 / 数据分级：业务数据分级（公开/内部/敏感/重要），定义留存期限、跨境出境红线（默认不出境）、访问审计；敏感数据加密存储。
- PIPL 个人信息保护：业主留资前提供知情同意与隐私政策、目的与可见范围告知、撤回与删除通道；同意记录留痕；最小必要采集。
- 业务可见范围：经销商可见的业主信息按授权与归属最小化，明文隐私不进平台管理员视图（见 2.1 铁律）。
- 品牌站群合规：各品牌站 ICP 备案、域名归属与内容治理 owner 明确；经销商物料下载按品牌分级授权（见 4.7）。
- 验收：合规项纳入发布前检查清单，PIPL 同意链路与 RLS 跨租户泄露红线测试进 CI。

### 5.4 跨板块数据库体系（需求级，对应宪章 5.5）

库拓扑（物理隔离交易，统一契约打通）：底座主数据库（控制平面单一事实源）/ 板块二瑞诺瓦·Rysnova 赋能库（RLS 多租户 + Mongo 文档）/ 板块一各品牌产品库（挂网权威源）/ 集团分析数仓（OLAP，终态锁定）。板块间禁止跨库直连与跨库 JOIN。

两层隔离关系（接 5/5.4 既有三档）：物理分库是「板块级」隔离（板块二独立库集群）；板块二库「内部」500+ 经销商租户仍按宪章 5.4 三档（默认 RLS 行级，按需 schema/物理库）隔离。物理分库不取代 RLS，二者叠加：板块隔离守边界，RLS 守租户。

跨板块通信过渡方案（消除迁移期断档）：事件总线就绪前（P1/P2），跨板块交互走底座发布的同步 API（契约优先），不允许跨库直连；P3/P5 总线就绪后将可异步化的交互切为事件驱动。过渡期方案显式写入，避免「先临时直连埋债」。

MDM 一致性边界（强一致 vs 最终一致）：主数据「只读副本」默认最终一致；但强一致敏感操作必须实时读底座主库，不得依赖副本——包括租户停用/冻结、授信与额度、品牌产品下架、价格生效状态。其余读路径接受副本最终一致 + 水位/对账兜底。

三条标准数据流：
- 主数据下行（MDM）：身份/租户/品牌主数据底座唯一写，板块只读订阅，禁止多处写。
- 产品主数据汇聚：各品牌产品库为权威源 → product-catalog 按 API/CDC 同步为可选用目录 → 瑞诺瓦选用即 4.5 第①层 verified；品牌库改价/上新刷新目录（影响新报价），已发出/待签报价按 4.9 价格快照锁定不自动跟涨，杜绝一物两价；瑞诺瓦只读不写品牌产品。同步前按 4.5 精算参数契约校验字段完整性，缺字段降级 calibrated。
- 分析上行：各库 CDC/ELT 单向入分析数仓 → 总部跨板块聚合分析（4.6 情报），只见聚合/脱敏，不见单一经销商明文。

统一接口与标准（流畅、一致、易维护）：跨板块交互 100% 走 OpenAPI 契约 + 统一事件信封（schema registry 版本化），事件总线选型在 P3/P5 定终态（候选 Kafka / NATS / Redis Stream，按吞吐与运维权衡），与既有 Temporal+Outbox 协同（Temporal 管编排、总线管跨板块事件分发）；全局统一标识（tenant/dealer/store/product/brand id 同义同形，主数据 ID 底座签发）；共享数据字典（金额/币种/UTC 时间戳/枚举/行政区划）；CDC 幂等可重放带水位与对账；schema 版本化迁移（expand-contract）进 CI。

工业级运行：OLTP/OLAP 分离（分析走副本/数仓）；主从复制 + 自动故障切换；连接池按板块隔离；跨可用区 + RPO/RTO + PITR + 恢复演练；静态加密 + PII 列级加密。

验收：无跨库直连（guard 校验连接串）；主数据单写源有测试；品牌目录同步有对账报告；总部分析取自数仓且脱敏跨租户不可达；HA 切换与备份恢复演练留证。

## 6. 品牌与多品牌扩张需求

- 新增品牌 = 配置：brand-registry.json 登记 → packages/tokens/<slug>.css 深度 token → Nx 生成器生成 apps/<slug> → 跨链接自动生成。禁止 fork 代码改字。
- 品牌 VI 以实测为准（宪章第 6 章）：Rheem 藏青 #1B365D + Rmc 设计系统；Ruud 青 #50C8E8 + 暗红 #8B0E04 + a_love_of_thunder；Everhot 复刻 Rheem 三受众架构、token 独立。
- 各品牌站以本品牌 wordmark 为第一视觉，统一标注 Powered by Rhautt Comfort。

## 7. 资产处置与重构需求（落地约束）

后端 193 资产裁定终态（audit/asset-ledger.md，经接线一致性 + 治理一致性双重校正后，REVIEW 已清零）：

| 处置 | 数量 | 含义 |
|---|---:|---|
| KEEP | 158 | 活跃能力，按领域迁入 A/B/C 三层 |
| MIGRATE | 14 | 平台基础设施(10) + 仍活跃登记的旧版引擎(4，先切引用再退役) |
| LEGACY-COMPAT | 13 | 过渡兼容路由（含 3 个上帝路由的承接面） |
| GOVERNED-RETIRE | 3 | 已纳入 legacy-fusion-registry 退役矩阵的旧版引擎 |
| SPLIT | 3 | 上帝路由 business-domain/core-api/supreme-api |
| ARCHIVE | 2 | 真孤儿（已移入 legacy/） |

重构铁律：

- 退役走既有治理机制：引擎退役由 audit/legacy-fusion-registry.json + 12 门退役矩阵（守卫 scripts/agent-guards/compatibility-engine-retirement-matrix-check.js）管辖，要求替代实现证据、租户隔离测试、回滚记录、catalog 不再依赖；不由台账或个人单方面删除。
- 接线一致性：旧版引擎若仍在 engineRegistry 活跃登记（LoadCalculationEngine / QuotationEngine / ValueBasedQuotationEngine 等），禁止直接删，先切引用到 V2/V3，确认零运行引用再退役（MIGRATE）。
- 上帝路由（business-domain/core-api/supreme-api）端点先迁入领域模块，旧路由转 legacy-compat 再删。
- 基础设施（缓存/监控/持久化/部署/备份）剥离到 infra 层，业务代码不再直接 new。
- 计算内核 B 层抽为无副作用纯函数，可单测、可被未来 Go/Rust 重算服务替换。
- 未获产品确认前，candidate/archive/static 页面不挂生产导航，也不删除。
- 本轮已物理执行：2 个真孤儿（solution-visual-packages.routes 未挂载、Construction 模型零接线）移入 legacy/，guard 与退役矩阵保持全绿。

## 8. 验收标准

1. 产品定位、品牌关系、入口职责与宪章一致。
2. 每个 surface 在四层边界中有归属，无无 owner 孤儿代码。
3. 新增品牌走配置流程跑通（证明扩张是配置非开发）。
4. 契约优先：前端只调用 OpenAPI 已声明 API。
5. 多租户隔离经验证，无跨经销商泄露。
6. guard / harness / readiness / 视觉验收全绿。
7. 发布硬门槛（P0，缺一不可上线）：契约覆盖率达标且 frontend unmatched=0；中国合规专章（等保定级 + 数据分级 + PIPL 同意链路）落地；财务闭环（金融渠道/发票/对公结算）可用；共享库竞品商标责任归属明确。
8. 跨租户泄露红线测试在 CI 常态运行且通过。

## 9. 迁移路线与里程碑

按重组蓝图第 6 节落地顺序排阶段，每阶段给可量化出口标准（吸收自 migration-roadmap、PRODUCTION-TRUNK-REWRITE-PLAN、PHASE-1-REWRITE-EXECUTION-CHECKLIST 等历史计划）。

| 阶段 | 目标 | 关键动作 | 出口标准 |
|---|---|---|---|
| P0 冻结基线 | 事实锁定 | 资产台账 + 能力蓝图 + 反向审计三报告冻结 | 已完成：REVIEW=0，guard/harness 全绿 |
| P1 计算内核 B | 抽暖通内核为纯函数 | 五大系统+控制内核抽到 packages/domain 或 services/api kernels，加单测 | 内核脱离 HTTP/租户上下文，单测覆盖关键路径 |
| P2 领域模块 A | NestJS 逐模块落地 | 按 quote→diagnosis→crm→design→rysnova-bim→delivery→lifecycle→analytics 迁端点 | 每模块端点 OpenAPI 覆盖 100%，旧路由转 legacy-compat |
| P3 剥离基础设施 C | 统一 infra | 缓存/监控/持久化/部署/备份剥离，业务不再直接 new | guard:redis-cache-boundary 等全绿 |
| P4 收敛多代 | 旧版退役 | 按 legacy-fusion-registry + 12 门退役矩阵逐个退役 | 退役矩阵 failures=0，旧版零运行引用 |
| P5 契约对齐收口 | 契约覆盖率 100% | 剩余端点全部进 OpenAPI，前端 unmatched=0 | guard:frontend-api-contract unmatched=0 |
| P6 生产化 | 上线就绪 | 真实 Postgres/Mongo staging 压测、RLS 测试、视觉验收 | guard:all + test:production-readiness 全绿 |
| P7 实景能力落地 | mock→真实 | IoTPlatform 接外部 IoT 平台交接 + 状态落库；DigitalTwin 接真三维引擎(Three.js) + 摄像头 AI 真实/外包替换 | 4.11 标 mock 项全部替换为真实数据源或显式 demo 标注，无随机数冒充 |

每阶段都要求 guard/harness/test 全绿，且 routeOwnership 注册表与重组蓝图保持一致。

数据迁移专项（V1→V2 实体，贯穿 P2/P4）：Customer/Quotation/Contract/User 的 V1→V2 切换走 expand-contract——先双写（V1+V2 并写）、灰度双读校验、回填脚本补历史、确认 V2 一致后停 V1 写、最后退役 V1；每步留回滚点，禁止一次性切换。落对应模块迁移时执行。

## 10. 已知风险与外部依赖

| 风险/依赖 | 影响 | 当前状态 | 缓解 |
|---|---|---|---|
| 契约覆盖率仅 17% | 前后端漂移、契约优先落空 | 599 端点中 104 进契约 | 随 P2/P5 同步补契约 |
| 7 个 Rysnova 交付门需真实外部 staging | 阻塞生产验收 | 被外部环境阻塞 | 需用户提供真实 staging 环境 |
| 多租户 RLS 需真实 Postgres 压测 | 隔离验收无法离线完成 | 需真实库 | P6 阶段在 staging 执行 |
| 旧版引擎仍活跃登记 | 直接删会破坏运行时 | 已识别，纳入退役矩阵 | 先切引用再退役 |
| 中国合规未落地（等保/数据安全法/PIPL） | 上线法律风险 | 红队 2026-06-25 发现缺口，已补 5.3 | 上线前完成定级/同意链路，进 CI |
| 财务闭环缺金融方/专票/对公结算 | 经销商无法真实成交 | 已补 4.9，金融方待商务确定 | 可插拔金融适配层，商务定方后配置 |
| 共享库竞品商标/授权责任 | 阳谋合法性风险 | 已补 4.5 责任归属 | 总部统一承担 + 授权/声明留痕 |
| 全屋同时系数缺失致过度选型 | 报价虚高、打脸工程级计算 | 已补 4.3 系统级协调 | P1 内核实现 diversity factor |
| design↔Rysnova 双源打架 | 落地数据不一致 | 已补 4.10 单一真相源 | 变更双向同步 + 版本冻结 |
| 事件总线选型未定致迁移期断档 | 跨板块通信悬空 | 已补 5.4 过渡走底座 API | P3/P5 定总线，过渡同步调用 |
| MDM 副本延迟致业务错误 | 停用租户仍下单等 | 已补 5.4 强一致边界 | 敏感操作实时读底座主库 |
| V1→V2 实体迁移丢数 | 核心成交链数据风险 | 已补第 9 章双写专项 | expand-contract 双写双读回填回滚 |
| 模块/板块/数据平面归属漂移 | 架构腐化 | 已补宪章 1.3 映射表 | 映射唯一 + 1.4 仲裁规则 |
| 外链旧站（rheem.com.cn/ruud.com.cn）过渡 | 新站上线前空窗风险 | 临时占位 | 深度托管新站上线即下线旧站 |
| 沙箱 localhost 受限 | 本地 UI 验证受限 | 已知环境约束 | 用 Codex in-app browser 验证 |

## 11. 文档收敛映射（全量 116 docs + 根级）

原则：单一事实源为 PROJECT-CHARTER（上级）+ 本 PRD（需求展开）+ 少数保持权威的机器/台账文档。其余按"已吸收→可删"或"历史归档"处置。逐文件清单见 docs/DOC-CONSOLIDATION-LEDGER.md（拟删除清单，共识后执行）。

保持权威（不动，本 PRD 引用）：

| 文档 | 角色 |
|---|---|
| PROJECT-CHARTER.md | 单一事实源，本 PRD 上级 |
| docs/CAPABILITY-DECOMPOSITION-AND-RECOMPOSITION.md | 能力重组蓝图 |
| audit/asset-ledger.md、docs/STRUCTURE-ASSET-LEDGER.md | 资产处置台账 |
| docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md | public 页面逐页台账 |
| docs/DATABASE-BACKEND-ARCHITECTURE.md、docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md | 数据/ERD 专题（第 4.2 引用） |
| brand-registry.json、contracts/ | 机器可读契约 |

已吸收进本 PRD（共识后删除）：

| 类别（数量） | 吸收章节 |
|---|---|
| 历史 PRD/规格：PRD-CURRENT、PRODUCT-SCOPE、INTEGRATED-PRD-v5.0、PRD-INTEGRATED-FEATURES-v6.0、PRD-UPDATE-v5.0、DETAILED-DEVELOPMENT-GUIDE-v5.0、FULL-REWRITE-CHARTER-PRD-*、PROJECT-CHARTER-AND-PRD 等 | 第 1/3/4 章 |
| 暖通领域规格（11）：五大系统计算、DOAS（新风标准档）、水系统矩阵、即插即用包、设备定位 | 第 4.3 |
| 竞品研究（4）：海尔/A.O.史密斯、行业调研 | 第 4.4 |
| 双栖/IoT/契约：LIFECYCLE-IOT-BRIDGE、THREE-TIER-CONTRACT、RYSNOVA-ARTIFACT、WORKFLOW-OUTBOX | 第 4.1/数据/契约约束 |
| VI 专题（8）：RUUD-VI、RYSNOVA-UI-VI、UI-VI-ARCHITECTURE 等 | 宪章第 6 章（实测为准） |

历史归档（可删，无前瞻需求）：

| 类别（数量） | 说明 |
|---|---|
| 完成/修复/验收报告（21） | 过程记录，价值已落入代码与台账 |
| 历史开发计划/冲刺（11） | 被第 9 章里程碑取代 |
| 手写 API 参考（25，API-*.md） | 被 OpenAPI 契约 + 自动生成取代 |
| 命名候选/审计（2） | 命名已锁定（宪章第 1 章） |

删除动作在共识后由 docs/DOC-CONSOLIDATION-LEDGER.md 逐条执行，避免文件紊乱。


---

## 12. 遗憾补全记录

### 12.1 需求↔代码双向追踪（遗憾1）

**工具**：`scripts/agent-guards/prd-code-crosswalk-check.js`  
**用途**：CI/CD 门禁 + 人工 sprint 结束时跑一次，确保 PRD 模块有对应代码落地。  
**当前基线**（2026-06-25）：

| 状态 | 数量 | 模块 |
|---|---|---|
| Full（双锚点均在） | 7 | M04/M06/M07/M08/M09/M10/M13 |
| Partial（前端有、路由缺） | 5 | M01/M02/M03/M05/M11 |
| Miss（代码无任何对应） | 3 | M12/M14/M15 |

**三个 MISS 的补全优先级**：

| 模块 | 缺失内容 | 优先级 | 目标 Sprint |
|---|---|---|---|
| M12 design↔Rysnova 单一真相源 | `server` 里无 `design_id`/`rysnova-bim_sync` 任何标识符 | P1 | V1.1 |
| M14 中国合规(等保/PIPL) | `server` 里无 `consent`/`pipl`/`dataRetention` | P0（上线法律前置） | V1.0 发布闸 |
| M15 跨板块数据总线/MDM | `server` 里无 `MDM`/`eventBus`/`global_product_id` | P1 | V1.1 |

**运行方式**：
```bash
node scripts/agent-guards/prd-code-crosswalk-check.js
# 输出写入 evidence/crosswalk/prd-code-crosswalk-report.json
# exit 0 = no MISS; exit 1 = 有 MISS（可接 CI 门禁）
```

**目标**：V1.0 发布前 MISS = 0，Partial ≤ 2；evidence JSON 作为验收附件。

---

### 12.2 上线冷启动运营方案（遗憾3）

**文档**：`docs/COLD-START-PLAYBOOK.md`  
**三阶段摘要**：

| 阶段 | 时间 | 核心动作 | 关键指标 |
|---|---|---|---|
| 种子期 | D0–D30 | 3–5 家种子经销商邀请制，数据库从零到有，P0 Bug 清零 | 活跃租户 ≥ 3，完整问诊→报价 ≥ 10 次 |
| 扩散期 | D31–D60 | 10–20 家经销商区域推广，C 端问诊接微信/小红书公测 | 注册经销商 ≥ 10，C 端问诊 ≥ 100，转留资率 ≥ 20% |
| 验收期 | D61–D90 | 完整闭环第一单（问诊→报价→签单→施工→验收），V2 需求清单确认 | ≥ 1 个有收款闭环，MAU ≥ 50 |

**上线前置门禁（不达不开放）**：
1. Crosswalk MISS 模块清零
2. 产品目录 ≥ 20 SKU（Rheem + Everhot）
3. 2 个租户完成端到端演练
4. 等保二级备案启动（或管理层签字豁免）
5. 数据备份 restore 演练通过

**D90 后动作**：Crosswalk 重跑（目标 MISS=0），运营月报送管理层，进入 V2 双周 Sprint。
