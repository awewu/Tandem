# A2 真后端打通 · 进度跟踪

> 起点: 2026-05-10 19:18
> 关联: `@/docs/AUDIT-2026-05-10-A-realbackend.md`

## 已完成 ✅

### A2.1a · OKR schema 对齐 (commit `3073667`)

- Objective: + weight / status / confidence / tags / collaboratorIds / watcherIds / selfScore / managerScore / finalScore / retrospective / reviewedAt
- KeyResult: + measureType=binary 入 enum / confidence on-track|at-risk|off-track / weight / status / dueDate / tags / collaboratorIds / watcherIds / selfScore / finalScore
- CheckIn 重建: weekly+JSON → scope-based (`scope`, `scopeId`, progressBefore/After, confidenceBefore/After, achievements, blockers, nextSteps, mood)
- migration: `20260511023629_a2_okr_align_checkin_rebuild` (TRUNCATE CheckIn 接受)

### A2.1b · 5 新 Prisma model (commit `03a078a`)

| Model | 用途 | 关键字段 |
|---|---|---|
| `OneOnOneMeeting` | 主管-员工对话 | managerId/reportId/scheduledAt/cadence/status + agenda + notes + linkedKrIds + moodScore + privateManagerNote |
| `OneOnOneActionItem` | 1on1 行动项 | meetingId/text/assigneeId/dueDate/done + linkedInitiativeId (A3.1 软绑定) |
| `Review360Cycle` | 360 评估周期 | name/startDate/endDate/status/questions(Json)/anonymizePeers/createdBy |
| `Review360Submission` | 360 反馈提交 | cycleId/subjectId/raterId(无索引,隐私)/raterType/answers(Json)/strengths/improvements/overallScore |
| `Review360Assignment` | 360 评估人指派 | (cycleId,subjectId,raterId)@@unique + submitted + submittedAt |

migration: `20260511080404_a2_1b_1on1_360_models`

### A2.1c · Repository 接口 (commit `03a078a`)

- `lib/types/one-on-one.ts` + `lib/types/review-360.ts` (storage 层 ISO string)
- TandemStore + 5 个 Repository<T>
- InMemoryStore + PrismaStore 各 wire 5 行
- 用 `String + @@index` 而非 User @relation 反向 (避免触动 User 表)

### A2.2 · 11 新 endpoint + auth gate (commit `83936c9`)

新增 helper:

- `lib/auth/require-auth.ts` (verifyAccessToken 包装 + demo fallback + role guard)
- `lib/auth/strip.ts` (1on1 / 360 隐私字段 strip)

Endpoints:

```text
POST/GET    /api/1on1
GET/PATCH/DELETE /api/1on1/[id]
POST        /api/1on1/[id]/action-items
PATCH/DELETE /api/1on1/action-items/[id]
GET/POST    /api/360/cycles
PATCH       /api/360/cycles/[id]
POST/GET    /api/360/cycles/[id]/assignments
POST/GET    /api/360/submissions
GET         /api/org/users
GET/POST    /api/okr/checkins
GET/POST    /api/okr/initiatives
PATCH/DELETE /api/okr/initiatives/[id]
patch:      /api/tandem-okr GET/POST + auth gate (原本裸奔)
```

权限模型:

- 1on1: managerId/reportId 均可 GET/PATCH; 仅 manager DELETE
- 1on1 隐私: privateManagerNote/moodScore 仅 manager 可见
- 360 cycle: createdBy / admin / hr / champion 可改
- 360 submission 可见性: rater 看自己 / subject 看自己 (peer 抹 raterId) / cycle owner+admin+hr 看全
- okr: owner / coOwner / KR.owner / KR.coOwner 可改

Smoke test 已通过:

- GET 5 endpoint 全 200
- POST /api/1on1 走 prisma 完美返回 meeting + cuid

### A2.3 · 4 页切 API (commit `201aff8`) ✅

策略调整: 不重写页面, 改 zustand store 内部 — 下游 15+ 个调用点零改动.

