# Rhautt Nexus · 设计总索引 + 实施路线图（总纲）

> 状态：现行总纲 · 2026-06-30
> 作用：板块二（瑞诺瓦/Rysnova 经销商赋能）全部设计资产的**唯一索引** + **W0→W6 实施路线图** + **决议总账**。进入实现期从本文件入口。

---

## 1. 文档地图（分层，MASTER 统领）

| 层 | 文档 | 职责 | 状态 |
|---|---|---|---|
| **0 主蓝图** | `RHAUTT-NEXUS-MASTER-ARCHITECTURE-AND-DECOUPLING-BLUEPRINT.md` | 分层架构 + 解耦重组(Strangler) + 三件套独立/协同数据库架构 + 重组基线决议 | ✅ 定稿 |
| **1 数据口** | `RHAUTT-NEXUS-MODULE-COMPLETENESS-AND-DATAPORT-BLUEPRINT.md` | 模块完整性 + 主数据脊柱 + 契约 + 单一 outbox | ✅ |
| **2 承接** | `RHAUTT-NEXUS-INTAKE-BUS-AND-OUTBOX-DESIGN.md`（Part②） | 多品牌统一收口 + lead.captured 事件契约 + 订阅扇出 + 配置化入口 | ✅ |
| **2 承接** | `RHAUTT-NEXUS-LEAD-HANDOFF-DESIGN.md` | ToC→ToB 交接层：同意闸/撞单/派单/归属/接单 | ✅ |
| **3 问诊→设计** | `RHAUTT-NEXUS-DESIGN-CALC-RECLAIM-PLAN.md`（W1） | 五系统精算 + 五恒维度 + 必算校验闸 + 签章 | ✅ |
| **4 经营** | `RHAUTT-NEXUS-CRM-ATTRIBUTION-CONFLICT-HANDOVER-DESIGN.md`（W2） | CRM §4.8 归属/撞单裁决/离职交接 | ✅ |
| **5 财务+交付** | `RHAUTT-NEXUS-FINANCE-DELIVERY-LIFECYCLE-DESIGN.md`（W3+W4） | 电子签/收款/分期/发票 + 施工/验收/IoT交接 | ✅ |
| **6 状态** | `RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md` | 客户/项目生命周期状态机 | ✅ |
| **7 品牌站** | `EVERHOT-NEXUS-INTEGRATION-DESIGN.md` | 品牌站接入承接总线 | ✅ |
| **8 收敛台账** | `RHAUTT-NEXUS-DUAL-IMPLEMENTATION-CONVERGENCE-LEDGER.md`（W5/W6） | Legacy↔Target 双实现配对：当前真相源/切换条件/归档时机 | ✅ 现行 |

> 主数据脊柱（全文档共识）：`intake_lead_id → customer_id → opportunity_id → (报告/设计/报价/BIM产物) → lifecycle_link_id`；跨件套软引用 + 单一 outbox，无硬外键。

---

## 2. 实施路线图（W0→W6）

| 波次 | 内容 | 依赖 | 设计来源 | 状态 |
|---|---|---|---|---|
| **W0 防回退** | Nginx 网关渐进切流 + 删 nx + boundary guard 扩展 + legacy 冻结只读 | 决议 B1/B2 | MASTER Part2/5/6 | 设计就绪 |
| **W1 精算归位** | design 五系统 + 校验闸 + 内核迁 kernels + 新建 noise + 签章 | 决议#1/#2/#4 | calc-reclaim | 设计就绪（可与 W0 并行先行） |
| **W2 经营脊柱** | 承接总线(outbox) + 交接层(派单) + opportunity 强制 + CRM 归属/撞单/交接 | W0 | Part②/handoff/CRM§4.8 | 设计就绪 |
| **W3 报价财务** | 电子签(经销商) + 收款节点 + 分期 + 发票 + 快照锁联动 | W2 | finance-delivery W3 | 设计就绪 |
| **W4 交付闭环** | 施工里程碑 + 验收 + IoT handoff 去 mock + lifecycle 归位 | W3 | finance-delivery W4 | 设计就绪 |
| **W5 前端迁移** | src/ 整体迁一个 app → 再按受众拆；frontend/ 归档 | — | MASTER 决议 B5 | 设计就绪 |
| **W6 收尾** | 数据迁移收口 + 目录归档 + legacy 下线 | 全部绞杀完成 | MASTER 决议 B3/B4 | 设计就绪 |

**依赖主线**：`W0 ─┬─ W1(并行)` ；`W0 → W2 → W3 → W4`；`W5/W6` 收尾。

> 🔒 **横切地基已锁定（2026-06-30，MASTER Part 7）**：W2/W4 数据迁移依赖的 **PostgreSQL RLS 多租户强隔离地基**已先行交付并本地真库验证（`db:rls-proof` 6/6 全绿，提交 `658db6b` + 006）。后续各波次领域表迁移**直接复用**：建表挂 `tenant_id` + FORCE RLS + 读写走 `withRlsTransaction`，不再重造隔离机制。证据见 `docs/DATABASE-WORLD-CLASS-DELIVERY.md`。

