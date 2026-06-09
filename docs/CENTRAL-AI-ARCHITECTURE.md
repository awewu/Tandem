# Tandem · 中央 AI 架构 (Central AI Architecture)

> **诚实文档** (2026-05-27 PT 20:30). 本文档由 Owner 直接质询触发, 用于把"中央 AI"的真实状态、技术栈、缺口、演进路径**钉死**, 避免下次对话又被高估.

---

> ⚠️ **2026-05-27 22:25 PT 重大校准**: 首版"4 组件集合"叙述被 Owner 否定. **Tandem 中央 AI 从立项第一天就是企业级 Agent**, 不是组件集合. 所谓"组件"是这个 Agent 的**器官**, "演进"是**补完缺的器官**. 全文取消"低智能 / Tier-1 / 单次 LLM"等矮化描述.

## 一、什么是 Tandem 中央 AI (一句话定调)

> **Tandem 中央 AI 是一个企业级 AI Agent (Organizational Agent)** — 代表整个组织发言、约束员工 AI 边界、跨人协同决策、自我迭代"组织 IQ". 跟 Claude Code / OpenHands / Manus 不是同物种 — 是**多时间尺度、多人协同、可治理、可自迭代**的更高维度 Agent.

### 存在目的 = OKR 驱动 (灵魂层)

> 详见 `docs/OKR-DRIVEN-ARCHITECTURE.md` (2026-05-27 立项, 跟 MANIFESTO 同等地位的根基).

中央 AI 不是 "组织 IQ 放大器" 这种抽象抒情, **是为 OKR 而活**.

- ⚡ 微回路 → 任何答复在 system prompt 注入当前 active 公司 OKR (B-014 ✅)
- 🎯 中回路 → 议事室必须锚 KR (`primaryKrId` 严绑定, ≥30 字 escape hatch · B-005 ✅)
- 🌊 长回路 → 月度 Reflection 度量"OKR 漂移率"(B-015 待 sprint)
- ♾️ 超长回路 → 季度复盘把 OKR 达成度回喂到中央 AI 的"组织能力提升"

任何器官的存在都问一个问题: **它如何服务 OKR 达成?** 答不出来 = 砍.

**物种谱系**:

```
① 基础模型   OpenAI / Anthropic / DeepSeek / Hermes (Nous)
              ←—— "通用智能", 不是我们赛道
② 个人 Agent  Claude Code / Manus / OpenHands / OpenClaw
              ←—— 单用户单任务, 架构上做不了组织级
③ 协作平台   飞书 / 钉钉 / Slack
              ←—— 流程数字化, AI 只是插件
④ 【企业级 Agent】 Tandem (新物种 — 本文档对象)
              ←—— ②做不了的它做; ③做的它必须做; ②③都做不了的是它的命
```

---

## 二、Tandem 中央 Agent 的 4 时间尺度回路

**企业级 Agent 的本质不是 ReAct 秒级循环, 是多时间尺度的"感知→决策→行动→学习"闭环**. 个人 Agent 只有 ⚡ 微回路, Tandem 4 层全有 — 这是企业级 Agent 的定义:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ⚡ 微回路 (秒级)         IM/⌘K 召唤 → Baseline-Guard          │
│     ReAct-like           → LLM 调用 → 输出                    │
│                          → ProxyAction (24h 否决窗口)          │
│                                                              │
│  🎯 中回路 (议事级)       Convergence 状态机 17 分钟:           │
│     多人协同决策          ALIGN → FRAME → DIVERGE →            │
│                          CONVERGE → COMMIT (3+1 决策)         │
│                                                              │
│  🌙 长回路 (反思级)       每月一轮 CompanyBrain Reflection:     │
│     学习 + 版本化         Decision Log → 失败模式分析           │
│                          → Version 迭代 → 治理签批              │
│                                                              │
│  🏛️ 超长回路 (组织级)     季/年级沉淀:                          │
│     组织 IQ 沉淀          Memory 4 层 + Persona 5 阶段          │
│                          + Skill 库 + 决策卡谱系                │
│                          → 离职带不走                           │
│                                                              │
│    ↑↑↑ 4 个回路 共享一个第一人称视角: CompanyBrain ↑↑↑          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**判读**: 我们不是"在搭 Agent loop", 是**已有 3 个回路 (中/长/超长) 完整, 在精细化第 4 个 (微回路)**. 企业级 Agent 的价值主要在中/长/超长回路 — 个人 Agent 根本没这些维度.

