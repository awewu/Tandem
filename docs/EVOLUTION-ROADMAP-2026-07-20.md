# Tandem 进化路线图 (Evolution Roadmap)

> **定稿**: 2026-07-20 · **配套**: `docs/STATE-OF-THE-CODE.md` (现状 SSOT) · 本文档 = 方向 SSOT
> **一句话**: 躯体已成 (能感知/能动手/能推理), 下一阶段让它 **会学 · 可信 · 可评**。
> **维护**: 与代码/现状不一致时, 先改本文档; 每完成一个 Phase 在 §5 打勾。

---

## §0 背景 — 本路线图的三个输入

1. **代码进展盘点** (2026-06-09 → 07-20, 113 commit): 企业基座 (SSO/多租户/审计/备份) + 中央 AI 五大器官 (#12 主循环 / #13 执行肢体 / #15 OKR Anchor / #16 OKR Drift / #18 Skill Gateway 四闸) 实测 **LIVE** + Persona Squad + Shouchao + OKR/KPI (EVM) + Mobile/PWA + 协同办公 (邮件/日历/ERP/内网 CMS)。
2. **仍存缺口** (`STATE-OF-THE-CODE.md` §0.3 权威口径): **#11 真学习归因** (evolution 仍是计数器非归因诊断) · #14 Skill 端到端 · #17 个人产出捕获 · A3 故事链 UI 断点。
3. **AI 领域突破扫描** (2026-07 学术 + 三家产品):
   - 学术: 编排 (AdaptOrch "拓扑 > 模型") · agentic memory (MAGMA 四图 / SimpleMem 压缩) · **信用分配/归因** (SRPO / HCAPO / Reset) · agentic RAG (充分上下文 Agent / A2RAG / SCAIR)。
   - 产品**已借**: Claude Code (subagent / SKILL.md / system prompt) · Palantir (本体层 `lib/ontology`) · OpenAI (function-calling tool-loop / MCP)。
   - 产品**未借**: **Evals/trace-grading** · **Guardrails/注入防御** · **Hooks 生命周期** · 本体安全维度 (marking/purpose) · OSDK · Logic binding。

---

## §1 进化命题

> Tandem 已经 **"能感知、能动手、能推理" (躯体已成)**;
> 下一阶段是让它 **"会学、可信、可评" (神智进化)**。

**前提约束**: Tandem 是**推理层产品** (DeepSeek API 之上, 不自训模型)。所有 RL 类突破 (GRPO/SRPO/RFT) **取架构洞见, 不取训练方法** —— 翻译成推理时 pass / 数据结构 / 编排拓扑。

---

## §2 三个飞轮 + 一个元飞轮

### ① 学习飞轮 (归因) — 解 #11
- **现状**: CA-13 记录"被采纳/被否", 但只计数, 不归因。
- **进化**: 加 **hindsight 归因 pass** (SRPO 反思补丁 + HCAPO 事后 critic 的推理时翻译) — 回溯"哪一步建议真正带来 KR 改善/劣化", 产出"反思补丁"写回 persona evolution。
- **落点**: `lib/persona/company-brain-reflection.ts`。

### ② 可信飞轮 (守护) — 补最大安全空白
- **现状**: 有业务语义的 baseline-guard / 决策防火墙, 但无通用防护层。
- **进化**: Guardrail 层 (PII / 越狱 / **间接提示注入**) + Claude 式 **Hook 生命周期** (工具调用前后确定性拦截/审计/通知) + 本体安全维度 (marking/purpose + 三重身份权限)。
- **紧迫性**: 有外网用户 (guest/partner/contractor) + 刚上 agentic RAG (手抄/邮件/web = 不可信输入), 攻击面已真实存在。

### ③ 度量飞轮 (评估) = 元飞轮 — 解 #14, 且是前两个飞轮的基准
- **现状**: 有单测, 无 agent 行为评估台。
- **进化**: **Eval / trace-grading 台** (Palantir AIP Evals + OpenAI Evals 共识) — 轨迹采集 + 评分 + 跨执行方差 + 从标注自动优化 prompt。
- **关键洞见**: 没有评估台, 学习飞轮自说自话、可信飞轮无法验证。**所以它是 P0。**

---

## §3 进化蓝图 (能力 × 可信 双轴)

```
可信 ↑
     │  [治理层] 本体安全维度 · 三重身份权限            (Palantir)
     │  [守护层] Guardrail · 注入防御 · Hook 生命周期    (GPT/Claude)
     │  ─────────── 评估台贯穿所有象限 (元能力) ───────────
     │  [已建]   感知 · 写动作 · 多步推理 · MCP · 编排
     │  [学习层] hindsight 归因诊断                     (SRPO/HCAPO)
     └────────────────────────────────────────────────→ 能力
```

---

## §4 突破 → 模块映射 (速查)

| 突破 | 启发 | 落点模块 |
|---|---|---|
| SRPO / HCAPO 信用分配 | 计数器 → 归因诊断 | company-brain-reflection (#11) |
| Evals / trace-grading | agent 行为可度量 | 新建 eval 台 (#14) |
| OpenAI Guardrails | PII/越狱/注入防护层 | 新建 guardrail 中间件 |
| Claude Code Hooks | 确定性工具生命周期 | agent-runtime / tool-loop |
| 充分上下文 Agent / A2RAG | 单发检索 → agentic 检索 | 手抄 Ask / memory retriever |
| MAGMA 四图记忆 | 语义+时间+因果+实体 | lib/memory/retriever (A3) |
| AdaptOrch 拓扑路由 | 按任务结构选编排拓扑 | tool-loop / persona-squad / 议事 |
| Palantir 本体安全 | 安全成一等维度 | lib/ontology |

---

## §5 分期路线 (勾选进度)

- [ ] **Phase 1 · 评估先行 (基石)**: Eval/trace-grading 台 + 全 agent 路径 trace 埋点。
- [ ] **Phase 2 · 学习真闭环**: #11 hindsight 归因 pass (用评估台度量其有效性) + 手抄/知识库 agentic 检索 (充分上下文 Agent)。
- [ ] **Phase 3 · 可信护栏**: Guardrail 层 + 注入防御 + Hook 生命周期。
- [ ] **Phase 4 · 点亮 + 深化**: A3 故事链 UI wire + Memory 因果/时间图 (MAGMA-lite) + 本体安全维度 + 编排拓扑门控。

---

## §6 首要动作 (P0)

**Eval / trace-grading 台最小原型**, 并接线 CA-13 / #11 —— 一步同时打开"能度量 + 能归因"两扇门。

**骨架构想** (待展开):
- **trace 采集**: 在 `runToolLoop` / 各 pass 出入口埋点, 落 trace (input / tools called / output / 决策链 / tokensUsed)。
- **grader 接口**: `Grader = (trace) => { score, rubric, notes }`; 支持 规则 grader + LLM grader (DeepSeek 自评) + 人工标注。
- **dataset**: 从真实 trace 沉淀测试集; 回归跑分。
- **接线**: CA-13 采纳信号 + #11 归因 pass 的输出都进 trace, 用同一评分体系度量。

---

## §7 骨架原则 (不变量)

- 不自训模型: 所有"学习"是推理时 pass + 数据沉淀, 不是权重更新。
- 宪法 A: 中央 AI 永不做 proposer (评估/归因不得越界成决策)。
- 决策防火墙: 个人成长上下文 (手抄/拿捏/记事本) 绝不流入 OKR/议事决策 (2026-07-12 密封)。
- 评估台是元飞轮: 任何新 AI 能力上线前, 先有 trace 采集 + 至少 1 个 grader。
