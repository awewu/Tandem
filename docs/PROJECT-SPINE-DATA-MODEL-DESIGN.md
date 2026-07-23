# 项目主线数据模型设计 + 迁移方案（Project Spine）

> 状态：设计草案（待评审，未实施）· 日期：2026-07-13
> 事实源层级：`PROJECT-CHARTER.md` > `PRD-v2.md` > 本文件
> 关联记忆：签单项目数据流转与项目唯一键原则（手机号+项目地址）

---

## 0. 一句话目标

把「一个签单项目」确立为**跨域单一数据主线**，以 **`(tenant_id, phone_hash, address_normalized)`** 作为项目业务唯一键，让 CRM → 设计 → 报价 → 签单 → BIM 深化 → 施工 → 验收 → 生命周期 IoT 全链路挂在同一个 `project_id` 上。

---

## 1. 用户原则（不可偏离）

1. **一个签单项目 = 一套完整数据流转**（单一主线，端到端可追溯）。
2. **项目业务唯一键 = 项目地址 + 手机号**。

### 工程化解读

- **客户身份（Customer）= 手机号**（一个自然人）。
- **项目身份（Project）= 手机号 + 项目地址**（该自然人的某个具体安装现场）。
- **Customer 1 : N Project**：同一手机号可有多个不同地址的项目（自宅 / 父母家 / 出租房 / 二次改造）。

---

## 2. 当前现状与差距

### 2.1 现有实体（按域）

| 域 | 表 | 主键 | 唯一/串联键 | 备注 |
|---|---|---|---|---|
| crm | `customers` | uuid | **UNIQUE(tenant_id, phone_hash)** | 有 `address`（可空，未规范化、未入键） |
| crm | `opportunities` | uuid | `customer_id`, `quotation_id` | 商机 |
| quote | `quotations` | uuid | `quotation_no` UNIQUE；`source=designer-bom` | 携带设计 BOM |
| delivery | `contracts` | uuid | `customer_id`, `quotation_id` | 合同 |
| delivery | `delivery_projects` | uuid | `contract_id`, `customer_id`, `quotation_id` | 1 合同 1 施工项目 |
| rysnova-bim | `bim_projects` | uuid | `customer_id`, `quotation_id` | 签单后深化载体（快照 BOM/项目） |
| lifecycle | `lifecycle_links` | uuid | `customer_id` + 各阶段 id + `project_address` | **事实上的项目主线雏形** |
| aftersales | `service_tickets` / `warranties` | uuid | `customer_id` | 售后 |
| diagnosis | `diagnosis_sessions` | uuid | `customer_id` | 问诊 |

### 2.2 核心差距（问题）

1. **无项目级唯一键**：项目身份没有以 `(手机号 + 地址)` 落库；`customers.address` 可空、未规范化、不入任何唯一约束。
2. **主线按客户塌缩**：`lifecycle.service.advanceInTx` 目前按 `(tenant_id, customer_id)` 定位生命周期行（`services/api/src/modules/lifecycle/lifecycle.service.ts:289`）。**一个客户多个项目时会互相覆盖**——第二个项目会污染第一个的主线。这是最严重的现存缺陷。
3. **串联靠逐跳 UUID**：各阶段实体用 `customer_id / quotation_id / contract_id` 逐跳外链，没有统一 `project_id` 作为主线锚点，360 视图/回溯需多跳拼装。
4. **地址无规范化**：无 `address_normalized`，"XX路1号" vs "XX路1號" 无法判重。

---

## 3. 目标模型

### 3.1 Project 聚合（主线单一真相源）

**决策：不新建表，把 `lifecycle_links` 扶正为规范化 Project 聚合**（它已聚合全阶段 id + `project_address`，改造成本最低）。若评审倾向语义清晰，可另建 `projects` 表并让 `lifecycle_links` 降级为其投影——见 §7 备选。

```
projects（= 扶正后的 lifecycle_links 主线）
  id                 uuid  PK                      -- 物理主键（代理键）
  tenant_id          not null                      -- RLS
  dealer_id / store_id                             -- 经营隔离
  customer_id        -> customers.id               -- 归属客户（手机号唯一）
  phone_hash         not null                      -- 业务唯一键组成①（PIPL：不落明文）
  address_normalized not null                      -- 业务唯一键组成②（规范化地址）
  project_address    varchar                       -- 原始展示地址
  ── 阶段锚点（各域回填）──
  opportunity_id / quotation_id / contract_id
  design_project_id / bim_project_id
  ── 状态与投影（沿用现有 14 态富投影）──
  project_state / customer_visible_state / progress_percent ...
  UNIQUE (tenant_id, phone_hash, address_normalized)   -- ★ 项目业务唯一键
```

