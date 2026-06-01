# Tandem 统一技术设计 (Unified Tech Design)

> **版本**: 2026-06-01 · 基于竞品架构灵魂 + Tandem 真实代码对账
> **范围**: 3 个地基级技术改造, 把"竞品灵魂"落到 Tandem 代码
> **前置**: 见 `docs/COMPETITOR-ARCHITECTURE.md` (灵魂来源) + `docs/MASTER-UPGRADE.md` (功能蓝图)
> **性质**: 技术设计草案, 落地前需 CTO + Owner review

---

## 0. 三件地基 (按依赖排序)

```
① governedChat() 统一治理 chokepoint   ← 护城河从"纪律"变"架构" (最高优先, 不动数据)
② TandemNode 统一节点原语              ← 母题A, 解知识4层孤岛 (数据层, 渐进迁移)
③ Skill Gateway as MCP server          ← 母题B, 对接 Cowork/Claude Code (协议层, 对外)
```

**为什么这个顺序**: ① 不改数据模型、风险最低、立刻封住护城河漏洞; ② 是数据层手术、需渐进迁移; ③ 依赖 ①② 稳定后对外开放。

---

## 1. governedChat() · 统一治理 chokepoint

### 1.1 解决的问题 (真实代码债)

现状三个治理函数互不调用, "无旁路"是纪律非架构 (详见 memory / 反向推演):
- `governPersonaOutput()` 只治理输入 prompt (闸① + L2 OKR + L4 价值观), 不调 output-guard, 不跑闸②③④
- `runSkillGateway()` 跑 4 闸, 但闸④ `checkActionScope_` 只读 caller 声明的 `actionScope` (零内容校验)
- `checkOutput()` 只在 `im/service.ts:1066` 手动接

→ 新功能可直接 `router.chat()` 绕过一切。v2.0 "绿区全自动代劳"无安全地基。

### 1.2 设计: 唯一强制出口

```typescript
// lib/governance/governed-chat.ts (新增)
export interface GovernedChatInput {
  actorUserId: string;
  intent: string;                    // 用户输入/意图
  basePersonaPrompt?: string;        // persona 身份 (走 govern-persona 注入)
  messages: ChatMessage[];
  agentKind: 'persona' | 'autonomous' | 'skill';
  // 动作治理 (若本次调用会产生企业动作)
  action?: {
    dataScope: 'personal' | 'team' | 'department' | 'company';
    declaredActionScope: 'read_only' | 'create_draft' | 'commit' | 'send_external';
  };
  scenario: LlmScenario;
  failMode?: 'fail-open' | 'fail-closed';  // autonomous 默认 fail-closed
}

export async function governedChat(input: GovernedChatInput): Promise<GovernedChatResult> {
  // 1. 输入闸: govern-persona (闸① + L2 + L4) → systemPrompt
  const gov = await governPersonaOutput({ ... });
  if (!gov.allowed) return blocked(gov.blockReason);

  // 2. 动作闸: 若有 action, 跑 skill-gateway 闸②③④
  //    关键修正: zone 由 deriveActionZone() 内容判定, 不只信 caller 声明
  if (input.action) {
    const sg = await runSkillGateway({ ...input.action, derivedZone: await deriveActionZone(input) });
    if (sg.verdict === 'HARD_BLOCK') return blocked(sg.blockReasons);
  }

  // 3. LLM 调用 (注入治理后的 systemPrompt)
  let answer = await router.chat({ messages: [{role:'system', content: gov.systemPrompt}, ...input.messages], scenario });

  // 4. 输出闸: output-guard 内联 (不再靠 caller 手动接)
  const out = await checkOutput({ query: input.intent, response: answer, actorUserId, source: input.agentKind });
  if (out.verdict === 'HARD_CONFLICT') answer = await revise(answer, out.revisionPrompt);

  // 5. autonomous 路径: fail-closed (闸故障=拦截, 非放行)
  return { answer, gates: {...}, checkId };
}
```

### 1.3 关键修正点

