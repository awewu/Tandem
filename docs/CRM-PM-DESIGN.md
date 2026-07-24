# 瑞美项目报备全生命周期管理系统 (PMS) · 详细设计文档

> **版本**: v2.9 (2026-07-23)  
> **状态**: 设计稿 (待 Owner 确认后进入编码)  
> **定位**: Tandem 新增「产研销」模块 — **商用/轻商设备项目**管理平台 (项目型 L2C + 经销商 DMS + 资产型售后 FSM), **非零售线索型 CRM**; 经销商模式: 报备 → 跟进 → 成交/丢单 → 设备交付 → 经销商施工/调试/维保回报  
> **需求来源**: 《项目管理系统需求梳理》DOCX + 《操作流程-商机》PPTX  
> **业务背景**: 瑞美是设备厂家, 通过一级/二级经销商覆盖终端客户 (酒店/公寓/工厂/学校等商用项目), 经销商通过 YS 系统开展商机报备管理  
> **开发基础**: Tandem 原生开发 (非 Salesforce / 非开源), 评估过 ERPNext/Open Mercato 等开源方案 (详见 §2.3), 对标三轴项目/设备型平台 — Salesforce Manufacturing Cloud / Dynamics 365 / ServiceMax·IFS / 销售易 / 八骏DMS (详见 §2.4, 已剔除零售线索型 CRM)  
> **分析体系**: 七大维度即时分析 (区域/客户/渠道/销售组织/产品线/阶段/赢丢单) + 交叉分析 + 阶段总结 + 生产预测 + **业绩管理** (目标分解+实际vs目标+同比环比+AI归因+线索开发+主推产品)
> **交付闭环**: 厂家执行 设计方案→生产→发货; 经销商执行 施工→验收→调试→移交→维保, 经销商回报状态, 瑞美跟踪+售后支持  
> **系统边界**: PMS 主要使用方 = 经销商(外部); Tandem = 内部管理系统。三层切割(用户/模块/数据) + 五桥关联, Tandem 能力按矩阵有闸开放 (详见 §2.5)

---

## 一、业务背景与核心痛点

### 1.1 现状

瑞美是设备厂家, 采用**经销商模式** (非直销), 通过一级/二级经销商覆盖终端客户。经销商依托 YS 系统开展商机报备管理, 完成项目报备、跟进记录、方案审核、合同签订等全流程. 现有流程已跑通, 但存在以下短板:

> **经销商层级**:
> - **一级经销商**: 直接与瑞美对接, 可直接报备项目, 从瑞美采购设备
> - **二级经销商**: 隶属某一级经销商, 通过一级经销商间接与瑞美合作, 报备时需指定所属一级经销商
> - **终端客户**: 经销商的客户 (非瑞美直接客户), 瑞美不直接销售/收款/施工

> **瑞美角色**: 厂家 — 设备生产 + 发货给经销商 + 技术方案支持 + 售后保障
> **经销商角色**: 销售 + 施工安装 + 调试 + 验收 + 维保 (面向终端客户)

### 1.2 核心痛点

| 痛点 | 具体表现 | 业务影响 |
|---|---|---|
| **撞单无法自动甄别** | 同一项目被多个经销商重复报备, 系统无法事前预警, 仅靠人工审核事后发现 | 内部资源冲突、经销商矛盾、项目归属争议 |
| **跟进过程不可视** | 管理层无法实时掌握项目推进进度、未跟进时长; 经销商自填进度不可控; 老系统迁移项目即使 90 天未跟进也无法进公海池 | 管理盲区, 项目流失风险 |
| **丢单无分析沉淀** | 项目丢单后无系统化原因记录与数据分析机制, 无复盘归档流程 | 无法形成业务改进闭环, 同类失误反复出现 |
| **客户归属不清晰** | 同一客户商用、科技住宅两条业务线可分别报备, 数据不关联不互通 | 内部无序竞争, 降低客户服务体验 |

### 1.3 建设目标

| 目标 | 说明 | 量化指标 |
|---|---|---|
| **事前防重** | 报备提交环节自动检测重复项目, 从源头杜绝撞单 | 撞单发现时效: 3-5天 → 秒级 |
| **全程可视** | 报备至赢单/丢单全链路数字化管控 | 项目跟进覆盖率: 60% → 90%+ |
| **智能预警** | 超期未跟进自动提醒、自动释放 | 超期释放占比: 15% → <5% |
| **数据沉淀** | 系统化丢单归因分析 | 丢单原因记录率: <20% → >80% |
| **公海盘活** | 统一收纳释放项目, 合理流转重新分配 | 项目周期: 90天 → 75天 |

---

## 二、业务全景架构

### 2.1 全链路流程

