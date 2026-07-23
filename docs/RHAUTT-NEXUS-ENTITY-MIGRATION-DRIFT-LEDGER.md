# Rhautt Nexus · Entity ↔ Migration 漂移台账（全量对账）

> 状态：现行 · 2026-06-30 · 作用：W0 主干上位**前置闸**。迁移驱动（staging/prod）schema 下，实体引用不存在的列会**先于 RLS** 直接「column does not exist」报错。本台账逐表对账 27 个实体 vs migrations 001–007，给出漂移分级与修复方向。
>
> **对账方法**：本项目**无 TypeORM 命名策略** → `@Column()` 不写 `name:` 时列名=属性名原样（camelCase），必须与迁移 snake_case 对齐。逐表比对：表名 / 列名 / 类型 / 缺失。
>
> **修复总方针（已拍板）**：**迁移为准 + PIPL**。实体/服务对齐迁移；当迁移确实缺少**合理业务列**时，用**新增 additive 迁移**补列（不改已 SHA 锁定的 001）。
>
> **收口状态（2026-06-30）**：本台账列出的全部破坏性漂移已由 **migration 008（纯 additive）+ 实体映射对齐**收口，`tsc --noEmit` 0 error。详见末尾「§6 收口记录」。剩余仅 🔵 待抽验项。

---

## 0. 总览

| 分级 | 含义 | 表 |
|---|---|---|
| 🔴 **整表两套 schema** | 实体与迁移几乎无重叠，必炸 | `quotations`、`file_artifacts` |
| 🟠 **多列漂移（破坏性）** | 列名/缺列错配，读写报错 | `opportunities`、`audit_logs`、`workflow_instances` |
| 🟡 **类型/少列漂移** | 单点不一致，部分场景炸 | `customers`(tags) |
| ✅ **已修（本会话 007）** | — | `users`、`tenants`、`stores` |
| ✅ **对齐** | 实体=迁移 | `interactions`、`contracts`(+006)、`delivery_records`、`design_projects`、`floor_plans`、`diagnosis_sessions`、`lifecycle_links`、`analytics_events`、`notifications`、`bim_projects`、`mdm_global_products`、`pipl_consents`、`design_rysnova-bim_sync` |
| 🔵 **待抽验** | 高置信对齐（004/005/002 由实体新建），未逐列复核 | `rysnova-bim_artifacts`、`price_list_items`、`products`、`mdm_outbox_events`、`workflow_steps` |

> 关键事实：**04/05 由实体反向建表 → 天然对齐**；**001/002/003（早于实体演化）→ 漂移高发**。漂移全部落在 001/003 早期表。

---

## 1. 🔴 整表两套 schema（P0，需架构决策）

### 1.1 `quotations`（quote.entity ↔ 001+003）
| 实体列 | 迁移列 | 判定 |
|---|---|---|
| `items` (jsonb) | `bom` (jsonb) | 名不一致（同义） |
| `costBreakdown`(camelCase 列!) | `cost_snapshot` | 名不一致 + **camelCase 泄漏** |
| `systemFamilies`/`econetPremium`/`taxProfile`(camelCase 列!) | — | 迁移缺 + camelCase 泄漏 |
| `project` / `quotation_lock` | — | 迁移缺 |
| `lifecycle_link_id` / `owner_user_id` / `source` | （`created_by`） | 迁移缺 / 名不一致 |
| `priceSnapshot`(name=price_snapshot) | `price_snapshot` | ✅ |
| — | `version`/`product_module_id`/`product_deployment_mode`/`product_namespace`/`margin_snapshot`/`approval_state` | 实体缺（迁移 NOT NULL，部分有默认） |

**结论**：两套模型。`quote.service` 已切 `withRlsTransaction`，但迁移 schema 下**写入即炸**（列不存在 + version 等 NOT NULL 缺值）。
**修复方向**：以迁移为准重写 `QuotationEntity`（`items→bom`、`costBreakdown→cost_snapshot`、补 `version/product_module_id/...`）；`systemFamilies/econetPremium/taxProfile/project/quotation_lock/lifecycle_link_id/source` 为真实业务字段 → **新增迁移 008 补列**（snake_case）。**需你确认**是补列还是并入既有 jsonb（如塞进 `approval_state`/新 `business_meta`）。