| 修正 | 现状 | 改后 |
|------|------|------|
| **zone 内容判定** | caller 声明 `actionScope` | `deriveActionZone()` 按内容+委托级别判定 (组织主权, 非个人主权) |
| **autonomous fail 行为** | 全 fail-open | autonomous 路径 fail-closed (闸崩=拦截) |
| **output-guard 内联** | 手动接 | governedChat 内强制串联 |
| **无旁路** | 库函数自觉调 | ESLint 规则禁业务代码直调 `router.chat` (backlog B-LINT) |

### 1.4 落地步骤
1. 新增 `lib/governance/governed-chat.ts` 串联三闸
2. `deriveActionZone()`: 基于 Memory 红线命中 + Persona `delegationLevel` + 动作类型推导 zone (替代纯 caller 声明)
3. 迁移现有 caller (im/service, company-brain, persona-train) 改调 governedChat
4. 加 ESLint 规则 `no-direct-router-chat`
5. 单测: autonomous fail-closed / zone 内容判定 / output-guard 内联 三场景

### 1.5 性能注意
governedChat 每次 = 1 embedding (baseline) + 1 主 LLM + 1 output-guard judge LLM = **LLM 调用 ×2**。全员高频入口需: output-guard 可配置**异步/抽样**模式 (先交付后台审, 命中追回), 由 `OUTPUT_GUARD_ENABLED` 扩展为 `OUTPUT_GUARD_MODE=sync|async|sample`。

---

## 2. TandemNode · 统一节点原语 (母题 A)

### 2.1 解决的问题
`repository.ts` ~40 个按类型分仓的 `Repository<T>`; 知识 4 层 origins/materials/memories 是 3 个独立 repo → 无法平滑转换 (Notion `Turn into` 灵魂缺失)。

### 2.2 设计: 借 Notion 完整块模型 (含 collection + relation + rollup)

> **深度修正 (2026-06-01)**: 初版只学了 Notion "文档块", 漏了三件: ① `parent` 在 Notion **只管权限继承**, `content[]` 才管渲染 (两套镜像指针); ② 数据库=带 schema 的 collection 块, 视图=collection 上的查询; ③ relation+rollup 是母题A(指针)与母题B(传播)的**合一**。

```typescript
// lib/types/tandem-node.ts (新增)
export interface TandemNode {
  id: string;
  type: NodeType;                    // 渲染提示, 非结构: 'origin'|'material'|'memory'|'decision_card'|'email'|'im_message'|'doc_block'|'collection'|'row'...
  props: Record<string, unknown>;    // 与 type 解耦 (Turn into 不丢数据); collection 的 schema 也存这里
  content: string[];                 // 向下指针 → render tree (结构/显示)
  parent?: string;                   // 向上指针 → 仅用于权限继承 (Notion 语义, 非结构)
  ownershipLevel: 'personal' | 'team' | 'department' | 'company';  // 沿 parent 树继承 (子节点默认继承父可见性)
  tenantId: string;
  // ── collection 模型 (吸收 Bitable, type='collection' 时用) ──
  schema?: CollectionColumn[];       // 列定义 (含 ai_compute 列 = rollup 的 LLM 变体)
  // ── relation + rollup (母题A↔B 的桥) ──
  relations?: Array<{ field: string; targetNodeIds: string[]; twoWay?: boolean }>;
  rollups?: Array<{ field: string; viaRelation: string; agg: 'sum'|'count'|'min'|'max'|'latest'|'ai' }>;
  createdAt: string;
  updatedAt: string;
  promotionStatus?: 'material' | 'pending' | 'memory';  // 知识层签批 (复用现有 promotion 流)
}

// 视图 = collection 上的查询 (借 Notion collection_view + 复用现有 BitableView)
export interface NodeView {
  id: string; collectionId: string;
  type: 'table' | 'board' | 'calendar' | 'gallery' | 'timeline';
  query: { filters?: unknown[]; sorts?: unknown[]; groupBy?: string };
}
```

### 2.2.1 两套镜像指针 (Notion 核心, 初版漏掉)

```
content[]  向下 → render tree (结构/显示)
parent     向上 → 仅权限继承 (沿树到 root); ownershipLevel 沿此链继承
```

