# 测试矩阵 · 完整测试规划 (2026-05-30 PT)

> **缘起**: Owner 要求"整理合并所有 tests 文件 / 构建完整测试规划 / 删除无效内容".
>
> **结论**: **不做合并** (40 文件按主题独立, 合并破坏隔离). 真问题 + 修法:
>
> 1. ✅ 1 known fail (`agent-runtime-v2.test.ts:V2-#13 mode=live`) 已修 (timeout 5s → 30s, 不是测试错而是网络环境差异)
> 2. ✅ OKR / Document fixture 散落重复 → 抽到 `tests/fixtures/{okr,document}.ts`
> 3. ✅ 无测试规划文档 → 本文 (TEST-MATRIX) 锁定覆盖矩阵
> 4. ✅ 无测试规约 → `docs/CONTRIBUTING-TESTS.md` 单独立 (下一 PR)

---

## 一、当前状态 (实证 2026-05-30 PT)

| 维度 | 数据 |
|---|---|
| **单元测试文件** | **40 个** (`tests/unit/*.test.ts`) |
| **总 `it()` 数** | **372 个** |
| **vitest 通过** | **382 / 382** (本轮修 1 fail 后) |
| **E2E 测试文件** | 3 个 (`tests/e2e/`: auth.setup, smoke.spec, mobile.spec) |
| **fixture 共享层** | `tests/fixtures/okr.ts` + `tests/fixtures/document.ts` (本轮新建) |
| **执行时长** | ~6.2s (vitest 全套) |

---

## 二、覆盖矩阵 · 按 lib 模块

### 2.1 OKR 引擎 (核心 4 件不变量 · A 级覆盖)

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/services/okr-bulk-create.ts` | `okr-bulk-create.test.ts` | 21 | 4 选项生成 / LLM 路径 / 降级 / mock router |
| `lib/services/okr-calibration.ts` | `okr-calibration.test.ts` | 18 | 推荐分 / 三级偏差 / grid 排序 / 批量保存 |
| `lib/okr/trend.ts:forecastKr` | `okr-forecast.test.ts` | 13 | 数据不足 / 完美线性 / 三级风险 / clamp / 边界 |
| `lib/governance/okr-drift.ts` | `okr-drift.test.ts` | 6 | embedding 相似度 + audit 月审 |
| `lib/persona/company-brain.ts:buildOkrAnchorContext` | `company-brain-okr-anchor.test.ts` | 9 | active cycle 注入 + KR 进度 + 降级 |
| `lib/types/decision-card.ts:validateOkrAnchor` | `decision-card.test.ts` | 10 | XOR 不变量 / escape hatch ≥30 字 |

### 2.2 决议层 (议事 / 3+1 / 文档→议事)

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/decision-layer/three-plus-one-engine.ts` | (未独立) | — | 间接通过 `okr-bulk-create` + `company-brain-decision` 测试 |
| `lib/persona/company-brain.ts:CompanyBrainDecision` | `company-brain-decision.test.ts` | 6 | 决策记录 / Persona 路由 |
| `lib/persona/company-brain.ts:Reflection` | `company-brain-reflection.test.ts` | 7 | adoption rate / overrule / failure pattern |
| `app/api/boss-ai/*` | `boss-ai-route.test.ts` + `boss-ai-example-prompts.test.ts` | 13 | 端点 + prompt 例 |
| `lib/convergence/*:state-machine` | `state-machine.test.ts` | 10 | DIVERGE → CONVERGE → COMMIT 状态机 |
| `lib/services/document-promotion.ts` (DOC-2) | `document-promotion.test.ts` | 8 | Material 创建 / Promotion 提议 / 防重 |
| `app/api/documents/[id]/spawned-decision-card` (DOC-4) | `document-spawn-decision.test.ts` | 6 | 反链 PATCH / 幂等 / 冲突 |

### 2.3 Memory + 知识治理

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/memory/baseline-guard.ts` | `baseline-guard.test.ts` | 8 | PASS / SOFT_WARN / HARD_BLOCK |
| `lib/memory/async-writer.ts + reranker.ts` | `memory-async-rerank.test.ts` | 17 | 异步写 + 重排 |
| `lib/memory/scope-kind` (4 层) | `memory-scope-kind.test.ts` | 10 | private/team/dept/company 可见性 |
| `lib/memory/promotion-flow.ts` | (集成在 document-promotion 测) | — | Lv1/2/3 SLA |
| `lib/memory/compaction` | `compaction.test.ts` | 5 | 长 prompt 压缩 |
| `lib/utils/audit/log.ts:chain` | `audit-chain.test.ts` | 5 | 链式 hash 不可篡改 |
| `lib/audit/defer.ts` | `defer-audit.test.ts` | 4 | 不阻塞 + best-effort |

### 2.4 Persona / Skill / Proxy (拿捏)

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/persona/stage-meta.ts` | `stage-meta.test.ts` | 7 | 5 阶段进化 + tone tokens |
| `lib/persona/proxy-actions/*` | `proxy-actions.test.ts` | 10 | 代签 + 24h 否决 |
| `lib/persona/skills` | `persona-skills.test.ts` | 6 | Skill 调用 |
| `lib/agent-runtime/*` | `agent-runtime.test.ts` + `agent-runtime-v2.test.ts` | 25 | tool loop / MCP / Skill Gateway 4 闸 |
| `lib/agent-runtime/subagent` | `subagent.test.ts` | 5 | spawn 子 Agent |
| `lib/persona/learning-closure` | `learning-closure.test.ts` | 12 | 学习闭环 + 上瘾抑制 |

