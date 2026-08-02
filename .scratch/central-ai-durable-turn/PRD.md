# PRD · 中央AI 持久化对话 Turn + 会话租约 + 上下文压缩落库

- 状态: Draft
- 作者: (Tandem 中央AI 演进)
- 来源: 对照 `yc-software/qm` 编排机制后提炼；本文件只覆盖 qm 启发中最高 ROI 的两项
- 分支: `main`
- 关联铁律: AGENTS.md「Durable by default」「Fixes should make the system simpler」「Solve at the layer all paths flow through」

---

## 0. 背景与现状（已核对真实源码）

Tandem 中央AI / 个人分身的一次"回复"目前在 `lib/im/service.ts` 里以 `invokePersonaReply` / `invokeCompanyBrainReply` 触发，走唯一治理出口 `lib/governance/governed-chat.ts` 的 `governedChat`。

已经做得好的（**不改**）：

- 治理即架构：`governedChat` 四闸（baseline+OKR+价值观 → skill-gateway 动作闸 → router → 输出闸 LLM-judge 矫正）。
- 模型层 `lib/taf/router.ts`：场景路由 + 有序 fallback + 中继站网关 + `forceProvider` + FC 能力过滤 + `LlmUsageLog` 用量/成本埋点。
- IM 消息本身已持久化：`store.imMessages`（可按 channel 列，已有 `im-messages-by-channel` 索引与测试）。
- 单飞行锁原语已存在：`lib/infra/leader.ts` 的 `withCronLock`（Redis `SET NX PX` + Lua 原子释放，无 Redis 时 fail-open）。
- 记忆侧压缩已存在但**属另一范畴**：`lib/memory/compression.ts`（SimpleMem 长期记忆蒸馏）、`lib/memory/consolidation.ts`（GAM 候选整合）——这些是**长期记忆 RAG**，不是对话窗口 turn 压缩，本 PRD 不与其重叠。

两个真实缺口（本 PRD 目标）：

### 缺口 A — 没有"对话 Turn"抽象，也没有会话级并发串行化
`lib/im/service.ts` 每来一条触发消息就直接起一次回复，无 turn 记录（状态/尝试次数/归属），无锁。同一分身/同一频道被连续 @ 时会**并发执行**，可能重复回复、重复写 ProxyAction、重复 escalate。对照 qm：qm 的脊梁是 `acquireLease(session,"turn")`——一会话同时只跑一个 turn，抢不到即 "session busy"。

### 缺口 B — LLM 调用不带对话历史；已有的 `compactMessages` 未接线、未落库、按字符
`invokePersonaReply` 传给 `governedChat` 的 `messages` 只有**单条触发消息**（`lib/im/service.ts` L954），不含此前对话历史 → IM 回复实际是**单轮无状态**。`lib/agent-runtime/compaction.ts` 的 `compactMessages` 已实现但：
1. 未被 IM turn 路径调用；
2. 触发阈值用**字符数 24000**，却无视 `ProviderCapabilities.maxContextTokens`（`lib/taf/provider/types.ts` 已声明）；
3. 每次对全量数组重算，摘要只在内存里，**不落库**、下次从头再压。

---

## 1. 目标 / 非目标

**目标**
1. 引入持久化 `ConversationTurn` 记录 + 会话级租约，使同一会话（channel × 目标分身）的 turn **串行、可恢复、跨副本安全**。
2. 让 IM 回复带**对话历史**，并用**按 token 预算 + 落库复用**的压缩喂给 `governedChat`（不绕过治理）。

**非目标（明确不做）**
- 不改动 `governedChat` 的治理语义与四闸；历史消息作为 `messages` 上下文照样过治理。
- 不重写 `lib/memory/*`（长期记忆压缩/整合是另一条线）。
- 不在本 PRD 落"安全姿态 strict/auto/dangerous"（列为后续，见 §7）。
- 不新造分布式锁：**复用/推广** `withCronLock`，不引入新依赖或新抽象层。

---

## 2. 设计

### A. 持久化 Turn + 会话租约

**A1. 数据模型（`lib/infra/drizzle-schema.ts` 新增一表，遵循现有 pgTable 风格）**

`conversation_turns`：
- `id` (pk)
- `tenantId` (default 'default')
- `conversationKey` (text, = `channelId:targetUserId`，即"会话"粒度)
- `channelId` / `targetUserId`
- `triggerMessageId`
- `status`: `running | ok | failed | skipped_busy`
- `attempt` (int, default 1)
- `leaseOwner` (text, 实例 id) / `leaseExpiresAt` (timestamp)
- `replyMessageId` (nullable)
- `aiTraceId`（复用现有 IM trace，串 `LlmUsageLog.requestId`）
- `createdAt` / `updatedAt`
- 索引：`(conversationKey, status)`、`(tenantId)`、`(triggerMessageId)`

`store` 侧按现有 repository 抽象加 `store.conversationTurns`（对齐 `imMessages`/`memories`/`tenantAiPolicies` 的用法）。

**A2. 会话锁（推广 `lib/infra/leader.ts`）**

在 `leader.ts` 增补一个与 `withCronLock` 同构的 `withConversationLock(conversationKey, ttlMs, fn)`：
- 键 `conv:lock:${conversationKey}`，`SET NX PX` 抢锁，Lua 原子释放；
- 抢不到 → 返回 `{ ran:false }`，调用方据此把本 turn 记为 `skipped_busy` 并给用户轻提示（或排队，见下）；
- 无 Redis（单进程）→ 直接执行（与现状零回归）。
- ttl 取"单 turn 最坏时长"（含 governedChat + tool-loop），建议 60s，可配。

