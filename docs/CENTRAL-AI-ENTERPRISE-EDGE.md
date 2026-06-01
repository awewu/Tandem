# Tandem 中央 AI · 企业级智能体超越路径

> **研究目的**: Owner (2026-05-27 PT 22:00) 提出, 中央 AI-Tandem 要超越"只能做个人 agent 的能力". 本文档**横向拆解** 5 个当前 SOTA 个人 AI agent 架构, **抽出共性约束**, 然后给出 **Tandem 中央 AI 必须做、个人 agent 永远做不到** 的 7 条差异化路径.
>
> **结论先行**: 个人 Agent (Claude Code / Codex / OpenHands / Manus / Hermes-agent) 是**操作机器**的智能体. Tandem 中央 AI 是**代表组织、管控员工 AI、保留组织记忆、跨人协同决策**的智能体. **不是强弱关系, 是物种差异**.

---

## 一、为什么写这份对标

| Owner 的提问 | 我的诚实回应 |
|---|---|
| "中央 AI-Tandem 要像 Claude Code / openclaw / Hermes agent 一样" | **错半句**: 我们的工程师本能, 容易把"成为强大的 AI agent"理解为"成为更好的 Claude Code". 但 Claude Code 解的是**单用户单任务**问题, Tandem 解的是**组织协同**问题, 路径不同 |
| "要超越它们只能做个人 agent 的能力" | **完全对**: 我们要做的是它们**架构上永远做不到**的事, 不是它们做的事的 +10% |

**判断标准**: 任何资深 AI 工程师看到 Tandem 中央 AI 后, 应该说:

> "把 Claude Code/Codex 直接抬上来, 也做不到 Tandem 这件事. 因为它需要重做底层架构."

而不是: "嗯, Tandem 像个组织版的 Claude Code."

---

## 二、5 个 SOTA 个人 Agent 架构拆解

**说明**: 基于 2025 H2 公开资料 + Cascade 模型对 SOTA agent 设计模式的知识. 任何具体版本细节请以各官方文档为准.

---

### 2.1 · Claude Code (Anthropic 官方 CLI agent)

