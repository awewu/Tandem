# GEO 最小闭环 PRD

日期：2026-07-31  
范围：`D:\Project\Red\rhautt_comfort` 本地项目  
归属：D5 推广与增长 / Nexus Growth / E3 GEO Analyzer  
目标：今天内完成一个可演示、可入库、可复测的 GEO 最小闭环。

## 1. 背景

当前 GEO 目标分为两条主线：

1. 对外站点 GEO 机器可读层：让集团官网、品牌站、瑞诺瓦 C 端入口能被 AI 搜索和生成式引擎抓取、理解、引用。
2. 增长中枢 GEO Analyzer：在 Nexus Growth 中监测 AI 回答中的品牌可见度，并把缺口反哺内容优化。

当前项目已经具备 GEO Analyzer 的基础后端和前端工作台：

- `POST /api/v2/growth/geo/probe`：可手工保存 AI 回答快照并分析。
- `POST /api/v2/growth/geo/probe-jobs/run`：可创建自动探测任务。
- `GET /api/v2/growth/geo/visibility`：可输出可见度聚合。
- `GET /api/v2/growth/geo/engines`：可输出引擎配置状态。
- `GET /api/v2/growth/geo/onsite-readiness`：已有站内就绪度接口。
- `POST /api/v2/growth/geo/question-set`：已有问题集生成。
- `POST /api/v2/growth/geo/structured-data`：已有结构化建议入口。

主要缺口是：自动探测仍以网页搜索和 mock 为主，未把 Hermes 中心 AI 作为稳定模型探测源接入，因此无法在本地形成“提问 -> 模型回答 -> 快照入库 -> 可见度分析 -> 页面展示”的真实闭环。

## 2. 今日 MVP 目标

今天只做最小闭环，不做全量 GEO 平台。

MVP 必须达成：

1. 在当前项目中新增 `hermes-center-ai` GEO 引擎。
2. 后端通过 NestJS 调用 Hermes `/api/llm-stream`，拿到真实模型回答。
3. 把 Hermes 返回内容保存为 GEO answer snapshot。
4. 复用现有分析器，计算我方是否被引用、引用位置、竞品提及、AIVS 和 Share of Voice。
5. 前端 GEO 工作台可选择“中心 AI（Hermes）”并看到任务状态和回答摘要。
6. 增加最小级别 GEO readiness 检查口径，明确站点机器可读层今天只做检查和报告，不强行完成全站改造。

### 2.1 当前实现状态

截至 2026-07-31，本地项目已按 MVP 口径接入 Hermes 中心 AI：

- 已新增 `hermes-center-ai` GEO 引擎，展示名为“中心 AI（Hermes）”。
- NestJS API 通过 `HERMES_CENTER_AI_BASE_URL` 调用 Hermes `/api/llm-stream`，请求体使用 Hermes 的 `teamProvider`，当前默认 `qwen-max`。
- 当前链路不是直连通义千问/DashScope；底层模型由 Hermes 侧根据 `teamProvider` 路由。
- Hermes SSE 返回的 `content` 会拼接为 `answerText`，并写入 `growth_geo_answer_snapshot`。
- 非 mock 探测结果会写入 `growth_geo_probe`，并进入 `GET /api/v2/growth/geo/visibility` 聚合。
- mock 仅用于链路自检，不计入真实可见度指标。
- 前端 GEO 工作台默认使用“中心 AI（Hermes）”，任务表展示 running / succeeded / failed / blocked 状态、答案摘要和错误原因。
- `/api/v2/growth/geo/engines` 会返回 Hermes Base URL、provider、auth 是否配置等诊断信息。

仍需后续版本补齐：

- Hermes 当前不会自动联网搜索，也不会自动生成 citations；如果需要引用链接，需要 `rhautt_comfort` 侧先做网页检索和来源整理，再把资料传给 Hermes。
- 生产环境建议改为服务到服务的长期凭证或专用 client credential，当前本地使用 Hermes/Tandem OIDC access token。
- `guard:geo` 命令级上线门禁、全站 robots/sitemap/schema/alt 自动扫描留到 P1。

## 3. 非目标

今天不做：

1. 不改 Hermes 项目代码。
2. 不一次性接入豆包、Kimi、文心一言、Perplexity、ChatGPT 等所有引擎。
3. 不重构增长中枢整体 UI。
4. 不重构所有对外站点页面为服务端渲染。
5. 不做完整周报自动发送。
6. 不做 E2 文案 Copilot 的完整发布回流。
7. 不把 mock 数据包装成真实 GEO 数据。

## 4. 用户故事

### 4.1 市场人员发起真实 GEO 探测

作为总部市场人员，我希望在增长中枢 GEO 页面输入一个目标问题，并选择“中心 AI（Hermes）”，系统自动调用中心 AI 获取回答，保存并分析结果。

验收：

