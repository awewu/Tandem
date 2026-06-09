# Tandem 中央 AI · 本体层与统一决策调配施工图 (Ontology & Central Dispatch)

> **创建**: 2026-06-09 · 由 Palantir AIP/Foundry"组织大脑"范式拆解 + 中央 AI 真实代码走读
> (`governed-chat` · `derive-zone` · `company-brain-perception` · `taf/skills/registry` ·
> `okr/rollup` · `okr/execution-rollup`) 生成。
> **定位**: "让中央 AI 承接**统一决策调配优化**"的全景 backlog。本文件是**本体轴 (ON-0..ON-3) 的单一执行入口**,
> 挂在 `CENTRAL-AI-ARCHITECTURE.md §十` 的智能主轴 (S0→S5) 上, 与 `ROADMAP-EXECUTION.md` 的 P0-P4 对齐。
> **状态真相**: 单项进度以 `STATUS.md` 为准; 编号续 `AI-BACKLOG.md` (B-xxx) / `CENTRAL-AI-ARCHITECTURE` (CA-xx)。

状态图例: ✅ 已落 · 🟡 半成 · ❌ 未动 · ⚠️ 存疑待验 · 🔵 观察

---

## 0. 为什么要有这条轴 (根因诊断)

### 0.1 Palantir 组织大脑的五根支柱 (拆解后的工程内核)

| # | 支柱 | 内核 |
|---|---|---|
| ① | **Ontology 本体层** | 组织数字孪生 = 对象 (Objects) + 属性 + 关系 (Links) + 动作 (Actions) + 函数 (Functions)。人和 AI 共用同一套语义模型 |
| ② | **Actions / Writeback** | AI 提议**有类型的动作** → 校验/权限闸 → 关键动作人审批 → 回写真实系统 → 全程血缘 |
| ③ | **Decisions, not Dashboards** | 闭环是"感知→决策→动作→反馈", 不是看板 |
| ④ | **AIP 锚定 Ontology** | LLM/Agent 的工具**就是** Ontology 的 Actions/Functions, 无法幻觉出本体之外 |
| ⑤ | **血缘+权限+HITL 是结构性的** | 每个对象/动作自带可追溯与授权 |

### 0.2 对照 Tandem 现状 (诚实)

| 支柱 | Tandem 现状 (代码事实) | 判定 |
|---|---|---|
| ⑤ 治理/血缘/HITL | `lib/governance/governed-chat.ts` 唯一强制出口 (输入闸→动作闸→LLM→输出闸); `lib/skill-gateway/derive-zone.ts` 内容+委托级别判绿/黄/红; ProxyAction 24h 否决 + AuditLog | ✅ **已领先** |
| ④ AIP 锚定 | `lib/persona/company-brain-perception.ts` 已用 `runToolLoop` + 只读白名单查 S0 真值 | ✅ **眼睛已装 (S1)** |
| ③ Decisions | DecisionCard + 议事 17min + Decision Log/Reflection (CA-13 apply 环已闭) | 🟡 闭环未接回写 |
| ② Actions/手 | `lib/taf/skills/registry.ts` 完整, 但已注册"手"几乎全只读; 唯一写动作=黄区 `convergence.start`; 真正写操作散在各模块 API/UI | 🔴 **手太薄** |
| ① Ontology | **不存在统一本体层**: KR/Objective/Initiative、Person、Channel、Decision、KPI、Memory、Event 各有 store/type, 互不锚定 | 🔴 **缺失的拱心石** |

### 0.3 关键洞察

> **Tandem 缺的不是治理 (最难的已做完), 而是 Palantir 的拱心石——统一 Ontology + Action Type 层。**
> "OKR Check-in 嵌死在 IM 页面 (Issue 4)"不是孤立 bug, 是**缺统一动作层的必然症状**: 没有 Action Type,
> "提交 check-in"就得在每个入口手抄一遍 (调 OKR API + 广播 + 刷缓存)。
> 2026-06-09 抽出 `components/okr/okr-checkin-dialog.tsx` 只是**手工补救一次**; 根治 = 升格为 ActionType `kr.checkin`。

---

## 1. 目标闭环 (本体轴要建成的样子)

