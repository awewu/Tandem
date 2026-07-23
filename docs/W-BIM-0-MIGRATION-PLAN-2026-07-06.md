# W-BIM-0 迁移方案（2026-07-06）

> 依据 `RYSNOVA-BIM-MOAT-ARCHITECTURE-AND-EVOLUTION-BLUEPRINT-2026-07-05.md` §8 D-BIM-1 决议：
> **C 交付语义归位目标域：并入现有 `delivery` / `lifecycle` 模块；`bim_projects` 不再承载交付语义，仅作为项目容器/索引。**
> 本文档只出方案，不动库/不动端点；实施前须用户确认。

## 1. 当前现状

### 1.1 `bim_projects` 表（`services/api/src/modules/rysnova-bim/bim.entity.ts`）
当前承载签单后项目 + 交付语义双重职责：

| 字段 | 当前语义 | 应迁目标 |
|---|---|---|
| `status` | 项目阶段：`inherited → drawing → bom_confirmed → construction → acceptance → iot_delivered` | `lifecycle_links.stage` / `lifecycle_links.projectState` |
| `drawing_url` | 出图产物 URL | `delivery_records.checklist` 或对象存储产物表 |
| `bom_xlsx_url` | BOM Excel 产物 URL | 对象存储产物表 |
| `acceptance_checklist` | 验收清单 | `delivery_records.checklist` |
| `accepted_at` / `accepted_by` | 客户签收时间/人 | `lifecycle_links.acceptedAt` / `lifecycle_links.acceptedBy` |
| `paidValue` | 回款金额 | `contracts.totalAmount` / `contracts` 支付子表 |
| `assigned_to` | 项目指派 | `lifecycle_links.assignedTo` 或 `delivery_records` |
| `quotation_id` / `quotation_no` | 来源报价 | 保留在 `bim_projects` 作为索引 |
| `customer_id` / `project` / `city` | 项目容器/索引 | 保留在 `bim_projects` |

### 1.2 当前端点（`bim.controller.ts`）

| 当前端点 | 职能 | 目标归属 |
|---|---|---|
| `POST /bim/inherit/:quotationId` | 从报价承接项目 | `delivery` / `lifecycle`：签单后创建 `Contract` + `LifecycleLink` + `BimProject` 索引 |
| `GET /bim/public/:code` | 客户凭码查进度 | `delivery`（保留公开进度查询） |
| `GET /bim` / `GET /bim/:id` | 项目列表/详情 | `rysnova-bim` 保留为只读项目索引；详情聚合 `delivery` + `lifecycle` + `design` |
| `PUT /bim/:id/advance` | 阶段推进 | `lifecycle` 状态机推进 |
| `PUT /bim/:id/bom` | 修改 BOM | `rysnova-bim` 或 `delivery` 产物管理 |
| `GET /bim/:id/bom/export` | 导出 BOM Excel | 产物生成/下载 |
| `PUT /bim/:id/drawing` | 保存出图链接 | `delivery` 产物登记 |
| `PUT /bim/:id/acceptance/:index` | 验收打勾 | `delivery_records.checklist` |
| `GET /bim/:id/iot-package` | IoT 交付包 | `lifecycle` / `delivery` 交付包组装 |
| `POST /bim/:id/assign` | 指派负责人 | `lifecycle_links` |
| `PUT /bim/:id/paid` | 更新回款 | `contracts` 或财务域；BIM 域只读引用 |

### 1.3 目标域现状
- `delivery` 模块已有 `contracts` + `delivery_records` 表，具备合同、交付记录、签收、电子签能力。
- `lifecycle` 模块已有 `lifecycle_links` 表，具备项目状态机、客户可见状态、交付里程碑、IoT 计划等字段。
- `rysnova-bim` 模块已有 `rysnova_bim_artifacts` 产物表，具备 `artifact_type` / `file_key` / `bim_data` 字段。

## 2. 目标架构

```
┌─────────────────────────────────────────────┐
│  rysnova-bim 域（项目容器 + 产物索引）       │
│  ─ bim_projects: 只保留项目索引字段         │
│  ─ rysnova_bim_artifacts: 产物元数据         │
│  ─ design-sync: 设计变更同步                 │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  delivery 域（合同/交付/签收/电子签）        │
│  ─ contracts: 合同 + 回款 + 签章           │
│  ─ delivery_records: 交付记录 + 验收清单       │
│  ─ esign: 电子签回调与 PDF 存证              │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  lifecycle 域（状态机 + 客户可见进度）         │
│  ─ lifecycle_links: 阶段/验收/IoT/指派       │
└─────────────────────────────────────────────┘
```

## 3. 数据迁移计划（分 3 批）

