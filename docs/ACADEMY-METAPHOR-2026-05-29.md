# Academy · 拿捏柱 + 学习中心的统一心智模型

**立项日期**: 2026-05-29
**作用域**: 拿捏柱 + 学习中心 + 个人 AI 接入网关
**关系**: 不替代 `MANIFESTO.md` / `PERSONA-EVOLUTION.md` / `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md`, 是它们的 **心智模型层**
**对外原则**: UI 文案采用「中隐喻」(Q1=B), 双标签并存 — "主分身 (学员证)" / "Lv.2 上手" / "拿捏度 (综合 GPA)"

**进度状态 (2026-05-29 18:00 PT)**: Phase 1 骨架已实现, TypeCheck 0 + 188/188 tests 全绿. 学院 UI 当前为 stub (无真实课程数据). Phase 2-4 (HR 派课 / 真实题库 / 学分置换) **暂缓**, 等 v0.1 部署给 30 同事使用 1-2 周后, 依据真实埋点数据再决定是否启动. 详见 `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md`.

**进阶名称 (v2, 2026-05-29)**: 新手 → 上手 → 熟手 → 老手 → **拿手** (谐音"拿捏", 暗含拿捏老板的产品哲学)

---

## 一、为什么用学院隐喻

### 1.1 解决的核心矛盾

| 之前的矛盾 | 学院架构解决方式 |
|---|---|
| `/persona` vs `/learning` 两个独立产品, 关系裂开 | 「学员页 ↔ 课程目录」天然关系 |
| 5 模式 chip vs 5 阶段 timeline 视觉混淆 | 「5 专业 (主修) vs Lv.1-5 进阶 (新手→拿手)」, 跨业务都懂 |
| 数据归属 / 成长方向 / 决议历史 散落 | 「学籍 / 培养计划 / 实习日志」归位 |
| Mode Proficiency 0-100 抽象 | 「分模式 GPA」即时可懂 |
| 代行边界三区抽象 | 「实习权限 L0-L3」(新手→上手→熟手→老手/拿手) |
| 必修课 + 锁权限不直观 | 「必修课未通过 → 学籍锁定 → 实习权限受限」 |

### 1.2 心智模型完整对照

| 学院概念 | Tandem 实现 | 代码锚点 |
|---|---|---|
| **学员证 / 学籍** | Persona (单分身, 一人一证) | `lib/types/persona.ts` |
| **Lv.1-5 进阶 (新手→上手→熟手→老手→拿手)** | newborn → apprentice → assistant → deputy → partner | `lib/persona/stage-meta.ts` |
| **5 个主修方向** | design / pm / tech / marketing / strategy | `lib/persona/skill-modes.ts` |
| **分模式 GPA (0-100)** | Mode Proficiency | `lib/persona/maturity.ts` |
| **综合 GPA (0-100)** | bossCaptureScore (拿捏度) | `Persona.bossCaptureScore` |
| **课程目录 (教务处)** | 学习中心 | `app/learning/` |
| **课程** | Course (n 节 Lesson) | NEW: `Course` 表 |
| **课时 / 课节** | Lesson | NEW: `Lesson` 表 |
| **教材 / 讲义** | LessonContent (markdown / video / interactive) | NEW: `LessonContent` 表 |
| **必修课** | mandatory_once / mandatory_quarterly | `Lesson.requirement` |
| **选修课** | elective / recommended | `Lesson.requirement` |
| **题库 / 测验** | Question + LessonAttempt | NEW: `Question`, `LessonAttempt` 表 |
| **学分 / 证书** | Certification | NEW: `Certification` 表 |
| **拿手 (最高级)** | partner stage 达成 | `Persona.stage` |
| **选课 / 报名** | Enrollment | NEW: `Enrollment` 表 |
| **班级 / 课程指派 (HR)** | CourseAssignment (按部门 / 角色 / 单人) | NEW: `CourseAssignment` 表 |
| **学籍隐私条款** | 数据归属铁律 | MANIFESTO §13 |
| **培养计划 / IDP** | growthAreas + LearningTrack | NEW: `LearningTrack` 表 |
| **实习权限** | delegationLevel | `Persona.delegationLevel` |
| **实习日志** | decisionHistory + ProxyAction | 现有 |
| **毕业作品 / 校友档案** | Portfolio | `/portfolio` (P6) |
| **校友讲座 / 复盘分享** | Retros + 学习社区 | `/retros/me`, P6 学习社区 |
| **学籍锁定** | 必修过期 → action_scope 黄区不可代行 | NEW: 锁权限触发器 (Skill Gateway 闸④) |
| **校规 (考场纪律)** | Skill Gateway 4 道闸 | `lib/skill-gateway/index.ts` |
| **校友自学申请** | "我自学了 X" portfolio 反哺 | NEW: `ProficiencyClaim` 表 (学分置换) |

