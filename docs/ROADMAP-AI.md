# Tandem · AI 演进路线图

> 这份文档**不**讲 Tandem 的产品功能时间表（那个在 `ROADMAP.md`）。  
> 这份文档讲：**AI 行业每天都在变，我们怎么持续吸收新能力，还不被噪音淹没、不被空话忽悠**。
>
> 版本: v1.0 · 最后更新: 2026-05  
> 负责人: 产品 Owner + 流动 AI 协作者  
> 协作文档: `AI-RADAR.md` (信号扫描) · `AI-BACKLOG.md` (能力漏斗) · `AI-SETUP.md` (Provider 接入)

---

## 一、为什么需要这份文档

AI 行业的特点：

- **变化太快**：每周都有"震惊业界"的发布，绝大部分 6 个月后就被遗忘
- **概念漂浮**：MCP / A2A / agent / tool use 被滥用，真伪难辨
- **决策容易拍脑袋**：看到新东西就想做，最后做了 5 个 demo 没一个上线
- **用户/老板会问**："这个 ChatGPT 新功能我们什么时候有？" — 没框架就只能尬聊

**我们的目标**：把 AI 行业变化变成一个**有节律的输入流**，而不是焦虑的浪潮。

---

## 二、AI 雷达：4 层信号模型

不是所有 AI 新闻都该被同等对待。按"距离我们产品的远近"分 4 层，用不同频率扫描：

| 层 | 关注内容 | 扫描频率 | 谁该关注 | 主要来源 |
|---|---|---|---|---|
| **L1 · 模型层** | 新 base model 发布、能力 benchmark | 每周 | 工程 | OpenAI / Anthropic / DeepSeek / Google / Meta 官方；HF trending |
| **L2 · 能力层** | 新模态、Tool use、长上下文、Realtime | 每月 | 产品 + 工程 | LMArena、各家 cookbook、GitHub trending |
| **L3 · 范式层** | Agent 协议、新 framework、新 RAG/memory 范式 | 每季度 | 架构 | MCP / A2A / LangGraph / AutoGen 主仓库 release notes |
| **L4 · 应用层** | 竞品做了什么、用户认知怎么变 | 每季度 | 产品 | Notion AI / ChatGPT Team / Linear AI / 钉钉飞书 changelog |

操作产物：

- `AI-RADAR.md` — 月报，每月 30 分钟更新一次
- `AI-BACKLOG.md` — 漏斗，每季度 review 一次

---

## 三、4 道闸门：从信号到代码的漏斗

每发现一个新能力，按这 4 个问题逐次过滤。**任何一个否，进 backlog 但不动手做**：

```
┌─────────────────────────────┐
│  雷达扫到一个新能力 / 模型    │
└─────────────┬───────────────┘
              ↓
       ① 解我们用户的真实痛点吗?
              ↓ Yes
       ② 半小时内能搭 PoC 吗?
              ↓ Yes
       ③ 接进现架构 ≤ 100 行?
              ↓ Yes
       ④ 增量价值 > 维护成本?
              ↓ Yes
       ✅ 进 sprint
```

**绝大多数 AI 新闻会卡在 ①** —— 不要为了"跟上潮流"做不解决用户问题的功能。

---

## 四、4 种迭代节奏（Cadence）

不同类型的 AI 变化用不同响应速度：

| Cadence | 谁触发 | 响应时间 | 代表动作 |
|---|---|---|---|
| **🔥 Hot patch** (48h) | 上游 provider 故障 / 安全漏洞 | 当天 | TAF Router 自动切备用 provider；prompt 快速修复 |
| **🚀 Sprint** (2-4 周) | 新模型发布且明显更优 | 2 周内 | 接入 + 灰度 5% 用户 + 对比指标 |
| **♻️ Release** (季度) | 新范式（如 MCP）成主流 | 1-3 月 | 架构层重构（如 tools 注册表） |
| **🧬 Pivot** (年度) | 产品定位 / 商业模式 / 数据架构变 | 半年-1 年 | 多租户化 / 新 agent runtime 切换 |

---

## 五、代码层面的"AI-Ready"清单

让代码本身能优雅吸收新能力。打 ✅ 的是已有的，打 🔲 的是该补的。

### 已有（你已经做对了）

- ✅ **TAF Router** (`lib/llm-router/`) — LLM provider 抽象层，新模型 = 新 adapter
- ✅ **Persona / Skill / Agent 三件套** — 把 agent 能力分层，可独立演进
- ✅ **SSE 流式协议** (`/api/llm-stream`) — 已支持 streaming，新 provider streaming format = 改 parser
- ✅ **DeepSeek + Anthropic + OpenAI 多 provider 已并存** — 切换零风险

### 该补（按优先级）