```
       ┌─────────────── CompanyBrain 决策调配闭环 ───────────────┐
       │                                                        │
 感知 Perceive ──▶ 推理 Reason ──▶ 提议动作 Propose ──▶ 治理闸 Govern
 (✅ S1 perception   (🟡 S2 CA-5      (❌ ON-1/ON-2       (✅ governedChat
  只读 toolLoop)      多步参谋链)       Ontology Action)    4闸 + derive-zone)
       ▲                                                        │
       │                                                        ▼
 反馈 Feedback ◀── 回写 Writeback ◀── 人审/24h否决 (✅ ProxyAction)
 (✅ S5 Decision Log   (❌ ON-1 Action
  + Reflection apply)   声明式副作用执行)
```

**绿=已落 (复用) · 黄=半成 (扩展) · 红=本轴新建。** 本体轴只补两个红块: **声明式 Action 层** + **决策调配回路**, 其余全部复用既有治理/感知/反思资产。

---

## 2. 贯穿铁律 (本轴新增, 叠加 ROADMAP §0)

1. **AI 写动作必 fail-closed**: 中央 AI 触发的任何 ActionType, 治理闸故障 = 拦截; 黄/红区必进 ProxyAction 24h 否决窗, 绝不自动生效。
2. **副作用声明式, 禁手抄**: ActionType 的副作用 (rollup/广播/decision log) 在动作上**声明一次**, 由执行引擎统一编排; 模块/页面不得再复制写逻辑 (根治 Issue 4 类耦合)。
3. **Ontology 是视图收口, 非重写**: ON-0/ON-1 委托现有 `repository.ts`, **不动现有 store**。与独立专项 N1 (TandemNode 统一原语) 协调: 本体轴是 N1 的**语义子集先行验证**, 不与之冲突 (见 §6)。
4. **零回归**: 每轮 `npx vitest run` (现 860 基线) + `node scripts/check-ui-charter.mjs` (0 违规) + `npm run lint:dead-code`。
5. **真模型探针**: Action 执行 + tool 下发必须真模型验证 (教训: 全绿+接线 ≠ 真接通, 见 ROADMAP P1.5 `okr.health_digest` 点号 bug)。

---

## 3. 本体轴 4 相位 (依赖序 · 工作量 · 验收)

### ON-0 · Ontology 对象注册表 (拱心石) — 🟡 第一片已落 (2026-06-09) · 剩余 ~1 周

| 项 | 内容 |
|---|---|
| **落点** | ✅ `lib/ontology/types.ts` (ObjectType/Link/ResolvedObject) + `lib/ontology/registry.ts` (单例挂 globalThis 防 HMR, 仿 skillRegistry) + `lib/ontology/object-types.ts` (注册) + `lib/ontology/index.ts` (公开 API, import 即幂等注册) |
| **范围** | ✅ **第一片已注册 OKR 三元组** `Objective` / `KeyResult` / `Initiative` (类型确定 + 真值函数已存, 正好喂 ON-1 `kr.checkin`)。❌ **剩余待注册**: `Person` `Channel` `DecisionCard` `KpiMetric` `MemoryEntry` `CalendarEvent` (同范式逐个加) |
| **实现** | ✅ `resolve`/`search` 委托 `getStore()` (与 `okr.read`/`okr.health_digest` 同读路径, 零写); `derived` 复用 `computeKRProgress`/`effectiveObjectiveProgress` 真值 (Functions-on-Objects 雏形); `links` 统一 `resolve(obj)` 屏蔽正向(by id)/反向(by query)差异 (KR↔Objective, Objective.parent/children, KR→Initiative) |
| **验收** | ✅ `ontology.resolve('KeyResult', id)` 返回 `{data, derived:{progress}, links}`; `traverse` 正/反向关系; `search` 子串匹配; 覆盖 `tests/unit/ontology-registry.test.ts` (12 测全绿) |
| **依赖** | S0 真值 (`okr/rollup` ✅) |
| **风险** | 低 (纯只读视图, 无消费方前零行为改变) |
| **解决** | 拱心石缺失; 为 ON-1 Action 的 `objectType` 锚定提供语义 |
| **剩余** | ① 补注册剩余 6 个 Object Type ② 接 embedding 检索索引 (§8.3 第 5 项, 现为子串匹配) ③ boot 显式调 `ensureCoreObjectTypes` (现靠 import 触发) |

