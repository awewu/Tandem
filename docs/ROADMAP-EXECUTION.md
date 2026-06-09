# Tandem · 推进执行路线图 (Roadmap · Execution)

> **创建**: 2026-06-07 · 由代码级走读 (lib/boot · govern-persona · skill-gateway · three-plus-one-engine · taf/router · storage/repository · events/subscribers) + `AI-BACKLOG.md` + 5 阶段方案交叉核实生成。
> **定位**: 后续推进的**单一执行入口**。脊柱 = 2026-06-02 "200-1000 人生产级"目标形态的 5 阶段方案 (P0→P4) + 两个独立专项。
> **状态真相**: 单项进度仍以 `STATUS.md` 为准; 任务编号对齐 `AI-BACKLOG.md` (B-xxx) 与 `EVOLUTION-CHECKLIST-FULL.md` (N/B/C/L/M)。
> **战略口径**: 见 `PROJECT-OVERVIEW.md` §二 (二者并存·分阶段)。

状态图例: ✅ 已落 · 🟡 半成 · ❌ 未动 · ⚠️ 存疑待验 · 🔵 观察

---

## 0. 贯穿铁律 (每阶段都适用)

1. **防假闭环断言**: 任何"注入/治理/进化"功能, 验收 = 用户→存储→**生产 LLM systemContent 真拼装**→audit 留痕。缺一段 = 假闭环 (内存事故教训 7b67ce8c)。
2. **DDL 纪律**: 绝不 `db:push` / `drizzle-kit push` (User 表 Prisma 残列会触发 DATA LOSS)。加表/列用幂等 `CREATE/ALTER ... IF NOT EXISTS`。真实库连 `localhost:5432` (非 docker 5440)。
3. **UI 红线**: 组件只用 L3 语义类, 禁 raw Tailwind (`CHARTER-UI-V1.md`)。
4. **节奏**: 每阶段 ≤4 并行任务; 每轮跑 `npx vitest run` (722 基线零回归) + `npm run lint:dead-code`。
5. **无旁路**: 治理从纪律变架构 (见 P1-M4)。

---

## P0 · OKR 真值地基 (阻塞一切, ~8-10 天)

> 进度/对齐是整个产品的真值源。这层假, 上面全是空中楼阁。

| 任务 | 状态 | 动作 / 落点 |
|---|---|---|
| **B1 OKR 单一模型收敛** | ⚠️ 待验 | 消除 OKR/KR/Objective 多模型, 确立单一 SSOT |
| **B2 真 rollup 引擎** | ✅ 已落并接线 (2026-06-07 走读验证) | `lib/okr/rollup.ts propagateRollupFromKr` (加权自底向上传播到根+防环) 已接 `app/api/okr/checkins:101`; B3 执行联动 `lib/okr/execution-rollup.ts` 接 `api/okr/initiatives`。`progressOverride` 默认 null (废人手填)。有 okr-rollup/execution-rollup 单测。**剩余 = AI 不会主动读真值 = S1 (P1.5)** |
| **C1 Skill Gateway 闸④ zone 组织判定** | ✅ 已落 (2026-06-07) | `lib/skill-gateway/derive-zone.ts` `deriveActionZone()` 按内容 (红线词/对外发送) + 委托级别判定 (越权升红), `checkActionScope_` 改调它。覆盖 `tests/unit/derive-zone.test.ts` (14 测) |

**验收门**: 一次 KR 进度更新 → Objective 进度自动重算 (事件链可见); 闸④ zone 不再可被 caller 谎报。

---

## P1 · 灵魂层真闭环 (~3-4 周)

> 把"无旁路治理"从纪律变架构。当前最大架构债 (内存 4881c05e)。

