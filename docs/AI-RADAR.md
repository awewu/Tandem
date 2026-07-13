# Tandem · AI 行业雷达

> **每月 30 分钟更新一次**。把过去 30 天值得我们关注的 AI 业界变化记录在这里。
> 不是科技博客，不追求全面 — 只记**对 Tandem 用户/架构有潜在影响的**。
>
> 用法：每月最后一个周五，开 30 分钟 timer。扫一遍 4 个层级，每层最多记 3 个。
> 看完决定哪些进 `AI-BACKLOG.md`，哪些直接丢。
>
> 协作文档: `ROADMAP-AI.md` (策略框架) · `AI-BACKLOG.md` (能力漏斗)

---

## 雷达 4 层 · 信号源订阅清单

### L1 · 模型层（每周扫一次，5 分钟）

订阅这些直接看 release notes，不看博客解读：

- <https://platform.openai.com/docs/changelog> · OpenAI changelog
- <https://docs.anthropic.com/en/release-notes/api> · Anthropic API release notes
- <https://api-docs.deepseek.com> · DeepSeek 文档（出新模型会更新）
- <https://ai.google.dev/gemini-api/docs/changelog> · Gemini 官方
- <https://huggingface.co/models?sort=trending> · HF trending（看开源动向）
- <https://lmarena.ai/?leaderboard> · 排行榜（看真实能力，不看 PR 稿）

### L2 · 能力层（每月扫一次，10 分钟）

- <https://platform.openai.com/docs/cookbook> · OpenAI Cookbook（新能力示范）
- <https://docs.anthropic.com/en/docs/claude-cookbooks> · Anthropic Cookbook
- <https://github.com/openai/openai-python/releases> · SDK 更新带出能力变化
- 各家 official Twitter/X · 但只关注 official 账号

### L3 · 范式层（每季度扫一次，15 分钟）

- <https://github.com/modelcontextprotocol/specification> · MCP 协议规范
- <https://github.com/google/A2A> · A2A 协议（如确实推开）
- <https://github.com/langchain-ai/langgraph/releases> · LangGraph
- <https://github.com/microsoft/autogen/releases> · AutoGen
- <https://github.com/mastra-ai/mastra> · Mastra

### L4 · 应用层（每季度扫一次，15 分钟）

- ChatGPT / Claude / Gemini consumer app changelog
- Notion AI / Linear AI / Granola 产品博客
- 钉钉 / 飞书 AI 助手公开发布会
- Cursor / Claude Code / Windsurf 更新（看 AI 编程协作的认知变化）

---

## 月度报告模板

每月新建一个 ## 段，按下面模板填。**不要超过一页**，超过说明你没在筛选。

```markdown
## YYYY-MM 月报

**扫描人**: <name>  
**用时**: <minutes>  
**总结一句话**: <这个月对 Tandem 影响最大的一件事>

### L1 模型层
- **<事件>** (<日期>) — <影响判断: 高/中/低/无>。<1 句话动作>
  - 来源: <link>

### L2 能力层
- ...

### L3 范式层
- ...

### L4 应用层
- ...

### 本月动作
- [ ] <action 1, 进 backlog 或直接做>
- [ ] <action 2>
```

---

## 2026-07 月报（H1 2026 追赶版 · 联网刷新）

**扫描人**: Tandem Owner + Cascade（联网检索）
**用时**: 40 分钟
**总结一句话**: H1 2026 是"能力收敛 + 1M 上下文白菜价 + agent loop 成为 API 原生原语"的分水岭 —— 单纯"会推理/会调工具"已被模型层商品化，Tandem 的护城河进一步被逼到**组织级治理 + 会进化的分身 + 四层签批知识**这三条命脉上。
**证据边界**: 下述版本/跑分来自公开报道与第三方榜单（futurumgroup / digitalapplied / tesorb / presenc 等），**具体以各官方文档为准**；国内模型另有 china-flagship 专题待补。

### L1 模型层（2026 H1 已发生）

