# 瑞合数智枢纽 · 软件架构蓝图（Rhautt Nexus）

> 版本：2026-07-06 架构收敛裁定后。本文为**唯一权威蓝图**，任何新增应用/端点/跳转必须遵循此处约定。

---

## 0. 一句话定位

一个 **pnpm monorepo**，前端为多个独立 **Next.js 应用（apps/\*）**，后端唯一真相源为 **NestJS 服务（services/api，端口 3300，前缀 `/api/v2`）+ PostgreSQL**。旧的 Vite SPA + Express（`server/`，端口 3001）已**冻结待退场**。

---

## 1. 分层架构

```
┌──────────────────────────────────────────────────────────────┐
│  前端层 · apps/*  (Next.js 16, 各自独立端口)                    │
│  ┌────────────┬────────────┬────────────┬─────────────────┐   │
│  │ 集团门户    │ B端工作台   │ C端门户     │ 内部控制台        │   │
│  │public-portal│dealer/design│customer/    │nexus/brand      │   │
│  │  (4005)    │ (4000/4003) │diagnosis    │ console(4010/12)│   │
│  └────────────┴────────────┴────────────┴─────────────────┘   │
│         │ 同源相对 /api/v2/*（next.config rewrites 服务端转发） │
└─────────┼────────────────────────────────────────────────────┘
          ▼
┌──────────────────────────────────────────────────────────────┐
│  API 层 · services/api  (NestJS + Fastify)                     │
│  端口 3300 · 全局前缀 /api/v2 · JWT(AuthGuard, deny-by-default) │
│  模块: auth crm design ai-design rysnova-bim lifecycle delivery │
│        product-catalog file-artifact quote analytics ...       │
└─────────┬────────────────────────────────────────────────────┘
          ▼
┌──────────────────────────────────────────────────────────────┐
│  数据层 · PostgreSQL (RLS 租户隔离) + 对象存储 + Redis          │
│  database/postgres/migrations/*.sql  (TypeORM entities)        │
└──────────────────────────────────────────────────────────────┘

  ⚠️ 冻结待退场：server/ (Express :3001) + src/ (Vite SPA)
     —— 仍可运行，但不接受新域/新端点；前端已全部切走 3300。
```

---

## 2. 应用与端口总表（唯一约定）

| 应用 | 端口 | 类型 | 定位 | 认证 |
|---|---|---|---|---|
| `public-portal` | 4005 | 静态/SSR | **集团门户**（C端品牌 + 专业通道入口聚合） | 无需登录 |
| `consumer-diagnosis` | 4001 | Next | Rysnova AI 问诊（C端获客） | 无需登录 |
| `customer-portal` | 4002 | Next | **客户门户**（查项目进度/验收） | cookie（客户） |
| `dealer-workbench` | 4000 | Next | **经销商工作台 + 登录中心**（CRM/报价/BIM/经营） | **登录入口** |
| `designer-workbench` | 4003 | Next | 设计师工作台（精算/2D/BIM查看/AI/BOM） | cookie（跳4000登录） |
| `nexus-console` | 4010 | Next | 经营控制台（租户/品牌/分析，内部 admin） | httpOnly cookie |
| `brand-console` | 4012 | Next | 品牌运营控制台（产品库/DAM/发布） | 服务端 SSO |
| `everhot-cn` | 4011 | 静态 | Everhot 独立品牌站 | 无 |
| `lithnova-cn` | 4013 | 静态 | Lithnova 独立品牌站 | 无 |
| `services/api` | **3300** | NestJS | **后端唯一真相源** | JWT |
| ~~`server/`~~ | ~~3001~~ | Express | ⚠️ 冻结待退场 | — |

> 端口 4004 曾被误引用，已废弃（经营控制台正确端口为 4010）。

---

## 3. 门户层级（谁是入口）

```
集团门户 public-portal (4005)  ← C端总入口
   ├─ /professional 专业通道
   │     ├─ 经销商工作台 → dealer-workbench (4000)  ← 登录中心
   │     ├─ 设计师工作台 → designer-workbench (4003)
   │     ├─ 经营控制台   → nexus-console (4010)
   │     └─ 客户查进度   → customer-portal (4002)
   └─ 品牌矩阵 → everhot/rheem/ruud/rysnova/lithnova

登录中心 dealer-workbench (4000)
   · 唯一实现登录表单（根路由 `/` 即登录页）
   · 登录成功 → 写 cookie nx_token（跨端口共享）→ 跳 returnUrl
   · 其它 B端应用无 token 时统一重定向到此登录
```