> 复用理由：qm 用 Postgres advisory lease；Tandem 已有 Redis 单飞行原语，直接推广更简单，符合「make it simpler」。turn **状态与恢复**靠 A1 的表（durable），锁只负责"同一时刻单飞行"。

**A3. 接入点（`lib/im/service.ts`）**

`invokePersonaReply` / `invokeCompanyBrainReply` 外层包一层：
```
turn = conversationTurns.create({status:'running', attempt, lease...})
res  = await withConversationLock(convKey, ttl, () => <现有回复主体>)
if (!res.ran) conversationTurns.update(turn, {status:'skipped_busy'})  // 提示"正在回复上一条，请稍候"
else          conversationTurns.update(turn, {status:'ok'|'failed', replyMessageId})
```
主体逻辑（persona 门控 / provider 解析 / governedChat / sendMessage）**保持不变**。

### B. 对话历史 + 压缩落库（按 token）

**B1. 组装历史**：turn 主体在调 `governedChat` 前，用 `store.imMessages` 按 `channelId` 拉最近 K 条（排除系统提示噪声），映射为 `ChatMessage[]`（user/assistant 交替）。

**B2. 升级 `compactMessages`（`lib/agent-runtime/compaction.ts`）**
- 触发口径从"字符阈值"改为"token 预算"：优先用当前 provider 的 `capabilities.maxContextTokens`（`router.resolveActiveModel(scenario)` 拿到 provider → capabilities），无则回退现字符阈值（零回归）。
- **摘要落库**：新增 `store.conversationSummaries`（或复用 `conversation_turns` 旁挂一行 `context_summary`），key = `conversationKey`，字段 `throughMessageId`/`summaryText`/`updatedAt`。下次 turn 直接读已有摘要 + 增量最近轮，**不再从头重压**（对齐 qm 的"摘要写成持久 entry，算一次复用"）。
- 保留现有 fail-soft（摘要失败→硬截断），保留"便宜场景摘要"（`high_frequency`）。

**B3. 喂给治理出口**：把 `[summaryBlock?, ...recentTurns, {role:'user', 触发消息}]` 作为 `governedChat.messages` 传入——**历史仍全程过治理**，不新增旁路。

---

## 3. 具体改造点（文件级）

| 文件 | 改动 |
|---|---|
| `lib/infra/drizzle-schema.ts` | 新增 `conversation_turns`（+ 可选 `conversation_summaries`）表 + 索引 |
| `lib/storage/*`（repository 抽象） | 暴露 `store.conversationTurns`（+ `conversationSummaries`），对齐现有集合写法 |
| `lib/infra/leader.ts` | 增补 `withConversationLock`（与 `withCronLock` 同构） |
| `lib/agent-runtime/compaction.ts` | 触发改按 token 预算；摘要落库 + 复用；保留 fail-soft/硬截断 |
| `lib/im/service.ts` | `invokePersonaReply`/`invokeCompanyBrainReply` 包 turn 记录 + 会话锁；调用前组装历史 + `compactMessages` |
| `scripts/` | 一支迁移脚本建表（对齐现有 `scripts/migrate-*.mjs` 风格） |
| `tests/unit/` | 新增：turn 串行/租约、compaction 按 token + 落库复用、历史组装 |

---

## 4. 验收 / 门禁

- 单测：`npm run test` 覆盖新增 turn/lock/compaction；沿用 `tool-loop-trace`/`attribution-eval-trace` 风格。
- 全量自检：`npm run harness`（quick）→ `npm run harness:ci`（含 build + lint）。
- 迁移：`npm run db:push`/迁移脚本后 harness `database` 检查通过。
- 行为验收：
  - 同一分身 200ms 内连发两条 @ → 第二条 `skipped_busy`，不产生双回复/双 ProxyAction。
  - 长会话（> token 预算）→ 摘要落库一次，二次 turn 读到已存摘要、无重复摘要模型调用（查 `LlmUsageLog`）。
  - 无 Redis 环境 → 行为与现状一致（fail-open）。

## 5. 回滚 / 灰度

- 会话锁 + 历史组装用 env flag（如 `TANDEM_DURABLE_TURN=1`）默认关，灰度开启；关闭时完全走现有单条路径，零回归。
- 所有新写入 fail-soft：turn 记录/摘要落库失败不得阻断回复主流程（对齐仓库 fail-soft 纪律）。

## 6. 风险

- 会话锁 ttl 过短 → 长 turn 期间被另一副本接管：ttl 需 ≥ 单 turn 最坏时长；turn 表状态是最终真相，锁只防并发。
- 历史带入 token 成本上升：由 B2 token 预算 + 落库摘要抵消；`high_frequency` 场景可设更小 K。
- Redis 不可用时无跨副本串行化：可接受（fail-open），生产已有 Redis。

## 7. 后续（不在本 PRD）

- 安全姿态 strict/auto/dangerous 落到 `lib/settings/tenant-ai-policy.ts`（现有白名单/配额之上）。
- 危险动作人在环 + 持久授权（once/session/always）接入 skill-gateway 动作闸。
- 可重放 tape 喂 `lib/eval/*`（现 `trace` 易失）。
