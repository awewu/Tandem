# 瑞诺瓦 / Rysnova 经销商赋能平台 · 锁定规格（共识基线）

> 状态：**🔒 LOCKED · 2026-06-28** · 经用户共识锁定，后续不得二次解读混淆
> 上级事实源：PROJECT-CHARTER(v1.4) > PRD-v2(v2.0) > CLAUDE.md。本文件为板块二唯一权威规格。
> 完成度标注以**真实代码**为准（非文档声明）：✅已实现 / 🟡部分 / 🟠骨架 / ❌空 / 📄仅legacy原型

---

## 1. 定位（不可变 · 锁死）

- **名称**：瑞诺瓦（中文）/ **Rysnova**（英文）—— 品牌对，二者等价。
- **形态**：**中立第三方行业软件**（经销商赋能），不是设备品牌、不是集团官网。
- **归属**：Rhautt Nexus 两大板块中的**板块二**；板块一是品牌管理。
- **对客呈现**：经销商联合主体（如「瑞美-蓝蜗牛」）+ 中立工具形态（PRD 4.7）；集团/平台不抢经销商对客主体位。
- **铁律**：设备品牌（Rheem/Ruud/Everhot）≠ 系统品牌（瑞诺瓦）；Rhautt Nexus 是对内底座不直接对外冠名。

---

## 2. 宪章边界（锁死）

1. **双栖模块**：问诊 / BIM 等可被集团官网/品牌站导流嵌入，但保留独立 product/data/API owner + 独立上线能力（PRD 4.1）。
2. **namespace 保留**：每模块保留 `moduleNamespace / dataNamespace / productNamespace`，留独立拆库与单独部署路径。
3. **数据隔离**：板块级物理分库（板块二独立库集群）+ 库内 500+ 经销商租户三档隔离（默认 RLS 行级 / schema / 物理库）。两者叠加。
4. **IoT 边界**：`lifecycle_handoff_only` —— 只做生命周期交接，不自建 IoT 平台。
5. **可信链**：仅 `verified` 产品可驱动精算（CALC-*）；第三方数据不得回写污染精算内核。
6. **历史 slug**（如 `rysnova`）仅作迁移债务，不得成为新增对外文案或新模块命名依据。

---

## 3. 详细模块 = 三大件套（锁定组合）

> 机器可读：`platform-modules.json`。功能颗粒+缺口：`docs/RHAUTT-NEXUS-FEATURE-AND-GAP-LEDGER.md`。

### ① 瑞诺瓦 AI 问诊 / Rysnova AI Diagnosis（C 端）
- **域**：`diagnosis` ｜ **API**：`/api/v2/diagnosis` ｜ **alias**：`/rysnova*`
- **目标 App**：`apps/consumer-diagnosis`（🟠骨架，仅 1 页）
- **已完成现状**：📄 `public/pain-diagnosis.html` / `pain-diagnosis-v3.html`（legacy 原型，调性以此为准·锁定不变）
- **功能**：需求采集（新建/改造分支）· 六维舒适风险分诊 · LLM/Voice 编排 · 三档方案+预算/月供/ROI · 客户报告

### ② 瑞诺瓦舒适家居 CRM / Rysnova Comfort-Home CRM
- **域**：`crm · quote · delivery · lifecycle` ｜ **API**：`/api/v2/crm`
- **目标 App**：`apps/dealer-workbench`（✅较实·16 页：crm/finance/projects/aftersales/analytics/dashboard/team/products/brand/mobile/design/bim）+ `apps/customer-portal`（🟠骨架·2 页）
- **已完成现状**：📄 `crm-dashboard.html` / `sales-crm-module.html` 等 legacy
- **功能**：客户/商机/跟进 · 线索归属+撞单+离职交接 · 报价(BOM/税/毛利/快照锁定) · 财务(分期/发票/结算) · 施工节点 · 保修/工单 · IoT 交接(🟡占位)

### ③ 瑞诺瓦技术支持 BIM / Rysnova BIM
- **域**：`rysnova-bim · design` ｜ **API**：`/api/v2/rysnova-bim`
- **目标 App**：`apps/rysnova-bim-workbench`（❌空·0 文件）+ `apps/designer-workbench`（🟠骨架·1 页）
- **当前实际**：BIM/设计页**暂存于 dealer-workbench 的 /design、/bim**（待迁出）+ 📄 legacy `floorplan-bim.html`/`bim-viewer.html`/`rysnova-bim-designer.html`/`design-review.html`
- **功能**：五大系统一键计算(CALC-HS/WT/AIR/HEAT/CTRL) · 新风常规/DOAS 两档 · 单一真相源(design↔rysnova-bim, M12) · 碰撞/净高/管线综合 · 版本冻结/审图签章 · CFD/技术交付