**规则**：新增 B 端工作台一律不自建登录页，未认证时重定向到 `NEXT_PUBLIC_LOGIN_URL`（默认 4000），带 `?returnUrl=`。

---

## 4. 认证体系（统一为 cookie SSO）

**单一机制：JWT 存于共享 cookie `nx_token`。**

```
登录 (dealer-workbench :4000)
  auth.login(phone,password) → POST /api/v2/auth/login
  → setToken(jwt)  // packages/shared-auth：写 cookie nx_token; path=/; SameSite=Lax
  → 浏览器在所有 localhost:* 端口共享该 cookie

前端请求任意应用
  fetch('/api/v2/...', { credentials: 'include' })   ← 同源相对路径
  → next.config rewrites 服务端转发到 :3300，并透传 cookie
  → NestJS AuthGuard 接受 Authorization: Bearer 或 cookie nx_token（二选一）
```

**约定**：
- 前端 API 调用**一律**用同源相对 `/api/v2/*` + `credentials: 'include'`。禁止硬编码 `http://localhost:3001/3300`（会引发 CORS 与 token 跨源泄露）。
- 客户端不再依赖 `localStorage['token']` 做跨应用共享（localStorage 按 origin 隔离，跨端口不通）。localStorage 仅作单应用内的便捷缓存。
- **生产跨子域 SSO**：cookie 必须设 `Domain=.rhautt.com`（父域），否则 `dealer.rhautt.com` 与 `design.rhautt.com` 不共享。这是上线前必须补的一项（见 §7）。
- 控制台类（nexus/brand）走**服务端 httpOnly cookie + BFF 路由**（`app/api/*` route handlers），原始 token 从不下发浏览器。

---

## 5. API 契约规则

| 规则 | 内容 |
|---|---|
| Base URL | 前端一律相对路径；`NEXT_PUBLIC_API_URL` 默认空串 |
| 前缀 | **所有后端路径必须 `/api/v2/<module>/...`**（NestJS 全局前缀 `api/v2`） |
| 代理 | 每个需调后端的 app 在 `next.config.js` 配 `rewrites: /api/:path* → (API_URL||http://localhost:3300)/api/:path*` |
| 响应包络 | `{ success: true, data: {...} }`；前端取 `json.data ?? json` |
| 认证 | `credentials: 'include'`；受保护端点默认 deny，`@Public()` 才放行 |
| 无 body 的 POST | 不要带 `Content-Type: application/json`（Fastify 会拒空 body 带该头） |

**常见断点自检**：路径漏 `v2`、base 指向 3001、缺 `credentials` → 均导致 404/401。

---

## 6. 数据与领域

- **ORM/迁移**：TypeORM entities + `database/postgres/migrations/*.sql`，用 `npm run db:migrate` 应用。
- **租户隔离**：Postgres RLS + `withRlsTransaction` + `AuthGuard.isValidScope`（校验 tenantId/dealerId 等）。
- **核心领域链**：`crm(签单)` → `rysnova-bim(承接/深化)` ↔ `design(精算/放行)` → `delivery/lifecycle(交付/验收)` → `customer-portal(进度)`。
- **W-BIM-0 迁移**：`bim_projects` 与 `delivery`/`lifecycle` 双写 + 聚合视图 `v_bim_project_delivery`，逐步弃用旧字段（见 `docs/W-BIM-0-MIGRATION-PLAN-*.md`）。
- **hvac 计算**：`packages/domain/hvac-kernels`（LoadCalculationEngineV3 / WaterSystemEngine）为单一真相源。

---

## 7. 迁移路线（退场旧架构）

1. **[已完成]** 所有 apps 前端切到 :3300（API 层收敛）。
2. **[已完成]** 死链 4004→4010；跨链 env 化；dev 一键编排 `pnpm dev:all`。
3. **[已完成]** 后端能力对齐 + Express v2 下线：Express `/api/v2/**` 默认全量代理到 NestJS；本地重复实现 `v2.router` 用 `ENABLE_LEGACY_V2_API`（默认 false）关闭，代码保留可回退。
4. **[已完成]** 生产 SSO：`shared-auth` cookie 支持 `NEXT_PUBLIC_COOKIE_DOMAIN=.rhautt.com` + `NEXT_PUBLIC_COOKIE_SECURE`（见 `.env.production.example`）。
5. **[已完成]** `customer-portal` 补客户短信验证码登录（`/login`）+ `/dashboard` 守卫。
6. **[已完成 · P1]** 生产 `/api/v2` 默认全量反代到 NestJS：`server/modules/productionMiddleware.js` 的 `isNestJSMigrated` 默认匹配全部 `/api/v2/**`（bodyParser 之前，POST 安全）；`server/index.js` 同步。回退开关 `LEGACY_V2_INPROCESS=true`。
7. **[待办 · P2，需先部署验证]** 部署确认生产 `/api/v2` 流量全落 NestJS、观察期无异常后，物理删除 `server/modules/v2.router.js`+routes、迁移/删 `v2-routes.test.js`、改约 guard、重生 provenance。