| 任务 | 状态 | 动作 / 落点 |
|---|---|---|
| **M4 `governedChat()` 统一出口** | ✅ 已落 (2026-06-07) | `lib/governance/governed-chat.ts` 串联输入闸 (govern-persona) + 动作闸 (runSkillGateway 含闸④内容判定) + LLM + 输出闸 (output-guard); autonomous **fail-closed** (基线闸 checkId='' 信号检测)。支持 forceProvider/cacheControl/preSearch 钩子。覆盖 `tests/unit/governed-chat.test.ts` (6 测) |
| **§19 收口 govern-persona** | 🟡 推进中 | 3+1 引擎 (`three-plus-one-engine.ts`) 按既有结论不迁 (多选项结构)。**IM persona reply (`im/service.ts invokePersonaReply`) 已迁 governedChat** (2026-06-07, 新增动作闸+输出闸, 保留 forceProvider/preSearch/cache)。CompanyBrain/BossAI 等流式出口待迁 |
| **ESLint `no-direct-router-chat`** | ❌ 未动 | 禁业务代码直调 `router.chat()` 绕过闸 |
| **B-015 OKR Drift 升真闸** | 🟡 仅审计 | 当前 drift 只 SOFT_WARN 不阻断; 按阈值 (≤0.3 进议事 / 0.3-0.6 黄区签批 / ≥0.6 放行) 升级 |
| **闭环断言测试框架** | 🟡 部分 | governed-chat (6) + derive-zone (14) 已有; 继续补 systemContent 真注入断言 |
| **CA-13 闭飞轮 (S5)** | ✅ 已落 (2026-06-07) | `approveReflection` 签批含 diff → 应用→创建新 `CompanyBrainVersion`(`company-brain-reflection.ts`); 读侧 `lib/persona/company-brain-version.ts getActiveBrainVersion` 接入 baseline-guard 阈值 + company-brain 注入数/风格。反思不再"写报告不改自己"。覆盖 reflection 闭环测 (9) |

**验收门**: 任一 LLM 出口都经 governedChat; 红线 HARD_BLOCK 全链路拦截; ESLint 挡住旁路。

---

## P1.5 · 给中央 AI 装眼睛 (S1 肢体, ~3-4 周) — **只读回路 2026-06-08 已落 + live**

> 智能主轴的第一根因是"瞎子"——中央 AI 不能查真实数据。S0(真数据)✅ + P1(governedChat 安全出口)✅
> 两个前置齐 → **2026-06-08 双线收口, S1 只读感知回路已真落地并 live**。详见 `CENTRAL-AI-ARCHITECTURE.md` §十 S1。

| 任务 | 状态 | 动作 / 落点 |
|---|---|---|
| **CA-6/7 只读感知回路 (最小闭环)** | ✅ 已落 + live (2026-06-08) | `lib/persona/company-brain-perception.ts companyBrainPerceptionPass`: 回答前启发式 gate → 跑 `runToolLoop` (`lib/agent-runtime/tool-loop.ts`) 只读白名单 (`okr.health_digest`/`okr.read`/`memory.search`/`decision_card.list`) 查 S0 rollup 真值 → 注入 systemPrompt。**已接 live 两出口** `lib/im/service.ts invokeCompanyBrainReply:1015` + `app/api/boss-ai/stream/route.ts:113` (perceived 则换 prompt + audit)。工具执行穿 skillRegistry 治理闸。覆盖 `company-brain-perception.test.ts`(4) + `agent-runtime.test.ts §CA-6/7` |
| **okr.health_digest 眼睛工具** | ✅ 已落 (2026-06-08) | `lib/taf/skills/builtin.ts` 用 rollup 真值出全层级 at-risk 排行, 绿区/proxyAllowed/已注册。覆盖 `okr-health-digest-skill.test.ts`(4) |
| **工具与出站 Skill 分清 (Owner 2026-06-08 纠偏)** | ✅ 内部已落 / [R] 对外降远期 | ⚠️ 别再把两者混为"同一套机器": ① **自用内部** tool-loop (`runToolLoop` 调 `okr.health_digest`/`memory.search`, S1 已落) = 给中央AI/搭子**自己**装手, **核心保留**。② **对外出站互通** (B-022 出站 Skill / 接竞品产品 MCP / 当竞品治理底座) = **降为远期可选** —— 竞品不会自愿当你网关 client, 非真护城河。资源全压自用智能主轴 |
| **S2 议事 Option B 多步参谋 (第一片)** | ✅ 已落 (2026-06-08) | `lib/decision-layer/reasoning-pass.ts buildDecisionReasoningBrief`: 3+1 Option B 前跑 `runMultiStep`(native→tool-loop) 只读工具 (decision_card.list/okr.health_digest/okr.read/memory.search) 收集历史决议/OKR真值/风险 → 注入 Option B 上下文。已接 `three-plus-one-engine.generateOptions`, fail-soft 零回归。覆盖 `decision-reasoning-pass.test.ts`(4) |
| **S2 全路径深推理 · 主回复路径** | ✅ 已落 (2026-06-09) | `lib/persona/company-brain-reasoning.ts companyBrainReasoningPass`: 严格 gate (复杂决策类: 比较/为什么/应该/分析/策略...) 触发 `runMultiStep` (mode=native, REASONING_TOOLSET, maxSteps=6) → 结构化简报注入 systemPrompt。已接 `lib/im/service.ts invokeCompanyBrainReply` + `app/api/boss-ai/stream/route.ts`, S2 命中即跳过 S1 (mutex, S2 ⊇ S1)。覆盖 `company-brain-reasoning.test.ts`(7) |
| **议事入口感知接入** | ✅ 已落 (实质已通) | 议事 generateOptions 全程跑 baseline-guard (S3) + buildDecisionReasoningBrief (S2 multi-step), 是 IM/BossAI 感知的真超集; 不需要再单独接 S1 perception |
| **CA-2 灰区 LLM 仲裁 (S3)** | ✅ 已落 + live | `lib/memory/baseline-guard.ts arbitrateGreyZone`: 公司级记忆灰区 (sim ∈ [softWarn, hardBlock)) 走 LLM 真判 (json_schema strict), 可升级到 HARD_BLOCK / 降级到 PASS / 维持 SOFT_WARN。env `BASELINE_GREYZONE_ARBITRATION=off` 退回纯启发式; fail-soft。覆盖 `baseline-greyzone-arbitration.test.ts`(5) |

