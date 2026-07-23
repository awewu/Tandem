# Rhautt Nexus / 瑞合数智枢纽 数据库后端架构设计

> 目标规模：500+ 经销商并发、2000+ 设计师/销售人员、100,000+ 用户/客户档案。
> 目标状态：上线后可持续运营、可扩容、可审计、可从当前内存 demo 数据平滑迁移。

## 1. 设计结论

Rhautt Nexus / 瑞合数智枢纽目标数据库架构采用 **PostgreSQL + MongoDB + Redis + 对象存储 + Temporal/Outbox** 的组合：

- PostgreSQL：承载核心业务账本、租户/经销商/门店/员工、合同、报价版本、审计索引、权限和强一致状态；目标启用 tenant-aware schema、RLS、audit log。
- MongoDB：承载问诊、设计、BIM、图纸、方案文档、Rysnova artifact、客户旅程等灵活文档结构。
- Redis：承载会话缓存、限流、热点产品/价格缓存、短期任务状态、分布式锁。
- 对象存储：承载 CAD、PDF、DWG、BOM、渲染图、客户分享文件、验收照片。
- Temporal + Outbox：承载报价审批、合同签署、施工交付、图纸导出、IoT lifecycle handoff 等长流程可靠编排。
- 后端服务：按业务模块拆分 repository/service 层，不让 route 直接操作 mongoose model。

当前仓库仍是 Express/JavaScript + Mongo/Mongoose 兼容主干，目标不是假装完成完整数据库重写，而是用 guard、repository tenant scope、OpenAPI contract、backup/restore drill 和 release evidence 逐步把生产底座收紧。

不建议上线时继续使用 `server-production.js` 内存 `db`。内存数据只能保留为 `DEMO_MODE=true` 的演示 seed。

## 1.0 可执行数据库门禁

数据库设计不只停留在文档。生产主干必须运行：

```bash
npm run guard:database
npm run guard:postgres-target-schema
npm run guard:workflow-outbox-contract
```

该门禁检查：

- `Tenant / Dealer / Store / UserV2 / CustomerV2 / Opportunity / Interaction / AuditLog / LifecycleLink / Quotation / QuotationV2` 核心模型。
- 所有租户业务模型必须包含 `tenantId`，关键业务模型必须 `required: true`。
- 经销商、门店、用户、客户、机会、互动、生命周期、报价必须有 tenant-aware 复合索引。
- 唯一业务键默认必须包含 `tenantId`，只有平台级账号手机号可作为兼容性全局唯一。
- `BaseRepository.withTenant` 必须拒绝缺失 `tenantId` 的查询。
- 审计日志 `AuditLog.tenantId` 必须强制存在，避免总部/经销商审计串账。
- 备份恢复必须运行 `npm run release:backup-restore:drill`，证明租户记录、生命周期 handoff 和 `lifecycle_handoff_only` 边界可恢复。
- PostgreSQL 目标账本必须运行 `npm run guard:postgres-target-schema`，证明目标迁移具备 tenant-aware 表、RLS、FORCE RLS、tenant isolation policy、audit log、outbox、workflow、file artifact 和 `lifecycle_handoff_only`。该证据仍是 target contract，不代表已经在 staging/production 应用。
- 长流程可靠性必须运行 `npm run guard:workflow-outbox-contract`，证明报价审批、合同签署、施工交付、IoT handoff、服务计划和 Rysnova 导出已经被纳入 Temporal + Outbox 目标合同。该证据仍是 target contract，不代表已经接入生产 Temporal worker。

当前报价持久化策略：旧 `Quotation.customerId` 仍为 `String`，仅保留旧报价链路兼容；生产 v2 报价持久化使用 `QuotationV2.customerId:ObjectId -> CustomerV2`，并通过 `tenantId/customerId/status` 等复合索引接入 v2 customer graph。旧 `Quotation` 不再作为生产新报价的主模型。

