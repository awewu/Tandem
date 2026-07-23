# Everhot 后台生产化激活清单（SSO/RBAC + RLS）

> 用途：把「代码就绪」的 brand-console 生产鉴权（本仓自有 SSO + RBAC）与 Everhot 品牌运营租户
> 的 RLS 隔离，在生产环境**一次性激活**。代码已落地并 `tsc` 零错误（见
> `docs/EVERHOT-NEXUS-INTEGRATION-DESIGN.md` §7 P5/P6）。本文件是照着做的 runbook。
>
> 适用对象：负责 Everhot 上线的 ops / 平台工程。
> 前提：不改代码，只注入生产参数并执行迁移与冒烟。

---

## 0. 待提供的输入（业务/生产先补齐，再开始）

> 这几项目前**没有答案**，是激活的硬前置。补齐后填入下表，再进入第 1 步。

| 项 | 说明 | 由谁提供 | 值（填实） |
|---|---|---|---|
| `SSO_ISSUER` | 统一身份 OIDC issuer，须提供 `/.well-known/openid-configuration` | 平台/IdP 团队 | `__________` |
| `SSO_CLIENT_ID` | 为 brand-console 注册的 OIDC 客户端 ID | IdP 团队 | `__________` |
| `SSO_CLIENT_SECRET` | 客户端密钥（放密钥管理，勿入库） | IdP 团队 | `（secret manager）` |
| `SSO_REDIRECT_URI` | 回调地址，须与 IdP 注册一致 | ops | `https://console.everhot.com.cn/api/session/callback` |
| 管理员组名 | 映射到 `brand_admin`（可写/发布） | IdP 团队 | 默认 `everhot-admin` |
| 只读组名 | 映射到 `brand_viewer`（只读） | IdP 团队 | 默认 `everhot-viewer` |
| 组声明字段 | userinfo 里承载组的 claim 名 | IdP 团队 | 默认 `groups` |
| 生产 DB | 跑着 `rhautt_nexus` schema 的 Postgres 连接串 | DBA/ops | `__________` |
| `JWT_SECRET` | 须与 `services/api` 运行时一致 | ops | `（与 API 对齐）` |

**固定常量（已在代码/迁移中约定，无需改）：**
- Everhot 品牌运营租户 UUID：`e5e40000-0000-4000-8000-000000000001`
- 迁移文件：`database/postgres/migrations/009_everhot_brand_tenant.sql`

---

## 1. 前置检查

- [ ] 生产 Postgres 可连，且已应用迁移 `001`~`008`（`rhautt_nexus` 底座已建）。
- [ ] `services/api` 生产运行时 `POSTGRES_SCHEMA=rhautt_nexus`、`JWT_SECRET` 已设。
- [ ] brand-console 与 `services/api` 的 `JWT_SECRET` **一致**（会话/服务令牌互验）。
- [ ] IdP 已为 brand-console 注册 OIDC 客户端，回调 = `SSO_REDIRECT_URI`。
- [ ] IdP 已建 `everhot-admin` / `everhot-viewer` 组，并给相应人员授权。

---

## 2. 种子 Everhot 品牌运营租户（迁移 009）

```bash
# 在生产 DB 环境变量就绪的前提下（POSTGRES_* / DATABASE_URL）
node scripts/db/apply-migrations.js --status      # 确认 009 处于 pending
node scripts/db/apply-migrations.js               # 应用至 009（幂等）
```

- [ ] `--status` 显示 `009_everhot_brand_tenant.sql` 由 pending → applied。
- [ ] 校验租户已入库：

```sql
SELECT id, code, tenant_type, status
  FROM rhautt_nexus.tenants
 WHERE id = 'e5e40000-0000-4000-8000-000000000001';
-- 期望：code=everhot, tenant_type=hq, status=active
```

> 说明：009 只**种子租户**，不改 `products` 结构、不强开 `products` 的 FORCE RLS
> （`products` 是跨品牌共享 HQ 目录，需平台评审才动）。产品行归属见第 4 步。

---

## 3. 切租户 env（brand-console + everhot 脚本 + 公开端点）

把「共享哨兵」`rhautt_shared` 全部切到 Everhot 租户 UUID，三处必须一致：

| 位置 | 变量 | 生产值 |
|---|---|---|
| brand-console | `BRAND_TENANT` | `e5e40000-0000-4000-8000-000000000001` |
| everhot 脚本 / 发布 | `EVERHOT_TENANT_ID` | `e5e40000-0000-4000-8000-000000000001` |
| services/api（公开只读端点默认租户） | `EVERHOT_TENANT_ID` | `e5e40000-0000-4000-8000-000000000001` |

- [ ] 三处 env 已设为同一 UUID。

> `sync-products-to-nexus.mjs`、`product-catalog.service.ts`（`listBrandPublic`）均已读
> `EVERHOT_TENANT_ID`，默认回退 `rhautt_shared`（dev 不受影响）。

---

## 4. 产品行归属到 Everhot 租户（一次性数据激活）

> 必须与第 3 步**成对执行**：先切 env，再 repoint，避免公开产品流出现空窗。

打开 `009_everhot_brand_tenant.sql` 中默认注释的 repoint 块，或直接执行等价 SQL：

```sql
UPDATE rhautt_nexus.products
   SET tenant_id = 'e5e40000-0000-4000-8000-000000000001'
 WHERE brand = 'everhot'
   AND tenant_id <> 'e5e40000-0000-4000-8000-000000000001';
```

