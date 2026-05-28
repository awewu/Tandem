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
