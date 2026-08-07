# 契约 · Tandem 中央治理 AI（governed-chat）

> 决策(§7-3)：Nexus 营销/GEO/问诊/陪跑等 AI 一律**收口到 Tandem 中央治理 AI**。本契约定义 Nexus(消费方) 与 Tandem(提供方) 的接口边界。
> 三产品收敛：**Tandem = 中央治理大脑；Nexus / StratOS = 消费方**。

## 提供方 / 消费方
- **提供方**：Tandem 仓（`github.com/awewu/Tandem.git`），需**新建** `POST /api/ai/governed-chat`（跨仓伴随任务）。
- **消费方**：Nexus `services/api/src/modules/growth/ai-gateway.service.ts` 现有 `provider:'hermes-center-ai'` → 升级指向本契约。

## 现状（已有半成品，勿重造）
`ai-gateway.service` 的 `callHermesCenterAi()` 已 `fetch(${HERMES_CENTER_AI_BASE_URL}/api/llm-stream)`（SSE，teamProvider 默认 qwen-max），并内置 `scanCompliance`(广告法禁语) + draft 默认 + 成本标注 + fail-soft 回落确定性桩。
→ **升级路径**：把目标从 `/api/llm-stream`（裸流）改为 `/api/ai/governed-chat`（带治理闸），保留本地合规兜底。

## 接口
```
POST {HERMES_CENTER_AI_BASE_URL}/api/ai/governed-chat
Headers: {HERMES_CENTER_AI_AUTH_HEADER}: {HERMES_CENTER_AI_AUTH_TOKEN}   (服务令牌)
```
**请求**
```json
{
  "scenario": "growth.copy | growth.geo | diagnosis.consult | crm.sales_coach | competitor.brief",
  "purpose": "string(用途,进审计)",
  "tenantId": "string",
  "actor": { "userId": "string", "role": "string" },
  "messages": [ { "role": "system|user|assistant", "content": "string" } ],
  "factRefs": [ { "type": "product|standard", "id": "string" } ],
  "bannedTerms": ["string"],
  "stream": false
}
```
**响应**
```json
{
  "ok": true,
  "answer": "string",
  "blocked": false,
  "blockReason": null,
  "model": "string(实际模型)",
  "usage": { "inputTokens": 0, "outputTokens": 0, "costEstimate": 0 },
  "auditId": "string"
}
```

## 治理闸（Tandem 侧，四闸，呼应 governedChat）
1. **基线闸**：场景/角色鉴权（服务令牌 + scenario 白名单）。
2. **合规词闸**：广告法禁语/竞品抹黑/虚假承诺 → `blocked=true`。
3. **事实链闸**：`factRefs` 注入产品真参数/国标；产出**不得回写**精算内核/产品可信链。
4. **输出闸**：对外可见产出默认 `draft` 语义（核准在 Nexus 各引擎 service）。
+ 每次调用记 model/tokens/cost/prompt 版本 → Tandem 审计（`auditId` 回传）。

## Fail-soft（Tandem 未就绪/超时）
Nexus 侧回落顺序：`governed-chat` → 现有 `hermes-center-ai /api/llm-stream` → 确定性桩（`stub:deterministic`）。**Nexus 本地 `scanCompliance` 始终兜底**，不因中央 AI 不可用而漏合规。

## 环境变量（Nexus）
`HERMES_CENTER_AI_BASE_URL` · `HERMES_CENTER_AI_AUTH_HEADER` · `HERMES_CENTER_AI_AUTH_TOKEN` · `HERMES_CENTER_AI_PROVIDER`（模型偏好，可插拔 DeepSeek/豆包/通义/qwen…）。

## 验收
- Nexus：`ai-gateway` 单测覆盖 governed→llm-stream→stub 三级回落；`requireRealProvider` 场景真模型探针（防假闭环）。
- Tandem：`/api/ai/governed-chat` 契约测试（四闸 + 审计 + 成本计量）。
