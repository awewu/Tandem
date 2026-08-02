# Tandem 战略盘点 — 2026 W31 (07-26 → 08-02)

> 结合本周 git 历史 + 代码体系核查 + 当前企业级 AI 行业/竞品/开源调研。
> 关联：`STATE-OF-THE-CODE-2026-08.md`（并行窗口错乱恢复）。

## 一、本周更新总览
- **51 次提交 · 703 文件 · +83,736 / −6,148 行**
- 变更热区：`app/api`(115) · `tests/unit`(90) · `android/ios-shouchao`(69) · `lib/comp`(27) · `lib/pms`(20) · `lib/persona`/`memory`/`agent-runtime`/`ontology`

五条主线同时推进，且每条均踩中当前企业级 AI 主流演进方向。

## 二、五大更新主线 + 价值（对标行业趋势）

### 1. 记忆升维：MAGMA-lite 时间/因果链
`lib/memory` 的 `buildEntityTimeline`、`memory.timeline` 读技能接入中央 AI LIVE（Path A），KR 记忆演进 + 版本取代 + 空链路回归。
- **价值**：正踩中 2026 最热的 **Context Graph（决策图谱）** 赛道。Foundation Capital(2025.12)、Gartner、a16z《Big Ideas 2026》断言下一个万亿级企业软件是"决策轨迹图谱"（谁/在何约束下/为何决策，按时间缝合成可搜索先例）——"systems of decisions"。开源侧 Zep/**Graphiti**（LongMemEval 榜首）、Mem0、Letta 抢位。Tandem 属独立收敛到正确方向。

### 2. 本体安全：marking / purpose 门控
`lib/ontology` Phase1-3 —— marking/purpose 原语 + 核心对象密级 + `executeAction` 按 objectType marking 门控写动作。
- **价值**：迷你 Palantir。Foundry/AIP 护城河即 "ontology + purpose-based access + 动作可审计"，Palantir 被 Dresner 评 2025 年第一 Agentic AI 厂商。LLM 审计留痕已是董事会级议题。

### 3. 自适应编排：AdaptOrch 拓扑门控
`lib/agent-runtime` —— 按 query 复杂度自适应收紧轮次/token，拓扑决策写入 eval trace；配套 `lib/eval`（pass-k / graders / failure-attribution / summary）。
- **价值**：Agentic 编排+记忆市场 2025 $62.7 亿 → 2030 $284.5 亿（CAGR 35%）。CIO 选型三指标：并发下延迟、发布安全、全链路留痕——Tandem 全部命中。自带 eval harness 是真实工程实力（对标 LangSmith/LangTrace）。

### 4. 薪酬模块（comp）从零落地
`lib/comp` —— comp matrix 版本、职级变更日志、员工职级、季度门控、修订签批。
- **价值**：对标用友 BIP 2025.08 "薪酬智能助理"，Tandem 建成带版本/签批/审计的治理对象，更深一层。

### 5. PMS × 中央 AI 感知 + 移动端产品化
`pms.pipeline_digest` 只读感知 skill、撞单申诉裁定、商机报备审核、deal-desk 双分支、释放公海治理链、驾驶舱 AI 下一步建议；iOS/Android 独立"搭子手抄"App + 语音转写；Windows 蓝绿部署自动化。
- **价值**：对标飞书 aily 业务助手。差异点：**AI 感知与写动作分离、全部过治理链**，非直接自动执行。

## 三、竞品与行业坐标
| 玩家 | 定位 | 与 Tandem 关系 |
|---|---|---|
| Palantir Foundry/AIP | Ontology OS，#1 Agentic 厂商 | 本体+marking 是同范式民企轻量版 |
| Glean（$7.2B/$200M ARR） | Work Graph + 企业搜索 + 权限感知 + trace learning，250+ 连接器 | Tandem 缺连接器生态 + 搜索深度 |
| C3 / Scrydon | 统一 ontology graph + 治理编排 | 理念一致，Tandem 更垂直 |
| 飞书 aily / 钉钉 / 企业微信 / 用友 BIP | 国内办公 Agent：multi-agent、记忆隔离、MCP 连接器、版本 diff+回滚、知识空间 | 最直接竞品；Tandem 强在治理/战略留痕，弱在易用/生态/多模型 |
| OSS：LangGraph(38k★)/CrewAI(56k★)/LangMem/Graphiti/Mem0 | 编排与记忆基座 | 全自研 TAF 可控但重复造轮子，落后社区记忆基准 |

**定位**：Tandem ≈ Palantir 本体治理 + Glean work graph + 飞书场景化，但聚焦"决策留痕 + 战略坚守"（与 StratOS 同源）——别家最弱、2026 最值钱的一块。

## 四、现存问题（已核查代码 · 含二次修正）
> 二次核查修正：初版把「多模型」「多租户」列为主要缺口——实为**误判**。两者代码均已建成并接线，见下。

1. **多模型路由：代码已建成，缺的是 key/配置** — `TandemRouter`（`lib/taf/router.ts`）已含场景路由 + fallback 链 + 可恢复错误重试 + 流式 fallback + 全失败告警 + 用量埋点 + 中继网关（`LLM_GATEWAY_*`）；`createDefaultRouter()` 自动注册所有配了 key 的 provider。**真实差距 = 生产 `.env` 只配了 `DEEPSEEK_*`**，补 `ANTHROPIC/OPENAI/DOUBAO` key 即多模型上岗，无需写码。
2. **多租户隔离：已建成且已激活** — `lib/storage/tenant-scope.ts`（ALS 作用域）+ `with-api-log.ts:146` 已在**每个非匿名 API 边界** `runInTenantScope(actor.tenantId)`；含单测 + integration-db 测试。差距仅在「目标形态 SaaS 的运营层」（计费/开户/配额），非隔离机制本身。
3. **互操作性单向（真缺口）** — 仅做 MCP 消费方（`mcp-client`/`mcp-bridge`），不暴露 MCP Server、不支持 A2A；技能/动作无法被飞书 aily/Claude/其他 agent 调用。
4. **记忆无专用向量/图存储（真缺口）** — MAGMA-lite 跑在 KvStore/Postgres，无向量库；语义召回规模化吃力，无 LongMemEval 式基准。
5. **无连接器/企业搜索层（真缺口）** — 对标 Glean 250+ connectors，Tandem 仅零星接入，缺统一 connector 与 GraphRAG。
6. **工程纪律** — 本周并行窗口丢代码事故（靠 stash@{4} 救回）；547 处 UI-charter 债务需清零。
7. **治理闭环缺外部可验证** — eval harness 强，但无行业标准 benchmark/合规认证背书。

## 五、进化路线
### 近期（自用优先）
- **激活多模型（配置，非开发）**：生产 `.env` 补 `ANTHROPIC/OPENAI/DOUBAO` key（或配 `LLM_GATEWAY_*` 中继网关一处切换），路由与 failover 立即生效。
- **暴露 MCP Server + A2A（本轮首选 code 开工）**：把 `skillRegistry` 只读技能包成 MCP Server（stdio/HTTP-SSE），让 Tandem 能被外部 agent 编排；这是唯一「真缺口 + well-scoped + 踩中行业 table-stakes」的近期项。
- 工程护栏：pre-commit 强制 + CI 阻断长期悬空未提交。

### 中期（护城河）
- 将 MAGMA-lite 显式升级为"决策图谱 / Context Graph"（节点=决策+理由+约束+时间戳，接 pgvector/Graphiti），与 StratOS 战略坚守咬合。
- 暴露 MCP Server + A2A，双向互操作，嵌入飞书/钉钉生态。
- 完成 `tenant-scope` 多租户隔离 → 打开 SaaS 门。

### 长期
- Connector 层（对标 Glean）：飞书/钉钉/企业微信/邮件/ERP/财务 → 喂决策图谱。
- 对外定位："OKR 驱动本体治理 + 中央 AI + 决策图谱"三合一，主打中国民营企业"战略坚守 + 决策留痕"。

## 结论
本周四条主线方向全对、踩中 2026 最值钱赛道；短板在**多模型韧性、记忆存储规模化、互操作开放、平台工程纪律**四项地基。补齐地基 + 把"决策图谱×战略坚守"做成尖刀，Tandem 有机会成为差异化很强的国产企业级 AI OS。