- **OpenAI GPT-5.5 "Spud"** (2026-04-23) — **影响: 高**。首个全重训基座 + omnimodal，**agent-first** 定位；Terminal-Bench 2.0 82.7%（agentic 终端 SOTA），1M 上下文；**Codex 升级为通用 computer-use agent**，同日上 GitHub Copilot/Cursor/AWS。动作: 我们 `agentic` 场景可评估其为 tool-loop 主力候选。
- **Anthropic Claude Opus 4.7** (2026-04-16) — **影响: 高**。SWE-bench Pro 64.3% / SWE-bench Verified 87.6%，新增 task budgets / `/ultrareview` / Auto 模式；~6 周点发布节奏 + 向后兼容 API。另有 **Claude Mythos**（gated 网安预览）与传闻中的 Opus 5/Claude 5（7 月前概率高）。**坑**: 新 tokenizer 同输入多产 ~35% token，成本口径要复核。
- **Google Gemini 3.1 Pro / Deep Think** — **影响: 中**。GPQA Diamond 94.3%（科学推理 SOTA），1M 上下文默认；推出 **Antigravity** agent 平台 + Gemini CLI。国内不稳定，V2 国际化再评估。
- **DeepSeek V4 (Flash/Pro)** (2026-04-24) — **影响: 高**。~1.6T MoE、1M 上下文、**开源**；V4-Flash 输出 **$0.28/1M**（价格地板），**华为 Ascend 950 day-zero 适配**。动作: 复核我们 DeepSeek provider 版本，**自托管/国产化路线成本骤降**（呼应 B-009）。
- **格局判读**: 前沿"五分天下"—— Anthropic(编码) / OpenAI(agentic 终端) / Google(科学推理) / xAI(2M 上下文) / DeepSeek(成本)，**无单一模型全赢**。5 月起转季度节奏。国内 GLM-5.1(8h 长任务)/MiniMax M2.7(自进化)/Kimi K2.6(最快开源 SOTA) 已属前沿级。

### L2 能力层

- **Reasoning-effort 路由成默认控制面** — **影响: 高**。各家都有推理档位旋钮。动作: 复核 TAF `reasoning_complex`/`agentic` 是否显式吃推理档（议事 3+1、灰区仲裁、B-024 归因应吃满）。
- **1M 上下文经济化 + agent loop 成 API 原生** — **影响: 高**。团队不再自己写 scaffold。动作: 复评 B-006（长上下文，从"观察"升"待评估"）；tool-loop 底座对齐原生 agent 语义。
- **structured outputs 生产级可靠** — **影响: 中**。呼应既有 B-004，应推广到所有 LLM 调用点。

### L3 范式层

- **企业 agent 平台 → "operational control plane"**（Futurum）— **影响: 高**。Microsoft/Salesforce/ServiceNow 领跑，Palantir/SAP/UiPath 跟进。这正是 Tandem 中央 AI 的同侪层。动作: 见 `CENTRAL-AI-ENTERPRISE-EDGE.md` 新增"企业级同侪对标"章节。
- **permission-aware 知识图谱**（Glean ARR 翻倍到 $200M，$7.2B 估值，与 Copilot 争企业知识主权）— **影响: 高**。检索携带权限 + 图谱关系。动作: **执行链 C — B-013 GraphRAG 从"观察"升"待评估"**（我们决策防火墙已解权限隔离，缺图谱化）。
- **生产级 agent 标配 SOC2 / SSO / audit log / human-in-the-loop**（Sierra/Agentforce/Copilot Studio/Lindy）— **影响: 中**。印证治理/护栏是企业成交前提。动作: 把 Tandem 4 闸 + 24h 否决 + 决策防火墙**变成对外卖点**（登记 backlog）。

### L4 应用层

- **Codex / Claude Code / Antigravity 代理式开发普及** — **影响: 低（间接）**。"AI 同事"认知红利继续利好 Persona/Skill 范式。
- **飞书/钉钉 AI 助手深化** — **影响: 中**。"员工不搬家"仍是软肋 → 呼应路径 10 跨 IM（登记 backlog）。

### 本月动作

- [x] 联网刷新雷达至 H1 2026（本报告）
- [x] `CENTRAL-AI-ENTERPRISE-EDGE.md` 增补"企业级同侪对标"章节
- [x] 7 条该吸收优点登记进 `AI-BACKLOG.md`（B-013 升级 + B-033~B-036 新建）
- [ ] 执行链 C：B-013 GraphRAG 记忆升级（同时命中行业优点 #2 图谱检索 + #3 真学习底料）
- [ ] 复核 TAF provider 版本口径（GPT-5.5 / Opus 4.7 / DeepSeek V4）与 reasoning 档位映射

---

## 2026-05 月报（初版示例 · 由首次建档时填入）

**扫描人**: Tandem Owner + Cascade  
**用时**: 30 分钟（首次建档，回顾过去半年）  
**总结一句话**: MCP 协议标准化已成事实，agent runtime 抽象层是下个季度的重点投入

### L1 模型层（过去 6 个月已发生）

- **DeepSeek-V3 / R1** (2024-12 / 2025-01) — **影响: 高**。已是 Tandem 主力 provider，性价比无敌。R1 推理模型可单独接入用于 OKR 推演 / 决策辅助
  - 进 backlog: `B-001 DeepSeek-R1 接入用于 convergence 推演`