### ON-1 · Action Type 声明式引擎 + 首动作 kr.checkin — 🟡 第一片已落 (2026-06-09) · 剩余 ~1 周

| 项 | 内容 |
|---|---|
| **落点** | ✅ `lib/ontology/action-types.ts` (ActionType/SideEffect/ActionContext + actionRegistry 单例) + `lib/ontology/execute-action.ts` (统一执行引擎) + `lib/ontology/actions/kr-checkin.ts` (首动作); audit 加 `ontology.action_executed`/`action_blocked` |
| **ActionType 形** | ✅ `{ id, objectType, declaredActionScope, describeIntent, validate, execute, sideEffects[] }` (无 zod 依赖, validate 用纯函数; sideEffects 各带 `name` + `run`, 返回 lineage 数据) |
| **执行引擎** | ✅ `executeAction(actionId, input, ctx)`: ① validate (submission criteria) → ② 动作闸 (`deriveActionZone` 内容+委托) → ③ execute 主写 → ④ 按 sideEffects 统一编排 (各自幂等+fail-soft) → ⑤ audit。**fail-closed**: 红区永不自动执行, AI 代行黄区+ 暂拦 (待 ON-2 接 24h 否决窗) |
| **首动作** | ✅ `kr.checkin`: 收编原 `app/api/okr/checkins` 的 KR 写逻辑 (建 CheckIn + 同步 KR + rollup `propagateRollupFromKr` + 两类事件) 为声明式; **route kr 分支已改调 `executeAction`** (单一真值, 不再手抄); objective 分支保留。IM 广播保持 UI 层可选副作用 (不进核心动作) |
| **验收** | ✅ submission criteria (存在/授权/废弃/数值与信心度) + 动作闸 fail-closed + 主写 + 声明式副作用 + lineage 全覆盖; `tests/unit/ontology-action-kr-checkin.test.ts` (11 测) + route 改写后全量 884 测零回归 + okr-rollup(9) 不破 |
| **依赖** | ON-0 ✅ + `governedChat`/`derive-zone` (P0-C1 ✅) + `propagateRollupFromKr` (P0-B2 ✅) |
| **风险** | 中 (已触写路径; 用 ActionType 单测 + 全量回归兜底, 无 HTTP 层测但 HTTP 仅薄适配) |
| **解决** | ② 手太薄; **坐实 Issue 4 解耦从"手工补救"→"架构范式"** |
| **剩余** | ① 接 ON-2 后让 AI 代行 kr.checkin 走 24h 否决窗 ② IM/日历/OKR 页前端逐步改调统一动作端点 ③ submission criteria 接 §8 事务性补偿 (现副作用 fail-soft 不回滚主写) |

### ON-2 · 中央 AI 决策调配回路 (Propose→Govern→Writeback) — 🟡 调配骨架已落 (2026-06-09) · 剩余 LLM 提议层

