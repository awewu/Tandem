# 瑞美 PMS · 产品蓝图

> v2.9 · 对应 `CRM-PM-DESIGN.md` v2.9 · 商用/轻商设备 L2C + DMS + FSM

---

## 一、系统全景

```mermaid
graph TB
    subgraph 外部
        DI[经销商业务员]
        DA[经销商管理员]
        SP[服务商]
        CU[甲方·无账号·扫码]
    end
    subgraph 内部
        OW[Owner/Admin]
        SM[销售管理部]
        EN[工程/生产]
        AF[售后支持]
    end
    subgraph Tandem
        OKR[OKR事半]
        AT[中央AI Atlas]
        IM[IM消息]
    end
    subgraph 外部系统
        YS[YS系统]
        MES[MES生产]
        WXP[企微/微信]
        IoT[IoT平台]
    end
    PMS((瑞美PMS))

    DI & DA & SP -->|报备/回报/订货| PMS
    CU -->|扫码 档案/报修/满意度| PMS
    OW & SM & EN & AF -->|管理/审批/生产/售后| PMS
    PMS -->|数据源| OKR
    PMS <-->|受限surface| AT
    PMS -->|推送| IM
    PMS <-->|同步| YS & MES
    PMS -->|通知| WXP
    IoT -->|遥测/告警| PMS

    style PMS fill:#4F46E5,color:#fff,stroke:#333,stroke-width:3px
    style CU fill:#F59E0B,color:#fff
    style AT fill:#7C3AED,color:#fff
```

---

## 二、三套安全模型

```mermaid
graph LR
    I[内部员工<br/>企业邮箱] -->|Tandem原生认证<br/>全量模块| I2[内部域]
    E[经销商/服务商<br/>邀请码注册] -->|channel板块<br/>orgId隔离| E2[外部域]
    C[甲方终端客户<br/>无账号] -->|SN二维码签名token<br/>独立公开路由| C2[公开域]

    style I2 fill:#3B82F6,color:#fff
    style E2 fill:#10B981,color:#fff
    style C2 fill:#F59E0B,color:#fff
```

> 甲方走 `/api/public/*`，**不挂 `/api/pms/*`**，只读单设备 + 验证码写操作。

---

## 三、数据模型 (28 Collections)

```mermaid
graph TB
    subgraph 售前
        O[opportunities] --> FU[follow_ups]
        O --> DC[duplicate_checks]
        DC --> DA2[duplicate_appeals]
        O --> PA[price_applications]
        PA --> AP[approvals]
        O --> CT[contracts]
        O -->|90天| PP[public_pool]
    end
    subgraph 交付
        CT --> DO[delivery_orders]
        DO --> DT[delivery_tasks]
        DT --> AR[acceptance_records]
        AR --> CR[commissioning_records]
    end
    subgraph 渠道
        DG[dealer_orgs] --> DQ[qualifications]
        DG --> SA[service_assignments]
        DG --> DH[health_scores]
        DG --> RO[dealer_orders]
    end
    subgraph 设备
        SN[equipment_sns] --> MR[maintenance_records]
        SN --> ET[telemetry]
        SN --> CF[customer_feedback]
        CF -->|报修转| MR
    end
    subgraph 经济
        RP[rebate_policies] --> RA[rebate_accruals]
    end
    subgraph 业绩
        PT[performance_targets]
        DG[demand_gen_leads]
        KP[key_product_campaigns]
        DG -.->|转化| O
        PT -.->|对比| O
        KP -.->|关联| O
    end
    subgraph 推送
        NR[notification_rules]
        AM[alert_messages]
    end

    style O fill:#4F46E5,color:#fff
    style SN fill:#059669,color:#fff
    style CF fill:#F59E0B,color:#fff
    style DA2 fill:#EC4899,color:#fff
    style DH fill:#EC4899,color:#fff
```

---

## 四、L2C 十阶段流

```mermaid
graph LR
    S1[①意向登记] --> S2[②现场勘测] --> S3[③方案设计] --> S4[④招投标] --> S5[⑤商务报价] --> S6[⑥合同签订] --> S7[⑦生产发货] --> S8[⑧到货验收] --> S9[⑨施工调试] --> S10[⑩移交维保]
    S10 --> M[维保/巡检/报修]
    M --> R[精准召回]
    S1 -.->|90天无进展| PP[公海池]
    S1 -.->|撞单| AR2[仲裁/申诉]

    style S1 fill:#4F46E5,color:#fff
    style S7 fill:#059669,color:#fff
    style S10 fill:#F59E0B,color:#fff
    style R fill:#EF4444,color:#fff
```

> 经销商模式无回款阶段。每阶段时限管控 + 分级推送升级。

---

## 五、分级推送 + 升级阶梯