- **Claude 3.7 Sonnet → Claude 4** (2025) — **影响: 中**。已接入。长 thinking mode 适合议事决策长上下文，可考虑作为 convergence 模块的可选 provider
- **GPT-4.1 / o3-mini** (2025) — **影响: 低**。已接入 OpenAI adapter。国内访问受限，主要为国际化 V2 阶段保留
- **Gemini 2.0 / 2.5** (2025) — **影响: 中**。1M+ context + 多模态 + 便宜，但国内不稳定。等 V2 国际化阶段评估
- **Qwen 2.5 / 3** (阿里, 2025) — **影响: 中**。国内自主可控备选，pricing 友好。**进 backlog 评估**

### L2 能力层

- **Anthropic Computer Use** (2024-10) — **影响: 低**。让 agent 自动操作浏览器/桌面。Tandem 当前用户场景（OKR / 协作）不需要，**丢**
- **OpenAI Realtime API** (2024-10) — **影响: 中**。语音 agent。一对一 Coach 场景未来可能，**进 backlog 观察**
- **Anthropic Prompt Caching** (2024-08) — **影响: 高**。长 system prompt 自动缓存，成本砍 90%。Tandem 的 persona 系统 prompt 可大量受益。**进 backlog**
- **OpenAI Structured Outputs / JSON Schema 强约束** (2024-08) — **影响: 高**。可消灭一大批 JSON parse 报错。**已部分使用**，应推广到所有 LLM 调用点
- **长上下文 1M+ tokens** (Gemini 2 / Claude) — **影响: 中**。议事记录归档 / 跨年度 OKR 回溯有价值。**进 backlog**

### L3 范式层

- **MCP (Model Context Protocol)** (Anthropic, 2024-11) — **影响: 极高**。已成 Anthropic + OpenAI 共推的工具协议事实标准。Tandem 应该尽快重构 `lib/tools/` 兼容 MCP，未来直接享受第三方工具生态
  - **进 backlog 高优**: `B-002 lib/tools/ MCP 化`
- **A2A (Agent-to-Agent Protocol)** (Google, 2025) — **影响: 待定**。多 agent 互通协议，目前采纳度不明，**观察 6 个月再决定**
- **LangGraph 0.2+** (2024) — **影响: 中**。state machine 化的 agent。当前 Hermes 是命令式实现，长期可能受益。**进 backlog 观察**
- **Agentic RAG / GraphRAG** — **影响: 中**。比 vanilla RAG 显著好。Tandem 的 Memory 系统未来可升级，**进 backlog**

### L4 应用层

- **ChatGPT Memory + Projects** (2024) — **影响: 低**。consumer 个人助手范式，Tandem 是企业协作不重叠
- **Notion AI Q&A** — **影响: 中**。"问你的工作空间"是企业用户已被教育的范式。Tandem 的知识架构应该有等价能力（4 层知识架构 docs 已规划），**确保 V2 上线**
- **钉钉 / 飞书 AI 助手** — **影响: 中**。国内企业用户认知"AI 帮我开会/写周报"已建立。Tandem 的 1on1 + 议事决策模块要让用户感知到 AI 价值
- **Cursor / Claude Code 编程协作普及** — **影响: 低（间接）**。开发者侧普及 → "AI 同事"概念被接受 → 对 Tandem 的 Persona / Skill 范式是认知红利

### 本月动作

- [x] 建立 ROADMAP-AI.md / AI-RADAR.md / AI-BACKLOG.md 三件套
- [ ] 把上述判断同步到 `AI-BACKLOG.md`（B-001 ~ B-008 已建条目）
- [ ] Phase 2 工作：补 `LlmUsageLog` schema + 埋点
- [ ] Phase 3 工作：拆 `lib/agent-runtime/` adapter 层

---

## 历史月报（按时间倒序新建）

<!-- 每月在此上方插入新月报 -->

<!--
## 2026-06 月报
...
-->

---

## 速查：判断"影响"等级

| 等级 | 判断标准 |
|---|---|
| **极高** | 不做的话 6 个月内会被竞品甩开 |
| **高** | 解我们用户当前抱怨的真实问题 |
| **中** | 进 backlog 季度评估，不急 |
| **低** | 知道一下，不动手 |
| **无** | 跟我们无关，记一行存档防忘 |

## 速查：何时丢，何时记

- **丢**: 跟我们用户场景无关 / 一年内会过气 / 还没有可用 SDK
- **记**: 跟核心架构相关 / 协议层面的标准 / 直接竞品的产品动作
