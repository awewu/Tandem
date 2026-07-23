# Rhautt Nexus / 瑞合数智枢纽 · 客户项目生命周期状态模型

> 日期：2026-06-06  
> Owner：`customer-project-lifecycle-director`、`iot-lifecycle-architect`。  
> 状态：P0 状态模型草案，用于客户项目门户、业务控制台、交付、服务计划和 IoT lifecycle handoff。

## 1. 目标

客户项目门户不是简单展示报价，也不是内部施工后台外露。它要让客户在购买瑞诺瓦舒适家系统后，能够清楚看到方案、报价、订单、施工、验收、维保和 IoT handoff 的进展。

当前系统负责售前、售中、交付和 IoT 生命周期衔接，不直接承担实时 IoT 控制平台。

## 2. 主状态

| State | 客户可见 | 内部动作 | 下一状态 |
|---|---|---|---|
| `lead-created` | 已收到需求。 | CRM 建档、tenant scope、销售分配。 | `diagnosis-in-progress` |
| `diagnosis-in-progress` | 正在生成舒适家需求画像。 | 瑞诺瓦 AI 问诊、六大系统采集。 | `solution-drafted` |
| `solution-drafted` | 方案初稿已生成。 | 三档方案、系统包、设备配置、预算。 | `design-in-progress` |
| `design-in-progress` | 设计师正在深化方案。 | 平面、设备点位、管路、BOM。 | `quote-drafted` |
| `quote-drafted` | 报价草案已生成。 | 成本、税费、毛利、促销、风险预留。 | `quote-approved` |
| `quote-approved` | 报价已审核，可确认。 | 审批、客户价、付款计划。 | `contract-pending` |
| `contract-pending` | 合同待确认。 | 合同生成、签署、收款节点。 | `construction-planning` |
| `construction-planning` | 施工计划制定中。 | 排期、材料、技术支持、Rysnova 深化。 | `construction-in-progress` |
| `construction-in-progress` | 正在施工。 | 里程碑、材料、现场记录、质量安全。 | `acceptance-pending` |
| `acceptance-pending` | 待验收。 | 验收报告、整改、客户确认。 | `accepted` |
| `accepted` | 项目已验收。 | installed asset、保修、服务计划、IoT handoff。 | `lifecycle-handoff-ready` |
| `lifecycle-handoff-ready` | 正在准备全生命周期服务。 | home/device/capability/service plan 交接。 | `lifecycle-active` |
| `lifecycle-active` | 已进入舒适家服务周期。 | IoT 控制平台接管、维保、工单、提醒。 | `service-event-open` |
| `service-event-open` | 服务处理中。 | 工单、派工、备件、回访。 | `lifecycle-active` |

## 3. 最小数据合同

```json
{
  "projectId": "project_...",
  "tenantId": "tenant_...",
  "dealerId": "dealer_...",
  "storeId": "store_...",
  "customerId": "customer_...",
  "homeId": "home_...",
  "state": "construction-in-progress",
  "customerVisibleState": "正在施工",
  "progressPercent": 62,
  "currentMilestone": "hydraulic-installation",
  "quoteId": "quote_...",
  "contractId": "contract_...",
  "designPackageId": "design_...",
  "rysnova-bimPackageId": "rysnova-bim_...",
  "lifecycleLinkId": "life_...",
  "audit": {
    "lastChangedBy": "user_...",
    "lastChangedAt": "2026-06-06T00:00:00.000Z",
    "reason": "milestone completed"
  }
}
```

## 4. IoT Handoff 合同

```json
{
  "lifecycleLinkId": "life_...",
  "tenantId": "tenant_...",
  "customerId": "customer_...",
  "homeId": "home_...",
  "projectId": "project_...",
  "installedAssets": [
    {
      "assetId": "asset_...",
      "brand": "Rheem|Ruud|Everhot",
      "category": "hot-water|heating|water-treatment|fresh-air|air-conditioning|smart-control",
      "model": "model_...",
      "serialNumber": "serial_...",
      "capabilities": ["status", "maintenance-reminder"],
      "warranty": {
        "startDate": "2026-06-06",
        "endDate": "2031-06-06"
      }
    }
  ],
  "servicePlan": {
    "planId": "plan_...",
    "status": "draft|prepared|active|paused|expired",
    "maintenanceCadence": "quarterly|semiannual|annual",
    "dealerServiceOwner": "dealer_...",
    "nextMaintenanceAt": "2026-09-06T00:00:00.000Z"
  },
  "handoffStatus": "draft|ready|sent|accepted|failed",
  "iotPlatform": {
    "provider": "future-iot-platform",
    "externalHomeId": null,
    "externalBindingStatus": "not-started"
  }
}
```

