# 账号体系安全审计

日期：2026-06-29 · 范围：双轨认证（Legacy Express / Mongoose `UserV2` + Target NestJS / TypeORM `UserEntity`）
状态：**S1 已修复 · S2 部分修复（代码侧已收口，密钥轮换+历史清理待执行）· H2 部分修复（租户范围校验已加，全局守卫+RBAC 待办）· H1/中低危仍待办**

---

## 🔁 复审（2026-07-10 · 权限与账户体系专项排查）

> 结论先行：**账户/权限的架构本身已达标（H2 实质完成）；反复出问题的真正根因不在代码，而在「治理 guard 从未进 CI/hook」——漂移能悄悄合并、只能靠人工偶发发现。已把治理 guard 接入 CI 门禁。**

**代码侧现状复核（对照下方旧待办，均已落地）**
- ✅ **全局 `APP_GUARD` deny-by-default**：`services/api/src/modules/app.module.ts` 依次挂 `AuthGuard → RolesGuard → EntitlementGuard`；控制器不再可能「漏挂守卫即裸奔」。
- ✅ **`@Public()` 白名单**：`services/api/src/modules/common/public.decorator.ts`（默认拒绝，显式放行）。
- ✅ **RBAC 强制**：`services/api/src/modules/common/roles.guard.ts` 读 `req.user.role` 执行 `@Roles`。
- ✅ **租户范围校验**：`AuthGuard` `isValidScope()` 已在验签后强制。
- ✅ **商业化授权**：`EntitlementGuard` + `@RequireModule` 校验租户模块订阅。
- ✅ **H1 短信 `000000` 后门已移除（两栈均确认）**：NestJS `otp.service.ts`（真实一次性 OTP + 5 次锁死，`otp-challenge.entity.ts` 持久化）取代 legacy 内存 Map + 后门；legacy `server/modules/auth/auth.service.js:191` 明确「removed non-production '000000' backdoor」。
- ⚠️ **仅剩运维动作**：S2 生产密钥轮换 + `git filter-repo` 历史清理，代码无法代劳（详见下方 S2）。

**根因（为什么「反复出问题」）**
- 仓库有约 50 个 guard，但 `guard:all` 与治理类 guard（`guard:permission-domain` / `guard:nexus-naming` / `guard:charter-maturity`）**既不在 CI（`.github/workflows/quality-gates.yml` 仅跑手挑子集），也不在 git hook（`pre-push` 跑 `hammer.js`，零 guard）**。
- 后果：新模块入 `module-boundary.ts` 却漏在 `permission-domains.json` 登记权限域 → 漂移合并、CI 全绿、直到有人手动 `guard:permission-domain` 才暴露。本质是**校验存在但不强制**。

**本次修复（防复发护栏）**
- ✅ 在 CI L0（architecture-governance）新增步骤 **Permission / account / naming / charter governance (anti-drift)**，强制 `guard:permission-domain` + `guard:nexus-naming` + `guard:charter-maturity`（纯静态、无需 DB/在制品）。此后权限域/命名/宪章漂移**在 PR 即红灯**，无法静默合并。
- ✅ 顺带修复当期漂移：`entitlement`/`ai-design`/`aftersales` 三模块归位权限域（D0/D4），`guard:permission-domain` failures=0。

**仍建议（未在本次执行）**
1. 把更多静态治理 guard（乃至 `guard:all:nonvisual`）分层纳入 CI，逐步收口。
2. H1 短信后门移除**专项确认** + S2 生产密钥轮换/`git filter-repo` 历史清理（运维）。
3. 考虑设立常驻「身份与权限」专职 agent 角色（`.claude/agents/`），对 auth/RBAC/RLS/域映射变更做强制评审。

---

## ✅ 修复记录（2026-06-29）

### S1 — 已修复
- `services/api/src/modules/auth/auth.module.ts`：新增 `resolveJwtSecret()`，生产缺 `JWT_SECRET` 直接 throw，删除静默公开兜底；与 Express 侧策略对齐。boot-smoke 视为非生产。
- 同步统一 Legacy 开发兜底串为 `rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION`（`authenticateV2.js`、`server/modules/auth/auth.service.js`），避免跨服务 dev token 验签错位。

### S2 — 代码侧已修复，运维侧待办
- ✅ `.gitignore` 补 `.env.production` / `.env.nestjs` / `**/.env.production` / `production-config/.env.production`。
- ✅ `git rm --cached` 移除 3 个真实密钥文件（本地副本保留）。
- ⏳ **仍必须执行（运维）**：
  1. **轮换全部已泄露密钥** —— `JWT_SECRET`、`PII_ENCRYPTION_KEY`、`PHONE_HASH_SECRET`、`POSTGRES_PASSWORD`、`rheem-production-secret-key-2024` 等仍存在于 **git 历史**，等同已泄露，须立即在生产重置。
  2. `git filter-repo`（或 BFG）清理历史中的密钥文件。
  3. 改用密钥管理：Vault / SOPS / 部署平台 env，不再落盘明文。