### 7.1 Express v2 ↔ NestJS 能力对齐矩阵

| Express `/api/v2` 域 | NestJS 对应 | 活跃前端消费者 | 处理 |
|---|---|---|---|
| auth / crm / design / diagnosis / lifecycle / rysnova-bim / analytics / governance / health / quotation | 同名控制器 ✓ | 有 | 代理转发 |
| contracts（复数） | `contract`（单数） | 无 | 无消费者；如需再对齐命名 |
| audit | 无独立控制器（并入 ai-design 子路由/内部服务） | 无 | Express-only，待评估是否补 NestJS 端点 |
| system-packs | 无 | 无 | Express-only，待评估是否补 NestJS 端点 |

> 结论：apps/* 全部依赖的域 NestJS 均已覆盖；3 个 Express-only 域无活跃前端调用，故可安全下线 Express v2。

---

## 8. 本地启动（唯一入口）

```bash
pnpm dev            # = dev:all：一次拉起 NestJS(3300) + 所有 Next 应用（干净启动）

# 或单独起某个
pnpm dev:api        # NestJS 3300
pnpm dev:dealer     # 4000（登录中心）
pnpm dev:designer   # 4003
```

先访问 **集团门户 http://localhost:4005** 或直接 **登录中心 http://localhost:4000**。

> ✅ 已物理删除：旧 Vite SPA（`frontend/`、`vite.config.js`、`vite`/`@vitejs` 依赖、`dev:client`/`preview` 脚本）。`build` 已改为 `pnpm -r --filter ./apps/** build`。旧 Express 单独调试用 `npm run dev:legacy-api`。

### 8.1 ⚠️ 深度清理的治理耦合（未删，需专项）

以下"死代码"**不能盲删**，因为已被 guard/test/audit/provenance 治理层硬引用，盲删会让 `guard:all` 与 `test:production-readiness` 变红：

| 目标 | 耦合点 | 安全删除前提 |
|---|---|---|
| `server/modules/v2.router.js` + routes | **生产负载承载**：`server-production.js`（`npm start`）→ `productionAppFactory` → `productionRouteCatalog.js:81` 注册 `{ id:'v2', prefix:'/api/v2' }` 仍由此 Express 提供；另被 `v2-routes.test.js` in-process 测试 + `nestjs-boundary-check`/`delivery-goal-check`/`generate-provenance` 引用 | **须先把生产 `/api/v2` 反代切到 NestJS 3300**（部署层改造），确认无流量后再删路由/测试/guard/重生证据。属部署切换项，非代码清理 |
| `archive/` `_archive/` `experiments/` `commercial-hvac-design/` | `legacy-surface-*`/`trunk-migration`/`code-size-trunk`/`workspace-size` 等 guard + `audit/*.json` 快照 | 逐 guard 更新 manifest/allowlist，再删并重生审计报告 |
| `Dockerfile.frontend` + `.github/workflows` 的 `dist/` 前端构建 + `deploy.sh` | 旧 Vite 部署链；`code-size-trunk` allowlist（无害） | 重写为多 app（Next）部署后再删 |

> 建议：按上表逐项做「更新治理引用 → 删除 → 重生证据 → 跑 guard:all 验证」的专项，而非一次性 rm。启动混乱已由 `pnpm dev` 收敛解决，其余为代码库卫生，可分批安全推进。

---

## 9. 目录速查

```
apps/*              各前端应用（Next.js）
services/api/       后端唯一真相源（NestJS）★
packages/
  shared-auth/      cookie SSO 工具（getToken/setToken/nx_token）★
  ui/ tokens/ visual-system/  设计系统
  domain/hvac-kernels/        HVAC 计算内核
  contracts/ generated-client/ API 契约与生成客户端
database/postgres/migrations/ 数据库迁移 ★
server/             ⚠️ 旧 Express（冻结）
src/                ⚠️ 旧 Vite SPA（冻结）
docs/               架构与迁移文档
```