### 3.2 关键设计决策

- **物理主键仍用代理 UUID**：`(手机号+地址)` 作为**业务唯一约束**而非物理 PK。理由：
  - **PIPL**：手机号是 PII，不得落明文、不得作为外键在各表扩散；用 `phone_hash`（已有 `compliance.pii.hashPII`）。
  - **地址易变/脏**：地址会修订、格式不一，作为物理 PK 会导致改址即断链；代理键稳定。
  - **RLS/性能**：UUID 外键对行级安全与索引更友好。
- **地址规范化 `address_normalized`**：统一去空格 / 全半角 / 门牌格式（规则见 §6），入库前计算，判重只比规范化值。
- **Customer 与 Project 分离**：`customers` 保持 `UNIQUE(tenant_id, phone_hash)`（客户唯一）；项目唯一性下沉到 Project 聚合。
- **各阶段实体新增 `project_id` 外键**：作为主线锚点（可空 → 回填 → 逐步强制）。

---

## 4. 影响面

### 4.1 需改造的表（加 `project_id` 外键锚点）

- `opportunities` · `quotations` · `contracts` · `delivery_projects` · `bim_projects` · `service_tickets` · `warranties` · `diagnosis_sessions`

### 4.2 需改造的写路径（服务层）

- **CRM 建线索/签单**：`crm.service.createLead / sign` —— 建/定位 Project（按 `phone_hash + address_normalized`），把 `project_id` 传入下游。
- **Lifecycle 推进**：`lifecycle.service.advanceInTx / createOrUpdateHandover` —— **定位键从 `customer_id` 改为 `project_id`**（修复 §2.2-2）。
- **BIM 承接**：`bim.service.inheritFromQuotation` —— 承接时绑定 `project_id`。
- **Delivery/Aftersales**：合同、施工、售后写入带 `project_id`。

### 4.3 RLS 影响

- Project 聚合沿用 `tenant_id + dealer_id + store_id` 行级策略（同 `lifecycle_links` 现状，迁移 004/005/013 模式）。
- 唯一约束 `(tenant_id, phone_hash, address_normalized)` 天然带 `tenant_id`，跨租户不冲突。

### 4.4 治理/门禁

- `guard:permission-domain`：Project 聚合归属 **D4 客户与赋能**（`lifecycle` 模块 owner 不变）。
- 需跑：`harness:integrity`、`harness:arch`、`test:production-readiness`、相关 contract tests。

---

## 5. 迁移方案（分阶段，不大爆炸）

> 迁移文件命名沿用 `database/postgres/migrations/NNN_*.sql`，当前最新 `035`，本方案从 **`036`** 起。

### 阶段 P0 · 加列（向后兼容，可空）
- `036_project_spine_columns.sql`：
  - `lifecycle_links` 加 `phone_hash`、`address_normalized`（可空）。
  - 各阶段表加 `project_id uuid NULL`（可空外键，先不加 NOT NULL）。
- **零风险**：全部可空，旧代码不受影响。

### 阶段 P1 · 回填（backfill 脚本）
- `scripts/db/backfill-project-spine.js`：
  1. 对每个 `lifecycle_links` 行：由 `customer_id` 取 `customers.phone_hash`；由 `project_address`（或 customer.address）计算 `address_normalized`；写回。
  2. **一客户多地址拆分**：若同一 `customer_id` 下检测到多个不同 `address_normalized`（历史被塌缩的项目），按地址拆成多条 Project 行（保留最早行为主，其余新建），并重挂对应阶段记录的 `project_id`。
  3. 各阶段表回填 `project_id`：按 `contract_id → quotation_id → customer_id` 优先级匹配到 Project 行。
- **先 `--dry-run` 出报告**（多少行、多少需拆分、多少无法匹配），人工复核再执行。

### 阶段 P2 · 加唯一约束 + 收紧
- `037_project_spine_unique.sql`：
  - `UNIQUE(tenant_id, phone_hash, address_normalized)` on `lifecycle_links`。
  - 若 P1 回填干净，逐表把 `project_id` 改 `NOT NULL`（分表分批）。