## 1.1 售前售中与 IoT 控制平台边界

瑞诺瓦AI舒适家 当前主系统负责售前、售中和交付可信度：线索、问诊、设计、报价、合同、施工、验收。IoT 控制平台负责售后全生命周期：家庭/项目接管、设备绑定、远程控制、运行数据、能耗、告警、维保和用户关怀。

两个系统之间通过 `lifecycle_links` 建立稳定衔接关系：

- 来源侧：`customerId / opportunityId / contractId / designId / quoteId`
- 交付侧：`systems / devices / projectAddress / servicePlan`
- IoT 侧：`iot.homeId / iot.accountId / iot.bindingStatus / devices.iotDeviceId`
- 阶段：`contracted -> installing -> accepted -> iot_handover -> operating -> service`

这个边界避免两个系统互相侵入：售前售中系统不直接承担实时控制，IoT 平台也不重新理解销售合同和设计方案。交付桥负责把“买了什么、装在哪里、谁拥有、如何维保”翻译成 IoT 平台可接管的资产。

## 2. 容量与负载假设

### 用户量

| 类别 | 估算 |
|---|---:|
| 经销商/门店组织 | 500+ |
| 设计师/销售/店长/总部人员 | 2,000+ |
| 终端客户/业主档案 | 100,000+ |
| 项目/方案 | 150,000-300,000 |
| 报价单 | 300,000-600,000 |
| 施工/合同记录 | 30,000-80,000 |
| 交付文件 | 500,000+ 对象 |

### 并发估算

| 场景 | 峰值估算 |
|---|---:|
| 登录/认证 | 50-150 RPS |
| CRM 查询/跟进 | 100-300 RPS |
| 产品/价格查询 | 200-500 RPS |
| 报价生成 | 30-100 RPS |
| AI 问诊/讲解 | 20-80 RPS |
| 施工/验收上传 | 20-100 RPS |

架构目标不是一次性支撑互联网级流量，而是能稳定承载全国经销商网络的高峰业务日。

## 3. 多租户模型

所有核心业务集合必须包含租户字段，禁止只靠用户 ID 隔离数据。

核心字段：

```js
tenantId     // 经销商集团/区域代理/总部租户
dealerId     // 经销商
storeId      // 门店
ownerUserId  // 负责人，通常是销售/设计师
createdBy
updatedBy
regionCode
```

推荐组织层级：

```text
Tenant
  └── Dealer
        └── Store
              └── User
```

总部账号可以跨租户看汇总，但默认业务 API 必须强制注入 `tenantId/dealerId/storeId` 查询条件。

## 4. 推荐集合设计

### 4.1 组织与账号

#### tenants

```js
{
  _id,
  code,
  name,
  type: 'hq' | 'regional' | 'dealer_group',
  status,
  settings: {
    pricingPolicy,
    allowedBrands,
    featureFlags
  },
  createdAt,
  updatedAt
}
```

索引：

```js
{ code: 1 } unique
{ status: 1, updatedAt: -1 }
```

#### dealers

```js
{
  _id,
  tenantId,
  name,
  province,
  city,
  contact,
  status,
  contractLevel,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, status: 1 }
{ tenantId: 1, province: 1, city: 1 }
```

#### stores

```js
{
  _id,
  tenantId,
  dealerId,
  name,
  city,
  address,
  managerUserId,
  status
}
```

索引：

```js
{ tenantId: 1, dealerId: 1, status: 1 }
```

#### users

现有 `server/models/User.js` 需要升级。当前 role 只有 `admin/manager/designer/sales`，不够覆盖总部/经销商/门店/客户。

推荐角色：

```text
platform_admin
hq_admin
regional_manager
dealer_admin
store_manager
designer
sales
engineer
installer
customer
```

关键字段：

```js
{
  _id,
  tenantId,
  dealerId,
  storeId,
  phone,
  passwordHash,
  name,
  role,
  permissions,
  status,
  lastLoginAt,
  loginAttempts,
  lockUntil,
  createdAt,
  updatedAt
}
```

