# 实现锚点笔记 · 2026-05-29

**目的**: 把 2026-05-28~29 单 session 新建的 5 个运行时模块, 反向同步到核心架构文档.

**索引**: 本文档是 MANIFESTO / PERSONA-EVOLUTION / CHARTER-FOUR-PILLARS / OPTIMIZATION-PLAN-CROSSCHECK 的实现锚点附录, 不替代主文档的哲学/产品论述, 只补"代码落在哪、接口长什么样".

---

## 模块 1 · `lib/decision-layer/` (P0.5)

**对齐主文档**: `CHARTER-FOUR-PILLARS.md` §2 议事室 3+1 + `OKR-DRIVEN-ARCHITECTURE.md`

**性质**: 议事室专属 3+1 引擎 → 通用决策引擎抽层. 同一套"3 个 AI 选项 + 1 个人类 D"模式, 复用到 5 个场景.

**文件**:

- `lib/decision-layer/three-plus-one-engine.ts` — 通用 3+1 引擎 (含 baseline-guard / scenario tag / D 选项 humanOnly)
- `lib/decision-layer/index.ts` — barrel + `DecisionEngine` 别名 (向后兼容)
- `lib/decision-layer/adapters/convergence.ts` — 议事室 (V0 已接)
- `lib/decision-layer/adapters/report.ts` — 报告抽取 (P1 接入点)
- `lib/decision-layer/adapters/tti.ts` — TTI/Initiative 拆解 (P1 接入点)
- `lib/decision-layer/adapters/weekly-retro.ts` — 周度复盘 (P1 接入点)
- `lib/decision-layer/adapters/persona-brief.ts` — 主分身 brief (P1 接入点)

**关键接口**:

```ts
// three-plus-one-engine.ts
export interface DecisionContext {
  scenario: 'convergence' | 'report' | 'tti' | 'weekly_retro' | 'persona_brief';
  intent: string;
  actorUserId: string;
  // ... baseline + okr anchor
}

export class ThreePlusOneEngine {
  async generateOptions(ctx: DecisionContext): Promise<OptionGenerationResult>;
}
```

**与议事室的关系**:

- `lib/convergence/decision-engine.ts` 已改 thin wrapper, re-export `@/lib/decision-layer` 内容. 旧调用方零改动.
- 旧路径标 `@deprecated`, 保留 ≥1 release 周期.

**5 个 scenario 与议事室的差异**:

| Scenario | A/B/C 来源 | D 选项 |
|---|---|---|
| convergence (议事室) | 3 个 AI 角色辩论 (思辨/客观/批判) | 主持人选 / 升级 / 拆 |
| report (报告抽取) | 同一段文字 3 个抽取角度 (战术/战略/风险) | 重抽取 / 拒绝采纳 |
| tti (Initiative 拆解) | 3 个不同拆解粒度 | 自己定义 |
| weekly_retro (周度复盘) | 3 个角度归因 (能力/资源/外部) | 不归因, 仅记录 |
| persona_brief (主分身 brief) | 3 个 Waiting items 优先级排序方案 | 我重排 |

---

## 模块 2 · `lib/skill-gateway/` (P4)

**对齐主文档**: `MANIFESTO.md` §19 立项铁律 — Skill Gateway 4 道闸

**性质**: 4 道闸的 **unified entry**. 此前 baseline-guard / okr-drift / data scope / action scope 散落各处, 调用方可能漏掉其中某道闸.

**文件**:

- `lib/skill-gateway/index.ts` — `runSkillGateway()` unified entry

**关键接口**:

```ts
export interface SkillGatewayInput {
  intent: string;
  actorUserId: string;
  agentKind: 'autonomous' | 'skill' | 'persona';
  toolName: string;
  okrAnchorId?: string;
  krAnchorId?: string;
  dataScope?: 'personal' | 'team' | 'department' | 'company';
  actionScope?: 'read_only' | 'create_draft' | 'commit' | 'send_external';
}

export interface SkillGatewayResult {
  verdict: 'PASS' | 'SOFT_WARN' | 'HARD_BLOCK';
  gates: {
    baseline:    { verdict, reasons };
    okrDrift:    { verdict, driftScore? };
    dataScope:   { verdict, level? };
    actionScope: { verdict, zone?: 'green' | 'yellow' | 'red' };
  };
  contextToInject?: string;
  blockReasons?: string[];
  checkId: string;
}

export async function runSkillGateway(input: SkillGatewayInput): Promise<SkillGatewayResult>;
```

**4 道闸实现状态**:

| 闸 | 实现 | 真接? |
|---|---|---|
| ① Baseline-Guard | `lib/memory/baseline-guard.ts` | ✅ 真接 |
| ② OKR Drift | `lib/governance/okr-drift.ts` | ✅ 真接 |
| ③ Data Scope | `runSkillGateway` 内 stub | 🟡 v0 (P5 接 RBAC) |
| ④ Action Scope | `runSkillGateway` 内 stub | 🟡 v0 (P5 接 ProxyAction) |

**audit**:

- `audit('skill_gateway.checked', ...)` — 每次调用留痕 (PASS / SOFT_WARN / HARD_BLOCK)
- `audit('skill_gateway.blocked', ...)` — HARD_BLOCK 单独高亮 (Steward 月审重点)

**铁律 (MANIFESTO §19 实现版)**:

> **任何 AI 调企业数据 / 执行企业动作前, 必须先调 `runSkillGateway()`. 不调 = 违反 §19.**
> Code review checklist 应固化此项.

---

## 模块 3 · `lib/persona/skill-modes.ts` (P1+P3)

**对齐主文档**: `PERSONA-EVOLUTION.md` + `CENTRAL-AI-ARCHITECTURE.md` 单分身 + 多模式

**性质**: 单分身 (员工只有一个分身, MANIFESTO §13.2 铁律) 在不同场景"披外套"切换的 5 个标准模式.

**文件**:

- `lib/persona/skill-modes.ts` — 5 模式定义 + system prompt 段

**5 模式标准清单**:

| 模式 ID | emoji | label | 适用场景 |
|---|---|---|---|
| `design` | 🎨 | 设计模式 | 视觉/交互设计任务, 调用 Figma/灵感库 skill |
| `pm` | 📦 | 产品模式 | PRD/路线图/用户调研, 调用 OKR/调研问卷 skill |
| `tech` | 🛠️ | 技术模式 | 架构/代码/CR, 调用 IDE/CI 状态 skill |
| `marketing` | 📣 | 营销模式 | 文案/活动/品牌, 调用 GTM/数据洞察 skill |
| `strategy` | 🎯 | 战略模式 | 决策/OKR 制定/复盘, 调用 OKR 全栈 skill |

**单分身一致性铁律**:

切换模式 = URL `?mode=X` 参数. **同一员工的分身名字 / 总 stage / 风格画像 / 边界 跨模式一致**. 模式只换 system prompt segment + recommended tools, 不切实体.

**新增模式的治理流程** (待定, P6):

1. 任何人可提议 (Decision Card 走议事室)
2. Steward 团队评审 (是否真"通用模式", 不是个体定制)
3. 写入 `skill-modes.ts` + 灰度发布

---

## 模块 4 · `lib/persona/maturity.ts` (P3)

**对齐主文档**: `PERSONA-EVOLUTION.md` 拿捏成熟度

**性质**: Mode Proficiency (模式熟练度) 算法 v0. 与 `overallStage` (员工分身总阶段) 双层独立, 不混淆.

**文件**:

- `lib/persona/maturity.ts`

**算法 v0**:

```
proficiency = base × decay + bonus

  base = log10(samples + 1) × 20         # 饱和增长, 100 样本 = 40 分
  decay = exp(-recentDays / 90)          # 90 天半衰, 不用就退化
  bonus = endorsements × 3 + okrContrib × 5  # 他人背书 + 真实 OKR 贡献加权

proficiency: 0-100  →  ★ 映射:
  ≥80: ★★★★★    ≥60: ★★★★    ≥40: ★★★
  ≥20: ★★         否则: ★
```