## 4.1 Installed Asset / Capability Registry 规则

`installedAssets` 是验收后的实物资产台账，不等同于设计阶段 BOM，也不等同于实时 IoT 设备影子。它必须能回答四件事：

- 客户家里最终装了什么设备。
- 设备属于哪个系统：`central-hot-water / heating / whole-air / fresh-air / air-conditioning / water-treatment / smart-control`。
- 设备来自哪个品牌：`Rheem / Ruud / Everhot / unassigned`。
- 未来 IoT 平台可以接管哪些能力，但 瑞诺瓦AI舒适家 当前只做 `lifecycle_handoff_only`。

`iot.capabilityRegistry` 是 IoT 生命周期衔接清单，要求每个 asset 至少包含：

```json
{
  "assetId": "asset_...",
  "category": "central-hot-water",
  "iotDeviceId": null,
  "capabilities": ["temperature", "energy", "maintenance_reminder"],
  "bindingStatus": "prepared",
  "controlBoundary": "lifecycle_handoff_only"
}
```

系统能力推断规则：

| Category | 典型能力 |
|---|---|
| `central-hot-water` | `onoff`, `temperature`, `energy`, `maintenance_reminder` |
| `heating` | `temperature`, `zone_control`, `energy`, `anti_freeze` |
| `whole-air` | `temperature`, `humidity`, `fresh_air_ratio`, `mode`, `energy` |
| `fresh-air` | `onoff`, `fan_speed`, `co2`, `pm25`, `filter_life` |
| `air-conditioning` | `temperature`, `humidity`, `mode`, `energy` |
| `water-treatment` | `filter_life`, `flow`, `tds`, `maintenance_reminder` |
| `smart-control` | `remote_control`, `scene`, `energy`, `alert` |

## 5. 客户门户展示边界

客户可见：

- 当前状态。
- 下一步。
- 预计时间。
- 方案、报价、合同、施工、验收、保修、服务计划摘要。
- 客户需要确认或补充的动作。

客户不可见：

- 经销商内部毛利。
- 成本底价。
- 内部审批争议。
- 跨租户数据。
- 技术人员内部备注中的敏感信息。

## 6. P0 验收规则

- 每次状态变化必须写 audit log。
- 总部可以汇总分析，但经销商不能读取其他经销商项目。
- 客户门户只能读取自己的项目和客户可见 artifact。
- 验收后必须生成 lifecycle handoff draft。
- IoT handoff 不要求实时控制，但必须传递 home、installed asset、device capability、warranty、service plan 和 binding status。
- `iot.handoffBoundary` 和 `iot.capabilityRegistry[].controlBoundary` 必须保持 `lifecycle_handoff_only`，除非未来实时 IoT 平台完成独立合同和安全验收。
- 状态机必须可被 E2E 测试覆盖。

## 7. 第一批迁移对象

| Legacy Asset | 迁移方向 | 下一步 |
|---|---|---|
| `customer-view.html` | 客户项目主视图 | 接状态机和客户可见 artifact。 |
| `customer-share.html` | 方案/报价分享 | 接 quote/design artifact。 |
| `construction-management.html` | 内部施工管理 | 抽里程碑和质量字段。 |
| `construction-dashboard.html` | 施工进度 | 接 project state rollup。 |
| `delivery-center.html` | 交付中心 | 归入 delivery facade。 |
| `service-tickets.html` | 服务事件 | 接 lifecycle service event。 |
| `workorders.html` | 工单 | 接服务计划和派工。 |
| `econet-dashboard.html` | IoT 概念参考 | 只作为 handoff 参考，不作为实时控制平台。 |

## 8. 证据门禁

```bash
npm run test:production-readiness
npm run perf:capacity:inprocess
npm run harness:legacy-fusion
```

后续新增：

```bash
npm run test:customer-lifecycle
npm run test:tenant-isolation
npm run workflow:test
```