### 1.3 实习权限 L0-L3

`Persona.delegationLevel` 文案改造:

| 内部字段 | 旧 UI | 新 UI (中隐喻) | 边界 |
|---|---|---|---|
| `report_only` | 仅报告 | **L0 见习生** | 只输出 brief / 报告, 不代行任何动作 |
| `draft` | 草稿 | **L1 实习生** | 可起草 (邮件/IM/文档), 必须人工发送 |
| `auto_with_24h_veto` | 委托+24h 否决 | **L2 正式实习** | 可代发, 但员工 24h 内可撤回 |
| `auto` | 全自动 | **L3 准毕业生** | 黄区动作可代行 (24h 否决窗仍生效) |

**晋升铁律**: 跨级晋升必须由直属上级 + Steward 双签批; 学籍锁定状态下 (必修过期) 自动降一级.

---

## 二、数据库架构 (HR 部署 + 员工自学 + 个人 AI 接入)

### 2.1 设计原则

1. **强类型核心表**: Course / Lesson / Question / Enrollment / LessonAttempt / Certification / CourseAssignment / LearningMcpToken 8 张表用 drizzle 强类型, 不走 KvStore (因为 HR 要 CRUD + 报表 + 跨表 join)
2. **KvStore 兜底次要数据**: ProficiencyClaim / LearningTrack 等运营低频表初期走 KvStore, 跑稳后再升级
3. **租户隔离**: 所有表必须有 `tenantId`
4. **审计完整**: Course / Lesson / Assignment 任何变更进 audit log (新增 audit action)
5. **软删除**: `deletedAt` (HR 误删可恢复)
6. **版本化**: Course / Lesson 有 `version`, 内容更新不破已颁证书

### 2.2 八张核心表 (Schema 草案)

