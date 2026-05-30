# Tandem Agent Framework (TAF) · 牛马搭子智能编排框架

> **「LLM 是燃料, TAF 是引擎. 不养自己的模型, 养自己的协议.」**
>
> 版本: v1.0
> 最后更新: 2026-05
> 性质: 牛马搭子核心技术资产文档. 与 MANIFESTO 第十六条对应.

---

## 摘要 (TL;DR)

TAF (Tandem Agent Framework) 是牛马搭子的**智能编排引擎**, 其核心设计原则:

```
✅ LLM 可热插拔  (DeepSeek / Qwen / Hermes / Doubao 自由切换)
✅ 协议层固化   (3+1 决策 / 议事室 / Decision Card 不动)
✅ 跟随 Hermes  (协议 + 代码 + 方法论持续吸纳, 不依赖 Hermes 模型权重)
✅ 多模型路由   (按场景 / 成本 / 延迟自动选择)
✅ MCP 接入     (Anthropic 工具协议生态)
```

**真正的护城河**: 不在底层模型, 不在某个具体功能, **在 TAF 协议层 + Tandem 状态机**.

---

## 第一章: 哲学

### 1.1 三种 Agent 路径的对比

| 路径 | 代表 | 命运 |
|---|---|---|
| **押注单一模型** | 早期 ChatGPT 套壳产品 | GPT-4 → Claude 切换时全部死亡 |
| **自训基座模型** | 大量大厂 / 巨额投入 | 烧钱不止, ROI 难证, 中小创业死路 |
| **协议 + 编排为王** | Cline / Cursor / 我们 | LLM 进化 = 我们获益, 反脆弱 |

牛马搭子选**第三条**: **协议层是我们的, LLM 谁好用谁来**.

### 1.2 标杆参照

```
🛠 Cline (开源编程 Agent)
   • Provider Abstraction → 我们抄
   • Plan/Act 模式分离 → 我们抄
   • Approval-based Tool Use → 我们抄
   • Streaming + Interrupt → 我们抄
   • MCP 接入 → 我们抄

🔧 Nous Hermes (开源 Agent 训练范式)
   • Function Calling 格式 → 我们 adopt 为 TAF Layer 3 标准
   • SFT / DPO 配方 → V2 起应用到国产模型
   • Reflection 模式 → 我们抄
   • 评测 harness → 我们改造为决议评测

🌟 我们独创
   • 3+1 决策状态机 (没人做过)
   • 议事室 17 分钟硬上限 + 5 步骨架 (没人做过)
   • Decision Card 双向溯源 (没人做过)
   • 拿捏老板分身进化 (没人做过)
```

---

## 第二章: TAF 五层架构

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  Layer 5: 应用层 (Use Cases)                            │
│  ──────────────────────────────────────────────────    │
│  • 议事室会议                                          │
│  • 拿捏老板分身                                        │
│  • Check-in 草稿                                       │
│  • 自动绩效自评包                                      │
│  • 卡顿信号检测                                        │
│  • 分身代参                                            │
│  ↑                                                     │
│  Layer 4: 编排层 (Orchestrator)                        │
│  ──────────────────────────────────────────────────    │
│  • 3+1 决策状态机                                      │
│  • 议事室 5 步状态机 (DIVERGE/CONVERGE/COMMIT/ESCALATE)│
│  • Plan/Act 模式分离                                   │
│  • 24h 否决窗口                                        │
│  • 17 min 硬上限定时器                                 │
│  • Approval-based Tool Use                            │
│  ↑                                                     │
│  Layer 3: 协议层 (Tandem Protocol)                     │
│  ──────────────────────────────────────────────────    │
│  • Decision Card Schema (输出协议)                     │
│  • Tool Schema (基于 Hermes Function Calling)          │
│  • Persona Schema (拿捏老板协议)                       │
│  • Memory Schema (四层知识协议)                        │
│  • Conversation Protocol (议事室对话格式)              │
│  ↑                                                     │
│  Layer 2: LLM 抽象层 (Provider Adapter)                │
│  ──────────────────────────────────────────────────    │
│  • OpenAI 兼容接口为主标准                             │
│  • 路由策略 (场景 / 成本 / 延迟 / 失败回退)             │
│  • Function Calling 适配 (Hermes 格式 ↔ 各模型)        │
│  • Streaming + Interrupt 标准化                        │
│  • Token 计费追踪                                      │
│  • Rate Limiting / Backoff                            │
│  ↑                                                     │
│  Layer 1: Foundation Models (基座模型, 可热插拔)       │
│  ──────────────────────────────────────────────────    │
│  DeepSeek-V3 / R1 │ Qwen-3 / Qwen-Max │ Doubao        │
│  Kimi K2 │ GLM-4.5 │ Hermes 4 │ (V3 国际版: Llama 4)   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 第三章: Layer 1 · 基座模型选型