索引：

```js
{ phone: 1 } unique
{ tenantId: 1, dealerId: 1, role: 1, status: 1 }
{ tenantId: 1, storeId: 1, status: 1 }
```

注意：生产环境禁止 `123456` 默认密码，demo 账号只在 `DEMO_MODE=true` 注入。

### 4.2 CRM 与客户旅程

#### customers

现有 `customer.model.js` 过薄，且缺 `tenantId/dealerId/storeId`。上线需升级。

```js
{
  _id,
  tenantId,
  dealerId,
  storeId,
  ownerUserId,
  phoneHash,       // 查询用，避免明文手机号作为唯一业务键
  phoneEncrypted,  // 展示前解密/脱敏
  name,
  city,
  address,
  source,
  tags,
  profile: {
    houseType,
    area,
    rooms,
    familyMembers,
    budgetRange
  },
  status: 'lead' | 'active' | 'won' | 'lost' | 'archived',
  lastInteractionAt,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, phoneHash: 1 } unique
{ tenantId: 1, ownerUserId: 1, status: 1, updatedAt: -1 }
{ tenantId: 1, storeId: 1, status: 1, lastInteractionAt: -1 }
{ tenantId: 1, source: 1, createdAt: -1 }
```

#### opportunities

```js
{
  _id,
  tenantId,
  dealerId,
  storeId,
  customerId,
  ownerUserId,
  stage: 'lead' | 'qualified' | 'diagnosed' | 'quoted' | 'contracted' | 'won' | 'lost',
  estimatedValue,
  probability,
  nextActionAt,
  lostReason,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, ownerUserId: 1, stage: 1, updatedAt: -1 }
{ tenantId: 1, storeId: 1, stage: 1, updatedAt: -1 }
{ tenantId: 1, customerId: 1 }
```

#### interactions

客户跟进记录会快速增长，建议独立集合，不内嵌在 customer。

```js
{
  _id,
  tenantId,
  customerId,
  opportunityId,
  actorUserId,
  type: 'call' | 'wechat' | 'meeting' | 'share_view' | 'site_visit',
  content,
  nextAction,
  nextActionAt,
  createdAt
}
```

索引：

```js
{ tenantId: 1, customerId: 1, createdAt: -1 }
{ tenantId: 1, actorUserId: 1, createdAt: -1 }
{ tenantId: 1, nextActionAt: 1 }
```

### 4.3 设计、报价与成交

#### diagnoses

AI 问诊结果需要单独落库，方便复盘、推荐、二次跟进。

```js
{
  _id,
  tenantId,
  customerId,
  opportunityId,
  input,
  painPoints,
  recommendedSystems,
  aiSummary,
  standardVersion,
  createdBy,
  createdAt
}
```

索引：

```js
{ tenantId: 1, customerId: 1, createdAt: -1 }
{ tenantId: 1, opportunityId: 1 }
```

#### designs

不要把大型 2D/3D/CAD 数据全部塞进 project 文档。设计文档可能超过 MongoDB 16MB 限制。

```js
{
  _id,
  tenantId,
  projectId,
  customerId,
  type: 'quick_2d' | 'detailed_2d' | 'rysnova-bim_bim',
  status,
  version,
  summary,
  floorplanRef,       // 对象存储 URL 或 GridFS id
  designDataRef,      // 大 JSON 文件引用
  calculationResultIds,
  createdBy,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, projectId: 1, version: -1 }
{ tenantId: 1, customerId: 1, createdAt: -1 }
```

#### calculation_results

所有专业计算结果必须可审计。

```js
{
  _id,
  tenantId,
  designId,
  projectId,
  type: 'load' | 'fresh_air' | 'hot_water' | 'heating' | 'hydraulic' | 'energy',
  input,
  output,
  assumptions,
  standardRefs,
  formulaVersion,
  engineVersion,
  warnings,
  createdBy,
  createdAt
}
```

