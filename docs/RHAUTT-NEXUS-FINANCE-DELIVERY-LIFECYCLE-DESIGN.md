# 报价财务闭环 + 交付生命周期 设计（W3 + W4）

> 状态：待评审（设计阶段，不含实现代码）· 2026-06-30
> 上游：MASTER 蓝图（§1.6 软引用+RLS+outbox · Part 4 波次 W3/W4 · 决议#3 opportunity 强制 · 决议#4 责任归经销商/平台不深度介入）
> 事实源：实读 `quote.service`（guardrail+快照锁）· `delivery/contract.service`（状态机）· `delivery.service`/`lifecycle.service`（legacy 桥）· `server/modules/lifecycle`（PROJECT_STATES + IoT handoff）
> 承接：报价之后的财务与交付全链，把"报价→合同→收款→施工→验收→IoT 维保"打通成单一闭环。

---

## 0. 现状（实读）
- **quote**：`guardrail`（毛利护栏）+ `lockQuotation`（锁前过 block 护栏 → 价格快照 → `lockedVersion++` → draft→locked）。**财务下半段全缺**。
- **contract**（delivery 原生，RLS）：状态机 `draft→sent→signed→active→fulfilled`(+cancelled)，`sign` 记 `signedAt`。**仅状态流转，无电子签/收款/发票**。
- **technical delivery**：legacy 桥（`runtimeEngineAccess('technicalDelivery')`），生成交付单/清单。
- **lifecycle**：legacy 薄桥（`server/modules/lifecycle`），`PROJECT_STATES` 状态机 + IoT `capabilityRegistry`，**`controlBoundary: 'lifecycle_handoff_only'`**（平台只交接不控制——已契合决议#4）。

---

# W3 · 报价财务下半段

## W3.1 电子签约（决议#4：经销商主体 + 平台不深度介入）
- 在 `contract.sign` 之上接**第三方电子签**（如 e签宝/法大大）。
- **经销商是签署主体与责任方**；平台**仅提供对接能力 + 存证回执**，不背书、不担责。
- contract 增列：`sign_provider` / `sign_envelope_id` / `signed_doc_url` / `sign_status`。
- 流程：`sent →（发起第三方签署）→ 回调 signed（存证回执）→ active`。
- 免责声明前置（与精算签章一致）。

## W3.2 收款节点（与合同状态 + 施工里程碑联动）
- **收款计划** `payment_schedule`：定金 / 进度款 / 尾款（比例可配），各节点绑定 **contract status 或 delivery 里程碑**。
- **回款登记** `payment_record`：实收金额/时间/凭证/操作人。
- 钉点规则（示例）：合同 signed→定金；施工里程碑→进度款；验收 accepted→尾款。
- 事件：`payment.received` → outbox → 驱动下一阶段（如定金到账才可派工）。

## W3.3 分期/月供（可插拔资方）
- quote 已有 `econetPremium` 占位，可承载月供展示。
- **资方可插拔**（finance provider 适配层）：平台**只对接不放贷**（决议#4 一致）。
- `finance_application`：分期方案/期数/月供/资方/审批态；对客呈现"月供 ¥X/月"。

## W3.4 发票
- `invoice_request`：专票/普票、抬头、税号、金额。
- **开票主体 = 经销商**（决议#4），口径与 `CommercialTaxEngine`（归位 kernels 后）一致。

---

# W4 · 交付闭环（施工 → 验收 → IoT 生命周期）

## W4.1 施工里程碑
- `delivery_milestone`：派工 → 进场 → 安装 → 调试 → 完工（可配工序）。
- 每里程碑可挂照片/检查项/操作人；**进度款节点钉在里程碑上**（联动 W3.2）。

## W4.2 验收
- lifecycle `markAccepted` + `acceptance_checklist`（验收项逐条勾核）。
- 验收签章 = **经销商 + 客户**双确认（经销商责任主体，决议#4）；通过才可触发尾款。

## W4.3 IoT 交接（去 mock，严守交接边界）
- 沿用 `capabilityRegistry` + `bindingStatus: prepared→bound` + **`controlBoundary: 'lifecycle_handoff_only'`**。
- **平台只做"设备登记 + 交接包"，不接管设备控制**（决议#4 落地）；控制权交客户/经销商 App。
- `buildIotHandoffPackage` 去 mock：真实设备清单/IoT 设备号/能力注册。
- IoT 协议接入：已有 `MqttBrokerEngine`（server/engines）可桥接（待拍板，§待办）。

## W4.4 lifecycle 归位（reclaim，类比精算）
- 现 `lifecycle.service` 是 legacy 薄桥 → **归位 NestJS 原生实体 + RLS**（W4 重组）。
- `PROJECT_STATES` 状态机迁入领域服务；`lifecycle_links` 已是原生表，补齐状态/转移审计。

## W4.5 客户项目视图
- `customer-portal` 经数据口读 `listCustomerProjectViews`：客户看进度（施工里程碑/验收/IoT）。

---

# 财务 × 交付 联动主线（一条闭环）
```
报价(锁价/快照) → 合同(经销商电子签) → 定金到账 → 派工
   → 施工里程碑(进场/安装/调试) → 进度款 → 完工
   → 验收(经销商+客户签章) → 尾款 → IoT 交接(handoff_only)
   → 生命周期维保(customer-portal 可视)
收款节点钉在 [合同状态] + [施工里程碑] + [验收] 上；每步 outbox 事件驱动下一步。
```
**全链每个产物挂 `opportunity_id`**（决议#3）；跨表软引用 + 单一 outbox，无硬外键（§1.6）。

---

# 数据模型增量（RLS + 软引用 + outbox）
| 表/增列 | 用途 |
|---|---|
| `contract`（增列） | sign_provider / sign_envelope_id / signed_doc_url / sign_status |
| `payment_schedule` | 收款计划（定金/进度/尾款，绑定状态或里程碑） |
| `payment_record` | 回款登记 |
| `finance_application` | 分期/月供（可插拔资方） |
| `invoice_request` | 发票申请（经销商开票） |
| `delivery_milestone` | 施工里程碑 |
| `lifecycle_*`（归位） | PROJECT_STATES 状态 + 转移审计（NestJS 原生） |

事件：`contract.signed` / `payment.received` / `invoice.issued` / `milestone.reached` / `project.accepted` / `iot.handoff.ready`。

---

# 待拍板开口项
1. **电子签选型**：e签宝 / 法大大 / 多家适配？经销商自选还是平台统一对接一家（决议#4 下平台只提供能力）？
2. **分期资方**：本期是否纳入？还是先留 `finance_application` 占位、对接延后？
3. **发票开具**：确认开票主体=经销商（决议#4）；平台是否提供开票 API 对接（如百望/航信）？
4. **IoT 协议/平台**：用现有 `MqttBrokerEngine` 还是对接第三方 IoT 云？handoff_only 边界下平台职责到哪为止？
5. **收款钉点规则**：定金/进度/尾款的默认比例与触发节点是否租户级可配？