```ts
// ---------------------------------------------------------------------------
// 1. Course (课程主表)
// ---------------------------------------------------------------------------
Course {
  id: text PK
  title: text NOT NULL                          // 「合规季度复训 2026Q2」
  slug: text UNIQUE                             // URL-friendly id
  category: enum('onboarding' | 'compliance'
              | 'product' | 'process' | 'track'
              | 'mode_specialty' | 'leadership')
  modeAffinity: text[] | null                   // 关联的 5 mode (主修课才有)
                                                // ['design', 'pm'] → 设计 + PM 双修课
  level: enum('beginner' | 'intermediate' | 'advanced')
  estMinutes: integer                           // 预计学时
  description: text
  coverUrl: text | null

  // 治理
  ownerUserId: text                             // 课程负责人 (HR / 资深员工)
  createdByUserId: text
  reviewedByUserIds: text[]                     // 双签批人 (Steward 审课, MANIFESTO §8)
  status: enum('draft' | 'in_review'            // 课程发布生命周期
            | 'published' | 'archived')
  publishedAt: timestamp | null

  // 必修策略
  requirement: enum('mandatory_once'            // 一次性必修
                 | 'mandatory_quarterly'        // 季度复训 (90 天过期)
                 | 'mandatory_yearly'           // 年度必修
                 | 'recommended'                // 推荐
                 | 'elective')                  // 选修

  // 学分
  proficiencyReward: jsonb                      // { mode: 'pm', score: 5 } 通过 +5
  bossCaptureBonus: integer                     // 通过给综合 GPA +N

  // 学籍锁定
  unlocksDelegationLevel: text | null           // 通过此课才能晋升到 L2
  lockOnExpiry: boolean                         // 季度复训过期 → 锁

  // 版本
  version: integer DEFAULT 1
  contentHash: text                             // 内容 hash, 变更后老证书标 outdated

  tenantId, createdAt, updatedAt, deletedAt
}

INDEX (category, status, tenantId)
INDEX (requirement, status)
INDEX (modeAffinity GIN)

// ---------------------------------------------------------------------------
// 2. Lesson (课时, 1 课程 N 课时)
// ---------------------------------------------------------------------------
Lesson {
  id: text PK
  courseId: text FK → Course.id
  orderIdx: integer                             // 在课程内排序
  title: text
  type: enum('lecture' | 'video' | 'quiz'
          | 'interactive' | 'reading')
  estMinutes: integer

  // 内容
  contentMarkdown: text | null                  // type=lecture/reading
  contentVideoUrl: text | null                  // type=video
  contentInteractiveSchema: jsonb | null        // type=interactive (3+1 决策练习)

  // AI 生成标识
  aiGeneratedAt: timestamp | null               // 由 /api/learning/generate 生成
  aiSourceId: text | null                       // 来源 (一份报告/一个议事)
  aiReviewedBy: text | null                     // Steward 审核才能 published

  // 通过条件
  passCondition: jsonb                          // { type: 'quiz_score', threshold: 0.8 }

  tenantId, createdAt, updatedAt
}

INDEX (courseId, orderIdx)

// ---------------------------------------------------------------------------
// 3. Question (题库, 多对一 Lesson)
// ---------------------------------------------------------------------------
Question {
  id: text PK
  lessonId: text FK → Lesson.id
  orderIdx: integer
  type: enum('single' | 'multi' | 'true_false'
          | 'free_text' | 'decision_3plus1')    // 3+1 决策题 = 学院特色!
  prompt: text
  options: jsonb                                // [{ id, text, isCorrect, explanation }]
  rubric: jsonb | null                          // free_text 评分准则
  correctAnswerExplanation: text

  // 学院特色 · 3+1 决策题
  decisionContext: jsonb | null                 // {scenario, A/B/C/D options}
  rightAnswerType: enum('A_sop' | 'B_reason'
                     | 'C_case' | 'D_original'
                     | 'any')                   // 哪个选项算"对"?
                                                // 或允许"任何有论证的都算对"

  weight: integer DEFAULT 1
  tenantId, createdAt, updatedAt
}

INDEX (lessonId, orderIdx)

// ---------------------------------------------------------------------------
// 4. Enrollment (选课 / 报名关系)
// ---------------------------------------------------------------------------
Enrollment {
  id: text PK
  userId: text FK → User.id
  courseId: text FK → Course.id

  source: enum('self_elected' | 'hr_assigned'
            | 'manager_assigned' | 'ai_recommended'
            | 'track_required')                 // 来源: 自选 / HR 强派 / 上级派 / AI 推 / 路径要求
  assignmentId: text | null                     // 若 source=*_assigned, 关联 CourseAssignment

  status: enum('enrolled' | 'in_progress'
            | 'passed' | 'failed' | 'dropped')
  enrolledAt: timestamp
  startedAt: timestamp | null
  completedAt: timestamp | null
  dueAt: timestamp | null                       // HR 派课的截止时间

  // 进度
  lessonsCompleted: text[]                      // lesson IDs
  totalScore: integer | null                    // 综合分

  tenantId
}

INDEX (userId, status)
INDEX (courseId, status)
UNIQUE (userId, courseId, tenantId)             // 一人一课只能一份 (重修通过 version 字段)

// ---------------------------------------------------------------------------
// 5. LessonAttempt (单次答题尝试)
// ---------------------------------------------------------------------------
LessonAttempt {
  id: text PK
  enrollmentId: text FK → Enrollment.id
  userId: text                                  // 冗余, 加速查询
  lessonId: text FK → Lesson.id
  attemptNo: integer                            // 第几次尝试 (重修 = 新一次)

  startedAt: timestamp
  submittedAt: timestamp | null
  timeSpentSec: integer

  answers: jsonb                                // { questionId: answerValue }[]
  score: integer | null                         // 0-100
  passed: boolean | null

  // 三柱闭环 (走 lib/learning/closure.ts)
  closureExecuted: boolean DEFAULT false        // 副作用是否已触发
  closureEffects: jsonb | null                  // krProgressDelta, proficiencyDelta...

  tenantId, createdAt
}

INDEX (userId, lessonId)
INDEX (enrollmentId)

// ---------------------------------------------------------------------------
// 6. Certification (证书)
// ---------------------------------------------------------------------------
Certification {
  id: text PK
  userId: text FK → User.id
  courseId: text FK → Course.id
  enrollmentId: text FK → Enrollment.id

  earnedAt: timestamp
  expiresAt: timestamp | null                   // 季度必修 = earnedAt + 90 天
  status: enum('valid' | 'expiring_soon'        // < 14 天到期
            | 'expired' | 'revoked'
            | 'outdated')                       // 课程内容大改后旧证书标 outdated

  // 防伪
  certNo: text UNIQUE                           // 「TANDEM-2026-CMPL-Q2-0007」
  contentHashAtEarning: text                    // 学到的内容版本快照
  signedBy: text | null                         // Steward 数字签名 (高阶证书)

  // 学籍解锁
  unlockedDelegationLevel: text | null
  unlockedProficiencyBoost: jsonb | null

  tenantId, createdAt
}

INDEX (userId, status, expiresAt)
INDEX (courseId, earnedAt)

// ---------------------------------------------------------------------------
// 7. CourseAssignment (HR/上级派课)
// ---------------------------------------------------------------------------
CourseAssignment {
  id: text PK
  courseId: text FK → Course.id

  // 派给谁 (XOR)
  targetType: enum('user' | 'department' | 'role'
                | 'all_tenant')
  targetUserId: text | null                     // 单人
  targetDepartmentId: text | null               // 部门
  targetRole: text | null                       // 角色 ('engineer', 'manager')

  // 派课人
  assignedByUserId: text                        // HR / 上级
  reason: text                                  // 派课理由 (审计用)

  // 截止与提醒
  dueInDays: integer | null                     // null = 无截止
  reminderPolicy: jsonb                         // 提醒策略

  // 锁定
  blocksUntilCompletion: boolean DEFAULT false  // 完成前锁特定权限

  // 状态
  status: enum('active' | 'paused' | 'cancelled')

  tenantId, createdAt, updatedAt
}

INDEX (targetUserId, status)
INDEX (targetDepartmentId, status)

// ---------------------------------------------------------------------------
// 8. LearningMcpToken (个人 AI 接入 token)
// ---------------------------------------------------------------------------
LearningMcpToken {
  id: text PK
  userId: text FK → User.id
  name: text                                    // 「我的 Claude Desktop」
  tokenHash: text NOT NULL                      // SHA-256 of token

  // Scope (员工自助颁发, 默认极窄)
  scopes: text[]                                // ['learning.search', 'learning.start', ...]
                                                // 默认不含 'learning.submit_attempt'!
                                                // 自助提交答案权限需员工二次确认

  // 节流
  rateLimitPerHour: integer DEFAULT 30
  expiresAt: timestamp                          // 90 天后过期

  // 审计
  lastUsedAt: timestamp | null
  totalCalls: integer DEFAULT 0
  revokedAt: timestamp | null

  tenantId, createdAt
}

INDEX (userId, revokedAt)
INDEX (tokenHash UNIQUE)
```

