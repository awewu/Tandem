# 瑞诺瓦平台 · 账号管理体系

> 覆盖：账号模型、角色体系、登录方式、准入策略、鉴权授权、单点登录、种子账号。
> 代码来源：`services/api/src/modules/auth/*`、`common/roles.guard.ts`、`scripts/db/seed-nestjs-auth.js`。

---

## 一、账号模型（`auth.entity.ts` · `users` 表）

| 维度 | 字段 | 说明 |
|---|---|---|
| 身份 | `id` / `displayName` / `role` / `permissions[]` | 角色 + 细粒度权限（jsonb，支持 `'*'` 通配） |
| 组织归属 | `tenantId` / `dealerId` / `storeId` / `customerId` | 多租户 + 经销商 + 门店 + 客户 四级隔离 |
| 凭证 | `passwordHash`（bcrypt，`select:false`） | 查询默认不返回密码 |
| PIPL 合规 | `phoneHash` / `phoneEncrypted` | 手机号**不落明文**：SHA-256 加盐哈希用于登录命中/去重；AES-256-GCM 密文用于可逆脱敏展示 |
| 状态 | `status` = `active` / `inactive` / `suspended` | 启用 / 停用 / 封禁 |
| 风控 | `loginAttempts` / `lockUntil` / `isLocked` | 连续失败锁定 |
| 审计 | `lastLoginAt` / `createdAt` / `updatedAt` | 登录与变更追踪 |

---

## 二、角色体系（10 种 `UserRole`）

| 层级 | 角色 | 归属分组 |
|---|---|---|
| 品牌 / 平台 | `platform_admin` 平台超管 · `hq_admin` 总部 · `regional_manager` 区域经理 | BRAND_STAFF |
| 经销商侧 | `dealer_admin` · `store_manager` · `sales` · `designer` · `engineer` · `installer` | 经销商员工 |
| 客户侧 | `customer` 终端客户 | CUSTOMER |

---

## 三、登录方式（`auth.controller.ts`）

| 端点 | 用途 | 适用 |
|---|---|---|
| `POST /auth/login` | 手机号/邮箱 + 密码 | 员工 |
| `POST /auth/send-sms` → `/auth/login-sms` | 短信验证码 | 客户 |
| `POST /auth/register` | 自助注册（默认落 `dealer_admin`） | 经销商 |
| `GET /auth/me` · `GET/PUT /auth/user` | 当前身份 / 资料读改 | 全部 |
| `PUT /auth/password` | 改密 | 全部 |
| `POST /auth/refresh-token` · `POST /auth/logout` | 续期 / 登出 | 全部 |

---

## 四、账号准入策略（`identity-policy.ts`，强约束）

- **客户**（customer）→ 仅手机号注册（不发密码账号）。
- **品牌员工**（platform_admin / hq_admin / regional_manager）→ 必须企业邮箱，域名须为 `rhautt.com` / `rhautt.local`（`BRAND_STAFF_EMAIL_DOMAINS` 可覆盖）。
- **经销商侧** → 手机号或非企业邮箱皆可，但禁止冒用企业域名邮箱。
- 自助注册默认角色 = `dealer_admin`（`SELF_REGISTER_ROLE`）。

> 注：`scripts/db/seed-nestjs-auth.js` 直连 DB 播种，绕过 controller 的 `assertIdentifierForRole`；
> 但仍按上述策略约定标识类型（品牌员工用邮箱、其余用手机号），以贴近真实注册路径。

---

## 五、鉴权与授权（RBAC + 订阅门禁）

- **认证**：JWT 存于同源 `nx_token` cookie（localhost 跨端口共享）。payload 携带
  `userId / tenantId / dealerId / storeId / customerId / role / permissions / modules`。
- **RolesGuard**：标 `@Roles(...)` 的端点校验 `role`；未标注端点 = 仅需登录（向后兼容）。
- **权限**：`permissions[]`，含 `'*'` 通配（platform_admin 全通）。
- **EntitlementGuard**：按模块订阅（`modules` / `tenant_module_subscriptions`）门禁——
  新租户 `permissions=[]` 且无订阅 → 付费模块被拦截。
- **Hub 可见性**：`:4000/hub` 按 `role` 过滤模块卡片，`'*'` 对所有人可见。

---

## 六、单点登录（SSO）

- **唯一登录口 `:4000`**（dealer-workbench）。登录写 `nx_token`，各员工端免登流转。
- 子端守卫：designer / bim（读 `nx_token` + `/auth/me` 校验）；brand-console 入口检查 `nx_token`，
  但本地开发的数据面仍使用独立 `bc_session`；
  nexus-console（`/api/session` + 共享 cookie 兜底）。
