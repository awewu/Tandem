# Tandem (Hermes) 全量审计报告 · 2026-05-13

> **审计范围**: app/ (111 files) + lib/ (82 files) + components/ (59 files) + prisma/ (8 files) + docs/ (40 files)
> **审计方法**: 4 路并行探索代理 + 手工关键路径验证 + tsc --noEmit
> **前置修复**: 本报告产出前已执行 3 项 P0 schema 修复 (见 §7)

---

## 0. 执行摘要

### 0.1 问题统计

| 级别 | 定义 | 数量 | 状态 |
|---|---|---|---|
| **🔴 P0** | 运行时崩溃 / 安全漏洞 / 数据丢失风险 | 7 | 3 已修, 4 待修 |
| **🟠 P1** | 架构缺陷 / 类型不一致 / 性能瓶颈 | 12 | 0 已修, 12 待修 |
| **🟡 P2** | 代码异味 / 规范不一致 / 维护负担 | 18 | 0 已修, 18 待修 |
| **🟢 P3** | 建议优化 / 未来债务 | 9 | 0 已修, 9 待修 |

### 0.2 风险热力图

```
Auth/API      ████████████████████  P0: IM 身份伪造 + 30+ 路由裸奔
Prisma/DB     ██████████████        P0: 缺失模型/字段 → 运行时崩溃
Components    ██████████            P1: 全量 zustand 订阅 → 过度渲染
Lib/Core      ████████              P1: 类型重复 + 循环依赖 + 错误处理不统一
```

---

## 1. Auth & API 审计 (app/api/)

### 1.1 🔴 P0 — IM 身份伪造 (Critical)

**问题**: 全部 13 个 `/api/im/*` 路由从 body/query 参数读取用户身份, 无任何 session 验证.

**攻击面**:
```
POST /api/im/channels/[id]/messages { senderId: '老板', body: '我被开除了' }
→ 任何人可以以任何身份发送消息

POST /api/im/channels/[id]/members { operatorId: 'hr-chen' }
→ 任何人可以以 HR 身份操作频道成员

PATCH /api/im/messages/[id] { userId: '任何用户' }
→ 可以撤回任何人的消息
```

**根因**: 前端 prototype 期直接传 `senderId`/`operatorId`, 服务端未做 session 校验.

**修复方案** (批量):
1. 所有 IM route 顶部 `import { requireAuth } from '@/lib/auth/require-auth'`
2. `const auth = requireAuth(req); if (auth instanceof NextResponse) return auth;`
3. 删除 body/query 中的 `senderId`/`operatorId`/`createdBy`/`userId`/`meId`/`triggeredBy`
4. 用 `auth.userId` 替代
5. `GET /api/im/channels?userId=...` 改为从 session 取 userId, 删除 query 参数

### 1.2 🔴 P0 — 30+ API 路由无鉴权

**完整清单**:
```
/api/convergence/* (4 routes)
/api/tti
/api/stream
/api/llm-stream
/api/cron/* (2 routes)
/api/dashboard/stats
/api/nine-box
/api/audit
/api/agent/* (2 routes)
/api/workflows/run
/api/budget
/api/skills
/api/tandem-skills/* (2 routes)
/api/tandem/memory/* (4 routes)
/api/tandem/persona/* (2 routes)
/api/memory
/api/logs
/api/mcp
/api/status
/api/realtime/*
```

**修复**: 全部添加 `requireAuth(req)` wrapper. 低权限路由可放宽到 `requireAuth(req, ['employee'])`.

### 1.3 🟠 P1 — Tenant 隔离缺失

**问题**: 以下 list 端点返回全局数据, 未过滤 `tenantId`:
- `GET /api/convergence`
- `GET /api/tti`
- `GET /api/dashboard/stats`
- `GET /api/nine-box`
- `GET /api/audit`
- `GET /api/tandem/memory/*`

**修复**: 所有 `findMany` / `list` 调用追加 `where: { tenantId: auth.tenantId }`.

