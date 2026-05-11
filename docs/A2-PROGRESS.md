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

## 待完成 ⏳

### A2.3 · 4 页切 API (估 1.5 天)

| 页面 | 现状 | 切换策略 |
|---|---|---|
| /1on1 | useOneOnOneStore (zustand persist) | hooks/use-1on1-api.ts (内部 fetch + SWR-like cache) |
| /360 | useReview360Store | 同上 |
| /memories | useMemoryStore | 改读 /api/tandem/memory/list + promotion 走 PromotionRequest endpoint |
| /organization | useOrgStore | read-only, fetch /api/org/users + /api/org/departments |

风险:

- 切换时 zustand 旧 localStorage 数据可能与 API 形态错位 → A4 加 banner + reset
- /360 数据形态从 number 时间戳 → ISO string, 需要适配层

### A3 · 跨模块 wire (估 1 天)

- A3.1 OneOnOneActionItem.linkedInitiativeId → /api/okr/initiatives 创建 (UI: action item 旁加"提升为 Initiative"按钮)
- A3.2 360 维度均分 → 9-box 横轴 (TTI 替换 9-box 旧算法)
- A3.3 Memory 升级走 PromotionRequest endpoint (UI 改 fetch)

### A4 · zustand 清理 (估 0.5 天)

- 删 persist: useOneOnOneStore / useReview360Store / useMemoryStore / useOrgStore
- 保留 persist: useAppStore (theme), 加 useUiStore (sidebar 折叠)
- 首屏 banner: "演示数据已切到真实后端"

### e2e (估 1 天)

5 个关键链路:

- okr-create (Objective + KR + CheckIn)
- 1on1-flow (创建 → action item → 标记完成)
- 360-cycle (创建 → assign → submit → strip 验证)
- memory-promote (草稿 → PromotionRequest → 签批)
- im-spawn-room (消息 → 议事室 → 回链 system message)

## 时间线复盘

| 阶段 | 计划 | 实际 |
|---|---|---|
| A1 useCurrentUser hook | 0.5 天 | ✅ 0.5 天 |
| A2.1a OKR schema 对齐 | 1 天 | ✅ 1 天 |
| A2.1b 5 新 model | 0.5 天 | ✅ 0.5 天 |
| A2.1c Repository | 0.5 天 | ✅ 0.3 天 |
| A2.2 endpoint + auth | 1 天 | ✅ 0.6 天 |
| A2.3 4 页 cutover | 1 天 | ⏳ 待开始 |
| A3 跨模块 wire | 1 天 | ⏳ |
| A4 zustand 清理 | 0.5 天 | ⏳ |
| e2e | 1 天 | ⏳ |

**截至 commit `83936c9`**: 后端骨架完成, 前端尚未切换. 任何新功能从今天起应直接走 API.
