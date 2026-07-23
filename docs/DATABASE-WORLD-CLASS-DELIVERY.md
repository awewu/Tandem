# 世界级数据库交付（Rhautt Nexus PostgreSQL Ledger）

日期：2026-06-29 · 范围：让已被守卫锁定的目标 schema 真正「可运行、可复现、运行时强隔离」。

> 既有事实：`database/postgres/migrations/001_…sql`（+002/003）是**经守卫校验且 SHA 锁定**的目标契约，
> 含 RLS / 审计 / outbox / workflow。本次交付**不改动**这些迁移 SQL，全部为增量。

## 三层落地

### Layer 1 · RLS 运行时强隔离（应用层）
迁移里的 RLS 策略读取 `current_setting('app.tenant_id')`，但运行时必须有人 `SET LOCAL` 才会生效。新增：

- `services/api/src/modules/common/tenant-context.ts` —— `AsyncLocalStorage` 承载请求级 `{tenantId, actorId, role}`
- `services/api/src/modules/common/tenant-context.interceptor.ts` —— 全局拦截器，从 `req.user`（AuthGuard 注入）建立租户上下文；无 token 时 no-op，安全
- `services/api/src/modules/common/rls.ts` —— `withRlsTransaction()`：在事务内用 **参数化** `set_config('app.tenant_id', …, true)`（即 `SET LOCAL`，注入安全）绑定租户/操作者，使 RLS 在数据库层真正隔离
- `app.module.ts` 注册 `APP_INTERCEPTOR`

**采用路径**：租户作用域的写/读改为走 `withRlsTransaction(dataSource, (em) => …)`。机制已就绪并经真库验证（见 Layer 3）。

### Layer 2 · 迁移运行器 + DataSource（可复现）
- `scripts/db/apply-migrations.js` —— 幂等运行器（用已装的 `pg`）：按文件名顺序应用 `*.sql`，用 `public.schema_migrations`(filename+sha256) 记录；**漂移保护**（已应用文件内容变更即报错）；支持 `--status` / `--dry-run`，每个迁移独立事务
- `services/api/src/data-source.ts` —— TypeORM DataSource（`synchronize:false` / `migrationsRun:false`），仅供工具/内省
- `app.module.ts` —— `synchronize` 增加 `POSTGRES_SYNCHRONIZE=true|false` 强制开关（默认仍 dev-only），明确「schema 归迁移所有，不归 TypeORM」
- npm：`db:migrate` / `db:migrate:status` / `db:migrate:dry-run`

```bash
DATABASE_URL=postgres://user@host:5432/rhautt_nexus npm run db:migrate
```

### Layer 3 · 真库应用 + RLS 证据
- `scripts/db/rls-apply-proof.js`（`npm run db:rls-proof`）—— 对**真实 PostgreSQL**在**一个最终 ROLLBACK 的事务**里应用迁移并验证 RLS（不持久化任何东西）
- 本地验证结果（6/6 通过，写入 `evidence/database/local-rls-apply-proof.{json,md}`）：
  - migration 应用成功
  - 租户作用域 insert/select 正常
  - **跨租户写被拒**（PG 错误 `42501` = RLS 策略违反）
  - **跨租户读被隔离**（租户 B 看到 0 行）
  - 7 张关键表 **FORCE RLS** 生效

> 这是**本地正确性证据**，非上线证据，且 `finalLaunchDatabaseProof: false`。

## 验收守卫映射

| 能力 | 守卫 / 证据 | 状态 |
|---|---|---|
| 目标 schema 契约 | `npm run guard:postgres-target-schema` | 0 failures |
| RLS 行为（模拟） | `npm run guard:postgres-rls-behavior` | 0 failures |
| 事务 + outbox | `npm run guard:postgres-transaction-outbox` | 0 failures |
| RLS 真库证据（本地） | `npm run db:rls-proof` | 6/6 pass |
| 迁移可复现 | `npm run db:migrate:status` | 就绪 |

## 仍待执行（运维侧，按治理要求）
- **Staging 证据**：`POSTGRES_STAGING_URL=<非本地 staging 库> npm run release:postgres-staging:smoke`
  （`external-proof-validation` 故意拒绝 localhost，防止用本地冒充上线证据）→ 产出 `finalLaunchDatabaseProof`
- **服务采用** `withRlsTransaction` 替换裸 repository 写路径（逐模块灰度）
- **应用连接角色**：生产用**非属主**角色连接（属主会绕过 RLS，除非 FORCE；迁移已 FORCE，但仍建议最小权限角色）