```
┌─────────────────────────────────────────────────────┐
│             Claude Code 架构 (单进程 CLI)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │   大脑: Claude Opus 4.x / Sonnet 4.x        │    │
│  │   - 200K context window                     │    │
│  │   - 原生 tool calling (function calling)    │    │
│  │   - extended thinking (Opus 4)              │    │
│  │   - 内化 ReAct 在模型里                      │    │
│  └────────────────────────────────────────────┘    │
│              │                                      │
│  ┌───────────▼──────────────────────────────┐      │
│  │   工具集 (内置 11 个 + MCP 任意扩展)        │      │
│  │   · Bash / BashOutput / KillShell         │      │
│  │   · Read / Write / Edit / MultiEdit       │      │
│  │   · Glob / Grep                            │      │
│  │   · WebFetch / WebSearch                   │      │
│  │   · TodoWrite (内部 todo 管理)              │      │
│  │   · Task (spawn subagent)                  │      │
│  │   · Skills (按需加载的能力包)               │      │
│  │   · MCP servers (外部协议接入)             │      │
│  └─────────────────────────────────────────────┘    │
│              │                                      │
│  ┌───────────▼──────────────────────────────┐      │
│  │   Memory 层 (3 级)                          │      │
│  │   - 用户级 ~/.claude/CLAUDE.md             │      │
│  │   - 项目级 ./CLAUDE.md                     │      │
│  │   - 会话上下文 (in-context, 任务结束就丢)   │      │
│  └─────────────────────────────────────────────┘    │
│              │                                      │
│  ┌───────────▼──────────────────────────────┐      │
│  │   主循环: ReAct (内化)                       │      │
│  │   Think → Tool Call → Observe → Think... │      │
│  │   直到模型自己输出 stop_reason='end_turn'  │      │
│  │   每轮上下文累积; 200K 满则 condense        │      │
│  └─────────────────────────────────────────────┘    │
│              │                                      │
│  ┌───────────▼──────────────────────────────┐      │
│  │   终止信号                                    │      │
│  │   - 模型自决 (end_turn)                     │      │
│  │   - 用户中断                                  │      │
│  │   - 工具调用预算耗尽                          │      │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Plan 机制**: TodoWrite 工具维护一个"待办清单", 模型主动 update. Plan 是模型自我管理的, 不是单独 planner 模块.

**核心创新**:
- **Subagent (Task tool)**: 主 agent 可以 spawn 子 agent 跑独立任务, 子 agent 完成后只返回**总结**给主 agent, 不污染主上下文
- **Skills 系统**: 按需加载的 markdown 能力包 (跟 prompt 一起注入), 减少初始 system prompt 体积
- **CLAUDE.md 协议**: 项目级 memory 通过约定俗成的文件名注入

**局限 (Tandem 视角)**:
- 单用户单项目, 没有"组织"概念
- 会话结束, CLAUDE.md 不会自动更新 (要人写)
- 没有组织级约束 (不知道公司 Memory / 战略红线)
- 没有跨人协同 (两个员工各用各的 Claude Code, 互不相知)
- 没有审计链路 (个人行为不可追溯)

---

### 2.2 · OpenAI Codex CLI / Codex (2024 重启版 + 2025 更新)

```
┌─────────────────────────────────────────────────────┐
│              OpenAI Codex CLI                         │
├─────────────────────────────────────────────────────┤
│  大脑: GPT-5 / GPT-4.1 / Codex-mini / o-series       │
│        (含 reasoning steps, 不同于 Claude 的 thinking)│
│  工具: shell + file ops + git + apply_patch          │
│  Memory: AGENTS.md (项目级, 跟 CLAUDE.md 对标)       │
│  Loop: ReAct + reasoning trace (o-model 特有)         │
│  Sandbox: 默认 sandboxed (macOS Seatbelt/Landlock)   │
│  审批模式: suggest / auto-edit / full-auto           │
└─────────────────────────────────────────────────────┘
```

**核心创新**:
- **审批粒度**: 用户可选"建议模式 / 自动编辑 / 完全自主", 跟 Claude Code 的固定行为不同
- **Reasoning trace**: o-model 的中间思考可见 (但 Claude 也跟上了 extended thinking)
- **Sandbox by default**: 默认隔离, 比 Claude Code 更保守
- **apply_patch 工具**: 比 Claude 的 Edit 更结构化, 减少错改

**局限**: 同 Claude Code — 单用户单项目, 无组织约束.

---

### 2.3 · OpenHands (前 OpenDevin) — 开源 SWE agent

```
┌──────────────────────────────────────────────────────┐
│         OpenHands (Apache 2.0, 开源)                  │
├──────────────────────────────────────────────────────┤
│  大脑: 任意 LLM (Claude / GPT / DeepSeek / Hermes)    │
│        通过 LiteLLM 抽象层                            │
│                                                      │
│  Runtime: Docker sandbox (每个 task 一个容器)         │
│  - bash                                              │
│  - IPython kernel                                    │
│  - browser (browser-use / playwright)                │
│  - file editor (ACI-like)                            │
│                                                      │
│  Loop: AgentSkills + ReAct                            │
│  - 每个 skill 是一个工具集子集                         │
│  - micro-agents: 按文件类型自动加载提示                │
│                                                      │
│  Memory: Event Stream + Condensation                  │
│  - 每个 action/observation 是一个 event              │
│  - 满了之后 summarize 历史                            │
│                                                      │
│  Mode:                                                │
│  - headless (CI 跑评测)                              │
│  - replay (从 event log 重播)                        │
│  - GUI (Web UI)                                       │
└──────────────────────────────────────────────────────┘
```

**核心创新**:
- **完全开源**: 整个 agent runtime 可读, 可自托管
- **Docker 隔离**: 每个任务独立容器, 安全性好
- **Event Stream 模型**: 历史是 typed events (CmdRun / FileEdit / BrowserClick), 比纯文本 history 结构化
- **micro-agents**: `.openhands/microagents/*.md` 按文件类型自动注入提示
- **多模型支持**: 不绑死 Anthropic / OpenAI

**局限 (Tandem 视角)**: 还是单 user / 单 sandbox / 单任务. Event Stream 任务结束就归档, 不进入组织记忆.

---

### 2.4 · Manus (Butterfly Effect, 中国, 2025)

```
┌──────────────────────────────────────────────────────┐
│            Manus 架构 (Cloud-hosted Agent)            │
├──────────────────────────────────────────────────────┤
│  大脑: 多模型混合 (Claude + 自研 fine-tune)            │
│                                                      │
│  Tool 重心: browser-use + 文件系统 + 终端 + 编辑器     │
│  (网页操作能力是核心竞争力, 跟 Claude Code 不同)         │
│                                                      │
│  Runtime: 云端虚拟机 (Hong Kong / SG)                 │
│  - 长任务 (小时级 / 天级)                            │
│  - 多任务并行 (multi-tab)                            │
│  - 持久 workspace (跨会话保留)                       │
│                                                      │
│  Loop: 长任务规划 + 自主网页浏览 + 内存式 todo        │
│                                                      │
│  Memory: workspace + task history                     │
└──────────────────────────────────────────────────────┘
```

**核心创新**:
- **任务时长**: 从分钟级 (Claude Code) 跳到 **小时级/天级** (autonomous web work)
- **browser-use 重投资**: 浏览器交互精度比 OpenHands 强
- **持久 workspace**: 跨会话保留 (终于有"长期记忆"的雏形)
- **任务并行**: 同时跑多个 task (subagent 的产品化)

**局限 (Tandem 视角)**:
- workspace 是**个人级**, 不是组织级
- 没有多人协作概念 (一个人订阅, 一个人用)
- 没有合规审计 (个人助手不需要)
- 长任务 ≠ 组织决策, 还是 individual contributor 视角

---

### 2.5 · Hermes Agent (Nous Research)

```
┌──────────────────────────────────────────────────────┐
│       Hermes 3/4 (基于 Llama 3.1 405B)                │
├──────────────────────────────────────────────────────┤
│  大脑: Nous Research 自训 fine-tune                    │
│        - 强 function calling (开源里最强之一)         │
│        - 强 ReAct 训练                                │
│        - 角色扮演稳定 (steerable)                     │
│                                                      │
│  特点:                                                │
│  - **不是完整 agent runtime, 而是 LLM 层**             │
│  - 配合外部 framework (LangGraph / smol-agents /      │
│    自研 loop) 才是完整 agent                          │
│  - 工具调用 schema 训练得特别细                        │
│                                                      │
│  典型部署:                                             │
│  - Ollama / vLLM 本地推理                             │
│  - 配合 LangChain Tool Calling                        │
│  - 在 Tandem 里通过 hermes-4 provider 注册             │
└──────────────────────────────────────────────────────┘
```

**核心创新**:
- **开源 LLM 里 tool calling 最强家族之一** (Llama 3 / Qwen 之外的第三极)
- **角色扮演稳定**: system prompt 改了 persona, 模型行为真的会变, 不会突破角色
- **本地部署**: 隐私敏感场景可完全离线 (Tandem 的"组织 IQ 本地化"必备)

**Hermes 在 Tandem 里的角色**:
- 不是 "AI agent runtime", 是 **LLM Provider 兜底** (TAF Router 里的 `hermes-4`)
- V3 阶段, 把 CompanyBrain 的判决知识 **蒸馏到 Hermes 模型** → 组织 IQ 离线化 (CA-11)

---

## 三、横向对标表 (10 个维度)

| # | 维度 | Claude Code | Codex | OpenHands | Manus | Hermes Agent | **Tandem 中央 AI V1.5** | **Tandem 目标 V3** |
|---|---|---|---|---|---|---|---|---|
| 1 | **主循环** | ReAct (模型内化, 只有秒级微回路) | ReAct + reasoning trace | ReAct + AgentSkills | 长任务规划 | ReAct (LLM 层) | **4 时间尺度回路** (微/中/长/超长), 中/长/超长 齐, 微回路 single-shot | 4 回路全齐, 微回路升级 multi-step ReAct |
| 2 | **基础模型** | Claude Opus/Sonnet | GPT-5 / o-series | 任意 (LiteLLM) | Claude + 自研 | Hermes 3/4 | TAF Router 6 家 | TAF + 本地蒸馏 |
| 3 | **工具集** | 11 内置 + MCP | shell + apply_patch | bash + browser + IPython | browser-use 重 | 函数调用 (无 runtime) | 无 tool runtime (议事是 prompt-only) | MCP + Memory tool + 议事 tool + KPI tool |
| 4 | **Memory 范围** | 用户/项目/会话 | AGENTS.md + 会话 | event stream + condensation | workspace 持久 | 无 (LLM 层) | **公司/部门/团队/个人 4 层** ✅ | 4 层 + 跨会话学习 |
| 5 | **用户身份** | 单用户 | 单用户 | 单用户 | 单用户 (订阅) | N/A | **多 Persona + Steward + 治理委员会** ✅ | + 跨企业 Persona |
| 6 | **会话生命周期** | 任务即生即灭 | 任务即生即灭 | 任务即生即灭 | 持久 workspace | N/A | **永久 (Decision/Memory/Persona)** ✅ | 永久 + 版本化 |
| 7 | **安全/审计** | 文件级权限 + hooks | sandbox + 审批 | Docker 隔离 | 云端隔离 | N/A | **AuditLog + LlmUsageLog + ProxyAction 24h 否决** ✅ | + Baseline LLM 仲裁 |
| 8 | **多人协同** | ❌ | ❌ | ❌ | ❌ | ❌ | **IM 多 Persona + 议事 + Convergence** ✅ | + Multi-Agent CompanyBrain/DeptBrain |
| 9 | **跨会话学习** | ❌ (要人写 CLAUDE.md) | ❌ | ❌ | 部分 (workspace) | ❌ | **Memory 4 层 + Persona 5 阶段进化** ✅ | + Reflection loop + Distillation |
| 10 | **组织约束** | ❌ | ❌ | ❌ | ❌ | ❌ | **Baseline-Guard + 公司 Memory 注入** ✅ | + LLM 仲裁 + 自我评估 |

**判读** (Owner 2026-05-27 22:25 PT 校准后):

- 维度 **1-3** (循环/模型/工具): 个人 Agent 在秒级微回路上领先, **但 Tandem 多 3 个回路它们根本没有 (中/长/超长)**. 我们要补齐的是微回路精细化器官 (§12 器官), 不是跟它们拼 ReAct 次数
- 维度 **4-10** (Memory/身份/生命周期/审计/协同/学习/约束): **Tandem 领先**, 个人 agent 架构上做不到
- **不要再说 “Tandem 落后”** — 是不同物种, 不是弱强; 详见 `CENTRAL-AI-ARCHITECTURE.md` §二 4 时间尺度回路 + 14 器官

---

## 四、SOTA 个人 Agent 的 4 个共性约束 (天花板)

不管 Claude Code 还是 Manus, 都受这 4 个约束:

### 约束 #1: **单用户上下文**
模型上下文是当前调用者的, 没有"其他人怎么看这个问题"的视角. 即使有 multi-agent (CrewAI), 也是同一个人内部的多个角色.

### 约束 #2: **会话即生即灭**
任务结束 = 上下文丢. Manus 的"persistent workspace"是部分缓解, 但还是个人级.

### 约束 #3: **工具只面向机器**
bash / 文件 / 浏览器 — 都是操作机器. 没有"操作组织"的工具 (例: "升级这条到团队 Memory" / "邀请这 3 个人议事").

### 约束 #4: **责任主体单一**
出错 = 用户错 / AI 错. 没有"治理委员会推翻"机制. 个人 agent 不需要, 企业 agent 必须有.

---

## 五、Tandem 中央 AI 的 9 条企业级超越路径

**所有 9 条**, Claude Code / Codex / OpenHands / Manus / OpenClaw / Hermes Agent 都**架构上做不到** (除非重做), 因为它们是单用户单任务设计.

> **2026-05-27 22:13 PT 更新**: 路径 8/9 是读了一手资料 (https://openclaw.ai · https://hermes-agent.nousresearch.com · github.com/NousResearch/hermes-agent) 后**反向倒推**的: 它们做到了我们没有的 2 件事 (跨 IM 接入 + Skills 自动生成), 不补的话 Tandem IM 板块会变成"另一个飞书". 详见第十节启发分析.

### 路径 1 · 跨会话组织记忆 (Memory 4 层) ✅ 已具备

- **个人 Agent**: CLAUDE.md / AGENTS.md — 文件级, 要人维护
- **Tandem**: Memory 4 层 (personal/team/department/company) + Promotion PR 流 + Decision Card + Persona 5 阶段进化
- **状态**: 骨架已有, V1.5 加深引用图 + 自动促升

### 路径 2 · 多角色视角 (Persona × N 协作)

- **个人 Agent**: 永远是当前调用者的视角
- **Tandem**: 一个频道里多个员工 Persona 同时在场, 各自风格不同, CompanyBrain 主持
- **状态**: Persona 实体在, 多 Persona 协作待做 (IM-5)

### 路径 3 · 组织约束 (Baseline-Guard) ✅ 已具备 (V1.5 升级中)

- **个人 Agent**: 完全跟用户走, 用户说啥做啥
- **Tandem**: 调用前过 Baseline-Guard, 公司 Memory 命中 → 阻断/警告/上下文注入
- **状态**: V1.0 规则门禁完成, V1.5 加 LLM 仲裁 (CA-2 待做)

### 路径 4 · 合规审计链路 ✅ 已具备

- **个人 Agent**: 行为不留组织级痕迹
- **Tandem**: AuditLog + LlmUsageLog + ProxyAction (24h 否决) + DecisionCard
- **状态**: V1.0 完整, IM-7 trace popover 已上线

### 路径 5 · 跨人协同决策 (议事室)

- **个人 Agent**: 多人协作 = 多个人各自跑 agent, 然后人开会
- **Tandem**: 议事室 17 分钟硬上限, 3+1 决策, Convergence Orchestrator 主持, 决策卡留痕
- **状态**: V1.0 完整, V2 加 CompanyBrain 担任 "公司方代表" 在议事室

### 路径 6 · 智能迭代 (Reflection Loop) ⏳ V1.5 骨架已搭

- **个人 Agent**: 不会学习用户偏好的演进 (Claude Code 不记得"上次我说要这种风格")
- **Tandem**: CompanyBrain 每月反思 → 配置版本化 → 治理委员会签批 → 新版本生效
- **状态**: CA-13 类型 + repository 已搭 (本次会话上一轮), Decision 记录 + Metrics + Reflection 实现待补

### 路径 7 · 三方治理 (Owner / 治理委员会 / Steward / 员工)

- **个人 Agent**: 用户 ↔ AI 单向委托
- **Tandem**: 4 个角色 (Owner / 治理委员会 / Steward / 员工), 否决/升级/降级链路化, 24h 撤回窗口
- **状态**: V1.0 完整, V2 加治理委员会议事 + Memory promotion 三级签批

### 路径 8 · OKR Drift Detection (OKR 偏离检测) ⏳ V1.5 必补

- **个人 Agent**: 无 OKR 概念，无战略执行闭环
- **Tandem**: 检测 intent 是否偏离当前 OKR (不偏离→PASS, 边缘→SOFT_WARN, 远离→询问用户)
- **差异化 vs 个人 agent**: 个人 agent 没有组织目标锚定，Tandem 所有 AI 回答必须可回溯到具体 KR
- **工作量**: 1 周 (器官 #16)
- **技术实现**: `lib/skill-gateway/okr-drift.ts` — embedding 召回当前 OKR + 相似度判定

### 路径 9 · Skill Gateway 4 道闸 (技能网关) ⏳ V2-V3

- **个人 Agent (Claude Cowork)**: 4 道闸已有，但 zone 判定是调用方声明（个人主权）
- **Tandem**: 4 道闸升级为组织主权（company 红线一票否决，zone 由组织基线+委托级别定）
  - ① Baseline-Guard — 检测 intent 是否违反公司 Memory
  - ② OKR Drift Detection — 检测 intent 是否偏离当前 OKR
  - ③ Data Scope — RBAC + ownershipLevel + 组织基线判定
  - ④ Action Scope — 绿/黄/红区 + delegationLevel + 24h 否决 + ProxyAction
- **差异化 vs 个人 agent**: Cowork = 个人主权（you decide / your choice），Tandem = 组织主权（company 红线一票否决）
- **工作量**: 1-2 月 (器官 #18)
- **技术实现**: `lib/governance/governed-chat.ts` — 统一 chokepoint，串联输入闸 + LLM + 输出闸 + 动作闸

### 路径 10 · 跨 IM 接入 (Persona / CompanyBrain 在外部 IM 也能被召唤) ⏳ 未启动

- **个人 Agent (OpenClaw / Hermes)**: 已做到 — Telegram / WhatsApp / Slack / Signal / iMessage / Email / Discord 都能召唤同一个 agent
- **飞书 / 钉钉**: 做不到 — 它们的 AI 必须在自家 App 里
- **Tandem 当前**: 跟飞书一样 — 必须进 Tandem IM
- **Tandem 该做**: CompanyBrain / 员工 Persona 通过 webhook bridge 在员工**已有的** IM 渠道 (微信/飞书/钉钉/邮件) 被召唤回来. **Tandem IM 是聚合层, 不是孤岛**
- **差异化 vs 个人 agent**: 个人 agent 跨 IM 是为了"哪都能用我的 AI"; Tandem 跨 IM 是为了"员工不离开既有工作流就能享受组织 AI 能力". 召唤的不是个人助手, 是**带组织视角的 CompanyBrain / 同事的 AI 分身**
- **工作量**: 每个渠道 3-5 天 bridge 实现, 首选: 微信 (国内自用必须) + Email (异步必须) + Slack (海外预备)
- **新增到 CHARTER-FOUR-PILLARS 应为 IM-9**

### 路径 11 · Skills 自动生成 + Promotion 签批 ⏳ 未启动

- **个人 Agent (Hermes)**: "creates skills from experience, improves them during use" — AI 从经验里自动造 skill, 自我改进
- **Tandem 当前**: Memory 4 层 + promotion-flow 已有, 但 **Skills 这一层缺失** — AI 不会主动总结"这种问题我常被问, 我应该把它变成 skill"
- **Tandem 该做**: AI 自动观察 Decision Log 中的高频模式 → 生成 SkillProposal → 进 **promotion-flow** (Steward / 治理委员会签批) → 入"团队 Skills 库"
- **差异化 vs 个人 agent**: 个人 agent 的 skill 是"我的工具集"; Tandem 的 Skill 是**"组织 SOP 的可执行版"** — 入库前必须签批, 入库后是组织资产, 离职带不走
- **跟 CA-13 整合**: Skill 自动生成是 Decision 智能迭代闭环的下游产物之一. 同一套基础设施 (Decision Log + Reflection LLM) 输出两种东西: Memory 升级提议 + Skill 升级提议
- **工作量**: 1-2 周 (复用 promotion-flow + reflection 模板)

---

## 六、Tandem 现在缺什么 (个人 agent 反过来比我们强的地方)

诚实说: 上面 9 条 Tandem 都领先, 但**前 4 个维度个人 agent 比我们强**:

| 维度 | 个人 Agent 现状 | Tandem 现状 | Tandem 该不该补 |
|---|---|---|---|
| **微回路精细化** (multi-step ReAct) | ✅ 标配 | 🟡 微回路 single-shot, 中/长/超长完整 | **补 器官 #12** (V2-CA-5) |
| **Tool calling runtime** | ✅ 11 个工具 + MCP | ❌ 无 | **该补** (V2-CA-6/7) |
| **长任务规划** | ✅ Manus 小时级 | ❌ 一次议事 17 分钟 | **不补** (议事 17min 是产品设计选择, 跟 Manus 长任务定位不同) |
| **Browser-use** | ✅ Manus / OpenHands 强 | ❌ 无 | **可选** (B-002 MCP 可接 puppeteer) |

**优先级**:

1. **真 Agent Loop** — V2 CA-5 (议事 multi-step reasoning) → 接入 Mastra (TS 原生) 或 LangGraph
2. **Tool calling runtime** — V2 CA-6 (MCP) + CA-7 (完整 tool calling 接入)
3. **CompanyBrain Decision 记录闭环** — V1.5 (本次会话上一轮已搭骨架, 这周可完成)

---

## 七、立即可动的 3 项 (V1.5 这周)

按 ROI 排序:

### ① CompanyBrain Decision 闭环完成 (8-12h, 最高 ROI)

**为什么**: 没有 Decision 记录, 智能迭代是空话.

**做什么**:
- 上一轮搭好的类型 + Repository (`lib/types/company-brain.ts`, store 注册)
- 本轮补完 `lib/persona/company-brain-decision.ts` (recordDecision / setFeedback / listDecisions / markStaleDecisionsIgnored) ✅ 已完成
- 本轮补完 `lib/persona/company-brain-metrics.ts` (聚合指标 + 失败模式) ✅ 已完成
- **待做**: `lib/persona/company-brain-reflection.ts` (LLM 自评 + 提议配置)
- **待做**: invokeCompanyBrainReply 写 Decision 记录
- **待做**: API (`/api/admin/company-brain/decisions`, `/api/admin/company-brain/metrics`, POST `/feedback`)
- **待做**: 简易 `/admin/company-brain` UI 看板

### ② Baseline-Guard 灰区 LLM 仲裁 (CA-2, 1 周)

**为什么**: 个人 agent 没有组织约束, 这是 Tandem 最大差异化. 灰区 0.2-0.45 调 CompanyBrain LLM 仲裁后, 误判率立竿见影下降.

**做什么**:
- baseline-guard.ts 灰区分支调 `companyBrainArbitrate(intent, hits)`
- companyBrainArbitrate 调 `claude-opus-4-5`, 输出 `verdict: HARD_BLOCK | SOFT_WARN | PASS` + 理由
- 把每次仲裁记成 `CompanyBrainDecision(context='baseline_arbitration')`, 进入 Decision 闭环

### ③ 议事室 multi-step reasoning (CA-5, 1 个月) — **补 Agent 器官 #12**

**为什么**: 微回路精细化. 议事当前压缩在一个 prompt, 升级后拆为 [Memory 召回 → 历史决策回顾 → 风险 → 利益相关人 → 时机 → 选项] N 个 subagent. **不是“才成为 Agent”**, 是 Agent 主循环器官变精细.

**做什么**:
- 接入 Mastra (TS 原生, Next.js 兼容好) 作为 agent-runtime
- 议事室触发后: Memory 召回 → 历史决策回顾 → 风险评估 → 利益相关人识别 → 时机判断 → 选项生成
- 每步是一个 agent step, 整体可暂停 / 可观测 / 可重放

---

## 八、研究结论 · 三句话 (Owner 2026-05-27 22:25 PT 校准后)

**第一句**: Tandem 中央 AI 是**企业级 Agent (Organizational Agent)** — 跟 Claude Code/Codex/OpenHands/Manus 不是同物种. 我们不是它们的升级版, 是高一个维度的 Agent (多时间尺度 + 多人协同 + 可治理 + 可自迭代).

**第二句**: 护城河不是“比个人 agent 智能高”, 是**“个人 agent 架构上做不到的 9 件组织级事情, Tandem 现在做到了 7 件半 (器官完整度 11/14)”**. 详见 `CENTRAL-AI-ARCHITECTURE.md` §三 评分.

**第三句**: 这周补 Agent 器官 #11 完整实现 (CompanyBrain Decision 闭环, 4-5h), 一周后补器官 #3 加深 (Baseline LLM 仲裁), 一个月后补器官 #12 (议事 multi-step). **不是“V1.5 才有 Agent” — Agent 一直在, 我们在补它缺的 3 件器官**.

---

## 九、跟其他文档的关系

| 文档 | 关系 |
|---|---|
| `CENTRAL-AI-ARCHITECTURE.md` | **本文档是对标层**, 它是状态/演进层. 本文档把"为什么演进成那样"的对标依据补全 |
| `CHARTER-FOUR-PILLARS.md` | 4 板块超越宪章, 跟本文档的"9 条企业级路径"对齐. 路径 8 (跨 IM 接入) 应同步登记为 IM-9 |
| `MANIFESTO.md` | 第十六条 TAF — 本文档是 TAF 在 agent 维度的延伸 |
| `SUMMON-AND-NURTURE.md` | 拿捏/搭子双范式 + CompanyBrain 第三范式 (组织 Persona), 跟本文档的"多角色视角"路径对应 |
| `AI-BACKLOG.md` | CA-5 / CA-6 / CA-7 / CA-13 等 CompanyBrain 智能迭代条目, 该归到 backlog |

---

## 十、OpenClaw + Hermes Agent 深度启发 (基于 2026-05-27 22:10 PT 一手 URL 资料)

> **来源**: Owner 直接给出 3 个 URL, Cascade 用 read_url_content 拉取了一手内容. 全部下述启发来自原文摘录, 不是猜测.
>
> 关系: **OpenClaw → Hermes Agent** — 同血脉, Hermes 提供 `hermes claw migrate` 完整迁移工具 (SOUL.md / MEMORY.md / USER.md / skills / allowlist / API keys). OpenClaw 创始人 Peter Steinberger 已加入 OpenAI.

### 启发 ① · "Built-in Learning Loop" 是它们的核心卖点

**Hermes Agent 自我介绍原话**:

> "The only agent with a built-in learning loop — it creates skills **from experience**, improves them **during use**, **nudges itself** to persist knowledge, **searches its own past conversations**, and builds a **deepening model of who you are across sessions**."

**Tandem 对照表**:

| Hermes Agent 能力 | Tandem 现状 |
|---|---|
| Creates skills from experience | ❌ **缺** — Decision Log 已有, 但没有"AI 自动生成 Skill 加入工具集" |
| Improves them during use | 🟡 部分 — Memory 升级 PR 流有, Skill 改进未做 |
| Nudges itself to persist | 🟡 部分 — Memory 4 层有, 但是被动 promotion |
| Searches own past conversations | ✅ 已有 (Memory retriever) |
| Deepening model across sessions | ✅ 已有 (Persona 5 阶段 + CompanyBrain) |

**关键差距**: Skill 自动生成 → 进 promotion-flow 签批. **复用现有 promotion-flow 基础设施**即可, 1-2 周可落地.

### 启发 ② · "Any Chat App" 跨 IM 接入 = 飞书的最大软肋

两个 agent 都支持 **Telegram / Discord / Slack / WhatsApp / Signal / iMessage / Email / CLI**.

哲学对比:

| | 自己 App 必须 | 跨 IM 召唤 |
|---|---|---|
| OpenClaw / Hermes Agent | ❌ | ✅ |
| 飞书 / 钉钉 / Slack | ✅ (强迫用户进入) | ❌ |
| Tandem (当前) | ✅ (跟飞书一样) | ❌ |
| **Tandem (路径 8 后)** | ❌ | ✅ |

**这跟 CHARTER-FOUR-PILLARS § 三 IM 板块直接冲突**: 我们说"IM 要超越飞书", 但只在自家 IM 内做就只是另一个飞书. 真正超越是:

> **Tandem CompanyBrain / 员工 Persona 可以在员工已有 IM (微信/飞书/邮件) 被召唤, Tandem 自己的 IM 是聚合层而非孤岛**

**已在路径 8 落实** (本次会话新增 § 五 路径 8).

### 启发 ③ · Skills 是文件协议 + 社区生态 (agentskills.io)

**Hermes 文件结构**:

```
~/.hermes/
  ├── SOUL.md                       ← persona 定义
  ├── MEMORY.md / USER.md           ← 记忆条目
  ├── AGENTS.md                     ← workspace 指令 (跟 CLAUDE.md 一类)
  ├── skills/
  │     ├── openclaw-imports/       ← 从 OpenClaw 迁来
  │     ├── community/              ← agentskills.io 拉的
  │     └── custom/                 ← AI 自己写的
  └── allowlist                     ← 命令批准模式
```

**Tandem 该做 (不是抄, 是改造为组织版)**:

- Tandem Skill ≠ Hermes Skill 的"个人工具集"
- Tandem Skill = **组织 SOP 的可执行版** — 入库前必须 promotion 签批, 入库后是组织资产, 离职带不走
- **不做 marketplace** — 自用阶段不需要; 长远可做企业内部 Skill 库 (跨部门复用)
- **已在路径 9 落实** (本次会话新增 § 五 路径 9)

### 启发 ④ · 5 种 backend (Local/Docker/SSH/Singularity/Modal) — 部署灵活性

Hermes Agent: "Run it on a **$5 VPS**, a **GPU cluster**, or **serverless infrastructure** that costs nearly nothing when idle"

**Tandem 当前**: Next.js 单体, 部署到一台服务器.

**V3 演进方向**:

- CompanyBrain 跑在 **idle-friendly serverless** (它的工作是间歇性的 — 议事/仲裁/反思)
- IM/文档/日历 跑在常驻服务器 (实时性要求高)
- 不是今晚要做, 是 V3 架构演进的方向

### 启发 ⑤ · 文件协议导出 (SOUL.md / MEMORY.md 是给人看的)

**对比**:

| | 数据存哪 | 员工/Owner 可读吗 |
|---|---|---|
| Hermes Agent | `~/.hermes/*.md` 文件 | ✅ 任意编辑器, git 备份 |
| Tandem | PG 数据库 (Memory/Persona table) | ❌ 必须进 admin UI |

**Tandem 该做**: 提供导出命令

```bash
npx tandem export-memory --user=alice --output=./mem-bundle/
# → ./mem-bundle/
#     SOUL.md           (alice 的 Persona)
#     MEMORY-personal.md (alice 的个人 Memory)
#     MEMORY-team.md     (alice 可见的团队 Memory)
#     ...
```

**意义**: 这是 **MANIFESTO 第十三条 "数据归员工" 的具体落地**. 员工任何时候能离线 review + git 备份自己的 Memory, 增强信任.

**工作量**: 半天, V1.5 可做.

### 启发 ⑥ · Isolated Subagents with Python RPC

**Hermes 描述**:

> "Isolated subagents with their own conversations, terminals, and **Python RPC scripts** for zero-context-cost pipelines"

比 Claude Code 的 Task tool 更进一步: subagent **不仅是 LLM 调用, 也可以是脚本**. "Zero-context-cost" = 不消耗主 agent 上下文.

**Tandem V2 议事 multi-step reasoning (CA-5) 该采用**:

- 议事每一步 = 一个 subagent
- subagent 可以是:
  - LLM 调用 (Memory 召回 / 选项生成 / 风险评估)
  - **脚本调用** (跑 SQL 查 KPI / 调 OKR 服务 / 拉历史决策 cards)
- 主议事 agent 只看 subagent 的总结输出, 不看中间过程

**架构启示**: Tandem 的 agent runtime (无论选 Mastra / LangGraph / 自研) 必须支持**"subagent 可以是任意可调用 (LLM 或脚本)"**, 不要绑死 LLM-only.

### 启发汇总 · 对 Tandem 的冲击 (一句话)

> 我们之前把 OpenClaw / Hermes 当做**个人 agent 竞品**忽略了, 实际它们已经把"持久学习内部机制"做到极致 (Hermes 自称 "the only agent with a built-in learning loop"). Tandem 在**组织级**领先, 但如果不学它们的"自我生成 Skill / 跨 IM 召唤 / 文件级数据导出"这 3 件**架构级机制**, Tandem 中央 AI 会变成"很慢但有原则"的组织 AI — 而不是"既有原则又越用越聪明又无所不在".

---

## 十一、修订记录

| 日期 | 作者 | 修订内容 |
|---|---|---|
| 2026-05-27 PT 22:00 | Owner 提问 / Cascade 起草 | 首版: 5 个 SOTA agent 拆解 + 10 维对标 + 7 条企业级路径 + 3 项 V1.5 推荐 |
| 2026-05-27 PT 22:30 | Owner 给出一手 URL / Cascade 拉取分析 | 升级 7 → 9 条企业级超越路径 (新增跨 IM 接入 + Skills 自动生成); 新增 § 十 "OpenClaw + Hermes Agent 深度启发" (6 条启发, 全部基于一手资料而非猜测) |
| 2026-05-27 PT 22:45 | Owner 重大校准 | 否定"组件集合 / Tandem 落后 / Single-shot 矮化"叙事. **Tandem 是企业级 Agent, 跟个人 agent 不同物种**. § 三 对标表判读 + § 六 维度 + § 七 ③ + § 八 三句话 全部按"4 时间尺度回路 + 14 器官"框架重写, 跟 `CENTRAL-AI-ARCHITECTURE.md` § 二 一致 |