```
┌──────────────────────────────────────────────────────────────────────┐
│              瑞美 PMS 全生命周期管理 (经销商模式)                        │
│                                                                       │
│  ┌──────────┐   查重    ┌──────────┐   撞单    ┌──────────┐         │
│  │ 商机报备  │──拦截───→│ 撞单处理  │──质疑───→│ 仲裁审核  │         │
│  │ (经销商  │          │ (放弃/质疑)│         │ (销售管理部)│        │
│  │  一级/二级)│         └──────────┘          └──────────┘         │
│  └────┬─────┘                                                       │
│       │ 审核通过                                                      │
│       ↓                                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              10 阶段标准化跟进 (经销商执行)                       │   │
│  │                                                               │   │
│  │  报备 → 拜访 → 方案 → 招标 → 报价 → 谈判 → 签约              │   │
│  │    → 设备交付 → 赢单(归档) / 丢单(归因)                      │   │
│  │                                                               │   │
│  │  每阶段: 停留时限 + 准入条件 + 跟进记录 + 附件                │   │
│  │  90天管控: 75天预警 → 90天取消 → 7天恢复 → 二次超期进公海池  │   │
│  │  (无回款阶段 — 经销商模式, 瑞美不收款)                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│       │                                                               │
│  ┌────┴─────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ 价格审批  │  │ 合同签订  │  │ 公海池   │  │ 丢单管理  │           │
│  │ (分级折扣)│  │ (经销商与│  │ (认领释放)│  │ (归因分析)│           │
│  │          │  │ 终端客户)│  │          │  │          │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              设备交付闭环 (签约后自动创建)                        │   │
│  │                                                               │   │
│  │  【瑞美执行】设计审批 → 生产 → 发货 → 经销商收货确认           │   │
│  │  【经销商执行】施工 → 竣工验收 → 调试 → 移交终端客户           │   │
│  │  【经销商跟踪】维保期 → 厂家售后支持 (按需) → 归档             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ 审批中心  │  │ 预警消息  │  │ 报表分析  │  │ YS同步    │           │
│  │ (多级审批)│  │ (企微/短信)│  │ (含经销商 │  │ (双向集成)│           │
│  │          │  │          │  │ 层级分析) │  │          │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 与 Tandem 的关系

| Tandem 已有 | PMS 复用方式 |
|---|---|
| `GovernanceProject` (战略项目, OKR 严绑定) | PMS 项目可选关联 GovernanceProject |
| OKR 系统 (`lib/okr/`) | PMS 项目可锚定 Objective (销售目标对齐) |
| KvStore 仓储 (`lib/storage/`) | 新增 collection, 零迁移 |
| IM 协作 (`lib/im/`) | 预警消息推送复用 IM 渠道 |
| 中央 AI 感知/推理 (`lib/persona/`) | 智能查重 + 健康预警 + 丢单归因 |
| 审批流 (`app/approvals/`) | 多级审批复用审批框架 |
| 工作流引擎 (`app/workflows/`) | 自动化流程 (超期释放、阶段推进) |
| 导航模块 (`components/nav-modules.ts`) | 新增「产研销」模块 |

### 2.3 开源系统评估与选型决策

> **结论**: 评估了 4 个主流开源方案, 均不直接采用, 但从中提取了关键功能启发融入 Tandem 原生设计。

#### 2.3.1 候选方案评估

| 方案 | 技术栈 | 适配度 | 优势 | 致命短板 | 启发采纳 |
|---|---|---|---|---|---|
| **ERPNext (Frappe)** | Python/MariaDB | ★★★☆☆ | SN 码全生命周期追踪 (Serial No → 质保 → 工单 → 维修历史); 制造+库存+售后一体; 重型设备经销商案例 (Turqosoft); 8-12 周可交付 | 非 TS/Next.js 栈, 与 Tandem 技术体系完全异构; 多租户需 Frappe 框架改造; UI 交互偏传统表单; 中文本地化弱 | **SN 码追踪模型** (§3.15): Serial No → 设备档案 → 质保 → 维修记录 → 零部件替换历史; **AMC 年度维保合同**管理思路 |
| **Open Mercato** | Next.js/TS/MikroORM | ★★★★☆ | 技术栈高度一致 (Next.js App Router + TS + 多租户 + RBAC); 模块化架构 (auto-discovery); CRM/ERP/订单/生产/工作流预置; MIT 协议; 1500+ star | 2025 年新项目, 生态不成熟; 文档以 AI 生成为主; 无中文本地化; 无经销商管理/设备交付场景验证 | **模块化架构**确认 Tandem 的 lib/pms/ 独立模块设计正确; **PaaS 扩展模式**: 自定义实体+动态表单思路; **事件驱动**集成模式 (domain events + subscribers) |
| **Krayin CRM** | PHP/Laravel | ★★☆☆☆ | 葡萄牙设备制造商 KTK 案例 (经销商管理+生产协调+报价); 经销商通信集中管理; 工作流自动化 | PHP 栈, 与 Tandem 完全不兼容; 功能偏通用 CRM, 无设备交付/售后; 无多租户 | **经销商通信集中管理**思路 (企微+邮件+通话记录统一归档到经销商组织); **报价→交付时间线**管理 |
| **八骏 DMS** | 闭源 SaaS | ★☆☆☆☆ | 非标设备行业 DMS 方案最完整: 经销商全生命周期+定制化订单协同+项目全流程跟踪+售后备件管理 | 闭源 SaaS, 无法二次开发; 年费高; 数据不在自己手里 | **经销商考核指标体系** (交付及时率/客户满意度/售后响应速度, 非仅销售额); **定制化需求同步** (经销商在线提交客户定制需求→厂商设计/生产); **备件管理** (绑定设备型号+参数, 经销商在线申请备件) |

#### 2.3.2 不采用开源方案的核心理由

1. **技术栈一致性**: Tandem = Next.js 14 + TS + Drizzle + PostgreSQL。ERPNext (Python) 和 Krayin (PHP) 引入会撕裂技术体系, 运维成本翻倍。Open Mercato 技术栈匹配但生态不成熟, 无生产环境验证。
2. **Tandem 架构协同**: PMS 需要复用 Tandem 的 OKR 锚定、中央 AI 感知/推理、KvStore 仓储、审批流、IM 推送、企微集成等 8 个已有子系统。引入外部系统 = 这些能力全部重新对接, 得不偿失。
3. **经销商账号体系**: Tandem 已有完整的上下游组织模型 (`Organization` + `createDownstreamOrg` + `inviteDownstreamMember` + 外部用户角色), 开源系统无此模型, 需从零搭建。
4. **开发量可控**: PMS 核心功能 (报备+查重+跟进+交付+维保) 约 40 个文件, 依托 Tandem 基座, 4 期开发可完成。引入开源系统反而需要大量适配/迁移/定制工作。
5. **数据主权**: 瑞美经销商数据、客户数据、设备 SN 数据属于核心资产, 需完全自控。

#### 2.3.3 从开源方案提取的功能启发 (已融入设计)

| 启发来源 | 融入章节 | 具体设计 |
|---|---|---|
| ERPNext SN 全生命周期 | §3.15 (新增) | `EquipmentSN` 接口: SN 码 → 设备档案 → 质保状态 → 维修历史 → 零部件替换 → 正/反向追溯 |
| ERPNext AMC 年度维保合同 | §3.13 MaintenanceRecord | 维保类型增加 `amc` (年度维保合同), 支持合同到期自动续保提醒 |
| Open Mercato 事件驱动集成 | §9.5 生产系统对接 | SN 码状态变更采用事件模型 (生产赋码→入库→发货→安装→维保), 轻耦合对接 |
| 八骏 DMS 经销商考核 | §10.3 (新增) | 经销商排名指标增加: 交付及时率、客户满意度、售后响应速度、资质合规率 |
| 八骏 DMS 备件管理 | §3.15 (新增) | `EquipmentSN` 关装备件记录, 维修时记录更换零部件 SN 码 |
| Krayin 经销商通信归档 | §9.1 企微集成 | 经销商沟通记录 (企微消息/审批意见/回报备注) 统一归档到经销商组织 |

### 2.4 行业竞品对标分析

> **产品定位声明 (对标基准的前提)**: 瑞美 PMS 服务于**商用 / 轻商设备项目**(如酒店、公寓、工厂、学校的中央热水 / 热泵系统),本质是 **项目型 L2C(Lead-to-Cash) + 经销商 DMS + 资产型售后 FSM** 的三合一平台。
>
> 其业务特征是 **低频、高单值、长周期(数月)、多方决策链(设计院 / 甲方 / 总包 / 经销商 / 厂家)、里程碑硬节点(招标 → 开标 → 设计 → 交付 → 调试 → 维保)**。
>
> **⚠️ 对标校正 (2026-07-23)**: 早期版本引入的 **零售 / SMB 线索型 CRM**(HubSpot、Pipedrive、Salesforce Sales Cloud、以及纷享销客的"线索漏斗"定位)其内核是 **高频、低单值、短周期、线索评分 + 自动培育 + 转化率**,与本产品的项目型交付内核**方向错位**,已从对标基准中降级为"仅参考线索管理交互",不作为功能对标基准。真正的对标基准是下述**三轴**同类平台。

#### 2.4.0 三轴对标基准 (校正后)

| 对标轴 | 说明 | 国际标杆 | 国内标杆 | 对本设计的核心借鉴 |
|---|---|---|---|---|
| **① 项目型 L2C** | 项目机会 → 招投标 → 设计 → 合同 → 交付的长周期销售管理 | Salesforce **Manufacturing Cloud / Agentforce Manufacturing** (销售协议、计划量vs实际量、渠道伙伴)、Dynamics 365 (Sales + Project Operations)、SAP CRM + PS(项目系统) | 销售易(项目型销售)、明源云(地产工程)、广联达(建筑工程) | 阶段门(stage-gate)、里程碑硬节点、销售协议、渠道伙伴管理(PRM) |
| **② 设备经销商 DMS** | 多级经销商全生命周期 + 定制订单 + 渠道协同 | Dynamics 365 Partner Center(deal registration / 伙伴评分)、Salesforce PRM + Experience Cloud(经销商门户) | 八骏 DMS(非标设备)、纷享销客"代理通"、瑞泰信息(伙伴云) | 一级/二级经销商、准入→考核→淘汰、经销商门户、定制需求同步 |
| **③ 资产型售后 FSM** | installed base(装机台账) + 序列号 + 质保 + 工单 + 召回 | **ServiceMax Asset 360**(installed product / 资产层级 / 退货管理)、**IFS FSM**(序列化零件 / 质保生命周期 / 服务合同 quote-to-renewal)、SAP FSM(installed base 序列号登记) | 瑞云服务云(销售易旗下)、售后宝 | EquipmentSN = installed product 台账;质保闭环;召回;资产层级;服务合同(AMC) |

#### 2.4.1 竞品全景 (三轴同类平台)

> **口径声明 (纯功能对标)**: 本表只比**功能能力**。实施成本、订阅价格、本土化程度、渠道生态属**采购/落地考量**, 不计入功能差距 (那是选型阶段另议)。"功能差距"列 = **在瑞美经销商项目场景下, 该产品功能上缺什么**; 它们功能上**强于**瑞美之处见"核心优势"列与 §2.4.3 (我们要学的)。

| 竞品 | 所属轴 | 定位 | 核心优势 (含强于瑞美处) | 功能差距 (瑞美场景下缺什么, 纯功能) |
|---|---|---|---|---|
| **Salesforce Manufacturing Cloud (Agentforce Mfg, 2025.08)** | ①③ | 制造业 CRM + AI Agent | 销售协议(计划vs实际量)、账户级需求预测、**AI Agent 自动处理 entitlement 验证/质保/召回**、渠道伙伴 PRM | 无生产制造/BOM 排产(纯前台);无经销商报备**撞单五维查重**;无**招投标阶段门**;无**资质准入/服务商委托**机制 |
| **Dynamics 365 (Field Service + Project Ops)** | ①②③ | CRM+ERP 同栈(Dataverse) | CRM 与供应链单一数据模型无中间层;installed base 序列号/质保/服务历史;**IoT 预测维护**;**智能排程派工**;PRM deal registration | 通用型, 缺经销商**撞单查重**、**资质/服务商委托**、招投标准入门;field service 是"工单派工"模型, 非我们"厂家交付→经销商回报"双端模型 |
| **ServiceMax Asset 360 / IFS FSM** | ③ | 资产型 FSM 领导者 | installed product(序列号/批次台账)、**资产层级(父子设备)**、**质保生命周期 quote-to-renewal**、退货/召回逆向物流、**离线移动工单**、备件/服务合同 | 纯售后段, 无售前**报备/查重/招投标/价格合同**;无交付前段(设计→生产→发货);需另配 CRM 才成售前售后闭环 |
| **销售易** | ①③ | 平台型 CRM + PaaS | 设备 360° 视图 (设计 BOM→生产批次→维修记录); IoT 设备数据接入; 临保设备替代销售; 项目制交付管理; 产销协同 (ERP/MES) | 渠道管理薄弱 (缺多级经销商**撞单查重**/返利/终端巡检); 无**资质管理**; 无**服务商委托** |
| **八骏 DMS** | ② | 非标设备行业 DMS | 经销商全生命周期 (准入→考核→淘汰); 定制化订单协同; 项目全流程节点可视化; 售后备件管理; 移动端经销商门户 | 无 AI 能力(查重/诊断/预测); 无 **SN 全链追踪**; 无中央 AI 感知/预警; 无**资质/服务商委托** |
| **纷享销客** | ①② | 连接型 CRM + PaaS | 多级经销商管理 ("代理通"); CPQ/BOM 报价; 渠道返利; 订货通; AI Agent (ShareAI) | 无**设备 SN 追踪**; 无**设备交付工单**(厂家交付+经销商回报); 售后模块弱; 无**资质管理/服务商委托** |
| **瑞泰信息** | ②③ | 家电家居行业 CRM | 经销商协作打单+门店建设+促销返利; 服务全链条+配件全流程; 工程项目 LTC 闭环; 伙伴云 | 偏家电零售场景, 缺商用项目**招投标/方案审批**; 无 **SN 追踪**; 无生产系统对接; 无 AI |
| **AutoCRM AI** | ③ | 售前+售后 AI 方案 | 143 个 AI 场景; 售后故障诊断 RAG+知识图谱; BOM 物料匹配+质保校验; TIS 远程诊断; 索赔全流程 | 仅 AI 场景设计, 非完整系统; 无经销商管理; 无交付工单; 无报备/查重/合同 |
| ~~HubSpot / Pipedrive / Salesforce Sales Cloud~~ | — | 零售/SMB 线索型 CRM | 线索评分、自动培育、转化率漏斗 | **❌ 定位错位**:面向高频低单值短周期线索, 无项目型交付/经销商/设备/售后, 仅参考其移动端交互, 不作功能对标 |

#### 2.4.2 功能对标矩阵 (同类项目/设备型平台; 已剔除零售线索型 CRM)

| 功能模块 | 纷享销客 | 销售易 | 八骏 DMS | 瑞泰信息 | AutoCRM AI | **瑞美 PMS (本设计)** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **商机报备+查重** | ✅ (五维度查重) | ✅ (基础查重) | ✅ | ✅ | ❌ | ✅ (五维度+地图+AI) |
| **多级经销商管理** | ✅ (代理通) | ❌ (薄弱) | ✅ (全生命周期) | ✅ (伙伴云) | ❌ | ✅ (一级/二级+资质) |
| **经销商账号体系** | ✅ (经销商门户) | ❌ | ✅ (移动端) | ✅ | ❌ | ✅ (Tandem 上下游组织) |
| **10 阶段标准化跟进** | ✅ (自定义阶段) | ✅ (里程碑) | ✅ (项目节点) | ✅ (LTC) | ✅ (LTC 67 场景) | ✅ (10 阶段+时限) |
| **价格审批+合同管理** | ✅ (CPQ+报价) | ✅ (BOM 报价) | ✅ | ✅ | ✅ (方案报价) | ✅ (分级审批) |
| **设备交付工单** | ❌ (无交付) | ✅ (项目交付) | ✅ (订单→项目) | ✅ (LTC 交付) | ✅ (交付里程碑) | ✅ (厂家+经销商双端) |
| **设备 SN 码追踪** | ❌ | ✅ (设备 360°) | ❌ | ❌ | ✅ (BOM 物料匹配) | ✅ (§3.15 新增) |
| **调试验收 (资质准入)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (资质管理+服务商委托) |
| **维保管理** | ✅ (基础) | ✅ (IoT 预测) | ✅ (备件+工单) | ✅ (配件全流程) | ✅ (36 售后场景) | ✅ (维保+厂家支持) |
| **质保管理** | ❌ | ✅ (临保销售) | ✅ | ✅ | ✅ (保内外判定) | ✅ (维保期+SN 关联) |
| **精准召回** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (SN→批次→客户) |
| **AI 智能查重** | ✅ (基础) | ❌ | ❌ | ❌ | ✅ | ✅ (五维度+地图+AI) |
| **AI 交付风险预警** | ❌ | ❌ | ❌ | ❌ | ✅ (预测) | ✅ (健康度+资质预警) |
| **AI 售后诊断** | ❌ | ❌ | ❌ | ❌ | ✅ (RAG+图谱) | ✅ (故障匹配+知识沉淀) |
| **AI 生产预测** | ✅ (漏斗预测) | ✅ (排产联动) | ❌ | ✅ | ✅ | ✅ (阶段概率加权) |
| **企微集成** | ✅ (深度) | ✅ | ✅ | ✅ | ❌ | ✅ (通知+审批+回报) |
| **ERP/MES 对接** | ✅ (300+ API) | ✅ (深度) | ✅ | ✅ | ✅ (Tool Calling) | ✅ (SN 同步+生产推送) |
| **经销商考核排名** | ✅ | ❌ | ✅ (多维指标) | ✅ | ❌ | ✅ (赢率/周期/合规率) |
| **服务商委托机制** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (本设计独创) |
| **里程碑/阶段门 (stage-gate)** | ⚠️ (自定义阶段) | ✅ (里程碑) | ✅ (项目节点) | ✅ (LTC) | ✅ | ✅ (10 阶段准入条件+硬节点) |
| **分级推送 + 升级阶梯 (escalation)** | ⚠️ (基础提醒) | ⚠️ (提醒) | ⚠️ (提醒) | ⚠️ | ❌ | ✅ (角色×紧急度×渠道矩阵+逐级升级, §3.8) |
| **IoT 设备接入** | ❌ | ✅ (设备数据) | ❌ | ❌ | ⚠️ | ✅ (§3.16, 四期; 轻耦合+降级) |
| **渠道返利引擎** | ✅ (返利规则) | ❌ | ⚠️ | ✅ (促销返利) | ❌ | ✅ (§3.17, 三期; 阶梯+结算) |
| **经销商在线订货** | ✅ (订货通) | ❌ | ✅ | ⚠️ | ❌ | ✅ (§3.18, 三期; 备货采购) |
| **CPQ/BOM 级报价** | ✅ (CPQ) | ✅ (BOM) | ⚠️ | ⚠️ | ✅ (BOM匹配) | ✅ (§3.19, 三期; 渐进启用) |
| **资产层级 + 计划量vs实际量** | ❌ | ⚠️ (设备360°) | ❌ | ❌ | ⚠️ | ✅ (§3.15 父子SN + §3.1 计划/实际) |

#### 2.4.3 关键功能启发与采纳

| 启发来源 | 功能启发 | 本设计采纳情况 |
|---|---|---|
| **销售易** 设备 360° 视图 | 设计 BOM → 生产批次 → 维修记录 → 备件库存 全链关联 | ✅ 已采纳: §3.15 `EquipmentSN` 串联 生产→交付→安装→维保→零部件替换 |
| **销售易** 临保设备替代销售 | 设备临保期 → 自动触发续保/替代销售线索 | ✅ 已采纳: 维保到期预警 + §8.8 AI 售后辅助 "维保到期→复购推荐" |
| **销售易** IoT 设备运行数据接入 | 设备告警自动接收 → 预警工单 | 📋 后续规划: 三期后评估 IoT 对接 (当前以 SN 码+人工报修为主) |
| **八骏 DMS** 经销商多维考核 | 交付及时率 + 客户满意度 + 售后响应速度 (非仅销售额) | ✅ 已采纳: §10.3 经销商排名指标含回报合规率/维保质量评估 |
| **八骏 DMS** 定制化需求同步 | 经销商在线提交客户定制需求 → 厂商设计/生产 | ✅ 已采纳: 方案审批阶段 (design_review) + 合同产品明细带出 |
| **八骏 DMS** 备件管理 | 绑定设备型号+参数, 经销商在线申请备件 | ✅ 已采纳: §3.15 `EquipmentSN.partsReplaced` + 维修记录关联备件 |
| **纷享销客** 经销商在线订货 | "订货通" 经销商在线下单+实时跟踪订单 | 📋 后续评估: 当前通过合同报备+价格审批流程覆盖, 订货通模式待二期评估 |
| **纷享销客** 渠道返利计算 | 按等级/区域/数量区间定价 + 返利规则 | 📋 后续评估: 当前通过价格审批+分级折扣覆盖, 返利引擎待业务需求确认 |
| **AutoCRM AI** 售后故障 RAG 诊断 | 故障描述 → RAG 检索历史案例 → 推荐排查步骤 | ✅ 已采纳: §8.8 AI 售后辅助 "故障诊断辅助: 匹配历史故障库" |
| **AutoCRM AI** 保内外判定 | 质保校验: SN 码 → 出厂日期 → 首装记录 → 保内/保外 | ✅ 已采纳: §3.15 `EquipmentSN` 含 `warrantyStartDate/warrantyEndDate` + 维修时自动判定 |
| **AutoCRM AI** 供应商反向索赔 | 故障根因 → 供应商责任认定 → 反向索赔 | 📋 后续规划: 四期后评估 (需供应链系统对接) |
| **ERPNext** SN 正反向追溯 | 正向: 原材料批次 → 成品 SN → 客户; 反向: 客户报修 → SN → 生产批次 → 原材料 | ✅ 已采纳: §3.15 `EquipmentSN` 含 `productionBatchId` + 正反向追溯 API |
| **Salesforce Mfg** AI Agent 处理 entitlement/质保/召回 | 服务请求 → AI 自动校验质保权益 → 生成处置方案 | ✅ 已采纳方向: §8.8 AI 售后辅助 + §3.15 质保自动判定; **可增强**: AI 自动生成处置方案 |
| **Salesforce Mfg** 销售协议 (计划量 vs 实际量) | 跟踪计划量 vs 实际交付量 + 收入预测 | ✅ 已采纳: §3.1 `ProductItem.plannedQuantity/actualDeliveredQuantity` + 履约率 |
| **ServiceMax** 资产层级 (父子设备) | 机组 → 部件 → 零件 多级台账 | ✅ 已采纳: §3.15 `EquipmentSN.parentSNId/childSNIds/assetLevel` |
| **ServiceMax/IFS** 质保 quote-to-renewal + 离线移动工单 | 质保/服务合同从报价到续签闭环; 现场离线作业 | ⚠️ 部分采纳: AMC (§3.13) 已入; **续签流 + 离线移动工单** 建议增强 (经销商现场信号弱) |
| **Dynamics 365** 智能排程派工 | 按技能/位置/工期自动派工优化 | 📋 后续评估: 当前为经销商/服务商委托派人, 智能排程待规模上量后评估 |
| **IFS** 备件库存 + 服务合同 | 备件计价/库存 + 服务合同全流程 | ⚠️ 部分采纳: 备件替换 (§3.15) 已入; 备件库存管理待评估 |

#### 2.4.4 竞品分析结论

0. **对标基准已校正为项目型/设备型**: 本产品是**商用/轻商设备项目**的 L2C + DMS + FSM,不是零售线索 CRM。因此对标基准锁定三轴(项目型 L2C / 设备 DMS / 资产型 FSM),零售/SMB 线索型 CRM(HubSpot/Pipedrive/Sales Cloud)已剔除功能对标。**项目型的胜负手是"守住硬节点"(阶段门 + 逐级升级),而非零售的"线索评分 + 自动培育转化率"。**
1. **无单一竞品在功能上完整覆盖瑞美"售前报备→交付→售后"全链**: 国际标杆各有专精但**功能覆盖单轴** (Salesforce Mfg 强前台 CRM+AI Agent 但无生产/BOM;Dynamics 全但为通用工单派工模型;ServiceMax/IFS 售后 FSM 最深但无售前);国内 纷享功能面最广(渠道+CPQ+返利+订货)但无 SN/交付工单、销售易设备 360° 深但渠道薄、八骏行业匹配但无 AI。瑞美 PMS 的价值在于**把三轴串成一条链** (报备查重 → 招投标阶段门 → 价格合同 → 设备交付 → SN 台账 → 售后召回), 并补两个行业空白: **资质准入/服务商委托** 与 **分级推送升级**。<br>*(实施成本/本土化/生态是选型考量, 不在功能结论内)*
2. **本设计的差异化优势**: 
   - **资质管理+服务商委托**: 行业首创, 解决"不是所有经销商都能做调试验收"的现实问题
   - **分级推送 + 升级阶梯 (escalation)**: 经销商模式下厂家对渠道的"神经末梢",直击"跟进过程不可视"痛点(§1.2),项目型系统标配而零售 CRM 缺失 (详见 §3.8)
   - **Tandem 中央 AI**: 智能查重+交付健康度+售后诊断+生产预测, AI 能力原生集成非外挂
   - **SN 码全链追踪**: 从生产赋码到售后维修, 打通生产系统与售后系统 (对标 ServiceMax installed product 台账)
   - **经销商账号体系**: 复用 Tandem 上下游组织模型, 邀请码注册, 不需从零搭建
3. **功能完整性差距 — 已全部纳入设计** (2026-07-23 补齐):
   - **IoT 设备接入** (销售易/Dynamics 有): ✅ 已纳入 §3.16 `EquipmentTelemetry` (四期); 未联网设备降级走 SN+人工报修
   - **渠道返利引擎** (纷享销客/瑞泰有): ✅ 已纳入 §3.17 `RebatePolicy`+`RebateAccrual` (三期, 阶梯返利+周期结算)
   - **经销商在线订货** (纷享销客"订货通"有): ✅ 已纳入 §3.18 `DealerOrder` (三期, 备货采购, 区别于合同后交付)
   - **CPQ/BOM 级报价** (纷享销客/销售易有): ✅ 已纳入 §3.19 `BomItem` (三期, 渐进启用; 一期扁平明细)
   - **资产层级 (父子SN) + 计划量vs实际量** (ServiceMax/Salesforce 有): ✅ 已纳入 §3.15 `EquipmentSN.parentSNId` + §3.1 `ProductItem.plannedQuantity/actualDeliveredQuantity`

### 2.5 系统边界:PMS(外部经销商) vs Tandem(内部) 的切割与关联

> **核心命题 (Owner 提醒)**: PMS 主要使用方是**经销商 + 经销商成员 (外部用户)**, 而 Tandem 是**内部管理系统** (OKR/绩效/学院/内网/议事)。两者必须**切而不断**: 共享同一套基座 (auth / org / IM / 中央AI / 审批 / KvStore), 但在 **用户面、模块面、数据面** 三层清晰隔离。

#### 2.5.1 现状机制 (代码事实, 非假设)

| 机制 | 代码位置 | 现状 |
|---|---|---|
| 两层用户模型 | `lib/auth/roles.ts` | 内部角色 `owner/admin/manager/employee/steward/champion/...` vs 外部角色 `guest/partner/contractor` |
| 三板块访问边界 | `lib/auth/module-scope.ts` `canAccessPath()` | **纯外部禁事半(OKR)**, 拿捏/搭子放行, system 放行; 内外混合按内部聚合 |
| Launchpad 可见性 | `lib/services/launchpad-visibility.ts` `isAppVisibleTo()` | **纯外部 = 白名单制 (opt-in)**: 仅当 `app.visibleToRoles` 显式含其外部角色才可见; 空 = 内部默认开放 = 外部不可见 |
| 外部注册 | `lib/auth/phone-login.ts` / `lib/auth/applications.ts` | 手机 OTP (`membershipType='pending'`, `guest`) 或 邮箱申请→Owner审批→单次邀请码→注册 |
| 下游组织归属 | `lib/auth/native.ts` (邀请码携带 `orgId`+`membershipType`) | 上游邀请下游成员, 注册即归属经销商组织 |

> **⚠️ 审计发现 (P0 安全缺口)**: `/pms` 当前**不在任何板块前缀** (`SHIBAN/NABA/DAZI_PREFIXES`) → `pillarOf('/pms')` 落到 `'system'` → `canAccessPath()` 对**所有人放行 (含无角色用户)**。PMS 是外部面向系统, **绝不能落入 system 裸奔**, 必须新增独立板块 (见 §2.5.2 ②)。

#### 2.5.2 三层切割

**① 用户面 (Who)**
- **外部 (经销商)**: 新增外部角色 `dealer_sales` (业务员) / `dealer_admin` (经销商管理员), 登记进 `EXTERNAL_ROLES`; 手机 + 邀请码注册, 归属下游经销商组织。**只见 PMS + 拿捏 + 搭子(受邀), 永不见 事半/OKR/绩效/学院/内网/议事**。
- **内部 (瑞美)**: 内部角色 (区域经理/销售管理部/营管/技术支持/生产负责人 → 映射 `manager/employee` + 动态业务角色); 见 PMS + 全 Tandem。

**② 模块面 (What)**
- 新增**第四板块 `channel (产研销)`** 到 `lib/auth/module-scope.ts`: `CHANNEL_PREFIXES = ['/pms', '/api/pms']`。
- 决策规则扩展 `canAccessPath()`: `pillar === 'channel'` → 内部全通; 外部仅 `dealer_*` 角色可进 (端点级再按 orgId 限本组织)。
- Launchpad 注册 PMS 应用, `visibleToRoles` 显式含 `dealer_sales/dealer_admin` (走白名单机制)。

**③ 数据面 (Which data)**
- `tenantId` 隔离 (全局, 全 record 恒带) **+ `orgId` 子隔离** (经销商只见本组织数据)。
- 经销商业务员: 仅见自己报备/被指派工单; 经销商管理员: 本组织全部; 二级经销商: 受所属一级可见性约束。
- **端点级 `requireAuth` + orgId 过滤是主防线**, 路径板块守卫只是第一道。审计要求: 每个 `/api/pms/*` 路由必须显式校验 `record.orgId ∈ 用户可见组织集`。

#### 2.5.3 Tandem 能力对 PMS 的开放矩阵

| Tandem 能力 | 对外部经销商 | 对内部(PMS内) | 边界说明 |
|---|:---:|:---:|---|
| 身份/认证 (手机+邀请码) | ✅ | ✅ | 复用 `lib/auth`, 外部走 OTP/邀请码 |
| 组织树 (下游组织) | ✅ 本组织 | ✅ 全量 | 经销商 = 下游 org, `orgId` 隔离 |
| IM / 推送渠道 | ✅ 接收+有限收发 | ✅ | 分级推送落地渠道 (§3.8) |
| 拿捏 (个人 AI 助理) | ✅ | ✅ | 已默认外部可用 (naba 板块) |
| 搭子 (手抄/文档/日历) | ✅ 受邀 | ✅ | 协作面, 邀请粒度 (dazi 板块) |
| 中央 AI (CompanyBrain) | ⚠️ 受限 surface | ✅ 全量 | 经销商仅得 **PMS 范围问答** (查重/进度/售后诊断), **不暴露内部 OKR/战略/记忆**; 经 Skill Gateway 数据域+动作域闸 |
| 审批流框架 | ✅ 发起/查看本组织 | ✅ | PMS 多级审批复用 |
| 审计日志 | 写(不可读) | ✅ | 外部操作全留痕 |
| **事半 / OKR** | ❌ | ✅ 内部锚定 | 商机可锚定 OKR, **仅瑞美内部可见**; 经销商永不见 |
| **绩效 / KPI / 九宫格** | ❌ | ❌ 不适用 | 纯内部人才治理 |
| **学院 / 内网 / 议事 / town-hall** | ❌ | ❌ 不适用 | 纯内部 |
| **记忆系统内部** | ❌ | 间接 | 仅中央 AI 内部使用, 不直接开放 |

#### 2.5.4 关联桥梁 (切而不断)

1. **身份桥**: 一套用户表, `roles` + `membershipType` 区分内外, 不建两套账号体系。
2. **组织桥**: 下游组织树 = 经销商层级 (一级/二级), 复用 `createDownstreamOrg` / `inviteDownstreamMember`。
3. **OKR 桥 (单向)**: PMS 商机/成交额 → 锚定内部 Objective (仅瑞美侧可见); 经销商动作**反哺**内部 OKR 达成, 但 OKR 本体对经销商不可见。契合 Owner 初心"企业 AI 为 OKR 而活"—— **PMS 是 OKR 的外部数据源, 不是 OKR 的暴露面**。
4. **AI 桥 (受闸)**: 中央 AI 对经销商开"业务助手"子集, 对内部开全量感知/推理; Skill Gateway 四道闸 (baseline / OKR-drift / data-scope / action-scope) 确保外部调用不越权、不泄露内部数据。
5. **推送桥**: §3.8 分级推送把内部管控意志 (升级阶梯) 传导到外部一线, 是"内部管理 → 外部执行"的神经通路。

---

## 三、数据模型

### 3.1 商机报备 (Opportunity) — 核心实体

```typescript
interface Opportunity {
  id: string;
  tenantId: string;

  // === 报备基本信息 ===
  reportName: string;              // 商机报备名称 (地名+用水单位+建筑性质+用水类型)
  customerSuffix: 'commercial' | 'tech_residential';  // 后缀: 商用 / 科技住宅
  customerId: string;              // 子客户 ID (带后缀)
  parentCustomerId?: string;       // 上级客户 ID (不带后缀, 开票用)
  projectAddress: string;          // 项目详细地址
  projectLongitude?: number;       // 经度 (地图 API 解析)
  projectLatitude?: number;        // 纬度
  contactName: string;             // 联系人姓名
  contactPhone: string;            // 联系人电话
  contactEmail?: string;

  // === 报备人信息 (经销商模式) ===
  reporterId: string;              // 报备人 userId (经销商操作人员)
  reporterOrgId?: string;          // 报备经销商组织 ID
  dealerLevel: 'primary' | 'secondary';  // 经销商层级: 一级 / 二级
  primaryDealerOrgId?: string;     // 一级经销商组织 ID (二级报备时必填, 一级报备时=reporterOrgId)
  primaryDealerName?: string;      // 一级经销商名称 (冗余, 便于展示)
  reportRegion?: string;           // 区域

  // === 产品明细 ===
  productItems: ProductItem[];     // 物料明细 (型号+单价+数量)
  estimatedAmount: number;         // 预计项目金额 (由明细自动汇总)

  // === 渠道来源 ===
  source?: 'inbound' | 'outbound' | 'referral' | 'partner' | 'event' | 'existing' | 'other';
  sourceDetail?: string;           // 来源详情 (如展会名称/转介绍人)

  // === 竞品信息 ===
  competitors?: string[];          // 竞品品牌列表
  projectDescription?: string;     // 项目描述 (markdown)
  attachments?: string[];          // 附件 ID 列表 (现场照片/佐证文件)

  // === 预测 ===
  estimatedCloseDate?: string;     // 预计成交日期 (生产预测用)

  // === 状态管控 ===
  status: OpportunityStatus;       // 报备审核状态
  stage: OpportunityStage;         // 跟进阶段 (10 阶段之一, 经销商模式无回款)
  stageEnteredAt?: string;         // 进入当前阶段的时间 (用于阶段超时计算)
  stageDeadline?: string;          // 当前阶段截止时间

  // === 撞单 ===
  isDuplicate: boolean;            // 是否撞单
  duplicateScore?: number;         // 查重匹配分 (0-100)
  duplicateStatus?: 'none' | 'pending_review' | 'questioning' | 'question_approved' | 'question_rejected' | 'withdrawn';
  duplicateWith?: string[];        // 冲突的商机 ID 列表
  questionReason?: string;         // 质疑理由
  questionAttachments?: string[];  // 质疑佐证文件
  questionSubmittedAt?: string;
  questionReviewedBy?: string;
  questionReviewedAt?: string;
  questionResult?: 'approved' | 'rejected';

  // === 90 天管控 ===
  lastFollowUpAt?: string;         // 最后跟进时间
  followUpWarningSent?: boolean;   // 75 天预警已发送
  cancelCount: number;             // 被取消次数 (0/1/2)
  cancelledAt?: string;            // 被取消时间
  recoveryDeadline?: string;       // 恢复截止时间 (取消后 7 天)

  // === 公海池 ===
  inPublicPool: boolean;           // 是否在公海池
  publicPoolEnteredAt?: string;    // 进入公海池时间
  publicPoolReason?: 'overdue' | 'voluntary' | 'rejected' | 'duplicate_lost';
  claimedBy?: string;              // 认领人 userId
  claimedAt?: string;
  claimProtectionDeadline?: string;  // 认领保护期截止 (72 小时)
  originalReporterBlockedUntil?: string;  // 原报备人禁止认领截止 (30 天)

  // === 成交/丢单 ===
  wonAt?: string;                  // 赢单时间
  lostAt?: string;                 // 丢单时间
  lostReasonPrimary?: string;      // 丢单一级原因
  lostReasonSecondary?: string;    // 丢单二级原因
  lostCompetitor?: string;         // 竞品品牌
  lostCompetitorPrice?: number;    // 竞品价格
  lostLesson?: string;             // 经验教训
  lostReviewedBy?: string;         // 区域经理审核
  lostConfirmedBy?: string;        // 销售总监确认

  // === 合同 ===
  contractId?: string;             // 关联合同 ID
  contractStatus?: 'draft' | 'open' | 'effective' | 'synced_to_b2b';

  // === 审计 ===
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface ProductItem {
  id: string;
  productModel: string;            // 产品型号
  productName: string;             // 物料名称
  unitPrice: number;               // 基准单价
  quantity: number;                // 销售数量
  amount: number;                  // 金额 = unitPrice * quantity
  // === 计划量 vs 实际量 (对标 Salesforce 销售协议 Sales Agreement) ===
  plannedQuantity?: number;        // 计划量 (报备/合同预估)
  actualDeliveredQuantity?: number;// 实际交付量 (随交付累计)
  fulfillmentRate?: number;        // 履约率 = actualDelivered / planned
  // === CPQ/BOM (配置化产品; 详见 §3.19) ===
  bomItems?: BomItem[];            // 物料清单 (机组由子部件组成时展开)
  isConfigurable?: boolean;        // 是否配置化产品 (走 CPQ 报价)
  // 变更追踪
  originalModel?: string;          // 变更前型号 (型号变更时记录)
  changedAt?: string;
  changedBy?: string;
}

type OpportunityStatus =
  | 'open'           // 开立 (保存未提交 / 退回 / 撤回)
  | 'pending_approval'  // 审批中
  | 'approved'       // 审核通过
  | 'rejected'       // 已退回
  | 'cancelled'      // 已取消 (超期)
  | 'in_public_pool' // 公海池
  | 'won'            // 赢单
  | 'lost';          // 丢单

type OpportunityStage =
  | 'report'         // 报备 (7天)
  | 'visit'          // 拜访 (30天)
  | 'solution'       // 方案 (30天)
  | 'bidding'        // 招标 (45天)
  | 'quotation'      // 报价 (30天)
  | 'negotiation'    // 谈判 (30天)
  | 'contract'       // 签约 (15天) — 经销商与终端客户签约
  | 'equipment_delivery'  // 设备交付 (厂家→经销商, 按合同)
  | 'won'            // 赢单 (经销商完成项目, 归档)
  | 'lost';          // 丢单
```

> **经销商模式说明**: 瑞美是厂家, 不直接销售给终端客户。经销商与终端客户签约, 瑞美根据合同向经销商交付设备。无回款阶段 (瑞美向经销商收款走财务系统, 不在 PMS 管控范围)。

### 3.2 跟进记录 (FollowUpRecord)

```typescript
interface FollowUpRecord {
  id: string;
  tenantId: string;
  opportunityId: string;

  type: FollowUpType;              // 交易类型
  stage: OpportunityStage;         // 当前阶段
  title: string;
  content: string;                 // 跟进内容
  contactPerson?: string;          // 对接人
  visitLocation?: string;          // 拜访地点
  visitLongitude?: number;
  visitLatitude?: number;
  competitorInfo?: string;         // 竞品信息
  riskLevel?: 'low' | 'medium' | 'high';  // 项目风险等级
  attachments?: string[];          // 附件

  userId: string;                  // 操作人
  activityDate: string;            // 活动日期
  createdAt: string;
}

type FollowUpType =
  | 'opportunity_followup'    // 商机跟进
  | 'solution_review'         // 方案审核
  | 'bidding'                 // 招投标
  | 'quotation'               // 报价
  | 'price_application'       // 价格申请
  | 'contract_signing'        // 签约
  | 'delivery'                // 交付
  | 'payment'                 // 回款
  | 'visit'                   // 拜访
  | 'other';
```

### 3.3 查重记录 (DuplicateCheck)

```typescript
interface DuplicateCheck {
  id: string;
  tenantId: string;
  opportunityId: string;           // 待查商机
  matchedOpportunityId: string;    // 匹配到的已有商机

  // 五维度匹配分
  scores: {
    customerName: number;          // 客户名称匹配 (0-25)
    address: number;               // 500米内项目地址 (0-25)
    contactPhone: number;          // 联系人电话 (0-20)
    projectName: number;           // 项目名称语义相似度 (0-15)
    productOverlap: number;        // 产品型号重叠度 (0-15)
  };
  totalScore: number;              // 总分 (0-100)
  level: 'high' | 'medium' | 'low';  // 60+高 / 40-59中 / 20-39低

  checkType: 'manual' | 'auto_submit' | 'daily_scan';
  createdAt: string;
}
```

### 3.4 价格申请 (PriceApplication)

```typescript
interface PriceApplication {
  id: string;
  tenantId: string;
  opportunityId: string;
  productItems: PriceProductItem[];  // 产品明细 (含标准价+扣点+提货价)
  totalDiscount: number;            // 总扣点 (如 0.22 = 22%)
  totalAmount: number;              // 最终提货总价

  status: 'draft' | 'pending' | 'approved' | 'rejected';
  approvalLevel: 'regional' | 'cmo' | 'ceo';  // 审批层级
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;

  applicantId: string;              // 申请人 (经销商对应客户经理)
  createdAt: string;
  updatedAt: string;
}

interface PriceProductItem extends ProductItem {
  standardPrice: number;            // 标准价格 (取价获得)
  extraDiscount: number;            // 额外扣点 (如 0.22)
  finalPrice: number;               // 最终提货价 = standardPrice * (1 - extraDiscount)
}
```

### 3.5 合同 (Contract)

```typescript
interface Contract {
  id: string;
  tenantId: string;
  opportunityId: string;

  contractNo?: string;              // 合同编号
  customerId: string;               // 子客户 (带后缀)
  billingCustomerId: string;        // 开票客户 (上级客户, 不带后缀)

  productItems: ProductItem[];      // 产品明细 (价格审批后自动调整单价)
  totalAmount: number;              // 合同总金额

  status: 'draft' | 'open' | 'effective' | 'synced_to_b2b';
  approvedBy?: string;              // 营管审核人
  approvedAt?: string;
  syncedToB2bAt?: string;

  // 审批
  legalApproved?: boolean;          // 法务审核
  legalApprovedBy?: string;
  financeApproved?: boolean;        // 财务审核
  financeApprovedBy?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.6 公海池记录 (PublicPoolEntry)

```typescript
interface PublicPoolEntry {
  id: string;
  tenantId: string;
  opportunityId: string;

  enteredAt: string;
  reason: 'overdue' | 'voluntary' | 'rejected' | 'duplicate_lost';
  originalReporterId: string;
  originalReporterBlockedUntil: string;  // 原报备人 30 天内不可认领

  // 认领
  status: 'available' | 'claimed' | 'confirmed' | 'expired';
  claimedBy?: string;
  claimedAt?: string;
  claimProtectionDeadline?: string;  // 72 小时保护期
  firstFollowUpCompleted?: boolean;  // 认领后首次跟进确认
  firstFollowUpDeadline?: string;

  createdAt: string;
  updatedAt: string;
}
```

### 3.7 审批记录 (ApprovalRecord)

```typescript
interface ApprovalRecord {
  id: string;
  tenantId: string;
  opportunityId?: string;
  type: ApprovalType;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  priority: 'normal' | 'urgent';

  // 审批节点
  currentApproverRole: string;      // 当前审批人角色
  currentApproverId?: string;       // 当前审批人 userId
  submittedAt: string;
  dueAt: string;                    // 截止时间 (1 个工作日)
  escalatedAt?: string;             // 超期升级时间

  // 审批结果
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;

  // 附件
  attachments?: string[];

  createdAt: string;
  updatedAt: string;
}

type ApprovalType =
  | 'report'              // 报备审批 → 区域经理
  | 'duplicate'           // 撞单审核 → 销售管理部
  | 'big_customer'        // 大客户审批 → 大客户总监 (≥50万)
  | 'solution'            // 方案审批 → 技术支持
  | 'solution_director'   // 技术总监审批 (≥100万或定制)
  | 'price_regional'      // 价格审批 → 区总 (<5%)
  | 'price_cmo'           // 价格审批 → CMO (5%-15%)
  | 'price_ceo'           // 价格审批 → CEO (>15%)
  | 'contract';           // 合同审批 → 法务+财务
```

### 3.8 分级推送与升级机制 (AlertMessage + NotificationRule)

> **设计理念 (项目型 vs 零售型)**: 商用/轻商项目 **低频、高单值、长周期、里程碑硬**,厂家在经销商模式下**看不见渠道一线动作** (直击 §1.2 痛点"跟进过程不可视")。因此推送不是零售 CRM 的"扁平提醒",而是一套 **推送矩阵 (角色 × 紧急度 × 渠道) + 升级阶梯 (到期不作为 → 逐级向上升级)** 的项目管控机制。对标 Salesforce/Dynamics 的 escalation rules、SAP PS 的里程碑告警。
>
> **两大原则**: ① **分级不刷屏** — 同类提醒去重 + 静默聚合成摘要,过度打扰是推送系统失效的头号原因; ② **升级有据** — 每级带 SLA 时限,超时未处理自动升级到上级角色,并留痕。

#### 3.8.1 推送矩阵 (角色 × 紧急度 × 渠道)

| 角色层 | 该收什么 | 渠道 | 频率/策略 |
|---|---|---|---|
| **销售一线** (经销商业务员) | 任务级: 跟进到期、阶段准入缺条件、回访提醒、被指派回报 | 小程序 push / 企微 | 实时 |
| **经销商管理员** | 汇总级: 本组织超期项目、资质到期、交付健康度红黄 | 企微 / 邮件 | 日报聚合 |
| **区域经理** | 升级级 (仅超阈值才推): 大单停滞、撞单仲裁、批次质量、下级超期升级 | 企微 + 邮件 | 触发 |
| **销售管理部 / 营管** | 经营级: 漏斗异常、赢丢单趋势、公海积压、生产预测偏差 | 邮件 / 站内 | 周报 |
| **技术支持 / 生产负责人** | 交付级: 设计审批待办、产能预警、售后支持请求 (factory_support) | 企微 / 站内 | 触发 |
| **瑞美管理层 + 中央 AI** | 战略级: 大单风险、召回批次、资质合规率、经营简报 | 站内 + 邮件 | 触发 + 周期 |

#### 3.8.2 升级阶梯 (Escalation Ladder)

> 以"阶段超期"为例, 复用已有 90 天管控 (§2.1 / §5.4):

```
T+0   阶段到期        → 提醒经销商业务员           (企微 / 小程序)
T+3   仍未处理        → 抄送经销商管理员            (企微)
T+7   / 75天预警      → 升级区域经理                (企微 + 邮件)
T+15  / 90天          → 升级销售管理部 + 自动取消/进公海池
```
每一级: 命中 `NotificationRule.slaHours` 未 `acted` → 自动触发下一级 `escalateToRole`, 并写 `escalationTrail` 留痕。

#### 3.8.3 数据模型

```typescript
// 推送角色层 (与 §11 权限模型对齐; 经销商侧细分业务员/管理员两层, 便于分级)
type PmsRole =
  | 'owner' | 'admin'
  | 'regional_manager'       // 区域经理
  | 'dealer_sales'           // 销售一线 (经销商业务员)
  | 'dealer_admin'           // 经销商管理员 (本组织全权限)
  | 'sales_mgmt'             // 销售管理部
  | 'ops_mgmt'               // 营管
  | 'tech_support'           // 技术支持
  | 'production_manager'     // 生产负责人
  | 'service_provider';      // 服务商

interface AlertMessage {
  id: string;
  tenantId: string;
  opportunityId?: string;
  deliveryOrderId?: string;        // 交付/售后类预警关联工单

  type: AlertType;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';

  // === 分级推送 ===
  audienceRole?: PmsRole;          // 目标角色层 (由 NotificationRule 解析出具体 userIds)
  targetUserIds: string[];         // 通知对象 (最终解析结果)
  channels: NotificationChannel[]; // 应发渠道
  sentChannels: NotificationChannel[];  // 已发送渠道

  // === 去重 / 静默聚合 ===
  dedupeKey?: string;              // 去重键 (如 `stage_overdue:{opportunityId}`), 同键窗口内合并
  digestBatchId?: string;         // 若被聚合进摘要, 记录批次 (日报/周报)

  // === 升级阶梯 ===
  escalationLevel: number;         // 当前升级级别 (0 = 初始)
  slaHours?: number;               // 本级 SLA (超时未 acted 触发升级)
  escalationTrail?: {              // 升级留痕
    level: number;
    role: PmsRole;
    userIds: string[];
    triggeredAt: string;
    reason: 'sla_timeout' | 'severity_bump' | 'manual';
  }[];

  status: 'pending' | 'sent' | 'read' | 'acted';
  createdAt: string;
  sentAt?: string;
  readAt?: string;
  actedAt?: string;
}

type NotificationChannel = 'in_app' | 'wecom' | 'sms' | 'email' | 'miniapp_push';

type AlertType =
  | 'follow_up_reminder'     // 跟进提醒 (75天)
  | 'overdue_warning'        // 超期警告 (90天)
  | 'release_notice'         // 释放通知 (进公海池)
  | 'stage_overdue'          // 阶段超期
  | 'report_reminder'        // 报备提醒 (7天未推进)
  | 'approval_reminder'      // 审批提醒 (超1天)
  | 'duplicate_alert'        // 撞单预警
  | 'claim_reminder'         // 认领保护期到期
  // === 交付 / 售后 / 渠道类 (分级推送新增) ===
  | 'delivery_risk'          // 交付健康度转红/黄
  | 'dealer_report_overdue'  // 经销商回报超期
  | 'qualification_expiring' // 资质到期 (提前60天)
  | 'warranty_expiring'      // 维保到期
  | 'recall_notice'          // 召回通知 (SN 批次)
  | 'capacity_warning'       // 产能预警
  | 'big_deal_stalled'       // 大单停滞 (高金额+长停留)
  | 'iot_alarm'             // 设备 IoT 告警 (§3.16, 自动生成维保工单)
  | 'rebate_settlement'    // 返利结算待审/已结算 (§3.17)
  | 'dealer_order_status'  // 订货单状态变更 (§3.18)
  | 'ops_digest';            // 经营简报 (周期聚合)

// 分级推送规则 (可由 Admin 配置; 决定"什么事件 → 推给哪个角色 → 走哪些渠道 → SLA 多久 → 超时升级给谁")
interface NotificationRule {
  id: string;
  tenantId: string;
  alertType: AlertType;
  audienceRole: PmsRole;           // 初始接收角色层
  channels: NotificationChannel[];
  severity: 'info' | 'warning' | 'critical';
  dedupeWindowMinutes?: number;    // 去重/聚合窗口 (0 = 不聚合, 实时单发)
  digest?: 'none' | 'daily' | 'weekly';  // 聚合成日报/周报
  slaHours?: number;               // 本级处理时限
  escalateToRole?: PmsRole;        // 超时升级到的角色 (空 = 不升级)
  enabled: boolean;
  updatedAt: string;
}
```

> **落地复用**: 渠道发送复用 `lib/im/` (企微/站内) + 现有短信/邮件通道 (§9.1); 角色→userIds 解析复用 §11 权限模型的角色-组织映射; 静默聚合的日报/周报由 §13 二期定时任务生成。

### 3.9 设备交付工单 (DeliveryOrder) — 签约后自动创建

> **经销商模式**: 瑞美只负责 生产→设备交付给经销商。施工安装/调试/验收/维保 由经销商在终端客户现场执行, 瑞美通过经销商回报跟踪状态。

```typescript
interface DeliveryOrder {
  id: string;
  tenantId: string;
  opportunityId: string;           // 关联商机
  contractId: string;              // 关联合同

  // === 基本信息 ===
  projectName: string;             // 项目名称 (从商机带出)
  endCustomerId: string;           // 终端客户 ID (经销商的客户)
  customerSuffix: 'commercial' | 'tech_residential';
  projectAddress: string;          // 终端客户项目地址
  projectLongitude?: number;
  projectLatitude?: number;

  // === 经销商信息 ===
  dealerOrgId: string;             // 经销商组织 ID (设备接收方)
  dealerLevel: 'primary' | 'secondary';  // 经销商层级
  primaryDealerOrgId?: string;     // 一级经销商 (二级时必填)
  dealerContactName?: string;      // 经销商收货联系人
  dealerContactPhone?: string;     // 经销商收货电话
  dealerDeliveryAddress?: string;  // 经销商收货地址 (可能≠项目地址)

  // === 服务商委托 (当经销商无资质时) ===
  serviceAssignments?: ServiceProviderAssignment[];  // 委托的服务商列表
  // 如: 经销商无调试资质 → 委托专业服务商做调试
  // 经销商无维保资质 → 委托一级经销商或第三方做维保

  // === 交付阶段 ===
  stage: DeliveryStage;
  stageEnteredAt?: string;
  stageDeadline?: string;

  // === 瑞美方责任人 (仅厂家端) ===
  productionManagerId?: string;    // 生产负责人
  deliveryCoordinatorId?: string;  // 发货协调人
  afterSalesContactId?: string;    // 售后对接人

  // === 产品明细 (从合同带出) ===
  productItems: ProductItem[];

  // === 厂家端时间节点 ===
  contractDate?: string;           // 合同签订日期 (经销商与终端客户签约)
  plannedProductionDate?: string;  // 计划生产日期
  actualProductionDate?: string;   // 实际生产完成日期
  plannedDeliveryDate?: string;    // 计划发货日期 (厂家→经销商)
  actualDeliveryDate?: string;     // 实际发货日期
  dealerReceivedDate?: string;     // 经销商确认收货日期

  // === 经销商端跟踪 (经销商回报, 非瑞美执行) ===
  dealerInstallDate?: string;      // 经销商施工安装日期 (回报)
  dealerAcceptanceDate?: string;   // 经销商竣工验收日期 (回报)
  dealerCommissioningDate?: string; // 经销商调试完成日期 (回报)
  dealerHandoverDate?: string;     // 经销商移交终端客户日期 (回报)
  dealerProjectStatus?: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'issue_reported';

  // === 维保 (经销商回报) ===
  warrantyStartDate?: string;      // 维保开始日期 (经销商回报移交日)
  warrantyEndDate?: string;        // 维保结束日期
  warrantyPeriodMonths: number;    // 维保期 (月)
  maintenanceStatus?: 'in_warranty' | 'expiring' | 'expired' | 'extended';

  // === 状态 ===
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  health: 'green' | 'yellow' | 'red';  // 交付健康度

  // === 验收 (设备到货验收, 厂家→经销商) ===
  deliveryAcceptanceResult?: 'passed' | 'conditional' | 'failed';
  deliveryAcceptanceNotes?: string; // 到货验收备注 (经销商确认)
  deliveryIssues?: string[];       // 到货问题清单 (破损/缺件/型号不符)

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

type DeliveryStage =
  | 'design_review'        // 设计方案审批 (瑞美技术部)
  | 'production'           // 生产制造 (瑞美工厂)
  | 'shipping'             // 发货物流 (瑞美→经销商)
  | 'dealer_received'      // 经销商收货确认
  | 'dealer_installation'  // 经销商施工安装 (经销商回报)
  | 'dealer_acceptance'    // 经销商竣工验收 (经销商回报)
  | 'dealer_commissioning' // 经销商调试 (经销商回报)
  | 'dealer_handover'      // 经销商移交终端客户 (经销商回报)
  | 'warranty'             // 维保期 (经销商跟踪)
  | 'completed';           // 项目完成归档
```

> **阶段分工说明**:
> - `design_review` ~ `dealer_received`: **瑞美执行**, 系统自动跟踪
> - `dealer_installation` ~ `dealer_handover`: **经销商执行**, 经销商通过系统回报状态
> - `warranty`: **经销商跟踪**, 瑞美提供售后支持
> - 回款不在此系统管控 (走财务系统)

### 3.10 交付任务 (DeliveryTask) — 交付过程中的具体任务

```typescript
interface DeliveryTask {
  id: string;
  tenantId: string;
  deliveryOrderId: string;

  stage: DeliveryStage;            // 所属交付阶段
  title: string;
  description?: string;

  // 执行方
  executedBy: 'factory' | 'dealer' | 'service_provider';  // 瑞美 / 经销商 / 专业服务商
  assigneeId: string;              // 负责人 (factory=瑞美员工, dealer=经销商人员, service_provider=服务商人员)
  assigneeOrgId?: string;          // 组织 ID (dealer 或 service_provider 任务时)
  requiredQualification?: DealerQualification['type'];  // 该任务需要的资质类型
  qualificationVerified?: boolean; // 资质是否已校验 (创建/分配时自动检查)

  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;

  // 依赖
  dependsOn?: string[];            // 前置任务 ID

  // 附件 (生产照片/发货照片/经销商施工照片/验收报告)
  attachments?: string[];

  // 完成确认
  completedBy?: string;
  completedAt?: string;
  verifiedBy?: string;             // 验证人 (factory 任务由瑞美验证, dealer 任务由经销商确认)
  verifiedAt?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.11 验收记录 (AcceptanceRecord)

> **经销商模式**: 到货验收由经销商执行 (确认厂家设备交付); 竣工验收由经销商在终端客户现场执行并回报。

```typescript
interface AcceptanceRecord {
  id: string;
  tenantId: string;
  deliveryOrderId: string;

  // 验收类型
  type: 'equipment_delivery' | 'dealer_final' | 'warranty_expiry';
  // equipment_delivery: 设备到货验收 (经销商验收厂家发货)
  // dealer_final: 经销商竣工验收 (经销商在终端客户现场, 回报瑞美)
  // warranty_expiry: 维保到期验收 (经销商回报)

  // 执行方
  executedBy: 'dealer' | 'factory';  // 到货=dealer, 竣工=dealer, 厂家抽检=factory

  // 验收内容
  inspectionItems: InspectionItem[];
  totalScore: number;              // 0-100
  result: 'passed' | 'conditional' | 'failed';

  // 验收人员
  inspectorIds: string[];          // 验收人 (经销商人员)
  inspectorOrgId?: string;         // 经销商组织 ID
  endCustomerRepresentative?: string; // 终端客户方代表 (竣工验收时)
  endCustomerSigned?: boolean;     // 终端客户签字确认 (经销商回报)
  endCustomerSignedAt?: string;

  // 遗留问题
  issues?: AcceptanceIssue[];

  // 附件
  attachments?: string[];          // 验收报告/照片/签字文件 (经销商上传)

  notes?: string;
  createdAt: string;
}

interface InspectionItem {
  name: string;                    // 检查项名称 (如"设备外观完好" "型号数量核对" "包装完整")
  standard?: string;               // 验收标准
  result: 'pass' | 'fail' | 'na';
  score?: number;                  // 0-100
  remark?: string;
}

interface AcceptanceIssue {
  description: string;
  severity: 'critical' | 'major' | 'minor';
  status: 'open' | 'in_progress' | 'resolved';
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}
```

### 3.12 调试记录 (CommissioningRecord) — 经销商或服务商回报

> **经销商模式**: 调试由具备 `commissioning` 资质的经销商或专业服务商在终端客户现场执行, 结果回报瑞美。瑞美技术支持可远程协助。

```typescript
interface CommissioningRecord {
  id: string;
  tenantId: string;
  deliveryOrderId: string;

  // 调试内容
  commissioningDate: string;
  duration?: number;               // 调试时长 (小时)

  // 执行方
  executedBy: 'dealer' | 'service_provider';  // 经销商 (需有资质) / 专业服务商
  executorOrgId: string;           // 执行组织 ID (经销商或服务商)
  engineerIds: string[];           // 调试人员 (需具备 commissioning 资质)
  factorySupportId?: string;       // 瑞美技术支持 (远程协助, 可选)
  qualificationVerified: boolean;  // 执行方资质是否已校验

  // 调试项目
  items: CommissioningItem[];

  // 调试结果
  result: 'passed' | 'issues_found' | 'failed';
  issuesFound?: string[];
  resolutionActions?: string[];

  // 性能参数
  performanceParams?: { name: string; target: string; actual: string; pass: boolean }[];

  // 终端客户
  endCustomerPresent?: boolean;    // 终端客户是否在场
  endCustomerRepresentative?: string;

  attachments?: string[];          // 调试报告/数据记录 (经销商上传)
  notes?: string;
  createdAt: string;
}

interface CommissioningItem {
  name: string;                    // 调试项 (如"系统启动测试" "水温测试" "压力测试" "联动测试")
  status: 'pass' | 'fail' | 'pending';
  measuredValue?: string;
  standardValue?: string;
  remark?: string;
}
```

### 3.13 维保记录 (MaintenanceRecord) — 经销商或服务商执行, 厂家支持

> **经销商模式**: 维保由具备 `maintenance` 资质的经销商或专业服务商在终端客户现场执行。涉及厂家设备质量问题的, 可向瑞美发起售后支持请求。

```typescript
interface MaintenanceRecord {
  id: string;
  tenantId: string;
  deliveryOrderId: string;

  // 维保类型
  type: 'routine' | 'emergency' | 'warranty' | 'paid' | 'inspection' | 'factory_support' | 'amc';
  // routine: 例行巡检 (经销商或服务商执行)
  // emergency: 紧急维修 (经销商或服务商执行)
  // warranty: 保内维修 (经销商或服务商执行)
  // paid: 保外付费维修 (经销商向终端客户收费)
  // inspection: 定期检查
  // factory_support: 需瑞美厂家支持 (设备质量问题)
  // amc: 年度维保合同 (Annual Maintenance Contract, 质保期外的长期维保协议)

  // 执行方
  executedBy: 'dealer' | 'service_provider' | 'factory';  // 经销商 / 专业服务商 / 瑞美派人
  executorOrgId?: string;          // 执行组织 ID (经销商或服务商)
  technicianId?: string;           // 维修人员 (需具备 maintenance 资质)
  factorySupportId?: string;       // 瑞美售后支持人员 (factory_support 时)
  qualificationVerified?: boolean; // 执行方资质是否已校验

  // 维保信息
  title: string;
  description: string;
  equipmentSNId?: string;           // 关联设备 SN 码 (EquipmentSN.id, 维修时绑定)
  equipmentSNCode?: string;         // 设备 SN 码 (冗余, 便于展示)
  warrantyStatusAtRepair?: 'in_warranty' | 'expiring' | 'expired' | 'extended';  // 维修时质保状态 (自动判定)
  requestDate: string;             // 报修/计划日期
  responseDate?: string;           // 响应日期
  completionDate?: string;         // 完成日期

  // 故障信息
  faultCategory?: string;          // 故障类别 (设备故障/安装问题/管路问题/电气问题/其他)
  faultDescription?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  isFactoryDefect?: boolean;       // 是否判定为厂家设备缺陷 (影响售后费用承担)

  // 处理
  resolution?: string;             // 处理结果
  partsReplaced?: { partName: string; quantity: number; cost?: number; billedTo?: 'dealer' | 'factory' }[];
  laborHours?: number;
  totalCost?: number;

  // 终端客户反馈 (经销商收集)
  endCustomerSatisfaction?: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  endCustomerFeedback?: string;

  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attachments?: string[];

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.14 经销商账号体系与服务商资质

> **经销商账号体系**: 复用 Tandem 已有的上下游组织模型 (`lib/auth/organizations.ts` + `lib/types/organization.ts`)。每个经销商是一个 `Organization` (type='downstream', category='dealer'), 经销商的多个业务员是该组织下的成员 (通过邀请码注册, 携带 orgId + membershipType='upstream_downstream')。

```typescript
// === 经销商组织 (复用 Tandem Organization, 扩展 PMS 字段) ===

interface DealerOrgProfile {
  id: string;                       // = Organization.id
  tenantId: string;
  orgName: string;                  // 经销商名称
  dealerLevel: 'primary' | 'secondary';  // 一级 / 二级
  parentDealerOrgId?: string;       // 二级经销商的一级上级 orgId
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  region?: string;                  // 主要经营区域
  address?: string;
  status: 'active' | 'suspended' | 'terminated';
  // 账号体系:
  //   - 瑞美 Admin 通过 createDownstreamOrg() 创建经销商组织
  //   - 通过 inviteDownstreamMember() 邀请经销商业务员注册
  //   - 每个业务员独立账号 (email + password), 归属该 orgId
  //   - 业务员角色: partner (外部合作伙伴), 走 /hub 工作台
  //   - 一级经销商管理员可由瑞美授权, 自主邀请本组织成员

  // 服务商资质 (关键: 不是所有经销商都能做调试验收和售后)
  qualifications: DealerQualification[];

  createdAt: string;
  updatedAt: string;
}

interface DealerQualification {
  type: 'installation' | 'commissioning' | 'acceptance' | 'maintenance' | 'design';
  // installation: 施工安装资质
  // commissioning: 调试资质 (需瑞美认证)
  // acceptance: 竣工验收资质
  // maintenance: 维保资质 (需瑞美认证)
  // design: 方案设计资质 (可选, 部分一级经销商可自主出方案)

  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  certifiedAt?: string;             // 瑞美认证日期
  expiresAt?: string;               // 资质有效期
  certifiedBy?: string;             // 瑞美认证人 userId

  // 资质证明文件
  certificates?: string[];          // 文件附件 ID (资质证书/培训记录)
  technicianIds?: string[];         // 持证技术人员 userId 列表

  // 覆盖范围
  regions?: string[];               // 资质覆盖区域
  productLines?: string[];          // 资质覆盖产品线 (空=全部)
}

// === 经销商成员 (业务员账号) ===
// 复用 Tandem User + Organization membership, PMS 侧无需新建实体:
//   - User.orgId = DealerOrgProfile.id
//   - User.membershipType = 'upstream_downstream'
//   - User.roles = ['partner'] (外部合作伙伴)
//   - 业务员通过邀请码注册 → 自动归属经销商组织
//   - 一级经销商管理员 (roles 含 'partner' + orgAdmin 标记) 可邀请本组织成员

interface DealerMemberSummary {
  userId: string;                   // Tandem User.id
  orgId: string;                    // 经销商组织 ID
  name: string;
  email: string;
  phone?: string;
  role: 'dealer_admin' | 'dealer_sales' | 'dealer_technician' | 'dealer_service';
  // dealer_admin: 经销商管理员 (可管理本组织成员, 可报备)
  // dealer_sales: 经销商业务员 (可报备/跟进)
  // dealer_technician: 经销商技术人员 (可执行调试验收, 需有 qualification)
  // dealer_service: 经销商售后人员 (可执行维保, 需有 qualification)

  // 技术人员资质关联
  qualifiedFor?: DealerQualification['type'][];  // 该人员具备的资质类型

  status: 'active' | 'disabled';
  joinedAt: string;
}

// === 服务商机制 ===
// 当经销商自身不具备某项资质时, 可委托具备资质的专业服务商执行:
//
// 场景1: 经销商 A 有施工资质但无调试资质 → 委托服务商 B 做调试
// 场景2: 二级经销商无维保资质 → 委托一级经销商或第三方服务商做维保
// 场景3: 经销商仅做销售, 全部技术环节委托服务商
//
// 服务商也是一种 Organization (type='downstream', category='contractor' 或 'dealer')
// 服务商需具备对应 qualification 才能被委托

interface ServiceProviderAssignment {
  id: string;
  tenantId: string;
  deliveryOrderId: string;

  serviceType: DealerQualification['type'];  // 委托的服务类型
  providerOrgId: string;           // 服务商组织 ID
  providerName: string;            // 服务商名称 (冗余)

  // 委托关系
  dealerOrgId: string;             // 委托方经销商
  assignedAt: string;
  assignedBy: string;              // 经销商管理员或瑞美

  // 执行人员 (服务商派人)
  technicianIds: string[];

  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}
```

### 3.15 设备 SN 码追踪 (EquipmentSN) — 全生命周期追溯

> **设计目标**: 每台设备从生产赋码到售后维修, 以 SN 码为唯一标识串联生产系统、交付工单、安装记录、维保记录, 实现"一物一码"全链路追溯。打通生产系统与售后系统, 支持精准召回和质保判定。

```typescript
interface EquipmentSN {
  id: string;
  tenantId: string;

  // === SN 码标识 ===
  snCode: string;                   // 设备序列号 (唯一, 全局唯一索引)
  productModel: string;             // 产品型号
  productName: string;              // 物料名称

  // === 资产层级 (对标 ServiceMax asset hierarchy) ===
  parentSNId?: string;              // 父设备 SN (部件挂机组时填); 空 = 顶层机组
  childSNIds?: string[];            // 子部件 SN 列表 (机组含可序列化部件时)
  assetLevel?: 'unit' | 'component' | 'part';  // 资产层级: 机组 / 部件 / 零件
  assetHierarchyPath?: string;      // 层级路径 (如 机组SN/部件SN, 便于树查询)

  // === 生产信息 (从生产系统/MES 同步) ===
  productionBatchId?: string;       // 生产批次号 (关联生产系统)
  productionOrderId?: string;       // 生产工单号 (关联 MES)
  productionDate?: string;          // 生产日期
  productionLine?: string;          // 生产线
  qcResult?: 'passed' | 'conditional' | 'failed';  // 质检结果
  qcDate?: string;                  // 质检日期

  // === 关联交付工单 ===
  deliveryOrderId?: string;         // 关联交付工单 (发货后绑定)
  contractId?: string;              // 关联合同

  // === 经销商/客户信息 (发货后绑定) ===
  dealerOrgId?: string;             // 经销商组织 ID
  endCustomerId?: string;           // 终端客户 ID
  installAddress?: string;          // 安装地址

  // === 安装信息 (经销商回报) ===
  installDate?: string;             // 安装日期
  installTechnicianId?: string;     // 安装人员 (经销商/服务商)
  commissioningDate?: string;       // 调试完成日期
  acceptanceDate?: string;          // 竣工验收日期
  handoverDate?: string;            // 移交终端客户日期

  // === 质保信息 ===
  warrantyStartDate?: string;       // 质保开始日期 (移交日)
  warrantyEndDate?: string;         // 质保结束日期
  warrantyStatus: 'in_warranty' | 'expiring' | 'expired' | 'extended' | 'pre_shipment';

  // === 维修历史 (关联 MaintenanceRecord) ===
  maintenanceRecordIds: string[];   // 关联维保记录 ID 列表
  totalMaintenanceCount: number;    // 累计维修次数 (冗余, 便于查询)

  // === 零部件替换记录 ===
  partsReplaced: PartsReplacement[];  // 更换的零部件列表

  // === 状态 ===
  lifecycleStatus:
    | 'in_production'        // 生产中 (从 MES 同步)
    | 'in_stock'             // 已入库 (从 ERP/WMS 同步)
    | 'shipped'              // 已发货 (绑定 DeliveryOrder)
    | 'installed'            // 已安装 (经销商回报)
    | 'commissioned'         // 已调试
    | 'in_use'               // 已移交终端客户
    | 'under_maintenance'    // 维保中
    | 'decommissioned';      // 退役/报废

  // === 追溯标记 ===
  isRecalled?: boolean;             // 是否在召回范围内
  recallBatchId?: string;           // 关联回收批次

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface PartsReplacement {
  id: string;
  replacedAt: string;               // 更换日期
  replacedBy: string;               // 更换人员 (经销商/服务商/瑞美)
  replacedByName: string;           // 更换人员姓名 (冗余)

  oldPartSN?: string;               // 旧零部件 SN 码 (如有)
  newPartSN?: string;               // 新零部件 SN 码
  partModel: string;                // 零部件型号
  partName: string;                 // 零部件名称
  reason: string;                   // 更换原因 (故障/升级/预防性)
  maintenanceRecordId: string;      // 关联维保记录
  isFactoryDefect?: boolean;        // 是否厂家缺陷 (影响费用承担)
}
```

> **SN 码生命周期流转**:
> ```
> 生产赋码 (MES) → 入库 (WMS) → 发货绑定 (DeliveryOrder)
>   → 经销商收货 → 安装 → 调试 → 验收 → 移交终端客户
>   → 维保期 → 维修 (记录零部件替换) → 质保到期 → 退役
> ```
>
> **正向追溯**: 生产批次 → 所有 SN 码 → 发往哪些经销商 → 终端客户 → 维修记录
> **反向追溯**: 终端客户报修 → SN 码 → 生产批次 → 质检记录 → 同批次其他设备
>
> **与生产系统对接** (§9.5): 生产系统通过 API 推送 SN 码赋码信息 (生产批次+质检结果), PMS 接收后创建 `EquipmentSN` 记录。发货时绑定 `deliveryOrderId`。经销商安装回报时更新 `installDate`/`commissioningDate` 等。
>
> **与售后系统对接**: 维保记录 (`MaintenanceRecord`) 创建时自动关联 `EquipmentSN`, 维修完成时更新 `partsReplaced` 和 `totalMaintenanceCount`。质保判定: 维修时自动检查 `warrantyEndDate` 判断保内/保外。
>
> **精准召回**: 当发现某批次设备缺陷时, 通过 `productionBatchId` 查询所有受影响 SN 码 → 关联经销商+终端客户 → 企微通知经销商/服务商 → 跟踪召回执行。

### 3.16 设备 IoT 接入 (EquipmentTelemetry) — 四期

> **对标**: 销售易 IoT 设备数据接入、Dynamics 365 预测维护。设备联网后, 运行数据/告警自动接入, 触发预警工单, 从"人工报修"升级为"主动运维"。绑定 `EquipmentSN`, 轻耦合 (设备网关/第三方 IoT 平台 → API 推送)。

```typescript
interface EquipmentTelemetry {
  id: string;
  tenantId: string;
  equipmentSNId: string;           // 关联设备 SN (EquipmentSN.id)
  snCode: string;                  // 冗余, 便于查询
  iotDeviceId?: string;            // IoT 网关/设备唯一标识

  // === 遥测采样 ===
  metricType: string;             // 指标类型 (温度/压力/水流/能耗/运行时长...)
  value: number;
  unit: string;
  sampledAt: string;              // 采样时间

  // === 告警 ===
  isAlarm?: boolean;              // 是否越限告警
  alarmLevel?: 'info' | 'warning' | 'critical';
  alarmRuleId?: string;          // 命中的告警规则
  autoWorkOrderId?: string;      // 自动生成的维保工单 (isAlarm 时)

  createdAt: string;
}
```

> **落地**: IoT 告警 → 自动创建 `MaintenanceRecord` (type='emergency') + 触发 `iot_alarm` 分级推送 (§3.8) 到经销商/服务商。**降级**: 未联网设备继续走 SN + 人工报修, IoT 为增量能力不阻塞主流程。

### 3.17 渠道返利 (RebatePolicy + RebateAccrual) — 三期

> **对标**: 纷享销客渠道返利、瑞泰促销返利。按经销商等级/区域/数量区间设返利规则, 成交后自动计提, 周期结算。补足价格审批+分级折扣之外的"事后激励"。

```typescript
interface RebatePolicy {
  id: string;
  tenantId: string;
  name: string;
  scope: 'all' | 'dealer_level' | 'region' | 'product_line' | 'dealer';
  dealerLevel?: 'primary' | 'secondary';
  region?: string;
  productModels?: string[];
  dealerOrgId?: string;            // scope=dealer 时指定

  // === 返利规则 (阶梯) ===
  tiers: {
    minAmount: number;             // 区间下限 (累计成交额/量)
    maxAmount?: number;
    rebateRate: number;            // 返利比例 (如 0.03 = 3%)
  }[];
  basis: 'deal_amount' | 'delivered_amount' | 'quantity';  // 计提基数
  period: 'monthly' | 'quarterly' | 'yearly';

  effectiveFrom: string;
  effectiveTo?: string;
  enabled: boolean;
  createdBy: string;
  updatedAt: string;
}

interface RebateAccrual {
  id: string;
  tenantId: string;
  policyId: string;
  dealerOrgId: string;
  period: string;                  // 结算周期 (如 2026-Q3)

  baseAmount: number;              // 计提基数 (期内累计)
  rebateRate: number;              // 命中档位比例
  rebateAmount: number;            // 计提返利额
  relatedContractIds: string[];    // 关联合同/成交

  status: 'accruing' | 'pending_review' | 'approved' | 'settled' | 'rejected';
  reviewedBy?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

> **落地**: 合同生效 → 按匹配 `RebatePolicy` 累计 `RebateAccrual`; 周期末 → 销售管理部审核 → 结算 (系统记录, 费用线下打款, 对齐服务商结算口径)。

### 3.18 经销商在线订货 (DealerOrder) — 三期

> **对标**: 纷享销客"订货通"。区别于 `DeliveryOrder` (合同后交付履约): `DealerOrder` 是经销商**主动向瑞美备货采购**的订单 (无终端客户, 走库存备货)。经销商在线下单 → 瑞美确认 → 发货 → 收货。

```typescript
interface DealerOrder {
  id: string;
  tenantId: string;
  orderNo: string;                 // 订货单号
  dealerOrgId: string;             // 下单经销商
  dealerLevel: 'primary' | 'secondary';
  primaryDealerOrgId?: string;     // 二级下单时, 归属一级

  // === 订货明细 ===
  items: ProductItem[];            // 复用产品明细
  totalAmount: number;

  // === 关联价格 ===
  priceApplicationId?: string;     // 若需特价, 关联价格审批

  // === 流转 ===
  status:
    | 'draft'                      // 草稿
    | 'submitted'                  // 已提交
    | 'confirmed'                  // 瑞美确认
    | 'in_production'              // 生产中
    | 'shipped'                    // 已发货
    | 'received'                   // 经销商收货
    | 'cancelled';
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  receivedDate?: string;

  createdBy: string;               // 经销商业务员
  confirmedBy?: string;            // 瑞美确认人
  createdAt: string;
  updatedAt: string;
}
```

> **落地**: 复用价格审批+生产推送链路; 订货单发货可赋 `EquipmentSN` (备货入经销商库存, 后续核销到具体项目)。

### 3.19 CPQ / BOM 级报价 (BomItem) — 三期

> **对标**: 纷享销客 CPQ、销售易 BOM 报价。配置化产品 (机组由多子部件组成) 支持 BOM 展开、按部件计价、配置约束校验。轻量实现: 嵌入 `ProductItem.bomItems`, 不单建重型 CPQ 引擎。

```typescript
interface BomItem {
  id: string;
  parentProductModel: string;      // 所属机组型号
  componentModel: string;          // 子部件型号
  componentName: string;
  quantity: number;                // 单机用量
  unitPrice: number;               // 部件单价
  amount: number;                  // = quantity * unitPrice

  // === 配置化 ===
  isOptional?: boolean;            // 可选件 (选配)
  isSelected?: boolean;            // 本次是否选中
  configGroup?: string;            // 互斥配置组 (同组只能选一)
  constraintNote?: string;         // 配置约束说明 (如"仅适配 X 型号")
}
```

> **落地**: 配置化产品报价 = 主机型号 + 选中的 `BomItem[]` 汇总; 价格审批 (`PriceApplication`) 按 BOM 明细取价/扣点; 合同/交付明细带出 BOM。**渐进**: 一期只用扁平 `ProductItem`, 三期对复杂机组启用 BOM。

### 3.20 甲方免登录触点 (CustomerFeedback) — 承接方视角

> **来源**: 审计 §2.6 甲方代表。经销商模式下**甲方(终端客户)无账号、全靠经销商中转** → ① 满意度真值失真(经销商粉饰) ② 质保/召回知情权缺失(合规风险)。解法 = **免登录甲方触点**: 每台设备贴 **SN 二维码**, 甲方扫码进只读 H5, 反馈**直回瑞美**(绕过经销商, 打破渠道信息黑洞)。

```typescript
// 甲方无账号, 通过设备 SN 二维码访问。二维码 = 签名 token (snCode + 签名),
// 后端校验只读本设备; 报修/回评走手机验证码轻校验 + 限流防滥用。
interface CustomerFeedback {
  id: string;
  tenantId: string;
  equipmentSNId: string;           // 关联设备 SN
  snCode: string;
  dealerOrgId: string;             // 冗余, 便于归集到经销商 (但反馈直达瑞美)
  endCustomerId?: string;

  type: 'repair_request' | 'satisfaction' | 'inquiry';

  // === 报修 ===
  faultDescription?: string;
  contactName?: string;
  contactPhone?: string;           // 手机验证码轻校验
  photos?: string[];

  // === 满意度回评 (直回瑞美, 防经销商粉饰) ===
  satisfactionScore?: 1 | 2 | 3 | 4 | 5;
  satisfactionComment?: string;
  relatedMaintenanceRecordId?: string;  // 回评关联的维保工单

  // === 处理 ===
  status: 'submitted' | 'acknowledged' | 'converted_to_workorder' | 'closed';
  convertedWorkOrderId?: string;   // 报修 → 自动创建 MaintenanceRecord
  channel: 'qr_h5';                // 来源: 扫码 H5
  submittedAt: string;
  createdAt: string;
}
```

> **甲方扫码只读页内容** (无需登录): 设备档案 (型号/安装日/安装方) · 质保状态 (保到何时/保什么) · 说明书/保养提示 · 报修入口 · 满意度回评。
>
> **落地**:
> - **报修** → 自动创建 `MaintenanceRecord` (来源标记甲方扫码) + 分级推送 (§3.8) 到经销商/服务商; 甲方可查进度。
> - **满意度** → **直回瑞美**, 不经经销商编辑, 作为经销商维保质量考核 (§10.3) 的**真值来源**。
> - **召回知情** → 重大召回 (§3.15) 除通知经销商外, **直达甲方** (短信/扫码提示), 满足安全/合规知情权。
> - **安全**: 二维码 token 签名防伪, 只读且限本设备; 写操作 (报修/回评) 走验证码 + 限流; 甲方**不进入** PMS 任何业务/内部数据 (§2.5 边界外的独立公开触点)。

### 3.21 经销商价值层 (DuplicateAppeal + DealerHealthScore) — 使用方获得感

> **来源**: 审计 §2.5 经销商代表。核心风险 = **系统对厂家有用、对经销商是负担 → 一线敷衍 → 数据失真 → 系统空壳**。**产品红线: 每个管控动作都要配一个经销商价值。** 本层把"管控"翻译成经销商能感知的价值: 撞单可申诉(公平)、考核可自查(透明)、返利可视(信任)。

```typescript
// 撞单申诉 (对应审计 D2/F12: 仲裁透明 + 申诉通道)
interface DuplicateAppeal {
  id: string;
  tenantId: string;
  duplicateCheckId: string;        // 关联撞单判定 (§3.3 DuplicateCheck)
  opportunityId: string;
  appellantOrgId: string;          // 申诉经销商
  appellantUserId: string;

  reason: string;
  evidence?: string[];             // 凭据 (合同/拜访记录/沟通截图)

  // === 仲裁凭证 (透明化, 消除"厂家偏袒"质疑) ===
  firstReportedAt?: string;        // 系统留存"谁先报"的权威时间戳
  competingOrgId?: string;         // 竞争方经销商

  status: 'submitted' | 'reviewing' | 'upheld' | 'rejected';  // 支持申诉 / 驳回
  arbitratedBy?: string;           // 销售管理部
  arbitrationNote?: string;        // 仲裁理由 (对双方可见)
  createdAt: string;
  updatedAt: string;
}

// 经销商健康分 (对应审计 D6/F12: 考核事先公示 + 可自查, 避免埋雷式扣分)
interface DealerHealthScore {
  id: string;                      // = `${dealerOrgId}:${period}`
  tenantId: string;
  dealerOrgId: string;
  period: string;                  // 结算周期 (如 2026-Q3)

  // === 各维度得分 (算法公开) ===
  reportComplianceScore: number;   // 回报合规率
  followUpTimelinessScore: number; // 跟进及时率
  winRateScore: number;            // 赢率
  maintenanceQualityScore: number; // 维保质量 (一次修复率/甲方满意度真值)
  qualificationComplianceScore: number; // 资质合规
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';

  // === 明细 (可自查, 知道扣在哪) ===
  breakdown: {
    metric: string;
    value: number;
    weight: number;
    deduction?: string;            // 扣分说明 (透明)
  }[];
  computedAt: string;
}
```

> **落地**:
> - **撞单申诉**: 撞单判定后经销商可发起 `DuplicateAppeal`, 系统附**"谁先报"时间戳凭证**; 销售管理部仲裁, 理由对双方可见; 支持/驳回留痕。消除"厂家偏袒"信任危机。
> - **健康分自查**: 经销商端"我的健康分"页, 算法与权重**事先公示**, 明细可下钻(扣在哪)。同一算法用于 §10.3 经销商考核排名, **考核=自查同源**, 无埋雷。
> - **返利可视**: 复用 §3.17 `RebateAccrual`, 经销商端实时看本组织返利计提进度与预计到账, 增强积极性。
> - **产品红线落地检查**: 每上一个管控功能, 必须回答"经销商从中得到什么"—— 报备→防撞单、回报→换保护期、资质→委托解药、考核→健康分自查、返利→透明可视。

### 3.22 业绩管理系统 (PerformanceTarget + DemandGen + KeyProductCampaign) — 管理闭环

> **设计理念**: 现有 §6.7/§10 分析体系是**描述性**的 (发生了什么), 业绩管理是**管控性**的 (目标是什么 → 实际跑成怎样 → 差距在哪 → 谁来扛)。区别 = **目标设定 + 实际 vs 目标对比 + 同比环比 + 归因**。对标 Salesforce Sales Cloud 的 Forecast + Quota Management、纷享销客的业绩目标管理、销售易的销售预测与目标分解。
>
> **核心闭环**: 目标分解 (区域 × 渠道 × 产品 × 经销商 × 周期) → 实际数据从商机/合同/交付自动汇总 → 达成率 + 同比 + 环比 + 差距归因 → 推送预警 + AI 经营建议。
>
> **与 §6.7 分析体系的区别**: 分析体系 = 实时查询, 不预聚合, 回答"现状是什么"; 业绩管理 = 周期性目标对标, 预聚合快照, 回答"目标达成了没有, 差多少, 为什么"。

#### 3.22.1 业绩目标 (PerformanceTarget)

```typescript
// lib/types/pms.ts

interface PerformanceTarget {
  id: string;
  tenantId: string;
  orgId?: string;               // 经销商组织 (channel 板块隔离)

  // 周期
  period: 'monthly' | 'quarterly' | 'yearly';
  periodLabel: string;          // e.g. "2026-Q3", "2026-08", "2026"

  // 分解维度 (至少一个, 支持多维度组合)
  dimensions: {
    region?: string;            // 区域 (华东/华南/华北/西南/西北/东北/华中)
    channel?: string;           // 渠道 (dealer_direct/dealer_secondary/service_partner/direct_project)
    productLine?: string;       // 产品线 (按 ProductItem.productModel 分组)
    keyProductId?: string;      // 主推产品 ID (关联 KeyProductCampaign)
    dealerOrgId?: string;       // 经销商组织
    salesPersonId?: string;     // 销售个人 (内部)
  };

  // 目标指标
  metrics: {
    reportCount: number;        // 报备数目标
    wonCount: number;           // 成交数目标
    wonAmount: number;          // 成交额目标 (元)
    pipelineAmount: number;     // 管道额目标 (在跟加权)
    newCustomerCount: number;   // 新客户数目标
    deliveryCount: number;      // 交付数目标
    demandGenCount: number;     // 线索开发数目标 (Demand Generation)
    demandGenConvertedCount: number; // 线索转化数目标
  };

  // 实际值 (由快照任务周期性回填, 非实时)
  actuals: {
    reportCount: number;
    wonCount: number;
    wonAmount: number;
    pipelineAmount: number;
    newCustomerCount: number;
    deliveryCount: number;
    demandGenCount: number;
    demandGenConvertedCount: number;
    snapshotAt: string;         // 最后快照时间
  };

  // 同比/环比 (由快照任务计算)
  comparisons: {
    yoy: {                      // 同比 (与去年同期对比)
      wonAmountChange: number;  // 同比增长率 %
      wonCountChange: number;
      reportCountChange: number;
    };
    mom: {                      // 环比 (与上一周期对比)
      wonAmountChange: number;
      wonCountChange: number;
      reportCountChange: number;
    };
    achievementRate: number;    // 达成率 % (actual.wonAmount / metrics.wonAmount * 100)
  };

  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

> **目标分解逻辑**: 销售管理部设定年度总目标 → 分解到季度 → 分解到区域 → 分解到经销商/产品线。支持自上而下 (top-down 指标分解) 和自下而上 (bottom-up 经销商上报, 汇总审核)。每条 `PerformanceTarget` 是一个维度组合的目标单元, 可聚合查询。
>
> **实际值回填**: 由四期定时任务 (§13) 从 `opportunities` + `contracts` + `delivery_orders` + `demand_gen_leads` 按维度聚合写入 `actuals`。非实时, 周期快照 (日/周)。

#### 3.22.2 线索开发 (DemandGenLead) — Demand Generation

```typescript
interface DemandGenLead {
  id: string;
  tenantId: string;
  orgId?: string;               // 经销商组织

  // 线索来源
  source: 'exhibition' | 'referral' | 'outbound_call' | 'digital_marketing'
       | 'industry_event' | 'government_lead' | 'design_institute' | 'other';
  sourceDetail?: string;        // 展会名称 / 推荐人 / 营销活动名

  // 线索信息
  customerName: string;
  contactPerson?: string;
  contactPhone?: string;
  projectDescription: string;
  region: string;
  estimatedAmount?: number;
  productInterest?: string[];   // 感兴趣的产品型号

  // 转化追踪
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'nurturing';
  convertedOpportunityId?: string;  // 转化为商机后的 Opportunity.id
  convertedAt?: string;

  // 归属
  assignedTo: string;           // 负责人 userId
  assignedOrgId?: string;       // 经销商组织
  regionManagerId?: string;     // 区域经理

  // 时限
  createdAt: string;
  firstContactDeadline?: string;  // 首次联系时限
  firstContactedAt?: string;

  // 丢单
  lostReason?: string;

  archivedAt?: string;
}
```

> **线索开发 ≠ 商机报备**: 线索是**报备前**的早期信号 (展会收集、推荐、外呼、数字营销), 尚未达到报备条件 (无明确项目、无现场勘测)。线索 → 跟进 → 合格 → 转化为商机报备 (写入 `Opportunity`)。线索开发管理回答: "市场活动带来了多少线索? 转化率多少? 哪个渠道的线索质量最高?"
>
> **与 §3.1 Opportunity 的关系**: `DemandGenLead.status = 'converted'` → 创建 `Opportunity` → `convertedOpportunityId` 关联。未转化的线索不进入 L2C 十阶段流, 但计入业绩管理的线索开发指标。

#### 3.22.3 主推产品 (KeyProductCampaign)

```typescript
interface KeyProductCampaign {
  id: string;
  tenantId: string;

  // 产品信息
  productModel: string;         // 主推产品型号
  productName: string;
  productLine: string;

  // 推广周期
  campaignName: string;
  startDate: string;
  endDate: string;

  // 推广目标
  targets: {
    reportCount: number;        // 目标报备数
    wonCount: number;           // 目标成交数
    wonAmount: number;          // 目标成交额
    regionTargets: {            // 分区域目标
      region: string;
      reportCount: number;
      wonAmount: number;
    }[];
  };

  // 推广策略
  strategy: {
    focusRegions: string[];     // 重点区域
    focusDealers: string[];     // 重点经销商 orgId
    pricingIncentive?: string;  // 价格激励 (关联 PriceApplication 特批)
    rebateBoost?: string;       // 返利加码 (关联 RebatePolicy)
    marketingMaterials?: string[]; // 营销资料 URL
  };

  // 实际进展 (快照回填)
  actuals: {
    reportCount: number;
    wonCount: number;
    wonAmount: number;
    byRegion: { region: string; reportCount: number; wonAmount: number }[];
    snapshotAt: string;
  };

  status: 'planned' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

> **主推产品 = 有组织的市场推广**: 不是所有产品平等卖, 管理层指定某型号/系列为"主推", 配套价格激励 + 返利加码 + 重点区域 + 重点经销商, 跟踪推广效果。回答: "主推产品推了三个月, 各区域卖了多少? 哪个经销商最积极? 达成率多少?"

#### 3.22.4 业绩对比分析 (Comparison Engine)

> **同比 (YoY, Year-over-Year)**: 同一维度组合, 本期 vs 去年同期。例如 2026-Q3 华东区域 vs 2025-Q3 华东区域。
>
> **环比 (MoM/QoQ, Period-over-Period)**: 本期 vs 上一周期。例如 2026-08 vs 2026-07 (月环比), 2026-Q3 vs 2026-Q2 (季环比)。
>
> **实际 vs 目标 (Actual vs Target)**: `actuals` / `metrics` → 达成率, 差距金额, 差距归因。
>
> **归因分析**: 达成率 < 80% 时, AI 辅助归因:
> - 按维度下钻: 哪个区域/经销商/产品线拖了后腿?
> - 按阶段定位: 是报备不足 (前端漏斗) 还是成交率低 (后端转化)?
> - 按线索来源: 哪个渠道线索转化率下降?
> - 与主推产品关联: 主推产品是否拉动了目标?
> - 与外部因素关联: 季节性、竞品活动、政策变化 (AI 提示, 非自动判定)

```typescript
// lib/pms/performance/comparison-engine.ts

interface ComparisonResult {
  // 基础
  period: string;
  dimensions: PerformanceTarget['dimensions'];

  // 实际 vs 目标
  achievement: {
    metric: string;             // wonAmount / reportCount / ...
    target: number;
    actual: number;
    achievementRate: number;    // %
    gap: number;                // actual - target (负 = 未达标)
    gapPercent: number;         // gap / target * 100
  }[];

  // 同比
  yoy: {
    metric: string;
    current: number;
    previous: number;           // 去年同期
    change: number;             // (current - previous) / previous * 100
    direction: 'up' | 'down' | 'flat';
  }[];

  // 环比
  mom: {
    metric: string;
    current: number;
    previous: number;           // 上一周期
    change: number;
    direction: 'up' | 'down' | 'flat';
  }[];

  // 下钻归因
  drillDown: {
    byRegion: DimensionAchievement[];
    byDealer: DimensionAchievement[];
    byProductLine: DimensionAchievement[];
    byChannel: DimensionAchievement[];
    byDemandGenSource: { source: string; leadCount: number; convertedCount: number; conversionRate: number }[];
  };

  // AI 归因建议
  aiAttribution?: {
    rootCauses: string[];       // 根因分析
    recommendations: string[];  // 改进建议
    forecast: {                 // 按当前趋势预测期末达成率
      projectedAchievement: number;
      confidence: number;
    };
  };
}

interface DimensionAchievement {
  name: string;
  target: number;
  actual: number;
  achievementRate: number;
  gap: number;
  contribution: number;         // 对总差距的贡献度 %
}
```

> **落地**: 对比引擎复用 §6.7 分析体系的即时查询能力 (按维度聚合), 叠加目标数据做差值计算。AI 归因复用 §8.8 AI 经营分析能力 (DeepSeek), 输入 = 对比结果 + 下钻数据, 输出 = 根因 + 建议 + 预测。

#### 3.22.5 业绩看板 (管理报表平台)

> **管理层视角**: 一个看板看全局 — 总目标达成率 + 同比环比 + 分区域热力图 + 主推产品进展 + 线索漏斗 + 经销商排名 + 预警。

```typescript
// lib/pms/performance/dashboard.ts

interface PerformanceDashboard {
  period: string;

  // 全局总览
  overview: {
    totalTargetAmount: number;
    totalActualAmount: number;
    achievementRate: number;
    yoyChange: number;          // 同比 %
    momChange: number;          // 环比 %
    status: 'on_track' | 'at_risk' | 'behind';  // ≥90% / 70-90% / <70%
  };

  // 分区域达成
  byRegion: {
    region: string;
    target: number;
    actual: number;
    achievementRate: number;
    yoy: number;
    mom: number;
    dealerCount: number;
    topDealer?: string;
  }[];

  // 分渠道达成
  byChannel: {
    channel: string;
    target: number;
    actual: number;
    achievementRate: number;
    conversionRate: number;
  }[];

  // 主推产品进展
  keyProducts: {
    campaignId: string;
    productName: string;
    target: number;
    actual: number;
    achievementRate: number;
    activeRegions: number;
    topRegion?: string;
  }[];

  // 线索开发漏斗
  demandGenFunnel: {
    totalLeads: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
    nurturing: number;
    conversionRate: number;     // converted / total
    bySource: { source: string; count: number; converted: number; rate: number }[];
  }[];

  // 经销商达成排名
  dealerRanking: {
    dealerOrgId: string;
    dealerName: string;
    target: number;
    actual: number;
    achievementRate: number;
    rank: number;
    yoy: number;
  }[];

  // 预警
  alerts: {
    level: 'red' | 'yellow';
    message: string;
    dimension: string;
    gap: number;
  }[];
}
```

> **权限**: 业绩目标设定 = 销售管理部 / Admin (内部域); 业绩看板 = 管理层 + 区域经理 (内部域); 经销商 = 仅看本组织达成 (channel 板块, orgId 隔离); 线索开发 = 分配负责人 + 区域经理可见。

---

## 四、KvStore 仓储注册

新增 28 个 collection (零 DDL 迁移):

| Collection | 类型 | 说明 |
|---|---|---|
| `pms_opportunities` | `Opportunity` | 商机报备 (核心实体) |
| `pms_follow_ups` | `FollowUpRecord` | 跟进记录 |
| `pms_duplicate_checks` | `DuplicateCheck` | 查重记录 |
| `pms_price_applications` | `PriceApplication` | 价格申请 |
| `pms_contracts` | `Contract` | 合同 |
| `pms_public_pool` | `PublicPoolEntry` | 公海池 |
| `pms_approvals` | `ApprovalRecord` | 审批记录 |
| `pms_alerts` | `AlertMessage` | 预警消息 (含分级推送/升级留痕) |
| `pms_notification_rules` | `NotificationRule` | 分级推送规则 (角色×渠道×SLA×升级) |
| `pms_delivery_orders` | `DeliveryOrder` | 交付履约工单 |
| `pms_delivery_tasks` | `DeliveryTask` | 交付任务 |
| `pms_acceptance_records` | `AcceptanceRecord` | 验收记录 |
| `pms_commissioning_records` | `CommissioningRecord` | 调试记录 |
| `pms_maintenance_records` | `MaintenanceRecord` | 维保记录 |
| `pms_dealer_orgs` | `DealerOrgProfile` | 经销商组织档案 (含资质) |
| `pms_dealer_qualifications` | `DealerQualification` | 经销商资质记录 (独立索引, 便于按资质类型查询) |
| `pms_service_assignments` | `ServiceProviderAssignment` | 服务商委托记录 |
| `pms_equipment_sns` | `EquipmentSN` | 设备 SN 码全生命周期档案 (含资产层级 父子SN) |
| `pms_equipment_telemetry` | `EquipmentTelemetry` | 设备 IoT 遥测/告警 (四期) |
| `pms_rebate_policies` | `RebatePolicy` | 渠道返利规则 (三期) |
| `pms_rebate_accruals` | `RebateAccrual` | 渠道返利计提/结算 (三期) |
| `pms_dealer_orders` | `DealerOrder` | 经销商在线订货单 (三期) |
| `pms_customer_feedback` | `CustomerFeedback` | 甲方免登录反馈 (扫码报修/满意度, 四期) |
| `pms_duplicate_appeals` | `DuplicateAppeal` | 撞单申诉 (仲裁凭证+透明化) |
| `pms_dealer_health_scores` | `DealerHealthScore` | 经销商健康分 (考核=自查同源) |
| `pms_performance_targets` | `PerformanceTarget` | 业绩目标 (区域×渠道×产品×经销商×周期分解) |
| `pms_demand_gen_leads` | `DemandGenLead` | 线索开发 (Demand Generation, 报备前早期线索) |
| `pms_key_product_campaigns` | `KeyProductCampaign` | 主推产品推广活动 (目标+策略+实际进展) |

注册位置: `lib/storage/repository.ts` + `lib/storage/memory-store.ts` + `lib/storage/drizzle-store.ts`

---

## 五、核心业务逻辑

### 5.1 智能查重 (五维度)

```typescript
// lib/pms/duplicate-check.ts

interface DuplicateScore {
  customerName: number;     // 0-25
  address: number;          // 0-25 (500米内)
  contactPhone: number;     // 0-20
  projectName: number;      // 0-15 (语义相似度)
  productOverlap: number;   // 0-15
  total: number;            // 0-100
  level: 'high' | 'medium' | 'low';
}

async function checkDuplicate(
  newOpportunity: Opportunity,
  existingOpportunities: Opportunity[],
  mapApi: 'gaode' | 'baidu'
): Promise<DuplicateScore[]> {

  // 1. 客户名称匹配 (0-25)
  //    - 精确匹配: 25
  //    - 包含关系: 15
  //    - 模糊匹配 (编辑距离): 5-10

  // 2. 项目地址匹配 (0-25)
  //    - 调用高德/百度地图 API 计算经纬度距离
  //    - 500米内: 25
  //    - 500-1000米: 15
  //    - 1000-2000米: 5

  // 3. 联系人电话匹配 (0-20)
  //    - 完全相同: 20
  //    - 同号不同格式: 15

  // 4. 项目名称语义相似度 (0-15)
  //    - 调用 AI (DeepSeek) 计算文本相似度
  //    - 或使用 TF-IDF / Jaccard

  // 5. 产品型号重叠度 (0-15)
  //    - Jaccard(modelSet_new, modelSet_existing) * 15

  // 判定:
  // total >= 60 → high → 自动拦截, 进撞单流程
  // total 40-59 → medium → 弹窗预警, 报备人确认或管理员审核
  // total 20-39 → low → 留存日志, 正常流转
  // total < 20 → 不记录
}
```

### 5.2 撞单处理流程

```
提交报备
  ↓
自动查重
  ├─ 无重复 → 正常审批流程
  ├─ 低概率 (20-39) → 留存日志, 正常流转
  ├─ 中概率 (40-59) → 弹窗预警 → 报备人确认 / 管理员审核
  └─ 高概率 (60+) → 自动拦截 → 进入撞单处理

撞单处理:
  ├─ 放弃 → 撤回报备 → 恢复开立状态 → 可删除
  └─ 质疑 → 填写质疑理由 + 上传佐证文件 → 提交销售管理部审核
       ├─ 审核通过 → 正常流转
       └─ 审核驳回 → 流程终止

撞单仲裁优先级 (多报备人同时质疑时):
  1. 报备时间优先 (先报备者得)
  2. 客户接触深度优先 (更多跟进记录)
  3. 客户书面指定优先 (客户出具指定函)
  4. 区域匹配优先 (属地经销商优先)
```

### 5.3 10 阶段标准化跟进 (经销商模式, 无回款)

```typescript
// lib/pms/stage-config.ts

const STAGE_CONFIG: Record<OpportunityStage, {
  name: string;
  nameEn: string;
  timeLimit: number;         // 停留时限 (天), 0 = 无限制
  entryCriteria: string;     // 准入条件
  exitCriteria: string;      // 准出条件
  nextStage: OpportunityStage | null;
}> = {
  report:      { name: '报备',  nameEn: 'Report',      timeLimit: 7,  entryCriteria: '商机报备审核通过', exitCriteria: '完成首次拜访记录', nextStage: 'visit' },
  visit:       { name: '拜访',  nameEn: 'Visit',       timeLimit: 30, entryCriteria: '报备阶段完成',     exitCriteria: '客户拜访完成, 需求确认', nextStage: 'solution' },
  solution:    { name: '方案',  nameEn: 'Solution',    timeLimit: 30, entryCriteria: '拜访阶段完成',     exitCriteria: '方案审核通过', nextStage: 'bidding' },
  bidding:     { name: '招标',  nameEn: 'Bidding',     timeLimit: 45, entryCriteria: '方案审核通过',     exitCriteria: '投标完成', nextStage: 'quotation' },
  quotation:   { name: '报价',  nameEn: 'Quotation',   timeLimit: 30, entryCriteria: '招标阶段完成',     exitCriteria: '报价单提交', nextStage: 'negotiation' },
  negotiation: { name: '谈判',  nameEn: 'Negotiation', timeLimit: 30, entryCriteria: '报价完成',         exitCriteria: '商务谈判完成', nextStage: 'contract' },
  contract:           { name: '签约',  nameEn: 'Contract',            timeLimit: 15, entryCriteria: '谈判完成',         exitCriteria: '经销商与终端客户签约, 报备瑞美', nextStage: 'equipment_delivery' },
  equipment_delivery: { name: '设备交付', nameEn: 'Equipment Delivery', timeLimit: 0,  entryCriteria: '合同报备生效',     exitCriteria: '瑞美设备交付经销商完成', nextStage: 'won' },
  won:                { name: '赢单',  nameEn: 'Won',                 timeLimit: 0,  entryCriteria: '设备交付完成',      exitCriteria: '经销商完成项目, 归档', nextStage: null },
  lost:               { name: '丢单',  nameEn: 'Lost',                timeLimit: 0,  entryCriteria: '任意阶段可转丢单', exitCriteria: '丢单归因归档', nextStage: null },
};
```

### 5.4 90 天核心管控规则

```
审批通过后开始计时:
  ↓
75天未跟进 → 推送预警 (销售 + 区域经理, 企微+邮件)
  ↓
90天未跟进 → 自动取消 (status='cancelled')
  ↓
7天恢复期 → 经销商可登录恢复 (cancelCount=1, 允许再次申请)
  ↓
二次超期 → 自动释放至公海池 (cancelCount=2, 不再接受申请)
  ↓
原经销商 30 天内不可认领
其他经销商可随时认领
认领后 72 小时保护期 → 禁止他人报备
认领人需完成首次跟进确认
```

### 5.5 价格审批分级

```
折扣 < 5%    → 区总审批 (price_regional)
折扣 5%-15%  → CMO 审批 (price_cmo)
折扣 > 15%   → CEO 审批 (price_ceo)

流程: 经销商客户经理 → 取价(获取标准价) → 填写扣点 → 自动计算提货价 → 提交审批
```

### 5.6 审批中心规则

| 审批类型 | 审批节点 | 触发条件 | 时限 |
|---|---|---|---|
| 报备审批 | 区域经理 | 所有项目报备 | 1 工作日 |
| 撞单审核 | 销售管理部 | 查重命中重复项目 | 1 工作日 |
| 大客户审批 | 大客户总监 | 预计金额 ≥ 50 万 | 1 工作日 |
| 方案审批 | 技术支持 | 所有项目方案 | 1 工作日 |
| 技术总监审批 | 技术总监 | 金额 ≥ 100 万或定制方案 | 1 工作日 |
| 价格审批 | 按折扣层级 | 申请额外折扣 | 1 工作日 |
| 合同审批 | 法务 + 财务 | 所有销售合同 | 1 工作日 |

超期处理: 自动升级提醒, 审批时效纳入绩效考核.

### 5.7 丢单归因体系

```
一级原因         二级原因
价格因素         价格过高 / 无法接受付款条件
产品因素         技术参数不满足 / 品牌知名度不足
服务因素         响应速度慢 / 售后服务承诺不足
客户因素         项目取消 / 客户指定供应商
内部因素         跟进不及时 / 方案错误
竞争因素         竞争对手低价 / 竞争对手关系深

流程: 丢单 → 强制填写 (日期+原因+竞品+价格+教训) → 区域经理审核 → 销售总监确认归档
```

### 5.8 公海池规则

```
进入条件:
  - 超期释放 (二次 90 天未跟进)
  - 主动放弃
  - 审核取消
  - 撞单失败

认领规则:
  - 原经销商 30 天内不可重新认领
  - 其他经销商可随时申请认领
  - 认领后 72 小时保护期 (禁止他人报备)
  - 认领人需完成首次跟进确认
```

### 5.9 设备交付闭环 (经销商模式)

```
经销商与终端客户签约 → 合同报备瑞美
  ↓ 自动创建 DeliveryOrder (stage='design_review')
  ↓
【瑞美执行】设计方案审批
  ├─ 瑞美技术部根据合同编制设备方案
  ├─ 技术总监审批 → 通过进入生产
  └─ 驳回 → 修改重提
  ↓
【瑞美执行】生产制造
  ├─ 生产预测 (从商机管道提前预知, §十.10.5)
  ├─ 生产订单生成 (合同生效自动触发)
  └─ 生产完成 → 发货
  ↓
【瑞美执行】发货物流 (厂家→经销商)
  ├─ 发货通知推送经销商 (企微/短信)
  ├─ 物流信息跟踪
  └─ 到达经销商收货地址
  ↓
【经销商执行】收货确认 (dealer_received)
  ├─ 设备到货验收 (AcceptanceRecord type='equipment_delivery')
  ├─ 型号/数量核对 vs 合同
  ├─ 破损/缺件记录 → 向瑞美发起补发请求
  └─ 确认收货 → 进入经销商施工阶段
  ↓
【经销商/服务商执行】施工安装 (dealer_installation, 经销商回报)
  ├─ 资质校验: 经销商需有 installation 资质, 无则委托服务商
  ├─ 经销商或服务商在终端客户现场施工
  ├─ 施工人员上传施工进度/照片
  ├─ 瑞美系统跟踪回报状态
  └─ 施工完成 → 回报
  ↓
【经销商/服务商执行】竣工验收 (dealer_acceptance, 回报)
  ├─ 资质校验: 需有 acceptance 资质, 无则委托服务商
  ├─ 经销商或服务商全项检查 (AcceptanceRecord type='dealer_final')
  ├─ 终端客户签字确认 (执行方上传)
  ├─ 遗留问题记录
  └─ 验收通过 → 调试
  ↓
【经销商/服务商执行】调试 (dealer_commissioning, 回报)
  ├─ 资质校验: 需有 commissioning 资质 (瑞美认证), 无则委托服务商
  ├─ 经销商或服务商执行调试 (CommissioningRecord)
  ├─ 瑞美技术支持可远程协助 (factorySupportId)
  ├─ 性能参数记录 (target vs actual)
  └─ 调试通过 → 移交终端客户
  ↓
【经销商执行】移交终端客户 (dealer_handover, 回报)
  ├─ 经销商培训终端客户操作人员
  ├─ 移交技术资料/操作手册
  ├─ 回报移交日期 → 维保起算
  └─ 进入维保期 (warrantyStartDate = 移交日)
  ↓
【经销商/服务商跟踪】维保期 (warranty)
  ├─ 资质校验: 需有 maintenance 资质 (瑞美认证), 无则委托服务商
  ├─ 经销商或服务商例行巡检 (按周期自动生成巡检提醒)
  ├─ 终端客户报修 → 经销商或服务商响应维修 (MaintenanceRecord)
  ├─ 厂家设备缺陷 → 向瑞美发起售后支持 (type='factory_support')
  ├─ 维保到期前 30 天预警 (通知经销商)
  ├─ 维保到期验收 (type='warranty_expiry', 回报)
  └─ 维保结束 → 项目完成归档 (stage='completed')
```

> **关键区别**:
> 1. 瑞美只执行 `设计方案→生产→发货` 三步, 后续全部由经销商或服务商执行并回报。
> 2. **不是所有经销商都能做调试验收和售后** — 需具备对应资质 (瑞美认证)。无资质的经销商需委托专业服务商。
> 3. 瑞美通过系统跟踪进度, 提供技术支持和售后保障, 并管控执行方资质合规性。

### 5.10 交付健康度算法

```typescript
// lib/pms/delivery-health.ts
// 交付健康度 = 绿/黄/红, 每日自动计算

// 红色 (严重):
//   - 厂家端阶段 (design/production/shipping) 超期 > 15 天
//   - 设备到货验收不合格 (deliveryAcceptanceResult='failed')
//   - 经销商/服务商回报问题未解决 (dealerProjectStatus='issue_reported' > 7 天)
//   - 经销商施工超期未回报 > 30 天
//   - 厂家设备缺陷未处理 (isFactoryDefect=true, 未发补发)
//   - 执行方资质缺失或已过期 (qualificationVerified=false, 禁止执行)

// 黄色 (预警):
//   - 厂家端阶段超期 1-15 天
//   - 到货验收条件通过 (conditional) 且遗留问题未清
//   - 经销商/服务商回报延迟 (计划日期已过但未回报)
//   - 维保期即将到期 (30 天内)
//   - 经销商项目暂停 (on_hold)
//   - 执行方资质即将过期 (60 天内)

// 绿色 (正常):
//   - 厂家端按计划推进
//   - 经销商按时回报, 进展正常
//   - 到货验收通过
//   - 维保期内无异常
```

---

## 六、API 设计

### 6.1 商机报备 API

```
# 报备 CRUD
GET    /api/pms/opportunities                # 列表 (?status=&stage=&reporterId=&q=)
POST   /api/pms/opportunities                # 创建报备
GET    /api/pms/opportunities/[id]           # 详情
PATCH  /api/pms/opportunities/[id]           # 更新
DELETE /api/pms/opportunities/[id]           # 软删除
POST   /api/pms/opportunities/[id]/submit    # 提交报备 (触发查重+审批)

# 查重
POST   /api/pms/opportunities/check-duplicate  # 手动查重 (提交前)
GET    /api/pms/opportunities/[id]/duplicates  # 查重记录

# 撞单处理
POST   /api/pms/opportunities/[id]/question   # 发起质疑
POST   /api/pms/opportunities/[id]/withdraw   # 撤回报备
POST   /api/pms/opportunities/[id]/arbitrate  # 仲裁 (销售管理部)

# 阶段推进
POST   /api/pms/opportunities/[id]/advance-stage  # 推进到下一阶段
GET    /api/pms/opportunities/[id]/stage-info     # 当前阶段信息+时限

# 跟进记录
GET    /api/pms/opportunities/[id]/follow-ups
POST   /api/pms/opportunities/[id]/follow-ups

# 成交/丢单
POST   /api/pms/opportunities/[id]/won         # 标记赢单
POST   /api/pms/opportunities/[id]/lost        # 标记丢单 (强制填归因)
```

### 6.2 价格申请 API

```
GET    /api/pms/price-applications             # 列表
POST   /api/pms/opportunities/[id]/price-app   # 创建价格申请
GET    /api/pms/price-applications/[id]
POST   /api/pms/price-applications/[id]/approve  # 审批通过
POST   /api/pms/price-applications/[id]/reject   # 审批驳回
POST   /api/pms/price-applications/[id]/get-price  # 取价 (获取标准价)
```

### 6.3 合同 API

```
GET    /api/pms/contracts                      # 列表
POST   /api/pms/opportunities/[id]/contract    # 创建合同
GET    /api/pms/contracts/[id]
PATCH  /api/pms/contracts/[id]
POST   /api/pms/contracts/[id]/approve         # 营管审核生效
POST   /api/pms/contracts/[id]/sync-b2b        # 同步至 B2B 商城
```

### 6.4 公海池 API

```
GET    /api/pms/public-pool                    # 公海池列表
POST   /api/pms/public-pool/[opportunityId]/claim  # 认领
POST   /api/pms/public-pool/[opportunityId]/confirm  # 认领确认 (首次跟进)
GET    /api/pms/public-pool/[opportunityId]/check-eligibility  # 认领资格检查
```

### 6.5 审批 API

```
GET    /api/pms/approvals                      # 待审批列表 (?type=&status=&approverId=)
POST   /api/pms/approvals/[id]/approve         # 审批通过
POST   /api/pms/approvals/[id]/reject          # 审批驳回
GET    /api/pms/approvals/overdue              # 超期审批列表
```

### 6.6 分级推送 API

```
GET    /api/pms/alerts                         # 预警消息列表 (?userId=&role=&type=&status=&escalationLevel=)
POST   /api/pms/alerts/[id]/read               # 标记已读
POST   /api/pms/alerts/[id]/ack                # 标记已处理 (acted, 阻断后续升级)
POST   /api/pms/alerts/scan                    # 触发预警扫描 (生成 AlertMessage, 按 NotificationRule 分发)
POST   /api/pms/alerts/escalate-scan           # 升级阶梯扫描 (SLA 超时未 acted → 升级 escalateToRole + 留痕; 定时任务)
GET    /api/pms/notification-rules             # 分级推送规则列表
POST   /api/pms/notification-rules             # 新建规则 (Admin/销售管理部)
PATCH  /api/pms/notification-rules/[id]        # 编辑规则 (角色/渠道/SLA/升级目标)
DELETE /api/pms/notification-rules/[id]        # 删除规则
```

### 6.7 分析体系 API

#### 6.7.1 即时分析 (实时查询, 不预聚合)

```
# 多维度即时筛选分析
GET    /api/pms/analytics/overview             # 全局总览 (在跟/成交/丢单/公海池数量+金额)
GET    /api/pms/analytics/funnel               # 漏斗转化 (11阶段各阶段数量+金额+转化率)
GET    /api/pms/analytics/by-region            # 区域维度分析
GET    /api/pms/analytics/by-customer          # 客户维度分析
GET    /api/pms/analytics/by-channel           # 渠道维度分析 (来源: inbound/outbound/referral/partner/event/existing)
GET    /api/pms/analytics/by-sales-org         # 销售组织维度分析 (经销商/区域/销售个人)
GET    /api/pms/analytics/by-product-line      # 产品线维度分析 (按产品型号分组)
GET    /api/pms/analytics/by-stage             # 项目阶段维度分析 (11阶段分布+停留时长)
GET    /api/pms/analytics/win-loss             # 赢丢单分析 (赢率/丢单原因/竞品分析)
GET    /api/pms/analytics/cycle-time           # 项目周期分析 (各阶段平均停留+总周期)
GET    /api/pms/analytics/conversion           # 转化率分析 (阶段间转化率+环比/同比)
```

#### 6.7.2 交叉分析 (二维矩阵)

```
GET    /api/pms/analytics/cross                # 交叉分析 (?dim1=region&dim2=product_line)
  # 支持任意两维度交叉: 区域×产品线, 区域×阶段, 客户×产品线, 渠道×阶段, 销售组织×产品线...
  # 返回: 矩阵数据 [{ dim1Value, dim2Value, count, amount, wonCount, wonAmount, winRate }]
```

#### 6.7.3 阶段总结 (周期性归档)

```
GET    /api/pms/analytics/period-summary       # 阶段总结 (?period=weekly|monthly|quarterly&from=&to=)
  # 返回: { period, totalReported, totalWon, totalLost, winRate, avgCycleDays,
  #         byRegion: [...], byProductLine: [...], byChannel: [...],
  #         topDealers: [...], lostReasons: [...], trend: [...] }

POST   /api/pms/analytics/period-summary/generate  # 生成阶段总结报告 (AI 辅助)
  # AI 汇总本期数据, 生成经营分析报告 (亮点/问题/建议)
```

#### 6.7.4 生产预测 (向生产端输出)

```
GET    /api/pms/forecast/production            # 生产订单预测
  # 参数: ?horizon=30|60|90 (天数) &productLine= &region=
  # 返回: [{ productModel, productName, expectedQty, expectedDate, confidence,
  #         sourceOpportunities: [{ id, reportName, stage, probability, estimatedAmount }] }]

GET    /api/pms/forecast/production/by-month   # 按月汇总生产预测
GET    /api/pms/forecast/production/by-region  # 按区域汇总生产预测
GET    /api/pms/forecast/production/by-product # 按产品型号汇总
GET    /api/pms/forecast/production/alerts     # 产能预警 (高概率大单集中交付期)
POST   /api/pms/forecast/production/push       # 推送预测到生产系统/ERP
```

### 6.8 交付履约 API

```
# 交付工单
GET    /api/pms/delivery-orders                # 列表 (?status=&stage=&dealerOrgId=&health=)
POST   /api/pms/delivery-orders                # 创建 (合同报备生效自动调用)
GET    /api/pms/delivery-orders/[id]           # 详情
PATCH  /api/pms/delivery-orders/[id]           # 更新
POST   /api/pms/delivery-orders/[id]/advance-stage  # 推进交付阶段 (厂家端)

# 经销商/服务商回报
POST   /api/pms/delivery-orders/[id]/dealer-report  # 回报 (施工/验收/调试/移交状态, 含资质校验)

# 交付任务
GET    /api/pms/delivery-orders/[id]/tasks     # 任务列表
POST   /api/pms/delivery-orders/[id]/tasks     # 创建任务
PATCH  /api/pms/delivery-tasks/[id]            # 更新任务
POST   /api/pms/delivery-tasks/[id]/complete   # 完成任务
POST   /api/pms/delivery-tasks/[id]/verify     # 验证任务

# 服务商委托
GET    /api/pms/delivery-orders/[id]/service-assignments   # 委托列表
POST   /api/pms/delivery-orders/[id]/service-assignments   # 委托服务商 (?type=commissioning/maintenance/...)
PATCH  /api/pms/service-assignments/[id]                     # 更新委托 (状态/人员)

# 验收 (经销商或服务商执行, 需有资质)
GET    /api/pms/delivery-orders/[id]/acceptances   # 验收记录列表
POST   /api/pms/delivery-orders/[id]/acceptances   # 创建验收记录 (需 acceptance 资质)
GET    /api/pms/acceptances/[id]                    # 验收详情
POST   /api/pms/acceptances/[id]/end-customer-sign  # 终端客户签字确认 (执行方上传)
POST   /api/pms/acceptances/[id]/issues/[issueId]/resolve  # 遗留问题处理

# 调试 (经销商或服务商执行, 需有 commissioning 资质)
GET    /api/pms/delivery-orders/[id]/commissionings  # 调试记录列表
POST   /api/pms/delivery-orders/[id]/commissionings  # 创建调试记录 (需 commissioning 资质)
GET    /api/pms/commissionings/[id]                   # 调试详情

# 维保 (经销商或服务商执行, 需有 maintenance 资质, 厂家支持)
GET    /api/pms/delivery-orders/[id]/maintenance     # 维保记录列表
POST   /api/pms/delivery-orders/[id]/maintenance     # 创建维保/报修记录 (需 maintenance 资质)
GET    /api/pms/maintenance/[id]                      # 维保详情
POST   /api/pms/maintenance/[id]/complete             # 完成维保
POST   /api/pms/maintenance/[id]/end-customer-feedback  # 终端客户反馈 (执行方收集)
POST   /api/pms/maintenance/[id]/factory-support       # 升级为厂家售后支持

# 交付健康度
GET    /api/pms/delivery-orders/[id]/health           # 交付健康度
GET    /api/pms/delivery/health-overview              # 全部交付健康度总览

# 维保预警
GET    /api/pms/maintenance/alerts                    # 维保到期预警列表
GET    /api/pms/maintenance/expiring                  # 即将到期维保列表
```

### 6.8.1 经销商账号与资质管理 API

```
# 经销商组织管理 (瑞美 Admin)
GET    /api/pms/dealer-orgs                    # 经销商组织列表 (?level=&region=&status=)
POST   /api/pms/dealer-orgs                    # 创建经销商组织 (联动 createDownstreamOrg)
GET    /api/pms/dealer-orgs/[id]               # 经销商组织详情 (含资质)
PATCH  /api/pms/dealer-orgs/[id]               # 更新经销商信息
POST   /api/pms/dealer-orgs/[id]/suspend       # 停用经销商
POST   /api/pms/dealer-orgs/[id]/reactivate    # 恢复经销商

# 经销商成员管理
GET    /api/pms/dealer-orgs/[id]/members        # 成员列表
POST   /api/pms/dealer-orgs/[id]/invite         # 邀请成员 (联动 inviteDownstreamMember, 返回邀请码)
PATCH  /api/pms/dealer-members/[userId]         # 更新成员角色/状态

# 资质管理
GET    /api/pms/dealer-orgs/[id]/qualifications        # 资质列表
POST   /api/pms/dealer-orgs/[id]/qualifications        # 提交资质申请 (经销商)
GET    /api/pms/qualifications/[id]                     # 资质详情
POST   /api/pms/qualifications/[id]/approve             # 审批通过 (瑞美技术支持)
POST   /api/pms/qualifications/[id]/reject              # 驳回
POST   /api/pms/qualifications/[id]/revoke              # 撤销资质

# 资质查询 (交付执行时校验)
GET    /api/pms/qualifications/check?orgId=&type=       # 校验组织是否具备某项资质```

### 6.9 YS 系统同步 API

```
POST   /api/pms/ys/sync                        # 手动触发 YS 数据同步
GET    /api/pms/ys/sync-status                 # 同步状态
POST   /api/pms/ys/push-contract               # 推送合同到 YS/B2B
```

### 6.10 业绩管理 API

```
# 业绩目标 CRUD (销售管理部/Admin)
GET    /api/pms/performance/targets            # 目标列表 (?period=&region=&channel=&productLine=&dealerOrgId=&status=)
POST   /api/pms/performance/targets            # 新建目标 (支持批量分解)
PATCH  /api/pms/performance/targets/[id]       # 编辑目标
DELETE /api/pms/performance/targets/[id]       # 删除目标 (软删)
POST   /api/pms/performance/targets/batch      # 批量分解 (年度→季度→区域)
GET    /api/pms/performance/targets/summary    # 目标汇总 (?period= 聚合各维度)

# 业绩对比分析
GET    /api/pms/performance/comparison         # 对比分析 (?period=&region=&channel=&productLine=&dealerOrgId=)
  # 返回 ComparisonResult: 实际vs目标 + 同比 + 环比 + 下钻归因
GET    /api/pms/performance/comparison/yoy     # 同比专项 (?period=&dimension=)
GET    /api/pms/performance/comparison/mom     # 环比专项 (?period=&dimension=)
POST   /api/pms/performance/comparison/ai-attribution  # AI 归因分析 (DeepSeek)

# 业绩看板 (管理报表平台)
GET    /api/pms/performance/dashboard          # 业绩看板 (?period=)
  # 返回 PerformanceDashboard: 总览+分区域+分渠道+主推产品+线索漏斗+经销商排名+预警

# 快照任务 (定时回填实际值)
POST   /api/pms/performance/snapshot           # 手动触发快照 (Admin)
GET    /api/pms/performance/snapshot/status    # 快照状态 (最后执行时间/状态)

# 线索开发 (Demand Generation)
GET    /api/pms/demand-gen/leads               # 线索列表 (?status=&source=&region=&assignedTo=&orgId=)
POST   /api/pms/demand-gen/leads               # 新建线索
GET    /api/pms/demand-gen/leads/[id]          # 线索详情
PATCH  /api/pms/demand-gen/leads/[id]          # 更新线索 (状态流转/补充信息)
POST   /api/pms/demand-gen/leads/[id]/convert  # 转化为商机 (创建 Opportunity, 关联 convertedOpportunityId)
POST   /api/pms/demand-gen/leads/[id]/lost     # 标记线索丢失 (填 lostReason)
GET    /api/pms/demand-gen/funnel              # 线索漏斗 (?period=&source=)
GET    /api/pms/demand-gen/by-source           # 按来源分析 (转化率/金额)

# 主推产品 (KeyProductCampaign)
GET    /api/pms/key-products                   # 主推产品活动列表 (?status=)
POST   /api/pms/key-products                   # 新建主推活动 (Admin/销售管理部)
GET    /api/pms/key-products/[id]              # 活动详情 (含实际进展)
PATCH  /api/pms/key-products/[id]              # 编辑活动
POST   /api/pms/key-products/[id]/activate     # 启动活动
POST   /api/pms/key-products/[id]/complete     # 结束活动
GET    /api/pms/key-products/[id]/progress     # 分区域/经销商进展明细
```

---

## 七、页面结构

### 7.1 导航模块

```typescript
// 新增到 components/nav-modules.ts
{
  id: 'pms',
  label: '产研销',
  fullLabel: '产研销 · 商机报备管理',
  tagline: '从报备到成交的全生命周期管控',
  icon: Store,
  visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner', 'partner'],
  pathPrefixes: ['/pms'],
  items: [
    { name: '商机看板',     href: '/pms',              icon: Grid3x3,      group: '商机管理' },
    { name: '商机列表',     href: '/pms/list',         icon: ListChecks,   group: '商机管理' },
    { name: '新建报备',     href: '/pms/new',          icon: Plus,         group: '商机管理', accent: 'cta' },
    { name: '公海池',       href: '/pms/public-pool',  icon: Store,        group: '资源管理' },
    { name: '经销商管理',   href: '/pms/dealers',      icon: Building2,    group: '资源管理' },
    { name: '交付看板',     href: '/pms/delivery',    icon: Truck,        group: '交付履约' },
    { name: '交付工单',     href: '/pms/delivery/list', icon: ListChecks, group: '交付履约' },
    { name: '维保中心',     href: '/pms/maintenance', icon: Wrench,       group: '交付履约' },
    { name: '审批中心',     href: '/pms/approvals',    icon: ClipboardCheck, group: '审批管理' },
    { name: '预警消息',     href: '/pms/alerts',       icon: Bell,         group: '审批管理' },
    { name: '数据驾驶舱',   href: '/pms/analytics',    icon: BarChart3,    group: '数据分析', accent: 'cta' },
    { name: '赢丢单分析',   href: '/pms/analytics/win-loss', icon: BarChart3, group: '数据分析' },
    { name: '交叉分析',     href: '/pms/analytics/cross', icon: Grid3x3,  group: '数据分析' },
    { name: '阶段总结',     href: '/pms/analytics/summary',icon: FileText, group: '数据分析' },
    { name: '生产预测',     href: '/pms/forecast',     icon: TrendingUp,   group: '生产协同' },
    { name: '业绩看板',     href: '/pms/performance',  icon: Target,       group: '业绩管理', accent: 'cta' },
    { name: '目标管理',     href: '/pms/performance/targets', icon: Target, group: '业绩管理' },
    { name: '对比分析',     href: '/pms/performance/comparison', icon: GitCompare, group: '业绩管理' },
    { name: '线索开发',     href: '/pms/demand-gen',    icon: Sparkles,     group: '业绩管理' },
    { name: '主推产品',     href: '/pms/key-products', icon: Rocket,       group: '业绩管理' },
  ],
}
```

### 7.2 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| `/pms` | 商机看板 | Kanban 按 stage 分列, 卡片显示客户/金额/报备人/剩余天数 |
| `/pms/list` | 商机列表 | 表格视图, 支持筛选/排序/导出 |
| `/pms/new` | 新建报备 | 表单录入 (客户/地址/联系人/产品明细/附件) + 实时查重 |
| `/pms/[id]` | 商机详情 | Tab: 基本信息/跟进记录/查重记录/价格申请/合同/审批/公海池 |
| `/pms/[id]/follow-up` | 新增跟进 | 跟进记录录入 (类型/内容/对接人/地点/竞品/附件) |
| `/pms/public-pool` | 公海池 | 可认领项目列表, 认领按钮, 保护期倒计时 |
| `/pms/dealers` | 经销商管理 | 经销商组织列表 (一级/二级), 资质状态, 成员数, 搜索/筛选 |
| `/pms/dealers/[id]` | 经销商详情 | Tab: 基本信息/成员列表/资质管理/报备记录/交付记录 |
| `/pms/dealers/[id]/qualifications` | 资质审批 | 资质申请列表, 审批/驳回/撤销, 技术人员关联 |
| `/pms/delivery` | 交付看板 | 按交付阶段分列 Kanban (厂家端+经销商端), 健康度颜色标识, 超期标红 |
| `/pms/delivery/list` | 交付工单列表 | 表格视图, 按阶段/健康度/经销商筛选 |
| `/pms/delivery/[id]` | 交付工单详情 | Tab: 基本信息/任务列表/验收记录/调试记录/维保记录/经销商回报/时间线 |
| `/pms/delivery/[id]/dealer-report` | 经销商回报 | 经销商回报施工/验收/调试/移交状态 (移动端优先) |
| `/pms/delivery/[id]/acceptance` | 新增验收 | 验收表单 (检查项/评分/遗留问题/终端客户签字) |
| `/pms/delivery/[id]/commissioning` | 新增调试 | 调试表单 (调试项/性能参数/结果) |
| `/pms/maintenance` | 维保中心 | 维保工单列表, 经销商报修入口, 维保到期预警, 经销商维保质量看板 |
| `/pms/approvals` | 审批中心 | 待审批列表, 批量审批, 超期标红 |
| `/pms/alerts` | 预警消息 | 预警列表, 按类型/严重度筛选 |
| `/pms/analytics` | 数据驾驶舱 | 全局总览 + 8 维度即时分析 (区域/客户/渠道/销售组织/经销商层级/产品线/阶段/赢丢单) |
| `/pms/analytics/win-loss` | 赢丢单分析 | 赢率趋势 + 丢单原因分布 + 竞品分析 + 明细下钻 |
| `/pms/analytics/cross` | 交叉分析 | 二维矩阵热力图 (任意两维度交叉) |
| `/pms/analytics/summary` | 阶段总结 | 周/月/季总结报告 + AI 经营分析报告 |
| `/pms/forecast` | 生产预测 | 生产订单预测看板 (按月/区域/产品型号) + 产能预警 |
| `/pms/performance` | 业绩看板 | 管理报表平台: 总目标达成率+同比环比+分区域热力图+主推产品+线索漏斗+经销商排名+预警 |
| `/pms/performance/targets` | 目标管理 | 目标列表+新建/编辑+批量分解 (年度→季度→区域→经销商) |
| `/pms/performance/comparison` | 对比分析 | 实际vs目标+同比+环比+下钻归因+AI归因建议 |
| `/pms/demand-gen` | 线索开发 | 线索列表+漏斗看板+按来源转化率+新建线索 |
| `/pms/demand-gen/[id]` | 线索详情 | 线索信息+跟进记录+转化为商机 |
| `/pms/key-products` | 主推产品 | 主推活动列表+推广进展+达成率 |
| `/pms/key-products/[id]` | 主推产品详情 | 活动详情+分区域进展+经销商参与+策略配置 |

---

## 八、AI 增强 (Tandem 独有)

### 8.1 智能查重 (AI 辅助)

```typescript
// lib/pms/ai-duplicate-check.ts
// 项目名称语义相似度: 调用 DeepSeek 计算文本相似度
// 示例: "成都市新都区香城小学学生宿舍热水系统" vs "成都新都香城小学宿舍热水" → 0.92

async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  // 使用 DeepSeek embedding or text comparison
  // 返回 0-1 的相似度分数
}
```

### 8.2 项目真实性验证

```typescript
// lib/pms/reality-check.ts
// 判断项目真实性:
// 1. 详细地址 vs 地图定位是否一致 (调用地图 API)
// 2. 是否有实拍拜访照片 (附件检查)
// 3. 项目是否在地图上可搜到
// 4. 报备地址 vs 地图搜索地址是否一致
```

### 8.3 丢单归因分析

```typescript
// lib/pms/ai-loss-analysis.ts
// AI 辅助归因:
// 1. 分析跟进记录, 识别可能的丢单信号 (响应慢/价格争议/竞品出现)
// 2. 对比赢单项目特征, 找出差异因素
// 3. 生成丢单分析报告 + 改进建议
// 4. 沉淀到组织 Memory (经审批)
```

### 8.4 阶段超期预警

```typescript
// lib/pms/perception.ts
// 复用 Tandem 中央 AI 感知 pass:
// 1. 定期扫描所有 active 商机
// 2. 检测阶段超时 + 90 天管控
// 3. 生成预警 → 推送 IM/企微/邮件
// 4. red 级别 → BossAI 推送管理层
```

### 8.5 AI 经营分析报告

```typescript
// lib/pms/ai-period-report.ts
// 周/月/季阶段总结, AI 自动生成经营分析报告:
// 1. 数据汇总: 报备数/成交数/丢单数/赢率/平均周期/总金额
// 2. 亮点识别: 哪些区域/产品线/经销商表现突出
// 3. 问题诊断: 哪些阶段转化率低/哪些区域赢率低/哪些产品线丢单多
// 4. 趋势分析: 环比/同比变化, 上升/下降趋势
// 5. 改进建议: 基于丢单归因 + 阶段瓶颈, 给出具体行动建议
// 6. 下期预测: 基于管道内商机, 预测下期成交金额+产品需求
```

### 8.6 AI 生产预测辅助

```typescript
// lib/pms/ai-production-forecast.ts
// 基于商机管道预测生产订单:
// 1. 提取所有活跃商机 (stage != won/lost) 的产品明细
// 2. 按阶段概率加权: report(10%) → visit(20%) → solution(40%) → bidding(60%) → quotation(70%) → negotiation(80%) → contract(95%) → equipment_delivery(100%)
//    (无 payment 阶段 — 经销商模式, 瑞美不收款)
// 3. 按预计成交时间聚类 (estimatedCloseDate → 月份)
// 4. 按产品型号汇总: 预计数量 = sum(qty * stageProbability)
// 5. 置信度分级: 高(≥70%) / 中(40-69%) / 低(<40%)
// 6. 产能预警: 高置信度大单集中月份 → 提前预警生产排产
// 7. 历史校准: 用过去 6 个月实际成交率校准概率权重
```

### 8.7 AI 交付风险预警

```typescript
// lib/pms/ai-delivery-risk.ts
// 复用 Tandem 中央 AI 感知 pass, 监控设备交付全链路:
// 1. 厂家端阶段超期: 设计/生产/发货 超阈值 → 预警
// 2. 经销商/服务商回报延迟: 计划日期已过但未回报 → 提醒执行方
// 3. 到货验收异常: 破损/缺件/型号不符 → 自动发起补发流程
// 4. 经销商项目停滞: dealerProjectStatus 长时间无更新 → 预警
// 5. 维保趋势分析: 故障频次/类别趋势 → 预测设备可靠性下降
// 6. 资质合规预警: 执行方资质缺失/即将过期 → 红色禁止执行 + 通知经销商委托服务商
// 7. 交付健康度自动评级: 综合 6 项 → green/yellow/red
// 8. red 级别 → BossAI 推送管理层 + 企微通知生产/发货负责人
```

### 8.8 AI 售后支持辅助

```typescript
// lib/pms/ai-maintenance-assistant.ts
// 经销商模式: 瑞美为经销商提供售后技术支持辅助
// 1. 故障诊断辅助: 执行方报修描述 → AI 匹配历史故障库 → 推荐排查步骤
// 2. 厂家缺陷识别: 故障模式聚类 → 判断是否批量设备缺陷 → 预警召回
// 3. 备件预测: 基于设备型号+使用年限+故障趋势 → 预测备件需求
// 4. 售后费用判定: isFactoryDefect 辅助判定 → 厂家承担 vs 经销商/服务商承担
// 5. 维保报告自动生成: 维修记录 → AI 生成结构化售后报告
// 6. 维保质量评估: 各经销商/服务商维保响应速度/客户满意度/一次修复率排名
// 7. 维保知识沉淀: 维修经验自动归档到组织 Memory (经审批)
// 8. 资质匹配推荐: 经销商无资质时, AI 推荐合适的服务商 (基于区域+资质+历史评价)
```

---

## 九、外部系统集成

### 9.1 企微集成

| 场景 | 方式 |
|---|---|
| 审批通知 | 企微应用消息推送 |
| 预警提醒 | 企微群机器人 / 应用消息 |
| 阶段变更通知 | 企微应用消息 |
| 移动端审批 | 企微 H5 页面 |
| 移动端跟进 | 企微 H5 / 小程序 |
| 交付阶段变更 | 企微通知经销商/服务商 (发货/到货) + 瑞美生产负责人 |
| 验收通知 | 企微通知经销商收货确认 |
| 经销商/服务商回报提醒 | 超期未回报施工/验收/调试进度 → 企微提醒执行方 |
| 维保报修 | 经销商/终端客户通过企微报修 → 推送经销商或服务商维修人员 |
| 维保到期预警 | 企微通知经销商/服务商 + 瑞美售后对接人 |
| 厂家售后支持 | 经销商/服务商发起 factory_support → 企微通知瑞美售后团队 |
| 资质到期预警 | 企微通知经销商管理员 + 瑞美技术支持 (提前60天) |
| 服务商委托通知 | 企微通知服务商 (被委托) + 经销商 (委托确认) |

### 9.2 地图 API (高德/百度)

| 场景 | 方式 |
|---|---|
| 地址解析 | 地理编码 API (地址 → 经纬度) |
| 项目间距 | 距离计算 API |
| 查重辅助 | 500 米内项目匹配 |
| 地图展示 | 前端地图组件标注项目位置 |

### 9.3 YS 系统对接

| 场景 | 方式 |
|---|---|
| 数据同步 | 定时/事件触发同步 |
| 合同推送 | API 推送生效合同到 YS/B2B |
| 数据导入 | 历史项目批量导入 |
| 降级方案 | YS 接口不稳定时支持手动导入 |

### 9.4 小程序端

| 场景 | 说明 |
|---|---|
| 报备录入 | 简化表单, 支持拍照上传 |
| 跟进记录 | 移动端快速录入 |
| 审批处理 | 移动端一键审批 |
| 预警查看 | 推送通知直接跳转 |

### 9.5 生产系统/ERP 对接

| 场景 | 方式 |
|---|---|
| 生产预测推送 | API 推送预测订单 (按月/产品型号) |
| 产能预警 | 高置信度大单集中交付期 → 提前通知生产排产 |
| 实际订单回写 | 合同生效后自动推送生产系统 |
| 库存联动 | 预测产品需求 vs 当前库存 → 备货建议 |
| **SN 码赋码同步** | 生产系统/MES 通过 API 推送 SN 码赋码信息 (SN 码+产品型号+生产批次+质检结果) → PMS 创建 `EquipmentSN` 记录 |
| **SN 码入库同步** | WMS 入库后推送 SN 状态 `in_stock` → PMS 更新 `lifecycleStatus` |
| **SN 码发货绑定** | 发货时将 SN 码绑定到 `DeliveryOrder` → PMS 更新 `lifecycleStatus='shipped'` + 关联经销商/终端客户 |
| **SN 码安装回报** | 经销商回报安装完成 → PMS 更新 `lifecycleStatus='installed'` + `installDate` |
| **SN 码质保启动** | 经销商回报移交 → PMS 更新 `warrantyStartDate/warrantyEndDate` + `lifecycleStatus='in_use'` |
| **SN 码维修关联** | 维保记录创建时关联 SN 码 → PMS 更新 `maintenanceRecordIds` + `partsReplaced` |
| **SN 码精准召回** | 生产系统发现批次缺陷 → 推送召回指令 → PMS 按 `productionBatchId` 查询受影响 SN 码 → 企微通知经销商/服务商 |
| **SN 码正反向追溯** | API: 正向 (批次→SN→客户) / 反向 (SN→批次→质检) / 单品全链路 (SN→全生命周期) |

### 9.6 SN 码与售后系统打通方案

> **核心原则**: 以 SN 码 (`EquipmentSN.snCode`) 为唯一主键, 串联生产→交付→安装→维保全链路, 实现跨系统数据互通。

```
┌─────────────────────────────────────────────────────────────────────┐
│                  SN 码全生命周期数据流                                 │
│                                                                      │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐   │
│  │ 生产系统  │────→│  PMS     │────→│ 交付工单  │────→│ 经销商   │   │
│  │ (MES/ERP)│     │ EquipmentSN│   │ DeliveryOrder│  │ 回报     │   │
│  │ 赋码+质检 │     │ 创建记录  │     │ 绑定SN   │     │ 安装/调试 │   │
│  └──────────┘     └────┬─────┘     └──────────┘     └────┬─────┘   │
│                        │                                  │        │
│                   ┌────┴────────────────────────────────┴────┐    │
│                   │         维保系统 (MaintenanceRecord)       │    │
│                   │  报修 → SN 校验 → 质保判定 → 维修 → 零件替换 │    │
│                   └────┬─────────────────────────────────────┘    │
│                        │                                           │
│                   ┌────┴─────────────────────────────────────┐    │
│                   │         售后分析 (EquipmentSN)              │    │
│                   │  故障频次/批次缺陷/召回范围/质保成本/可靠性  │    │
│                   └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

| 对接系统 | 数据流向 | 接口方式 | 关键字段 |
|---|---|---|---|
| **生产系统 (MES)** | MES → PMS | REST API 推送 (生产赋码事件) | `snCode`, `productModel`, `productionBatchId`, `productionOrderId`, `qcResult` |
| **仓储系统 (WMS)** | WMS → PMS | REST API 推送 (入库/出库事件) | `snCode`, `lifecycleStatus`, `stockLocation` |
| **交付工单 (PMS 内部)** | DeliveryOrder → EquipmentSN | 内部关联 (发货时绑定) | `deliveryOrderId`, `dealerOrgId`, `endCustomerId` |
| **维保系统 (PMS 内部)** | MaintenanceRecord → EquipmentSN | 内部关联 (报修时校验) | `snCode`, `warrantyStatus`, `partsReplaced` |
| **售后分析 (PMS 内部)** | EquipmentSN → Analytics | 内部查询 (BI 报表) | `productionBatchId`, `totalMaintenanceCount`, `isRecalled` |
| **召回管理** | 生产系统 → PMS → 经销商 | API 推送召回指令 + 企微通知 | `productionBatchId`, `recallBatchId`, `isRecalled` |

> **降级方案**: 生产系统/MES 暂未对接时, 支持手动导入 SN 码 (CSV/Excel), 经销商发货时手动绑定。后续 API 对接后切换为自动同步。

---

## 十、分析体系设计 (核心)

### 10.1 八大分析维度

| 维度 | 数据来源 | 分析内容 | 图表类型 |
|---|---|---|---|
| **区域** | `opportunity.reportRegion` | 各区域报备数/成交额/赢率/平均周期/丢单率 | 地图热力图 + 柱状图 |
| **客户** | `opportunity.customerId` | 客户贡献排名/复购率/商用vs科技住宅对比/客户生命周期 | 客户矩阵 + 雷达图 |
| **渠道** | `opportunity.source` | 各来源渠道(inbound/outbound/referral/partner/event/existing)转化率/ROI | 漏斗图 + 饼图 |
| **销售组织** | `opportunity.reporterId` / `reporterOrgId` | 经销商排名/区域经理业绩/个人销售排名/组织赢率对比 | 排行榜 + 柱状图 |
| **经销商层级** | `opportunity.dealerLevel` / `primaryDealerOrgId` | 一级/二级经销商报备量/成交额/赢率/周期对比 | 对比柱状图 + 饼图 |
| **产品线** | `opportunity.productItems[].productModel` | 产品型号报备量/成交量/金额占比/趋势/库存联动 | 帕累托图 + 趋势线 |
| **项目阶段** | `opportunity.stage` | 10 阶段分布/各阶段停留时长/阶段转化率/瓶颈识别 | 漏斗图 + 箱线图 |
| **赢丢单** | `opportunity.status` (won/lost) | 赢率趋势/丢单原因分布/竞品分析/赢单特征对比 | 玫瑰图 + 对比表 |

### 10.2 即时分析 (实时查询)

```typescript
// lib/pms/analytics/query-engine.ts

interface AnalyticsQuery {
  dimensions: AnalyticsDimension[];   // 分组维度
  metrics: AnalyticsMetric[];         // 度量指标
  filters?: AnalyticsFilter[];        // 过滤条件
  dateRange?: { from: string; to: string };
  granularity?: 'day' | 'week' | 'month' | 'quarter';
}

type AnalyticsDimension =
  | 'region'           // 区域
  | 'customer'         // 客户
  | 'customer_suffix'  // 商用/科技住宅
  | 'channel'          // 渠道 (source)
  | 'sales_org'        // 销售组织 (经销商, 区分一级/二级)
  | 'dealer_level'     // 经销商层级 (一级/二级)
  | 'sales_person'     // 销售个人
  | 'product_line'     // 产品线 (产品型号)
  | 'stage'            // 项目阶段
  | 'status'           // 状态 (won/lost/active)
  | 'lost_reason'      // 丢单原因
  | 'competitor';      // 竞品

type AnalyticsMetric =
  | 'count'            // 商机数
  | 'amount'           // 金额
  | 'won_count'        // 成交数
  | 'won_amount'       // 成交额
  | 'lost_count'       // 丢单数
  | 'win_rate'         // 赢率 = won / (won + lost)
  | 'avg_cycle_days'   // 平均周期
  | 'avg_stage_days'   // 平均阶段停留
  | 'conversion_rate'  // 转化率
  | 'forecast_amount'; // 预测金额 (加权)

// 经销商专属指标 (在 sales_org / dealer_level 维度下展示)
//   - dealer_active_count: 活跃经销商数
//   - dealer_win_rate: 经销商赢率
//   - dealer_avg_cycle: 经销商平均项目周期
//   - secondary_dealer_ratio: 二级经销商报备占比
//   - dealer_delivery_on_time: 经销商收货及时率
//   - dealer_report_compliance: 经销商回报合规率 (按时回报施工/验收/调试)
//   - dealer_maintenance_satisfaction: 经销商维保客户满意度

// 示例: 查询「各区域×各产品线」的成交额和赢率
// query = {
//   dimensions: ['region', 'product_line'],
//   metrics: ['count', 'won_count', 'won_amount', 'win_rate'],
//   filters: [{ field: 'status', op: 'in', value: ['won', 'lost'] }],
//   dateRange: { from: '2026-01-01', to: '2026-06-30' }
// }
```

### 10.3 交叉分析矩阵

```typescript
// lib/pms/analytics/cross-matrix.ts

// 任意两维度交叉, 返回矩阵数据
interface CrossMatrix {
  dim1: AnalyticsDimension;
  dim2: AnalyticsDimension;
  rows: string[];                    // dim1 值列表
  cols: string[];                    // dim2 值列表
  cells: CrossCell[][];              // [row][col]
  rowTotals: CrossCell[];
  colTotals: CrossCell[];
}

interface CrossCell {
  count: number;
  amount: number;
  wonCount: number;
  wonAmount: number;
  winRate: number;
}

// 常用交叉组合:
// 区域 × 产品线     → 各区域各产品线业绩
// 区域 × 阶段       → 各区域管道分布
// 客户 × 产品线     → 各客户产品偏好
// 渠道 × 阶段       → 各渠道转化效率
// 销售组织 × 产品线 → 各经销商产品能力
// 销售组织 × 阶段   → 各经销商管道健康度
// 产品线 × 阶段     → 各产品线管道分布
// 区域 × 丢单原因   → 各区域主要丢单原因
```

### 10.4 阶段总结 (周期报告)

```typescript
// lib/pms/analytics/period-summary.ts

interface PeriodSummary {
  period: 'weekly' | 'monthly' | 'quarterly';
  dateRange: { from: string; to: string };

  // 总览
  overview: {
    totalReported: number;       // 本期报备数
    totalWon: number;            // 本期成交数
    totalLost: number;           // 本期丢单数
    totalAmount: number;         // 本期报备总额
    wonAmount: number;           // 本期成交总额
    winRate: number;             // 赢率
    avgCycleDays: number;        // 平均周期
    activeCount: number;         // 在跟数量
    pipelineAmount: number;      // 管道金额 (在跟商机加权)
  };

  // 环比/同比
  trend: {
    reportCountChange: number;   // 报备数环比 %
    wonAmountChange: number;     // 成交额环比 %
    winRateChange: number;       // 赢率环比 pp
    cycleDaysChange: number;     // 周期变化天数
  };

  // 分维度
  byRegion: DimensionSummary[];
  byProductLine: DimensionSummary[];
  byChannel: DimensionSummary[];
  bySalesOrg: DimensionSummary[];

  // 丢单分析
  lostAnalysis: {
    byReason: { reason: string; count: number; amount: number }[];
    byCompetitor: { competitor: string; count: number; amount: number }[];
    topLosses: Opportunity[];    // 重大丢单明细
  };

  // 阶段瓶颈
  stageBottlenecks: {
    stage: OpportunityStage;
    avgDays: number;
    conversionRate: number;
    bottleneckScore: number;     // 0-100, 越高越严重
  }[];

  // AI 经营分析报告
  aiReport?: {
    highlights: string[];        // 亮点
    problems: string[];          // 问题
    recommendations: string[];   // 建议
    nextPeriodForecast: {        // 下期预测
      expectedWonAmount: number;
      expectedProductDemand: { productModel: string; qty: number }[];
    };
  };
}

interface DimensionSummary {
  name: string;
  count: number;
  amount: number;
  wonCount: number;
  wonAmount: number;
  winRate: number;
  avgCycleDays: number;
  change: number;                // 环比 %
}
```

### 10.5 生产预测模型

```typescript
// lib/pms/forecast/production-forecast.ts

interface ProductionForecast {
  horizon: number;               // 预测天数 (30/60/90)
  generatedAt: string;

  // 按月汇总
  byMonth: MonthForecast[];
  // 按产品型号汇总
  byProduct: ProductForecast[];
  // 按区域汇总
  byRegion: RegionForecast[];

  // 产能预警
  alerts: ProductionAlert[];
}

interface MonthForecast {
  month: string;                 // YYYY-MM
  totalExpectedAmount: number;   // 预计金额
  totalExpectedQty: number;      // 预计数量
  highConfidenceAmount: number;  // 高置信度金额 (≥70%)
  mediumConfidenceAmount: number;// 中置信度 (40-69%)
  lowConfidenceAmount: number;   // 低置信度 (<40%)
  products: { productModel: string; productName: string; expectedQty: number; confidence: number }[];
}

interface ProductForecast {
  productModel: string;
  productName: string;
  totalExpectedQty: number;      // 总预计数量
  highConfidenceQty: number;     // 高置信度数量
  expectedMonths: { month: string; qty: number; confidence: number }[];
  sourceOpportunities: {
    id: string;
    reportName: string;
    stage: OpportunityStage;
    probability: number;
    estimatedCloseDate: string;
    qty: number;
  }[];
}

interface ProductionAlert {
  type: 'capacity_risk' | 'material_shortage' | 'delivery_bottleneck';
  severity: 'warning' | 'critical';
  month: string;
  productModel?: string;
  message: string;
  affectedAmount: number;
}

// 预测算法:
// 1. 提取所有活跃商机 (stage not in [won, lost, cancelled, in_public_pool])
// 2. 每个商机的产品明细 × 阶段概率 = 预计数量
// 3. 阶段概率 (可被历史数据校准):
//    report: 10%, visit: 20%, solution: 40%, bidding: 60%,
//    quotation: 70%, negotiation: 80%, contract: 95%
//    (无 payment 阶段 — 经销商模式, 瑞美不收款)
// 4. 按预计成交日期 (estimatedCloseDate 或 阶段剩余天数推算) 聚类到月份
// 5. 置信度 = 阶段概率 × 历史校准系数
// 6. 按经销商汇总: 一级经销商采购计划 vs 二级经销商间接需求
// 7. 产能预警: 高置信度订单在某月集中 → 提前预警
// 8. 推送到生产系统/ERP
```

---

## 十一、权限模型

| 操作 | owner | admin | 区域经理 | 销售/经销商 | 销售管理部 | 营管 | 技术支持 | 生产负责人 | 经销商(交付) | 服务商 |
|---|---|---|---|---|---|---|---|---|---|---|
| 查看全部商机 | Y | Y | 本区域 | 仅自己报备 | Y | Y | Y(方案相关) | Y(生产计划) | N | N |
| 创建报备 | Y | Y | Y | Y | N | N | N | N | N | N |
| 编辑报备 | Y | Y | 本区域 | 仅自己(开立状态) | N | N | N | N | N | N |
| 提交报备 | Y | Y | Y | Y | N | N | N | N | N | N |
| 撞单仲裁 | Y | Y | N | N | Y | N | N | N | N | N |
| 阶段推进 | Y | Y | Y | Y(自己) | N | N | N | N | N | N |
| 价格审批 | Y | Y | <5% | N | N | N | N | N | N | N |
| 方案审批 | Y | Y | N | N | N | N | Y | N | N | N |
| 合同审核 | Y | Y | N | N | N | Y | N | N | N | N |
| 公海池认领 | Y | Y | Y | Y(非原报备) | N | N | N | N | N | N |
| 丢单审核 | Y | Y | Y | N | N | N | N | N | N | N |
| 经销商组织管理 | Y | Y | N | N | Y | N | N | N | N | N |
| 经销商成员邀请 | Y | Y | N | N | N | N | N | N | Y(本组织) | N |
| 资质审批 | Y | Y | N | N | N | N | Y | N | N | N |
| 查看交付工单 | Y | Y | 本区域 | N | Y | N | Y(相关) | Y(自己) | Y(自己) | Y(自己) |
| 创建交付工单 | Y | Y | N | N | N | Y(合同生效时) | N | N | N | N |
| 推进厂家端阶段 | Y | Y | N | N | N | N | N | Y(自己) | N | N |
| 经销商回报状态 | N | N | N | N | N | N | N | N | Y(自己) | Y(自己) |
| 设备到货验收 | N | N | N | N | N | N | N | N | Y(自己) | N |
| 创建竣工验收 | N | N | N | N | N | N | N | N | Y(有资质) | Y(有资质) |
| 创建调试记录 | N | N | N | N | N | N | Y(远程协助) | N | Y(有资质) | Y(有资质) |
| 创建维保记录 | N | N | N | N | N | N | N | N | Y(有资质) | Y(有资质) |
| 委托服务商 | N | N | N | N | N | N | N | N | Y(自己) | N |
| 发起厂家售后支持 | N | N | N | N | N | N | Y | N | Y(自己) | Y(自己) |
| 处理厂家售后 | Y | Y | N | N | N | N | Y | N | N | N |
| 查看报表 | Y | Y | 本区域 | N | Y | Y | N | N | N | N |
| 查看交付分析 | Y | Y | Y | N | Y | N | Y | Y | N | N |
| 接收分级推送 | Y(战略级) | Y | Y(升级级) | Y(任务级) | Y(经营级) | Y(经营级) | Y(交付级) | Y(交付级) | Y(汇总/任务级) | Y(任务级) |
| 配置推送规则 (NotificationRule) | Y | Y | N | N | Y(本部门) | N | N | N | N | N |
| 发起撞单申诉 | N | N | N | Y(自己) | N | N | N | N | Y(本组织) | N |
| 撞单申诉仲裁 | Y | Y | N | N | Y | N | N | N | N | N |
| 查看健康分自查 | Y | Y | 本区域 | N | Y | N | N | N | Y(本组织) | N |
| 查看本组织返利进度 | Y | Y | N | N | Y | N | N | N | Y(本组织) | N |
| 设定业绩目标 | Y | Y | N | N | Y | N | N | N | N | N |
| 查看业绩看板 | Y | Y | 本区域 | N | Y | Y | N | N | N | N |
| 查看本组织业绩达成 | Y | Y | N | N | Y | N | N | N | Y(本组织) | N |
| 线索开发管理 | Y | Y | 本区域 | Y(分配) | Y | N | N | N | N | N |
| 主推产品配置 | Y | Y | N | N | Y | N | N | N | N | N |
| 触发业绩快照 | Y | Y | N | N | Y | N | N | N | N | N |

> **甲方(终端客户)= 无账号公开触点**: 不在上表角色内。通过设备 SN 二维码访问**独立公开路由** (`/eq/[token]`), 只读设备档案/质保 + 提交报修/满意度 (验证码轻校验), **不进入 PMS 任何业务/内部数据** (§2.5 边界外)。

---

## 十二、非功能需求

### 12.1 性能

| 指标 | 要求 |
|---|---|
| 查重响应时间 | ≤ 2 秒 |
| 页面加载时间 | ≤ 3 秒 |
| 并发报备支持 | ≥ 1000 QPS |
| 数据同步延迟 | ≤ 5 分钟 |
| 系统可用性 | ≥ 99.5% |

### 12.2 安全

- 严格分级数据权限 (销售仅个人, 区域经理本区域, 管理层全量)
- 所有关键操作全程日志留痕 (操作人/时间/内容)
| 关键审批二次确认, 规避误操作
- 每日自动全量备份, 备份保留 30 天

### 12.3 易用性

- Web 管理后台 + 移动端小程序双端口
- 核心操作 ≤ 3 步
- 关键操作弹窗提示与确认
- 支持批量审批、批量导出

### 12.4 扩展性

- 预留新增审批节点、阶段、预警规则接口
- 可拓展对接 CRM、ERP 等系统
- 适配后续业务迭代

---

## 十三、开发分期

### 一期 (MVP) — 报备+查重+审批+跟进+经销商账号

- [ ] 类型定义: `lib/types/pms.ts`
- [ ] 仓储注册: 3 处 (含经销商组织/资质/服务商委托)
- [ ] 商机报备 CRUD + 表单页
- [ ] 智能查重 (五维度, 含地图 API)
- [ ] 撞单处理 (质疑/放弃/仲裁)
- [ ] 多级审批中心
- [ ] 基础跟进记录
- [ ] 经销商组织管理 (联动 createDownstreamOrg)
- [ ] 经销商成员邀请 (联动 inviteDownstreamMember)
- [ ] YS 数据同步 (基础)
- [ ] 验收: 可完整完成报备→查重→审批→跟进全流程, 经销商业务员可登录报备

### 二期 — 精细化管控+分级推送+公海池

- [ ] 10 阶段标准化跟进 + 阶段时限 (经销商模式, 无回款)
- [ ] 90 天超期管控 (75天预警→90天取消→7天恢复→二次进公海)
- [ ] **分级推送矩阵** (角色×紧急度×渠道; 复用 lib/im + 短信/邮件)
- [ ] **升级阶梯引擎** (SLA 超时未处理 → 逐级升级 escalateToRole + 留痕; 定时扫描)
- [ ] **推送去重 + 静默聚合** (同 dedupeKey 合并; 日报/周报 digest)
- [ ] **推送规则配置** (NotificationRule, Admin/销售管理部可配)
- [ ] 公海池流转 (认领/保护期/释放)
- [ ] 验收: 跟进常态化、推送分级精准不刷屏、超期自动逐级升级可留痕、公海池正常流转

### 三期 — 价格+合同+设备交付+深度集成

- [ ] 价格政策申请 + 分级审批
- [ ] 合同管理 (经销商与终端客户签约, 报备瑞美)
- [ ] 丢单管理 (归因+审核+归档)
- [ ] 设备交付工单自动创建 (合同生效触发)
- [ ] 设计方案审批流程 (瑞美技术部)
- [ ] 生产制造跟踪 + 发货物流 (厂家端)
- [ ] 经销商收货确认 + 到货验收
- [ ] 经销商/服务商施工/验收/调试/移交回报机制 (含资质校验)
- [ ] 资质管理 (申请/审批/校验, 五类资质)
- [ ] 服务商委托机制 (无资质经销商可委托服务商)
- [ ] 维保期启动 (经销商/服务商回报移交日)
- [ ] 设备 SN 码基础管理 (赋码同步 + 发货绑定 + 手动导入降级 + 资产层级父子SN)
- [ ] **渠道返利引擎** (RebatePolicy 阶梯规则 + RebateAccrual 计提/结算)
- [ ] **经销商在线订货** (DealerOrder 备货采购: 下单→确认→发货→收货)
- [ ] **CPQ/BOM 级报价** (配置化机组 BOM 展开 + 按部件计价, 渐进启用)
- [ ] **计划量 vs 实际量** (ProductItem 履约率跟踪, 对标销售协议)
- [ ] **经销商返利进度可视** (my-rebates, 增强经销商获得感)
- [ ] **撞单申诉 + 仲裁凭证** (DuplicateAppeal, 撞单透明化) *(可提前至二期随撞单)*
- [ ] 生产预测模型 (阶段概率加权 + 按月/产品/区域/经销商汇总)
- [ ] 产能预警推送
- [ ] YS 系统深度双向集成
- [ ] 验收: 价格合同闭环, 设备交付全链路跑通, 资质校验生效, 经销商回报正常, SN 可绑定交付工单, 返利/订货/BOM 报价可用

### 四期 — 分析体系+维保+报表+优化

- [ ] 数据驾驶舱 (全局总览 + 8 维度即时分析, 含经销商层级)
- [ ] 交叉分析矩阵 (任意两维度)
- [ ] 赢丢单分析 (赢率趋势 + 丢单原因 + 竞品)
- [ ] 阶段总结 (周/月/季 + AI 经营分析报告)
- [ ] 漏斗转化分析
- [ ] 区域业绩看板
- [ ] 经销商排名 (一级/二级分排名, 含赢率/周期/回报合规率)
- [ ] 项目周期分析
- [ ] 维保中心 (经销商/服务商报修/巡检/维修/终端客户反馈)
- [ ] 厂家售后支持 (经销商/服务商发起 factory_support → 瑞美处理)
- [ ] 维保到期预警 + 自动巡检提醒 (通知经销商/服务商)
- [ ] 资质到期预警 (提前60天提醒, 过期禁止执行)
- [ ] 交付健康度看板 (厂家端+经销商端+服务商端, 含资质合规)
- [ ] 经销商/服务商维保质量评估 (响应速度/满意度/一次修复率)
- [ ] 设备 SN 码全生命周期 (安装回报关联 + 质保判定 + 维修零件替换 + 正反向追溯)
- [ ] 精准召回管理 (批次缺陷 → SN 查询 → 经销商/服务商通知 → 跟踪)
- [ ] SN 码与生产系统/售后系统深度对接 (MES/WMS API 自动同步)
- [ ] **设备 IoT 接入** (EquipmentTelemetry 遥测/告警 → 自动维保工单; 未联网降级)
- [ ] **甲方免登录触点** (SN 二维码 → 档案/质保/报修/满意度直回瑞美; 重大召回直达甲方)
- [ ] **经销商健康分自查页** (DealerHealthScore, 考核=自查同源, 算法公示)
- [ ] **业绩管理系统** (PerformanceTarget 目标分解 + 实际vs目标 + 同比环比 + AI归因)
- [ ] **线索开发管理** (DemandGenLead 线索漏斗 + 转化追踪 + 按来源分析)
- [ ] **主推产品推广** (KeyProductCampaign 目标+策略+分区域进展+达成率)
- [ ] **业绩看板** (管理报表平台: 总达成率+区域热力图+渠道+经销商排名+预警)
- [ ] **业绩快照定时任务** (周期性从商机/合同/交付聚合回填实际值)
- [ ] 系统功能优化迭代
- [ ] 验收: 管理层可查看全维度分析报表, 维保闭环, 经销商/服务商排名, 资质合规率100%, 生产预测准确率 ≥80%, SN 码全链路可追溯, 精准召回可执行, IoT 告警自动转工单, 业绩目标达成率+同比环比可查

---

## 十四、文件清单 (待创建)

```
# 类型
lib/types/pms.ts                           # Opportunity, FollowUpRecord, DuplicateCheck, PriceApplication, Contract, PublicPoolEntry, ApprovalRecord, AlertMessage, NotificationRule, NotificationChannel, PmsRole, DeliveryOrder, DeliveryTask, AcceptanceRecord, CommissioningRecord, MaintenanceRecord, DealerOrgProfile, DealerQualification, DealerMemberSummary, ServiceProviderAssignment, EquipmentSN, PartsReplacement, EquipmentTelemetry, RebatePolicy, RebateAccrual, DealerOrder, BomItem, CustomerFeedback, DuplicateAppeal, DealerHealthScore, PerformanceTarget, DemandGenLead, KeyProductCampaign

# Service 层
lib/pms/opportunity-service.ts             # 商机 CRUD + 状态流转
lib/pms/duplicate-check.ts                 # 五维度查重
lib/pms/stage-config.ts                    # 10 阶段配置 (经销商模式, 无回款)
lib/pms/stage-service.ts                   # 阶段推进 + 时限管控
lib/pms/follow-up-service.ts               # 跟进记录
lib/pms/price-service.ts                   # 价格申请 + 取价
lib/pms/contract-service.ts                # 合同管理
lib/pms/public-pool-service.ts             # 公海池
lib/pms/approval-service.ts                # 审批中心
lib/pms/alert-service.ts                   # 预警消息 CRUD + 去重/静默聚合
lib/pms/notification-rule-service.ts       # 分级推送规则 CRUD (角色×渠道×SLA×升级)
lib/pms/notification-dispatch.ts           # 推送分发 (角色→userIds 解析 + 多渠道发送, 复用 lib/im)
lib/pms/escalation-engine.ts               # 升级阶梯 (SLA 超时扫描 → 逐级升级 + 留痕)
lib/pms/lost-analysis-service.ts           # 丢单归因
lib/pms/ninety-day-rule.ts                 # 90 天管控规则
lib/pms/ys-sync.ts                         # YS 系统同步

# 经销商账号与资质 Service
lib/pms/dealer-org-service.ts              # 经销商组织 CRUD (联动 auth/organizations.ts)
lib/pms/dealer-member-service.ts           # 经销商成员管理 (联动 inviteDownstreamMember)
lib/pms/qualification-service.ts           # 资质申请/审批/校验
lib/pms/service-provider-service.ts        # 服务商委托管理

# 设备交付 Service (经销商模式)
lib/pms/delivery-service.ts                # 交付工单 CRUD + 厂家端阶段流转
lib/pms/dealer-report-service.ts           # 经销商/服务商回报处理 (施工/验收/调试/移交)
lib/pms/delivery-task-service.ts           # 交付任务管理 (厂家+经销商+服务商)
lib/pms/acceptance-service.ts              # 验收记录管理 (含资质校验)
lib/pms/commissioning-service.ts           # 调试记录管理 (含资质校验)
lib/pms/maintenance-service.ts             # 维保记录管理
lib/pms/delivery-health.ts                 # 交付健康度算法

# 设备 SN 码 Service
lib/pms/equipment-sn-service.ts            # SN 码 CRUD + 生命周期流转 + 正反向追溯 + 资产层级(父子SN)
lib/pms/sn-sync-service.ts                 # 生产系统/MES SN 码同步 (API 接收 + 手动导入)
lib/pms/recall-service.ts                  # 精准召回管理 (批次查询 + 通知 + 跟踪)
lib/pms/telemetry-service.ts               # 设备 IoT 遥测接入 + 告警→自动维保工单 (四期)
lib/pms/rebate-service.ts                  # 渠道返利: 规则匹配 + 计提 + 周期结算 (三期)
lib/pms/dealer-order-service.ts            # 经销商在线订货 CRUD + 状态流转 (三期)
lib/pms/cpq-service.ts                     # CPQ/BOM 报价: BOM 展开 + 配置约束校验 + 汇总计价 (三期)
lib/pms/customer-touchpoint-service.ts     # 甲方免登录触点: SN二维码token签发/校验 + 报修转工单 + 满意度直回
lib/pms/duplicate-appeal-service.ts        # 撞单申诉: 凭证留存 + 仲裁流转
lib/pms/dealer-health-service.ts           # 经销商健康分: 多维计算 (考核=自查同源)

# 业绩管理 Service
lib/pms/performance/target-service.ts          # 业绩目标 CRUD + 批量分解
lib/pms/performance/comparison-engine.ts       # 同比/环比/实际vs目标对比 + 下钻归因
lib/pms/performance/dashboard.ts               # 业绩看板 (管理报表平台)
lib/pms/performance/snapshot-service.ts        # 快照任务 (周期性回填实际值)
lib/pms/performance/demand-gen-service.ts      # 线索开发 CRUD + 转化追踪
lib/pms/performance/key-product-service.ts     # 主推产品活动 CRUD + 进展跟踪
lib/pms/performance/ai-attribution.ts          # AI 归因分析 (DeepSeek)

# AI 增强
lib/pms/ai-duplicate-check.ts              # AI 语义相似度
lib/pms/reality-check.ts                   # 项目真实性验证
lib/pms/ai-loss-analysis.ts                # AI 丢单归因
lib/pms/perception.ts                      # 阶段超期预警 (复用中央 AI)
lib/pms/ai-period-report.ts                # AI 经营分析报告
lib/pms/ai-production-forecast.ts          # AI 生产预测辅助
lib/pms/ai-delivery-risk.ts                # AI 交付风险预警 (厂家端+经销商端)
lib/pms/ai-maintenance-assistant.ts        # AI 售后支持辅助 (经销商模式)

# 分析体系
lib/pms/analytics/query-engine.ts          # 即时分析查询引擎
lib/pms/analytics/cross-matrix.ts          # 交叉分析矩阵
lib/pms/analytics/period-summary.ts        # 阶段总结 (周/月/季)
lib/pms/analytics/win-loss-analysis.ts     # 赢丢单分析
lib/pms/analytics/dimension-summary.ts     # 维度汇总

# 生产预测
lib/pms/forecast/production-forecast.ts    # 生产订单预测模型
lib/pms/forecast/stage-probability.ts      # 阶段概率 + 历史校准

# 业绩管理 API
app/api/pms/performance/targets/route.ts
app/api/pms/performance/targets/[id]/route.ts
app/api/pms/performance/targets/batch/route.ts
app/api/pms/performance/targets/summary/route.ts
app/api/pms/performance/comparison/route.ts
app/api/pms/performance/comparison/yoy/route.ts
app/api/pms/performance/comparison/mom/route.ts
app/api/pms/performance/comparison/ai-attribution/route.ts
app/api/pms/performance/dashboard/route.ts
app/api/pms/performance/snapshot/route.ts
app/api/pms/performance/snapshot/status/route.ts
app/api/pms/demand-gen/leads/route.ts
app/api/pms/demand-gen/leads/[id]/route.ts
app/api/pms/demand-gen/leads/[id]/convert/route.ts
app/api/pms/demand-gen/leads/[id]/lost/route.ts
app/api/pms/demand-gen/funnel/route.ts
app/api/pms/demand-gen/by-source/route.ts
app/api/pms/key-products/route.ts
app/api/pms/key-products/[id]/route.ts
app/api/pms/key-products/[id]/activate/route.ts
app/api/pms/key-products/[id]/complete/route.ts
app/api/pms/key-products/[id]/progress/route.ts

# API 路由
app/api/pms/opportunities/route.ts
app/api/pms/opportunities/[id]/route.ts
app/api/pms/opportunities/[id]/submit/route.ts
app/api/pms/opportunities/check-duplicate/route.ts
app/api/pms/opportunities/[id]/duplicates/route.ts
app/api/pms/opportunities/[id]/question/route.ts
app/api/pms/opportunities/[id]/withdraw/route.ts
app/api/pms/opportunities/[id]/arbitrate/route.ts
app/api/pms/opportunities/[id]/advance-stage/route.ts
app/api/pms/opportunities/[id]/follow-ups/route.ts
app/api/pms/opportunities/[id]/won/route.ts
app/api/pms/opportunities/[id]/lost/route.ts
app/api/pms/opportunities/[id]/price-app/route.ts
app/api/pms/opportunities/[id]/contract/route.ts
app/api/pms/price-applications/[id]/route.ts
app/api/pms/price-applications/[id]/approve/route.ts
app/api/pms/price-applications/[id]/get-price/route.ts
app/api/pms/contracts/[id]/route.ts
app/api/pms/contracts/[id]/approve/route.ts
app/api/pms/contracts/[id]/sync-b2b/route.ts
app/api/pms/public-pool/route.ts
app/api/pms/public-pool/[opportunityId]/claim/route.ts
app/api/pms/approvals/route.ts
app/api/pms/approvals/[id]/approve/route.ts
app/api/pms/approvals/[id]/reject/route.ts
app/api/pms/alerts/route.ts
app/api/pms/alerts/scan/route.ts               # 预警扫描 (生成 AlertMessage)
app/api/pms/alerts/[id]/ack/route.ts           # 标记已处理 (acted, 阻断升级)
app/api/pms/alerts/escalate-scan/route.ts      # 升级阶梯扫描 (SLA 超时 → 升级, 定时任务)
app/api/pms/notification-rules/route.ts        # 分级推送规则列表/新建
app/api/pms/notification-rules/[id]/route.ts   # 规则编辑/删除
app/api/pms/analytics/overview/route.ts
app/api/pms/analytics/funnel/route.ts
app/api/pms/analytics/by-region/route.ts
app/api/pms/analytics/by-customer/route.ts
app/api/pms/analytics/by-channel/route.ts
app/api/pms/analytics/by-sales-org/route.ts
app/api/pms/analytics/by-product-line/route.ts
app/api/pms/analytics/by-stage/route.ts
app/api/pms/analytics/win-loss/route.ts
app/api/pms/analytics/cross/route.ts
app/api/pms/analytics/period-summary/route.ts
app/api/pms/analytics/period-summary/generate/route.ts
app/api/pms/forecast/production/route.ts
app/api/pms/forecast/production/by-month/route.ts
app/api/pms/forecast/production/by-region/route.ts
app/api/pms/forecast/production/by-product/route.ts
app/api/pms/forecast/production/alerts/route.ts
app/api/pms/forecast/production/push/route.ts
app/api/pms/delivery-orders/route.ts
app/api/pms/delivery-orders/[id]/route.ts
app/api/pms/delivery-orders/[id]/advance-stage/route.ts
app/api/pms/delivery-orders/[id]/dealer-report/route.ts
app/api/pms/delivery-orders/[id]/tasks/route.ts
app/api/pms/delivery-tasks/[id]/route.ts
app/api/pms/delivery-tasks/[id]/complete/route.ts
app/api/pms/delivery-tasks/[id]/verify/route.ts
app/api/pms/delivery-orders/[id]/acceptances/route.ts
app/api/pms/acceptances/[id]/route.ts
app/api/pms/acceptances/[id]/end-customer-sign/route.ts
app/api/pms/delivery-orders/[id]/commissionings/route.ts
app/api/pms/commissionings/[id]/route.ts
app/api/pms/delivery-orders/[id]/maintenance/route.ts
app/api/pms/maintenance/[id]/route.ts
app/api/pms/maintenance/[id]/complete/route.ts
app/api/pms/maintenance/[id]/end-customer-feedback/route.ts
app/api/pms/maintenance/[id]/factory-support/route.ts
app/api/pms/delivery-orders/[id]/health/route.ts
app/api/pms/delivery/health-overview/route.ts
app/api/pms/maintenance/alerts/route.ts
app/api/pms/maintenance/expiring/route.ts
app/api/pms/ys/sync/route.ts

# 经销商账号与资质 API
app/api/pms/dealer-orgs/route.ts
app/api/pms/dealer-orgs/[id]/route.ts
app/api/pms/dealer-orgs/[id]/suspend/route.ts
app/api/pms/dealer-orgs/[id]/reactivate/route.ts
app/api/pms/dealer-orgs/[id]/members/route.ts
app/api/pms/dealer-orgs/[id]/invite/route.ts
app/api/pms/dealer-members/[userId]/route.ts
app/api/pms/dealer-orgs/[id]/qualifications/route.ts
app/api/pms/qualifications/[id]/route.ts
app/api/pms/qualifications/[id]/approve/route.ts
app/api/pms/qualifications/[id]/reject/route.ts
app/api/pms/qualifications/[id]/revoke/route.ts
app/api/pms/qualifications/check/route.ts
app/api/pms/delivery-orders/[id]/service-assignments/route.ts
app/api/pms/service-assignments/[id]/route.ts

# 设备 SN 码 API
app/api/pms/equipment-sns/route.ts          # SN 码列表 + 查询
app/api/pms/equipment-sns/[id]/route.ts     # SN 码详情
app/api/pms/equipment-sns/by-sn/[snCode]/route.ts  # 按 SN 码查询 (扫码)
app/api/pms/equipment-sns/by-batch/[batchId]/route.ts  # 按批次查询 (召回)
app/api/pms/equipment-sns/import/route.ts   # 手动导入 SN 码 (CSV/Excel)
app/api/pms/equipment-sns/sync/route.ts     # 生产系统推送 SN 码 (API 接收)
app/api/pms/equipment-sns/[id]/bind-delivery/route.ts  # 绑定交付工单
app/api/pms/equipment-sns/[id]/install/route.ts  # 更新安装信息
app/api/pms/equipment-sns/[id]/warranty/route.ts  # 更新质保信息
app/api/pms/equipment-sns/[id]/trace/route.ts  # 正反向追溯
app/api/pms/recalls/route.ts               # 创建召回
app/api/pms/recalls/[id]/route.ts          # 召回详情 + 跟踪

# IoT / 返利 / 订货 / CPQ API
app/api/pms/telemetry/route.ts             # IoT 遥测推送接收 (告警→自动工单)
app/api/pms/telemetry/[snCode]/route.ts    # 按 SN 查遥测/告警历史
app/api/pms/rebate-policies/route.ts       # 返利规则列表/新建
app/api/pms/rebate-policies/[id]/route.ts  # 返利规则编辑
app/api/pms/rebate-accruals/route.ts       # 返利计提列表 (?dealerOrgId=&period=)
app/api/pms/rebate-accruals/[id]/settle/route.ts  # 返利审核/结算
app/api/pms/dealer-orders/route.ts         # 订货单列表/新建
app/api/pms/dealer-orders/[id]/route.ts    # 订货单详情
app/api/pms/dealer-orders/[id]/confirm/route.ts   # 瑞美确认订货
app/api/pms/cpq/quote/route.ts             # CPQ 报价 (BOM 展开 + 配置校验 + 汇总)

# 甲方免登录触点 API (公开, 无需登录; token 签名 + 限流)
app/api/public/equipment/[token]/route.ts        # 扫码只读设备档案/质保 (token 校验)
app/api/public/equipment/[token]/feedback/route.ts  # 甲方报修/满意度提交 (验证码轻校验)
# 经销商价值层 API
app/api/pms/duplicate-appeals/route.ts     # 撞单申诉列表/发起
app/api/pms/duplicate-appeals/[id]/arbitrate/route.ts  # 仲裁 (销售管理部)
app/api/pms/dealer-health/[orgId]/route.ts # 经销商健康分 (自查, 本组织)

# 前端页面
app/pms/page.tsx                           # 商机看板 (Kanban)
app/pms/list/page.tsx                      # 商机列表
app/pms/new/page.tsx                       # 新建报备
app/pms/[id]/page.tsx                      # 商机详情
app/pms/[id]/follow-up/page.tsx            # 新增跟进
app/pms/public-pool/page.tsx               # 公海池
app/pms/dealers/page.tsx                   # 经销商管理列表
app/pms/dealers/[id]/page.tsx              # 经销商详情 (含成员/资质)
app/pms/dealers/[id]/qualifications/page.tsx  # 资质审批
app/pms/delivery/page.tsx                  # 交付看板 (Kanban)
app/pms/delivery/list/page.tsx             # 交付工单列表
app/pms/delivery/[id]/page.tsx             # 交付工单详情
app/pms/delivery/[id]/dealer-report/page.tsx  # 经销商回报 (移动端优先)
app/pms/delivery/[id]/acceptance/page.tsx  # 新增验收 (经销商)
app/pms/delivery/[id]/commissioning/page.tsx # 新增调试
app/pms/maintenance/page.tsx               # 维保中心
app/pms/approvals/page.tsx                 # 审批中心
app/pms/alerts/page.tsx                    # 预警消息 (按角色层/紧急度/升级级别筛选)
app/pms/admin/notification-rules/page.tsx  # 分级推送规则配置 (Admin/销售管理部)
app/pms/analytics/page.tsx                 # 数据驾驶舱
app/pms/analytics/win-loss/page.tsx        # 赢丢单分析
app/pms/analytics/cross/page.tsx           # 交叉分析
app/pms/analytics/summary/page.tsx         # 阶段总结
app/pms/forecast/page.tsx                  # 生产预测看板
app/pms/equipment/page.tsx                 # 设备 SN 码查询 (扫码/搜索)
app/pms/equipment/[id]/page.tsx            # 设备 SN 码详情 (全生命周期时间线)
app/pms/equipment/batch/[batchId]/page.tsx # 批次设备列表 (召回视角)
app/pms/recalls/page.tsx                   # 召回管理
app/pms/equipment/[id]/telemetry/page.tsx  # 设备 IoT 遥测/告警 (四期)
app/pms/rebates/page.tsx                   # 渠道返利 (规则+计提+结算)
app/pms/dealer-orders/page.tsx             # 经销商在线订货 (列表+下单)
app/pms/dealer-orders/[id]/page.tsx        # 订货单详情
app/admin/pms/rebate-policies/page.tsx     # 返利规则配置 (销售管理部)
app/eq/[token]/page.tsx                    # 甲方免登录扫码页 (设备档案/质保/报修/满意度, 独立公开路由)
app/pms/my-health/page.tsx                 # 经销商"我的健康分"自查页
app/pms/appeals/page.tsx                   # 撞单申诉 (发起/查看) + 仲裁 (销售管理部)
app/pms/my-rebates/page.tsx                # 经销商返利进度可视 (本组织)
app/pms/performance/page.tsx                # 业绩看板 (管理报表平台)
app/pms/performance/targets/page.tsx         # 目标管理 (列表+新建+批量分解)
app/pms/performance/comparison/page.tsx      # 对比分析 (实际vs目标+同比环比+AI归因)
app/pms/demand-gen/page.tsx                  # 线索开发 (列表+漏斗+按来源)
app/pms/demand-gen/[id]/page.tsx             # 线索详情 (跟进+转化)
app/pms/key-products/page.tsx                # 主推产品 (活动列表+进展)
app/pms/key-products/[id]/page.tsx           # 主推产品详情 (分区域+经销商)

# 组件
components/pms/opportunity-kanban.tsx      # 商机看板
components/pms/opportunity-card.tsx        # 商机卡片
components/pms/opportunity-form.tsx        # 报备表单
components/pms/duplicate-check-panel.tsx   # 查重结果面板
components/pms/collision-handler.tsx       # 撞单处理组件
components/pms/stage-timeline.tsx          # 10 阶段时间线
components/pms/follow-up-list.tsx          # 跟进记录列表
components/pms/follow-up-form.tsx          # 跟进录入表单
components/pms/price-application.tsx       # 价格申请组件
components/pms/contract-form.tsx           # 合同表单
components/pms/public-pool-list.tsx        # 公海池列表
components/pms/approval-center.tsx         # 审批中心
components/pms/alert-list.tsx              # 预警消息列表 (含升级链路展示)
components/pms/notification-rule-editor.tsx # 推送规则编辑器 (角色×渠道×SLA×升级矩阵)
components/pms/escalation-trail.tsx        # 升级留痕时间线
components/pms/lost-analysis-chart.tsx     # 丢单分析图表
components/pms/product-items-editor.tsx    # 产品明细编辑器
components/pms/analytics-dashboard.tsx     # 数据驾驶舱 (总览)
components/pms/analytics-funnel.tsx        # 漏斗图
components/pms/analytics-dimension.tsx     # 维度分析图表
components/pms/analytics-cross-matrix.tsx  # 交叉分析热力图
components/pms/analytics-win-loss.tsx      # 赢丢单分析图表
components/pms/period-summary-report.tsx   # 阶段总结报告
components/pms/production-forecast.tsx     # 生产预测看板
components/pms/production-alert.tsx        # 产能预警组件
components/pms/dealer-org-list.tsx         # 经销商组织列表
components/pms/dealer-org-detail.tsx       # 经销商详情 (Tab: 信息/成员/资质/报备/交付)
components/pms/dealer-member-list.tsx      # 经销商成员列表
components/pms/dealer-invite-dialog.tsx    # 邀请成员对话框 (联动 inviteDownstreamMember)
components/pms/qualification-list.tsx      # 资质列表 + 申请/审批 UI
components/pms/qualification-badge.tsx     # 资质状态标识 (已认证/待审/无资质)
components/pms/service-assignment-panel.tsx  # 服务商委托面板 (选择服务商/分派)
components/pms/delivery-kanban.tsx         # 交付看板 (按阶段分列, 厂家端+经销商端+服务商)
components/pms/delivery-detail.tsx         # 交付工单详情 (Tab 容器)
components/pms/dealer-report-form.tsx      # 经销商/服务商回报表单 (施工/验收/调试/移交)
components/pms/delivery-task-list.tsx      # 交付任务列表
components/pms/delivery-task-form.tsx      # 交付任务表单
components/pms/acceptance-form.tsx         # 验收表单
components/pms/acceptance-report.tsx       # 验收报告展示
components/pms/commissioning-form.tsx      # 调试表单
components/pms/commissioning-report.tsx    # 调试报告展示
components/pms/maintenance-list.tsx        # 维保记录列表
components/pms/maintenance-form.tsx        # 维保/报修表单
components/pms/delivery-health-badge.tsx   # 交付健康度标识
components/pms/delivery-timeline.tsx       # 交付时间线
components/pms/equipment-sn-list.tsx        # SN 码列表
components/pms/equipment-sn-detail.tsx      # SN 码详情 (全生命周期时间线)
components/pms/equipment-sn-trace.tsx       # 正反向追溯可视化
components/pms/equipment-sn-import.tsx      # SN 码导入 (CSV/Excel)
components/pms/equipment-sn-bind.tsx        # SN 码绑定交付工单
components/pms/recall-panel.tsx             # 召回管理面板
components/pms/telemetry-chart.tsx          # IoT 遥测曲线 + 告警列表
components/pms/rebate-policy-editor.tsx     # 返利规则编辑器 (阶梯)
components/pms/rebate-accrual-list.tsx      # 返利计提/结算列表
components/pms/dealer-order-form.tsx        # 经销商订货表单 (移动端优先)
components/pms/dealer-order-list.tsx        # 订货单列表
components/pms/cpq-configurator.tsx         # CPQ/BOM 配置器 (选配+约束+报价)
components/pms/product-items-editor.tsx     # (已有, 扩展支持 BOM + 计划/实际量)
components/public/equipment-card.tsx        # 甲方扫码只读设备卡 (档案/质保)
components/public/customer-feedback-form.tsx # 甲方报修/满意度表单 (验证码轻校验)
components/pms/dealer-health-card.tsx        # 经销商健康分卡 (雷达图+扣分明细)
components/pms/duplicate-appeal-form.tsx     # 撞单申诉表单 + 凭证展示
components/pms/dealer-rebate-progress.tsx    # 经销商返利进度可视
components/pms/performance-dashboard.tsx      # 业绩看板 (总览+区域热力图+预警)
components/pms/performance-target-editor.tsx  # 目标编辑/批量分解
components/pms/performance-comparison-chart.tsx # 对比分析图表 (同比/环比/达成率)
components/pms/demand-gen-funnel.tsx          # 线索开发漏斗
components/pms/demand-gen-list.tsx            # 线索列表
components/pms/key-product-list.tsx           # 主推产品活动列表
components/pms/key-product-progress.tsx       # 主推产品进展 (分区域+达成率)

# 测试
tests/unit/pms-duplicate-check.test.ts
tests/unit/pms-stage-config.test.ts
tests/unit/pms-ninety-day-rule.test.ts
tests/unit/pms-public-pool.test.ts
tests/unit/pms-approval.test.ts
tests/unit/pms-notification-dispatch.test.ts   # 角色→userIds 解析 + 去重/静默聚合
tests/unit/pms-escalation-engine.test.ts       # SLA 超时逐级升级 + 留痕
tests/unit/pms-lost-analysis.test.ts
tests/unit/pms-analytics-query-engine.test.ts
tests/unit/pms-analytics-cross-matrix.test.ts
tests/unit/pms-production-forecast.test.ts
tests/unit/pms-period-summary.test.ts
tests/unit/pms-delivery-service.test.ts
tests/unit/pms-delivery-health.test.ts
tests/unit/pms-acceptance.test.ts
tests/unit/pms-maintenance.test.ts
tests/unit/pms-equipment-sn.test.ts
tests/unit/pms-sn-sync.test.ts
tests/unit/pms-recall.test.ts
tests/unit/pms-telemetry.test.ts               # IoT 告警→自动工单
tests/unit/pms-rebate.test.ts                  # 阶梯区间命中 + 计提金额
tests/unit/pms-dealer-order.test.ts            # 订货单状态流转
tests/unit/pms-cpq.test.ts                     # BOM 展开 + 配置约束校验 + 汇总计价
tests/unit/pms-customer-touchpoint.test.ts     # 二维码 token 签发/校验 + 报修转工单 + 满意度直回
tests/unit/pms-duplicate-appeal.test.ts        # 申诉凭证 + 仲裁流转
tests/unit/pms-dealer-health.test.ts           # 健康分多维计算 (考核=自查同源)
tests/unit/pms-performance-target.test.ts      # 目标分解+达成率计算
tests/unit/pms-performance-comparison.test.ts  # 同比/环比/实际vs目标+下钻归因
tests/unit/pms-performance-snapshot.test.ts    # 快照回填实际值
tests/unit/pms-demand-gen.test.ts              # 线索开发+转化追踪
```

---

## 十五、需求覆盖矩阵

| 需求 (DOCX) | 章节 | 覆盖状态 |
|---|---|---|
| 3.1 项目报备 (智能查重+撞单+双端录入) | 五.5.1 + 五.5.2 + 七 | ✅ 完整覆盖 |
| 3.2 项目跟进 (10阶段+90天管控, 经销商模式无回款) | 五.5.3 + 五.5.4 | ✅ 完整覆盖 |
| 3.3 价格与合同 (分级审批+客户后缀规则) | 五.5.5 + 三.3.4/3.5 | ✅ 完整覆盖 |
| 3.4 公海池 (认领+保护期+30天禁认) | 五.5.8 + 三.3.6 | ✅ 完整覆盖 |
| 3.5 丢单管理 (归因体系+审核归档) | 五.5.7 + 三.3.1 | ✅ 完整覆盖 |
| 3.6 审批中心 (7类审批+超期升级) | 五.5.6 + 三.3.7 | ✅ 完整覆盖 |
| 3.7 预警与消息 (6类预警+多渠道) | 三.3.8 + 八.8.4 | ✅ 完整覆盖 |
| 3.8 报表与分析 (二期) | 十 分析体系 + 六.6.7 | ✅ 升级为八大维度即时分析+交叉分析+阶段总结 |
| 分析体系 (区域/客户/渠道/销售组织/经销商层级/产品线/阶段/赢丢单) | 十.10.1-10.4 | ✅ 新增经销商层级维度, 超越原需求 |
| 生产预测 (向生产端输出预测) | 十.10.5 + 六.6.7.4 + 八.8.6 | ✅ 新增, 超越原需求 |
| 交付履约闭环 (设备交付→经销商/服务商施工→验收→调试→维保) | 三.3.9-3.14 + 五.5.9-5.10 + 六.6.8 + 八.8.7-8.8 | ✅ 经销商模式, 厂家交付设备, 经销商或服务商执行施工/维保 |
| 经销商层级管理 (一级/二级) | 三.3.1 (dealerLevel) + 十.10.2 (dealer_level 维度) | ✅ 新增, 支持一级/二级经销商分报备/分析 |
| 经销商账号体系 (多业务员/组织管理) | 三.3.14 + 六.6.8.1 + 七 | ✅ 新增, 复用 Tandem 上下游组织模型, 邀请码注册 |
| 服务商资质机制 (调试验收售后需认证) | 三.3.14 (DealerQualification) + 五.5.9 + 六.6.8.1 | ✅ 新增, 五类资质 (施工/调试/验收/维保/设计), 瑞美认证, 无资质可委托服务商 |
| 设备 SN 码全生命周期追踪 | 三.3.15 (EquipmentSN) + 九.9.5-9.6 + 十四 | ✅ 新增, SN 码赋码→入库→发货→安装→维保→召回, 正反向追溯, 打通生产/售后系统 |
| 开源系统评估 (ERPNext/Open Mercato/Krayin/八骏) | 二.2.3 | ✅ 新增, 评估 4 方案, 结论: 原生开发, 提取功能启发 |
| 行业竞品对标 (三轴: 项目型L2C/设备DMS/资产型FSM) | 二.2.4 | ✅ 校正: 剔除零售线索CRM, 锁定项目/设备型平台 (含国际 Salesforce Mfg/Dynamics/ServiceMax/IFS) |
| 分级推送 + 升级阶梯 (项目进度可视化管控) | 三.3.8 + 六.6.6 + 十一 + 十三(二期) | ✅ 新增, 角色×紧急度×渠道矩阵 + SLA 逐级升级 + 去重/静默聚合, 直击"跟进不可视"痛点 |
| 系统边界 (PMS外部 vs Tandem内部 切割关联) | 二.2.5 | ✅ 新增, 三层切割(用户/模块/数据)+五桥关联+Tandem能力开放矩阵; 含 P0 安全缺口(/pms 需独立板块) |
| 设备 IoT 接入 (遥测/告警→自动工单) | 三.3.16 | ✅ 补齐, 四期; 轻耦合+未联网降级 (对标销售易/Dynamics) |
| 渠道返利引擎 (阶梯规则+计提+结算) | 三.3.17 | ✅ 补齐, 三期 (对标纷享销客/瑞泰) |
| 经销商在线订货 (订货通/备货采购) | 三.3.18 | ✅ 补齐, 三期; 区别于合同后交付 (对标纷享订货通) |
| CPQ/BOM 级报价 (配置化机组渐进启用) | 三.3.19 + 三.3.1 | ✅ 补齐, 三期 (对标纷享CPQ/销售易BOM) |
| 资产层级(父子SN) + 计划量vs实际量 | 三.3.15 + 三.3.1 | ✅ 补齐 (对标 ServiceMax asset hierarchy / Salesforce 销售协议) |
| 甲方免登录触点 (扫码档案/质保/报修/满意度) | 三.3.20 | ✅ 补齐 (审计 §2.6); 满意度直回瑞美防粉饰, 召回直达甲方知情权 |
| 经销商价值层 (撞单申诉/健康分自查/返利可视) | 三.3.21 | ✅ 补齐 (审计 §2.5); 产品红线"每个管控配一个经销商价值" |
| 业绩管理系统 (目标分解+实际vs目标+同比环比+AI归因) | 三.3.22 + 六.6.10 + 十三(四期) | ✅ 新增, 管理闭环 (对标 Salesforce Quota/纷享销客业绩目标), 区别于§6.7描述性分析 |
| 线索开发 (Demand Generation, 报备前线索漏斗) | 三.3.22.2 + 六.6.10 | ✅ 新增, 线索→商机转化追踪, 按来源转化率分析 |
| 主推产品推广 (KeyProductCampaign 目标+策略+进展) | 三.3.22.3 + 六.6.10 | ✅ 新增, 有组织市场推广跟踪 (价格激励+返利加码+重点区域)|
| 四、系统对接 (企微+地图+YS+生产/ERP) | 九 | ✅ 新增生产系统对接 |
| 五、非功能需求 (性能/安全/易用/扩展) | 十二 | ✅ 完整覆盖 |
| 六、分期实施 (4阶段) | 十三 | ✅ 完整覆盖 |
| 七、验收标准 | 十三(各期验收) | ✅ 完整覆盖 |
| 八、术语表 | 贯穿全文 | ✅ 已融入 |
| PPTX 操作流程 (28步) | 五.5.1-5.5 + 七 | ✅ 流程已映射 |

---

## 十六、待确认决策点

| # | 决策点 | 选项 | 建议 |
|---|---|---|---|
| 1 | 查重地图 API | A: 高德 / B: 百度 / C: 两者兼容 | 取决于现有账号 |
| 2 | 小程序端框架 | A: 企微 H5 / B: 微信小程序 / C: Tauri 移动端 | 建议 A (最快落地) |
| 3 | YS 系统对接方式 | A: API 双向 / B: 仅导入 / C: 中间表 | 需确认 YS 接口可用性 |
| 4 | 查重 AI 语义相似度 | A: DeepSeek embedding / B: TF-IDF / C: 编辑距离 | 建议 A (已有 API) |
| 5 | 产品价格体系来源 | A: YS 系统取价 / B: 本地维护 | 需求文档显示从 YS 取价 |
| 6 | 审批人映射 | 角色对应具体人员如何配置 | 建议 Admin 可配 |
| 7 | 阶段时限是否可配置 | A: 硬编码 / B: Admin 可配 | 先 A 后 B |
| 8 | 拜访阶段时限分级 | 需求提到"按应用场景分级" | 需确认具体分级规则 |
| 9 | 设备交付工单创建时机 | A: 经销商合同报备瑞美 / B: 瑞美确认订单 / C: 手动创建 | 建议 A (合同报备即触发) |
| 10 | 经销商回报方式 | A: 企微H5表单 / B: 小程序 / C: PC端 | 建议 A (经销商移动端为主) |
| 11 | 维保期默认时长 | A: 12个月 / B: 24个月 / C: 按合同约定 | 建议 C (合同字段带出) |
| 12 | 经销商报修入口 | A: 企微小程序 / B: 电话转系统 / C: 独立H5 | 建议 A (企微生态内) |
| 13 | 生产系统对接方式 | A: API 推送 / B: 导出文件 / C: 手动 | 需确认生产系统接口 |
| 14 | 二级经销商报备审批 | A: 一级经销商审批后报瑞美 / B: 直接报瑞美 / C: 一级知情即可 | 需确认管理要求 |
| 15 | 经销商回报超期处理 | A: 仅提醒 / B: 影响经销商评级 / C: 升级区域经理 | 建议 A+B (提醒+评级扣分) |
| 16 | 厂家售后费用承担判定 | A: 系统自动判定 / B: 人工审核 / C: AI辅助+人工确认 | 建议 C (AI辅助, 人工终审) |
| 17 | 经销商业务员注册方式 | A: 瑞美 Admin 统一邀请 / B: 经销商管理员自主邀请 / C: 两者皆可 | 建议 C (瑞美建组织, 经销商管理员邀成员) |
| 18 | 经销商管理员权限边界 | A: 仅管理本组织成员 / B: 可报备+管理成员 / C: 可查看本组织全部报备 | 建议 C (经销商管理员=本组织全权限) |
| 19 | 资质认证流程 | A: 经销商申请→瑞美技术支持审批 / B: 瑞美主动授予 / C: 培训考核后自动授予 | 建议 A (经销商提交证明, 技术支持审批) |
| 20 | 资质过期处理 | A: 自动失效, 禁止执行 / B: 宽限期30天 / C: 提醒续期 | 建议 C (提前60天提醒, 过期后禁止执行) |
| 21 | 服务商委托费用结算 | A: 经销商与服务商自行结算 / B: 瑞美代扣 / C: 系统记录, 线下结算 | 建议 C (系统仅记录委托关系, 费用线下结算) |
| 22 | 服务商来源 | A: 仅一级经销商可做服务商 / B: 瑞美认证的第三方服务商 / C: 两者皆可 | 建议 C (一级经销商+第三方, 均需资质认证) |
| 23 | SN 码生成方式 | A: 生产系统赋码后推送 / B: PMS 手动录入 / C: 两者皆可 | 建议 C (生产系统 API 优先, 手动导入降级) |
| 24 | SN 码与生产系统对接时机 | A: 三期同步 / B: 四期对接 / C: 先手动导入, 后续 API | 建议 C (三期手动导入, 四期 API 自动同步) |
| 25 | 精准召回触发方式 | A: 生产系统推送缺陷指令 / B: 瑞美手动发起 / C: AI 自动识别批次故障趋势 | 建议 B+C (瑞美手动+AI 辅助识别) |
| 26 | 开源系统是否引入 | A: 原生开发 / B: 引入 ERPNext / C: 引入 Open Mercato | 建议 A (原生开发, 已评估开源方案, 提取功能启发) |
| 27 | 竞品功能补齐优先级 | A: IoT 接入优先 / B: 渠道返利引擎优先 / C: CPQ/BOM 报价优先 | 需 Owner 确认业务优先级 |
| 28 | 分级推送升级阶梯 SLA | A: 硬编码默认 (T+3/T+7/T+15) / B: Admin 可配 NotificationRule / C: 按阶段/金额动态 | 建议 B (先默认, 后 Admin 可配) |
| 29 | 推送渠道优先级 | A: 企微为主+站内兜底 / B: 短信只用于 critical / C: 邮件仅用于 digest/经营级 | 建议 A+B+C 组合 (按紧急度分渠道) |
| 30 | 静默聚合策略 | A: 一线实时+管理层日报/周报 / B: 全部实时 / C: 全部聚合 | 建议 A (任务级实时, 汇总/经营级聚合防刷屏) |
| 31 | 升级到顶仍未处理 | A: 停在最高级 / B: 转人工工单 / C: 中央 AI 介入分析 | 建议 B+C (转人工 + AI 归因) |
| 32 | 经销商外部角色 | A: 复用 partner/contractor / B: 新增 dealer_sales/dealer_admin / C: 混合 | 建议 B (新增专用外部角色, 语义清晰, 登记进 EXTERNAL_ROLES) |
| 33 | PMS 板块归属 | A: 落 system(现状裸奔) / B: 新增 channel 第四板块 / C: 塞进 dazi | 建议 B (新增 channel 板块, 修复 P0 安全缺口) |
| 34 | 中央 AI 对经销商开放范围 | A: 完全不开放 / B: PMS 范围受限问答(经闸) / C: 全量 | 建议 B (Skill Gateway 数据域+动作域限制, 不暴露内部 OKR/记忆) |
| 35 | 经销商 OKR 可见性 | A: 完全不可见 / B: 见与自己相关的销售目标 / C: 见全部 | 建议 A (OKR 纯内部, PMS 仅作 OKR 数据源, 经销商永不见) |
| 36 | 甲方满意度归属 | A: 直回瑞美(经销商可见不可改) / B: 经销商中转 / C: 两条线并存 | 建议 A (防粉饰, 作经销商考核真值) |
| 37 | 甲方触点身份校验 | A: 纯 token 只读+写操作验证码 / B: 甲方需注册 / C: 经销商代填 | 建议 A (免登录降门槛, 写操作手机验证码防滥用) |
| 38 | 重大召回甲方通知 | A: 只通知经销商 / B: 同时直达甲方 / C: 看召回等级 | 建议 C (一般经经销商, 安全类直达甲方) |
| 39 | 撞单申诉仲裁时限 | A: 无限期 / B: SLA 内必须裁决 / C: 超时自动维持原判 | 建议 B (纳入分级推送升级, 保障经销商) |
| 40 | 业绩目标分解粒度 | A: 仅区域+周期 / B: 区域×渠道×产品 / C: 任意维度组合 | 建议 C (灵活组合, 支持多维度交叉目标) |
| 41 | 业绩快照频率 | A: 日快照 / B: 周快照 / C: 日+周双轨 | 建议 A (日快照足够, 业绩看板 T+1 数据) |
| 42 | 线索开发归属 | A: 仅内部销售 / B: 经销商也可录入线索 / C: 市场部统一录入分配 | 需确认线索录入责任归属 |
| 43 | 主推产品与返利/价格激励联动 | A: 仅展示关联 / B: 自动应用特批价格 / C: 自动叠加返利加码 | 建议 A (先展示关联, 自动应用待三期返利引擎成熟后) |