| 项 | 内容 |
|---|---|
| **🔒 宪法裁定 A (2026-06-09 Owner)** | **中央 AI 纯参谋, 永不写 ProxyAction**: 与 `company-brain.ts` doctrine ("不写 ProxyAction") 对齐。`proposeAction` **仅接受员工本人的分身** (self-delegation: persona.userId === onBehalfOfUserId), **代码层硬拒中央 AI persona + 跨人代行** —— 把宪法从注释变成强制不变量。中央 AI 的"建议"只在对话/3+1 出现, 要写动作须员工本人/其分身发起 |
| **落点** | ✅ `lib/ontology/propose-action.ts` (提议→否决窗→兑现, 含宪法 A 守卫) + `execute-action.ts` 加 `approved` 旁路 + `proxy-action.ts` 加 `ontology_action` kind + `proxy-actions.ts` reconcile 跳过 ontology_action |
| **回路** | ✅ **员工分身延迟执行链路已通**: `proposeAction()` (仅员工本人分身) 红拒/绿即执行/黄进 `ProxyAction(awaiting_veto)` **暂不写**; `confirmAndMaterialize()` 员工确认→兑现; `reconcileOntologyActionVetoWindows()` 24h 静默过→自动兑现 (静默=员工隐式批准, 因是其自己分身代行)。❌ **剩余**: 让中央 AI 在对话里**建议**员工去 check-in (参谋输出, 不自动建提议) |
| **治理** | ✅ 提议过 `executeAction` 闸 (deriveActionZone); 红永拒, 黄进否决窗, 兑现时 `approved=true` 旁路 isProxy-yellow 拦截 (审批即授权); 红区即便 approved 仍永拦 |
| **延迟执行语义** | ✅ 与既有 im_reply/email_draft (动作已发生, 否决窗仅事后撤销) 不同: ontology_action 真写发生在**否决窗之后**; 故现有 `reconcilePendingActions` 跳过它, 专由 `reconcileOntologyActionVetoWindows` 兑现 (兑现失败保留 awaiting_veto 重试, 不误标 executed) |
| **验收** | ✅ 提议 kr.checkin→pending_veto **窗内零写** → 确认/静默过→真写+rollup; 否决→不写; 非法→rejected; **中央 AI proposer→硬拒**; **跨人代行→拒**; 幂等不重复写; `tests/unit/ontology-propose-action.test.ts` (11 测) + 全量 897 测零回归 |
| **依赖** | ON-1 ✅ + ProxyAction 24h 否决窗 (✅ 已有) + `company-brain.ts` 身份常量 (✅) |
| **风险** | 中 (员工自托管写动作, 非中央 AI; fail-closed + self-delegation 守卫 + 24h 窗三兜底; reconcile 暂未挂 cron) |
| **解决** | ③ Decisions 闭环接回写; **"员工分身代行写"骨架已成, 宪法 A 守住中央 AI 参谋边界** |
| **员工入口** | ✅ confirm 路由 (`/api/persona/proxy-actions/[id]/confirm`) 改走 `confirmAndMaterialize` —— 对 ontology_action **先跑真写再标 executed** (修复"仅翻状态不写"的潜在 bug, 对其它 kind 行为不变); veto 路由无需改 (否决=永不兑现); 台账 UI (`/persona/me/proxy-actions`) 通用列举 + confirm/veto 按钮已含 ontology_action (加 `数据更新代行` 标签); 全链 tsc 0 错 + 900 测零回归 |
| **剩余** | ① 中央 AI 在对话里**建议**员工去 check-in (参谋输出, 走 §13 humanOnly, **不**自动建提议) ② `reconcileOntologyActionVetoWindows` + `reconcilePendingActions` 挂 cron (注: 二者目前**均**未接 cron, 属既有 infra 缺口, 非 ON-2 特有) |

### ON-3 · 优化方向回路 (Reflection→优化 Action→治理审批) — ❌ 未动 · ~3-4 周 (依赖数据积累)

| 项 | 内容 |
|---|---|
| **落点** | 扩 `lib/persona/company-brain-reflection.ts` (已有 apply 环) → 新增"优化型 Action 提议"产出 |
| **回路** | 接 S5 数据飞轮: Reflection 读 Decision 结果 → 识别"哪些 KR 长期 at-risk / 哪些 baseline 阈值误判高 / 哪些高频模式可促 skill" → 产出**优化型 ActionType 提议** (KR 资源再分配 / 阈值调整 / skill 促升) |
| **治理** | 全部以 ActionType 走治理审批 (治理委员会 / Owner), **绝不自动生效**; 批准记入 `CompanyBrainVersion` |
| **验收** | 月度 Reflection 产出 ≥1 条优化 Action 提议 → 审批后生效 → 记入 CompanyBrainVersion; 覆盖优化回路测 |
| **依赖** | ON-2 + S5 (CA-13 apply 环 ✅) + 真实使用数据 (自用喂养) |
| **风险** | 高 (组织级优化建议; owner/委员会强把关; 数据不足则空转, 故排最后) |
| **解决** | "优化方向"; 把 S5 飞轮从"调自己参数"扩到"调组织资源配置" |

---

## 4. 依赖图与排期