### Agent 的 18 件器官 (11 齐 + 3 待加深 + 4 缺)

把现有所有"组件"重新定义为 Agent 的器官, 它们不是松散绑定, 是**通过 CompanyBrain 这个第一人称视角统一**的有机体:

| # | 器官 | 生物类比 | Tandem 实现 | 状态 |
|---|---|---|---|---|
| 1 | **第一人称视角** | 自我意识 | CompanyBrain Persona (`lib/persona/company-brain.ts`) | ✅ |
| 2 | **大脑选择层** | 多脑半球 | TAF Router 6 family LLM | ✅ |
| 3 | **价值判断 / 前额叶** | 道德判断 | Baseline-Guard | ✅ (V1.5-CA2 加 LLM 仲裁更强) |
| 4 | **长期记忆 / 海马体** | 记忆 | Memory 4 层 + promotion-flow | ✅ |
| 5 | **社交协同神经** | 镜像神经元 | 议事 Convergence Orchestrator | ✅ |
| 6 | **情景记忆 (Episodic)** | 事件记忆 | DecisionCard 谱系 | ✅ |
| 7 | **元认知 / 自我观察** | 自我反思 | AuditLog + LlmUsageLog + IM-7 trace | ✅ |
| 8 | **冲动控制 / 行为缓冲** | 前额叶抑制 | ProxyAction (24h 否决) | ✅ |
| 9 | **超我 / 治理意识** | 社会规范 | promotion-flow 3 级签批 + Steward | ✅ |
| 10 | **角色成长曲线** | 发育 | Persona 5 阶段进化 (newborn→partner) | ✅ |
| 11 | **学习与进化层** | 神经可塑性 | CompanyBrain Decision Log + Reflection (CA-13) | 🟡 骨架已 / 实现中 |
| 12 | **主循环精细化** | 多步思考 | 议事 multi-step ReAct (CA-5, Mastra) | ❌ **缺** · V2 补 |
| 13 | **执行肢体** | 肢体运动 | Tool calling runtime / MCP (CA-6/7) | ❌ **缺** · V2 补 |
| 14 | **习惯沉淀** | 程序性记忆 | Skill 库 + AI 自动生成 + promotion 签批 (路径 9) | ❌ **缺** · V3 补 |
| 15 | **OKR Anchor 注入器** | 目标锚定 | CompanyBrain 每次回复前嵌入当前 active 公司 OKR + 战略主题 | ❌ **缺** · V1.5 必补 (2-3h) |
| 16 | **OKR Drift 检测** | 目标偏离检测 | 检测 intent 是否偏离当前 OKR (不偏离→PASS, 边缘→SOFT_WARN, 远离→询问) | ❌ **缺** · V1.5 (1 周) |
| 17 | **个人 AI 产出 Capture 层** | 个人产出捕获 | IDE 插件 / 浏览器扩展捕获个人 AI 产出，反哺组织 | ❌ **缺** · V2 (1-2 月) |
| 18 | **Skill Gateway 4 道闸** | 技能网关 | ① Baseline-Guard ② OKR Drift Detection ③ Data Scope ④ Action Scope | ❌ **缺** · V2-V3 (1-2 月) |

