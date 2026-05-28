# Tandem · AI 能力 Backlog

> 雷达扫到的、过了 4 道闸门、值得评估的 AI 能力候选清单。
>
> **每季度 review 一次**，重新打分排序。完成的归档到底部 `## 已完成`。
>
> 协作文档: `ROADMAP-AI.md` (策略框架) · `AI-RADAR.md` (信号扫描)

---

## 评估维度（每条 backlog 必填）

| 字段 | 说明 |
|---|---|
| **ID** | `B-NNN` 三位数字，永久不变 |
| **能力** | 一句话描述要做什么 |
| **来源** | 雷达哪个月扫到的 / 来自哪个 provider |
| **解谁的痛** | 具体用户场景，不能是抽象的"提升体验" |
| **接入成本** | 1 (≤1天) / 2 (1-3天) / 3 (1-2周) / 4 (>2周) |
| **价值** | 1 (锦上添花) / 2 (有用) / 3 (强需求) / 4 (战略级) |
| **状态** | 观察 / 待评估 / 进 sprint / 已完成 / 已丢弃 |
| **拥有者** | 谁负责跟进 |

**优先级 = 价值 - 接入成本**。> 0 才考虑做。

---

## 当前 Backlog（按优先级降序）

### 🔴 战略级 / 高优先 · OKR-DRIVEN 灵魂层 (2026-05-27/28 立项)

> 这 4 条来自 `docs/OKR-DRIVEN-ARCHITECTURE.md` § 三 14→18 器官升级. 是 Tandem 从"组件集合"晋级"企业级 Agent"的第一性原理落地. 优先级一律 +战略级.

#### B-014 · OKR Anchor 注入器 (CompanyBrain system prompt) ✅ **已完成 (2026-05-28)**

- **来源**: OKR-DRIVEN §三 第1条 (企业 AI = 组织目标聚焦达成)
- **解谁的痛**: CompanyBrain 此前不知道公司在追什么 OKR, 任何答复都不能聚焦战略目标
- **接入成本**: 1 (实际 ~1h)
- **价值**: 4 (战略级)
- **状态**: ✅ **已完成**
- **拥有者**: Cascade
- **交付物**:
  - `lib/persona/company-brain.ts` 新增 `buildOkrAnchorContext()` — 拉 active 周期公司层 Objective + KR 进展 + at-risk 标记
  - `buildCompanyBrainSystemPrompt()` 嵌入 OKR 上下文在最前
  - 加 LLM 输出约束 "任何建议都应回答这服务/不服务哪个 OKR"

#### B-015 · OKR Drift Detection (Baseline-Guard 第二闸)

- **来源**: OKR-DRIVEN §三 第2条 (整体能力提升 + 约束聚焦) + §四 Skill Gateway 闸②
- **解谁的痛**: 议事 / 个人 AI 调用 / Decision 漂离当前 OKR 时无人警告. 没有"约束聚焦"这一向.
- **接入成本**: 3 (1 周)
- **价值**: 4 (战略级)
- **状态**: 待 sprint (V1.5 OKR-DRIVE-M1 必含)
- **拥有者**: TBD
- **设计**:
  - 为 Decision/skill 调用计算"OKR 对齐度" (用 LLM 仲裁或简单 keyword 匹配 + KR cascade)
  - 阈值 ≤ 0.3 → 进议事室升级; 0.3-0.6 → 进黄区签批; ≥ 0.6 → 直接放行
  - 加 `governance.okr_drift_detected` audit
- **依赖**: B-014 (需先有公司 OKR 上下文)

#### B-016 · 个人 AI 产出 Capture 层 (IDE 插件优先)

- **来源**: OKR-DRIVEN §三 第3条 + MANIFESTO 第十九条
- **解谁的痛**: 员工用 Claude Code/Cursor 写的代码、用 Notion AI 写的文档、用个人 AI 做的决议, 当前**无路径回流到 Tandem 企业资产**. 个人 AI 的产出在组织维度等于 0.
- **接入成本**: 4 (1-2 月, 多端)
- **价值**: 4 (战略级 — 这是反哺组织的唯一通道)
- **状态**: 待 sprint (V2 启动)
- **拥有者**: TBD
- **路径**:
  1. **IDE 插件 (VSCode/JetBrains)**: 监听 commit / PR / chat 历史 → push 到 Tandem Material 层 (个人级)
  2. **邮件 webhook**: 个人 AI 起草邮件落 cc 到 capture@tandem.local → 进 Tandem
  3. **文档元数据**: Notion/Lark 文档加 `x-tandem-capture` header → 自动同步 Material
- **依赖**: 无, 但 MCP 化 (B-002) 完成后更顺

#### B-017 · Skill Gateway 4 道闸

