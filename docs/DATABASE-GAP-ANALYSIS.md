# 数据库设计 vs 宪章/PRD 差距分析与世界级交付评估

> 日期：2026-06-29 · 事实源：`PROJECT-CHARTER.md`(v1.5) §5.3–5.5 · `docs/DATABASE-BACKEND-ARCHITECTURE.md` · `docs/DATABASE-WORLD-CLASS-DELIVERY.md` · `evidence/database/*` · `evidence/release-evidence.json`
> 上级仲裁：宪章为单一事实源(PRD 冲突以宪章为准，宪章 §1.4)。
> 一句话结论：**设计(蓝图)达到世界级；交付(上线证据)未达。** 当前在「目标契约 + 本地正确性证据」阶段；`release-evidence.json` `status: not-production-complete`，所有数据库证据 `finalLaunchDatabaseProof: false`。

---

## 1. 评分总览

| 维度 | 宪章条款 | 设计 | 交付证据 | 评分 |
|---|---|---|---:|---|
| PG 核心账本 + schema 契约 | §5.3 / §5.5.1 | ✅ | guard 0 failures（target-contract） | 🟢 设计达标 |
| RLS 多租户隔离（标准档） | §5.4 | ✅ | 本地真库 6/6 pass | 🟢 设计达标·本地验证 |
| RLS 强隔离档 / 物理隔离档 | §5.4 | ✅ 模型预留 | 抽取演练无证据 | 🟡 仅能力预留 |
| 审计 / outbox / workflow 表 | §5.3 | ✅ | guard 0 failures | 🟢 设计达标 |
| namespace 可抽取 | §5.4 | ✅ 注册列齐备 | 无抽取演练 | 🟡 |
| 四数据平面物理隔离 | §5.5.1 | ✅ 蓝图 | 单 schema，未分库 | 🔴 未落地 |
| MongoDB 文档库 | §5.3 | ✅ 蓝图 | 仅 Express 兼容主干 | 🔴 主干缺集成 |
| Redis 缓存/会话/限流 | §5.3 | ✅ 蓝图 | external-proof-blocked | 🔴 无证据 |
| 对象存储 namespaced | §5.3 | ✅ file-artifact | 无 staging 证据 | 🟡 |
| Temporal + Outbox | §5.3 / §5.5.3 | ✅ | replay smoke，无 Temporal worker | 🟡 |
| MDM 单写 + CDC/ELT→数仓 | §5.5.2/3 | ✅ 蓝图 | 未建 | 🔴 未落地 |
| 统一事件总线 + schema registry | §5.5.3 | ⏳ defer P3/P5 | 仅 outbox | 🔴 未建 |
| 统一数据字典 / 全局 ID | §5.5.3 | ✅ uuid 规范 | 部分 | 🟡 |
| HA / 故障切换 / PITR / 恢复演练 | §5.5.4/5 | — | 无 | 🔴 无留证 |
| 静态加密 + PII 列级加密 | §5.5.4 | — | 迁移未见 | 🔴 未实现 |
| Staging 上线证据 | §5.5.5 | — | `missing-staging-run` | 🔴 硬门未过 |
| 应用非属主连接角色 | 交付文档 | — | 未落地 | 🟡 |
| 服务采用 `withRlsTransaction` | 交付文档 | ✅ 机制就绪 | 裸 repository 未全切 | 🟡 灰度未完成 |

图例：🟢 达标 · 🟡 部分/能力预留 · 🔴 缺失或仅蓝图。

---

## 2. 已达标项（设计 + 本地已验证）

- **PG 核心账本契约**：`database/postgres/migrations/001_rhautt_nexus_core_ledger.sql`(+002/003)，17 表 / 13 张租户表；`npm run guard:postgres-target-schema` 0 failures（`release-evidence.json` `postgresTargetSchema`）。
- **RLS 强隔离**：`rhautt_nexus.current_tenant_id()` 读 `current_setting('app.tenant_id')` + 业务表 FORCE RLS + `*_tenant_isolation` 策略（USING + WITH CHECK）。运行时 `services/api/src/modules/common/rls.ts` `withRlsTransaction()`（参数化 `set_config(..., true)`）+ `tenant-context.interceptor.ts`（AsyncLocalStorage）已就绪。
- **本地真库证据 6/6 pass**：`evidence/database/local-rls-apply-proof.md` — 迁移可应用、租户内写入通过、跨租户写被拒（PG `42501`）、跨租户读隔离（0 行）、7 表 FORCE RLS。Migration SHA-256 锁定。
- **迁移可复现**：`scripts/db/apply-migrations.js` 幂等运行器 + 漂移保护 + `public.schema_migrations(filename, sha256)`；`db:migrate` / `db:migrate:status` / `db:migrate:dry-run`。
- **namespace 可抽取**：`product_modules / *_deployments / *_data_partitions` 注册列齐备（满足 §5.4 namespace-extractable / futureDatabaseStrategy）。