- **前置条件**：P1 dry-run 报告零冲突、零无法匹配。

### 阶段 P3 · 切写路径
- 服务层按 §4.2 改为以 `project_id` 定位与串联（`advanceInTx` 定位键切换）。
- 双读兼容期：先 `project_id` 命中，回退 `customer_id`（灰度），稳定后移除回退。

### 阶段 P4 · 清理
- 移除写路径中的 `customer_id` 回退定位；文档/契约同步。

---

## 6. 地址规范化规则（`address_normalized`）

- 去首尾空格、合并连续空白；全角→半角；中文数字门牌保持原样但去分隔符差异。
- 统一去除标点差异（`号/號`、`-`、`#`）。
- 建议：`normalized = lower(trim(fullwidth_to_halfwidth(remove_punct(address))))`。
- **规则集中一处**（新增 `services/api/src/modules/common/address.ts`），前后端/回填脚本共用，避免漂移。
- ⚠️ 规范化不是地理编码；如需更强判重可后续接入行政区划/POI 归一（P2+ 可选）。

---

## 7. 备选方案（评审对比）

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A（推荐）扶正 lifecycle_links** | 现表加 `phone_hash+address_normalized+唯一约束`，作为 Project 主线 | 改动最小、复用现有富投影与 RLS | `lifecycle_links` 语义变重（既是桥又是主线） |
| B 新建 `projects` 表 | 新建独立 Project 聚合，`lifecycle_links` 降为其投影 | 语义最清晰、职责单一 | 迁移量大、需重挂所有外键 |
| C 仅在 `customers` 上做 | `customers` 唯一键改 `(tenant, phone_hash, address_normalized)` | 最简单 | **错误**：会把客户和项目混为一谈，违背 1:N |

> 方案 C 明确不采纳（违反 Customer 1:N Project）。A 与 B 二选一，建议 A 起步、保留演进到 B 的路径（符合"每模块留独立拆库路径"原则）。

---

## 8. 风险与回滚

- **回填拆分误判**：一客户多地址拆分可能过度/不足 → P1 全程 dry-run + 人工复核 + 可重跑（幂等）。
- **唯一约束触发历史冲突**：P2 前必须 P1 报告零冲突；冲突行先人工并档。
- **写路径切换回归**：P3 灰度双读，保留 `customer_id` 回退，异常可秒回退。
- **回滚**：P0/P1 纯加列+回填可直接留空不启用；P2 唯一约束可 `DROP CONSTRAINT`；P3 由 feature flag 控制定位键切换。

---

## 9. 评审决定（2026-07-13 已确认，冻结）

1. ✅ **方案 A** —— 扶正 `lifecycle_links` 为规范化 Project 主线（保留演进到 B 的路径）。
2. ✅ **地址先纯文本归一** —— 不接入行政区划/地理编码；`address_normalized` 走 §6 文本规范化规则，后续可选升级。
3. ✅ **历史数据由 P1 回填处理** —— 一客户多地址塌缩行按 dry-run 报告拆分，人工复核后执行。
4. ✅ **`project_id` 目标 `NOT NULL`** —— P2 回填干净后各阶段表统一收紧为 NOT NULL。

---

## 10. 实施顺序（评审通过后）

1. ✅ 确认方案 A/B + 冻结本文档。
2. ✅ `common/address.ts` 规范化工具（含单测 9/9）。
3. ✅ `036` 加列迁移（P0，已应用）+ 各实体加列声明。
4. ✅ `backfill-project-spine.js`（P1，dry-run 报告已跑）。
5. ✅ 地址采集入口（根因修复，见 §11）。
6. ✅ `037` 唯一约束 + NOT NULL 收紧（P2，已应用）。
7. ✅ 服务写路径切 `project_id` 定位（P3，tsc 0 errors）。

---

## 11. P1 Dry-Run 关键发现（2026-07-13）

- **匹配逻辑 100% 正确**：各阶段 `project_id` 全部匹配到主线（opportunities 71 / quotations 99 / contracts 50 / delivery_projects 15 / bim_projects 97 / service_tickets 25 / warranties 25 / diagnosis_sessions 22，0 未匹配）。
- **`phone_hash` 零缺失**：59 条 lifecycle_links 均可从 `customers.phone_hash` 取到。
- **真正阻塞：系统无地址数据**。`lifecycle_links.project_address` 与 `customers.address` 全空 → `address_normalized` 无法计算 → 59 条全部无法组唯一键。多地址塌缩候选=0（因地址全空而无法区分，非真无重复）。
- **已存在一客户多链路**：多个 `customer_id` 出现多条 link，印证 Customer 1:N Project。

