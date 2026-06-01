# 中央 AI 技术栈驱动全模块分析 (Central AI Tech Stack Driver)

> **版本**: 2026-06-01
> **目的**: 从技术栈角度分析中央 AI（CompanyBrain）如何驱动和介入到所有模块
> **前置**: `CENTRAL-AI-ARCHITECTURE.md` · `OKR-DRIVEN-ARCHITECTURE.md` · `PLATFORM-ARCHITECTURE-2026-05-29.md`

---

## 一、中央 AI 技术栈总图

```
┌─────────────────────────────────────────────────────────────┐
│                    中央 AI 技术栈 (CompanyBrain)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  L1: TAF Router (大脑选择层)                        │    │
│  │  - 6 family LLM (claude-opus-4-5 / deepseek-v3...)  │    │
│  │  - scenario 规则 (reasoning_complex / tool_use...)  │    │
│  │  - 自动 fallback                                     │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  L2: 治理层 (Governance Layer)                      │    │
│  │  - govern-persona (闸① + L2 + L4)                   │    │
│  │  - baseline-guard (HARD_BLOCK / SOFT_WARN / PASS)   │    │
│  │  - output-guard (LLM-as-judge)                      │    │
│  │  - skill-gateway (闸②③④)                           │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  L3: 执行层 (Execution Layer)                       │    │
│  │  - tool-loop (工具调用循环)                          │    │
│  │  - skillRegistry (技能注册表)                        │    │
│  │  - mcp-bridge (MCP 协议桥)                           │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  L4: 知识层 (Knowledge Layer)                        │    │
│  │  - Memory 4 层 (Origins → Materials → Memory)        │    │
│  │  - RAG 召回 (embedding + 向量搜索)                  │    │
│  │  - promotion-flow (三级签批)                         │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  L5: 数据层 (Data Layer)                             │    │
│  │  - KvStore (通用表 collection/id/data)               │    │
│  │  - PG (User / OKR / KPI / DecisionCard)              │    │
│  │  - AuditLog (审计日志)                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、L1: TAF Router (大脑选择层)

### 2.1 技术组件

**文件**: `lib/taf/index.ts` · `lib/taf/router.ts`

**功能**: LLM 路由层，根据 scenario 选择最佳模型

**支持的模型**:

| 模型 ID | Scenario | 用途 | 成本 (RMB/M) |
|---------|----------|------|-------------|
| `claude-opus-4-5` | `reasoning_complex` / `agentic` / `tool_use` / `long_context` | 议事 3+1 决策 / 多步 Agent / Tool Calling / 长文档 | 108 / 540 |
| `deepseek-v3` | `persona_dialogue` / `tool_use` / `high_frequency` | 个人 AI 高频 / Tool Calling / Check-in | 1 / 2 |
| `deepseek-r1` | `reasoning_complex` (推演专用) | 议事/OKR 推演 | 4 / 16 |
| `qwen-max` | `tool_use` / `persona_dialogue` | Tool Calling / 个人 AI | 4 / 12 |
| `doubao-pro` | `high_frequency` | Check-in / 通知 | 0.5 / 1 |
| `kimi-k2` | `long_context` | 长文档 | 12 / 25 |

**自动 fallback 规则**:

```typescript
// lib/taf/router.ts
const DEFAULT_ROUTING_RULES: RoutingRules = {
  reasoning_complex: ['claude-opus-4-5', 'deepseek-v3', 'qwen-max', 'kimi-k2'],
  agentic: ['claude-opus-4-5', 'deepseek-v3', 'hermes-4', 'qwen-max'],
  tool_use: ['claude-opus-4-5', 'qwen-max', 'deepseek-v3'],
  long_context: ['claude-opus-4-5', 'doubao-pro', 'kimi-k2', 'deepseek-v3'],
  persona_dialogue: ['deepseek-v3', 'claude-opus-4-5', 'qwen-max'],
  high_frequency: ['doubao-pro', 'deepseek-v3', 'qwen-max'],
};
```

### 2.2 介入各模块

| 模块 | 调用点 | Scenario | 模型选择 |
|------|--------|----------|----------|
| **议事室** | `lib/decision-layer/three-plus-one-engine.ts` | `reasoning_complex` | claude-opus-4-5 |
| **IM @AI** | `lib/im/service.ts` `invokePersonaReply()` | `persona_dialogue` | deepseek-v3 |
| **文档 RAG** | `lib/memory/rerank.ts` | `tool_use` | claude-opus-4-5 |
| **OKR 推演** | `lib/okr/derive.ts` | `reasoning_complex` | deepseek-r1 |
| **Bitable AI 列** | `lib/services/bitable-ai-compute.ts` | `tool_use` | qwen-max |
| **日报 AI 预填** | `app/api/ai/extract-daily-report/route.ts` | `persona_dialogue` | deepseek-v3 |

---

## 三、L2: 治理层 (Governance Layer)

### 3.1 govern-persona (统一卡点)

**文件**: `lib/persona/govern-persona.ts`

**功能**: 统一卡点，串联闸① + L2 + L4

**注入优先级 L0-L5**:

```typescript
export async function governPersonaOutput(input: GovernPersonaInput): Promise<GovernPersonaResult> {
  // 闸① checkBaseline (baseline-guard)
  const baseline = await checkBaseline({ intent, actorUserId, agentKind });
  if (baseline.verdict === 'HARD_BLOCK') return blocked(baseline.blockReason);

  // L2 buildOkrAnchorContext() 注入 OKR 锚
  const okrContext = await buildOkrAnchorContext(actorUserId);

  // L4 loadActiveRules + getConstitutionPromptSegment 注入价值观锚
  const constitution = await getConstitutionPromptSegment(actorUserId);

  // 按 L0-L5 优先级组装 systemPrompt
  const systemPrompt = assembleSystemPrompt({
    L0_baseline: baseline.contextToInject,
    L1_memory: memoryContext,
    L2_okr: okrContext,
    L3_delegation: delegationContext,
    L4_constitution: constitution,
    L5_style: styleProfile,
  });

  return { allowed: true, systemPrompt, hits: baseline.hits };
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **Persona 训练** | `app/api/ai/persona-train/route.ts` | ✅ 已接入 |
| **IM @AI** | `lib/im/service.ts` `invokePersonaReply()` | ⚠️ 各自实现，待迁移 |
| **3+1 决策** | `lib/decision-layer/three-plus-one-engine.ts` | ⚠️ 各自实现，待迁移 |
| **BossAI** | `app/api/boss-ai/stream/route.ts` | ⚠️ 各自实现，待迁移 |

### 3.2 baseline-guard (基线守卫)

**文件**: `lib/memory/baseline-guard.ts`

**功能**: 检测 intent 是否违反公司 Memory

**判决逻辑**:

```typescript
export async function checkBaseline(input: BaselineCheckInput): Promise<BaselineCheckResult> {
  // 1. embedding 召回 top-8 company memories
  const hits = await rerankTopMemories(input.intent, 'company');

  // 2. 相似度判定
  const maxSim = Math.max(...hits.map(h => h.similarity));
  if (maxSim >= 0.45) return { verdict: 'HARD_BLOCK', blockReason: '违反红线' };
  if (maxSim >= 0.2) return { verdict: 'SOFT_WARN', contextToInject: hits };
  return { verdict: 'PASS' };
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **Persona 训练** | `app/api/ai/persona-train/route.ts` | ✅ 已接入 |
| **IM @AI** | `lib/im/service.ts` `invokePersonaReply()` | ✅ 已接入 |
| **3+1 决策** | `lib/decision-layer/three-plus-one-engine.ts` | ✅ 已接入 |
| **BossAI** | `app/api/boss-ai/stream/route.ts` | ✅ 已接入 |

### 3.3 output-guard (输出守卫)

**文件**: `lib/memory/output-guard.ts`

**功能**: LLM-as-judge，检测输出是否偏离基线

**判决逻辑**:

```typescript
export async function checkOutput(input: OutputCheckInput): Promise<OutputCheckResult> {
  // 1. rerank top-8 company memories
  const hits = await rerankTopMemories(input.query, 'company');

  // 2. LLM-as-judge (high_frequency scenario)
  const judge = await router.chat({
    messages: [
      { role: 'system', content: JUDGE_SYSTEM_PROMPT },
      { role: 'user', content: `Query: ${input.query}\nResponse: ${input.response}\nMemories: ${JSON.stringify(hits)}` },
    ],
    scenario: 'high_frequency',
  });

  // 3. 解析 verdict
  const verdict = parseVerdict(judge.content); // PASS / SOFT_DRIFT / HARD_CONFLICT

  if (verdict === 'HARD_CONFLICT') {
    return { verdict, revisionPrompt: generateRevisionPrompt(hits) };
  }
  return { verdict, footnote: generateFootnote(hits) };
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **IM @中央AI** | `lib/im/service.ts` `invokeCompanyBrainReply()` | ✅ 已接入 |
| **BossAI** | `app/api/boss-ai/stream/route.ts` | ✅ 已接入 |

### 3.4 skill-gateway (技能网关)

**文件**: `lib/skill-gateway/index.ts`

**功能**: 4 道闸（Baseline / OKR Drift / Data / Action）

**4 道闸逻辑**:

```typescript
export async function runSkillGateway(input: SkillGatewayInput): Promise<SkillGatewayResult> {
  // 闸① Baseline-Guard
  const baseline = await checkBaseline({ intent: input.action.intent, actorUserId: input.actorUserId });
  if (baseline.verdict === 'HARD_BLOCK') return blocked(baseline.blockReason);

  // 闸② OKR Drift Detection (器官 #16)
  const okrDrift = await checkOkrDrift({ intent: input.action.intent, actorUserId: input.actorUserId });
  if (okrDrift.verdict === 'FAR') return askUser('是否偏离 OKR?');

  // 闸③ Data Scope
  const dataScope = await checkDataScope({ skillId: input.action.skillId, actorUserId: input.actorUserId });
  if (!dataScope.allowed) return blocked('无数据权限');

  // 闸④ Action Scope
  const actionScope = await checkActionScope({ skillId: input.action.skillId, action: input.action });
  if (actionScope.risk === 'HIGH') return proxyAction(input.action);

  return { verdict: 'PASS' };
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **搭子技能调用** | `app/api/tandem-skills/execute/route.ts` | ⚠️ 待接入 |
| **个人 AI 调用** | `lib/agent-runtime/tool-loop.ts` | ⚠️ 待接入 |

---

## 四、L3: 执行层 (Execution Layer)

### 4.1 tool-loop (工具调用循环)

**文件**: `lib/agent-runtime/tool-loop.ts`

**功能**: LLM 真正能"调工具"的桥

**循环逻辑**:

```typescript
export async function runToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  const router = getRouter();
  const skillRegistry = await import('@/lib/taf/skills/registry');

  // 1. 拼工具 schemas
  const tools = input.toolset.map(id => skillRegistry.get(id)?.schema).filter(Boolean);

  // 2. 初始消息
  let messages: ChatMessage[] = [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: input.userQuery },
  ];

  // 3. 循环
  for (let round = 0; round < maxRounds; round++) {
    const response = await router.chat({ messages, scenario: input.scenario, tools });

    if (!response.toolCalls) {
      // 收敛: LLM 不再 toolCalls
      return { finalMessage: response.content, finishedNaturally: true };
    }

    // 执行工具
    for (const toolCall of response.toolCalls) {
      const result = await skillRegistry.execute(toolCall.name, toolCall.args);
      messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId: toolCall.id });
    }
  }

  // 超时强制收敛
  return { finalMessage: lastResponse.content, finishedNaturally: false };
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **议事室 multi-step** | `lib/agent-runtime/multi-step.ts` | ⚠️ 待接入 |
| **CompanyBrain 工具调用** | `lib/persona/company-brain.ts` | ⚠️ 待接入 |
| **Bitable AI 列** | `lib/services/bitable-ai-compute.ts` | ⚠️ 待接入 |