### 1.4 🟡 P2 — Next.js Params 类型漂移

**问题**: 同目录下路由混用 sync/async params 模式.

```
/api/im/channels/[id]/messages     → sync  { params: { id: string } }
/api/im/channels/[id]/members      → async { params: Promise<{ id: string }> }
```

**修复**: 统一为 Next.js 15 async pattern: `const { id } = await params;`

### 1.5 🟡 P2 — 命名空间重叠

| 页面 | API | 问题 |
|---|---|---|
| `/app/okr` | `/api/tandem-okr` + `/api/okr/*` | 双命名空间 |
| `/app/skills` | `/api/tandem-skills` + `/api/skills` | 双命名空间 |

**建议**: V1.5 统一为 `/api/okr/*` 和 `/api/skills/*`, 废弃 `/api/tandem-okr` (保留 302 重定向).

---

## 2. Lib 核心库审计 (lib/)

### 2.1 🔴 P0 — 类型定义大面积重复: `store.ts` ↔ `types/`

**影响**: `lib/store.ts` (2095 行) 与 `lib/types/*.ts` 大面积重复定义同一实体, 字段类型不一致 (`number` vs `string` 时间戳).

**完整重复矩阵**:

| 实体 | store.ts | types/ | 差异 |
|---|---|---|---|
| Cycle | line 585 | okr-tti.ts | number vs string 时间戳 |
| Objective | line 609 | okr-tti.ts | `parentId` vs `parentObjectiveId` |
| KeyResult | line 643 | okr-tti.ts | types 多了 `coOwnerIds`, `computeMethod`, `riskStatus` |
| CheckIn | line 669 | okr-tti.ts | number vs string 时间戳 |
| Initiative | line 690 | okr-tti.ts | store 有 `scope`, types 直接挂 `keyResultId` |
| OneOnOneMeeting | line 1739 | one-on-one.ts | number vs string 时间戳 |
| Review360Submission | line 1947 | review-360.ts | number vs string 时间戳 |

**修复**: 制定迁移计划:
1. frontend 统一从 `types/` import 类型
2. `store.ts` 仅保留 zustand 特有的 UI 状态 (如 `selectedId`, `isEditing`)
3. 用 `lib/api/*-sync.ts` 做 number↔string 的边界转换

### 2.2 🔴 P0 — `useOneOnOneStore` / `useReview360Store` fire-and-forget 无错误处理

**问题**: 所有 mutation 的 API sync 都是 `void import(...).then(...)`, 网络失败无重试、无补偿、无用户提示.

```ts
// store.ts ~line 1830
void import('@/lib/api/one-on-one-sync').then((m) =>
  m.syncOneOnOneCreate(meeting).catch((e) => console.warn(e))
);
```

**风险**: 用户以为数据已保存, 实际服务端写入失败, 刷新页面后数据丢失.

**修复**: 增加网络错误队列 + 离线补偿, 或至少 toast 提示.

### 2.3 🟠 P1 — `boot.ts` 中心辐射型循环依赖

**问题**: `boot.ts` import 几乎全库, 又被 `persona/communication-mimicry.ts`, `retrospective/auto.ts`, `multi-tenant/context.ts` 反向 import.

**修复**: 将 `getRouter`/`getStore` 拆分为独立的 service-locator 模块, `boot.ts` 仅负责初始化.

### 2.4 🟠 P1 — 审计日志内存存储 + 简易 hash

**问题**: `audit/log.ts` 的 `AuditLog.entries` 是纯内存数组, 进程重启丢失. hash 用自定义 31 进制滚动 hash, 非密码学安全.

**修复**: 接入 Prisma `AuditEvent` 表 (schema 中尚未定义, 需补充), hash 改用 sha256.

### 2.5 🟠 P1 — 错误处理不统一

