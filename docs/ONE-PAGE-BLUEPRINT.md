# 瑞合数智枢纽 · 一页纸层级蓝图

> 2026-07-06 · 数据库收敛后。用户 → 应用 → 认证/代理 → 后端领域（功能）→ PostgreSQL（数据关系），一图看全。
> 详版见 `docs/ARCHITECTURE-BLUEPRINT.md`。

```mermaid
flowchart TB
  %% ───────── 用户层 ─────────
  subgraph U["① 用户"]
    C["C端消费者"]
    D["经销商/设计师/员工"]
    K["签约客户"]
  end

  %% ───────── 应用层 ─────────
  subgraph A["② 前端应用 · apps/* (Next.js)"]
    PP["集团门户<br/>public-portal :4005"]
    DW["经销商工作台 · 登录中心<br/>dealer-workbench :4000"]
    DS["设计师工作台<br/>designer-workbench :4003"]
    CP["客户门户<br/>customer-portal :4002"]
  end

  %% ───────── 认证 + 代理 ─────────
  subgraph G["③ 认证 & 网关"]
    SSO["cookie SSO · nx_token<br/>packages/shared-auth"]
    PX["Express :3001 反向代理<br/>/api/v2/** → NestJS"]
  end

  %% ───────── 后端领域层（功能）─────────
  subgraph API["④ 后端唯一真相源 · services/api (NestJS :3300, /api/v2)"]
    direction LR
    AUTH["auth<br/>登录·JWT·租户范围"]
    CRM["crm<br/>线索→商机→签单"]
    BIM["rysnova-bim<br/>承接·深化·产物·签收"]
    DESIGN["design / ai-design<br/>精算·2D·放行"]
    DELIV["delivery / lifecycle<br/>交付·验收·移交"]
    CAT["product-catalog / quote<br/>选型·报价"]
    ANA["analytics / governance"]
  end

  %% ───────── 数据层 ─────────
  subgraph DB["⑤ 数据层"]
    PG[("PostgreSQL · RLS 租户隔离<br/>rhautt_nexus.*  (TypeORM + 迁移)")]
    OBX[["outbox 事件<br/>mdm_outbox_events"]]
    OBJ[/"对象存储<br/>产物/图纸/PDF"/]
    RDS[("Redis · 缓存/会话")]
  end

  %% 逻辑流程
  C --> PP --> DW
  D --> DW
  DW -->|登录成功写 cookie| SSO
  DW --> DS
  K --> CP
  DS -. 未登录跳登录 .-> DW

  PP & DW & DS & CP -->|同源 /api/v2/* + credentials| PX
  SSO -. nx_token 随请求 .-> PX
  PX --> AUTH

  AUTH --> CRM --> BIM --> DESIGN --> DELIV
  CAT --> CRM
  BIM --> DELIV
  DELIV --> CP
  ANA -.读.- CRM & BIM & DELIV

  AUTH & CRM & BIM & DESIGN & DELIV & CAT & ANA --> PG
  BIM & CRM & DELIV --> OBX
  BIM --> OBJ
  API --> RDS
```

## 核心业务流（一句话）

`线索(crm) → 签单(crm) → 承接/深化(rysnova-bim) ↔ 精算放行(design) → 交付/验收(delivery·lifecycle) → 客户看进度(customer-portal)`，每次写库在同一 RLS 事务内写 `outbox` 事件驱动跨域。

## 数据库关系（PostgreSQL · schema `rhautt_nexus`）

```mermaid
erDiagram
  tenants ||--o{ users : "租户下用户"
  tenants ||--o{ customers : ""
  customers ||--o{ opportunities : "商机"
  opportunities ||--o| quotations : "报价"
  quotations ||--o| contracts : "签约"
  contracts ||--o| bim_projects : "承接BIM项目"
  bim_projects ||--o{ rysnova_bim_artifacts : "深化产物"
  contracts ||--o| lifecycle_links : "生命周期串联"
  lifecycle_links ||--o{ delivery_records : "交付记录"
  tenants ||--o{ mdm_outbox_events : "领域事件(至少一次投递)"

  tenants { uuid id PK }
  users { uuid id PK  uuid tenant_id FK  text phone_hash }
  customers { uuid id PK  uuid tenant_id FK }
  opportunities { uuid id PK  uuid customer_id FK }
  quotations { uuid id PK  uuid opportunity_id FK }
  contracts { uuid id PK  uuid quotation_id FK }
  bim_projects { uuid id PK  uuid quotation_id FK }
  rysnova_bim_artifacts { uuid id PK  uuid tenant_id FK  jsonb artifact_doc }
  lifecycle_links { uuid id PK  uuid contract_id FK  uuid bim_project_id }
  delivery_records { uuid id PK  uuid bim_project_id }
  mdm_outbox_events { uuid id PK  uuid tenant_id FK  text event_type }
```

> 聚合只读视图 `v_bim_project_delivery` = `bim_projects` ⋈ `lifecycle_links` ⋈ `delivery_records` ⋈ `contracts`，供 rysnova-bim 一屏查交付全景。

## 三条铁律

| # | 规则 |
|---|---|
| 1 | 后端**唯一真相源 = NestJS(:3300)/PostgreSQL**；`/api/v2/**` 全量走它。MongoDB 已从真相源下线（仅遗留 Express legacy 自用）。 |
| 2 | 前端**同源相对 `/api/v2/*` + `credentials:'include'`**；认证靠共享 cookie `nx_token`，禁止硬编码端口。 |
| 3 | 所有租户数据经 **Postgres RLS + `withRlsTransaction`** 隔离；写业务与写 `outbox` 事件同事务原子。 |