索引：

```js
{ tenantId: 1, designId: 1, type: 1, createdAt: -1 }
{ tenantId: 1, projectId: 1, createdAt: -1 }
```

#### quotes / quotations_v2

现有 `Quotation.js` 结构保留为 legacy 兼容；生产新报价持久化使用 `QuotationV2.js`，用于承接设计师 BOM、客户图谱、生命周期 IoT 交接和多租户报价查询。

报价必须保存价格快照，不能引用实时产品价格后被历史价格污染。

```js
{
  _id,
  tenantId,
  dealerId,
  storeId,
  quoteNo,
  projectSnapshot,
  customerId,      // ObjectId -> CustomerV2
  opportunityId,
  lifecycleLinkId,
  ownerUserId,
  version,
  status,
  systemFamilies,
  items: [
    {
      itemId,
      nameSnapshot,
      brandSnapshot,
      modelSnapshot,
      systemFamily,
      category,
      quantity,
      unitPriceSnapshot,
      costSnapshot,
      total
    }
  ],
  costBreakdown,
  marginGuard,
  deliverables,
  lifecycleHandoff,
  assumptions,
  createdBy,
  updatedBy,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, quotationNo: 1 } unique
{ tenantId: 1, customerId: 1, status: 1, updatedAt: -1 }
{ tenantId: 1, dealerId: 1, status: 1, createdAt: -1 }
{ tenantId: 1, storeId: 1, status: 1, createdAt: -1 }
```

### 4.4 产品、价格与促销

#### products

现有 `Product.js` 可保留为基础，但需增加多品牌、多租户可见性和价格分层。

```js
{
  _id,
  tenantId,       // null 表示总部公共产品
  brand,
  sku,
  name,
  category,
  system,
  technicalParams,
  standards,
  status,
  visibility: 'global' | 'dealer' | 'store',
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, sku: 1 } unique
{ brand: 1, category: 1, status: 1 }
{ system: 1, status: 1 }
{ name: 'text', sku: 'text' }
```

#### price_books

不要把所有价格塞到 products。价格策略会按经销商、渠道、城市、时间变化。

```js
{
  _id,
  tenantId,
  dealerId,
  name,
  scope,
  currency,
  validFrom,
  validUntil,
  status
}
```

#### price_items

```js
{
  _id,
  tenantId,
  priceBookId,
  productId,
  sku,
  cost,
  retail,
  dealerPrice,
  minAllowedPrice,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, priceBookId: 1, sku: 1 } unique
{ tenantId: 1, productId: 1 }
```

#### promotions

```js
{
  _id,
  tenantId,
  dealerId,
  name,
  type,
  rules,
  applicableSystems,
  applicableProducts,
  startDate,
  endDate,
  status,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, status: 1, startDate: 1, endDate: 1 }
{ tenantId: 1, dealerId: 1, status: 1 }
```

### 4.5 合同、施工、交付物

#### contracts

现有 `contract.model.js` 需要拆掉大数组，合同主表只存摘要。

```js
{
  _id,
  tenantId,
  dealerId,
  storeId,
  contractNo,
  quoteId,
  projectId,
  customerId,
  status,
  totalPrice,
  signedAt,
  expectedCompletion,
  actualCompletion,
  salesUserId,
  designerUserId,
  engineerUserId,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, contractNo: 1 } unique
{ tenantId: 1, customerId: 1, createdAt: -1 }
{ tenantId: 1, status: 1, expectedCompletion: 1 }
```

#### construction_tasks

```js
{
  _id,
  tenantId,
  contractId,
  phase,
  assignedTeamId,
  assignedUserIds,
  startDate,
  endDate,
  status,
  progress,
  dependencies,
  createdAt,
  updatedAt
}
```

索引：