理由 (Notion 官方): 块可被多 content[] 引用 (transclusion) → 用 content 算权限有歧义; 向上遍历查祖先更高效。**Tandem 知识治理直接受益**: 子 material 继承父节点可见性, 不必每节点拍扁平标签。

### 2.2.2 三套并行 rollup 收敛为一套 (最深的教训)

现状 Tandem 有**三套互不相连**的聚合: Bitable `ai_compute` 列 (无 relation/跨表 rollup) / OKR 进度传播 (任务→KR→O) / 知识层 (无)。
Notion 用 **relation + rollup 一套**统一。改后:
- `ai_compute` 列 = `rollups[].agg='ai'` 的一个变体 (保留杀手锏)
- OKR 进度传播 = KR/O 节点间 relation + `agg='sum'` rollup (复用 event-bus `okr.kr-progressed` 触发重算)
- Bitable / OKR / 知识 = **同一 TandemNode collection 引擎的不同 type**

### 2.3 知识 4 层 = 同一原语的 type 跃迁

```
现状 (分仓)                      改后 (统一原语 + type 跃迁)
origins repo    ──┐
materials repo  ──┤ 跨类型搬运    TandemNode(type=origin)
memories repo   ──┘              → Turn into (type=material)  ← 自动
                                 → 三级签批 promotion → (type=memory)  ← §8 流程
                                 邮件/IM 收进来 = TandemNode(type=email/im_message)
                                 → 可 Turn into material → decision_card
```

### 2.4 迁移路径 (不破坏现有, 渐进)
1. **Phase 0**: 新增 `tandemNodes` repo (KvStore), 不动现有 repo
2. **Phase 1**: 新功能 (邮件 IMAP / 统一搜索) 直接落 TandemNode
3. **Phase 2**: origins/materials/memories 写**双写适配器** → 逐步以 TandemNode 为 source of truth
4. **Phase 3**: 旧 repo 变成 TandemNode 上的 typed view (按 type 过滤)
5. **Phase 4 (collection 收编)**: Bitable (`bitableTables`/`bitableViews`) → `TandemNode(type=collection)` + `NodeView`; `ai_compute` 列平移为 `rollups[].agg='ai'`。Bitable 行从表内 inline 升级为可被 relation 链接的子节点。
6. **保留**: DecisionCard/OKR/KPI/Persona 等**强类型实体仍保留各自 repo** (它们是结构化实体, 非"可转换知识")

> **边界 (二分)**:
> - **统一进 TandemNode**: 可转换内容 (origin/material/memory/email/im/doc) + collection 容器 (Bitable)
> - **保持强类型 repo**: 结构化实体 (OKR/KPI/Persona/DecisionCard)
> - **但 rollup 机制统一**: OKR 进度传播 (任务→KR→O) 复用同一 relation+rollup 引擎 (实体仍强类型, 只是聚合计算走统一机制 + event-bus `okr.kr-progressed` 触发)。不为统一数据而统一, 但为统一**聚合逻辑**而统一。

### 2.5 实时与搜索 (借 Notion MessageStore)
- TandemNode 变更 → 复用现有 event-bus 广播 (类比 Notion MessageStore)
- 异步建全局搜索索引 (类比 Quick Find) → 服务"全局搜索回归" (MASTER §4 调整4)

---

## 3. IM seq 主干 (母题 A 子项, 企微灵魂)

### 3.1 问题
`im/service.ts` 用 `unreadCount` 计数器 + `lastReadAt` 时间戳, 无 seq。v2.0 已读回执/响应时效地基不稳。

### 3.2 设计 (借企微序列号)
```typescript
// ImMessage 增加 seq (会话级单调递增)
interface ImMessage { ...; seq: number; }  // 每 channel 单调递增
// ImMembership 改 read cursor
interface ImMembership { ...; readSeq: number; }  // 替代 lastReadAt 主依赖
```
- 未读数 = `channel.maxSeq − membership.readSeq` (派生, 不存计数器)
- 已读回执 = `member.readSeq >= msg.seq`
- 响应时效 = `msg[i+1].createdAt − msg[i].createdAt` (派生)
- seq 生成: channel 级单调 (KvStore 原子自增 or PG sequence)