### 4.2 skillRegistry (技能注册表)

**文件**: `lib/taf/skills/registry.ts`

**功能**: 技能注册表 + 执行守门

**内置技能**:

| 技能 ID | 功能 | 状态 |
|--------|------|------|
| `web.search` | 网络搜索 (Tavily / Brave) | ✅ 已注册 |
| `okr.read` | 读取 OKR | ⚠️ 待注册 |
| `memory.search` | 搜索 Memory | ⚠️ 待注册 |
| `kpi.query` | 查询 KPI | ⚠️ 待注册 |
| `document.read` | 读取文档 | ⚠️ 待注册 |

**执行守门**:

```typescript
export async function execute(skillId: string, args: Record<string, unknown>): Promise<unknown> {
  const skill = get(skillId);
  if (!skill) throw new Error(`Skill not found: ${skillId}`);

  // 5 道守门: governance / 红区 / 预算 / 审计 / 错误兜底
  const governance = await checkGovernance(skillId, args);
  if (!governance.allowed) throw new Error(governance.blockReason);

  const redZone = await checkRedZone(skillId, args);
  if (redZone.blocked) throw new Error('红区禁止');

  const budget = await checkBudget(skillId);
  if (budget.exceeded) throw new Error('预算超限');

  const result = await skill.handler(args);

  await auditLog({ skillId, args, result, status: 'success' });

  return result;
}
```

