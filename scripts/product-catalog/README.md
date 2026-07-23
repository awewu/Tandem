# 官网产品抓取预览

该目录只负责读取 Rheem、Ruud、Everhot 官网公开产品资料，并生成 PostgreSQL 导入前的 dry-run 预览。

```powershell
node scripts/product-catalog/official-product-preview.js
node --test scripts/product-catalog/official-source-adapters.test.js
```

输出：

- `evidence/provenance/official-product-preview.json`：完整结构化记录、原始字段、来源 URL、抓取时间与完整率。
- `evidence/provenance/official-product-preview.md`：品牌数量、缺失字段、分类与数据警告摘要。

人工确认预览后，先应用数据库迁移并启动 NestJS API，再执行受保护的幂等导入：

```powershell
node scripts/db/apply-migrations.js --dry-run
node scripts/db/apply-migrations.js
node scripts/product-catalog/import-official-product-preview.js
node scripts/product-catalog/import-official-product-preview.js --apply
node scripts/product-catalog/verify-official-product-import.js
```

导入器通过 `/api/v2/product-catalog/devices` 写入，不直接写 `products` 表。默认命令只展示品牌、租户和数量；`--apply` 才会写入，并生成 `evidence/provenance/official-product-import-result.json`。
独立数据库校验会生成 `evidence/provenance/official-product-db-verification.json`。

边界：

- 不访问账号、经销商或非公开页面。
- 不读取密钥，不调用 Nexus API，不写 PostgreSQL。
- 不猜测官网未公开的型号、价格或参数。
- 不自动修正官网自身冲突，只记录 `dataQualityWarnings`。
- 产品保持 `draft` 且 `tenantId` 为空，人工确认后才能进入后续导入流程。