**验收门**: 中央 AI 回答 "R&D 最迟的 KR 怎么样" 时能拉出真实数值与 at-risk 判定, 且工具调用穿闸留痕。
> **✅ 已达成 + 真模型验证 (2026-06-08)**: `okr.health_digest` 真值经 perception pass 注入。
> ⚠️ **真模型探针暴露并修复了一个"精致的假"bug**: tool-loop 把带点 skill id (`okr.health_digest`) 原样下发, 但 OpenAI/DeepSeek 规范禁止 name 带点, 模型回传下划线名 (`okr_health_digest`) → 白名单/registry 查找全 miss → 每个 tool_call 被判 `tool_not_allowed` → 感知 pass 永远 0 工具 → 生产里中央AI 仍是瞎子 (尽管单测全绿)。已修: `lib/agent-runtime/tool-loop.ts` 下发 sanitize + 回传按映射还原 (`sanitizeToolName` + `nameToSkillId`), DeepSeek 探针确认 `okr.health_digest ok=true` 返真值, 回归测试已加。**教训: 全绿+接线 ≠ 真接通, 真模型 function calling 必须探针验证。**
> **2026-06-09 收口**: S2 全路径深推理 (主回复)、议事入口感知 (实质由 S2 reasoning-pass 覆盖)、S3 灰区仲裁三件全部落地 + 测试 (937/937 绿)。
> 剩余 = (1) 真模型探针 S2 main-reply (像 S1 sanitize 那样跑一次 DeepSeek/OpenAI 实测), (2) DB-AUDIT P1 list() 分页/下推 (热集合)。

---

## P2 · OKR 底座补全 (~5-7 周, 可与 P4 并行)