```mermaid
graph TD
    T[阶段超期/审批超时/回报逾期/维保到期/资质过期/IoT告警/甲方报修] --> NR[NotificationRule<br/>角色×紧急度×渠道]
    NR --> DM[去重+静默聚合]
    DM --> CH[渠道分发]
    CH --> L1[T+3 一线业务员]
    L1 -->|未处理| L2[T+7 经销商管理员]
    L2 -->|未处理| L3[T+15 区域经理]
    L3 -->|未处理| L4[转人工+AI归因]
    CH -->|企微/站内/短信/邮件| W[多渠道]

    style NR fill:#4F46E5,color:#fff
    style L4 fill:#EF4444,color:#fff
```

---

## 六、系统边界 — 三层切割 + 五桥

```mermaid
graph TB
    subgraph PMS外部域
        P1[经销商/服务商 · channel板块 · orgId隔离]
    end
    subgraph Tandem内部域
        T1[内部员工 · 全量模块 · tenantId隔离]
    end
    subgraph 甲方公开域
        C1[无账号 · /eq/token · 只读单设备]
    end
    B1[桥1:下游org关联] --- P1 & T1
    B2[桥2:PMS→OKR数据源] --- P1 & T1
    B3[桥3:中央AI受限surface] --- P1 & T1
    B4[桥4:IM推送通道] --- P1 & T1
    B5[桥5:分析报表→内网] --- P1 & T1
    C1 -.->|不进PMS| P1

    style P1 fill:#10B981,color:#fff
    style C1 fill:#F59E0B,color:#fff
    style B3 fill:#7C3AED,color:#fff
```

---

## 七、服务架构

```mermaid
graph TB
    subgraph 前端
        PG[页面: app/pms/* · app/eq/token · app/admin/pms/*]
        CP[组件: 看板/表单/时间线/健康分/扫码H5]
    end
    subgraph API层
        A1[/api/pms/* 经销商+内部<br/>channel板块守卫+orgId校验]
        A2[/api/public/* 甲方免登录<br/>token签名+验证码]
        A3[/api/admin/pms/* 内部管理]
    end
    subgraph Service层
        S1[opportunity-service]
        S2[duplicate-check + appeal]
        S3[stage-service + follow-up]
        S4[price + contract]
        S5[delivery + acceptance]
        S6[equipment-sn + recall + telemetry]
        S7[dealer-org + qualification + service-assign]
        S8[rebate + dealer-order + cpq]
        S9[customer-touchpoint]
        S10[dealer-health]
        S11[notification + escalation]
        S12[performance: target + comparison + dashboard + snapshot]
        S13[demand-gen + key-product]
    end
    subgraph AI层
        AI1[ai-duplicate-check]
        AI2[ai-delivery-risk]
        AI3[ai-maintenance-assistant]
        AI4[ai-production-forecast]
    end
    subgraph 存储
        KV[(KvStore 28 collections<br/>TandemStore)]
    end

    PG & CP --> A1 & A2 & A3
    A1 & A2 & A3 --> S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9 & S10 & S11 & S12 & S13
    S1 & S2 & S3 --> AI1 & AI2 & AI3 & AI4
    S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9 & S10 & S11 & S12 & S13 --> KV

    style A2 fill:#F59E0B,color:#fff
    style KV fill:#059669,color:#fff
    style AI1 fill:#7C3AED,color:#fff
```

---

## 八、四期分期

```mermaid
gantt
    title PMS 分期路线
    dateFormat YYYY-MM
    section 一期 MVP
    channel板块+角色+orgId隔离  :a1, 2026-09, 1M
    报备/查重/审批/跟进          :a2, 2026-09, 2M
    经销商账号体系               :a3, 2026-09, 1M
    section 二期 管控
    分级推送+升级阶梯            :b1, 2026-11, 1M
    90天管控+公海池              :b2, 2026-11, 1M
    撞单申诉(可提前)             :b3, 2026-11, 1M
    section 三期 交付+经济
    价格/合同/交付/资质/服务商   :c1, 2026-12, 2M
    SN基础+资产层级              :c2, 2026-12, 2M
    返利引擎+在线订货+CPQ        :c3, 2026-12, 2M
    返利可视+计划实际量           :c4, 2026-12, 2M
    section 四期 分析+售后+触点
    分析体系+报表                :d1, 2027-02, 2M
    SN全生命周期+召回            :d2, 2027-02, 2M
    IoT接入                      :d3, 2027-02, 1M
    甲方免登录触点               :d4, 2027-02, 1M
    健康分自查                   :d5, 2027-02, 1M
    业绩管理+线索开发+主推产品   :d7, 2027-02, 2M
    对外中央AI(闸就绪后)         :d6, 2027-03, 1M
```

---

## 九、产品红线 — 经销商价值配对

```mermaid
graph LR
    subgraph 管控动作
        C1[报备查重] → V1[防撞单·保护先报者]
        C2[阶段时限] → V2[超期预警·不被遗忘]
        C3[资质门槛] → V3[委托解药·不挡生意]
        C4[回报合规] → V4[换保护期·延期申请]
        C5[考核排名] → V5[健康分自查·无埋雷]
        C6[返利规则] → V6[进度可视·信任增强]
    end

    style V1 fill:#10B981,color:#fff
    style V5 fill:#EC4899,color:#fff
    style V6 fill:#EC4899,color:#fff
```