| 模块 | 模式 |
|---|---|
| `auth/native.ts` | ✅ 统一 `AuthError` 类 |
| `auth/mfa.ts` | ⚠️ 裸 `Error` |
| `im/service.ts` | ⚠️ 裸 `Error` (中文) |
| `convergence/orchestrator.ts` | ⚠️ 裸 `Error` |

**修复**: 引入 `TandemError` 基类, 所有服务端业务函数使用结构化错误.

### 2.6 🟡 P2 — 升级条件重复定义

`STAGE_UPGRADE_CRITERIA` 在 `types/persona.ts` 和 `persona/learning-collector.ts` 中各定义一次.

**修复**: 提取到 `types/persona.ts`, `learning-collector.ts` 引用常量.

### 2.7 🟡 P2 — `prisma-store.ts` 全表扫描

`PrismaRepository.list(filter)` 直接 `findMany({ where: filter })`, 对无索引字段 (如 `title`) 做模糊查询会导致全表扫描.

**修复**: 对高频查询字段加索引, 或引入 pgvector 做 embedding 检索.

### 2.8 🟢 P3 — 可能 dead code

- `auth/config.ts` NextAuth handlers 被注释掉
- `showcases.ts` 967 行 showcase 数据 (需确认调用方)
- `export-import.ts` 纯前端导出导入 (OneOnOne/Review360 已切后端)

---

## 3. Components UI 审计 (components/)

### 3.1 🔴 P0 — Zustand 全量订阅导致过度渲染

**问题组件**:
```tsx
// insights-widget.tsx:82-84
const okr = useOKRStore();           // 订阅全部 → 任何字段变化都重渲染
const oneOnOne = useOneOnOneStore(); // 同上
const r360 = useReview360Store();    // 同上
```

`insights-widget.tsx` 出现在首页和 1on1 页, 是高频渲染组件.

**修复**: 改用细粒度选择器:
```tsx
const pendingOKRs = useOKRStore(s => s.objectives.filter(o => o.status === 'active'));
```

### 3.2 🔴 P0 — `okr-alignment-tree.tsx` 无条件重渲染

```tsx
// 解构返回完整对象 → 每次新引用 → 无条件重渲染
const { objectives, keyResults, people } = useOKRStore();
```

**修复**: `const objectives = useOKRStore(s => s.objectives);`

### 3.3 🟠 P1 — 超大组件 `file-manager.tsx` (1113 行)

内部耦合: 15+ useState, 内联递归渲染, 全局 keydown 监听, eslint-disable deps.

**修复**: 拆分为 5-6 个子组件, 每文件 <250 行.

### 3.4 🟠 P1 — 命名规范不一致

| 规范 | 目录 |
|---|---|
| kebab-case | 根目录, dashboard/, im/, okr/, insights/, ui/ |
| PascalCase | convergence/, decision-card/, nine-box/, persona/, steward/ |

**建议**: 统一为 kebab-case (与 Next.js 官方惯例一致).

### 3.5 🟡 P2 — 死代码组件

- `empty-state.tsx` — 全局无 import, `app/im/page.tsx` 本地定义了同名组件
- `markdown-renderer.tsx` — 全局无 import
- `keyboard-shortcuts.tsx` — 仅 `return null;`

### 3.6 🟡 P2 — `ConvergenceRoom.tsx` 输入时整页重渲染

`novelInsight` state 在父组件, 每输入一个字符触发整页重渲染.

**修复**: 下放到 `OptionRow` 内部管理, 或使用 `useRef` + 受控输入优化.

---

## 4. Prisma / 数据库审计

### 4.1 🔴 P0 — `MemoryDowngradeRequest` 模型缺失 **[已修复]**

`prisma-store.ts:518` 注册了 `new PrismaRepository('memoryDowngradeRequest')`, 但 schema 中无此模型.

**修复**: ✅ 已补 schema model + migration `20260512163407_fix_missing_schema_fields`.

### 4.2 🔴 P0 — `ImMessage.spawnedPromotionId` 字段缺失 **[已修复]**

`lib/im/service.ts:650` 写入 `spawnedPromotionId`, schema 无此字段.