| 任务 | 状态 | 备注 |
|---|---|---|
| **B3 OKR-执行联动** | 🟡 部分已落 | Initiative→KR→rollup 联动已落 (`lib/okr/execution-rollup.ts`, 2026-06-07 校正)。剩: 日报/议事/ToDo 必填 okr_anchor |
| **B4 多父对齐 + DAG 地图** | ❌ | OKR 5 层级联树已有 UI, 补 DAG 传播 |
| **B5 结构化复盘 / B6 健康度 / B7 CFR** | 🟡 | `runSlowScans` retro auto 已在跑, 补结构化 |
| **B8 案例库飞轮** | 🟡 已存在 | `lib/retrospective/auto.ts` 已自动采集, **别重建**; 只补 team→company 升级 |
| **L1 反虚报接日报闭环** | ❌ | 空目录待接 |
| **L2 中央 AI 复盘诊断** | 🟡 | `lib/persona/company-brain-reflection.ts` 已有, 扩展吸收个人/团队 Memory |
| **B-019 BSC 因果链** | ✅ 字段已落 | `kpiCausalLinks` repo 已存在, 补 `/admin/kpi/strategy-map` 拓扑图 UI |
| **B-020 BSC 四维配比校验** | ❌ | 成本仅 0.5-1 天, 立竿见影 |

---

## P3 · Persona 进化飞轮 (~4-6 周, 严格依赖序)

> backlog 明说: 不落 B-024 则三件套全是摆设。**顺序不可乱**:

```
B-024 反思引擎(根,5-7d) → B-025 战略引擎(1w) → B-026 anti-pattern(1-2w)
   ┄┄ [🅩 远期可选, Owner 2026-06-08 降级] B-023 BYOK → B-022 出站Skill → B-021 Builder UI
```

> **Owner 2026-06-08 纠偏**: B-022 出站 Skill / B-023 BYOK / B-021 Builder UI 都属"对外互通/出站"线,
> **降为远期可选** —— 学竞品技术做法可以, 但不押"接竞品 MCP / 当竞品治理底座"。P3 当前实推只留
> **B-024 反思 (根) + B-025 战略引擎**, 这两条是"搭子真学习"自用智能, 不依赖任何对外互通。

| 任务 | 状态 | 关键落点 |
|---|---|---|
| **B-024 反思引擎** | ❌ | `lib/persona/learning-collector.ts:33` 只 +1 计数不诊断。建 `lib/persona/reflection.ts` 写 RetroNote 反推 4 引擎 |
| **B-025 战略引擎** | ❌ | 0 行。监听 `okr.cycle_changed` → `realignPersonaToOkr` 重组 enabledSkills |
| **B-023 BYOK** | 🅩 远期可选 | (对外互通线, 2026-06-08 降级) AES-GCM 凭据库 (`lib/byok/credential.ts`), B-022 前置 |
| **B-022 出站 Skill** | 🅩 远期可选 | (对外互通线, 2026-06-08 降级) `lib/skill-gateway/outbound/`, 调用必经 runSkillGateway。注: **自用内部** tool-loop (S1) 已落且不在此降级范围 |
| **B-021 Builder UI** | 🅩 远期可选 | (依赖 B-022, 随之降级) `/persona/builder` 三 Tab (enabledSkills 字段已存在无 UI) |
| **B-027 价值观锚** | ✅ MVP 已落 | 补输出后二次扫描 + 季度 review |
| **B-028 Bandit** | 🔵 观察 | V3, 等数据积累 |

---

## P4 · 生产硬化 (与 P2/P3 并行)

| 任务 | 状态 | 备注 |
|---|---|---|
| **Prisma 残列清理 → 恢复 drizzle 迁移** | ❌ | 清 User 表残列后才能解禁 db:push |
| **负载测试 100→1000 人** | ❌ | Redis 限流 / DB 连接池已就绪, 需压测 |
| **B-008 Eval harness** | 🟡 | `tests/eval` + `npm run evals` 已有脚手架, 补 fixture |
| **B-004 Structured Outputs** | 🟡 部分 | 3+1 引擎已用 `responseFormat: json_schema strict`, **推广到其余调用点** (backlog 标"待评估"已过时) |
| **B-003 Prompt Cache** | ❌ | 成本砍 50-90%, 半天, 依赖 B-005 (✅已落) |

---

## 两个独立专项 (高风险, 不混进功能阶段)

- **TandemNode 统一原语重构** (N1, `UNIFIED-TECH-DESIGN.md` §2): 取代 `lib/storage/repository.ts` ~50 个分仓, 知识 4 层 = 同一原语 type 跃迁。5 步渐进迁移 (Phase 0 新增 repo 不动旧的 → 双写适配器 → 旧 repo 变 typed view)。建议 P2/P3 后启动。
- **Persona 双层架构**: 本地 Hermes (Ollama/GPU) + 云 DeepSeek 双层路由 + 离线 degraded + **全云 fallback** (多数民企无 GPU, PRD §9 风险登记已列)。属目标形态, 自用阶段可后置。