### 4.3 mcp-bridge (MCP 协议桥)

**文件**: `lib/agent-runtime/mcp-bridge.ts`

**功能**: MCP 协议桥，接入外部 MCP server

**设计**:

```typescript
export class McpBridge {
  async connect(serverUrl: string): Promise<void> {
    // 连接 MCP server
  }

  async listTools(): Promise<ToolSchema[]> {
    // 列出 MCP server 提供的工具
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    // 调用 MCP server 工具
  }
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **外部 MCP server** | `lib/agent-runtime/mcp-bridge.ts` | ⚠️ 待接入 |

---

## 五、L4: 知识层 (Knowledge Layer)

### 5.1 Memory 4 层

**文件**: `lib/types/memory.ts` · `lib/memory/promotion-flow.ts`

**4 层架构**:

| 层 | 描述 | 签批 | 状态 |
|---|------|------|------|
| **Origins** | 原始数据 (邮件/IM/文档) | 无 | ✅ 已有 |
| **Materials** | 结构化事实 (全员可见，可编辑) | 无 | ✅ 已有 |
| **Memory** | 签批规范 (三级签批) | CEO + CLevel + Steward | ✅ 已有 |
| **Baseline** | 公司 LLM 权重 + RAG | 签批后自动 | ✅ 已有 |

**promotion-flow (三级签批)**:

```typescript
export async function materializePromotion(input: PromotionInput): Promise<PromotionResult> {
  // 1. 业务 Leader 提议
  const proposal = await createProposal(input);

  // 2. Steward 审核通过
  await stewardApprove(proposal.id);

  // 3. CEO/CLevel 签批
  await ceoApprove(proposal.id);

  // 4. 公示 7 天
  await公示(proposal.id, 7 * 24 * 60 * 60 * 1000);

  // 5. 入 Memory
  const memory = await createMemory(proposal);

  // 6. 更新 Baseline (RAG 索引)
  await updateBaseline(memory);

  return { memoryId: memory.id };
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **文档 → Memory** | `app/api/documents/promote/route.ts` | ✅ 已接入 |
| **IM 消息 → Memory** | `app/api/messages/promote/route.ts` | ⚠️ 待接入 |
| **议事室 → Memory** | `app/convergence/[id]/promote/route.ts` | ⚠️ 待接入 |

### 5.2 RAG 召回

**文件**: `lib/memory/rerank.ts` · `lib/memory/embedding.ts`

**功能**: embedding + 向量搜索 + rerank

**召回逻辑**:

```typescript
export async function rerankTopMemories(query: string, ownershipLevel: OwnershipLevel): Promise<MemoryHit[]> {
  // 1. embedding 查询
  const embedding = await embed(query);

  // 2. 向量搜索 (PG pgvector)
  const candidates = await pgvectorSearch(embedding, ownershipLevel);

  // 3. rerank (LLM 重新排序)
  const reranked = await llmRerank(query, candidates);

  return reranked.slice(0, 8);
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **baseline-guard** | `lib/memory/baseline-guard.ts` | ✅ 已接入 |
| **output-guard** | `lib/memory/output-guard.ts` | ✅ 已接入 |
| **文档搜索** | `app/api/documents/search/route.ts` | ⚠️ 待接入 |
| **全局搜索** | `app/api/search/route.ts` | ⚠️ 待接入 |

---

## 六、L5: 数据层 (Data Layer)

### 6.1 KvStore (通用表)

**文件**: `lib/storage/kvstore.ts`

**功能**: 通用表 collection/id/data，不加 schema

**用途**:

| collection | 用途 |
|-----------|------|
| `auth_password` | 密码哈希 |
| `auth_phone_otp` | 手机 OTP |
| `auth_phone_binding` | 手机绑定 |
| `auth_wechat_binding` | 微信绑定 |
| `ai_conversations` | AI 对话历史 |
| `skill_proposals` | 技能提议 |
| `memory_promotions` | Memory 提议 |

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **认证** | `lib/auth/phone-login.ts` | ✅ 已接入 |
| **AI 对话历史** | `app/api/ai/conversations/route.ts` | ⚠️ 待接入 |
| **技能提议** | `app/api/skills/propose/route.ts` | ⚠️ 待接入 |

### 6.2 PG (关系型数据库)

**文件**: `drizzle/schema.ts`

**表**:

| 表 | 用途 |
|---|------|
| `User` | 用户基础信息 |
| `OKR` | OKR 目标 |
| `KPI` | KPI 指标 |
| `DecisionCard` | 决策卡 |
| `MemoryEntry` | Memory 条目 |
| `AuditLog` | 审计日志 |
| `LlmUsageLog` | LLM 使用日志 |

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **OKR** | `lib/okr/` | ✅ 已接入 |
| **KPI** | `lib/kpi/` | ✅ 已接入 |
| **决策卡** | `lib/decision/` | ✅ 已接入 |
| **Memory** | `lib/memory/` | ✅ 已接入 |
| **审计** | `lib/audit/log.ts` | ✅ 已接入 |

### 6.3 AuditLog (审计日志)

**文件**: `lib/audit/log.ts`

**功能**: 审计日志，记录所有关键操作

**记录的操作**:

| action | 描述 |
|--------|------|
| `baseline_guard.checked` | baseline-guard 检查 |
| `baseline_guard.blocked` | baseline-guard 阻断 |
| `output_guard.checked` | output-guard 检查 |
| `output_guard.revised` | output-guard 矫正 |
| `skill_gateway.checked` | skill-gateway 检查 |
| `skill_gateway.blocked` | skill-gateway 阻断 |
| `promotion.created` | Memory 提议创建 |
| `promotion.approved` | Memory 提议签批 |

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **baseline-guard** | `lib/memory/baseline-guard.ts` | ✅ 已接入 |
| **output-guard** | `lib/memory/output-guard.ts` | ✅ 已接入 |
| **skill-gateway** | `lib/skill-gateway/index.ts` | ⚠️ 待接入 |
| **promotion-flow** | `lib/memory/promotion-flow.ts` | ⚠️ 待接入 |

---

## 七、中央 AI 统一 chokepoint (governedChat)

**文件**: `lib/governance/governed-chat.ts` (待实现)

**功能**: 唯一强制出口，把"无旁路治理"从纪律变架构

**设计**:

```typescript
export async function governedChat(input: GovernedChatInput): Promise<GovernedChatResult> {
  // 1. 输入闸: govern-persona (闸① + L2 + L4) → systemPrompt
  const gov = await governPersonaOutput({ ... });
  if (!gov.allowed) return blocked(gov.blockReason);

  // 2. 动作闸: 若有 action, 跑 skill-gateway 闸②③④
  if (input.action) {
    const sg = await runSkillGateway({ ...input.action, derivedZone: await deriveActionZone(input) });
    if (sg.verdict === 'HARD_BLOCK') return blocked(sg.blockReasons);
  }

  // 3. LLM 调用 (注入治理后的 systemPrompt)
  let answer = await router.chat({ messages: [{role:'system', content: gov.systemPrompt}, ...input.messages], scenario });

  // 4. 输出闸: output-guard 内联
  const out = await checkOutput({ query: input.intent, response: answer, actorUserId, source: input.agentKind });
  if (out.verdict === 'HARD_CONFLICT') answer = await revise(answer, out.revisionPrompt);

  // 5. autonomous 路径: fail-closed (闸故障=拦截, 非放行)
  return { answer, gates: {...}, checkId };
}
```

**关键修正点**:

- **zone 内容判定**: caller 声明 → `deriveActionZone()` 按内容+委托级别判定（组织主权，非个人主权）
- **autonomous fail 行为**: 全 fail-open → autonomous 路径 fail-closed（闸崩=拦截）
- **output-guard 内联**: 手动接 → governedChat 内强制串联
- **无旁路**: 库函数自觉调 → ESLint 规则禁业务代码直调 `router.chat`

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **所有 AI 调用** | `lib/governance/governed-chat.ts` | ⚠️ 待实现 |

---

## 八、中央 AI OKR 锚定 (器官 #15)

**文件**: `lib/persona/company-brain.ts` (待实现)

**功能**: CompanyBrain 每次回复前嵌入当前 active 公司 OKR + 战略主题

**设计**:

```typescript
export async function buildCompanyBrainSystemPrompt(context: CompanyBrainContext): Promise<string> {
  const activeOkr = await getActiveOkrCycle(context.tenantId);
  const okrAnchor = buildOkrAnchorContext(activeOkr); // 器官 #15

  return `
你是 Tandem 中央 AI，代表整个组织发言。

当前 OKR 锚点：
${okrAnchor}

公司 Memory 基线：
${baselineContext}

回答时必须：
1. 锚定当前 OKR，所有建议必须可回溯到具体 KR
2. 引用公司 Memory，不违反基线
3. 不替员工决策，给 3+1 选项让员工选
`;
}
```

**介入各模块**:

| 模块 | 调用点 | 状态 |
|------|--------|------|
| **CompanyBrain** | `lib/persona/company-brain.ts` | ⚠️ 待实现 |
| **议事室** | `lib/decision-layer/three-plus-one-engine.ts` | ⚠️ 待接入 |
| **OKR 推演** | `lib/okr/derive.ts` | ⚠️ 待接入 |

---

## 九、技术栈演进路径

### V1.5 · 补齐元认知与学习器官（1-2 月）

| # | 改进 | 技术文件 | 工作量 | 状态 |
|---|---|---|---|---|
| **CA-1** | CompanyBrain Persona 骨架 | `lib/persona/company-brain.ts` | 3-5h | ✅ 2026-05-27 落地 |
| **CA-2** | Baseline-Guard 灰区 LLM 仲裁 | `lib/memory/baseline-guard.ts` | 1 周 | ⏳ 待启动 |
| **CA-3** | /admin/governance 看板 | `app/admin/governance/page.tsx` | 1 周 | ⏳ 待启动 |
| **CA-4** | IM-7 trace 升级 | `lib/im/service.ts` | 3 天 | ⏳ 待启动 |
| **#15** | OKR Anchor 注入器 | `lib/persona/company-brain.ts` | 2-3h | ⏳ 待启动 |
| **#16** | OKR Drift 检测 | `lib/skill-gateway/okr-drift.ts` | 1 周 | ⏳ 待启动 |

### V2 · 补齐主循环 + 执行肢体（3-6 月）

| # | 改进 | 技术文件 | 工作量 |
|---|---|---|---|
| **CA-5** | 议事 multi-step reasoning | `lib/agent-runtime/multi-step.ts` | 1 个月 |
| **CA-6** | 接入 MCP | `lib/agent-runtime/mcp-bridge.ts` | 2-3 周 |
| **CA-7** | 完整 tool calling | `lib/agent-runtime/tool-loop.ts` | 2 周 |
| **CA-8** | lib/agent-runtime/ adapter | `lib/agent-runtime/adapter.ts` | 2 周 |
| **#17** | 个人 AI 产出 Capture 层 | `lib/capture/ide-plugin.ts` | 1 月 |
| **#18** | Skill Gateway 4 道闸 | `lib/governance/governed-chat.ts` | 1-2 月 |

### V3 · 补齐习惯沉淀 + 组织 IQ 离线化（6-12 月）

| # | 改进 | 技术文件 | 工作量 |
|---|---|---|---|
| **CA-9** | Reflection loop | `lib/persona/reflection.ts` | 2-3 周 |
| **CA-10** | Correction-based fine-tune | `lib/training/dataset-builder.ts` | 1-2 月 |
| **CA-11** | Knowledge distillation | `lib/training/lora.ts` | 2-3 月 |
| **CA-12** | Multi-Agent Tandem | `lib/agent-runtime/multi-agent.ts` | 2-3 月 |

---

## 十、一句话总结

> **中央 AI 技术栈分 5 层：L1 TAF Router (大脑选择层) → L2 治理层 (govern-persona / baseline-guard / output-guard / skill-gateway) → L3 执行层 (tool-loop / skillRegistry / mcp-bridge) → L4 知识层 (Memory 4 层 / RAG 召回) → L5 数据层 (KvStore / PG / AuditLog)。通过统一 chokepoint (governedChat) 串联所有层，把"无旁路治理"从纪律变架构。**

---

_本文档为中央 AI 技术栈驱动全模块分析，与 `CENTRAL-AI-ARCHITECTURE.md`、`OKR-DRIVEN-ARCHITECTURE.md`、`PLATFORM-ARCHITECTURE-2026-05-29.md` 联动。_