- [ ] 执行后核对行数：

```sql
SELECT tenant_id, count(*) FROM rhautt_nexus.products
 WHERE brand = 'everhot' GROUP BY tenant_id;
-- 期望：全部行 tenant_id = e5e40000-...-000000000001
```

---

## 5. 开启 SSO / RBAC（brand-console）

设置 brand-console 生产环境变量（密钥走密钥管理，勿写入仓库）：

```bash
BRAND_CONSOLE_AUTH_MODE=sso
SSO_ISSUER=...                 # 见 §0
SSO_CLIENT_ID=...
SSO_CLIENT_SECRET=...          # secret manager
SSO_REDIRECT_URI=https://console.everhot.com.cn/api/session/callback
SSO_SCOPES=openid profile email groups
SSO_GROUPS_CLAIM=groups
SSO_ADMIN_GROUPS=everhot-admin
SSO_VIEWER_GROUPS=everhot-viewer
```

- [ ] 部署后访问登录页只显示「使用统一身份（SSO）登录」，无账号密码框。
- [ ] dev 账号密码在生产**不可用**（`AUTH_MODE=sso` 时 `POST /api/session` 返回 400）。

---

## 6. 冒烟验证（逐条勾选）

- [ ] **SSO 登录**：admin 组成员点「SSO 登录」→ 跳 IdP → 回调 → 进入控制台。
- [ ] **角色正确**：顶栏显示「管理员」；`GET /api/session` 返回 `role: brand_admin`。
- [ ] **admin 可写**：改某产品 tagline → 保存 200 → 发布 → 站点(4011/生产)返回新文案。
- [ ] **viewer 只读**：viewer 组成员登录 → 顶栏「只读」→ 无上新/发布按钮 → 直接
      `POST /api/products` 返回 **403**。
- [ ] **未授权组拒绝**：不在两组的账号登录 → 回 `/?err=not_authorized`，不建会话。
- [ ] **公开端点**：`GET /api/v2/brand/everhot/products` 返回本租户产品（数量与后台一致）。
- [ ] **RLS 隔离**：以其它租户令牌读 `rhautt_nexus` 覆盖表，读不到 Everhot 数据。
- [ ] **审计归因**：写操作后 `audit_logs` 的 actor 为**真实登录用户**（非 `brand-console`）。

---

## 7. 回滚

| 场景 | 回滚动作 |
|---|---|
| SSO 异常需临时恢复 | brand-console 置 `BRAND_CONSOLE_AUTH_MODE=dev` 并配 dev 账号（应急，尽快修 SSO） |
| 产品行 repoint 误操作 | `UPDATE rhautt_nexus.products SET tenant_id='rhautt_shared' WHERE brand='everhot'` + 三处 env 改回 `rhautt_shared` |
| 迁移 009 | 迁移只新增租户行，无破坏性；如需移除：`DELETE FROM rhautt_nexus.tenants WHERE id='e5e40000-0000-4000-8000-000000000001'`（须先无引用） |

> 注意：curated 迁移一经应用即不可变（`schema_migrations` 校验 sha256）。回滚数据用上表 SQL，勿改 009 文件内容。

---

## 8. 环境变量速查

**brand-console（生产）**
```
NEXUS_API_URL / NEXUS_API_PREFIX / JWT_SECRET
BRAND=everhot
BRAND_TENANT=e5e40000-0000-4000-8000-000000000001
BRAND_CONSOLE_AUTH_MODE=sso
SSO_ISSUER / SSO_CLIENT_ID / SSO_CLIENT_SECRET / SSO_REDIRECT_URI
SSO_SCOPES / SSO_GROUPS_CLAIM / SSO_ADMIN_GROUPS / SSO_VIEWER_GROUPS
EVERHOT_DIR=../everhot-cn
```

**services/api（生产）**
```
POSTGRES_* / DATABASE_URL / JWT_SECRET
POSTGRES_SCHEMA=rhautt_nexus
EVERHOT_TENANT_ID=e5e40000-0000-4000-8000-000000000001
```

**everhot 脚本 / 发布**
```
EVERHOT_TENANT_ID=e5e40000-0000-4000-8000-000000000001
```

---

## 9. 涉及文件（代码已就绪，本清单不改代码）

- `apps/brand-console/src/lib/brand.ts` — OIDC SSO、RBAC 角色、会话、服务令牌 actor 归因
- `apps/brand-console/src/app/api/session/route.ts` — 会话查询 + dev 登录（sso 模式禁用）
- `apps/brand-console/src/app/api/session/sso/route.ts` — 发起 OIDC（state cookie）
- `apps/brand-console/src/app/api/session/callback/route.ts` — OIDC 回调
- `apps/brand-console/src/app/api/{products,images,publish}/route.ts` — 写操作 RBAC 403
- `apps/brand-console/src/components/{Login,Console}.tsx` — SSO 登录入口 + 角色 UI 门
- `services/api/src/modules/product-catalog/product-catalog.service.ts` — `scoped()` RLS 数据面
- `database/postgres/migrations/009_everhot_brand_tenant.sql` — 种子租户 + repoint（默认注释）
- `apps/brand-console/.env.local` — 本地/生产 env 模板与注释

---

_最后更新：2026-07-02 · 与 `EVERHOT-NEXUS-INTEGRATION-DESIGN.md` §7/§8 同步_