- 🔲 **`agent-runtime/` adapter 层**（计划 Phase 3）  
  当前 `lib/hermes-api.ts` 直接耦合 Hermes CLI。拆出 contract + adapter 后，将来 Hermes 升级 / 换 langchain / 换自研 都是改一个文件
  
- 🔲 **`LlmUsageLog` 表 + `/admin/llm-cost` 报表**（计划 Phase 2）  
  目前 LLM 调用是黑盒，没数据评估"换模型值不值"。补完后所有"接新 provider"的决定都有 benchmark
  
- 🔲 **`lib/tools/` MCP-compatible 工具注册表**  
  Anthropic 推的 Model Context Protocol 已成事实标准。提前对齐 → 将来接入第三方工具市场是配置题不是开发题
  
- 🔲 **Prompt 版本化** (`lib/prompts/v{n}/`)  
  当前 prompt 散在各路由里。集中 + 版本化后，A/B 测试不同 prompt + 用 `LlmUsageLog` 对比效果
  
- 🔲 **Eval harness** (`tests/llm-eval/`)  
  目前 LLM 改动靠人工肉眼测。建一组固定 input + 期望 output 的回归集，每次换模型 / 改 prompt 跑一次，质量回退能感知到

---

## 六、3 年视野（粗放）

这部分故意不写细——AI 行业 1 年都看不远，3 年纯属示意：

### Year 1（基建期）

把"工程基础设施 D"拉到 B。让项目你不在也能正常跑：

- CI / 自动化测试 gating
- ADR (Architecture Decision Records) 持续累积
- LlmUsageLog + agent-runtime adapter（前面的 🔲）
- 试用用户反馈循环建立

### Year 2（产品成熟期）

让 Tandem 从"内部工具"长成"产品"：

- 多租户 / 订阅 / 企业 SSO
- Agent 自演化（用户使用数据 → 改善他们的 persona）
- 移动 first 体验重做
- 国际化 i18n
- 第三方工具 / Skill 市场雏形

### Year 3（变形期）

这阶段你已经有真实用户和数据：

- 跨 LLM 智能路由（按 task 自动选 provider）
- 用户数据主权 + GDPR-ready
- 跟 Hermes runtime 完全解耦（如果方向冲突，能干净换底座）
- 插件 / 扩展生态（开发者写 agent 卖给企业用户）

---

## 七、跟未来 AI 协作者（包括"下个我"）的契约

我（Claude）作为流动协作者，每次 session 记忆 reset。让协作可持续，**对 AI 友好的代码 = 对未来同事友好的代码**：

| 该做 | 为什么 |
|---|---|
| 每个有取舍的决定写一篇 ADR (`docs/adr/NNNN-title.md`) | 半年后再看不用问"为什么这么写" |
| PR description 写人话 + 动机 + 影响面 | 我下次回来 30 秒理解 why |
| 测试覆盖 lib/ 核心模块 | 我重构时不会无意改坏 |
| 关键模块顶部写 1 段 doc-comment 说"这是干什么的 / 跟谁交互" | 不用读 1000 行才理解一个文件 |
| 每月更新 `AI-RADAR.md` 30 分钟 | 我读一眼就知道当前业界状态，不浪费时间猜 |

---

## 八、回顾 + 调整节奏

**每月**：更新 `AI-RADAR.md`，把上月扫到的信号填进去  
**每季度**：review `AI-BACKLOG.md`，用 4 道闸门重新打分，调整优先级  
**每半年**：回看本文档（ROADMAP-AI.md），看 3 年视野是否要调  
**每次大版本**：写一篇 ADR 总结这次架构变化的 why

---

## 附录：常见误区

| 误区 | 真相 |
|---|---|
| "X 模型出了，我们必须接！" | 99% 的"必须"经不起 4 道闸门，先进 backlog |
| "MCP/A2A 是未来，要全押" | 协议标准化要看采纳度。GPT/Claude/Gemini 至少 2 家公开支持再动 |
| "Agent framework X 开源了 8k star，我们换吧" | star 不等于成熟。看 issue 关闭率 + breaking changes 频率，等半年再说 |
| "用户问什么时候有 ChatGPT 新功能" | 真问题是"用户希望解决什么"，不是"用户希望我们抄什么" |
| "成本太贵，换便宜的" | 没 `LlmUsageLog` 数据就是拍脑袋。先有数据再决策 |

---

## 索引

- 想看产品功能时间表 → `docs/ROADMAP.md`
- 想看本月业内信号 → `docs/AI-RADAR.md`
- 想看待评估能力清单 → `docs/AI-BACKLOG.md`
- 想接入新 LLM provider → `docs/AI-SETUP.md`
- 想看技术宪章 → `docs/CHARTER-TECH-v2.md`
- 想看产品精神 → `docs/PRODUCT-SPIRIT.md`