### 2.5 KPI / TTI / 9 宫格

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/charter/kpi-tti.ts` | `kpi-bonus.test.ts` | 10 | KPI 100% / TTI 60-70% / 双轨切分 |
| `lib/types/kpi.ts:9宫格` | `nine-box.test.ts` | 7 | 9 cell 分类 |
| `lib/okr/cascade` | `cascade.test.ts` | 6 | 5 层穿透 |
| `lib/charter:constitution-tti` | `constitution-tti.test.ts` | 3 | TTI 永不挂奖金 readonly |

### 2.6 LLM / Provider / 路由

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/taf/router` (含场景路由) | (集成测) | — | 间接通过其他测试 |
| `lib/taf/provider/anthropic:prompt-cache` | `anthropic-prompt-cache.test.ts` | 5 | 缓存命中 |
| `lib/taf/provider/openai:structured-outputs` | `openai-structured-outputs.test.ts` | 6 | response_format json_schema |
| `lib/taf/provider/deepseek:r1-config` | `deepseek-r1-config.test.ts` | 5 | R1 推理模型路由 |
| `lib/llm/compose-prompt` | `compose-prompt.test.ts` | 2 | system 拼装 |
| `lib/evals/*` (评估框架) | `evals-runner.test.ts` | 21 | 7 个 suite + skip + golden |

### 2.7 工具层 (UI 辅助 / Auth / 隐私)

| 模块 | 测试文件 | it() 数 | 覆盖维度 |
|---|---|---|---|
| `lib/format/stat.ts` | `format-stat.test.ts` | 17 | integer/decimal/percent/currency + delta |
| `hooks/useHandoffPrefill.ts` | `handoff-prefill.test.ts` | 9 | sessionStorage 协议 + SSR safe |
| `lib/auth/password.ts` | `password.test.ts` | 5 | scrypt hash + verify |
| `lib/privacy/redactor.ts` | `privacy-redactor.test.ts` | 25 | PII / 邮箱 / 电话脱敏 |
| `lib/api/error-middleware` | `client-error.test.ts` | 10 | 错误响应统一 |

---

## 三、覆盖率盲区 (诚实承认未测)

### 🔴 未测但高风险 (必须补)

| 模块 | 实际状态 | 风险等级 | 推荐 |
|---|---|---|---|
| `lib/services/document-promotion` 之外的 promotion-flow `sign/reject/escalate` | 通过 document-promotion 间接测, 但 `sign` 单测缺 | 🔴 高 | 加 `tests/unit/promotion-flow-sign.test.ts` |
| `lib/im/service.ts` (39KB, 14 API) | **0 单测** | 🔴 高 | 拆 + 各 sub-module 加测 |
| `lib/store.ts` (87KB Zustand) | **0 单测** (UI 间接覆盖) | 🟡 中 | slice 拆完后各自测 |
| 4 道闸 Skill Gateway 集成 | `agent-runtime-v2.test.ts` 测 dataScope/actionScope, **缺 baseline-guard + okr-drift 闸** | 🟡 中 | 加 `skill-gateway-baseline.test.ts` |
| `lib/decision-layer/three-plus-one-engine.ts` 独立测 | 间接覆盖 | 🟡 中 | 加 `three-plus-one-engine.test.ts` |
| `app/api/convergence/*` 端点 | **0 单测** (UI 间接覆盖) | 🟡 中 | 加 route 单测 |
| `app/api/im/*/route.ts` (14 个) | **0 单测** | 🟡 中 | 优先 spawn-room / promote-to-memory |

### 🟢 未测但低风险 (有意不测)

- React 组件渲染 (vitest 是 node 环境, RTL 切换成本 > 收益; 视觉走 Playwright)
- 第三方库 (drizzle / Yjs / Tauri SDK) (上游已测)
- 路由 manifest (走 `check-deeplinks` 静态扫)
- UI Charter (走 `check-ui-charter` 静态扫)

---

## 四、测试机制 (新建 4 个规约)

### 4.1 fixture 共享 (本轮新建)