```
S0 真值✅ ─┐
           ├─▶ ON-0 本体注册表 (1-1.5w, 低险)
P1-M4✅ ───┤        │
P0-C1✅ ───┘        ▼
                ON-1 Action 引擎 + kr.checkin (1.5-2w, 中险) ◀── P2-B3 execution-rollup✅
                    │  (坐实 Issue 4 解耦)
                    ▼
S2 全路径 ─────▶ ON-2 决策调配回路 (3-4w, 高险) ◀── ProxyAction 24h✅
(P1.5 剩余)         │  (= 统一决策调配)
                    ▼
S5 apply✅ ────▶ ON-3 优化方向回路 (3-4w, 高险, 依赖数据)
+ 自用数据          (= 优化方向)
```

**顺序铁律**: ON-0 (语义地基) → ON-1 (装手, 先验证一个真动作) → ON-2 (会调配) → ON-3 (会优化)。
跳过 ON-0/ON-1 直接做 ON-2 = 让 AI 在没有统一动作层上调配 = 回到各模块手抄的老路 = **更精致的耦合**。

---

## 5. 挂到智能主轴 S0-S5 (对齐 CENTRAL-AI-ARCHITECTURE §十)

| 智能轴 | 本体轴关系 | 状态 |
|---|---|---|
| S0 真数据 (rollup) | ON-0 的对象 `resolve` 数据源 | ✅ 复用 |
| S1 眼睛 (perception 只读) | ON-2 Perceive 阶段直接复用 | ✅ 复用 |
| S2 推理深度 (CA-5) | ON-2 Reason 阶段复用; 主回复路径是 P1.5 剩余前置 | 🟡 扩展 |
| **(本轴新增) 统一动作层** | **ON-0 + ON-1** — S1(看)与 S2(想)之间缺的"手" | ❌ **本轴拱心石** |
| S3 灰区仲裁 (CA-2) | ON-2 动作闸黄区判定可复用仲裁 | ❌ 并入 B-015 |
| S4 搭子真学习 (B-024) | ON-3 优化提议可喂 persona 反思 | ❌ 独立 |
| S5 数据飞轮 (CA-13) | ON-3 优化方向回路的产出端 | ✅ apply 环已闭, 扩产出 |

> **定位**: 本体轴 = 智能主轴 S1↔S2 之间被忽略的"**手**"维度。治理 (说什么/做什么) ✅ + 眼睛 (能查) ✅ +
> 推理 (多步想) 🟡 都在补, 但"**用统一受治理的手去动**"一直缺 —— 这正是 Palantir Ontology Action 的精髓。

---

## 6. 与独立专项 N1 (TandemNode 统一原语) 的边界

`ROADMAP-EXECUTION.md §两个独立专项` 的 N1 要用 TandemNode 取代 ~50 个分仓。**本体轴不与之冲突, 是其先行验证**:

- **ON-0 是 N1 的语义子集**: 先在**只读视图层**注册 9 个 Object Type, 验证"统一原语 + links"范式可行, 不碰底层 store 迁移 (N1 的高风险部分)。
- **ON-1 Action 层是 N1 未覆盖的维度**: N1 讲"对象/类型跃迁", 本体轴补"对象上的**受治理动作**"。两者正交, 可并行。
- **建议**: 本体轴 ON-0/ON-1 在 N1 启动前落地, 用真实动作 (`kr.checkin`) 反推 N1 的 type 设计; N1 启动后, ON-0 的 `resolve` 底层切到 TandemNode, 上层 ActionType 不动。

---

## 7. 起手三步 (最高杠杆)

1. **ON-0 注册表 (1-1.5w, 低险)**: 先把 9 个 Object Type 注册为只读视图, 立刻可验、零写风险, 为一切锚定语义。
2. **ON-1 `kr.checkin` 首动作 (1.5-2w, 中险)**: 把 2026-06-09 的解耦升格为架构范式, 三入口 + 中央 AI 共用; 验证声明式副作用引擎。
3. **ON-2 限 green 灰度 (起步)**: 先让中央 AI 只提议/执行 green 低风险 Action, 跑通 Perceive→Reason→Propose→Govern→Writeback 全链, 再放开 yellow (进 24h 窗)。

---

## 8. 技术规格硬化 (剥营销, 学 Palantir 真实工程机制)

