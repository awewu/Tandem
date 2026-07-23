# Rhautt Nexus · W0+W2 主攻突击落地清单

> 状态：现行 · 2026-06-30 · 前置：数据层世界级地基已锁定、实体↔迁移漂移已清零（见 `DATABASE-WORLD-CLASS-DELIVERY.md` / `RHAUTT-NEXUS-ENTITY-MIGRATION-DRIFT-LEDGER.md`）。
>
> **战法**：绞杀式迁移（Strangler Fig）。NestJS `/api/v2` 主干上位，legacy `server/`(Express) 退居被代理；按业务脊柱逐段切流，旧路由验证一段、绞杀一段。
>
> **三路突击**：W0 主干上位（地基→可跑）· W2 经营脊柱（线索→交付闭环）· 板块二首个前线 app（瑞诺瓦诊断跑通）。

---

## 战役地图（依赖序）

```
W0-1 staging 库就位 ──┬─► W0-2 迁移 apply+RLS证据 ──► W0-3 API 接真库启动
                      │
                      └─► W0-4 绞杀路由(网关) ──► W0-5 Auth 切流 ──► W0-6 守卫入 CI
                                                        │
                              W2 经营脊柱 ◄─────────────┘
   W2-1 CRM ─► W2-2 Quote ─► W2-3 签单→BIM ─► W2-4 lifecycle ─► W2-5 Outbox 事件
                                                        │
                              板块二前线 app ◄──────────┘
   S2-1 诊断会话 ─► S2-2 分享/线索回流 ─► S2-3 app shell 上线
```

---

## W0 · 主干上位（地基 → 可跑）

| # | 任务 | 现状 | 出口闸 | 阻塞 |
|---|---|---|---|---|
| **W0-1** | staging Postgres 就位（实例 + `POSTGRES_STAGING_URL` + 最小权限角色 app_rw/migrator） | 未配置 | 连接通 + 角色分离 | **需运维提供实例/密钥** |
| **W0-2** | apply 001–008 + drift 保护 + RLS 证据（**经实体路径**而非裸 SQL） | 脚本就绪（`db:migrate`/`rls-apply-proof`） | 全迁移 applied、`schema_migrations` 记录、跨租户读写被拒证据 | 依赖 W0-1 |
| **W0-3** | NestJS API 接 staging 真库启动 + 全模块 boot-smoke | 18 模块就绪、boot-smoke mock 通 | 真库下 `/health` + 各模块 DI 启动无错 | 依赖 W0-2 |
| **W0-4** | 绞杀路由网关：`/api/v2`→Nest，未迁移端点→proxy 旧 Express | 两套并存、未编排 | 单一入口、迁移端点命中 Nest、其余透传 | — |
| **W0-5** | Auth 切流：登录走 SECURITY DEFINER `auth_lookup_user_by_phone_hash` 预认证 | 已编码（007/auth.service） | 真库登录签发 JWT + 租户上下文贯通 | 依赖 W0-3 |
| **W0-6** | 守卫入 CI：schema-guard / rls-proof / boot-smoke / module-boundary / nestjs-boundary | 脚本已存在 | PR 全绿门禁 | — |

**W0 验收**：staging 真库上 Nest 主干启动、登录闭环、RLS 拒绝跨租户、CI 五道守卫常绿。

---

## W2 · 经营脊柱（线索 → 交付闭环）

| # | 任务 | 现状 | 出口闸 |
|---|---|---|---|
| **W2-1** | CRM：createLead / pipeline / customer360 接真库 | 已切 `withRlsTransaction` | 建线索→看板→360 全链路真库通过 |
| **W2-2** | Quote：generate / persist / lock + 价格护栏 | 已切 RLS；锁价 M11 就绪 | 报价持久化 + 锁价幂等 + 护栏 block 生效 |
| **W2-3** | 签单 → BIM 承接 | `crm.sign()→bim.inheritFromQuotation` 已接 | 签单自动生成 BIM 项目（真库） |
| **W2-4** | lifecycle_links 串联 | ✅ **已落地**：`LifecycleService.advanceInTx(em)` 同事务 upsert；CRM `createLead`(lead)、`sign`(signed) 在其 RLS 事务内推进串联+记录流转时间线 | lifecycle 由 Nest 在签单/交付事务内写入 |
| **W2-5** | Outbox 事件发射（写业务库同事务写 `mdm_outbox_events`） | ✅ **已落地**：`EventBusService.publishInTx(manager)` 同事务发射；CRM `lead.created`/`opportunity.signed`、Quote `quotation.created`/`quotation.locked` 已接入 | 关键写操作产出 outbox 事件 + 投递器消费 |

**W2 验收**：一条真实单据走完「线索→商机→报价→签单→BIM→lifecycle」，跨段事件经 outbox 流转。

> **注**：`lifecycle`/`delivery` 仍由 legacy 引擎写库 → W2-4 是绞杀重点；Outbox（W2-5）是板块间不直连的总线落地。

---

## 板块二首个前线 app · 瑞诺瓦消费诊断

| # | 任务 | 现状 | 出口闸 |
|---|---|---|---|
| **S2-1** | 诊断会话：`diagnosis.service` 接真库 `diagnosis_sessions` | 已切 `withRlsTransaction`、公共查询保留 | 诊断生成会话 + 报告（真库） |
| **S2-2** | 分享/线索回流：诊断报告 → CRM 线索（share token → createLead） | ✅ **回流信号已落地**：`completeDiagnosis` 同事务发射 `diagnosis.completed`(带 customerId/opportunityId/reportId/shareTokenHash)，供 CRM/lifecycle 消费 | 分享链接落地 + 回流生成 CRM 线索 |
| **S2-3** | app shell：`apps/consumer-diagnosis` 独立壳上线（portal 嵌入 + standalone 可启） | 目标态产物存在 | `/pain-diagnosis.html` 入口经 Next app shell 跑通 |

**S2 验收**：消费者完成诊断→生成报告→分享→回流为 CRM 线索，前线 app 以独立壳运行（Powered by Rhautt）。

---

## 突击节奏建议（3 波）

- **波1（解阻塞）**：W0-1→W0-2→W0-3（真库 + 迁移 + API 启动）。**关键路径，先打通。**
- **波2（脊柱+网关）**：W0-4/W0-5/W0-6 与 W2-1→W2-3 并行；S2-1 起步。
- **波3（闭环）**：W2-4/W2-5（lifecycle+outbox 绞杀）+ S2-2/S2-3 前线上线。

## 立即可做（不等 staging）
- W0-4 网关编排、W0-6 CI 守卫接线、W2-5 outbox 发射代码、S2-2 回流逻辑——**均为代码侧，不依赖真库**，可即刻推进，等 staging 到位即联调。

## 唯一硬阻塞
**`POSTGRES_STAGING_URL`（W0-1）** —— 需运维提供 staging Postgres 实例与连接密钥；到位即可连跑 W0-2/3 与全部真库验收。

## 联调验收剧本
staging 到位后的逐步命令 + 出口闸 + 库侧核对，见 `docs/RHAUTT-NEXUS-STAGING-CUTOVER-RUNBOOK.md`（W0-1→W0-3 + W2 脊柱 HTTP 闭环 + S2-2 诊断回流 + 守卫/证据落盘）。
