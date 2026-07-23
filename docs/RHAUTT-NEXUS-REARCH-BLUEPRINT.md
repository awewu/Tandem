# Rhautt Nexus 重构蓝图（解耦版）

> 状态：待批准执行 · 2026-06-28
> 上级事实源：PROJECT-CHARTER.md(v1.4) > PRD-v2.md(v2.0) > CLAUDE.md(锁定定位)。本文件冲突以上级为准。
> 用途：模块解耦 + 分层架构 + 两板块归属 + 重构落地顺序的唯一蓝图事实源。

---

> 重要原则（用户 2026-06-28 明确）：**每个主站 UI/VI 各不相同，无共享要求。** 不建跨站共享组件库，不追求统一观感；差异化是设计目标。详见 §1。

## 0. 定位（不可变，来自 CLAUDE.md / PRD-v2 第1章）

- **Rhautt Comfort / 瑞合瑞德暖通科技集团** = 集团表述，非软件名。
- **Rhautt Nexus / 瑞合数智枢纽** = 对内工程底座/控制平面（多租户·auth·品牌注册·共享底座·总部分析），不直接对外冠名。
- **瑞诺瓦 / Rysnova** = 经销商赋能体系品牌对（中立第三方形态），下辖 问诊 / CRM / BIM 三件套。
- **Rheem / Ruud / Everhot** = 设备品牌；可被赋能体系配置，也各有独立品牌站。

三条边界铁律：设备品牌不能写成系统品牌；Nexus 是对内底座不直接对外冠名；外链旧站是过渡占位。

---

## 1. 解耦铁律（贯穿所有层）

1. 中枢**不吞并**任何独立网站，只供给共享底座。
2. 每模块保留 `moduleNamespace / dataNamespace / productNamespace`，为独立拆库/单独部署留路径。
3. 依赖**单向向下**：应用 → 非视觉骨架 → 领域服务 → 数据；**同层禁止横向耦合**。
4. **每个主站 UI/VI 完全独立，无共享要求**：各站自带独立前端栈、独立组件、独立调性；**禁止建跨站共享组件库来统一观感**。差异是设计目标，不是缺陷。
5. 唯一可共享的是**非视觉骨架**（contracts/domain/generated-client/auth/tenant/data/API），且按"中枢不吞并"原则非强制。

---

## 2. 顶层结构

```
Rhautt Nexus 瑞合数智枢纽（对内底座：多租户·身份·品牌注册·非视觉骨架·总部分析；不含共享UI）
   ├─供给共享底座（不吞并）─▶ 板块一 · Rhautt 品牌管理
   └─供给共享底座（不吞并）─▶ 板块二 · 瑞诺瓦/Rysnova 经销商赋能（对外中立第三方）
```

---

## 3. 分层架构（L0–L6）

```
L0 定位层    brand-registry.json + platform-modules.json(新增：两板块归属)
L1 接入层    域名 & 独立部署：rhautt.com | everhot.com.cn(自建) ; rheem.com.cn/ruud.com.cn(外链) ; 问诊/CRM/BIM standalone alias
L2 应用层    板块一: public-portal · everhot-cn · brand-console(新,轻量)
            板块二: consumer-diagnosis · customer-portal · dealer-workbench · designer-workbench · rysnova-bim-workbench · business-console(总部)
L3 非视觉骨架(仅此可共享,非强制) contracts(OpenAPI) · domain · generated-client ; 运行能力: auth·tenant·DAM·notification·workflow/outbox
   注意: 不存在跨站共享 UI 组件库; packages/ui 不作为统一观感层。各主站 UI/VI 各自独立(见 §1.4)。
L4 领域服务  板块一: brand·product-catalog·dam | 板块二: diagnosis·crm·quote·design·rysnova-bim·delivery·lifecycle | 底座: auth·tenant·analytics·governance·file-artifact
L5 数据层    ①底座主库(PG) ②赋能体系库(PG-RLS+Mongo) ③品牌运营库(各品牌独立产品库+DAM) ④分析数仓(OLAP只读脱敏)
L6 治理/基建 50+ guard · outbox/temporal · observability · SBOM/provenance · docker
```

---

## 4. 板块一 · 品牌管理（按用户 5 条指令锁定）

| 品牌入口 | 自建/外链 | 内容架构 | 调性 / VI | 状态 |
|---|---|---|---|---|
| 集团官网 rhautt.com (`public-portal`) | 自建 | **复刻 aosmith.com** | **ruud.com VI**（红#E4002B主导+中性企业壳） | 待建（重点） |
| Everhot (`everhot-cn`) | 自建 | **复刻 rheem.com 三受众架构** | Everhot 暖红 | 已建，待精修 |
| Rheem | **外链** → rheem.com.cn | 外部站 | 外部站 | 仅导航/卡片外链 |
| Ruud | **外链** → ruud.com.cn | 外部站 | 外部站 | 仅导航/卡片外链 |

- `apps/rheem-cn` / `apps/ruud-cn`：**不再自建**，降级为外链占位。
- `brand-console`（独立管理入口，轻量）：管理"集团官网 + Everhot"两套自建资产（产品库 / DAM / VI token / 上新 / ICP / 发布）+ 维护 Rheem/Ruud 外链配置。

