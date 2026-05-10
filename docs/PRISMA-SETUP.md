# Prisma + PostgreSQL 启用指南

> **适用**: V1 GA 生产部署 / 客户私有化部署
> **不适用**: dev / e2e 跑 demo — 不配 `DATABASE_URL` 会自动回退到 InMemory store
> **参考宪章**: §13 数据归公司 · §18 OSS 借力, 底座社区, 思考层自建

---

## 为什么 Prisma + PG

Tandem 的 storage 层有两条路径, 都实现同一个 `TandemStore` 接口 (`@/lib/storage/repository.ts`):

| 路径 | 用途 | 持久化 | 切换方式 |
|---|---|---|---|
| **InMemory** | dev / e2e / demo | 进程重启丢数据 | 默认 (不设 `DATABASE_URL`) |
| **Prisma + PG** | V1 GA / 生产 / 客户部署 | 持久 | 设 `DATABASE_URL` |

`lib/boot.ts` 自动检测. 代码层已经就绪, 你只需:

1. 本地装 PG (下方 3 条命令二选一)
2. 把 `DATABASE_URL` 加到 `.env.local`
3. `npm run db:migrate`
4. 重启 `npm run dev`

就是这样. 不需要改任何业务代码.

---

## 1. 本地装 PG

### 1a. Windows 原生 (推荐)

```powershell
# winget 一键装 PostgreSQL 16 (自动注册为服务)
winget install -e --id PostgreSQL.PostgreSQL.16

# 装完后 psql 已在 PATH. 用默认 superuser 登录:
$env:PGPASSWORD = '装的时候设的密码'
psql -U postgres -h localhost -c "CREATE ROLE tandem WITH LOGIN PASSWORD 'tandem';"
psql -U postgres -h localhost -c "CREATE DATABASE tandem OWNER tandem;"
```

### 1b. 不想装? Prisma 本地 sqlite 模式 (仅供单机演示, 不推荐生产)

编辑 `prisma/schema.prisma` 把 `provider = "postgresql"` 改成 `"sqlite"`, 然后 `DATABASE_URL=file:./tandem.db`. 会丢掉 `String[]` / `Json` 的 native 支持 — 只适合 **纯演示**, 不进生产.

---

## 2. 配 `.env.local`

```dotenv
DATABASE_URL=postgresql://tandem:tandem@localhost:5432/tandem?schema=public
```

其他 auth / LLM 变量保持不变 (见 `.env.local.example`).

---

## 3. 建表 + 种子

```powershell
# 生成 Prisma Client (package.json 有别名)
npm run db:generate

# 首次建表 (会问你给这次 migration 取啥名, 输 init 就行)
npm run db:migrate

# 开个 Prisma Studio 看数据 (可选)
npm run db:studio
```

注意: **不会自动跑 `seedDevData`**. `lib/boot.ts` 里的 seed 仅在 InMemory 模式执行 —
生产环境的初始数据应通过 `bootstrap_owner` + admin UI 的 "新建频道 / 新建 KR" 流程建立.

如果想快速测试 Prisma 路径, 可以手动在 `npm run db:studio` 里 insert 一行 Persona / Channel.

---

## 4. 切换 + 验证

```powershell
# 清缓存重启
npm run dev

# 启动日志里应看到:
# [boot] storage=prisma (DATABASE_URL detected)
# (如果 DATABASE_URL 没配或连不上, 会看到:
#  [boot] storage=in-memory (no DATABASE_URL). ...)
```

接着跑:

```powershell
# Owner 应该能 bootstrap + login (Prisma 的 User 表里会多一行)
node scripts/e2e-auth.mjs
```

如果 `node scripts/e2e-auth.mjs` 对着 Prisma 模式仍然 17/17 PASS, 说明迁移成功.
对着 in-memory 模式跑 e2e-v1.ps1 仍然可以, 两条路径互不影响.

---

## 5. 回退到 InMemory

```powershell
# 注释掉 .env.local 里的 DATABASE_URL 行
# 重启 npm run dev
# 启动日志: [boot] storage=in-memory
```

InMemory 每次重启都会重跑 `seedDevData` + `bootstrapOwnerIfMissing`, 适合 dev.

---

## 6. 生产部署流程 (补记)

```bash
# 在生产服器上:
export DATABASE_URL=postgresql://tandem:pw@db:5432/tandem
npm ci --production
npm run db:generate
npm run db:deploy              # 不是 migrate dev — 不会 prompt
NODE_ENV=production npm run build
NODE_ENV=production npm start
```

`db:deploy` vs `db:migrate`:

- `db:migrate` 开发期用 — 会 prompt 名字, 会写 `prisma/migrations/`
- `db:deploy` 生产用 — 只 apply 已存在的 migrations, 不 prompt

---

## 7. 注意事项

- **seedDevData** 在 Prisma 模式下**不跑**. 这是故意的 (宪章 §13: 数据归公司, 不能预置演示数据到真实客户表).
- **tenantId** V1 固定为 `default`. V2 SaaS 启用多租户时, Session 里会注入真实 tenantId.
- **pgvector** schema 已经声明为 `String[]`, V2 会切到 native vector 类型以支撑 Memory retriever. 现在不开也能跑.
- **Prisma 类型 ↔ TS 接口** 的边界转换 (Date ↔ ISO string) 在 `lib/storage/prisma-store.ts` 的 `dt()` 封装内. 不要在业务层暴露 Prisma Date.
- **auth 的 cascade delete** User 删了 PasswordHash / Session / MfaSecret / Invite 级联删. 匿名化端点 (`/api/admin/users/[id]/anonymize`) **不删 User**, 只脱敏 — FK 完整性保留.