---

## 起手三步 (最高杠杆)

1. **先验 P0-B2**: 跑测试 + 走读确认 rollup 是否真自底向上传播 (代码看似已修, 但曾有假闭环前科, 存疑必验, 否则地基不稳)。
2. **P1-M4 governedChat**: 确认无疑的最大架构债, 且阻塞 P3 出站 Skill 的安全性。
3. **P0-C1 zone 组织判定**: 与 M4 同源, 一起收口闸④。

---

## 智能主轴对齐 (S0→S5 ↔ P0-P4) — 2026-06-07 Owner "中央 AI 不聪明则全是口号"

> 把 `CENTRAL-AI-ARCHITECTURE.md §十` 智能补全施工图 (S0→S5) 映射到本 P0-P4。
> **发现**: 治理轴 (M4/C1/B-015/no-bypass) 排得很满, 但"给中央 AI 肢体 + 推理深度"的
> **S1/S2 在现有任务里缺独立排期** —— 被"治理迁移 (M4)"和"出站 Skill (B-022)"掩盖。
> **治理 = 管住 AI 说什么/做什么; 智能 = 让 AI 能查数据 + 多步推理后再说**, 是两件事。

| 智能轴 | 对应 P 任务 | 对齐 | 缺口 |
|---|---|---|---|
| S0 真数据 (B2 rollup) | P0-B2 | ✅ 已最高优先 | — |
| S1 肢体 (CA-6/7 tool calling+MCP) | **P1.5 已落+live** (perception pass) | 🟢 **只读回路已落** | 剩 S2/议事路径/S3 ↓ |
| S2 推理深度 (CA-5 议事 multi-step) | **议事 Option B 第一片已落** (reasoning-pass) | 🟡 **决策层已接, 主回复路径待扩** | 剩 IM/BossAI 主回复 + 完整 ReAct ↓ |
| S3 灰区判断 (CA-2 仲裁) | ≈ output-guard (✅) / B-015 (🟡) | 🟡 部分 | 并入 B-015 |
| S4 搭子真学习 (B-024) | P3-B-024 (根) | ✅ 已排 | — |
| S5 数据飞轮 (CA-13) | P1 CA-13 行 + reflection | ✅ **apply 环已闭** (2026-06-08) | 剩自用喂养 |

**新增任务 (补 S1/S2 缺口, 插在 P1 之后 / P2 期间, 依赖 P0-B2):**

| 任务 | 状态 | 动作 / 落点 |
|---|---|---|
| **S1 中央 AI 工具调用回路** | ✅ 两出口已落 (2026-06-08) | **已接线**: `lib/persona/company-brain-perception.ts` 内部感知层 — 流式回答前跑 `runToolLoop` 调只读工具 (`okr.health_digest`/`okr.read`/`memory.search`/`decision_card.list`), 把 S0 rollup 真值注入 systemPrompt; **已接两个出口** `im/service.ts invokeCompanyBrainReply` + `app/api/boss-ai/stream/route.ts` (启发式 gate + fail-soft + audit), 4 单测绿 + 772 全绿。**剩余**: ① 感知 pass 升 single-call 省 token (现数据类消息多一次 tool-loop 调用) ② tool-capable 模型路由实测确认 (依赖 TAF provider 传 tools/toolChoice='auto')。让中央 AI 从"瞎子"变"能查" |
| **S2 议事/BossAI multi-step 推理** | 🟡 议事 Option B 已接 (2026-06-08) | `reasoning-pass.ts` 已让 3+1 Option B 前跑多步参谋简报 (decision_card.list/okr.health_digest/okr.read/memory.search)。剩: IM/BossAI 主回复路径 + 完整 ReAct |