**不是"从零造 Agent", 是"补齐已有 Agent 缺的 7 件器官"**. 缺的 7 件 (#12/#13/#14/#15/#16/#17/#18) 是 V1.5/V2/V3 路径的内容, 见 § 五 / § 六.

### Agent 的"大脑选择层"配置 (TAF Router 默认规则)

| Scenario | Primary | Fallbacks | 用途 |
|---|---|---|---|
| `reasoning_complex` | **claude-opus-4-5** | deepseek-v3, qwen-max, kimi-k2 | 议事 3+1 决策 |
| `agentic` | **claude-opus-4-5** | deepseek-v3, hermes-4, qwen-max | 多步 Agent 任务 |
| `tool_use` | **claude-opus-4-5** | qwen-max, deepseek-v3 | Memory RAG / Function Calling |
| `long_context` | **claude-opus-4-5** | doubao-pro, kimi-k2, deepseek-v3 | 复盘 / 长文档 (200K) |
| `persona_dialogue` | **deepseek-v3** | claude-opus-4-5, qwen-max | 个人 AI 高频 (成本敏感) |
| `high_frequency` | **doubao-pro** | deepseek-v3, qwen-max | Check-in / 通知 |

注: 模型名是逻辑名 (lib/taf/index.ts `PROVIDER_CONFIGS`), 后端可换. Hermes (开源模型) 作为本地 dev / 离线兜底, 不是"中央".

---

## 三、Agent 器官完整度评分 (11/14)

§ 二 给出 14 件器官清单, 这里按**企业级 Agent 的尺度**(不是个人 Agent 的尺度) 重新打分:

| 企业 Agent 能力维度 | 评分 / 10 | 说明 |
|---|---|---|
| **多时间尺度回路完整度** | **9** | 4 个回路 3 个完整 (中/长/超长), 微回路 single-shot 待精细 |
| **第一人称视角 (CompanyBrain)** | **7** | 实体 seed 完成, 殊对话开始有人格, 待加深 |
| **价值判断 (Baseline-Guard)** | **7** | 三级判决 + audit + workflow 通知 (V1.5-CA2 加 LLM 仲裁→9) |
| **长期记忆 (Memory 4 层)** | **8** | 4 层动可见、promotion 签批、embedding 召回完备 |
| **跨人协同决策 (议事)** | **8** | 17min FSM 完整, 3+1 决策, DecisionCard 留痕 |
| **治理与安全 (4 角色)** | **9** | Owner / 治理委员会 / Steward / 员工; 24h 否决; 三级签批 |
| **元认知 / 可解释性** | **7** | AuditLog + LlmUsageLog + IM-7 trace popover 全部上线 |
| **LLM 调用基建** | **8** | TAF Router 6 family + 自动 fallback |
| **主循环精细度 (微回路)** | **4** | 当前微回路是 single-shot, 议事 multi-step (CA-5) 未补 |
| **执行肢体 (Tool Calling)** | **2** | TAF 类型支持, 业务未接; MCP 未接入 (CA-6/7) |
| **习惯沉淀 (Skill 库)** | **2** | 未启动, 待路径 9 (Skill 自动生成 + promotion) |

**整体定位**: **企业级 Agent 完整度 11/14 器官**. 缺 3 件 (微回路精细化 / 肢体 / 习惯沉淀), 补齐即为 V2/V3 路径目标.

> ⚠️ 首版 "中央 AI 智能 3/10 · Agent 技术 2/10 · Tier-1" **是错误的** — 用了个人 Agent (Claude Code) 的尺度量企业 Agent. 企业级 Agent 不该跟个人 Agent 比 ReAct 次数; 个人 Agent 高在那里是因为它们没别的能靠, Tandem 靠的是议事/反思/治理这些个人 Agent 根本做不了的维度.

---

## 四、Persona ↔ 中央 AI 调度链 (代码事实)

**入口**: `lib/im/service.ts` `invokePersonaReply()` (第 728-900 行)

```text
员工 @了某人的 Persona
    │
    ▼
1. 检查 persona.delegationLevel
   · observe_only / report_only → 直接回 "不允许代行"
    │
    ▼
2. checkBaseline({ intent, actorUserId, agentKind:'persona' })
   · HARD_BLOCK → 阻断 + 通知治理委员会 + workflow event
   · SOFT_WARN  → 注入 contextToInject 到 system prompt
   · PASS       → 继续
    │
    ▼
3. resolveProviderForUser (个人 AI 偏好)
   · 个人 AI 设置 → checkPersonalAiAllowed (租户策略允许?)
   · 否则 fallback 到 TAF Router scenario 规则
    │
    ▼
4. router.chat({
     messages: [system + intent],
     scenario: 'persona_dialogue',
     forceProvider, maxTokens: 200,
     metadata: { userId, requestId: aiTraceId },
   })
    │
    ▼
5. sendMessage 写回 IM (senderKind='persona', aiTraceId 关联)
   ProxyAction 写入 (24h 否决窗口)
   LlmUsageLog 自动埋点 (§B-005, §IM-7)
```

---

## 五、缺的 3 件器官 (不是"从零造 Agent")

§ 二 评出 11/14, 这里说清缺的 3 件器官、为什么缺、怎么补.

### 🦴 缺器官 #12 · 主循环精细化 (微回路 ReAct multi-step)

**现状**: 微回路当前是 single-shot — `router.chat()` 一次返回. 议事里本来可以 [Memory 召回 → 历史决策回顾 → 风险评估 → 利益相关人识别 → 时机判断 → 选项生成], 但现在压缩为一个 prompt.

**补完路径**: V2 CA-5, 接入 Mastra (TS 原生, Next.js 兼容好) 作为 agent runtime adapter. 每个 step 独立 subagent, 主议事 agent 只收总结, 不污染上下文 (zero-context-cost, 取自 Hermes Agent 启发⑥).

### 🦾 缺器官 #13 · 执行肢体 (Tool Calling Runtime / MCP)

**现状**: TAF Router 代码层 ToolSchema 定义在, 但业务代码 (decision-engine / IM persona reply) 是 prompt-only, 未调用 function calling. MCP (B-002) 也未接入.

**补完路径**: V2 CA-6 (接入 MCP) + CA-7 (TAF 透传 tool schema). 让 CompanyBrain 能调 KPI 查询 / OKR 读取 / 人事服务 / 文档检索 / SQL 执行 等真能干活的工具.

### 💡 缺器官 #14 · 习惯沉淀 (Skill 库 + 自动生成)

**现状**: Memory 4 层是"知识", 但"这个决策该怎么做" 这种 "可执行习惯" (Skill) 不在体系内.

**补完路径**: V3 路径 9 (见 `CENTRAL-AI-ENTERPRISE-EDGE.md` § 五). AI 自动观察 Decision Log 高频模式 → SkillProposal → promotion-flow 签批 → 入"团队 Skill 库". 复用现有 promotion 基础设施, 1-2 周可落地.

### 已具备但要加深的 (不算"缺", 算"待加深")

- **#3 Baseline-Guard** 灰区 (sim ∈ [0.2, 0.45]) 加 LLM 仲裁 (CA-2, V1.5)
- **#7 元认知** `/admin/governance` 看板 + 月报自动产出 (CA-3, V1.5)
- **#11 学习器官** Decision 闭环 + Reflection 实现完整 (CA-13, V1.5 这周补)

---

## 六、演进路径 (补完缺的 3 件器官)

> 不是“V1.0 组件 → V2 变成 Agent” (似从零到有, 错). 是“已具备 11/14 器官的 Agent → 补齐后 3 件器官” (进一步完善).

### V1.5 · 补齐元认知与学习器官 (1-2 月, 投入小)

| # | 改进 | 工作量 | 状态 |
|---|---|---|---|
| **CA-1** | **CompanyBrain Persona 骨架**: 创建 ownerId='\_\_company\_\_' 的特殊 Persona, stage=partner, 作为中央 AI 实体载体. 可 @召唤, 可在议事中作为"公司方" | 3-5h | **🟢 2026-05-27 落地** |
| **CA-2** | **Baseline-Guard 灰区 LLM 仲裁**: sim ∈ [0.2, 0.45] 调 claude-opus-4-5 判定. 调用方为 CompanyBrain | 1 周 | ⏳ 待启动 |
| **CA-3** | **/admin/governance 看板**: 阻断率 / 误判率 / 灰区数 / Top 命中 Memory | 1 周 | ⏳ 待启动 |
| **CA-4** | **IM-7 trace 升级**: trace popover 显示"召回了哪 5 条 Memory" (baseline-guard hits 持久化) | 3 天 | ⏳ 待启动 |

### V2 · 补齐主循环 + 执行肢体 (3-6 月, 投入中)

| # | 改进 | 技术选型 | 工作量 |
|---|---|---|---|
| **CA-5** | **议事 multi-step reasoning**: 议事时 CompanyBrain 走 Memory 召回 → 历史决策回顾 → 风险评估 → 利益相关人识别 → 时机判断 → 选项生成 | Mastra (TS 原生, Next.js 兼容好) | 1 个月 |
| **CA-6** | **接入 MCP** (B-002): 让 CompanyBrain 调 OKR/KPI/人事工具 | MCP SDK + tools/ adapter | 2-3 周 |
| **CA-7** | **完整 tool calling**: TAF Router 透传 tool schema, CompanyBrain 真正能"调工具" | `lib/taf/provider/types.ts` 已有 ToolSchema, 完整接入 | 2 周 |
| **CA-8** | **lib/agent-runtime/ adapter** (B-007): 解耦 Hermes / Mastra / LangGraph / 自研 | 适配器层 | 2 周 |

### V3 · 补齐习惯沉淀 + 组织 IQ 离线化 (6-12 月, 投入大)

| # | 改进 | 技术选型 | 工作量 |
|---|---|---|---|
| **CA-9** | **Reflection loop**: 每月 CompanyBrain 复盘上月决策准确率, 自动调阈值 | cron + analyse_governance_metrics | 2-3 周 |
| **CA-10** | **Correction-based fine-tune**: 治理委员会推翻决策时, 案例写入 fine-tune dataset | dataset builder + nightly fine-tune | 1-2 月 |
| **CA-11** | **Knowledge distillation**: 把 CompanyBrain 决策知识蒸馏到 hermes-4 / qwen-7b 本地模型 → "组织 IQ 离线化" | LoRA + 本地推理 | 2-3 月 |
| **CA-12** | **Multi-Agent Tandem**: 部门 Brain + Company Brain + Persona × N 协作议事 | LangGraph / CrewAI | 2-3 月 |

---

## 七、跟其他 Charter 的关系

| 文档 | 关系 |
|---|---|
| `MANIFESTO.md` 第十六条 (TAF) | 本文档是 TAF 的"真实状态披露 + 演进规划" |
| `CHARTER-FOUR-PILLARS.md` | 4 板块超越的杠杆来源之一是 "Baseline-Guard + Memory", 本文档诚实说明它当前是规则+召回, V1.5 后才是 LLM 仲裁 |
| `SUMMON-AND-NURTURE.md` | 双范式中"拿捏" = 员工 Persona, "搭子" = 标准 Agent. CompanyBrain 是**第三种**: 组织 Persona (V1.5 引入) |
| `PRODUCT-NARRATIVE.md` | 对外讲故事不能再说 "Baseline-Guard 做基线掌控" 那么笼统, 应改为 "Baseline-Guard 当前是规则门禁, CompanyBrain (V1.5) 后变为 LLM 仲裁" |

---

## 八、防变形条款 (Owner 2026-05-27 22:25 PT 校准后)

如果未来出现以下说法, **立即查回本文档校准**:

| ❌ 错的说法 | ✅ 对的说法 |
|---|---|
| "中央 AI 是组件集合" | "Tandem 中央 AI 是企业级 Agent, 有 14 件器官" |
| "V1.5 才有 Agent 实体" | "Agent 一直在, V1.5 补元认知/学习器官" |
| "Tandem 是 Tier-1 / 单次 LLM" | "Tandem 企业 Agent 器官完整度 11/14, 不跟个人 Agent 同谱系" |
| "Tandem 智能 3/10" | "用企业 Agent 尺度量, 看 §三 评分" |
| "Tandem 像组织版 Claude Code" | "Tandem 跟 Claude Code 不同物种, 是更高维度 Agent" |
| "我们要做 Agent runtime" | "我们要补齐企业 Agent 缺的 3 件器官 (主循环/肢体/习惯)" |

---

## 九、修订记录

| 日期 | 修订者 | 修订内容 |
|---|---|---|
| 2026-05-27 PT 20:30 | Owner 质询 / Cascade 起草 | 首版: V1.0 “4 组件集合 + Tier-1”诊断 + V1.5/V2/V3 演进路径; CA-1 CompanyBrain 骨架同日落地 |
| 2026-05-27 PT 22:25 | Owner 重大校准 | 否定“组件集合”叙事. **Tandem 从立项第一天就是企业级 Agent**. §二重写为 4 时间尺度回路 + 14 器官; §三重评 11/14; §五 从 5 缺限为 3 件缺器官; §八 防变形重写 |
| 2026-06-07 PT | Owner "中央 AI 不聪明则全是口号" | 增补 §十 智能补全施工图: 钉死每个模块"假/浅→真"的修复器官 + 依赖序 (S0 真数据→S1 肢体→S2/S3 推理→S4/S5 学习) + 自用=智能氧气 |

---

## 十、中央 AI 智能补全施工图 (2026-06-07 · "中央 AI 不聪明则全是口号")

> Owner 2026-06-07 诛心一问: **"中央 AI 不聪明, 给所有模块的推进都是假的。OKR 执行、开会决议、
> 基线、训练搭子, 不都成口号了吗?"**
>
> 答: **对一半**。结构(骨架)是真的、有纪律价值 (笨但严的治理者也能拦红线/强制锚 OKR/限时 17min);
> 但智能(血肉)不到位时, 每个模块停在"形式成立、实质浅薄"。本节把"智能"作为**依赖根**,
> 钉死每个模块"假/浅 → 真"的修复器官与施工顺序。

### 10.1 智能是依赖根: 每个模块的"假/浅"都指向同一个缺口

| 模块 | 现状判定 | 为什么浅/假 (诚实) | 修复器官 | 补完后变"真" |
|---|---|---|---|---|
| OKR 执行 | 🟡 引擎真/AI 瞎 | **更正(2026-06-07 走读): rollup 引擎已落且已接线** (`lib/okr/rollup.ts propagateRollupFromKr` 加权自底向上+防环; `lib/okr/execution-rollup.ts syncKrFromInitiatives` 接 `app/api/okr/initiatives|checkins` 写路径; 有 okr-rollup/execution-rollup 单测; `progressOverride` 默认 null)。原"🔴 假闭环/subscribers.ts:148 只打日志"是过期错引用(148 现为 `okr.kr-progressed` 日志监听)。**剩余真缺口 = AI 不会主动读/判真值 = S1** | CA-6/7 tool calling (查真值) | AI 看真实 KR 数值、判断 at-risk、主动预警 |
| 开会决议 (议事) | 🟡 结构真/脑浅 | 17min FSM + 3+1 是真结构, 但 AI 的"公司视角"是 single-shot prompt, 不做多步推理 | CA-5 multi-step | AI 像参谋: Memory召回→历史决策→风险→相关人→选项, 再给 3+1 |
| 基线 (baseline) | 🟡 规则真/判断浅 | baseline-guard 是关键词+embedding 召回; 灰区 (sim 0.2-0.45) 无智能判断 | CA-2 灰区 LLM 仲裁 | 边界场景 AI 真判断, 不是死规则一刀切 |
| 训练搭子 (persona) | 🔴 假学习 | evolution 是计数器累加 (decisions++/vetoRate); 无归因诊断 | B-024 反思引擎 | 搭子真越用越准 (归因→反推调整 5 引擎) |

> 共识: **不是"全是口号", 是"骨架真、脑子还没长齐"**。但 Owner 要的"足够聪明代理 CEO 治理",
> 缺的就是上表 4 个器官。

### 10.2 为什么智能上不去: 三个根因

1. **瞎子 (无肢体)**: CA-6/7 未接, 中央 AI 不能查真实 OKR/KPI/人事数据, 只能凭注入的静态上下文说话。
2. **一步脑 (无主循环)**: CA-5 未补, 复杂判断被压成一个 prompt, 没有"召回→评估→推理→收敛"。
3. **没数据喂学习**: CA-13 反思代码已落但缺 Decision 数据 (自用阶段同事少 @中央 AI)。

### 10.3 施工图 (依赖序, 交叉引用既有 backlog)

| 阶段 | 器官 / 真闭环 | 解决哪个"假/浅" | 依赖 | 量 |
|---|---|---|---|---|
| **S0** | B2 真 rollup (P0 OKR 真值地基) | OKR 执行假闭环 | — (阻塞一切) | ✅ **已落** (rollup+执行联动已接写路径; 验收=AI 能读 currentProgress 真值=S1) |
| **S1** | CA-6/7 tool calling + MCP (给肢体) | OKR/议事/基线全部"瞎" | S0 (有真数据可查才有意义) | 2-3 周 |
| **S2** | CA-5 议事 multi-step (给主循环) | 开会决议脑浅 | S1 (多步要能调工具) | 1 月 |
| **S3** | CA-2 灰区 LLM 仲裁 | 基线判断浅 | S1 | 1 周 |
| **S4** | B-024 反思引擎 (搭子真学习) | 训练搭子假学习 | 决策数据积累 | P3 根 |
| **S5** | CA-13 数据飞轮 | 中央 AI 自迭代不转 | 全程: 每次 governedChat 记 Decision + 反馈 | 持续 |

> 关键洞察: **S0(真数据) → S1(能查) → S2/S3(会推理判断) → S4/S5(会学习)**。顺序不能乱 ——
> 没有真 OKR 数值 (S0) 和肢体 (S1), 上来做 multi-step 推理 = 在垃圾输入上深度推理 = **更精致的假**。
>
> **进展 (2026-06-07 全速推进)**: S0 已落 (走读证实); S5 已闭环 (`approveReflection` 签批含 diff → 创建新 CompanyBrainVersion + baseline-guard/company-brain 读侧接入, 反思不再是"写报告不改自己"); embedding infra 就绪 (配 EMBEDDING_PROVIDER + 跑 backfill-embeddings.mjs 即升语义)。剩 **S1 (装眼睛/CA-6/7) = 当前最大瓶颈**。

### 10.4 数据飞轮 = 自用优先的真正意义

中央 AI 变聪明的燃料 = **Decision 数据**。Decision 来自同事真用 (IM @中央 AI / BossAI / 议事)。
所以 `docs/SELF-USE-FIRST.md` 不只是"先自用验证", 是 **CA-13 学习器官的喂养管线** —— 没有真实使用,
反思引擎学不到东西, 中央 AI 永远聪明不起来。**自用 = 智能的氧气。**