### H2 — 租户范围校验已修，全局守卫+RBAC 待办
- ✅ `services/api/src/modules/auth/auth.guard.ts`：新增并导出 `isValidScope()`，验签后强制校验 `userId`/`tenantId` 必须为合法 id（UUID/ObjectId/保守 slug，兼容 varchar seed），可选 `dealerId`/`storeId`/`customerId` 存在时也须合法；不合法返回 `403 访问令牌租户范围无效`。对齐 Express `authenticateV2.js` 的 `isValidScope`。tsc 校验通过。
- ⏳ **仍待办**：全局 `APP_GUARD`（避免控制器漏挂 `@UseGuards` 即裸奔）+ `@Public()` 白名单 + `@Roles()`/权限守卫强制执行 JWT 内的 `role`/`permissions`。


整体骨架合理：bcrypt 哈希、账号失败锁定、`register` 关闭、登录防枚举提示。
但存在 2 严重 + 2 高危，核心是**双轨安全策略漂移**（Target 主干弱于 Legacy）。

---

## 🔴 严重

### S1 · NestJS 在所有环境硬编码 JWT 兜底密钥
- 位置：`services/api/src/modules/auth/auth.module.ts:14`
  ```ts
  secret: process.env.JWT_SECRET || 'rhautt-comfort-dev-secret',
  ```
- Express 侧生产缺密钥会 throw/exit（`server/middleware/authenticateV2.js:13`、`server/modules/authRuntime.js:5`、`server/modules/auth/auth.service.js:9`）；**Target NestJS 静默回退公开硬编码密钥**。
- 影响：任意人用该串伪造任意用户/角色（含 `platform_admin`）令牌 → 完全账号接管 + 跨租户越权。
- 修复：缺 `JWT_SECRET` 即启动失败，删除兜底；用 `JwtModule.registerAsync` + 启动校验。

### S2 · 生产密钥提交进 Git
- `git ls-files` 跟踪：`.env.production`、`.env.nestjs`、`production-config/.env.production`。
- `.gitignore` 仅挡 `.env` / `*.local`，**漏了上述文件**。
- 弱密钥：`production-config/.env.production:4` → `JWT_SECRET=rheem-production-secret-key-2024`。
- 同时入库：`PII_ENCRYPTION_KEY`、`PHONE_HASH_SECRET`、`POSTGRES_PASSWORD`、`MONGODB_URI`（6 个真实密钥）。
- 修复：①轮换全部已泄露密钥 ②`git rm --cached` 移除 + 补 `.gitignore` ③`git filter-repo` 清历史 ④改用密钥管理（Vault/SOPS/部署平台 env）。

---

## 🟠 高危

### H1 · 短信登录后门
- 位置：`server/modules/auth/auth.service.js:190-193`，`smsCode === '000000'` 非生产免密登入任意账号；`loginWithSms` 不查 `isLocked`、不计锁定。
- 仅 `NODE_ENV` 兜底，误配即敞开。
- 修复：接真实 OTP provider，移除 `000000`；SMS 路径同样走锁定逻辑。

### H2 · NestJS 无全局守卫 / 无 RBAC / 不校验租户范围
- 全 `services/api` 仅 `auth.guard.ts` 一个守卫，**无 `APP_GUARD`**，控制器漏挂 `@UseGuards` 即裸奔。
- `AuthGuard`（`auth.guard.ts:13-18`）只验签，不校验租户范围（Express 有 `isValidScope`）。
- JWT 带 `role`/`permissions[]` 但 Target 栈无 roles/permissions 守卫强制执行。
- 修复：全局 `APP_GUARD` + 租户范围校验 + `@Roles`/权限守卫 + `@Public()` 白名单装饰器。

---

## 🟡 中危
- **无令牌吊销**：`logout()` 返回 `revoked:false`；改密不失效旧 JWT（无 `jti`/tokenVersion）；`refresh-token` 无限续签、无绝对会话上限。→ 加 tokenVersion，改密/登出递增。
- **bcrypt 轮数=10**（`auth.service.ts:45`、`auth.service.js:161`）→ 提升至 12。
- **双栈漂移**：Express/NestJS 逻辑重复、策略不一致 → 收敛到单一真相源。

## ⚪ 低 / 提示
- 登录计时旁路（仅当用户存在才跑 bcrypt）→ 账号枚举；可对不存在用户跑一次 dummy bcrypt。
- 前端令牌存 `localStorage` → XSS 窃取风险；考虑 httpOnly cookie。
- 锁定计数仅成功登录后重置。

---

## 建议执行顺序
1. S1（单行级，立即降险）+ S2 `.gitignore` 收口
2. S2 密钥轮换 + 历史清理（filter-repo）
3. H2 NestJS 全局守卫 + 租户/RBAC
4. H1 短信后门移除
5. 中危：令牌版本化、bcrypt→12、双栈收敛