> **顺序铁律重申**: 没有 S0 (真数据) + S1 (能查), 先做 S2 (深推理) = 在垃圾输入上深度推理 =
> **更精致的假**。故主轴顺序: P0-B2 (S0) → 新增 S1 → 新增 S2 / B-015 (S3) → P3-B-024 (S4) → CA-13 (S5, 自用全程喂)。

### 2026-06-07 走读校正 (推翻上一版智能主轴里的过期判断)

代码走读确认, 上一版表格里几处状态是过期错判, 更正:

- **S0 真数据 ✅ 其实已落且已接线** (非"假闭环"): `lib/okr/rollup.ts` (加权自底向上+防环+尊重 override) + `lib/okr/execution-rollup.ts` (Initiative→KR→rollup) 已接 `app/api/okr/initiatives/route.ts:69` + `checkins` 写路径, 有 `okr-rollup`/`okr-execution-rollup` 单测。`subscribers.ts:148` 现为 `okr.kr-progressed` 日志监听 (喂 drift-detector), 不是 rollup —— 原"只打日志不传播"是过期引用。
- **P2-B3 执行联动引擎已落** (P2 表标 ❌ 过期): `execution-rollup.ts` 即 B3 的 Initiative→KR 联动, 已接线。剩余 = 日报/ToDo 必填 okr_anchor 的扩展面。
- **结论**: 装"眼睛" (S1=CA-6/7) 的两个前置已齐 —— **S0 真值地基✅ + P1-M4 governedChat 安全出口✅**。所以 CA-6/7 是"**现在**"能做, 不是 CENTRAL-AI §六 写的"V1.5/V2 3-6 月后"。

### P1.5「给中央 AI 装眼睛」— 2026-06-08 已落 (原"待拍板"已实施)

> **更新**: 此前"待 Owner 拍板"的 P1.5 已在 2026-06-08 双线收口落地 (见上方 P1.5 阶段表)。
> S1 只读感知回路 = `companyBrainPerceptionPass` + `okr.health_digest`, 已接 live `invokeCompanyBrainReply`。
> P1 与 P2 之间正式确立 P1.5 阶段。**剩余排期** (待 Owner 排优先级):

| 任务 | 量 | 说明 |
|---|---|---|
| **S2 全路径深推理 (议事 Option B 已落, 剩主回复路径)** | ~2-3 周 | 第一片 (议事 Option B 参谋简报) 2026-06-08 已落; 剩 IM/BossAI 主回复接 multi-step + 完整 ReAct。最大剩余智能杠杆 |
| **议事路径感知接入** | 0.5-1 周 | 感知 pass 已接 IM + BossAI; 扩到议事 (convergence) 入口 |
| **S3 CA-2 灰区 LLM 仲裁** | 1 周 | baseline-guard sim 0.2-0.45 灰区交 LLM 判, 高杠杆低成本 |

### S5 数据飞轮 apply 环 — 2026-06-08 已闭 (推翻"未闭"过期判定)

> **更正**: 旧判"approveReflection 不创建新 Version, 飞轮空转"已过期。2026-06-08 已补真闭环:
> `approveReflection` 签批含 diff → 应用 → 创建新 `CompanyBrainVersion`; 读侧 `company-brain-version.ts getActiveBrainVersion` 接入 baseline-guard 阈值 + company-brain 注入数/风格。
> 反思现在**真改得动中央 AI**。覆盖 `company-brain-reflection.test.ts` 闭环测 (9)。详见上方 P1 「CA-13 闭飞轮」行。

---

## 已落地基线 (别重做)

- ✅ B-014 OKR Anchor 注入器 (`buildOkrAnchorContext`) · ✅ B-005 LlmUsageLog 埋点 + 成本看板 · ✅ B-027 价值观锚 MVP
- ✅ 3+1 引擎三层注入 (价值观锚→组织基线→OKR锚) + json_schema strict
- ✅ 议事室 17min FSM (5 步软预算 + D 选项强制 + 24h 否决) · ✅ Persona 5 阶段 + 委托级别守门
- ✅ TAF Router 6 场景路由 + 自动 fallback · ✅ 跨域事件总线 (10 订阅者)
- ✅ 扩展性底座: Redis 分布式限流 + DB 连接池 + tenantId 贯通 + Sentry/OTEL scaffold + 备份脚本