**接口**:

```ts
export function computeModeProficiency(input: {
  samples: number;
  recentDays: number;
  endorsements: number;
  okrContrib: number;
}): number;  // 0-100

export function proficiencyToStars(score: number): 1 | 2 | 3 | 4 | 5;

// P5 真接 store 前的 mock 数据源
export function getMockProficiencies(): Record<SkillMode, number>;
```

**铁律**:

- proficiency 与 `overallStage` (分身阶段: nascent → maturing → mature → master) **不混淆, 不互转**
- 5 模式各自独立 proficiency, 跨模式不传染

---

## 模块 5 · `lib/learning/closure.ts` (P5)

**对齐主文档**: `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md` §7 学习中心 + 三柱闭环

**性质**: 学习完成 1 节课 → 触发三柱闭环 5 个副作用的统一钩子.

**文件**:

- `lib/learning/types.ts` — Lesson / LessonAttempt / Certification
- `lib/learning/fixtures.ts` — 7 个示范课 mock (P6 替换为真 store)
- `lib/learning/closure.ts` — `onLessonCompleted()`

**接口**:

```ts
export interface ClosureInput {
  attempt: LessonAttempt;   // 必须 passed=true
  lesson: Lesson;
}

export interface ClosureResult {
  success: boolean;
  effects: {
    krProgressDelta?:        { krId, deltaPercent };       // 事半 ← 拿捏
    proficiencyDelta?:       { mode, addedScore };          // 搭子 ← 拿捏
    certification?:          Certification;                 // mandatory 类
    personaMemoryCandidate?: { lessonId, summary };         // opt-in 才入
  };
  warnings: string[];
}

export async function onLessonCompleted(input: ClosureInput): Promise<ClosureResult>;
```

**5 副作用清单**:

1. **KR 进度推流** (事半 ← 拿捏): `lesson.linkedKrId` 存在 → 调 OKR check-in
2. **Mode Proficiency 加分** (搭子 ← 拿捏): `lesson.rewardMode` + `rewardScore` 累加
3. **颁发认证**: `lesson.requirement === 'mandatory_*'` 时生成 Certification (季度必修 90 天过期)
4. **Persona Memory 候选**: lesson 摘要作为分身训练候选 (opt-in 才入)
5. **Audit 留痕** (`skill.executed` action)

**P6 真接的子任务**:

- 子①: `lib/services/okr-service.ts.addCheckIn(krId, deltaPercent)` 真接
- 子②: `lib/persona/maturity-store.ts` 写入 modeProficiency map
- 子③: 已可工作 (Certification 对象在 effects 里返回, 调用方持久化)
- 子④: Persona Memory 沉淀需 `lib/memory/promotion` 走 SOP/Case 流程, 不直接入
- 子⑤: 已可工作

---

## 文档反向同步索引

| 主文档 | 章节 | 应补 cross-ref |
|---|---|---|
| `MANIFESTO.md` §19 | 4 道闸末尾 | → 模块 2 |
| `PERSONA-EVOLUTION.md` 多模式 / maturity 段 | — | → 模块 3 + 4 |
| `CHARTER-FOUR-PILLARS.md` §2 议事室 3+1 | — | → 模块 1 |
| `OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md` §7 学习中心 | — | → 模块 5 |

具体 cross-ref 修订见各文档对应 commit.

---

## 长尾未同步项 (P6+)

- `app/learning/*` 7 个 stub 页 vs CHARTER 中"7 大学习场景"对照表 (本会话 stub 路径与 CHARTER 名称不完全一致, 需对齐)
- `nav-modules.ts` 三柱重排 vs `MANIFESTO §1-3` 三柱描述 (本会话已对齐, 但产品 wording 可能继续演进)
- `TTI → Objective+KeyResult` 合并 (CHARTER-KPI-TTI §6.1 锚定, 代码未迁移)