| 页面 | 切换 | 备注 |
| --- | --- | --- |
| /1on1 | ✅ 双写 | useOneOnOneStore drop persist + loadFromApi + dual-write |
| /360 | ✅ 双写 | useReview360Store 同模式 |
| /memories | ⏸ 仅 drop persist | 后端 `/api/tandem/memory/*` 已存在, UI 切 API 后续迭代 (TODO) |
| /organization | ⏸ 仅 drop persist | useOrgStore 是 fixture 组织架构, 不入库 |

适配层:

- `lib/api/one-on-one-sync.ts` (number ms ↔ ISO; 内嵌 actionItems ↔ 拆表; undefined ↔ null)
- `lib/api/review-360-sync.ts` (cycle/assignment/submission 三种实体)

模式:

- mutation: 立即更新本地 (UX 即时) + fire-and-forget POST/PATCH/DELETE
- loadFromApi: 页面 mount 时 ApiHydrator useEffect 调用一次
- 服务端接受 client UUID (Prisma `@id @default(cuid())` 但允许显式传)

### A4 · zustand 清理 (同 commit `201aff8`) ✅

- ❌ persist 删除: useOneOnOneStore / useReview360Store / useMemoryStore / useOrgStore
- ✅ persist 保留: useChatStore / useAgentStore / useTaskStore / useKnowledgeStore / useOKRStore / useAppStore (个人/本地业务, 不动)
- 首屏 banner: `components/api-hydrator.tsx` — 顶部 amber 条提示 "A2 真后端已接通", sessionStorage 标记关闭后不再显示

### A3 跨模块 wire ⏸ (留待后续迭代)

骨架已铺好, 字段已加, 但 UI 编织待做:

- `OneOnOneActionItem.linkedInitiativeId` (Prisma 字段 + index 已加) → `/api/okr/initiatives` POST 已可用; 缺: 1on1 ActionItem UI 加 "提升为 Initiative" 按钮
- 360 维度均分 → 9-box 横轴: 算法层 (`@/lib/insights/derive`) 已用 360, 但 9-box 算法层尚未替换 (现仍用 TTI)
- Memory 升级 PromotionRequest: API 已通, UI 还在 zustand demo 模式

### E2E ⏸ (跳过)

- 项目无 Playwright (`@playwright/test` 未在 `package.json`)
- 安装 + 配置 + 5 链路约 1 天工作量, 不在本次交付范围
- 替代验证: dev server 实测 4 页 200 OK + POST /api/1on1 真 Prisma 写入 cuid

## 时间线复盘 (终态)

| 阶段 | 计划 | 实际 | 状态 |
| --- | --- | --- | --- |
| A1 useCurrentUser hook | 0.5 天 | 0.5 天 | ✅ |
| A2.1a OKR schema 对齐 | 1 天 | 1 天 | ✅ |
| A2.1b 5 新 model | 0.5 天 | 0.3 天 | ✅ |
| A2.1c Repository | 0.5 天 | 0.2 天 | ✅ |
| A2.2 endpoint + auth | 1 天 | 0.6 天 | ✅ |
| A2.3 4 页 cutover | 1 天 | 0.5 天 (1on1+360 完整, memories/org 仅 drop persist) | ✅ |
| A4 zustand 清理 | 0.5 天 | 同上一并做 | ✅ |
| A3 跨模块 wire | 1 天 | 字段就位, UI 待做 | ⏸ |
| E2E | 1 天 | 跳过 (无 Playwright) | ⏸ |

## 终交付状态 (commit `201aff8`)

后端骨架 + 前端骨架对接完成, 验证通过:

- 5 endpoint smoke test 全 200
- POST /api/1on1 走通 Prisma, 返回 cuid 实体
- /1on1 /360 /memories /organization 4 页 SSR + hydrate 200
- tsc --noEmit 0 errors

**遗留 (后续迭代)**:

- /memories /organization 真切 API
- A3 跨模块 wire UI
- 自动化 e2e (需先装 Playwright)

**Iron rules 履行**:

- ✅ 不重写 (页面/组件零改动, store 内部双写)
- ✅ 接受 demo 数据丢弃 (D5)
- ✅ 所有新 endpoint 过 requireAuth (D4)
- ✅ 隐私字段 strip (1on1.privateManagerNote / 360 anonymizePeers)
- ✅ tsc 持续 0 errors