---

## 3. 决议总账（已拍板）

**精算/校验（设计精算归位）**
- #1 校验闸精度基线 = 国标为底线，企标更严不更松；建回归基准集。
- #2 噪声内核 = 新建独立 `noise` kernel。
- #3 对外口径 = 两层模型（系统独立 + 五恒维度层）；五恒≠五系统；湿度=恒湿维度独立除湿。
- #4 签章责任 = 经销商自负合规 + 电子签；平台仅提供工具/存证，不背书、不深度介入。

**三件套数据库架构（MASTER §1.6）**
- 三件套独立可上线，经 `opportunity_id` + outbox 协同；跨件套软引用、无硬外键、应用层聚合。
- opportunity 强制仅协同态；独立态产线索产物挂 `intake_lead_id`，进 CRM 升格。

**重组基线（MASTER Part6）**
- B1 网关 = Nginx 反代渐进切流；B2 构建 = 只留 pnpm 删 nx；B3 数据迁移 = 逐表双写→校验→切读；B4 legacy 下线 = 契约测试+灰度100%+观察2周；B5 apps = 先整体迁后拆。

**承接/经营实现基线（2026-06-30）**
- C1 outbox = **Postgres 事务性 outbox 表 + 轮询投递**（不引 MQ，规模到瓶颈再演进）。
- C2 dealer 租户边界 = **租户内 dealer_id 子作用域**（非独立租户）；跨 dealer 撞单在 intake 未归属池以平台系统态裁决（用 phoneHash 不破 RLS）。

**数据层地基（已锁定，MASTER Part 7）**
- D1 租户隔离 = **DB 层 RLS 强隔离**（`TenantContextInterceptor` → `withRlsTransaction` SET LOCAL → `tenant_id=current_tenant_id()` 策略）；迁移驱动 schema（migrations 001–006）+ 漂移保护。
- D2 共享/单写例外 = `products`(`rhautt_shared` 哨兵) + `mdm_*`(scope 策略) 不纳 uuid 租户隔离。
- ✅ **P2 已拍板（2026-06-30）= 合并为单一 `outbox_events`**：`mdm_outbox_events` 并入，落实 C1「单一 outbox」原则；以 `event_source`/`aggregate_type` 字段区分来源，订阅层按需过滤。

---

## 4. 进入实现期的入口动作

**立即可启（不互相阻塞）**
1. **W0-a**：建 Nginx 网关骨架，`/api/v2/*` 默认回落 legacy，预留逐路由切流开关。
2. **W0-b**：删 `nx.json`，确认 pnpm workspace 单一化；扩展 `guard:nestjs-boundary`（禁 apps→server、禁重写 kernels、禁跨应用 import）。
3. **W1-a**（与 W0 并行）：`design.service` 改连 `packages/domain/hvac-kernels`；迁 OneClick/WaterSystem/FiveConstant(control)/CommercialTax + 新建 noise；建校验闸 + `POST /design/calc`。

**每波验收红线**：`test:contracts`（OpenAPI）+ `test:tenant-isolation`（RLS）+ 该波专项基准（W1=精算基准集，W2=归属/撞单用例，W3=收款联动，W4=验收→IoT）。

---

## 5. 仍待拍板（汇总各文档开口项）
- **承接总线**：outbox 技术选型（建议 Postgres 事务性 outbox）；DLQ/重试；dedup 窗口。
- **CRM §4.8**：dealer 是否同租户（跨 dealer 撞单域）；保护期参数；公海池；裁决默认。
- **财务/交付**：电子签选型（e签宝/法大大）；分期资方是否本期；发票开票 API；IoT 协议（复用 MqttBrokerEngine?）。
- **重组**：网关灰度粒度；数据迁移双写细节。

**数据层地基带出的新闸（MASTER Part 7.4）**
- **P0 上线闸**：非本地 `POSTGRES_STAGING_URL` 的 `release:postgres-staging:smoke`（产 `finalLaunchDatabaseProof`）；生产用**非属主最小权限角色**连接。
- **P1 特权路径**：`auth`(users)/`tenant`(dealers/stores) 登录与 HQ 引导态先于租户上下文，需独立特权 DB 路径/角色；`bim.publicLookup` 跨租户公开读需 SECURITY DEFINER / BYPASSRLS 只读角色。
- ✅ **P2 outbox 合并（已拍）= 单一 `outbox_events`**：`mdm_outbox_events` 并入；`event_source` 区分 mdm/业务，订阅层过滤。

> 核心开口均已拍定（C1/C2/D1/D2/P2）。余下随实现细化：DLQ/重试、dedup 窗口、保护期参数、公海池、电签选型、P0 上线闸、P1 特权路径。