### 3.1 V1 主力组合

| 模型 | 厂商 | 角色 | 月成本占比 |
|---|---|---|---|
| **DeepSeek-V3** | DeepSeek | 主力推理 (议事室 / 拿捏老板) | ~ 40% |
| **Qwen-3-Max** | 阿里 | 工具调用 / Memory RAG | ~ 25% |
| **Doubao 1.5 Pro** | 字节 | 高频低成本 (Check-in / 通知) | ~ 20% |
| **Kimi K2** | 月之暗面 | 长上下文 (复盘 / 历史) | ~ 10% |
| **Hermes 4** | Nous (Llama) | 民企客户 agentic 备选 | ~ 5% |

### 3.2 路由策略 (场景 → 模型)

```yaml
routing_rules:
  - scenario: "议事室复杂决策"
    primary: deepseek-v3
    fallback: qwen-3-max
    reason: "推理深度第一"

  - scenario: "工具调用 / Memory 检索"
    primary: qwen-3-max
    fallback: deepseek-v3
    reason: "function calling 最稳"

  - scenario: "Check-in 草稿 / 短文本"
    primary: doubao-1.5-pro
    fallback: glm-4-air
    reason: "性价比 + 速度"

  - scenario: "季度复盘 / 长文档总结"
    primary: kimi-k2
    fallback: qwen-3-max
    reason: "128K+ 上下文"

  - scenario: "民企客户 agentic 任务"
    primary: hermes-4
    fallback: deepseek-v3
    reason: "agentic + function calling 强项"

  - scenario: "公益 / 科研客户 (V3 出海)"
    primary: hermes-4
    fallback: llama-4
    reason: "海外无合规约束"
```

### 3.3 V1 → V3 演进路径

```
V1 (中国民企):
  主力 DeepSeek/Qwen/Doubao + Hermes 备选

V2 (大客户私有化):
  开源 DeepSeek-V3 / Qwen-72B / Hermes 4 客户自部署
  我们提供部署脚本 + 监控

V3 (出海):
  Hermes 4 / Llama 4 主力
  Claude / GPT-5 高端客户买单
  国内模型作为备选
```

### 3.4 嵌入模型选型

| 用途 | 选型 | 备注 |
|---|---|---|
| 中文向量检索 | **BGE-M3** (北智源) | 中文最强 |
| 多语向量 | **Qwen-Embedding-V3** | 阿里, 中英平衡 |
| 海外 (V3) | **OpenAI text-embedding-3** | 海外标杆 |
| 向量库 | **PostgreSQL + pgvector** (V1) → **Milvus** (V2) | V1 复用 Hermes 现有 PG |

---

## 第四章: Layer 2 · LLM 抽象层

### 4.1 Provider 接口标准