---

## 3. 差距明细（未达世界级交付）

### 3.1 架构落地（设计已定，未物理实现）
- **四数据平面物理隔离（§5.5.1）**：宪章要求底座主库 / 赋能体系库（PG-RLS + Mongo）/ 品牌运营库 / 分析数仓为**独立集群**；现状是单一 `rhautt_nexus` schema。逻辑边界在，物理分库未做。
- **MongoDB（§5.3）**：问诊/设计/BIM 文档库仅存在于 Express 兼容主干；NestJS PG 主干未集成 Mongo。
- **MDM 单写 + CDC/ELT → OLAP 数仓（§5.5.2/3）**：无 CDC 管道、无分析数仓、无对账报告。

### 3.2 运行时与基础设施（缺证据）
- **Redis（§5.3）**：`REDIS_*` 未配置，external-proof-blocked。
- **Temporal（§5.3）**：仅 outbox 表 + 兼容 outbox 测试 + workflow replay smoke；无 Temporal worker，`finalLaunchWorkflowProof: false`。
- **对象存储（§5.3）**：`file-artifact` 模块 + rysnova-bim 产物链路在，但无真实对象存储 staging 证据。
- **HA/DR（§5.5.4/5）**：主从复制、故障切换、pgbouncer 分板块、PITR、恢复演练 —— 全部无留证。
- **加密（§5.5.4）**：静态加密 + PII 列级加密未实现。

### 3.3 上线门（硬阻断）
- **Staging smoke（§5.5.5）**：`evidence/database/postgres-staging-smoke-report.md` = `missing-staging-run`，原因 `POSTGRES_STAGING_URL is not configured`。`external-proof-validation` **故意拒绝 localhost**，防止本地冒充上线证据。这是产出 `finalLaunchDatabaseProof` 的唯一硬门。

### 3.4 代码侧收尾（可由工程直接完成）
- **服务全量切 `withRlsTransaction`**：机制就绪，裸 repository 写路径未全切。
- **应用非属主最小权限角色**：属主会绕过非 FORCE 的 RLS（迁移已 FORCE，仍建议最小权限）。

---

## 4. 世界级交付判定

**否，尚未达成完整世界级交付；但地基是世界级的。**

- **达标（设计/契约/守卫）**：schema 契约、RLS 模型、namespace 可抽取、迁移可复现 + 漂移保护、SHA 锁定、守卫门禁 0 failures、本地真库 RLS 6/6。符合宪章「机器强制纪律」与世界级 SaaS「RLS 打底 + 按需物理隔离」模型（§5.4）。
- **未达标（运行/上线证据）**：四平面物理隔离、Mongo/Redis/Temporal/对象存储 runtime、CDC + 数仓、事件总线、HA/DR/PITR、加密、staging 上线证据 —— 均为宪章 §5.5.4/5.5.5 明确验收项，目前缺失或仅本地模拟。
- 交付文档自身已诚实标注边界：`DATABASE-WORLD-CLASS-DELIVERY.md` 写明「本地正确性证据，非上线证据，`finalLaunchDatabaseProof: false`」。

---

## 5. 优先级路线图（升到世界级交付）

