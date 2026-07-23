# Rhautt Nexus · 五模块功能完整性 + 数据口蓝图

> 状态：待评审（设计阶段，不含实现代码）· 2026-06-29
> 事实源：实读 `services/api/src/modules/{diagnosis,crm,quote,design,rysnova-bim}` · `mdm` · `compliance` · `PRD-v2.md` · `platform-modules.json` · `RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md`
> 推进顺序（用户锁定）：**①五模块功能完整性 → ②多品牌站+瑞诺瓦打通 → ③数据口蓝图（本文档先架好）→ ④具体衔接（最后）**
> 三条约束（必须贯穿）：A. 多品牌入口 + 问诊均汇入瑞诺瓦赋能后端承接；B. 瑞诺瓦可**独立上线**；C. 经销商**联名子模板** + **阳谋机制**。

---

# Part A · 五模块功能完整性盘点

## A.0 共同规律
**壳（持久化/状态/工作流）基本完成；核（智能/计算/规则）缺失或仍困在 `server/core` legacy 未桥接。**
legacy 43,863 行引擎装着"核"，新领域服务 4,795 行是"壳"，目前只桥接了 4 个引擎（`LoadCalcV3`→design；`Econet/Export/Promotion`→quote）。

## A.1 问诊 diagnosis（~40%）
- **壳已完成**：`completeDiagnosis/getReport/share-view/revoke`；实体 `pain_points[]/systems[]/recommendedTier/solutions/aiReasoning/shareTokenHash/sourceSurface`，关联 `customerId/opportunityId/reportId`。
- **核缺失**：① 真 LLM 未接（`aiReasoning` 仅存字段，无模型调用）；② 多轮澄清对话；③ **问诊→派单**（零调用 CRM/intake）；④ C 端 PIPL 同意闸（P0）。
- **补全**：接 `LLMDiagnosisEngine`（legacy）或真模型 → 产出画像；接交接层 intake（见交接层设计 §3.1 A/B）。
- **优先级**：P0 同意闸 · P1 LLM 接入 + 派单 · P2 多轮澄清。

## A.2 CRM crm（~60%）
- **壳已完成**：`leads/customers/pipeline/customer360/opportunities:stage/sign/interactions`；customer(`phoneHash/encrypted/ownerUserId/source/profile/tags`)、opportunity(`stage/estimatedValue/probability/quotationId/lifecycleLinkId`)、interaction。
- **核缺失**：① **§4.8 归属规则引擎**（首触/区域/分配，现仅 `ownerUserId` 字段）；② **跨 dealer 撞单裁决**（现仅 tenant 内 `phoneHash` 去重）；③ **离职交接**；④ SLA/跟进提醒/任务流；⑤ 裂变/渠道仪表盘（`FissionTrackingEngine/ChannelManagementEngine` legacy 未接）。
- **补全**：归属/撞单/交接规则层（与交接层共用裁决器）；桥接渠道/裂变引擎。
- **优先级**：P1 归属+撞单+交接 · P2 SLA/任务流 · P2 渠道仪表盘。

## A.3 报价 quote（~65%，最完整）
- **壳已完成**：`generate/load-calc/econet-premium/export/guardrail-check/persist/list/:id/lock`；**毛利护栏 guardrail**、**价格快照锁定**(`priceSnapshot/quotationLock`)、`costBreakdown/taxProfile/lifecycleLinkId`。
- **核缺失**：财务下半段 §4.9——① 金融分期/月供（可插拔资方）；② 发票（专票/普票）；③ 收款结算（定金/进度款/尾款，联动 delivery 节点）；④ **电子合同/在线签约**（现 `sign` 仅 opportunity 标记，非电子签）。
- **优先级**：P1 电子签约 + 收款节点 · P2 分期/发票。

## A.4 设计 design（~35%）
- **壳已完成**：`saveFloorPlan/listProjects/getLatestPlan/load-calc`；floor_plan(`walls/equipment/rooms/doors/windows/furniture/version`)，桥接 `LoadCalculationEngineV3`。
- **核缺失**：① 五系统精算 HS/WT/AIR/HEAT/CTRL（**仅 1 桥**）；② DOAS 两档；③ **必算硬校验**（同时使用系数/噪声/水力/结露——出图分水岭）；④ 复核签章 + 免责声明；⑤ TCO 十年账；⑥ 三档对比联动报价。
- **补全**：桥接 `CalculationEngine/FiveConstantEngine/DOASComplianceEngine/CommercialTaxEngine` 等 legacy；硬校验作出图闸。
- **优先级**：P1 五系统 + 必算硬校验 + 签章 · P2 TCO/三档联动。