> Owner 2026-06-09 纠偏: **不谈输赢叙事, 只学技术夯地基**。下表把 Palantir Foundry/AIP 的营销话术剥掉,
> 留工程机制, 逐条钉成 ON-0/ON-1 的技术规格增量。

### 8.1 五条真实机制 → Tandem 规格增量

| # | Palantir 真实机制 (de-marketed) | Tandem 现状 | 规格增量 (钉到相位) |
|---|---|---|---|
| 1 | **Ontology = 类型化对象视图 + 检索索引** (逻辑模型与物理存储分离, 物化进对象库+搜索索引低延迟读) | 对象检索靠各分仓 `list()`+内存过滤; `skillRegistry.search` 是 token 匹配 | **ON-0**: 对象层接**统一检索索引** (embedding + 倒排, embedding infra 已就绪), 否则对象一多退化全表扫 |
| 2 | **Action = 声明式校验 + 事务化编辑** (参数 + submission criteria 前置约束 + edits + security rules, 事务化产出可版本化 edit) | ON-1 草案只有 zod 类型校验; 副作用顺序调用会半写 | **ON-1**: ActionType 加 ① **submission criteria** (业务前置: 如 `kr.checkin` 值域/冻结/频率) ② **事务性** (副作用幂等键 + 补偿, 防 KR 改了广播没发的半写) |
| 3 | **Functions-on-Objects = 类型化/版本化/可部署纯函数 RPC** (一等公民 registry, 被 Action 与 AIP 复用) | 纯计算散在各 `lib/okr/*.ts` 与 API route, 无统一 registry/版本 | **ON-0/ON-1**: 把 `propagateRollupFromKr` 等纯计算收口成 `lib/ontology/functions/` 注册表; Action 的 edits 引用 Function 而非内联 (逻辑只一份/可测/可版本) |
| 4 | **AIP 防幻觉 = 工具绑定 + Eval harness** (LLM 唯一杠杆是类型化 ontology op; prompt/逻辑当软件测) | 工具绑定 ✅ (`skillRegistry`+`runToolLoop`, 研究得早); **Eval harness 是真短板** (B-008 🟡 脚手架在/fixture 缺) | **横切 (现在就做)**: 补 `tests/eval` fixture, 给感知 gate / S2 多步推理建回归基线。**✅ 第一片已落 (见 §8.2)** |
| 5 | **Lineage = transform 级 DAG + marking 沿血缘传播** (派生数据记"由谁经哪个 transform 来"; 敏感标记继承) | 有动作 audit 链 (hash), **无数据血缘**; rollup 算完只写值算不出"为什么" | **ON-1 + `okr/rollup.ts`**: rollup 输出加 `rollupLineage` (输入 KR id+值+时间+权重), 让中央 AI 答"目标为啥落后"有据可查; 配合 marking 沿 rollup 继承可见性 |

> **守住已对的两块** (研究得早, 不用学/要守): ① 工具绑定防幻觉 (`runToolLoop`) ② operation 级架构强制权限 (`skillRegistry.execute` 的 `dataScope`+`checkDataScope`)。Palantir 规模更大, 但机制 Tandem 已有。

### 8.2 已落地 (2026-06-09)

- **机制 4 第一片 · Eval harness 回归基线**: `tests/eval/company-brain-perception-gate.eval.test.ts` —
  12 条 offline case 锁住 `company-brain-perception.ts::shouldPerceive` 的睁眼/闭眼边界
  (8 正例必触发 + 4 反例不触发; case-3 "KR3 进展" 专守 `KR\b` 无词边界场景, 防中央 AI 又变瞎子)。
  不调 LLM, 确定性 100% 通过门槛。这是"LLM 逻辑当软件测"的最小落地, 为 S2 多步推理回归铺基线。

### 8.3 夯实优先级 (按"该补强度")

| 序 | 技术 | 状态 | 落点 |
|---|---|---|---|
| 1 | Eval harness (LLM 逻辑当软件测) | 🟢 第一片已落 | 继续补 S2/感知 pass/Action 的 case |
| 2 | 事务化 + 幂等副作用 | ❌ | ON-1 `executeAction` |
| 3 | 声明式 submission criteria | ❌ | ON-1 ActionType |
| 4 | Rollup 血缘 (lineage) | ❌ | `okr/rollup.ts` 加 `rollupLineage` |
| 5 | 统一对象检索索引 | ❌ | ON-0 接 embedding 索引 |