```js
{ tenantId: 1, contractId: 1, startDate: 1 }
{ tenantId: 1, assignedTeamId: 1, status: 1 }
{ tenantId: 1, status: 1, endDate: 1 }
```

#### material_orders

```js
{
  _id,
  tenantId,
  contractId,
  projectId,
  status,
  items,
  requestedBy,
  approvedBy,
  createdAt,
  updatedAt
}
```

#### acceptance_reports

```js
{
  _id,
  tenantId,
  contractId,
  projectId,
  phase,
  checklist,
  measurements,
  photoRefs,
  customerSignatureRef,
  status,
  submittedBy,
  submittedAt
}
```

#### deliverables

所有 PDF/DWG/XLSX/图片只存元数据和对象存储引用。

```js
{
  _id,
  tenantId,
  projectId,
  contractId,
  designId,
  type: 'proposal_pdf' | 'system_diagram' | 'construction_drawing' | 'bom' | 'acceptance_photo',
  fileName,
  objectKey,
  mimeType,
  size,
  checksum,
  version,
  createdBy,
  createdAt
}
```

索引：

```js
{ tenantId: 1, projectId: 1, type: 1, createdAt: -1 }
{ tenantId: 1, contractId: 1, type: 1, createdAt: -1 }
{ checksum: 1 }
```

## 5. 分片与集群建议

### 上线初期

建议配置：

```text
MongoDB 3 节点 Replica Set
1 primary + 2 secondary
```

适合 10 万用户、几十万报价/项目规模。

### 增长后

当出现以下情况再启用 sharding：

- 单集合超过 5000 万文档。
- 单租户/单区域热点明显。
- 写入峰值长期超过 primary 能力。

优先分片集合：

```text
interactions
calculation_results
deliverables
events/audit_logs
```

候选 shard key：

```js
{ tenantId: 1, createdAt: 1 }
```

不建议早期对 `users/customers/products` 过早分片，复杂度高于收益。

## 6. 缓存策略

Redis 缓存内容：

| Key | TTL | 用途 |
|---|---:|---|
| `auth:session:{tokenId}` | 24h | 会话/权限缓存 |
| `rate:{ip}:{route}` | 15m | 限流 |
| `product:list:{hash}` | 5-15m | 产品列表 |
| `price:{tenantId}:{sku}` | 5m | 价格 |
| `promotion:active:{tenantId}` | 1m | 生效促销 |
| `quote:job:{jobId}` | 1h | 异步报价生成状态 |
| `ai:diagnosis:{hash}` | 1h | 问诊缓存 |

写入产品、价格、促销后必须主动失效相关 key。

## 7. 后端服务分层

目标结构：

```text
server/
  app.js
  config/
    env.js
    database.js
    redis.js
  modules/
    auth/
    crm/
    catalog/
    design/
    quotation/
    delivery/
    rysnova-bim/
  repositories/
    MongoRepository.js
  models/
  routes/
  services/
  jobs/
  seeds/
```

Route 层规则：

- 只处理 HTTP 入参、鉴权、响应。
- 不直接操作 mongoose model。
- 不直接拼复杂查询。

Service 层规则：

- 处理业务流程。
- 负责事务边界。
- 调用 repository。

Repository 层规则：

- 统一注入 `tenantId`。
- 统一分页、排序、投影。
- 统一软删除条件。

## 8. 事务边界

必须使用 MongoDB transaction 的场景：

1. 客户留资 + 创建商机 + 创建互动记录。
2. 报价审批 + 商机阶段推进。
3. 报价转合同 + 创建施工项目。
4. 施工验收通过 + 合同状态更新 + 结算记录生成。
5. 产品价格更新 + 审计日志写入。

不需要事务的场景：

- 页面访问日志。
- AI 问诊缓存。
- 报表统计快照。
- 异步任务状态。

## 9. 审计与安全

必须新增 `audit_logs`：

```js
{
  _id,
  tenantId,
  actorUserId,
  action,
  resourceType,
  resourceId,
  before,
  after,
  ip,
  userAgent,
  createdAt
}
```