## A.5 BIM rysnova-bim（~70%，工作流最全）
- **壳已完成**：产物全生命周期（创建/审批/完整性/下载）、客户包、`buildIotHandoffPackage`、BOM 导出、`inheritFromQuotation`、**M12 design-sync 单一真相源**(`link/design-changed/propose-change/confirm/status`)。
- **核缺失**：① 真 BIM 几何/碰撞检测/净高/管综（`bim_data` jsonb 占位）；② 多专业协同/审图批注；③ CFD 协同。
- **补全**：接 `BIMExportEngine/CADImporter/CFDSimulationEngine`（legacy）或外部 BIM 引擎；几何标 demo 或接真引擎。
- **优先级**：P2 几何/碰撞（或显式标 demo）· P2 协同批注 · P3 CFD。

## A.6 完整性结论
- **可优先打通经营闭环**：quote(65)+rysnova-bim(70)+crm(60) 壳足够，补"规则/财务/签约"即可跑通 `报价→合同→施工→验收`。
- **智能核是长板瓶颈**：问诊 LLM、设计精算是质量天花板，需 legacy 归位（见单独《Legacy 引擎归位裁决表》待出）。

---

# Part B · 数据口蓝图（Data-Port Blueprint）

> 目的：先把"每个模块对外暴露什么数据口、用什么主数据 ID 串联、经什么总线流转"定死。**这样多品牌入口与问诊后续接入时，只接数据口、不改模块内部**。具体衔接留到最后。

## B.1 主数据 ID 总表（全平台同义同形，底座签发）
依 `PROJECT-CHARTER` §统一标识 + `mdm`：

| ID | 签发方 | 作用域 | 说明 |
|---|---|---|---|
| `tenant_id` | 底座 tenant | 全局 | 经销商/品牌运营/平台 intake 租户 |
| `dealer_id` / `store_id` | tenant | 租户树 | RLS 隔离边界 |
| `customer_id` | crm | dealer/store | 归属后客户 |
| `opportunity_id` | crm | dealer/store | 商机/项目主线（串 quote/design/rysnova-bim/lifecycle） |
| `intake_lead_id` | intake（交接层） | 未归属池 | 派单前的临时主键，溯源到 customer_id |
| `diagnosis_report_id` | diagnosis | 客户/分享 | 问诊报告快照 |
| `quotation_id` | quote | dealer/store | 报价（带 priceSnapshot/lock） |
| `design_id` | design | dealer/store | 设计真相源（M12 锚点） |
| `rysnova-bim_artifact_id` | rysnova-bim | dealer/store | BIM/交付产物 |
| `lifecycle_link_id` | lifecycle | 客户资产 | IoT handoff 锚点 |
| `global_product_id` | **mdm** | 全平台 | 跨品牌库产品主数据（贯穿 catalog/quote/design） |

**串联主线**：`intake_lead_id → customer_id → opportunity_id →（diagnosis_report_id / design_id / quotation_id / rysnova-bim_artifact_id）→ lifecycle_link_id`。opportunity 是经营闭环的脊柱。

## B.2 每模块对外数据口（契约级，不暴露内部）

| 模块 | 入口（被写） | 出口（可读/可订阅事件） | 隔离 |
|---|---|---|---|
| 交接层 intake | `POST /intake/leads`（公开+同意） | event `lead.captured/routed/assigned` | 未归属池→RLS |
| diagnosis | `POST /diagnosis/complete`（A/B 分流） | `diagnosis.report.created`；report 快照只读/分享 | PIPL+RLS |
| crm | `intake 系统态写` / `interactions` | `customer.assigned`、`opportunity.stage.changed` | RLS |
| quote | `POST /quote/persist`（由 opportunity 驱动） | `quote.locked`、`quote.signed`、收款节点事件 | RLS+快照锁 |
| design | `POST /design/floor-plans` | `design.changed`（→ rysnova-bim M12） | RLS |
| rysnova-bim | `inheritFromQuotation` / artifacts | `artifact.approved`、`iot.handoff.ready` | RLS+签章 |
| product-catalog | `brand-console 写` | **公开只读** `GET /brand/:brand/products`（脱敏） | HQ租户/brand 维度 |