### 2.3 audit action 扩展

```ts
// lib/audit/log.ts AuditAction 新增:
| 'academy.course_published'
| 'academy.course_assigned'         // HR 派课
| 'academy.enrollment_created'
| 'academy.lesson_attempted'
| 'academy.certification_earned'
| 'academy.certification_expired'
| 'academy.delegation_unlocked'     // 通过必修, 解锁实习权限
| 'academy.delegation_locked'       // 必修过期, 锁权限
| 'academy.mcp_token_issued'        // 个人 AI 接入
| 'academy.mcp_token_revoked'
| 'academy.proficiency_claimed'     // 校友自学申请
```

### 2.4 与现有表的关系

```
User ─┬─→ Persona (一人一证, 现有 KvStore)
      ├─→ Enrollment (我的选课)
      ├─→ Certification (我的证书)
      └─→ LearningMcpToken (我的 AI 接入)

Course ─┬─→ Lesson ─→ Question
        ├─→ Enrollment ─→ LessonAttempt ─→ Certification (颁证)
        └─→ CourseAssignment (HR 派课)

OKR (KeyResult) ←─── Lesson.linkedKrId  (学习推流 KR · lib/learning/closure.ts)
Persona.modeProficiency ←─── Certification.unlockedProficiencyBoost
Persona.delegationLevel ←─── Certification.unlockedDelegationLevel + 锁过期
```