### 1.2 `file_artifacts`（file-artifact.entity ↔ 001）
| 实体 | 迁移 | 判定 |
|---|---|---|
| `uploader_id`/`entity_type`/`entity_id`/`file_key`/`original_name`/`mime_type`/`size_bytes` | `object_key`/`artifact_type`/`artifact_status`/`content_hash`/`inputs_hash`/`version`/`visibility`/`customer_visible`/`storage_*`/`metadata`/`created_by`/`approved_by`/... | 几乎全错配 |

**结论**：实体是「简易上传记录」模型，迁移是「工程产物治理」模型（含版本/可见性/完整性校验/审批）。仅 `tenant_id`/`created_at` 重叠。
**修复方向**：迁移模型更完整、更贴宪章（产物治理）→ **以迁移为准重写 `FileArtifactEntity` + `file-artifact.service`**。**需你确认**是否保留实体的简易字段（`original_name`/`mime_type`/`size_bytes` 可作 additive 补列）。

---

## 2. 🟠 多列漂移（P0/P1，可机械修复）

### 2.1 `opportunities`（crm.entity ↔ 001）
- `estimatedValue`(列 `estimated_value`) ↔ 迁移 `estimated_budget` → **名不一致**。
- 实体有、迁移无：`dealer_id`、`next_action_at`、`lost_reason`、`quotation_id`。
- 实体无、迁移有：`source`、`diagnosis_snapshot`、`product_module_id/deployment_mode/namespace`。
**修复**：实体 `estimated_value→estimated_budget`；`dealer_id/next_action_at/lost_reason/quotation_id` 为合理业务字段 → **迁移 008 补列**。

### 2.2 `audit_logs`（governance.entity ↔ 001）
- `actorId`(列 `actor_id`) ↔ 迁移 `actor_user_id` → 名不一致。
- `diff`(jsonb) ↔ 迁移 `before_state`+`after_state` → 模型不一致。
- `ipAddress`(列 `ip_address`) ↔ 迁移 `ip_hash`（PIPL：IP 应 hash）→ 名+合规不一致。
- 实体 `actor_role` 迁移无；迁移 `request_id`/`trace_id` 实体无。
**修复**：**以迁移为准重写 `AuditLogEntity`**（`actor_id→actor_user_id`、`diff→before_state/after_state`、`ip_address→ip_hash`，补 `request_id/trace_id`）。注意：governance.service 当前委托 legacy，写入方改造时一并对齐。

### 2.3 `workflow_instances`（workflow.entity ↔ 001）
- 实体 `trigger_id/trigger_type/current_step/context/steps/error_message` ↔ 迁移 `temporal_workflow_id/aggregate_type/aggregate_id/input/state`。
**修复**：以迁移为准重写 `WorkflowInstanceEntity`（workflow.service 当前为 mock，无 DB 写，低风险，改 entity 即可）。

---

## 3. 🟡 类型/少列漂移（P1/P2）

### 3.1 `customers.tags`（crm.entity ↔ 001）
- 实体 `@Column('simple-array')` → 存为**逗号 text**；迁移 `tags text[]`（PG 原生数组）→ **类型不一致**，读 text[] 报错。
**修复**：实体改 `@Column('text', { array: true })`。
- 次要（非阻塞）：实体缺 `product_module_id/product_deployment_mode/product_namespace`（迁移有默认值，INSERT 不炸，但 ORM 不可见）→ 建议补进实体或显式忽略。

---

## 4. 🔵 待抽验（高置信对齐，建议逐列复核 1 次）
`rysnova-bim_artifacts`、`price_list_items`、`products`、`mdm_outbox_events`、`workflow_steps`（无实体，迁移侧治理表）。由 004/005/002 阶段与实体协同建表，预期对齐；W0 切流前各跑一次 INSERT/SELECT 冒烟即可定论。

---

## 5. 修复批次建议（W0 前置闸）

| 批次 | 内容 | 风险 | 验收 |
|---|---|---|---|
| **B1（机械对齐，低风险）** | `customers.tags` 类型；`opportunities.estimated_value→estimated_budget`；`audit_logs`/`workflow_instances` 实体对齐迁移 | 低 | `tsc` + 实体路径 INSERT/SELECT 冒烟 |
| **B2（additive 迁移 008）** | 补 `opportunities`(dealer_id/next_action_at/lost_reason/quotation_id)；`quotations` 真实业务列；`file_artifacts` 简易字段（如保留） | 中 | `db:migrate` + drift 保护 |
| **B3（整表重写，需决策）** | `QuotationEntity` / `FileArtifactEntity` + 对应 service 以迁移为准重写 | 高 | 契约测试 + RLS 证据经实体路径 |