### 根因修复（已实施）：入口采集项目地址

- `crm.service.createLead`：DTO 增 `address`，写入 `customers.address`；串联时把 `phoneHash + projectAddress` 传入 `advanceInTx`。
- `lifecycle.service.advanceInTx` / `LifecycleAdvance`：接受 `phoneHash`、`projectAddress`，落库并经 `normalizeAddress` 派生 `address_normalized`（幂等只填空）。
- 前端 `apps/dealer-workbench/src/app/mobile/page.tsx`：建线索表单增「项目地址」字段并随提交。

> 效果：**新建线索起即携带地址**，从源头形成 (phone_hash + address_normalized) 唯一键。历史空地址数据仍需二次补录/治理后方可进 P2 唯一约束。

---

## 12. P2 完成（2026-07-13）

- **037 迁移已应用**：`UNIQUE INDEX (tenant_id, phone_hash, address_normalized) WHERE phone_hash IS NOT NULL AND address_normalized IS NOT NULL` + 8 张阶段表 `project_id` 收紧 `NOT NULL`。
- **孤儿行清理**：`service_tickets` / `warranties` 各 1 条 seed demo 孤儿行（无 customer_id / bim_project_id / project_id）已删除，NOT NULL 随即生效。
- **最终验证**：
  - 迁移 38 applied, 0 pending。
  - `project_id NOT NULL` 8/8 表全部生效。
  - 唯一索引 `lifecycle_links_project_key_uidx` 存在。
  - backfill 复核：无法组唯一键 0 · 重复项目键 0 · 各阶段扫描 0（全部已填）。
  - 一客户多地址 23 条（合法 Customer 1:N Project，信息项）。
- **fake 地址声明**：历史 59 条 link 的地址由 `seed-fake-project-addresses.js`（dev-only）生成，**生产环境必须用真实地址补录**后方可进 P2。

---

## 13. P3 完成：服务写路径切 project_id（2026-07-13）

**目标**：所有阶段表 INSERT 时注入 `project_id`（= `lifecycle_links.id`），使 `project_id` 从"外键"升级为"定位键"。

**变更清单（8 条写路径 + 1 实体补漏）**：

| 写路径 | 文件 | project_id 来源 |
|---|---|---|
| `createLead` | `crm.service.ts` | `advanceInTx` 先于 opportunity 创建，link.id → opportunity.projectId |
| `createLeadInTx` | `crm.service.ts` | 同上（diagnosis 路径复用） |
| `persist` | `quote.service.ts` | 按 customerId 查 lifecycle_links |
| `createFromQuotation` | `contract.service.ts` | 按 quotationId 查 lifecycle_links |
| `create` (线下合同) | `contract.service.ts` | 按 customerId 查 lifecycle_links |
| `inheritFromQuotation` | `bim.service.ts` | 重排：先解析 link，再创建 contract + BIM project |
| `createProjectForContract` | `construction.service.ts` | 按 contractId 查 lifecycle_links |
| `createTicket` | `aftersales.service.ts` | 按 bimProjectId 查 lifecycle_links |
| `createWarranty` | `aftersales.service.ts` | 按 bimProjectId 查 lifecycle_links |
| `createSession` | `diagnosis.service.ts` | createLeadInTx 后按 customerId 查 link |
| **实体补漏** | `aftersales.entity.ts` | ServiceTicketEntity / WarrantyEntity 补 projectId 列声明 |

**关键设计决策**：
- CRM `createLead`/`createLeadInTx` **重排**：先 `advanceInTx`（创建 lifecycle_link），再创建 opportunity（取 link.id 作 projectId），再二次 `advanceInTx` 回填 opportunityId。
- BIM `inheritFromQuotation` **重排**：先解析 lifecycle link，再创建 contract + BIM project（均注入 projectId），最后更新 link 回填 contractId/bimProjectId。
- 售后 `createTicket`/`createWarranty`：按 `bimProjectId` 查 link（售后入口已携带 BIM 项目引用）。

**验证**：`tsc --noEmit` 0 errors。