```typescript
interface LLMProvider {
  name: string
  capabilities: {
    chat: boolean
    function_calling: boolean
    streaming: boolean
    json_mode: boolean
    vision: boolean
    max_context: number
  }

  chat(req: ChatRequest): Promise<ChatResponse>
  chatStream(req: ChatRequest): AsyncIterator<ChatChunk>
  countTokens(text: string): number
  estimateCost(input: number, output: number): number
}

interface ChatRequest {
  messages: Message[]
  tools?: ToolSchema[]      // Hermes 格式或 OpenAI 格式
  temperature?: number
  max_tokens?: number
  response_format?: "text" | "json"
  stream?: boolean
}
```

### 4.2 路由器实现

```typescript
class TandemRouter {
  async route(scenario: Scenario, request: ChatRequest): Promise<ChatResponse> {
    const rule = this.rules.find(r => r.matches(scenario))
    let provider = this.providers.get(rule.primary)

    try {
      return await provider.chat(request)
    } catch (e) {
      if (this.isRecoverable(e)) {
        provider = this.providers.get(rule.fallback)
        return await provider.chat(request)
      }
      throw e
    }
  }
}
```

### 4.3 Function Calling 适配

不同模型的 function calling 实现差异:

| 模型 | 原生格式 | 适配方式 |
|---|---|---|
| OpenAI / DeepSeek | OpenAI tool_calls | 直接用 |
| Qwen-3 | OpenAI 兼容 | 直接用 |
| Doubao | OpenAI 兼容 | 直接用 |
| Hermes 4 | Hermes XML 格式 | 用 vLLM Hermes parser |
| Kimi K2 | OpenAI 兼容 | 直接用 |
| 国产小模型 | 不支持 / 不稳 | Prompt 模板 + 输出解析 |

我们的 Layer 2 统一**对外暴露 OpenAI tool_calls 格式**, 内部根据模型自动转换.

### 4.4 流式 + 中断

```typescript
const stream = router.chatStream(req)
for await (const chunk of stream) {
  if (userInterrupted()) {
    stream.return()  // 提前结束
    break
  }
  yield chunk
}
```

支持议事室"沉默时刻"等需要可中断的场景.

---

## 第五章: Layer 3 · Tandem 协议层 (核心 IP)

### 5.1 Decision Card Schema

牛马搭子的核心输出格式:

```json
{
  "$schema": "tandem.protocol.v1",
  "type": "decision_card",
  "id": "DC-2026-Q2-7723",
  "title": "用户邀请奖励 v2 上线策略",

  "convergence_state": "DIVERGE | CONVERGE | COMMIT | ESCALATED",
  "elapsed_seconds": 942,
  "hard_deadline_at": "2026-04-15T11:30:00+08:00",

  "decision_class": "simple | complex | strategic",
  "related_kr": ["KR-005"],
  "related_tti": ["TTI-012"],

  "options": [
    {
      "id": "A",
      "type": "SOP",
      "description": "...",
      "confidence": 0.85,
      "risk": "low",
      "reasoning": "...",
      "cited_materials": ["SOP-042", "C-118"]
    },
    {
      "id": "B",
      "type": "AGENT_REASONING",
      "confidence": 0.78,
      ...
    },
    {
      "id": "C",
      "type": "HISTORICAL",
      "case_refs": ["DC-2025-Q4-5512"],
      ...
    },
    {
      "id": "D",
      "type": "ORIGINAL",
      "novel_insight": "客户最近换了 CTO, SOP 灰度策略不适用",
      "human_only": true
    }
  ],

  "selected": "D",
  "selected_by": "user_id_123",
  "selected_at": "...",

  "action_items": [...],
  "watermark": {...}
}
```

### 5.2 Tool Schema (基于 Hermes 格式)

```xml
<!-- 我们 adopt Hermes Function Calling 格式作为内部协议 -->
<tool>
  <name>create_decision_card</name>
  <description>创建 Decision Card</description>
  <parameters>
    {
      "type": "object",
      "properties": {
        "title": {"type": "string"},
        "decision_class": {"enum": ["simple", "complex", "strategic"]},
        ...
      }
    }
  </parameters>
</tool>

<tool_call>
{"name": "create_decision_card", "arguments": {...}}
</tool_call>
```

