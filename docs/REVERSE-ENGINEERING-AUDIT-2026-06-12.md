# Tandem · 反向工程问题审计（2026-06-12）

> 方法：从鉴权边界 → 路由数据流 → 存储层逐层 grep 实测，不靠记忆。
> 每条含：证据文件:行、影响、修复建议。严重度 P0(阻塞上线) / P1(上线后即修) / P2(技术债)。

---

## 复核更新 (2026-06-20)

> **状态: 全部 P0 + P1-A/P1-C 已修复并通过对抗性测试锁定。** 本次复核从鉴权边界逐层 grep 实测 (不靠本文记忆), 确认修复在 2026-06-12 审计后落地。原始发现保留在下文 (不静默删改), 每项附 ✅ 已修复证据。
>
> - **对抗性回归锁**: `tests/unit/tenant-isolation.test.ts` (写注入 + 读隔离, 4 tests 全绿) + `tests/unit/permission-hardening.test.ts` (P0-A skills / P0-B audit)。
> - **P2-A 已收敛 (2026-06-20)**: 统一 `withTenantScope` 收敛层落地, app/api 已基本无逐路由手写 `tenantId` 过滤 (仅 4 处显式保留: skill-evals 双租户读 / proxy-actions 403 治理语义 / kpi-close+org-users 不同仓储抽象, 均加注释)。顺带修复 2 处真实跨租户读泄露 (kpi/snapshots 无 cycleId 路径 · nine-box KR/Objective) 与 1 处跨租户写 (cycle-activate)。对抗回归锁见 `tests/unit/tenant-isolation.test.ts` (10 tests)。
> - **P1-B 部分下推**: drive/documents/calendar list 已下推到 repo (drizzle SQL `eq(tenantId)`); 其余 KvStore 路由经 `withTenantScope.list()` 走 store 层 string-filter 下推。
> - **宪章锚定**: 这些已上升为 `MANIFESTO.md` §23「200 人工程级架构是基本要求」不可妥协基线。

---

## P0 · 阻塞上线（安全/数据正确性）

### P0-A · 跨租户写入注入（Cross-Tenant Write Injection）
- **证据**：多个 create 接口用 `body.tenantId ?? auth.tenantId`，信任客户端请求体：
  - `@/Users/.../app/api/calendar/route.ts:39`
  - `@/Users/.../app/api/documents/route.ts:36`
  - `@/Users/.../app/api/drive/route.ts:30`
  - `@/Users/.../app/api/notifications/route.ts:30`
  - `@/Users/.../app/api/okr/initiatives/route.ts:64`
  - `@/Users/.../app/api/tandem-okr/route.ts:74`
  - `@/Users/.../app/api/approvals/route.ts:24`
  - `app/api/agent/spawn/route.ts:54`（更糟：`body.tenantId ?? 'default'`）
- **影响**：租户 A 的登录用户 POST 时携带 `tenantId: "B"`，即可把记录写入租户 B 的数据域，污染他人数据。
- **对照**：团队已在 `app/api/tandem-skills/execute/route.ts:13-15` 显式注释"绝不接受 body 注入"，但只修了这一处。
- **修复**：所有写接口 `tenantId` 一律取 `auth.tenantId`，删除 `body.tenantId ??` 兜底。可加 ESLint 规则禁止 `body.tenantId`。
- ✅ **已修复 (2026-06-20)**：全库已无 `body.tenantId` 注入 (仅剩 `tandem-skills/execute` 的解释性注释)。证据 `app/api/calendar/route.ts:39`、`app/api/approvals/route.ts:36`、`app/api/agent/spawn/route.ts:58` 均取 `auth.tenantId`。对抗测试 `tests/unit/tenant-isolation.test.ts`「P0-A」。

### P0-B · 读接口缺失租户隔离（Cross-Tenant Read Leak）
- **证据**：
  - `@/Users/.../app/api/tti/route.ts:15-18` — `store.ttis.list()` 仅按 cycleId/ownerId 过滤，**无 tenantId 过滤** → 返回所有租户 TTI。
  - `@/Users/.../app/api/okr/checkins/route.ts:30-32` — 仅按 scope/scopeId 过滤，无租户隔离。
- **影响**：跨租户读泄露绩效/复盘数据。
- **修复**：统一加 `.filter(x => (x.tenantId ?? 'default') === auth.tenantId)`。
- ✅ **已修复 (2026-06-20)**：`app/api/tti/route.ts:17`、`app/api/okr/checkins/route.ts:32` 已加租户读隔离。对抗测试 `tests/unit/tenant-isolation.test.ts`「P0-B /api/tti」。

### P0-C · MFA 强制门仅客户端生效（Privilege Escalation）
- **证据**：`@/Users/.../app/api/auth/login/route.ts:53-72` 即使 `mfaEnrollmentRequired=true` 仍照常 `res.cookies.set(COOKIE_ACCESS, ...)` 签发有效 token；`grep mfaVerified app/api` 显示**没有任何业务路由校验 `mfaVerified`**（仅 `auth/me`、`mfa/setup` 回显）。
- **影响**：特权账户（owner/admin/steward）忽略前端强跳，直接带 token 调 API，即可绕过 MFA 门——P0-4 的"强制"是装饰性的。
- **修复**：服务端在 `mfaEnrollmentRequired` 时**不签发完整 access token**（或签发受限 token）；敏感写接口加 `requireMfa(auth)` 守卫。
- ✅ **已修复 (2026-06-20)**：采用更优解 —— token 携带 `pendingMfaEnroll` 标记 (`lib/auth/native.ts:492`)，`middleware.ts:154` 服务端硬门：特权未启 MFA → 所有业务 API 返回 403 (UI 强跳 `/settings/security`)，非装饰性。