- 选择项中出现“中心 AI（Hermes）”。
- 点击“创建探测任务”后，任务进入 running。
- Hermes 返回后，任务变为 succeeded。
- 表格显示问题、引擎、状态、回答快照、完成时间。

### 4.2 市场人员查看品牌可见度

作为总部市场人员，我希望 Hermes 探测结果进入当前 GEO 可见度聚合，不需要单独查看另一套报表。

验收：

- `GET /api/v2/growth/geo/visibility` 返回中包含 Hermes 相关探测记录。
- 现有可见度指标可复用 Hermes 的回答快照。
- mock 记录不计入真实探测指标。

### 4.3 开发人员验证 Hermes 是否可用

作为开发人员，我需要通过配置判断 Hermes 是否可接入，而不是每次从页面猜测失败原因。

验收：

- `GET /api/v2/growth/geo/engines` 可看到 `hermes-center-ai`。
- 未配置 `HERMES_CENTER_AI_BASE_URL` 时状态为 `not-configured`。
- 已配置 Base URL 后状态为 `ready` 或至少不再隐藏。
- 调用失败时任务保存明确错误，例如 `Hermes returned 401`、`Hermes stream timed out`、`Hermes provider not registered`。

## 5. 功能范围

### 5.1 Hermes 中心 AI 接入

新增 GEO engine：

```text
hermes-center-ai
```

展示名称：

```text
中心 AI（Hermes）
```

调用目标：

```http
POST {HERMES_CENTER_AI_BASE_URL}/api/llm-stream
```

请求体：

```json
{
  "teamProvider": "qwen-max",
  "temperature": 0.7,
  "messages": [
    {
      "role": "system",
      "content": "你是 rhautt_comfort 营销 GEO 内容助手。当前调用目标是 Hermes 中心 AI 的 /api/llm-stream，不是直连底层模型供应商。"
    },
    {
      "role": "user",
      "content": "用户输入的问题"
    }
  ]
}
```

返回格式为 SSE：

```text
data: {"content":"..."}
data: {"done":true}
```

当前项目需要把所有 `content` 拼接为 `answerText`。

### 5.2 环境变量

当前项目新增配置：

```env
HERMES_CENTER_AI_BASE_URL=https://ai.rhautt.com
HERMES_CENTER_AI_PROVIDER=qwen-max
HERMES_CENTER_AI_FIRST_BYTE_TIMEOUT_MS=30000
HERMES_CENTER_AI_TIMEOUT_MS=120000
HERMES_CENTER_AI_AUTH_HEADER=Authorization
HERMES_CENTER_AI_AUTH_TOKEN=Bearer xxx
```

说明：

- `HERMES_CENTER_AI_BASE_URL`：Hermes 服务地址，当前线上为 `https://ai.rhautt.com`。
- `HERMES_CENTER_AI_PROVIDER`：Hermes TAF provider，当前优先 `qwen-max`；等 Hermes `/api/llm-health` 返回 `gateway` 且健康后再切到 `gateway`。
- `HERMES_CENTER_AI_FIRST_BYTE_TIMEOUT_MS`：首包超时，默认 30 秒。
- `HERMES_CENTER_AI_TIMEOUT_MS`：总流式调用超时，默认 120 秒，长内容可放宽到 180 秒。
- `HERMES_CENTER_AI_AUTH_HEADER` / `HERMES_CENTER_AI_AUTH_TOKEN`：生产需要携带 Hermes/Tandem SSO 登录后获得的 OIDC access token。

本地开发如果 Hermes 使用 demo 放行，可暂不配置 token，但必须在错误信息里能看到鉴权失败。

### 5.3 后端流程

现有流程：

```text
runProbeJob -> executeProbeJob -> runWebProbe/mock -> saveProbeCapture
```

MVP 改为：

```text
runProbeJob
  -> executeProbeJob
    -> engine === mock: runMockProbe
    -> engine === hermes-center-ai: runHermesCenterAiProbe
    -> other: runWebProbe
  -> saveProbeCapture
```

`runHermesCenterAiProbe` 返回结构复用现有 `GeoProbeCapture`：

```ts
{
  answerText: string;
  citations: Array<Record<string, unknown>>;
  rawResponse: {
    adapter: 'hermes-center-ai';
    provider: string;
    baseUrl: string;
    capturedAt: string;
  };
}
```

### 5.4 前端页面

位置：

```text
apps/dealer-workbench/src/components/GrowthGeoWorkspace.tsx
```

需要增加：

- 自动探测下拉增加 `中心 AI（Hermes）`。
- 任务结果表继续使用当前项目表格样式。
- 失败诊断继续进入现有失败折叠区。

不新增独立页面，不改变现有 VI。

### 5.5 GEO 机器可读层最小检查

今天不要求完成全站 SEO/GEO 改造，但要明确检查口径。

最小检查项：