索引：

```js
{ tenantId: 1, resourceType: 1, resourceId: 1, createdAt: -1 }
{ tenantId: 1, actorUserId: 1, createdAt: -1 }
```

敏感信息：

- 手机号、地址、客户姓名建议加密存储或至少 phoneHash + phoneEncrypted 双字段。
- API 返回默认脱敏。
- 管理员查看明文需要权限和审计。

## 10. 迁移路线

### Phase 1：建立生产数据库底座

- 完善 `server/db/index.js`，支持 MongoDB、Redis、健康检查、优雅关闭。
- 创建 `Tenant/Dealer/Store/User/Customer/Opportunity` 模型。
- 写 seed 脚本，把当前内存 demo 数据转成标准租户数据。

### Phase 2：迁移 CRM 与用户

- `/api/auth/*` 改为 Mongo users。
- `/api/crm/*` 改为 Mongo customers/opportunities/interactions。
- 保留内存 demo fallback，但只在 `DEMO_MODE=true`。

### Phase 3：迁移产品、价格、促销

- 产品库进入 `products`。
- 价格拆成 `price_books/price_items`。
- 促销进入 `promotions`。
- 报价时保存 product/price/promotion snapshot。

### Phase 4：迁移项目、设计、报价

- `projects/designs/calculation_results/quotes` 全部持久化。
- 报价 v2 主模型已建立为 `QuotationV2`，设计师 BOM 可通过 `QuotationService.persistFromBOM` 写入租户隔离的客户图谱；旧 `Quotation` 仅保留 legacy 路由兼容。
- 大型设计 JSON、CAD、渲染图进入对象存储。

### Phase 5：迁移合同与施工

- `contracts/construction_tasks/material_orders/acceptance_reports/settlements/deliverables` 持久化。
- 施工验收照片和签字进入对象存储。

### Phase 6：报表与扩展

- 建立 `daily_metrics` 聚合表。
- CRM 漏斗、销售趋势、产品排行走聚合快照，避免每次全表扫描。

## 11. 性能验收指标

上线前必须通过：

| 场景 | 指标 |
|---|---:|
| 登录 | P95 < 300ms |
| CRM 客户列表 | P95 < 500ms |
| 客户 360 视图 | P95 < 800ms |
| 产品/价格查询 | P95 < 300ms |
| 报价生成 | P95 < 2s，复杂报价可异步 |
| 施工任务列表 | P95 < 500ms |
| Dashboard 汇总 | P95 < 1s，使用快照 |
| 1000 并发连接 | 错误率 < 1% |
| 100 并发写报价 | 无重复 quoteNo，无数据丢失 |

## 12. 当前代码需修正的点

1. `server-production.js` 内存 `db` 必须降级为 demo seed，不可作为生产数据源。
2. `server/models/User.js` 缺少 `tenantId/dealerId/storeId` 和总部/经销商角色。
3. `server/models/customer.model.js` 字段过薄，缺多租户、来源、状态、负责人、加密字段。
4. `server/models/contract.model.js` 内嵌材料/图纸/施工日志，不适合长期增长，应拆集合。
5. `server/models/Project.js` 内嵌 floorplan/layout3D/materials，后期可能超过文档大小限制，应改为引用。
6. 新报价必须使用 `QuotationV2` 和 `QuotationService`，旧 `Quotation.js` 只能作为 legacy 兼容面，避免旧 String 客户关联继续扩散。
7. 所有查询必须走 repository 注入租户条件，禁止 route 直接查询 model。

## 13. 决策

Rhautt Comfort 上线数据库后端采用：

```text
MongoDB Replica Set + Redis + Object Storage
```

短期不做微服务、不做过早分片。先完成多租户、持久化、索引、缓存、事务和审计。等真实数据量达到瓶颈后，再对 interactions/calculation_results/deliverables/audit_logs 做分片或冷热归档。
