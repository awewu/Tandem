# W-BIM-2 · 2.3 产物迁移计划：A(legacy) → B(NestJS) + 对象存储外部往返证据

> 对象存储外部往返证据的代码实现已完成：`file-artifact` 模块新增 `ObjectStorageEvidenceEntity` + `ObjectStorageEvidenceService`，上传/下载自动记录 SHA-256，并提供 `POST /file-artifact/:id/verify-round-trip` 与 `GET /file-artifact/:id/evidence`。
> 本文档聚焦 legacy 产物迁移方案，实施前须用户确认 legacy 数据源。

## 1. 目标

- 把 legacy 系统（A）中产生的产物（图纸、BOM、签章 PDF、报价单等）迁移到 NestJS（B）系统。
- 每条产物在对象存储中都有可审计的往返证据（sourceHash → destinationHash → pulledHash）。
- 迁移过程可回滚、可重入、不破坏 legacy 数据。

## 2. Legacy 数据源待确认清单

在编写迁移脚本前，需要确认以下信息：

1. **Legacy 产物表/文件位置**
   - 数据库表名（如 `legacy_drawings`、`legacy_boms`、`legacy_contracts`）？
   - 文件目录路径（如 `/mnt/legacy-uploads/...`）？
   - 对象存储桶（如 `s3://legacy-bucket/...`）？
2. **产物类型映射**
   - drawing → `RysnovaArtifactEntity` (`artifact_type='bim_model'`? 或 `'drawing'`)
   - BOM xlsx → `RysnovaArtifactEntity` (`artifact_type='bom'`)
   - 签章 PDF → `delivery.contracts.signedPdfKey` + `uploaded_files`
   - 报价单 → `quotations` 表
3. **归属字段**
   - legacy 中是否有 `tenant_id`、`dealer_id`、`customer_id`？
   - 如果没有，如何映射到当前租户/经销商体系？
4. **文件存储目标**
   - 本地磁盘（`STORAGE_LOCAL_PATH`）还是 S3/OSS？
   - 若切到云存储，需要配置 `STORAGE_PROVIDER` / `STORAGE_REGION` / bucket。
5. **数据量级**
   - 156KB 是指单个产物大小还是总体积？
   - 总记录数？是否需要分批/断点续传？

## 3. 迁移方案（推荐）

### 阶段 A：影子迁移（只读，不删除 legacy）
1. 在 `object_storage_evidence` 表中为每条 legacy 产物补录一条 `migrate` 证据：
   - `sourceHash`：legacy 文件原哈希
   - `destinationHash`：写入对象存储后的哈希
   - `pulledHash`：回拉后重新计算的哈希
2. 把 legacy 文件复制到新的对象存储路径 `object-storage-evidence` 可访问的 `STORAGE_ROOT`。
3. 在 `uploaded_files` / `RysnovaArtifactEntity` 中创建新记录，指向新 `fileKey`，但保留 legacy 原始 ID 在 `meta.legacyId` 中。
4. 不删除 legacy 表数据，仅做状态标记 `migrated=true`。

### 阶段 B：双读期（2 周观察）
1. 新读请求优先读取新路径；若新路径不存在，降级读取 legacy 路径并告警。
2. 每日比对 legacy 与新系统的文件哈希一致性。

### 阶段 C：只读 legacy 与清理
1. 确认一致性 100% 后，legacy 产物表改为只读。
2. 保留 1 个月只读期后，归档 legacy 文件到冷存储，删除热存储副本。

## 4. 迁移脚本接口设计

```typescript
// scripts/migrate-legacy-artifacts.ts
export interface MigrateLegacyArtifactsOptions {
  tenantId: string;            // 指定租户，避免全量误操作
  artifactType: string;        // 'drawing' | 'bom' | 'contract_pdf' | 'quote'
  sourceTable: string;         // legacy 表名
  sourceStoragePath?: string;  // legacy 本地目录或 S3 prefix
  dryRun: boolean;             // true 只统计，不写入
  limit?: number;              // 分批条数
}
```

脚本核心流程：
1. 读取 legacy 记录（分页）。
2. 计算源文件 `sourceHash`。
3. 写入对象存储，得到 `fileKey` 和 `destinationHash`（或 ETag）。
4. 回拉文件并计算 `pulledHash`。
5. 若 `sourceHash === pulledHash`，写入 `uploaded_files` + `object_storage_evidence`，否则记录失败并跳过。
6. 输出迁移报告：成功数、失败数、哈希不一致数。

## 5. 对象存储证据链

已完成代码：
- `services/api/src/modules/file-artifact/object-storage-evidence.entity.ts`
- `services/api/src/modules/file-artifact/object-storage-evidence.service.ts`
- `services/api/src/modules/file-artifact/object-storage-evidence.service.spec.ts`

证据表字段：
- `source_hash`：上传前本地哈希
- `destination_hash`：对象存储侧哈希/ETag
- `pulled_hash`：回拉后重新计算的哈希
- `operation`：upload / download / migrate / verify
- `meta`：扩展字段（如 `legacyId`、`migratedBy`）

## 6. 验收标准

- [ ] 所有 legacy 产物在新系统都有对应记录。
- [ ] 每条产物都有 `object_storage_evidence` 记录，且 `sourceHash === pulledHash`。
- [ ] `POST /file-artifact/:id/verify-round-trip` 返回 `match=true`。
- [ ] 迁移脚本支持 `dryRun` 和断点续传。
- [ ] 迁移过程可回滚，不删除 legacy 数据。

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| legacy 文件缺失或损坏 | 迁移脚本跳过并记录失败；人工复核 |
| 归属字段缺失导致跨租户/经销商问题 | 迁移前先做字段映射；缺失的归属标记为 `unknown` 并单独审核 |
| 大文件迁移超时 | 分批 + 异步队列（如 Temporal / BullMQ） |
| 哈希不一致 | 重试 3 次；仍不一致则人工介入，不强制覆盖 |

## 8. 下一步

用户提供 legacy 数据源信息后，即可开始编写 `scripts/migrate-legacy-artifacts.ts` 并执行影子迁移。