---

## 三、HR 部署课程的产品流程

### 3.1 HR 三个核心场景

#### 场景 A · 一次性创建必修课

1. HR 进 `/admin/academy/courses/new`
2. 填课程信息 (title / category=compliance / requirement=mandatory_quarterly)
3. 添加 N 节 Lesson (内容 markdown / 视频 / quiz)
4. 配置过期策略 + 解锁的 delegationLevel
5. 选择派给谁 (CourseAssignment): 全员 / 部门 / 角色 / 个人
6. 提交「待审」→ Steward 审 (audit `course.published`)
7. 自动给 target 创建 Enrollment + 提醒

#### 场景 B · Excel 批量导入课程

1. HR 下模板 (Course + Lesson + Question 三 sheet)
2. 填好后上传 (走现有 KPI Excel 同套基础设施)
3. 系统 dry-run 检查 → 错误报告
4. 确认导入

#### 场景 C · AI 自动生成课程

1. HR 选源材料 (一份新版本 SOP / 一份产品发布报告)
2. 点 "AI 生成课程"
3. 调 `/api/learning/generate` (现有 stub) → 走 Skill Gateway 4 道闸 + 3+1 引擎
4. 输出: 课程草稿 (lecture + 5 题 + 摘要)
5. HR 审 + 改 + 发布

### 3.2 HR 后台路由

```
/admin/academy/                    课程管理首页 (我课程 / 全公司课程)
  /courses                          课程列表 (筛选 / 排序 / 搜索)
  /courses/new                      新建课程
  /courses/:id                      课程详情 / 编辑
  /courses/:id/lessons              课时管理 (拖拽排序)
  /courses/:id/lessons/:lid         课时编辑
  /courses/:id/assignments          派课管理
  /courses/:id/analytics            完成率 / 平均分 / 卡点

  /tracks                           学习路径 (多课程串)

  /excel-import                     Excel 批量导入

  /ai-generate                      AI 生成入口

  /reports                          总览报表 (HR + Steward 月审)
```

---

## 四、员工个人 AI 主动获取知识的开放机制

> **MANIFESTO §19 灵魂层**: Tandem 不重发明个人 AI, 做组织级网关.

### 4.1 五种开放通道

#### 通道 ① · MCP Server (推荐, 主要通道)

员工把自己的 Claude Desktop / Cursor / Cherry Studio 接到 Tandem 学习 MCP server.

**工具集** (在 Skill Gateway 4 道闸之后开放):

| Tool | 输入 | 输出 | 闸级 |
|---|---|---|---|
| `academy.search` | query | Lesson 列表 (摘要 + URL) | 闸① baseline 通过即可 |
| `academy.fetch_lesson` | lessonId | 完整 markdown 内容 + 题目 | 闸①② 通过 |
| `academy.my_status` | — | 我的 GPA / 待办必修 / 证书 | 闸① (仅 self) |
| `academy.recommend` | "我想转产品" | 推荐课程列表 | 闸①② |
| `academy.start_lesson` | lessonId | 创建 LessonAttempt | 闸① |
| `academy.submit_attempt` | attemptId, answers | 评分 + 闭环 | 闸① + **员工二次确认 token scope** |
| `academy.export_notes` | lessonId | markdown 笔记导出 | 闸① |
| `academy.claim_proficiency` | "我自学了 X" | 提交学分置换申请 | 闸②③ (Steward 月审) |