- **来源**: OKR-DRIVEN §四 Skill Gateway + MANIFESTO 第十九条
- **解谁的痛**: 个人 AI 调企业数据/工具时, 当前无统一组织级网关. 数据泄漏 / 红区破窗 / 合规黑洞风险.
- **接入成本**: 4 (1-2 月)
- **价值**: 4 (战略级 — 第十九条宪章落地)
- **状态**: 观察 → 待 sprint (V2-V3, 跟 B-016 协同)
- **拥有者**: TBD
- **设计 4 道闸**:
  1. **Baseline-Guard**: 红/黄/绿/灰区分类 + LLM 仲裁 (B-015 复用)
  2. **OKR Drift Detection**: 跟 active OKR 对齐 (B-015)
  3. **Data Scope**: RBAC + 4 级所有权
  4. **Action Scope**: ProxyAction 24h 否决窗
- **依赖**: B-002 (MCP) + B-015 (Drift) + B-016 (Capture)

---

### 🔴 战略级 / 高优先 · 通用 AI 能力

#### B-002 · `lib/tools/` MCP 化

- **来源**: 2026-05 月报 L3 · MCP 已成事实标准
- **解谁的痛**: 用户希望 Tandem 能集成钉钉日历 / GitHub issue / Notion / 企业邮箱等。当前每集成一个都要写一份 adapter，工作量重复
- **接入成本**: 3（1-2 周，要重构当前 lib/agents 的工具调用层）
- **价值**: 4（战略级 — 标准化后享受全社区第三方工具生态）
- **优先级**: +1
- **状态**: 待评估
- **拥有者**: TBD
- **备注**: 等 OpenAI 也明确支持 MCP 后启动（已半官方表态）。先不动 schema，先读 spec 写 ADR

#### B-005 · `LlmUsageLog` 表 + 埋点 + 成本报表 ✅ **已完成 (2026-05-27)**

- **来源**: ROADMAP-AI.md "代码层 AI-Ready 清单"
- **解谁的痛**: Owner / 财务 / 你自己 — 不知道 AI 调用每月花多少钱、哪个场景烧最多、是否被某用户刷
- **接入成本**: 2（实际: 1 个会话）
- **价值**: 4（战略级）
- **优先级**: +2
- **状态**: ✅ **已完成**, 详见 commit "feat: usage analytics + LLM cost dashboard"
- **拥有者**: Cascade
- **交付物**:
  - `lib/infra/drizzle-schema.ts` 加 `llmUsageLog` + `usageEvent` 表
  - `drizzle/migrations/0003_usage_and_llm_log.sql` 已应用到本地 PG
  - `lib/analytics/track.ts` 提供 `track()` / `trackLlm()` + 价格表 + cost 估算
  - `lib/taf/router.ts` chat() 自动埋 LlmUsageLog (success + failure 都记)
  - `app/api/analytics/track/route.ts` 前端埋点入口 (匿名容忍)
  - `app/api/admin/usage/route.ts` 看板数据 API
  - `app/admin/usage/page.tsx` 看板 UI (总览 + Top 事件/用户 / LLM provider / scenario / 每日趋势 / 失败原因)

#### B-007 · `lib/agent-runtime/` adapter 层

- **来源**: ROADMAP-AI.md
- **解谁的痛**: 工程团队 — 当前 9 个页面直接耦合 Hermes CLI。Hermes 升级 / 想换 langchain 都要改一大片
- **接入成本**: 2（1 天，但需要小心不破坏现有 9 个页面）
- **价值**: 3（战略级 — 解耦 agent runtime，未来切换零成本）
- **优先级**: +1
- **状态**: 待 sprint（计划 Phase 3，下下次会话启动）
- **拥有者**: Cascade

### 🟡 高价值 / 中优先

#### B-003 · Anthropic Prompt Caching 接入

- **来源**: 2026-05 月报 L2
- **解谁的痛**: Owner 关心成本 — 当前 persona 系统 prompt 每次调用都全量发，浪费 token
- **接入成本**: 1（半天，Claude 已有原生支持）
- **价值**: 3（成本砍 50-90%，立竿见影）
- **优先级**: +2
- **状态**: 待评估
- **依赖**: 需先有 B-005 才能量化"砍了多少"
- **拥有者**: TBD

#### B-001 · DeepSeek-R1 推理模型接入

- **来源**: 2026-05 月报 L1
- **解谁的痛**: 议事决策模块 / OKR 推演 — 复杂思考类任务用普通 chat 模型质量不够
- **接入成本**: 1（半天，已有 DeepSeek adapter）
- **价值**: 2（特定场景质量提升）
- **优先级**: +1
- **状态**: 待评估
- **拥有者**: TBD
- **备注**: 加一个 `provider: 'deepseek-r1'` 选项到 TAF Router；只在 convergence + okr/ai-suggest 路由用