**为什么用 Hermes 格式**:

- vLLM 内置 Hermes parser, 自部署无成本
- Together / Fireworks 等推理平台原生支持
- HuggingFace 大量微调模型已遵循
- 国产模型可通过 prompt 适配

### 5.3 Persona Schema (拿捏老板协议)

```json
{
  "$schema": "tandem.persona.v1",
  "user_id": "...",
  "stage": "🥚 Lv.1 新手 | 🐣 Lv.2 上手 | 🐤 Lv.3 熟手 | 🦅 Lv.4 老手 | 🐉 Lv.5 拿手",

  "decision_history": {
    "total_decisions": 1247,
    "self_made": 980,
    "ai_assisted": 267,
    "vetoed_by_user": 18
  },

  "style_profile": {
    "decision_speed": "fast | medium | slow",
    "risk_appetite": 0.65,
    "communication_style": "direct | diplomatic | analytical",
    "preferred_options": ["SOP-heavy", "case-driven", "intuitive"],
    "communication_examples": [...]
  },

  "growth_areas": [...],
  "boss_capture_score": 67  // "拿捏老板"度
}
```

### 5.4 Memory Schema (四层知识协议)

```yaml
layer: ORIGINS | MATERIALS | MEMORY | BASELINE

origins:
  type: "meeting_recording" | "chat_thread" | "file_origin"
  retention_days: 30-365
  visibility: participants_only

materials:
  type: "meeting_minutes" | "decision_card" | "checkin_report"
  visibility: company_default
  retention: forever

memory:
  type: "sop" | "case" | "redline" | "value"
  approval_required: true
  steward_signed: true

baseline:
  type: "company_genome"
  refresh_cycle: "quarterly"
```

---

## 第六章: Layer 4 · 编排层

### 6.1 3+1 决策状态机

```
START
  ↓
[识别决策类型: simple | complex | strategic]
  ↓
[并行生成 4 个选项]
  ├─ A: SOP 库检索
  ├─ B: AI 推演
  ├─ C: 历史案例匹配
  └─ D: (强制人类原创)
  ↓
[呈现给员工]
  ↓
DIVERGE (员工沉思)
  ↓
[员工选 A/B/C/D 或重新发散]
  ↓
CONVERGE
  ↓
COMMIT or ESCALATE
  ↓
END
```

### 6.2 议事室 5 步状态机

```
SETUP (议程加载, 角色分配)
  → DIVERGE (发散, 7 分钟硬上限)
  → CONVERGE (收敛, 5 分钟)
  → COMMIT (定稿 Decision Card, 3 分钟)
  → CLOSE (Action Items 分配, 2 分钟)
  TOTAL: 17 分钟硬上限

超过 17 分钟 → ESCALATED 状态
                → 自动通知主持人
                → 选项: 续会 / 异步推进 / 升级到老板
```

### 6.3 Plan/Act 模式分离 (借鉴 Cline)

```
PLAN 模式 (思考态):
  • LLM 不调用工具
  • 只输出推演 + 计划
  • 员工 review, 同意后进 ACT 模式

ACT 模式 (执行态):
  • LLM 可调用工具 (但每次需 approval)
  • 任何工具调用前: 弹出 [批准] [修改] [拒绝]
  • 员工可中断
```

### 6.4 Approval-based Tool Use

每个 tool call 默认需用户批准, 例外:

| Tool 类型 | 是否需批准 |
|---|---|
| 读 (查询 OKR / Memory) | ❌ 不需 |
| 写 (创建 Decision Card / 更新 KR) | ✅ 需 |
| 通知 (发消息给同事) | ✅ 需 |
| 调外部系统 (腾讯会议 / Jira) | ✅ 需 |
| 涉及钱 (Peer Bonus 发放) | ✅ 双重批准 |

---