```
tests/fixtures/
├── okr.ts          ← makeObj / makeKr / makeCheckIn / T0 / DAY
└── document.ts     ← seedDoc / resetDocStore / resetDocPromotionStores
```

**调用规约**:
- 任何测试需 OKR domain → `import { makeObj, makeKr } from '../fixtures/okr'`
- 任何测试需 Document domain → `import { seedDoc, resetDocStore } from '../fixtures/document'`
- **禁止**在新测试文件里再次定义 `makeObj/makeKr/seedDoc` (PR 评审打回)

### 4.2 测试命名 + 组织 (规约)

```
tests/unit/<lib-module-name>.test.ts   ← 与 lib/ 路径平行映射
tests/integration/<feature>.test.ts    ← 跨多 service 联动 (待建)
tests/e2e/*.spec.ts                    ← Playwright (用户旅程)
```

**禁止**:
- 把多个 lib/ 模块的测试合并到一个文件 (破坏隔离)
- 测试文件 > 500 行 (拆 sub-describe 或拆文件)

### 4.3 5 道 CI 闸 (已落, 本测试规划与之协同)

| Gate | 命令 | 拦截什么 |
|---|---|---|
| `tsc --noEmit` | 类型检查 | 类型错 |
| `vitest run` | 单元测试 | 逻辑错 |
| `check-ui-charter --strict` | UI 宪章 | 设计语言违规 + responsive 缺失 |
| `check-deeplinks --strict` | 内链扫 | 死链 |
| `check-docs-index --strict` | docs/INDEX.md 一致性 | 漏登记 |

### 4.4 vitest 配置规约

| 字段 | 默认 | 例外 |
|---|---|---|
| `environment` | `'node'` | jsdom 切换需 PR 评审 (理由: RTL 测组件) |
| `testTimeout` | 5000ms | 网络 / 大文件 / DNS 出口测试 → 显式 30000 |
| `globals` | `true` | — |
| `include` | `tests/**/*.test.ts` | 不扫 .test.tsx (无 jsdom) |

---

## 五、本次清理工作 (2026-05-30)

### 5.1 修 1 fail (timeout 改 30s)

`tests/unit/agent-runtime-v2.test.ts:29` "mode=live + SDK 加载失败 → 返回错误" 之前默认 5s timeout 在 macOS/Windows DNS 解析无效 host 时会 fail (Linux 立即 ECONNREFUSED 直接过). 加 30s 显式 timeout + 注释解释.

### 5.2 抽 fixture (新建 2 个)

| 文件 | 抽自 |
|---|---|
| `tests/fixtures/okr.ts` | `okr-calibration.test.ts:24-56` + `okr-forecast.test.ts:21-58` 重复的 makeObj/makeKr |
| `tests/fixtures/document.ts` | `document-promotion.test.ts:21-45` + `document-spawn-decision.test.ts:21-52` 重复的 seedDoc/reset |

迁移 4 个测试文件 (45 测试全过), 减重 ~120 行重复 fixture.

### 5.3 不动的事 (诚实交代)

- **不合并 40 个测试文件**: 每个对应一个 lib/ 模块, 合并破坏隔离原则
- **不删除 e2e 占位**: 3 个 spec 已是 Playwright 框架, 等 Playwright 全套接入再扩
- **不引入 jsdom**: vitest node-only 已 6s 跑完 372 测试, 切 jsdom 会拖到 ≥ 20s

---

## 六、下一阶段 (90 天补齐)

按 ROI 优先级:

| # | 缺口 | 工期 | ROI |
|---|---|---|---|
| 1 | `lib/im/service.ts` 拆 sub-module + 各自加测 | 1.5-2 天 | ★★★★ |
| 2 | `tests/unit/three-plus-one-engine.test.ts` 独立测 | 0.5 天 | ★★★ |
| 3 | `tests/unit/promotion-flow-sign.test.ts` (Lv1/2/3 签批 + escalate) | 1 天 | ★★★★ |
| 4 | `tests/unit/skill-gateway-baseline.test.ts` (baseline-guard + okr-drift 闸) | 1 天 | ★★★ |
| 5 | `app/api/convergence/*` route 测试 | 1 天 | ★★★ |
| 6 | `app/api/im/spawn-room` + `promote-to-memory` route 测试 | 1 天 | ★★★ |
| 7 | Playwright E2E 10 case (核心用户旅程) | 2-3 天 | ★★★★ |
| 8 | `tests/integration/` 目录 + 跨 service 测试 | 2 天 | ★★★ |
| 9 | `docs/CONTRIBUTING-TESTS.md` (规约 + 模板) | 0.5 天 | ★★ |
| 10 | `lib/store.ts` 拆 slice 后逐 slice 加测 | 跟拆同步 | ★★★ |

---

## 七、修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1 创建. 修 1 fail + 抽 2 fixture + 锁定覆盖矩阵 + 90 天补齐路线 |