#### B-004 · OpenAI Structured Outputs 推广

- **来源**: 2026-05 月报 L2
- **解谁的痛**: 工程团队 — JSON parse 报错时不时出现，影响功能稳定性
- **接入成本**: 2（1-2 天，要扫现有所有 LLM 调用点改成 schema 约束）
- **价值**: 3（消除一类 production 错误）
- **优先级**: +1
- **状态**: 待评估

#### B-008 · Eval harness（LLM 回归测试）

- **来源**: ROADMAP-AI.md "代码层 AI-Ready 清单"
- **解谁的痛**: 工程团队 — 当前换模型 / 改 prompt 全靠肉眼测，质量回退要等用户投诉
- **接入成本**: 2（1-2 天，建一组 fixture + 跑分脚本）
- **价值**: 3（每次模型变更有回归保险）
- **优先级**: +1
- **状态**: 待评估
- **依赖**: 与 B-005 配合最佳

### 🟢 中等 / 待积累

#### B-006 · 长上下文 1M+ tokens 评估

- **来源**: 2026-05 月报 L2
- **解谁的痛**: 议事决策跨年度回顾 / 全公司 OKR 树喂 LLM 时上下文不够
- **接入成本**: 1（半天，Gemini 2 / Claude 已支持）
- **价值**: 2（特定场景，不是日常用）
- **优先级**: +1
- **状态**: 观察
- **备注**: 等 V2 国际化时一并接入 Gemini

#### B-009 · Qwen 2.5/3 国内备选 provider

- **来源**: 2026-05 月报 L1
- **解谁的痛**: 国内政企客户的"国产化要求"
- **接入成本**: 1（半天，加 adapter）
- **价值**: 2（特定客户群强需求）
- **优先级**: +1
- **状态**: 观察
- **备注**: 有第一个明确要求"国产化"的客户再启动

#### B-010 · OpenAI Realtime API / 语音 Coach

- **来源**: 2026-05 月报 L2
- **解谁的痛**: 1on1 模块的"教练对话"场景，文字打字不如语音自然
- **接入成本**: 4（>2 周，前端 audio 录制 + 后端 streaming + 整体交互重做）
- **价值**: 2（锦上添花，不是非有不可）
- **优先级**: -2
- **状态**: 观察（先不动）
- **备注**: 等 1on1 模块用户量起来再评估

### 🔵 观察 / 不急

#### B-011 · A2A 协议（Google Agent-to-Agent）

- **来源**: 2026-05 月报 L3
- **接入成本**: ?
- **价值**: ?（采纳度未明）
- **状态**: 观察 6 个月
- **下次 review**: 2026-11

#### B-012 · LangGraph state machine 范式

- **来源**: 2026-05 月报 L3
- **接入成本**: 4（如果切换 agent runtime）
- **价值**: 3（架构清晰度）
- **优先级**: -1（高代价）
- **状态**: 观察
- **依赖**: 需先有 B-007（agent-runtime adapter）才能干净切换

#### B-013 · Agentic RAG / GraphRAG

- **来源**: 2026-05 月报 L3
- **接入成本**: 3
- **价值**: 2（Memory 模块未来升级）
- **状态**: 观察

---

## 已完成

<!-- 完成的从上方移到这里, 加上完成日期和 commit / PR 链接 -->

（暂无）

---

## 已丢弃

<!-- 评估后决定不做的, 写明原因, 防止半年后又有人提 -->

#### B-XXX · Anthropic Computer Use

- **丢弃原因**: Tandem 当前用户场景（OKR / 协作 / 议事）不需要"agent 操作浏览器"。等 1 年后用户提出明确需求再说
- **丢弃日期**: 2026-05

---

## 下次 review

**日期**: 2026-08-（季度末）  
**该 review 的事**:

- 所有"观察"状态的条目，看是否升级 / 降级 / 丢弃
- 所有"已完成"项目，复盘是否达到预期价值
- 价值/成本评分是否需要重新打（业界变化后）
- 加入新一季度雷达扫到的新条目

---

## 模板（新增 backlog 时复制）

```markdown
#### B-NNN · <能力名>

- **来源**: <month 月报 / 哪个文档>
- **解谁的痛**: <具体场景，禁止抽象>
- **接入成本**: <1-4>
- **价值**: <1-4>
- **优先级**: <价值 - 成本>
- **状态**: <观察 / 待评估 / 进 sprint / 已完成 / 已丢弃>
- **拥有者**: <name or TBD>
- **依赖**: <如有>
- **备注**: <可选>
```