### 批 A：新增字段与只读视图（不删旧字段）
1. 在 `lifecycle_links` 新增 `bim_project_id`（已有）索引，建立与 `bim_projects` 1:1 或 1:N 关联。
2. 在 `delivery_records` 新增 `bim_project_id` 字段（可选，用于快速过滤）。
3. 创建数据库视图 `v_bim_project_delivery` 聚合 `bim_projects` + `lifecycle_links` + `delivery_records` + `contracts` 的交付字段。
4. 在 `bim.service` 的 `get` / `list` 中改为读取视图，保持旧端点返回格式不变。

### 批 B：双写期（2 周观察）
1. 所有写操作（`advance`、`updateDrawing`、`checkItem`、`updatePaid`、`assign`）改为**双写**：
   - 旧字段继续写（保证旧端点/旧消费者可用）。
   - 同时写入 `lifecycle_links` / `delivery_records` / `contracts` 的目标字段。
2. 部署校验脚本：每小时比对 `bim_projects` 与目标域字段一致性，不一致则告警。
3. 旧端点添加 `deprecated` 标记，返回 `Warning` 头。

### 批 C：切换与字段清理
1. 一致性 100% 且维持 2 周后，旧端点改为只读目标域（或重定向到新端点）。
2. 删除 `bim_projects` 中已迁移的字段（灰度：先 nullable，再 drop）。
3. 旧端点统一迁移到 `/api/v2/rysnova-bim/*`。

## 4. 端点收敛矩阵（当前 → 目标）

| 当前端点 | 目标端点 | 迁移方式 | 优先级 |
|---|---|---|---|
| `POST /bim/inherit/:quotationId` | `POST /api/v2/rysnova-bim/projects` | 新接口 + 旧接口重定向 | P0 |
| `GET /bim/public/:code` | `GET /api/v2/rysnova-bim/public/:code` | 保留语义，改由 delivery 聚合 | P0 |
| `GET /bim` | `GET /api/v2/rysnova-bim/projects` | 只读聚合 | P1 |
| `GET /bim/:id` | `GET /api/v2/rysnova-bim/projects/:id` | 只读聚合 | P1 |
| `PUT /bim/:id/advance` | `POST /api/v2/rysnova-bim/projects/:id/advance` | 迁 lifecycle 状态机 | P1 |
| `PUT /bim/:id/bom` | `PUT /api/v2/rysnova-bim/projects/:id/bom` | 保留在 rysnova-bim，但产物表化 | P2 |
| `GET /bim/:id/bom/export` | `GET /api/v2/rysnova-bim/projects/:id/bom/export` | 产物生成 | P2 |
| `PUT /bim/:id/drawing` | `POST /api/v2/rysnova-bim/projects/:id/drawing-artifacts` | 产物登记 | P1 |
| `PUT /bim/:id/acceptance/:index` | `POST /api/v2/rysnova-bim/projects/:id/customer-signoff` | 迁 delivery 签收 | P1 |
| `GET /bim/:id/iot-package` | `GET /api/v2/rysnova-bim/projects/:id/iot-package` | 由 lifecycle 组装 | P2 |
| `POST /bim/:id/assign` | `PUT /api/v2/rysnova-bim/projects/:id/assign` | 迁 lifecycle | P2 |
| `PUT /bim/:id/paid` | **禁止**：BIM 域只读引用财务/合同数据 | 删除或改为只读 | P1 |

## 5. 需要用户确认的风险点

1. **字段删除不可逆**：批 C 删除 `bim_projects` 旧字段前，建议全量备份并跑回归测试。
2. **双写观察期长度**：建议 2 周，是否可接受？
3. **回款字段归属**：`paidValue` 应完全归 `contracts` 或财务域，BIM 项目只读展示。是否同意？
4. **客户公开查询**：`GET /bim/public/:code` 是否改由 `delivery` 域提供，还是保留在 `rysnova-bim` 做聚合？
5. **现有 Revit 插件**：是否有外部系统调用旧 `/bim/*` 端点？需要兼容期。

## 6. 实施顺序（推荐）

1. 批 A：建视图 + 改 `get`/`list` 读取视图（只读，风险最低）。
2. 批 A：新接口 `POST /api/v2/rysnova-bim/projects` 实现“承接”语义，旧接口转发。
3. 批 B：双写 `advance` / `drawing` / `acceptance` / `assign` / `paid`。
4. 批 B：客户公开查询切到 delivery 聚合。
5. 批 C：删除旧字段、旧端点重定向、OpenAPI 更新。

## 7. 外部参照

- 蓝图 §8 D-BIM-1 决议：`bim_projects` 交付语义迁 `delivery` / `lifecycle`。
- 蓝图 §9 端点收敛矩阵：当前端点 → 目标端点。
- 蓝图 §5 底座约束：FORCE RLS + 归属谓词 + 对象存储证据；迁移脚本须走 RLS 事务。