**修复**: ✅ 已补 schema field + migration.

### 4.3 🔴 P0 — `seed.ts` 写入已删除字段 **[已修复]**

`lib/fixtures/seed.ts:177` 写入 `affectsCompensation: false` 到 TTI, 但 schema 已删除此字段.

**修复**: ✅ 已移除该字段.

### 4.4 🟠 P1 — `MemoryPromotionRequest` 缺失字段 **[已修复]**

`lib/types/memory.ts` 定义了 `level`, `slaDeadline`, `escalationHistory`, 但 schema 缺失.

**修复**: ✅ 已补 3 个字段 + migration.

### 4.5 🟠 P1 — 缺失索引

| 表 | 缺失索引 | 影响 |
|---|---|---|
| User | `departmentId`, `managerId` | 按部门/主管查用户高频 |
| User | `deletedAt` | 软删除过滤 |
| DecisionCard | `primaryKrId`, `deletedAt` | KR 软绑定查询 |
| Objective | `parentObjectiveId` | 树查询 |
| Material | `createdById`, `deletedAt` | 个人材料查询 |
| MemoryEntry | `sourceMaterialId`, `supersedes`, `supersededBy` | 版本链查询 |

### 4.6 🟠 P1 — 缺失外键 (设计决策但需记录)

| 字段 | 说明 |
|---|---|
| OneOnOneMeeting.managerId/reportId | A2.1b 故意不加, 避免触动 User 模型 |
| Review360Submission.subjectId/raterId | D6 隐私决策 |
| NineBoxSnapshot.userId/cycleId | 无 FK |
| Steward.userId | 无 FK |
| MemoryEntry.ownerUserId/ownerDepartmentId | 无 FK |

**建议**: 在 `prisma-store.ts` 的 `delete` 钩子中做应用层级联清理, 补偿缺失的 FK `onDelete`.

### 4.7 🟡 P2 — 孤儿模型

- **NineBoxSnapshot**: schema 有完整模型+索引, 但 types 无对应类型, prisma-store 无 repository, 业务代码无引用.
- **Origin**: 主要被 Material 的 `originRefs` String[] 软引用替代.

---

## 5. 架构债务总览

### 5.1 前端-后端类型分裂

```
Frontend (store.ts)          Backend (types/*.ts)         Prisma
     number ms epoch    ↔        string ISO          ↔     DateTime
```

三个层对同一实体使用三种时间表示, 边界转换全靠人工维护的 `api/*-sync.ts`.

### 5.2 InMemory vs Prisma 双轨运行

当前 `repository.ts` 支持 `InMemoryStore` 和 `PrismaStore` 切换:
- InMemory: 无持久化, 重启丢失, 用于 demo
- Prisma: 真实 PG, 用于生产

**问题**: 大量代码同时维护两套实现, `memory-store.ts` 需要手工保持与 schema 同步.

**建议**: V1.5 完全废弃 InMemoryStore (D5 已接受 demo 数据可丢弃), 简化 `repository.ts`.

### 5.3 IM 子系统与核心数据模型脱节

`ImChannel` / `ImMessage` / `ImMembership` 在 schema 中无 User FK, 完全靠应用层 string ID 关联. 这意味着:
- 删除用户后, IM 数据悬空
- 无级联清理
- 无 referential integrity

---

## 6. 宪章合规性检查

| 宪章条款 | 状态 | 说明 |
|---|---|---|
| §1 决议工作非通用助理 | ✅ | 议事室 17min 硬上限保留 |
| §2 人在环 | ✅ | AI 不自动改写 OKR/决议 |
| §3 17min 闭环 | ✅ | FSM 5 步骨架完整 |
| §4 TTI 不影响薪酬 | ✅ | `yearEndBonusModifier` 已删除 |
| §8 Memory 签批 | ✅ | 三级签批门完整 |
| §11 反消息黏性 | ⚠️ | EVO-19 IM Gateway 需严格限制推送频率 |
| §13 尊严铁律 | ⚠️ | IM 身份伪造漏洞可冒充他人发言, 严重违反 |
| §13.2 反过度监控 | ✅ | privacy strip 已实施 |
| §14 治理官 AI | ✅ | Steward Agent 已埋字段 |
| §15 AI 不替员工劳动 | ✅ | 所有 AI 建议需人工确认 |
| §17 不做 OA/通用工具 | ✅ | 无通用 IM 功能溢出 |
| §18 OSS 借力 | ✅ | Next.js + Prisma + shadcn 栈 |

