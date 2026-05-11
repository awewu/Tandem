# A 计划 · 假产品 → 真后端 (5 天)

> **Trigger**: A1 hook 完成后, 用户要求"推演全链路可工作运行".
> **Decision Date**: 2026-05-10 19:18 (UTC-07).
> **Status**: 推演完成, 决策落地, 进入 A2.1.

---

## 0. 拍板的决策

| 编号 | 决策 | 影响范围 |
|:-:|---|---|
| D1 | **drop `Person` 概念**, 业务实体 ownerId/authorId/managerId/raterId 全部使用 `User.id` (cuid). zustand `useOKRStore.people` 和 `useReview360Store` 里散落的 Person 全部砍掉. | 影响所有引用 'me' 的代码 + OKR/1on1/360/9-box 全模块 |
| D3 | **/okr 也上 API**, Prisma schema 与 zustand 语义对齐 (Objective.weight/status/confidence + KR measureType:binary + CheckIn 模型重建). | +2-3 天工作量, 必须做迁移 |
| D4 | A2 新建所有 API **必须加 `verifyAccessToken` 401 gate** (历史欠债 36/38 不允许扩散) | 影响 A2.2 所有 endpoint |
| D5 | **旧 zustand 持久化数据全部抛弃**. localStorage 数据失配后, 首屏 banner "演示数据已清空, 已切到真实后端" | 用户首次进新系统会看到空白, 接受 |
| D6 | 360 raterId 不建索引; API 按 `anonymizePeers` strip. 1on1 privateManagerNote API 按 requester strip | A2.2 endpoint 设计约束 |

## 1. 字段差异 (现状 vs 目标)

### 1.1 OKR (Objective / KeyResult / CheckIn)

```
                 zustand                          Prisma 当前                    目标
─────────────────────────────────────────────────────────────────────────────
Objective.weight     0-100 (UI)                  ❌ 缺                        + Int @default(100)
Objective.status     active/.../completed         ❌ 缺                        + String @default("active")
Objective.confidence on-track/at-risk/off-track  ❌ 缺                        + String @default("on-track")
KeyResult.type       binary/numeric/...          measureType: numeric/...     + binary 入 enum
KeyResult.confidence on-track/at-risk/off-track  green/yellow/red             改值域
CheckIn              { scope, scopeId, prog, conf, achievements, blockers,
                       nextSteps, mood }
                                                 { ownerId, cycleId, weekStart,
                                                   krUpdates JSON, ttiUpdates,
                                                   whatWentWell/Wrong/nextWeekPlan }
                                                                              重建为 scope-based
```

### 1.2 新增 (Prisma 没有, zustand 也是)

- `OneOnOneMeeting` + `OneOnOneActionItem`
- `Review360Cycle` + `Review360Submission` + `Review360Assignment`

## 2. 修正后的执行计划

### A2.1 Prisma + Repository (2 天)

**A2.1a** · OKR schema 对齐:
- patch `Objective`: + `weight`, + `status`, + `confidence`
- patch `KeyResult`: enum 值修复 (`measureType` + `binary`; `confidence` 从 `green/yellow/red` → `on-track/at-risk/off-track`)
- rebuild `CheckIn`: 从周度 → scope-based (留出 OKR check-in 与 IM `decisionCard` action items 的 future ActionItem 关联)
- migration: 写 down migration 把旧 weekStart/krUpdates 数据安全 drop (本地 PG 是 PoC 暂无生产数据)

**A2.1b** · 加 5 个新 model:
- `OneOnOneMeeting`, `OneOnOneActionItem`
- `Review360Cycle`, `Review360Submission`, `Review360Assignment`
- 全部加合理 @@index + @@unique
- Submission 不在 raterId 建索引 (隐私)

**A2.1c** · Repository:
- update `TandemStore` interface 加 5 个新 repo
- InMemoryStore 加 5 个 Map-backed repo
- PrismaStore 加 5 个 Prisma-backed repo
- `npx prisma migrate dev --name a2_schema_align_and_1on1_360`