| # | 行动 | 宪章 | 依赖 | 谁来做 |
|---|---|---|---|---|
| P0 | 配 `POSTGRES_STAGING_URL`（非本地）跑 `release:postgres-staging:smoke` → 产 `finalLaunchDatabaseProof` | §5.5.5 | 真实 staging PG | 运维提供凭据 |
| P0 | 服务写/读路径全量切 `withRlsTransaction` + 应用用非属主角色 | §5.4 | 无（纯代码） | 工程可直接做 |
| P1 | 四数据平面物理分库（底座 / 赋能 PG+Mongo / 品牌运营 / 数仓） | §5.5.1 | 基础设施 | 运维 + 工程 |
| P1 | NestJS 主干集成 MongoDB（问诊/设计/BIM 文档域） | §5.3 | Mongo 实例 | 工程 |
| P2 | HA：主从复制 + 故障切换 + pgbouncer 分板块 | §5.5.4 | 基础设施 | 运维 |
| P2 | DR：PITR + 定期恢复演练留证 | §5.5.5 | 基础设施 | 运维 |
| P2 | Redis（缓存/会话/限流）+ Temporal worker 上线 smoke | §5.3 | 实例 | 运维 + 工程 |
| P3 | MDM 单写 + CDC/ELT → OLAP 数仓 + 对账报告 | §5.5.2/3 | 数仓 | 工程 + 数据 |
| P3 | 统一事件总线选型（Kafka/NATS/Redis Stream）+ schema registry | §5.5.3 | 选型决策 | 架构 |
| P3 | 静态加密 + PII 列级加密 | §5.5.4 | KMS | 工程 + 安全 |

> **唯一硬上线门 = P0 staging smoke**；其余为工业级完备度项，多数强依赖真实基础设施/凭据。

---

## 6. 现在能立即推进的（无需外部基础设施）
- 本地：`npm run db:migrate:status`（查看迁移漂移/状态）、`npm run db:rls-proof`（本地真库 RLS 证据，需本地 PG）。
- 代码：把租户作用域写路径切到 `withRlsTransaction`（P0 代码侧）。
- 阻断项：staging smoke 需你提供**非本地** `POSTGRES_STAGING_URL`（harness 拒绝 localhost）。

---

## 7. P0 代码侧改造进展（withRlsTransaction 落地）

### 7.1 已完成（`tsc --noEmit -p services/api/tsconfig.json` 全绿）
所有 NestJS + TypeORM 的租户作用域读写已从「直接注入 `Repository`」改为「`@InjectDataSource()` + `withRlsTransaction(ds, work, scope)`」，在事务内 `SET LOCAL app.tenant_id`，使 RLS 在 DB 层生效：

| 服务 | 涉及表 | 表是否已 FORCE RLS | 改造后是否即时生效 |
| --- | --- | --- | --- |
| `crm.service.ts` | customers / opportunities / interactions | customers、opportunities ✅；interactions ❌ | 前两者即时生效 |
| `quote.service.ts` | quotations | ✅ | 即时生效 |
| `file-artifact.service.ts` | file_artifacts | ✅ | 即时生效 |
| `rysnova-bim/design-sync.service.ts` | design_rysnova-bim_sync | ✅ | 即时生效 |
| `diagnosis.service.ts` | diagnosis_sessions | ❌（无迁移） | 前向兼容 |
| `design.service.ts` | design_projects / floor_plans | ❌（无迁移） | 前向兼容 |
| `rysnova-bim/bim.service.ts` | bim_projects | ❌（无迁移） | 前向兼容 |

### 7.2 有意排除（附理由）
- `auth.service.ts`（users，FORCE RLS）：登录/注册发生在**租户上下文确立之前**，需按邮箱跨租户解析；不能简单按 `user.tenantId` 绑定事务。**须独立鉴权 DB 路径/特权角色**（foundation P0/P1）。
- `tenant.service.ts`（dealers/stores，FORCE RLS）：HQ 引导态创建租户/经销商/门店；需管理员/特权路径。**foundation 项**。
- `mdm.service.ts` / `mdm/event-bus.service.ts`（mdm_global_products / mdm_outbox_events）：单写主数据，含 shared/owned/private 混合行，RLS 用 scope 策略而非纯租户隔离；维持现状。
- `product-catalog.service.ts`（products，默认 `tenantId='rhautt_shared'` 非 uuid 哨兵）：共享目录、HQ 写；`current_tenant_id()::uuid` 不适用。
- `lifecycle` / `governance` / `delivery` / `workflow`：委托 legacy Express 层或纯门面，**无 NestJS TypeORM 写路径**。
- `bim.service.ts#publicLookup`：跨租户公开查询（无登录），保留直连不绑定 GUC；**FORCE RLS 上线后须专用公共读路径**（SECURITY DEFINER 函数或 BYPASSRLS 只读角色）。已在代码标注 `TODO(P1)`。