**前置决策（请确认）**：
1. `quotations` 的 `systemFamilies/econetPremium/taxProfile/project/quotation_lock` → **补 snake_case 列** 还是 **并入 jsonb**？
2. `file_artifacts` → 全面采用迁移的「产物治理」模型（推荐），实体简易字段是否保留为 additive 补列？

> 决策后即可执行 B1→B2→B3，清零漂移，解锁 W0 主干切流。

---

## 6. 收口记录（2026-06-30 · 已执行）

**决策落定**：
1. `quotations` 多变配置 → **补独立 snake_case 列**（非 jsonb 大包），schema 更显式、且 quote.service **零改动**（属性名不变，仅改 `@Column({name})` 映射）。
2. `file_artifacts` 漂移 → 通用上传器与「工程产物治理」表 `file_artifacts`（列 `object_key/artifact_type/content_hash` NOT NULL+CHECK，通用上传无法供值）是**两套领域模型**。故**单建 `uploaded_files` 表**承载通用上传，`file_artifacts` 治理语义保持纯净。`FileArtifactEntity` 改指向 `uploaded_files`。

**migration 008（纯 additive，`database/postgres/migrations/008_entity_drift_reconciliation.sql`）**：
- `opportunities` ADD `dealer_id / next_action_at / lost_reason / quotation_id`。
- `quotations` ADD `lifecycle_link_id / owner_user_id / source / project / system_families(text[]) / econet_premium / tax_profile / quotation_lock`。
- CREATE `uploaded_files` + `ENABLE/FORCE RLS` + `uploaded_files_tenant_isolation` 策略（写入方已切 `withRlsTransaction`）。

**实体映射对齐**：
| 表 | 改动 | 文件 |
|---|---|---|
| `customers` | `tags` simple-array → `text[]` 原生数组 | `crm.entity.ts` |
| `opportunities` | `estimatedValue` 重映射 → 既有列 `estimated_budget` | `crm.entity.ts` |
| `quotations` | `items→bom`、`costBreakdown→cost_snapshot`、`systemFamilies→system_families(text[])`、`econetPremium→econet_premium`、`taxProfile→tax_profile` | `quote.entity.ts` |
| `audit_logs` | `actor_id→actor_user_id`、`diff→before_state/after_state`、`ip_address→ip_hash`、补 `request_id/trace_id`、去 `actor_role` | `governance.entity.ts` |
| `workflow_instances` | `trigger_*/current_step/context/steps/error_message` → `temporal_workflow_id/aggregate_type/aggregate_id/input/state`、补 `started_at` | `workflow.entity.ts` |
| `file_artifacts` | `@Entity` 改指向 `uploaded_files` | `file-artifact.entity.ts` |

**服务侧影响**：`quote.service` / `crm.service` / `file-artifact.service` **均无需改动**（属性名保持稳定，仅列映射变化）。`governance.service`/`workflow.service` 当前不直写这两表（委托 legacy / mock），无影响。

**验证**：`npx tsc --noEmit` → **0 error**。

**🔵 抽验（2026-06-30 · 已逐列复核，全部对齐）**：
| 表 | 迁移 | 结论 |
|---|---|---|
| `rysnova-bim_artifacts` | 004 | ✅ 列名/类型一致（`bim_data` 属性名恰为 snake_case，命中列名） |
| `products` | 004 | ✅ 一致（`tenant_id` text 哨兵 `rhautt_shared`，非 uuid RLS） |
| `price_list_items` | 004 | ✅ 一致 |
| `mdm_outbox_events` | 002 | ✅ 一致；`status` 实体枚举 `pending\|delivered\|dead` 与 DDL CHECK 完全吻合 |
| `workflow_steps` | 001 | ✅ 无实体（治理表，应用不直读写），无漂移 |

> **结论：全量对账关闭。27 实体 ↔ migrations 001–008 无残留破坏性漂移。**

**剩余开口（运维侧，非代码）**：
- 真库 apply 008 + drift 保护 + RLS 证据经实体路径复测（随 staging 一并执行；当前被 `POSTGRES_STAGING_URL` 未配置阻塞）。