---

## P1 · 上线后即修

### P1-A · 审批功能纯内存、非持久化
- **证据**：`@/Users/.../app/api/approvals/route.ts:7-25` — `const approvals: Approval[] = [...]` 内存数组，`approvals.push()`。
- **影响**：① 重启即丢全部审批；② 多副本（APP_REPLICAS>1）各进程数据不一致；③ `...body` 展开可伪造 `requester`/`approver`/`id`。
- **修复**：迁到 `getStore()` 持久化仓储；create 时只白名单取字段，不展开 body。
- ✅ **已修复 (2026-06-20)**：`app/api/approvals/route.ts` 已用 `getStore().approvals` 持久化 + filter 下推 (`:14`) + 字段白名单 (`:29-37`，不展开 body)。对抗测试覆盖写注入 + 读隔离。

### P1-B · 全集合扫描（性能 / 内存）
- **证据**：大量路由 `await store.X.list()` 无 filter 后 JS 过滤：
  - `app/api/tandem-okr/route.ts:27,33,39,43`
  - `app/api/nine-box/route.ts:39,41,48,61` + `nine-box/suggestions/route.ts:148-158`
  - `app/api/kpi/route.ts:32`、`app/api/okr/checkins/route.ts:30`、`app/api/tti/route.ts:15`
- **影响**：200 人 + 多周期数据量下，每次请求把整集合拉进内存，p95 退化、GC 压力大。与 `LAUNCH-200.md` P1 "list() pushdown 仅部分接通"吻合。
- **修复**：把 `tenantId`/`cycleId` 等下推到 `list(filter)`（`DrizzleKvRepository.list` 已支持 string-filter 下推）。

### P1-C · 非生产环境 demo 全权限回退
- **证据**：`@/Users/.../lib/auth/require-auth.ts:40-43,53` — `isDemoAllowed()` 在 `NODE_ENV!=='production'` 且 `ALLOW_DEMO_AUTH!=='0'` 时，未登录请求回退为 `roles: DEMO_FULL_ROLES`（全权限 admin）。
- **影响**：任何**未精确设 `NODE_ENV=production`** 的部署（如 staging/预览/容器误配），未鉴权即获 admin。生产由 production-guard 兜底，但边缘部署风险高。
- **修复**：demo 回退改为**显式 opt-in**（仅 `ALLOW_DEMO_AUTH==='1'` 才开），不以 NODE_ENV 反推。
- ✅ **已修复 (2026-06-20)**：`lib/auth/require-auth.ts:40-45` `isDemoAllowed()` 改为显式 `ALLOW_DEMO_AUTH==='1'` opt-in (生产恒关)，`middleware.ts:70-75` 同步。

---

## P2 · 技术债 / 后续

### P2-A · 统一多租户上下文层零调用
- **证据**：`grep multi-tenant/context app/api` = 0 命中；各路由各自手写 `tenantId` 过滤，散落 87 文件、易漏（见 P0-B 已漏 2 处）。
- **修复**：收敛到一个 `withTenantScope(auth, repo)` 包装，杜绝逐路由手写。
- ✅ **已修复 (2026-06-20)**：`lib/multi-tenant/with-tenant-scope.ts` 落地 (Repository<T> 租户作用域包装, get/list/update/delete/create 全注入+校验, list 透传 filter 走 store 层下推)。约 40+ 路由收敛: OKR(tandem-okr/key-results/cycles/checkins/initiatives/tti)、approvals、convergence、learning、bitable、KPI 全模块(route/[id]/cycles/subjects/analytics/export/import/snapshots/bonus/manual-entry/seed-demo)、intranet/posts、360、1on1、drive/documents/calendar。跨租户记录一律视同不存在(404)。剩余 4 处显式手写均有注释说明 (双租户读 / 403 治理语义 / 非 TandemStore 仓储)。对抗回归锁 `tests/unit/tenant-isolation.test.ts` (10 tests) + `tests/unit/with-tenant-scope.test.ts` (8 tests)。

### P2-B · `...body` 展开式 create 散布
- 多处 `svc.create({ ...body, ... })`（documents/drive/notifications/calendar）允许客户端注入任意字段（如 `ownerId`、`createdBy`、状态字段）。建议字段白名单。

---

## 健康项（审计确认 OK，不动）
- 登录限流 + 锁定：`app/api/auth/login/route.ts` per-IP sliding window + scrypt + lockedUntil ✅
- 错误中间件不泄露堆栈：`lib/api/error-middleware.ts` 统一 500 文案 ✅
- `auth.tenantId` 来源是 JWT，不可伪造 ✅
- 密码哈希 scrypt + 历史防复用 + 强度校验 ✅

---

## 修复优先级建议
1. **先堵 P0-A / P0-B**（一次性 grep 替换 + 加 lint 规则，~半天）
2. **P0-C** 服务端 MFA 门（改 login 签发逻辑 + 敏感接口加守卫，~1 天）
3. P1-A 审批持久化、P1-C demo 回退收紧（各 ~半天）
4. P1-B 全表扫描下推（按热点路由逐个，~2 天）