铁律：**应用 → 数据口（/api/v2/*）→ 数据**，禁止前端直连库、禁跨应用 import（`platform-modules.principles`）。

## B.3 事件总线（承接机能的底座）
- **单一 outbox 事件总线**（已拍板合并，废双轨；见下文已拍板决议 #2）。
- 所有跨模块流转走 **outbox 事件**（不直接跨域调用），保证 ToC→ToB、品牌站→赋能后端的**异步承接**与可追溯。
- 这正是"多品牌入口 + 问诊都汇入瑞诺瓦赋能后端"的技术承载：**入口只发 `lead.captured` 事件到总线，赋能后端订阅承接**。

## B.4 承接机能（Part ② 预留口，本期只定接口不接线）
```
多品牌站(everhot/rheem/ruud/public-portal) ─┐
瑞诺瓦 AI 问诊(consumer-diagnosis)        ─┼─▶ POST /api/v2/intake/leads ─▶ outbox: lead.captured
经销商联名子模板入口                       ─┘                                      │
                                                                                   ▼
                                              瑞诺瓦赋能后端（板块二）订阅承接 → 交接层派单 → CRM
```
- 入口侧只认一个**统一数据口 + 一个事件**，新增品牌/入口 = 配置，不改后端（呼应"配置优先"）。

## B.5 三条约束在蓝图中的落点

**C-1 多品牌入口汇入赋能后端**
- 所有品牌站/问诊经 `intake/leads` + outbox `lead.captured` 单口汇入；`brand` 字段区分来源；赋能后端统一承接。

**C-2 瑞诺瓦可独立上线**
- 板块二（diagnosis/crm/quote/design/rysnova-bim）数据口**自洽闭环**，不依赖任何品牌站：品牌站缺位时，问诊/经销商工作台仍可独立产生 lead→经营闭环。
- 数据口蓝图保证：品牌站是**可选上游**，不是必需依赖（单向向下依赖，品牌站在最上层）。

**C-3 经销商联名子模板 + 阳谋机制**
- **联名子模板**：基于 §4.7 `tenantDisplayName` + 品牌授权，经销商在统一数据口之上挂"联名子模板"（展示层皮肤），数据仍走同一套口与 RLS——模板是展示授权层，不改数据归属。
- **阳谋机制**：经销商用"中立第三方工具"对客（问诊/方案/分享页呈现经销商联合主体），平台在**总部只见聚合/脱敏**（catalog 采集调用量/转化情报），经销商得获客与赋能、平台得行业数据——双赢的阳谋。数据口蓝图对此的支撑：公开只读端口采集**脱敏调用情报**，经营明文严守 RLS 不外泄。

---

# Part C · 推进路线（对齐用户顺序）

| 阶段 | 内容 | 本文档对应 | 状态 |
|---|---|---|---|
| ① | 五模块功能完整性补全（壳→核，legacy 归位） | Part A | 待批准补全清单 |
| ② | 多品牌站 + 瑞诺瓦打通设计（承接机能） | Part B.4 预留口 | 设计待展开 |
| ③ | 数据口蓝图（主数据 ID/契约/总线） | Part B | **本文档已架** |
| ④ | 具体衔接实现 | — | **留到最后** |

## 已拍板决议（2026-06-29）
1. **Legacy 核引擎归位优先级 = 精算优先**：先把设计五系统精算（`CalculationEngine/FiveConstantEngine/DOASComplianceEngine/CommercialTaxEngine`）归位到 `design` 模块 + 必算硬校验作出图闸；问诊 LLM 排其后。理由：精算是报价/方案可信度的根，且已有 `LoadCalcV3` 桥可循。
2. **outbox 单一化 = 合并**：废 `mdm_outbox_events` 与 `outbox_events` 双轨，收敛为**单一 outbox 事件总线**（单投递器、单语义）。所有跨模块/跨板块/承接事件统一走此总线。
3. **opportunity 强制为经营脊柱 = 是**：所有经营产物（diagnosis_report / design / quotation / rysnova-bim_artifact / lifecycle_link）**必须挂 `opportunity_id`**，无 opportunity 不得落经营数据；intake 归属时即创建 opportunity（`stage='lead'`）。
4. **联名子模板 = 可配功能开关**：模板不止展示皮肤，含**功能开关位**（经销商可按授权开关问诊/报价/分享等能力），开关受品牌×经销商授权矩阵约束，数据仍走统一数据口与 RLS。

### 决议传导影响
- **Part A**：设计 design 模块补全升为**首位**（五系统 + 硬校验 + 签章）；问诊 LLM 降为其后。
- **Part B.1**：`opportunity_id` 成为所有经营产物的**必填外键**；intake `assigned` 即建 opportunity。
- **Part B.3**：事件总线收敛为单一 outbox，承接机能（B.4）订阅此单一总线。
- **Part B.5 C-3**：联名子模板新增"功能开关"维度，授权矩阵驱动，需在 §4.7 身份层之上扩展能力开关表。
