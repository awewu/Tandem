# Tandem 进化路线 · 实施状态 (2026-05-28 night)

**状态**: P0 → P5 骨架全部跑通, typecheck 0 错; P6 长尾持续推进
**同会话工时**: ~3h
**下次启动**: P1 真接入 LLM 流式 brief / P3 maturity 接真 store / P4 闸 ③④ 完善

---

## 一、本会话交付清单 (P0 → P5)

### ✅ P0 · IA 正本清源 (完成)

**nav-modules.ts 三柱重排**
- 拿捏: 4 区 (我的分身 / 自我画像 / 技能与成长 / 学习中心)
- 搭子: 4 区 (主分身工作台 / 技能模式参数化 / 个人 AI 接入 / 召唤台)

**14 个 stub 页**
- 学习中心 7 页 (`/learning/*`)
- 拿捏 5 页 (`/persona/{profile,data-source,delegation}`、`/portfolio`、`/retros/me`)
- 搭子 2 页 (`/summon/{external,audit}`)

**共享组件**
- `components/placeholder-page.tsx`: 通用 stub 模板

### ✅ P0.5 · Decision Layer 抽层 (完成)

**新增 lib/decision-layer/**
- `three-plus-one-engine.ts`: 通用 3+1 引擎 (含 baseline-guard / scenario tag / D 选项 humanOnly)
- `index.ts`: barrel + DecisionEngine 别名 (向后兼容)
- `adapters/`: convergence (V0 已接) + report/tti/weekly-retro/persona-brief (P1 接入点)

**lib/convergence/decision-engine.ts** 改 thin wrapper, 0 行为变化

### ✅ P1 · 主分身 brief MVP (骨架完成)

**lib/persona/skill-modes.ts**
- 5 模式定义: design / pm / tech / marketing / strategy
- 每模式: emoji / label / description / systemPromptSegment / recommendedTools

**components/persona/PersonaBrief.tsx**
- 顶部 brief 卡 (Waiting/Running 区, mock 数据)
- 5 模式 tab (含 ★ proficiency)
- 切换走 `?mode=X` URL 参数 (单分身, 不切实体)
- 默认私有标识 (MANIFESTO §13.2)

**app/persona/page.tsx 改造** ← Suspense + PersonaBrief + PersonaDashboard

### ✅ P2 · 学习中心 MVP (骨架完成)

**lib/learning/types.ts** + **lib/learning/fixtures.ts**
- Lesson / LessonAttempt / Certification / GeneratedLesson schema
- 7 个示范课 (mock)

**app/learning/page.tsx** 完整改造 (替换 stub)
- 顶部 brief + 必修待完成 + 推荐 + 5 大类别入口
- 完成认证 → 提示 KR 推流 + Mode Proficiency +N

**app/api/learning/generate/route.ts** AI 课程生成 stub
- 输入: { sourceId, sourceType, userId, category }
- 输出: { lecture, questions[5], summaryCard[] }
- P3 真接入: scenario='reasoning_complex' + Skill Gateway 4 道闸

### ✅ P3 · 单分身 + 技能模式 (骨架完成)

**lib/persona/compose-prompt.ts**
- 拼装 system prompt: persona + mode + okr + privacyScope + scenario
- 强制注入: 单分身身份 / 风格画像 / 三区代行铁律 / 隐私 §13.2 / 输出规则 §2 §15
- 单分身一致性: 无论调哪个模式, 名字 / 总 stage / 边界一致

**lib/persona/maturity.ts**
- `computeModeProficiency` 启发式算法 v0
  - base = log10(samples+1) × 20 (饱和)
  - decay = exp(-recentDays/90) (90 天半衰)
  - bonus = endorsement × 3 + okrContrib × 5
- `proficiencyToStars`: 0-100 → 1-5 ★
- `getMockProficiencies`: P5 真接 store 前的 mock

### ✅ P4 · Skill Gateway 框架 (骨架完成)

**lib/skill-gateway/index.ts**
- 4 道闸 unified entry: `runSkillGateway()`
- 闸 ① Baseline-Guard (真接 lib/memory/baseline-guard)
- 闸 ② OKR Drift Detection (真接 lib/governance/okr-drift)
- 闸 ③ Data Scope (P5 接 RBAC, v0 personal=PASS / company=SOFT_WARN)
- 闸 ④ Action Scope (red/yellow/green 三区, send_external=BLOCK / commit=WARN)
- 综合裁决 + audit 留痕

**lib/audit/log.ts** 新增 AuditAction:
- `skill_gateway.checked` (4 道闸调用留痕)
- `skill_gateway.blocked` (HARD_BLOCK 单独高亮)

### ✅ P5 · 闭环钩子 (接口完成)

**lib/learning/closure.ts** 学习完成的三柱闭环
- `onLessonCompleted(attempt, lesson)` → 触发:
  - ① KR 进度推流 (事半 ← 拿捏)
  - ② Mode Proficiency 加分 (搭子 ← 拿捏)
  - ③ 颁发认证 (mandatory 类必修)
  - ④ Persona Memory 候选 (opt-in 才入)
  - ⑤ Audit 留痕
- `checkComplianceExpiration(certs)` → 24h grace 检查 (P4 锁权限触发器)

---

## 二、验证

```
npx tsc --noEmit  → Exit code 0 (0 errors)
```

议事室 3+1 行为不变 (向后兼容验证) · 14 个新 stub 页可访问 · /persona 含 brief + 5 模式 tab

---

## 三、P1-P5 骨架 vs 完整 MVP 差距 (P6 长尾)

| Phase | 已完成 (骨架) | 未完成 (P6 长尾) | 真接入预估 |
|---|---|---|---|
| **P1** | brief 卡 + 5 模式 tab UI + URL 参数化 | 真聚合 OKR/IM/议事 数据;真 LLM 流式播报 (复用 IM CompanyBrain 流式技术栈) | 1-2 天 |
| **P2** | /learning 主页 + AI 课程生成 stub | 真接 router.chatGuarded + 流式 lecture + 答题判分逻辑 + Lesson store | 3-5 天 |
| **P3** | skill-modes 定义 + compose-prompt + maturity 算法 | maturity 接真 store (现读 mock) · /persona/training 标注按模式 | 2-3 天 |
| **P4** | 4 道闸 unified entry + audit | 闸 ③ 真 RBAC · 闸 ④ 真 ProxyAction · /summon/audit 看板 · 红线必修锁权限 | 1 周 |
| **P5** | onLessonCompleted 接口 + 5 副作用 stub | 真接 OKR addCheckIn / Persona modeProficiency store / Persona Memory 沉淀 | 1 周 |

---

## 四、下一步建议 (P6 长尾推进顺序)

按"用户感知优先"排序, 不是工程量:

1. **P1 真 LLM brief 流式** (1-2 天) — 员工进 /persona 第一眼看到流式 brief, 是最大价值
2. **P5 OKR addCheckIn 真接** (2-3 天) — 学习完成 → KR 进度真上, 三柱真闭环成立
3. **P3 maturity 真 store** (2 天) — Mode Proficiency 不再 mock, 员工训练分身有真反馈
4. **P2 课程生成器真 LLM** (3-5 天) — 学习内容真生成
5. **P4 锁权限灰度** (1 周) — 涉及权限改动, 高风险, 最后做

并行可做:
- **P6 主分身夜间 brief cron** (1 天)
- **P6 代表作 / 复盘库** UI 落地 (3 天)
- **P6 学习社区** (2 周)

---

## 五、设计决议补强 (本会话核心校准)

| 决议 | 文件 |
|---|---|
| 单分身 + 5 技能模式 (取代主/子分身) | `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md` v2 |
| 3+1 通用化 (lib/decision-layer/) | `lib/decision-layer/*` |
| Skill Gateway 4 道闸 unified entry | `lib/skill-gateway/index.ts` |
| 学习内容是 Material 衍生包 (不污染 Memory) | `lib/learning/types.ts` 注释 + closure.ts |
| Mode Proficiency 与 overallStage 双层独立 | `lib/persona/maturity.ts` 注释铁律 |

---

## 六、底线再次备忘

> 1. 事半每项必回溯 OKR
> 2. 搭子 + 拿捏与 OKR 解耦, 拥抱市面 AI
> 3. Tandem 不重发明个人 AI, 做组织级网关

任何 P6 长尾推进违反这三条 → 自动驳回。