---

## 9. 修订记录

| 日期 | 修订者 | 内容 |
|---|---|---|
| 2026-06-09 | Owner "学 Palantir 组织大脑, 交中央 AI 统一决策调配优化" / Cascade 起草 | 首版: Palantir 5 支柱拆解 + Tandem 对照 + 本体轴 ON-0..ON-3 全景施工图 (依赖序/工作量/验收) + 挂 S0-S5 主轴 + 与 N1 边界 |
| 2026-06-09 | Owner "不谈叙事, 学技术夯地基" / Cascade | 增补 §8 技术规格硬化: 剥营销留 5 条真实工程机制 (索引化对象层/声明式校验+事务/Functions registry/Eval harness/lineage) 钉进 ON-0/ON-1; Eval harness 第一片回归基线已落 (`company-brain-perception-gate.eval.test.ts`) |
| 2026-06-09 | Owner "继续" / Cascade | **ON-0 第一片落地**: `lib/ontology/` (types/registry/object-types/index) 注册 OKR 三元组 (Objective/KeyResult/Initiative), resolve/search 委托 getStore、derived 复用 rollup 真值、links 正反向统一; 12 单测全绿; 全量 873 测零回归; 死代码巡检干净 |
| 2026-06-09 | Owner "继续" / Cascade | **ON-1 第一片落地**: Action Type 声明式引擎 (`action-types.ts`/`execute-action.ts`) + 首动作 `kr.checkin` (`actions/kr-checkin.ts`); submission criteria + 动作闸 fail-closed (deriveActionZone) + 主写 + 声明式副作用 (rollup lineage + 事件, 幂等); **`app/api/okr/checkins` kr 分支已改调 executeAction (单一真值, 坐实 Issue 4 解耦)**; audit 加 ontology.action_executed/blocked; 11 单测 + 全量 884 测零回归; 死代码 0 |
| 2026-06-09 | Owner "继续" / Cascade | **ON-2 调配骨架落地**: `lib/ontology/propose-action.ts` 提议→否决窗→兑现延迟执行链路; `execute-action` 加 `approved` 旁路 (审批即授权, 红区仍永拦); ProxyAction 加 `ontology_action` kind, 现有 reconcile 跳过, 专由 `reconcileOntologyActionVetoWindows` 兑现 (失败重试不误标); `confirmAndMaterialize` 人审兑现。8 单测 (窗内零写/确认兑现/否决不写/静默过自动兑现/非法 reject/幂等) + 全量 892 测零回归; 死代码 0。剩余 = LLM 自动提议层 + cron + UI 入口 |
| 2026-06-09 | Owner 裁定 **A·中央 AI 纯参谋** / Cascade | **与中央 AI 宪法对齐**: 发现 ON-2 让中央 AI 提议写动作 与 `company-brain.ts` doctrine ("不写 ProxyAction") + 三层权力参谋定位冲突, 经 Owner 裁定。`proposeAction` 加**代码层守卫**: 仅接受员工本人的分身 (self-delegation: persona.userId===onBehalfOfUserId), 硬拒中央 AI persona + 跨人代行 —— 宪法从注释变强制不变量。+3 守卫单测 (中央 AI 拒/跨人拒/不存在拒); 全量 897 测零回归; 死代码 0 |
| 2026-06-09 | Owner "CONTINUE" / Cascade | **ON-2 员工入口打通**: confirm 路由改走 `confirmAndMaterialize` —— ontology_action **先跑真写再标 executed** (修复"仅翻状态不兑现"潜在 bug, 其它 kind 行为不变); 台账 UI (`/persona/me/proxy-actions`) 加 `ontology_action` kind + `数据更新代行` 标签 (confirm/veto 按钮本就通用)。端到端: 员工分身提议→台账显示+24h 倒计时→确认兑现真写/否决永不写。tsc 0 错 + 全量 900 测零回归; 死代码 0 |