---

## 4. PRD 明细索引（板块二相关条款 · 锁定引用）

| PRD 节 | 内容 | 落点件套 |
|---|---|---|
| 4.1 | 双栖模块边界 | 全部 |
| 4.3 | 五大系统一键计算 + 控制 | ③ design |
| 4.5 | 三层产品目录 + 数据可信度 | 消费 product-catalog(板块一) |
| 4.6 | 渠道转化与情报采集 | ② crm |
| 4.7 | 经销商联合品牌身份 | 全部对客面 |
| 4.8 | CRM 线索归属与抢客规则 | ② crm |
| 4.9 | 财务闭环(分期/发票/结算/快照) | ② quote |
| 4.10 | 设计↔深化单一真相源 | ③ design↔rysnova-bim |
| 4.11 | 引擎成熟度(IoT/DigitalTwin/LLM 占位实测) | ②lifecycle ③rysnova-bim ①diagnosis |

---

## 5. 完成功能 · 真实状态（诚实基线，反混淆）

| 件套 | 目标 App | 真实代码状态 | 实际"已完成"在哪 |
|---|---|---|---|
| ① 问诊 | consumer-diagnosis | 🟠 骨架(1页) | 📄 legacy `pain-diagnosis*.html` |
| ② CRM | dealer-workbench | ✅ 较实(16页) | dealer-workbench + 📄 `crm-dashboard.html` |
| ② 客户门户 | customer-portal | 🟠 骨架(2页) | — |
| ③ BIM | rysnova-bim-workbench | ❌ 空(0) | 暂存 dealer-workbench/bim + 📄 `*bim*.html` |
| ③ 设计 | designer-workbench | 🟠 骨架(1页) | 暂存 dealer-workbench/design + 📄 `designer*.html` |
| 总部 | business-console | 🟠 骨架(3页) | — |

**后端/底座真实状态**：
- 在跑 = `server/`(Express) + **MongoDB** + JSON；目标 NestJS+PG `productionClaim:false`。
- PG schema = `target-contract-not-production-applied`；RLS = `simulated-not-staging-applied`。
- **M12 真相源 / M14 合规 / M15 数据总线·MDM = 代码缺失（MISS）**。

**核心混淆点（本次锁定澄清）**：
1. 瑞诺瓦"已完成"主要是 **105 个 legacy `public/*.html` 原型**（locked-goal.json 口径），按 CLAUDE.md 它们**不自动等于产品面**，需重开发收编。
2. **dealer-workbench 当前是个"大杂烩"**：把 ③BIM/设计 也装进去了；终态需按三件套拆出到 rysnova-bim/designer/consumer 独立 App。
3. 真正成型的只有 **dealer-workbench(②CRM)**；①问诊调性看 legacy 原型；③BIM 几乎未建。

---

## 6. 锁定共识（不得再改）

- **机器可读锁定源** = `governance/仲裁顺序`：宪章 > `governance/locked-goal.json` > PRD-v2 > platform-modules/contracts > 本文（派生视图）。
- 板块二 = **3 件套**（问诊 / CRM / BIM），第 4 件套走产品注册扩张。
- **件套独立性差别（对齐 locked-goal.json）**：`independentProductModules` 仅注册 **问诊 + BIM** 为可独立上线模块；**CRM 是件套但更深共享底座，未单独 standalone 注册**——三件套成立，此差别锁定备案。
- legacy HTML 待收编库存 = **105**（以 locked-goal.json 口径为准）。
- 命名 = **瑞诺瓦 / Rysnova**；对外中立第三方；不与设备品牌/集团混称。
- 闭环主线 = `lead → ①问诊 → ③设计/BIM → 系统包 → ②报价 → 合同 → 施工 → 验收 → IoT`。
- 完成度以真实代码为准（本文 §5）；legacy HTML 是待收编资产，非已交付产品面。
- 交付红线：M14(P0) → M12/M15(P1) → 各骨架 App 接 `/api/v2/*` → legacy 原型按件套收编。