> **红线**: 每个管控动作必须配一个经销商可感知的价值，否则一线敷衍→数据失真→系统空壳。

---

## 十、甲方触点 — 打破信息黑洞

```mermaid
graph LR
    SN[设备SN二维码] -->|扫码| H5[/eq/token 只读H5]
    H5 --> F1[设备档案 型号/安装日]
    H5 --> F2[质保状态 保到何时]
    H5 --> F3[说明书/保养]
    H5 --> F4[报修入口]
    H5 --> F5[满意度回评]
    F4 -->|验证码| MR[自动转维保工单]
    F5 -->|直回瑞美| KV[(满意度真值)]
    KV -->|防粉饰| DH[经销商考核]
    RC[重大召回] -->|直达甲方| SMS[短信/扫码提示]

    style H5 fill:#F59E0B,color:#fff
    style KV fill:#059669,color:#fff
    style RC fill:#EF4444,color:#fff
```

> 满意度**直回瑞美不经经销商**，作考核真值来源。召回直达甲方满足合规知情权。

---

## 十一、竞品功能对标 (纯功能口径)

```mermaid
graph LR
    subgraph 国际标杆
        SF[Salesforce Mfg<br/>销售协议+AI Agent]
        DY[Dynamics 365<br/>IoT+智能排程]
        SM[ServiceMax/IFS<br/>资产层级+质保闭环+离线工单]
    end
    subgraph 国内标杆
        XY[销售易<br/>设备360+IoT]
        BJ[八骏DMS<br/>经销商全周期]
        FX[纷享销客<br/>渠道+CPQ+返利+订货]
        RT[瑞泰信息<br/>返利+服务链]
    end
    subgraph 瑞美PMS差异化
        D1[全链打通<br/>三轴串一条链]
        D2[资质+服务商委托<br/>行业首创]
        D3[分级推送升级<br/>渠道神经末梢]
        D4[中央AI原生<br/>查重/诊断/预测]
        D5[甲方触点<br/>打破信息黑洞]
    end

    SF -.->|学: AI处置| D4
    SM -.->|学: 资产层级| D1
    FX -.->|学: CPQ/返利| D1
    style D2 fill:#EC4899,color:#fff
    style D5 fill:#F59E0B,color:#fff
```

---

## 十二、风险全景

| 层 | 风险 | 状态 |
|---|---|---|
| **技术 P0** | F1 板块裸奔 / F2 唯一性 / F3 性能 / F4 AI越权 | ⚠️ 编码期必须闭合 |
| **产品 P1** | F11 经销商获得感弱→数据失真 | ✅ 设计已落地红线; ⚠️ 移动端极简待编码 |
| **合规 P1** | F14 召回知情权 / F13 满意度粉饰 | ✅ 设计已落地甲方触点 |
| **采纳** | 经销商不愿用 / 甲方不扫码 | 📊 上线后盯两个北极星: 录入率+扫码量 |
```

---

## 十三、业绩管理系统 — 管理闭环

```mermaid
graph LR
    subgraph 目标设定
        T1[年度总目标] --> T2[季度分解]
        T2 --> T3[区域×渠道×产品×经销商]
    end
    subgraph 实际采集
        O1[商机报备] --> S1[快照聚合]
        C1[合同成交] --> S1
        D1[交付履约] --> S1
        L1[线索开发] --> S1
    end
    subgraph 对比分析
        S1 --> CMP[对比引擎]
        T3 --> CMP
        CMP --> A1[实际vs目标·达成率]
        CMP --> A2[同比 YoY]
        CMP --> A3[环比 MoM]
        CMP --> A4[下钻归因]
    end
    subgraph 管理动作
        A4 -->|达成率<80%| AI[AI归因建议]
        A1 --> DASH[业绩看板]
        DASH --> ALT[预警推送]
    end

    style T1 fill:#4F46E5,color:#fff
    style CMP fill:#059669,color:#fff
    style AI fill:#7C3AED,color:#fff
    style DASH fill:#F59E0B,color:#fff
```

> **三层数据**: 目标 (PerformanceTarget) → 实际 (快照从商机/合同/交付聚合) → 对比 (达成率+同比+环比+归因)
>
> **与§6.7分析体系的区别**: 分析体系 = 描述性 (发生了什么, 实时查询); 业绩管理 = 管控性 (目标达成了没有, 差多少, 为什么, 预聚合快照)
>
> **线索开发 (DemandGenLead)**: 报备前的早期信号 (展会/推荐/外呼/数字营销) → 跟进 → 合格 → 转化为商机报备。线索漏斗转化率 = 线索开发管理核心指标。
>
> **主推产品 (KeyProductCampaign)**: 管理层指定重点型号, 配套价格激励+返利加码+重点区域+重点经销商, 跟踪推广达成率。