**实现路径**:

- `lib/mcp/academy-server.ts` (新建) — 9 个 tool 的 handler
- `app/api/mcp/academy/route.ts` (新建) — MCP HTTP/SSE 端点
- `LearningMcpToken` 表存 token + scope
- 所有调用走 `runSkillGateway()` (4 道闸)

#### 通道 ② · 一键导出 (轻量)

员工在 `/learning/:lessonId` 点 "导出 markdown / PDF / EPUB"
→ 拷到自己的 ChatGPT / Notion AI / Obsidian
→ 用自己的 AI 帮自己学

**不需要 token**, **不影响进度**. 但若员工想"算学分", 必须回 Tandem 答题 (走 ① 或 UI).

#### 通道 ③ · 学分置换 (Portfolio 反哺)

员工读了书 / 做了项目 / 看了 YouTube 课程, 在 `/portfolio` 提交:

- 标题
- 学习证据 (URL / 文档 / 视频)
- 申请加 Mode Proficiency X 分 (自评)
- 申请折抵某课 (可选)

→ Steward 月审 + 上级背书 → 通过则更新 `Persona.modeProficiency`

走 `ProficiencyClaim` 表 (后续, 先 KvStore).

#### 通道 ④ · 同侪学习圈 (隐私可控)

员工 opt-in 后, 可看到:

- 同部门员工的"专业进度"分布 (匿名/汇总)
- 「PM 模式 GPA Top 10 同事」(他们的高分代表作 in `/portfolio`, opt-in 展示)
- 「校友讲座」: 高 GPA 员工的复盘分享自动变为推荐课程

#### 通道 ⑤ · 个人 AI 反向同步学习笔记

员工在自己的 ChatGPT / Notion AI 写了学习笔记 → 通过:

- IDE 插件 (Cursor / VSCode)
- 邮件 webhook
- IM 转发

发回 Tandem → Persona Memory 候选 → 走 §8 签批 → 若通过则入 Persona Memory.

**这是 MANIFESTO §19 第 1 条铁律的实现路径**: 个人 AI 的产出可被反哺组织, 但路径必须是 Tandem 的 Capture 层.

### 4.2 安全模型

| 风险 | 应对 |
|---|---|
| 员工泄露课程内容 | `academy.fetch_lesson` 仅给个人 token, 内容含水印 (员工 ID hash); 公司机密课设 `internal_only` 标识不可导出 |
| 个人 AI 帮员工"代答" | `academy.submit_attempt` 需员工 UI 二次确认, 不开 token scope |
| Token 泄露 | 90 天过期 + `/persona/data-source/mcp` 一键 revoke; 异常调用监控 |
| Steward 滥用 token | Steward 没有 token, 月审走 audit log |
| 公司机密泄露给个人 AI | 闸②③ data scope: 公司机密课不走 MCP, 仅 UI |

### 4.3 与三柱底线的关系

> 底线 #2: 搭子 + 拿捏与 OKR 解耦, 拥抱市面 AI
> 底线 #3: Tandem 不重发明个人 AI, 做组织级网关

学院架构 + 5 通道是这两条底线的**完整产品落地**:
- 学院的"课程内容" = 组织资产, Tandem 拥有
- 学员的"学习行为" = 员工自由, 任何 AI 都可参与
- 中间的"组织级网关" = MCP Server + 4 道闸

---

## 五、UI 改造清单

### 5.1 `/persona` 改造 (本会话 Phase 1)

替代当前 PersonaBrief + PersonaDashboard 散落布局, 改为:

```
<StudentCard>                                — 学员证 hero
  阶段 emoji + 名字 + 学位 + 综合 GPA + 私有标识
  5 主修方向网格 (设计/PM/技术/营销/战略 + GPA + ★)

<CourseTabs>                                 — 4 面
  [今日课表] [实习日志] [培养计划] [校规与权益]

  Tab 今日: brief + 下节课 + 召唤实习上岗
  Tab 日志: 5 阶段 timeline + 决议统计 + growth
  Tab 计划: → /persona/training (子页)
  Tab 校规: → /persona/delegation + /persona/data-source

<PrivacyFooter>                              — collapsible
```

### 5.2 `/learning` 学习中心 (文案微调)

```
顶部 hero: "课程目录"
3 大组:
  必修 (mandatory_*)
  推荐 (基于 5 模式短板)
  专业课目录 (按 5 模式分 tab: 设计 / PM / 技术 / 营销 / 战略)

每节课 Card 显示:
  标题 / 时长 / 类型 (lecture/quiz/...) / 学分 / 必修 badge / 通过率
```

### 5.3 `/persona/delegation` 改名 (文案)

「代行边界」 → 「实习权限」, 内容描述用 L0-L3.

### 5.4 `/admin/academy/` 新增 (Phase 2)

HR 后台课程管理 (本会话不实现, 立项时 stub).

---

## 六、实施路线图

### Phase 1 · 本会话 (今晚, ~4-5h)

- ✅ 立项文档 (本文件)
- ⏳ Drizzle schema 扩展 8 表
- ⏳ `/persona` 改造为学员主页
- ⏳ `/learning` 文案微调
- ⏳ `/persona/delegation` 改名
- ⏳ MCP server 骨架 (`lib/mcp/academy-server.ts` 接口 + stub)
- ⏳ audit action 扩展
- ⏳ typecheck 0 错

### Phase 2 · 下次 session (HR 后台, ~3-5 天)

- 课程 CRUD `/admin/academy/courses/`
- 课时编辑器 (markdown / 上传视频)
- 题库管理
- CourseAssignment 派课
- Excel 导入
- 完成率报表

### Phase 3 · 续 session (员工自学, ~1 周)

- `/learning/:courseId` 真渲染 (走 schema)
- `/learning/:lessonId` 答题 UI
- Certification 颁发 + 过期提醒
- 学籍锁定触发器 (锁权限)
- AI 生成课程真接入 router.chatGuarded

### Phase 4 · 续 session (个人 AI 接入, ~2 周)

- MCP server 完整实现 9 tool
- `/persona/data-source/mcp` token 管理 UI
- 学分置换流程
- 同侪学习圈

---

## 七、与既有架构对齐

### 7.1 不破坏现有铁律

| 铁律 | 学院架构如何对齐 |
|---|---|
| MANIFESTO §13.2 单分身一致性 | 学员证一张, 5 主修不分裂 |
| MANIFESTO §19 4 道闸 | MCP server 所有 tool 走 `runSkillGateway()` |
| MANIFESTO §9 三区代行 | 实习权限 L0-L3 = 三区在拿捏柱的具象化 |
| OKR 严绑定 (§三 4 条) | Lesson.linkedKrId + closure 推流 |
| Material vs Memory (§7) | 课程内容是 Material 衍生, 不污染 Memory |
| 不重发明个人 AI | MCP + 导出 + 反向同步, 5 通道开放 |
| Steward 月度审计 | 新 audit action 全部进 log |

### 7.2 与三柱关系

- **事半 ← 拿捏**: Lesson 通过 → KR 推流 (closure 已实现)
- **搭子 ← 拿捏**: Mode Proficiency 提升 → 主分身披该外套时更专业 (compose-prompt 已支持)
- **拿捏内部**: 学院 = 拿捏柱的统一信息架构

---

## 八、签字

| 角色 | 决议 | 时间 |
|---|---|---|
| Owner | H1 路径确认 | 2026-05-29 05:30 PT |
| Cascade | 立项 + Phase 1 实施 | 2026-05-29 05:35 PT |
| Steward | Phase 2+ 走议事室签批 | TBD |

---

> 这是拿捏柱继 PERSONA-EVOLUTION 之后的第二份核心架构文档.
> 与 OPTIMIZATION-PLAN / EVOLUTION-ROADMAP 并列, 不替代.