## 第七章: Layer 5 · 应用层

每个核心功能在 Layer 5 实现, 复用 Layer 1-4 全部能力:

| 应用 | 用到的 Layer 4 状态机 | 用到的 Layer 1 模型 |
|---|---|---|
| 议事室 | 议事室 5 步 | DeepSeek-V3 (推理) |
| 拿捏老板 | Persona 学习循环 | DeepSeek-V3 + Qwen-3 |
| Check-in 草稿 | 简单 chat | Doubao 1.5 |
| 自动绩效自评包 | 长文本聚合 | Kimi K2 |
| 分身代参 | 议事室 + Persona | DeepSeek-V3 + Hermes 4 |
| 卡顿信号检测 | 异步分析 | Qwen-3 |

---

## 第八章: 从 Hermes 学到什么 (具体清单)

### 8.1 协议层 (Layer 3 直接采纳)

✅ **Hermes Function Calling 格式** → TAF 内部 Tool Schema 标准
✅ **Hermes 多轮 ReAct loop 格式** → 议事室对话协议
✅ **Hermes System Prompt 分层结构** (角色/指令/工具/上下文/安全)

### 8.2 工程层 (Layer 2-4 借鉴)

✅ **Provider Abstraction** (类 Cline 设计)
✅ **Plan/Act 模式** (类 Cline)
✅ **MCP 协议接入** (Anthropic 推动, Cline 已用)
✅ **Streaming + Interrupt** (类 Cline)
✅ **Context Compaction** (长会话压缩)

### 8.3 训练层 (V2 起采纳)

✅ **NousResearch/Hermes-Function-Calling repo** → fork + 加入决议训练数据
✅ **axolotl SFT 配置** → 应用于 Qwen-72B / DeepSeek 私有版
✅ **DPO preference 配方** → 自建职场决议 DPO 集
✅ **评测 harness** → 改造为决议质量评测

### 8.4 生态层 (V2 起借鉴)

✅ **HuggingFace 社区微调生态** → V2 牛马搭子也开放部分模型
✅ **Skills 市场化** → V2 Tandem Skills Marketplace

---

## 第九章: Hermes Watch 机制 (持续跟随)

| 频次 | 动作 | 谁负责 |
|---|---|---|
| 每周 | 监控 Nous Research GitHub / HuggingFace 发布 | AI 工程师 |
| 每周 | 监控 Cline / Cursor 等开源 Agent 仓库更新 | AI 工程师 |
| 每月 | 发"Hermes Watch 月报" 给团队 | AI 工程师 |
| 每月 | 评估 1-2 项可借鉴改进 | AI + CTO |
| 每季 | 重大评估 (是否有协议级更新) | 全团队 |
| 重大版本 | (Hermes 5/6 / Llama 5 发布) 全栈重评估 | 全员 |

**月报模板**:

```markdown
# Hermes Watch 月报 - 2026-XX

## 本月 OSS Agent 生态动态
- Nous Hermes: ...
- Cline: ...
- Cursor: ...
- HuggingFace 热门微调: ...

## 可借鉴改进 (建议)
1. [改进项 A] - 影响: 中 / 工时: S - 建议采纳
2. [改进项 B] - 影响: 大 / 工时: L - 建议讨论

## 可借鉴已采纳 (本月新增)
- TAF Layer X 引入 Y 改进

## 模型选型变更建议
- 是否新增/替换某个 Layer 1 模型
```

成本: AI 工程师 **2-4 小时/周**, 巨大杠杆.

---

## 第十章: 多模型成本控制

### 10.1 月成本估算 (V1 期)

按 1000 客户 × 30 员工 × 月活 60% × 各模型路由占比:

```
DeepSeek-V3:    2.5 亿 tokens/月 × ¥1.5/M  = ¥3.75 万
Qwen-3-Max:     1.5 亿 tokens/月 × ¥4/M    = ¥6.0 万
Doubao 1.5:     2.0 亿 tokens/月 × ¥1.0/M  = ¥2.0 万
Kimi K2:        0.5 亿 tokens/月 × ¥6/M    = ¥3.0 万
Hermes 4 自建:  0.3 亿 tokens/月 × 自建分摊 ¥4/M = ¥1.2 万
─────────────────────────────────────────
合计:                               ~ ¥16 万/月
```

V1 后期 (3000 客户) 大约 ¥50 万/月. 私有化大客户单独计费.

### 10.2 成本优化策略

```
1. 缓存层 (高频问题缓存):
   • Redis + semantic cache
   • 命中率目标 > 30%
   • 节省 30%+ 成本

2. 模型降级 (自动):
   • 简单任务自动用便宜模型
   • Doubao 处理 50% 高频请求

3. Prompt 压缩:
   • Memory 层 RAG 智能切片
   • 长上下文按需加载

4. Fine-tune (V2):
   • 高频任务用小模型 LoRA
   • 比 API 便宜 5-10x
```

---

## 第十一章: 私有化部署方案

### 11.1 客户分级

| 客户类型 | 部署方式 | 成本 |
|---|---|---|
| 中小民企 (< 200 人) | SaaS 公有云 (我们的) | 包月订阅 |
| 中型民企 (200-1000) | SaaS 私有租户 | 包月订阅 + 数据隔离 |
| 大型民企 (1000+) | VPC 私有部署 | 一次性 + 年度服务费 |
| 出海民企 (V3) | 海外云 (AWS/GCP/阿里云国际) | 海外计费 |

### 11.2 私有化技术栈

```
模型层:
  • DeepSeek-V3 开源版 (8×H800)
  • Qwen-3-72B 开源版 (4×A100)
  • Hermes 4 (Llama 3.3 70B 微调) (4×A100)

推理框架:
  • vLLM (主, Hermes parser 内置)
  • SGLang (高性能场景)

向量库:
  • Milvus / Qdrant (V2 起)
  • pgvector (V1 兼容)

应用层:
  • Tandem 完整 K8s 部署
  • 离线许可证激活
```

### 11.3 大客户专属

V2 起为 1000+ 人客户提供:
- 模型选型建议 (按合规要求)
- 微调服务 (基于客户 Memory 层)
- 24/7 SRE 支持
- 季度模型升级

---

## 第十二章: Tandem Skills Marketplace (V2)

### 12.1 愿景

```
Tandem Skills = 工作场景的 iOS 应用商店

第三方开发者可基于 TAF 写 Skills:
  • 行业垂直模板 (金融风控 / 医疗合规 / 制造 SOP)
  • 工具集成 (Salesforce / SAP / 用友 / 金蝶)
  • Decision 模板 (招聘面试 / 客户拜访 / 危机公关)
  • 角色化分身 (法务搭子 / 财务搭子 / HR 搭子)
```

### 12.2 SDK 设计

```typescript
// V2 起开放
import { TandemSkill } from '@tandem/sdk'

export default TandemSkill.define({
  name: "金融业风控 Skills",
  version: "1.0.0",
  permissions: ["read:okr", "write:decision_card"],

  hooks: {
    onMeetingStart: async (ctx) => { ... },
    onDecisionRequest: async (ctx) => { ... }
  }
})
```

### 12.3 商业模式

```
开发者:
  • 免费上架
  • 基础 Skills 免费
  • 付费 Skills: 牛马搭子分成 30% (类 App Store)

牛马搭子:
  • 提供 SDK / 文档 / 测试沙箱
  • Skills 审核 + 安全检查
  • 流量分发 (推荐位 / 排行榜)
```

V2 后期开放. **不在 V1 范畴**.

---

## 第十三章: 与现有 Agent 框架对比