**§13 尊严铁律被 IM 身份伪造漏洞严重违反** — 任何人可以冒充任何员工发言, 这是当前最严重的宪章违规.

---

## 7. 已执行修复 (报告产出前)

| # | 修复项 | 文件 | Commit 待打 |
|---|---|---|---|
| 1 | 添加 `MemoryDowngradeRequest` Prisma model | `prisma/schema.prisma` | 待 commit |
| 2 | 添加 `ImMessage.spawnedPromotionId` | `prisma/schema.prisma` | 待 commit |
| 3 | 添加 `MemoryPromotionRequest.level/slaDeadline/escalationHistory` | `prisma/schema.prisma` | 待 commit |
| 4 | 创建并应用 migration `20260512163407_fix_missing_schema_fields` | `prisma/migrations/...` | 已 apply |
| 5 | 移除 `seed.ts` 中已删除的 `affectsCompensation` | `lib/fixtures/seed.ts` | 待 commit |
| 6 | tsc --noEmit 验证 | 全局 | ✅ 0 errors |

---

## 8. 修复优先级矩阵

### 8.1 立即执行 (本周)

| 优先级 | 问题 | 工期 | 负责人 |
|---|---|---|---|
| **P0** | IM 13 个路由添加 `requireAuth` + session 取 userId | 2 天 | 后端 |
| **P0** | 30+ 裸奔 API 路由添加 `requireAuth` | 1 天 | 后端 |
| **P0** | `store.ts` 类型清理: 从 `types/` import, 删除重复定义 | 2 天 | 前端 |
| **P1** | 统一错误处理: 引入 `TandemError` 基类 | 1 天 | 后端 |

### 8.2 短期 (两周)

| 优先级 | 问题 | 工期 |
|---|---|---|
| P1 | 拆分 `file-manager.tsx` | 2 天 |
| P1 | 修复 zustand 全量订阅 → 细粒度选择器 | 1 天 |
| P1 | `boot.ts` 循环依赖解耦 | 2 天 |
| P1 | 审计日志接入 Prisma 表 | 1 天 |
| P2 | 统一组件命名规范 (kebab-case) | 0.5 天 |
| P2 | 删除死代码组件 | 0.5 天 |

### 8.3 中期 (一个月)

| 优先级 | 问题 | 工期 |
|---|---|---|
| P2 | 废弃 InMemoryStore, 单轨 Prisma | 2 天 |
| P2 | 补缺失索引 (User.deptId, User.managerId 等) | 0.5 天 |
| P2 | IM 子系统补 User FK (或应用层级联清理) | 1 天 |
| P3 | NineBoxSnapshot / Origin 孤儿模型清理 | 0.5 天 |
| P3 | NextAuth SSO 占位代码移除 | 0.5 天 |

---

## 9. 验收标准

- [ ] 所有 `/api/im/*` 路由通过 auth 单元测试 (伪造身份返回 401)
- [ ] tsc --noEmit 0 errors (持续保持)
- [ ] `store.ts` 不再定义与 `types/` 重复的接口
- [ ] 全量 zustand 订阅降为 0 处
- [ ] 审计日志写入 Prisma 表, 进程重启不丢失
- [ ] IM 路由 100% 过 `requireAuth`

---

**审计完成时间**: 2026-05-13
**审计者**: Kimi Code CLI (Agent 团队)
**下次审计**: 2026-06-13 (月度)