### 7.3 DB 侧缺口与 migration 004（已落地）
**问题**：以下租户业务表此前**无任何 SQL 迁移、无 RLS 策略**，隔离仅靠应用层 `WHERE tenantId`：
`bim_projects`、`design_projects`、`floor_plans`、`diagnosis_sessions`、`interactions`、`delivery_records`、`rysnova-bim_artifacts`、`lifecycle_links`、`notifications`、`analytics_events`、`price_list_items`、`products`。

**已交付**：`database/postgres/migrations/004_business_tables_rls.sql`，与 001/002 同规范（`tenant_id uuid REFERENCES tenants(id)`、`current_tenant_id()`、`tenant_isolation`），分两阶段处理以**避免阻断未改造写入方**：

| 阶段 | 表 | 处理 | 依据 |
| --- | --- | --- | --- |
| **A 立即强隔离** | `interactions`、`diagnosis_sessions`、`design_projects`、`floor_plans`、`bim_projects` | 建表 + `ENABLE/FORCE RLS` + `tenant_isolation` | 写入方已全部切 `withRlsTransaction`，事务内 `SET LOCAL app.tenant_id`，RLS 即时生效 |
| **B 仅建表（暂缓 RLS）** | `delivery_records`、`rysnova-bim_artifacts`、`lifecycle_links`、`notifications`、`analytics_events`、`price_list_items` | 仅建表，**不**启用 RLS | 写入方仍为 legacy Express / 未转换服务；现在 FORCE RLS 会阻断写入。待写入方改造后由 `005_*.sql` 启用 |
| **共享目录** | `products` | 建表（`tenant_id text default 'rhautt_shared'`），**不纳入** uuid RLS | HQ 共享、全租户读，非纯租户隔离 |

> 注：列名遵循项目约定（多词列显式 snake_case）；唯一例外 `bim_projects."costBreakdown"`（实体未显式命名 + 无 TypeORM 命名策略 → 列名按属性名原样，迁移中以引号保留驼峰）。
> `tenant_id` 在 staging（`POSTGRES_SYNCHRONIZE=false`、迁移驱动）为 uuid；dev 若曾经 synchronize 自动建表（varchar/无 RLS），需重置后改由迁移建表。

### 7.4 阶段二（migration 005，已落地）
**核实结论**：阶段 B 的 6 张表写入/读取路径均安全可启用 RLS——
- `delivery_records`/`rysnova-bim_artifacts`/`lifecycle_links`/`notifications`/`analytics_events`：当前 NestJS 为 stub 或委托 legacy Express，而 **legacy 使用内存存储（memoryDb），不写 Postgres**；Postgres 侧无任何读写路径 → 启用 FORCE RLS 安全，且对未来写入方形成「安全默认 / fail-fast」。
- `price_list_items`：唯一读路径 `product-catalog.service.getDealerPrice` **已切到 `withRlsTransaction`**（scopeOverride `{tenantId}`）。

**已交付**：
- `database/postgres/migrations/005_business_tables_rls_phase2.sql`：对上述 6 张表 `ENABLE/FORCE RLS + tenant_isolation`。
- `product-catalog.service.ts`：`getDealerPrice` 改 `withRlsTransaction`；`products`（共享目录、非 uuid 哨兵）维持直读、不纳入 RLS。

**验证（本地真库）**：`db:migrate` 005 applied ok；`db:rls-proof` 6/6；`guard:postgres-target-schema` 0 failures/0 warnings；`guard:postgres-rls-behavior` 0 failures；`guard:target-api-boot-smoke` 0 failures。

### 7.5 仍开口的 foundation 项（P0/P1，需专项设计）
- `auth`（users）/ `tenant`（dealers/stores）：登录/HQ 引导态先于租户上下文，需**独立特权 DB 路径/角色**，不能按 `user.tenantId` 绑定事务。
- `bim.publicLookup`：跨租户公开读，需 **SECURITY DEFINER 函数或 BYPASSRLS 只读角色**。
- **唯一硬上线门**：`release:postgres-staging:smoke` 仍待非本地 `POSTGRES_STAGING_URL`。