### A2.2 API + auth gate (1 天)

新建:
- `GET/POST /api/1on1` `PATCH/DELETE /api/1on1/[id]`
- `POST /api/1on1/[id]/action-items` `PATCH/DELETE /api/1on1/action-items/[id]`
- `GET/POST /api/360/cycles` `PATCH /api/360/cycles/[id]`
- `POST /api/360/cycles/[id]/assignments`
- `POST /api/360/submissions`
- `GET /api/org/users` (列举 tenant 内 User, 替代 zustand `people`)

强化:
- 老的 `/api/tandem-okr` GET/POST 加 auth gate + ownerId 强制为 sessionUserId 或验证可见性
- 加 `/api/okr/checkins` (POST) 因 CheckIn 现走 API
- 加 `/api/okr/initiatives` (CRUD)

每个 endpoint 都用统一 wrapper:
```ts
function requireAuth(req: NextRequest): { userId, tenantId } | NextResponse {
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return { userId: payload.sub, tenantId: payload.tenantId ?? 'default' };
}
```

### A2.3 4 页切 API (1 天)

| 页面 | 现状 | 改造 |
|---|---|---|
| /1on1 | useOneOnOneStore | useSWR/fetch + mutate, 删 store |
| /360 | useReview360Store | 同上 |
| /memories | useMemoryStore | 改读 /api/tandem/memory/list + promotion 走 PromotionRequest |
| /organization | useOrgStore | read-only, fetch /api/org/departments + users; 删 Ministry 概念 |
| **/okr** | useOKRStore | **本来计划单独 epic, 现 D3 决定一起改**: 改读 /api/tandem-okr, 写走 POST /api/okr/* |

### A3 跨模块 wire (1 天)

- **A3.1** `OneOnOneActionItem` → `Initiative`: 1on1 action item 上加"提升为 KR Initiative"按钮, `POST /api/okr/initiatives` 引用 KR + meeting. 双向链接.
- **A3.2** 360 维度均分 → 9-box 横轴: `/nine-box` 横轴改成 `(KPI: KR 完成率) × (TTI: 360 协作/沟通/价值观均分)`. 删 9-box 旧的 TTI 计算.
- **A3.3** /memories 升级走 PromotionRequest: 已存在 `/api/tandem/memory/promotion` 端点, 但 UI 还在用 zustand 直升级 → 改 POST + Steward 审批闭环 + e2e.

### A4 zustand 清理 (1 天)

- 删 persist: useOKRStore / useOneOnOneStore / useReview360Store / useMemoryStore / useOrgStore
- 保留 persist: useAppStore (theme/darkMode), 加 useUiStore (sidebar 折叠状态)
- 首屏加 banner "演示数据已清空, 切到真实后端. 添加新数据需登录."
- 文档: 每个 zustand store 顶部加注释 "this is UI cache, real data lives in /api/xxx"

## 3. 风险 & 缓解

| # | 风险 | 缓解 |
|:-:|---|---|
| R1 | OKR Prisma 改字段会破坏现有 InMemoryStore seed | 同步更新 InMemoryStore 的 seed 数据 |
| R2 | Prisma migration 重建 CheckIn 破坏现有线上数据 | 本地 PG 是 PoC, 接受 drop |
| R3 | 用户登录态切换时, hook personId 缓存陈旧 | hook 已实现 `reset()`, 登出时清; 登录后 fetch |
| R4 | A2.2 加 auth gate 后, e2e 全挂 | 每个 endpoint 都更新 e2e 用 cookie 登录 |
| R5 | Department 树替代 Ministry, 现有 UI 引用 ministryId 失效 | /organization 切 API 时一次性映射, 然后删 Ministry 类型 |

## 4. 推演产出

- `@/docs/AUDIT-2026-05-10.md` (历史审计) — 36/38 endpoint 无 auth 的欠债
- 本文件 — A 计划全程决策与字段对照
- 后续每完成一步, 在 git commit message 引用本文件

---

**Next**: 开始 A2.1a (OKR schema 对齐).