### 4.1 集团官网 = aosmith.com 架构 × ruud.com 调性
- **内容架构（仿 aosmith.com 企业站）**：系统族产品/解决方案（中央热水/采暖制冷/空气/水处理/智控）→ Where-to-buy/经销商 → 支持(Specs·Docs·Warranty·Register) → 关于/创新/可持续 → 品牌矩阵区（Rheem/Ruud 外链 + Everhot 自建 + 瑞诺瓦问诊入口）。
- **VI（ruud.com 实测）**：主色 Ruud 红 `#E4002B`（决断 CTA，不铺满）+ 中性企业底色（白/浅灰）+ 近黑文字 `#1A1A1A` + 紧凑企业字阶；组件：产品族 mega-nav、Find-a-Contractor(按zip)、资源中心、Register、BIM/CAD。
- TODO：Ruud 精确字体名 + 红精确 hex（实测红主导，工作基准 `#E4002B`，待 CSS 级校准）。

### 4.2 Everhot = rheem.com 架构 × Everhot 暖红
- 已按 rheem.com 三受众架构建成；调性暖红。
- TODO（待用户定）：Everhot 红 `#E4002B`(token) vs `#C8102E`(现站点)。

---

## 5. 板块二 · 瑞诺瓦/Rysnova 经销商赋能 — 三大件套（子模块组合）

> 机器可读事实源：`platform-modules.json`。对外中立第三方形态；问诊调性锁定不变。

| 件套 | App | 后端域 | namespace / alias | 调性/说明 |
|---|---|---|---|---|
| ① **瑞诺瓦 AI 问诊** Rysnova AI Diagnosis（C端） | `consumer-diagnosis` | `diagnosis` | data:`rysnova` · api:`/api/v2/diagnosis` · alias `/rysnova*` | **现有架构/调性不变（锁定）** |
| ② **瑞诺瓦舒适家居 CRM** Rysnova Comfort-Home CRM | `dealer-workbench` + `customer-portal` | `crm` · `quote` · `delivery` · `lifecycle` | api:`/api/v2/crm` | 默认展示 Rhautt 品牌，经销商可加其他品牌；承载报价→合同→施工→验收→IoT 经营闭环 |
| ③ **瑞诺瓦技术支持 BIM** Rysnova BIM | `rysnova-bim-workbench` + `designer-workbench` | `rysnova-bim` · `design` | api:`/api/v2/rysnova-bim` | 以签单为界的两阶段（见下）；产物经 `file-artifact` |

**件套③ 两阶段语义（以 CRM 签单为界）：**

| 阶段 | 域 / 入口 | 精度 | 使用者 | 关键 | 交付物 | 用途 |
|---|---|---|---|---|---|---|
| 签单前 · **技术 BIM 设计** | `design` / designer-workbench | 粗稿 + 成本框算 | 设计师、销售 | 需求 + 报价 | 2D 原理图 + 3D 示意图 | 出方案、算大账、给客户看 → 促成交 |
| 签单后 · **技术支持深化** | `rysnova-bim` / dealer-workbench 内嵌 `/bim` | 施工级 | 技术支持 / BIM 工程师 | 施工 + 验收 | 施工图 + BOM 明细 + 最终 3D 效果图 | 领料、预决算、验收交付 |

> 分界节点：CRM 签单（`opportunities/:id/sign` 带 `quotationId`）触发 `rysnova-bim` 从报价单承接项目。BOM 有两种（成本框算 BOM → 施工 BOM 明细，后者在前者基础上细化重算）；3D 有两种（示意图 → 最终效果图）。
> 架构原则：**前端联通**（hub 免登 + 深链接接力，感知为一个连续工作台），**后端解耦**（design 与 rysnova-bim 各自独立域/数据/API，仅经报价单契约与签单事件连通）。

**闭环主线**：`lead → ①问诊 → ③设计/BIM → 系统包 → ②报价 → 合同 → 施工 → 验收 → IoT 生命周期`

**底座/总部（非件套）**：`business-console`（总部汇总分析）+ 域 `auth·tenant·analytics·governance·notification·workflow·file-artifact`。

**扩张机制**：第 4 件套走「产品注册 + 复用赋能底座 + 独立 namespace」，配置优先（PRD L276）。

**经销商联合身份**：对客呈现「经销商主体 + 中立工具」(PRD 4.7)。

---

## 6. 解耦依赖契约

```
应用层 ──可依赖──▶ 共享底座 ──可依赖──▶ 领域服务(/api/v2/*) ──▶ 数据层
应用层 ──禁止──▶ 直连数据库 / 跨应用 import
品牌站 ──禁止──▶ 依赖任何赋能模块代码（只能外链/嵌入问诊）
赋能子系统之间 ──禁止──▶ 互相直连（经 contracts + outbox 事件通信）
底座 ──禁止──▶ 反向依赖任何具体品牌/赋能应用
```

---

## 7. 重构落地顺序（批准后执行）

1. **声明层**：新建 `platform-modules.json`（两板块+归属）；对齐 `brand-registry.json`（rheem/ruud 改外链、修正瑞诺瓦定位）。
2. **各主站独立自洽**：逐站做"站内 UI/VI 一致性 + 完成度 + 修正自身色值冲突"；**不做跨站统一、不建共享组件库**。每站可有自己的局部组件/样式。
3. **板块一**：建集团官网(aosmith 架构 × ruud VI) + 精修 Everhot + 搭轻量 `brand-console`。
4. **板块二**：保持问诊不变；骨架 app 按闭环主线接 `/api/v2/*`。
5. **数据/治理**：四库边界落地 + guard 守边界。

---

## 8. 待拍板开口项

- Everhot 红：`#E4002B` vs `#C8102E`。
- Ruud 精确字体名 + 红 hex（CSS 级校准）。
- `brand-console` 是否本次纳入（蓝图已预留）。