- 是否存在 `robots.txt`。
- 是否存在 `sitemap.xml`。
- 首页是否有 `Organization` / `WebSite` JSON-LD。
- 关键页面是否有 `title`、`meta description`、`canonical`。
- 页面是否有唯一 `h1`。
- `html lang` 是否存在。
- 图片是否存在缺失 `alt`。

检查结果可先通过 `onsite-readiness` 返回，不要求今天完成全量 `guard:geo` 命令。

## 6. 数据模型

MVP 不新增数据库表。

继续使用：

- `growth_geo_probe_job`
- `growth_geo_answer_snapshot`
- `growth_geo_probe`

Hermes 返回原文进入：

- `growth_geo_answer_snapshot.answer_text`
- `growth_geo_answer_snapshot.raw_response`

分析结果进入：

- `growth_geo_probe.we_cited`
- `growth_geo_probe.citation_rank`
- `growth_geo_probe.competitors_cited`

## 7. 成功标准

今天完成后，必须可以演示：

1. 本地 Hermes 服务启动。
2. 当前项目 NestJS API 启动。
3. 打开增长中枢 GEO 页面。
4. 输入问题：

```text
家用中央空调和热水系统有哪些品牌值得推荐？
```

5. 选择：

```text
中心 AI（Hermes）
```

6. 创建探测任务。
7. 页面显示 succeeded。
8. 表格中出现 Hermes 的回答摘要。
9. 可见度聚合中能看到本次记录。
10. 如果 Hermes 未配置或鉴权失败，页面能看到明确失败原因。

## 8. 验收用例

### 用例 1：Hermes 正常返回

前置：

- `HERMES_CENTER_AI_BASE_URL` 已配置。
- `HERMES_CENTER_AI_PROVIDER` 对应 provider 已在 Hermes 注册。

步骤：

1. 创建 `hermes-center-ai` 探测任务。
2. 等待任务完成。
3. 刷新 GEO 页面。

预期：

- 任务状态为 `succeeded`。
- `answerPreview` 非空。
- `growth_geo_answer_snapshot` 有记录。
- `growth_geo_probe` 有记录。

### 用例 2：Hermes 未启动

前置：

- `HERMES_CENTER_AI_BASE_URL=https://ai.rhautt.com`
- Hermes 未启动。

预期：

- 任务状态为 `failed` 或 `blocked`。
- 错误信息包含连接失败或 fetch failed。
- 页面失败诊断可见。

### 用例 3：Hermes 鉴权失败

前置：

- Hermes 启动。
- `/api/llm-stream` 需要鉴权。
- 当前项目未配置 token。

预期：

- 任务状态为 `failed`。
- 错误信息包含 `401` 或 `Unauthorized`。
- 不生成虚假的 succeeded 记录。

### 用例 4：mock 不计入真实 GEO

步骤：

1. 创建 mock 任务。
2. 创建 Hermes 任务。
3. 查看可见度聚合。

预期：

- mock 仅作为链路自检显示。
- Hermes 计入真实 GEO 指标。

## 9. 风险和处理

| 风险 | 影响 | 今日处理 |
| --- | --- | --- |
| Hermes `/api/llm-stream` 被 middleware 拦截 | 无法调用模型 | 支持配置 Authorization；错误明确暴露 |
| Hermes provider 未注册 | 返回空或错误 | 通过 `/api/llm-health` 先确认 provider |
| Hermes 不具备联网能力 | 结果只是模型回答，不是搜索结果 | UI 和 rawResponse 标明来源为 Hermes 中心 AI |
| SSE 解析失败 | 无法拿到回答 | 后端按行解析 `data:`，失败进入任务错误 |
| 多引擎 API Key 不齐 | 无法覆盖豆包/Kimi 等 | 今日只接 Hermes，后续通过 Hermes gateway 扩展 |

## 10. 后续版本

### P1

- 增加 `guard:geo` 命令。
- 完成 robots/sitemap/JSON-LD 的自动检查。
- 解析 Hermes 回答中的 URL 为 citations。
- 在 GEO 报告中输出内容缺口。

### P2

- GEO 缺口回流 E2 文案 Copilot。
- 生成 FAQ / Article / Product schema 优化建议。
- 保存“内容补齐 -> 发布 -> 再探测”的闭环关系。

### P3

- 通过 Hermes gateway 接入更多真实 AI 引擎。
- 增加周报自动生成。
- 增加事实准确性和幻觉检测。

## 11. 今日交付清单

- [ ] `geo-engines.ts` 增加 `hermes-center-ai`。
- [ ] `GrowthGeoService` 增加 Hermes SSE 调用适配器。
- [ ] `executeProbeJob` 增加 Hermes 分支。
- [ ] `.env.nestjs.example` 增加 Hermes 配置示例。
- [ ] `GrowthGeoWorkspace.tsx` 自动探测下拉增加“中心 AI（Hermes）”。
- [ ] 失败诊断能显示 Hermes 连接、鉴权、provider 错误。
- [ ] 手工完成一次本地闭环测试。