- 详见 `docs/APP-COLLABORATION-MAP.md` §二 / §五。

---

## 七、种子账号（`scripts/db/seed-nestjs-auth.js`，DEFAULT 租户，已开通全部可售模块）

| 账号 | 密码 | 角色 | 登录方式 |
|---|---|---|---|
| `admin@rhautt.local` | `Test1234!` | platform_admin | 邮箱 + 密码 |
| `13900000000` | `Super@2026` | platform_admin | 手机 + 密码 |
| `hq@rhautt.local` | `Hq@2026` | hq_admin | 邮箱 + 密码 |
| `region@rhautt.local` | `Region@2026` | regional_manager | 邮箱 + 密码 |
| `13900000001` | `Dealer@2026` | dealer_admin | 手机 + 密码 |
| `13900000005` | `Store@2026` | store_manager | 手机 + 密码 |
| `13900000002` | `Design@2026` | designer | 手机 + 密码 |
| `13900000003` | `Sales@2026` | sales | 手机 + 密码 |
| `13900000004` | `Support@2026` | engineer | 手机 + 密码 |
| `13900000006` | `Install@2026` | installer | 手机 + 密码 |
| `13900000009` | `Customer@2026` | customer | 正式走短信；密码仅本地测试 |

> 全部 10 种角色现均有可登录种子账号，可端到端验证 Hub 按角色路由。
> DEFAULT 租户同时幂等创建 `DEFAULT-DEALER` / `DEFAULT-STORE`：`dealer_admin` 绑定 dealer；
> `store_manager / designer / sales / engineer / installer` 绑定 dealer + store，供真实 RLS/RBAC 链路验收。

### 页面测试凭据速查

| 页面 | 本地地址 | 测试账号 | 测试密码 | 说明 |
|---|---|---|---|---|
| 统一登录 / Hub / 经销商工作台 | `http://localhost:4000` | 使用上表任一 PostgreSQL 种子账号 | 对应上表密码 | 按角色显示功能；`platform_admin` 可查看全部模块 |
| 设计师工作台 | `http://localhost:4003` | `13900000002` | `Design@2026` | 先在 `:4000` 登录，通过 `nx_token` 进入 |
| BIM 技术支持 | `http://localhost:4004` | `13900000004` | `Support@2026` | 也可使用设计师账号；先在 `:4000` 登录 |
| Nexus 管理中枢 | `http://localhost:4010` | `admin@rhautt.local` | `Test1234!` | 平台管理员账号 |
| 客户门户 | `http://localhost:4002` | `13900000009` | `Customer@2026` | 密码仅供本地测试；生产使用短信登录 |
| 品牌运营控制台 | `http://localhost:4012` | `admin` | `everhot2026` | 独立 dev 会话 `bc_session`；不能使用 `hq@rhautt.local / Hq@2026` 登录该表单 |

公开页面 `:4001`、`:4005`、`:4011`、`:4013`、`:4014`、`:4015`、`:4016` 无需账号密码。

> 安全边界：本节仅记录本地开发测试凭据。生产环境必须覆盖默认密码，并禁用 brand-console 的 dev 登录模式。

---

## 八、迁移与运行边界

- 生产方向入口为 `/api/v2/auth/*`，owner 是 `services/api/src/modules/auth`；`:3000` 兼容服务只代理到 `:3300` NestJS API。
- legacy `/api/auth/login`、`/api/login` 已退役并返回 404，不再保留双写或第二套认证事实源。
- `database/users.json` 中的旧角色、明文/弱口令演示账号不迁入 PostgreSQL。需要保留的真实账号必须先确定新角色映射，并走强制密码重置和可审计导入。
- `scripts/migrate-pii-reencrypt.js` 面向 MongoDB `CustomerV2`，不用于 PostgreSQL auth 用户迁移。

---

## 九、已知缺口 / 后续建议

- **缺后台「账号管理」界面**：目前建号靠 seed 脚本 / 自助注册；缺管理员在 UI 内
  增删改角色、停用/封禁、重置密码、分配 dealer/store 的页面。
- **customer 端前端无守卫**：`customer-portal` dashboard 靠 API 401 兜底，可加 `AuthProvider`。
- **customer 密码为测试便利播种**：生产应仅短信登录，勿依赖密码。

_最后更新：2026-07-15，补充全部本地测试账号、页面映射与 4012 独立开发凭据。_