| 框架 | 性质 | 与 TAF 关系 |
|---|---|---|
| **LangChain** | 通用工具链 | TAF 内部可借鉴部分组件; 不作为整体依赖 |
| **AutoGen** | 多 Agent 辩论 | 反对扩散文化; 不采纳 |
| **CrewAI** | 多 Agent 协作 | 同上; 但生态可关注 |
| **Cline** | 编程 Agent | 工程实践全面学习 |
| **Hermes Format** | 协议标准 | 直接 adopt 为 TAF Layer 3 |
| **MCP** | 工具协议 | V2 接入 |
| **OpenHands** | 通用 Agent | 关注但不依赖 |

**TAF 的差异化**: **职场决议垂直化** + **3+1 / 议事室 / 拿捏老板**协议化.

---

## 第十四章: V1 实施清单

### 14.1 V1 必含

```
✅ Layer 1: 4 个模型接入 (DeepSeek + Qwen + Doubao + Kimi)
✅ Layer 2: Provider Abstraction + Router + Function Calling 适配
✅ Layer 3: 全部 4 个 Schema (Decision Card / Tool / Persona / Memory)
✅ Layer 4: 3+1 状态机 + 议事室 5 步状态机 + Plan/Act + Approval
✅ Layer 5: 议事室 + 拿捏老板基础 + Check-in 草稿
✅ Hermes Watch: 启动月报机制
```

### 14.2 V1 工时

```
Layer 2 (Provider Abstraction):  M (~ 3 周)
Layer 3 (Schema 定义 + 验证):    M (~ 3 周)
Layer 4 状态机:                   L (~ 2 月)
Hermes 格式适配 + vLLM 集成:      M (~ 3 周)
路由器 + 缓存层:                  M (~ 3 周)
─────────────────────────────────
合计:                             5-6 人月

V1 总人月预算 (40-50 人月) 中占 ~ 12%.
```

---

## 第十五章: 长期愿景

```
V1 (Y1):
  TAF 5 层完整 + 4 个模型 + Hermes 协议落地
  → 内部驱动 + 客户买单

V2 (Y2):
  Skills Marketplace 开放 + MCP 接入
  + 私有化部署成熟
  → 开发者生态启动

V3 (Y3+):
  Hermes Watch 持续 + 国产模型微调集
  + 出海版 Hermes 4 主力
  → 全球工作场景 Agent 生态参与者

V5+ (Y5+ 假设):
  TAF 协议成为业界标准之一
  → 类似 LangChain 的位置, 但更聚焦工作场景
```

---

## 附录 A: 关键开源仓库 Watch List

```
🔥 必跟:
  • github.com/NousResearch/Hermes-Function-Calling
  • github.com/cline/cline
  • github.com/QwenLM/Qwen3
  • github.com/deepseek-ai
  • github.com/vllm-project/vllm

⭐ 周看:
  • huggingface.co/NousResearch
  • github.com/anthropics/mcp
  • github.com/SGLang/sglang

📊 月看:
  • github.com/microsoft/autogen
  • github.com/joaomdmoura/crewAI
  • github.com/All-Hands-AI/OpenHands
```

---

## 附录 B: TAF 与 MANIFESTO 条款映射

| MANIFESTO 条款 | TAF 实现位置 |
|---|---|
| 第一条 决议为单元 | Layer 3 Decision Card Schema |
| 第二条 3+1 选项 | Layer 4 3+1 状态机 |
| 第三条 17 分钟硬上限 | Layer 4 议事室状态机 |
| 第七条 四层知识 | Layer 3 Memory Schema |
| 第九条 分身水印 | Layer 3 Persona Schema 强制字段 |
| 第十五条 AI 助成长 | Layer 4 Approval-based Tool Use |
| **第十六条 LLM 可换** | **TAF 整体架构** |
| 第十七条 民企边界 | Layer 1 路由策略 |

---

## 修订历史

| 版本 | 日期 | 修订人 | 主要变化 |
|---|---|---|---|
| v1.0 | 2026-05 | 牛马搭子产品团队 | 初版, 五层架构 + Hermes 集成策略 |