### 3.3 迁移
保留 `unreadCount`/`lastReadAt` 兼容期双写; 新 UI 走 seq 派生; 稳定后废计数器。

---

## 4. Skill Gateway as MCP server (母题 B + 护城河对外)

### 4.1 目标
把 `runSkillGateway` 表达成 MCP server, 让 Cowork/Claude Code/Cursor 作为 MCP client 接入, 穿过 4 道闸。Tandem = Cowork 的企业治理底座。

### 4.2 MCP 原语映射 (已对账)
| MCP | Tandem |
|-----|--------|
| **tools** (model-controlled) | 企业动作 (开议事室/建决议卡/更新OKR/发IM), 每个挂闸④ Action Scope |
| **resources** (app-controlled) | Memory/OKR 上下文, URI 如 `memory://company/{id}` `okr://kr/{id}`; 复用 govern-persona L1/L2 注入 |
| **prompts** (user-controlled) | 议事室5步 / 3+1 模板 / 复盘模板 |

### 4.3 关键: 治理在协议边界
```
Cowork/Claude Code (MCP client)
    │ tools/call: tandem.convergence.spawn
    ▼
Tandem MCP server (lib/mcp-server/)
    │ 每个 tools/call 先过 governedChat/runSkillGateway 4道闸
    ▼ HARD_BLOCK → JSON-RPC error (转人工)
    ▼ PASS → 执行企业动作 + audit
```
- transport: Streamable HTTP (远程) — MCP 规范支持
- 认证: 复用企业 RBAC, 对齐 MCP Authorization (OAuth Resource Server)
- **与 §19.5 一致**: 组织红线一票否决, 个人 AI 不能解除

### 4.4 企业就绪 (对齐 Cowork 标配)
- audit() 暴露成 **OpenTelemetry** trace (Cowork 用 OTel → SIEM/Compliance API)
- MCP server 的 tools/call / 阻断原因全入 OTel span

---

## 5. 落地优先级与里程碑

| # | 改造 | 风险 | 数据影响 | 优先级 | 里程碑 |
|---|------|------|---------|--------|--------|
| ① | governedChat chokepoint | 低 | 无 | **P0** | T1 (1-2周) |
| ②a | TandemNode 原语 + 新功能落地 | 中 | 新增 repo | **P0** | T1-T2 |
| ②b | 知识4层双写迁移 | 中 | 渐进迁移 | P1 | T3+ |
| ③ | IM seq 主干 | 中 | 双写兼容 | P1 | T2 |
| ④ | Skill Gateway as MCP server | 中 | 无 | P1 | T3 (依赖①稳定) |

### T1 (第一技术里程碑) = ① + ②a
把护城河从纪律变架构 (governedChat) + 引入统一原语地基 (TandemNode 新功能先用)。**这两件让 v2.0 所有对标功能有安全 + 统一的地基。**

---

## 6. 与宪章 v2.0 的一致性检查

| 设计 | 宪章依据 |
|------|---------|
| governedChat zone 组织判定 | §15 "中央 AI 管控发散" + §19.5 组织主权 |
| autonomous fail-closed | §15 绿区自动需 Persona 委托级别 |
| output-guard 内联 | §15 输出经基线矫正 |
| Skill Gateway MCP + 红线一票否决 | §19 组织级网关 + §19.5 红线不可解除 |
| OTel 合规流 | §13 审计可见 (公平底线) |
| TandemNode 签批保留 | §7/§8 Material≠Memory + 三级签批不动 |

---

## 7. 一句话

> **三件地基: ① governedChat 把"无旁路治理"从纪律变架构 (护城河); ② TandemNode 把知识4层从类型孤岛变统一原语 (Notion 灵魂); ③ Skill Gateway as MCP server 让 Tandem 成为 Cowork/个人AI 的企业治理底座 (组织主权护城河对外)。先做 ①+②a，让 v2.0 对标功能有安全+统一地基。**

---

_技术设计草案。竞品灵魂来源见 COMPETITOR-ARCHITECTURE.md，功能蓝图见 MASTER-UPGRADE.md，宪章依据见 MANIFESTO.md v2.0。_
