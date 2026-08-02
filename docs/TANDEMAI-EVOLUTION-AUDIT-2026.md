# TandemAI 进化审计报告 — 五器官现状 vs 2026 技术前沿

> 生成日期: 2026-07-22  
> 前置文档: `docs/EVOLUTION-ROADMAP-2026-07-20.md` (方向 SSOT) · `docs/STATE-OF-THE-CODE.md` (现状 SSOT)  
> 本文: 完整代码审计 + 2026 学术/产品前沿对标 → 逐器官进化方向

---

## 一、五器官现状审计

### 器官 1: 感知 (Perception)

**核心文件**: `lib/persona/company-brain-perception.ts` (347 行)

**已有能力**:
- 启发式门控 (`shouldPerceive`): 正则关键词匹配 → 决定是否跑感知 pass (省 token)
- 只读工具白名单 13 个: `okr.health_digest` / `okr.business_review` / `okr.read` / `kpi.health_digest` / `talent.nine_box` / `bonus.digest` / `analytics.cross_rollup` / `pms.pipeline_digest` / `strategy.validity_digest` / `memory.search` / `memory.timeline` / `decision_card.list`
- 本体安全维度: 按 `marking → purpose` 过滤 (`accessiblePerceptionToolset`), owner 全知代理 + restricted 许可
- 短 TTL 缓存: 45s LRU 50, 避免连续追问重复跑 tool-loop
- 自适应拓扑: `adaptiveTopology=true`, 单维度问题自动收紧预算
- Eval 埋点: 记录 topology/guardrail/tool invocations/latency
- fail-soft: 任何异常不阻塞主回复流

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| P-1 | 触发靠正则关键词, 非语义理解 | 语义相近但关键词未命中的问题不触发感知 (如"最近大家干得怎么样") |
| P-2 | 工具集固定, 不按问题动态选择 | 跨维度问题可能漏调工具; 单维度问题可能多调 |
| P-3 | 缓存 key 是归一化 query 字符串, 非语义相似 | "OKR 进度" 和 "目标进展" 是同一意图但不命中缓存 |
| P-4 | 无多模态感知 (仅文本) | 无法感知图表/截图/语音中的信息 |
| P-5 | 感知结果直接拼入 systemPrompt, 无结构化加工 | 长 tool 输出可能稀释上下文, 无优先级排序 |

### 器官 2: 推理 (Reasoning)

**核心文件**: `lib/decision-layer/reasoning-pass.ts` (135 行) · `lib/agent-runtime/multi-step.ts` (343 行) · `lib/agent-runtime/tool-loop.ts` (545 行) · `lib/agent-runtime/topology.ts` (113 行) · `lib/agent-runtime/compaction.ts` (127 行)

**已有能力**:
- 多步 ReAct 循环: `native` 模式 (→ `runToolLoop` 原生函数调用) / `prompt-based` 模式 (Thought-Action-Observation)
- 编排拓扑门控 (AdaptOrch 落地): `selectTopology` 按查询复杂度选 `direct` / `single_pass` / `multi_step` / `deep`, 自适应 `maxRounds` / `maxTokens`
- 上下文自动压缩 (Compaction): 保留 system + 首条 user + 最近 N 轮, 中间摘要化, 防 hard truncation
- 议事参谋 pass: `buildDecisionReasoningBrief` 在 Option B 生成前多步收集历史决议/OKR 对齐/风险案例
- 安全守门: 5-gate skillRegistry.execute, 工具白名单, guardrail 输入扫描 + 输出中和
- DeepSeek 思考态统一: `reasoningContent` 跨轮回传, `deepseek-reasoner` 支持 thinking-in-tool-use

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| R-1 | 线性推理 (CoT 式), 无图式推理 (GoT) | 复杂问题无法分支/合并/回溯, 冗余叙述多 |
| R-2 | 无元推理 (Meta-Reasoning) | 不会"思考该怎么思考", 无法在推理中途切换策略/回退 |
| R-3 | 无 Generate-Verify-Revise 范式 | 不会自我验证中间步骤, 到了正确答案仍在冗余验证 |
| R-4 | 无并行推理路径 | 单线程探索, 无法在预算内尝试多条路径再综合 |
| R-5 | 无动态终止监督 | 推理何时收敛完全靠 maxRounds 硬截, 非基于自验证判断 |
| R-6 | 推理 pass 与生成 pass 割裂 | 感知/推理收集的上下文注入 systemPrompt 后, 生成阶段无法动态追加检索 |

### 器官 3: 反思 (Reflection)

**核心文件**: `lib/persona/company-brain-reflection.ts` (892 行) · `lib/persona/attribution.ts` (281 行)

**已有能力**:
- 月度反思报告: 拉取窗口期 BrainMetricsReport → 分析 strengths / failurePatterns / proposedChanges
- 启发式 + LLM 双通道: 启发式永远可跑, LLM 可选增强 (fail-open)
- OKR 健康分析 (`analyzeOkrHealth`): 承压 KR / 停滞目标 / 长期承压趋势 → 产出参谋提议 (advisory, 不自动改)
- 能力沉淀检测 (`analyzeSkillPromotion`): 高采纳/低推翻场景 → 建议治理沉淀为可复用技能
- 学习归因 (`runAttributionPass`): 回溯被 acknowledged 的 OKR 预警之后 KR 进度 delta → positive/neutral/negative
- LLM 深析归因: 对 positive/negative 补 hindsight 诊断 (读 check-in blockers/nextSteps)
- 版本进化闭环: proposedChanges → 签批 → `buildNextVersion` → 新 CompanyBrainVersion → 缓存失效
- 数据飞轮纪律: 阈值调整只据显式信号 (人工点击/议事选择), 不被隐式默许带偏

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| F-1 | 反思周期 = 月级, 无实时/情景级反思 | 单次对话失败不会即时学习, 要等下月才发现模式 |
| F-2 | 归因是相关性, 非因果 | KR 改善可能因外部因素, 归因无法排除混淆变量 |
| F-3 | 无反事实推理 | 不会问"如果当时没给这条建议, KR 会怎样" |
| F-4 | 无协作式自我进化 | 单 agent 独自反思, 无多视角交叉验证 |
| F-5 | 反思不回馈推理策略 | proposedChanges 只调配置阈值, 不调推理方法/工具选择策略 |
| F-6 | 归因样本门槛高 (MIN_EXPLICIT=5) | 早期使用量不足时无法产生学习信号 |

### 器官 4: 行动 (Action)

**核心文件**: `lib/agent-runtime/tool-loop.ts` (545 行) · `lib/agent-runtime/mcp-bridge.ts` (307 行) · `lib/ontology/propose-action.ts`

**已有能力**:
- 工具调用循环: LLM 原生 function calling, 迭代 tool_calls → execute → feed back
- 5-gate 治理守门: skillRegistry.execute 经 zone/proxyAllowed/marking/guardrail/whitelist
- MCP 桥接 (V1 stub): 注册外部 MCP server, `getAllMcpTools` 集成进 tool-loop toolset
- 提议行动 (`proposeAction`): red (拒绝) / yellow (24h 否决窗) / green (直接执行+审计)
- Guardrail: 输入扫描 (jailbreak/injection) + 工具输出中和 (neutralize)
- 硬红线拒绝 (`hard-refuse-redlines`): 薪资/裁员/法律/对外承诺/资金 → 确定性快检, 命中转人工
- 快慢双轨 (`answer-pipeline`): 简单问题快道跳过 LLM critique, 复杂问题慢道跑 output-guard

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| A-1 | MCP 桥接是 V1 stub, `invokeMcp` 未实现 | 外部工具扩展能力为零 (仅 in-process skills) |
| A-2 | 无可逆执行轨迹 (Shepherd 式) | 工具执行后不可回滚/ fork/ 重放从某一步开始 |
| A-3 | 无并行工具执行 | 多个独立工具调用串行等待, 延迟叠加 |
| A-4 | 无计划级一致性验证 (PlanGuard 式) | 不预先生成参考行动集, 无法检测参数劫持 |
| A-5 | 无因果诊断 (AgentSentry 式) | 间接注入在多轮轨迹中渐进式劫持无法定位 |
| A-6 | 工具输出无结构化校验 | LLM 可能基于工具返回的错误/幻觉数据继续推理 |

### 器官 5: 记忆 (Memory)

**核心文件**: `lib/memory/reranker.ts` (204 行) · `lib/memory/output-guard.ts` (329 行) · `lib/taf/skills/builtin.ts` (memory.search / memory.related / memory.timeline)

**已有能力**:
- 多信号重排序: `rerank()` = 0.45×BM25-lite + 0.15×Entity bonus + 0.20×Recency + 0.15×Popularity + 0.05×Priority
- 输出矫正镜片: `output-guard` LLM-as-judge → PASS / SOFT_DRIFT / HARD_CONFLICT, 附 OKR 对齐判定 + 引用后附
- 三种检索技能: `memory.search` (关键词) / `memory.related` (实体关系) / `memory.timeline` (时间因果链, MAGMA-lite)
- Memory 写入锁死: 三级签批 (ceo+clevel+steward, SLA 14d) 是唯一路径, AI 无写权
- 引用后附: output-guard 返回 `citedMemories`, 前端渲染来源 chips

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| M-1 | 无多图记忆架构 (MAGMA 式) | 语义/时间/因果/实体混在同一存储, 检索无法按意图选图 |
| M-2 | 无主动记忆重构 (MRAgent 式) | 检索是被动的 top-K, 不会根据中间证据迭代探索新检索路径 |
| M-3 | 无工作记忆管理 (State Aware RAG 式) | 无跨检索-生成周期的持久化认知工作区, 知识不累积 |
| M-4 | Reranker 是确定性公式, 无 LLM/交叉编码器重排 | 复杂语义匹配不如 bge-reranker / Cohere rerank-v3 |
| M-5 | 无记忆整合/遗忘机制 | 记忆只增不删, 过时信息不会被自动降权/合并 |
| M-6 | 时间因果轴是线性链, 非真因果图 | `memory.timeline` 按时间排序事件, 不做因果推断 |

### 横切: 评估 (Eval)

**核心文件**: `lib/eval/service.ts` (168 行) · `lib/eval/graders.ts` (269 行)

**已有能力**:
- Trace 采集: 全 agent 路径 (perception/reasoning/act/decision/okr_review/pms/attribution) 出入口埋点
- 10 个规则 grader: tool-grounded / no-forbidden-tool / converged / zone-compliant / budget-sane / guardrail-clean / pms-structured / pms-grounded / pms-ai-live
- 1 个 LLM grader: answer-quality (DeepSeek 自评, 基于 input+tools+output)
- 回归跑分: `runRegression` 逐 grader 通过率 + 总体
- 归因 pass: `runAttributionPass` 落 `evalAttributions` 仓

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| E-1 | 无轨迹感知评分 (Claw-Eval 式) | 评分只看最终输出, 不看执行过程 (安全违规/鲁棒性) |
| E-2 | 无鲁棒性测试 (错误注入) | 不测 agent 在 timeout/rate-limit 下的表现 |
| E-3 | 无多试一致性 (Pass@k vs Pass^k) | 区分不了"真能力"vs"运气好" |
| E-4 | LLM grader 是自评 (同模型) | 无独立裁判, 可能自评偏差 |
| E-5 | 无人工标注工作流 | 无法沉淀人工校正信号 |
| E-6 | 无 harness 自优化 (RHI 式) | 不会根据 trace 质量迭代优化 agent loop 本身 |

### 横切: 护栏 (Guardrails)

**核心文件**: `lib/guardrail/index.ts` (159 行) · `lib/guardrail/patterns.ts`

**已有能力**:
- 确定性正则层: jailbreak / indirect injection / PII 三类规则
- 三级处置: pass / flag (记录不阻断) / block (拒绝/中和)
- 工具输出中和: 包裹为不可信数据 + 剥离角色标记
- fail-open: guardrail 自身异常不阻断主流程

**关键差距**:
| # | 差距 | 影响 |
|---|------|------|
| G-1 | 无状态 (stateless), 不跟踪多轮意图漂移 | Crescendo/ActorAttack 跨轮渐进式攻击无法检测 |
| G-2 | 仅正则, 无内部状态分析 (RAP-ID 式) | 精心伪装的注入无法通过注意力模式/策略冲突检测 |
| G-3 | 无因果诊断 (AgentSentry 式) | 无法定位注入在多轮轨迹中的接管点 |
| G-4 | 无计划级一致性验证 (PlanGuard 式) | 不预生成参考行动集, 无法检测参数劫持 |
| G-5 | 无 KV 缓存复用 (RedVisor 式) | 检测+生成两阶段无法零拷贝复用 prefill |

---

## 二、2026 技术前沿扫描

### 2.1 推理时 (Inference-Time Reasoning)

| 突破 | 来源 | 核心洞见 | Tandem 可取性 |
|-------|------|----------|---------------|
| **Meta-Reasoner** | ACL 2026 | "思考该怎么思考" — CMAB 动态选策略 (回退/切换/重启), 准确率 +9-12%, 推理时间 -28-35% | ✅ 翻译为推理时 pass: 在 tool-loop 中加 meta-step 评估当前推理状态 |
| **PaCoRe** | ACL 2026 | 并行协调推理 — 多轮并行轨迹 + 消息压缩 + 综合, 8B 超 GPT-5 | ⚠️ 需并行调用, 成本高; 可取"多路径探索+综合"思路 |
| **DOLORES** | 2026 | 结构化元认知 — 即时构建任务专属 scaffold, 8B 超 32B | ✅ 翻译为: 按问题类型动态选择推理 scaffold (非固定 ReAct) |
| **GoT-R1** | ACL 2026 | 图式思维替代线性 CoT, 逻辑与叙述解耦, token -50% | ✅ 翻译为: 推理图数据结构 (节点=原子推理, 边=依赖) |
| **SCR** | 2026 | Generate-Verify-Revise 范式 + 动态终止监督, 输出 token -50% | ✅ 翻译为: 推理 pass 加验证子步 + 基于自验证的收敛判断 |

### 2.2 记忆架构 (Memory Architecture)

| 突破 | 来源 | 核心洞见 | Tandem 可取性 |
|-------|------|----------|---------------|
| **MAGMA** | ACL 2026 | 四图记忆 (语义/时间/因果/实体), 策略引导遍历, 查询自适应选图 | ✅ 已部分取 (memory.timeline = 时间轴); 可扩展因果图+实体图 |
| **MRAgent** | 2026 | 主动记忆重构 — Cue-Tag-Content 图, LLM 驱动迭代检索路径探索, +23% | ✅ 翻译为: memory.search 后加 LLM 判断"是否需要追查关联" |
| **State Aware RAG** | ACL 2026 | 工作记忆 = 认知工作区, 跨检索-生成持久化, Path-Outcome 双奖励 | ✅ 翻译为: 推理 pass 间维护 workingMemory 状态对象 |
| **AgeMem** | ACL 2026 | 统一 LTM/STM 管理, 记忆操作 = 工具动作, 自主决定存/取/更新/丢弃 | ✅ 翻译为: 给 agent 加 memory.write/summarize/forget 工具 (经治理) |
| **Agent Memory Characterization** | 2026 | 系统级 10 条设计建议: 构建调度/能力下限/摊销/新鲜度-延迟/舰队管理 | ✅ 翻译为: 记忆系统的运维和成本优化策略 |

### 2.3 编排 (Orchestration)

| 突破 | 来源 | 核心洞见 | Tandem 可取性 |
|-------|------|----------|---------------|
| **AdaptOrch** | 2026 | 拓扑 > 模型 — 按任务 DAG 选编排拓扑, O(\|V\|+\|E\|) 路由, +12-23% | ✅ 已落地 (topology.ts); 可深化 DAG 分解 |
| **RHI** | 2026 | 递归 harness 自优化 — pairwise feedback 迭代 prompt 级 harness, 成本 -60% | ✅ 翻译为: 用 eval trace 做 pairwise 对比, 自动优化 system prompt |
| **Meta-Team** | 2026 | 协作式自进化 — agent/交互/团队三层, +6.6% | ⚠️ Tandem 是单中央 AI; 可取"多视角交叉反思" |
| **Shepherd** | 2026 | 可逆执行轨迹 — Git 式 first-class 执行对象, fork/revert/merge | ✅ 翻译为: tool-loop 每步存执行快照, 支持从某步重试 |

### 2.4 评估 (Evaluation)

| 突破 | 来源 | 核心洞见 | Tandem 可取性 |
|-------|------|----------|---------------|
| **Claw-Eval** | 2026 | 轨迹感知评分 — 3 证据通道 (trace/audit/snapshot), Completion+Safety+Robustness, Pass@k vs Pass^k | ✅ 翻译为: eval trace 加执行过程维度 + 多试一致性 |
| **TraceElephant** | 2026 | 失败归因 — (mistake_agent, mistake_step) 定位 | ✅ 翻译为: agent 失败时自动定位"哪一步 tool call 导致跑偏" |

### 2.5 护栏与安全 (Guardrails & Safety)

| 突破 | 来源 | 核心洞见 | Tandem 可取性 |
|-------|------|----------|---------------|
| **RAP-ID** | ACL 2026 | 机制式注入检测 — 内部状态三信号 (指令相似度/反事实增益/策略冲突), 无需训练 | ⚠️ 需访问模型内部状态; Tandem 用 API 无法取. 可取"指令相似度"思路做正则增强 |
| **AgentSentry** | 2026 | 时序因果诊断 — 工具返回边界做反事实重执行, 定位注入接管点 | ✅ 翻译为: 在 tool-loop 中对可疑 tool output 做"不含该输出的重推理"对比 |
| **PlanGuard** | 2026 | 计划级一致性 — 隔离 planner 预生成参考行动集, 层级验证 | ✅ 翻译为: tool-loop 前先让 LLM 生成"预期行动列表", 执行时对比 |
| **DeepContext** | 2026 | 有状态多轮意图漂移 — RNN 追踪意图轨迹, F1=0.84, <20ms | ✅ 翻译为: 维护对话级 intent state, 检测渐进式偏离 |
| **RedVisor** | 2026 | 推理感知防御 — 两阶段 (检测+生成), KV 缓存零拷贝复用 | ⚠️ 需模型内部访问; 可取"两阶段"思路: 先安全审查再生成 |

### 2.6 DeepSeek V3.2 (当前模型底座)

- **DeepSeek Sparse Attention (DSA)**: 长上下文高效注意力
- **Thinking-with-tools**: `reasoning_content` + `tool_calls` 同轮回传 (已接入)
- **大规模 agentic 任务合成**: 训练数据提升工具调用合规性
- **128K 上下文 + 函数调用 + 结构化输出**: 已用
- **Speciale 变体**: 深推理专用, 不支持工具调用 (不适合 Tandem agentic 场景)

---

## 三、现状 vs 前沿对标矩阵

```
              ┌──────────────────────────────────────────────────────────┐
              │           TandemAI 五器官成熟度 (2026-07)                │
              ├──────────┬──────────┬──────────┬──────────┬──────────────┤
              │ 感知     │ 推理     │ 反思     │ 行动     │ 记忆         │
              │ 70%      │ 55%      │ 60%      │ 50%      │ 45%          │
              └──────────┴──────────┴──────────┴──────────┴──────────────┘

              ┌──────────────────────────────────────────────────────────┐
              │           2026 前沿覆盖度                               │
              ├──────────┬──────────┬──────────┬──────────┬──────────────┤
              │ 已落地   │ 部分落地 │ 未落地   │ 不适用   │ 可取但未取   │
              ├──────────┼──────────┼──────────┼──────────┼──────────────┤
              │ AdaptOrch│ MAGMA-   │ Meta-    │ RAP-ID   │ MRAgent      │
              │ 拓扑门控 │ lite时间 │ Reasoner│ (需内部  │ 主动重构    │
              │ Compaction│ 轴      │ 元推理   │ 状态)    │              │
              │ Eval     │ Guardrail│ GoT-R1  │ RedVisor │ PlanGuard    │
              │ trace台  │ 正则层   │ 图式推理 │ (需KV    │ 计划验证    │
              │ Output   │ Attribution│ SCR   │ 缓存)    │              │
              │ guard    │ 归因     │ Generate │ PaCoRe   │ DeepContext  │
              │ 硬红线   │          │ -Verify  │ (并行)   │ 状态护栏    │
              │ Reranker │          │ -Revise  │          │              │
              │          │          │ Shepherd │          │ RHI harness  │
              │          │          │ 可逆轨迹 │          │ 自优化      │
              │          │          │ Claw-Eval│          │              │
              │          │          │ 轨迹评分 │          │ AgeMem       │
              │          │          │          │          │ 统一记忆管理 │
              └──────────┴──────────┴──────────┴──────────┴──────────────┘
```

---

## 四、进化方向 (逐器官)

### 4.1 感知进化: 从"正则触发"到"语义感知 + 主动探索"

**P0 (已可做)**:
- 用 LLM 做 1-shot 语义判断替代正则触发 (`shouldPerceive` → 轻量 LLM 分类)
- 感知结果结构化: tool 输出不直接拼入 prompt, 而是提取 key facts → 优先级排序 → 结构化注入

**P1 (短期)**:
- 语义缓存: 用 embedding 相似度匹配缓存 key, 而非字符串归一化
- 动态工具选择: 按问题语义选择子工具集, 而非每次全白名单

**P2 (中期)**:
- 主动感知 (MRAgent 式): 第一轮 tool 结果中发现新线索 → LLM 判断"是否需要追查" → 迭代检索
- 工作记忆: 感知 pass 维护 `workingMemory` 对象, 跨 tool call 累积证据

### 4.2 推理进化: 从"线性 CoT"到"结构化元推理"

**P0 (已可做)**:
- Generate-Verify-Revise: 在 `runToolLoop` 的每轮结束后加验证子步 (LLM 自检"当前路径是否合理")
- 动态终止: 基于自验证结果判断收敛, 而非仅靠 maxRounds

**P1 (短期)**:
- 元推理 step: 每 N 轮插入一个 meta-step, LLM 评估"当前策略是否有效, 是否需要回退/切换"
- 推理图数据结构: 用 DAG 记录推理路径 (节点=原子推理, 边=依赖), 支持分支/合并

**P2 (中期)**:
- 多路径探索 + 综合: 对复杂问题并行跑 2-3 条推理路径, 再用 LLM 综合 (PaCoRe 式, 但用 API 并行)
- 即时 scaffold 构建: 按问题类型动态选择推理框架 (DOLORES 式), 非固定 ReAct

### 4.3 反思进化: 从"月级计数"到"情景学习 + 因果归因"

**P0 (已可做)**:
- 情景级反思: 单次对话被推翻/被投诉时, 即时记录并做 mini-reflection (不等月度)
- 反思回馈推理: proposedChanges 不仅调配置阈值, 也调推理策略 (如"某类问题应优先用某工具")

**P1 (短期)**:
- 反事实归因: 对 positive/negative 归因, 让 LLM 做"如果没给建议, KR 会怎样"的假设推理
- 多视角交叉反思: 对同一组 metrics, 用不同 system prompt 跑两次反思, 交叉验证

**P2 (中期)**:
- 协作式进化 (Meta-Team 式): 中央 AI + 分身 + 人工 三个视角各自反思 → 交叉交换 → 共同进化
- 归因因果图: 把归因结果存入因果图, 长期积累"哪种建议在什么条件下有效"的因果知识

### 4.4 行动进化: 从"串行执行"到"可逆轨迹 + 计划验证"

**P0 (已可做)**:
- 并行工具执行: tool-loop 中识别独立 tool calls → 并行 `Promise.all` 执行
- 计划级验证 (PlanGuard 式): tool-loop 前先让 LLM 生成"预期行动列表", 执行时对比实际 tool calls

**P1 (短期)**:
- 执行快照: tool-loop 每步存 `{step, tool, args, result, messages}` 快照, 支持从某步重试
- 工具输出校验: 对关键工具 (okr.health_digest 等) 的输出做 schema 校验, 防幻觉数据

**P2 (中期)**:
- MCP 桥接 V2: 真接入 `@modelcontextprotocol/sdk`, 4-gate Skill Gateway 全实现
- 可逆执行 (Shepherd 式): 执行快照支持 fork/revert/merge, meta-agent 可操作执行轨迹

### 4.5 记忆进化: 从"单维检索"到"多图记忆 + 主动重构"

**P0 (已可做)**:
- LLM reranker: 在确定性 rerank 后加一轮 LLM 重排 (top-5 → LLM 选 top-3), 提升语义匹配
- 记忆整合: 定期跑 consolidation pass, 合并重复/相似 memory, 降权过时 memory

**P1 (短期)**:
- 因果图: 在 `memory.timeline` 基础上加因果边 (A 导致 B), 支持因果链查询
- 工作记忆: 推理 pass 间维护 `workingMemory` 状态, 跨检索-生成累积证据 (State Aware RAG 式)

**P2 (中期)**:
- 四图记忆 (MAGMA 式): 语义图 / 时间图 / 因果图 / 实体图 分别存储, 按查询意图选图遍历
- 主动记忆重构 (MRAgent 式): 检索不是 top-K, 而是 LLM 驱动的迭代探索: 检索 → 分析 → 发现新线索 → 再检索
- 统一记忆管理 (AgeMem 式): 给 agent 加 memory.write / memory.summarize / memory.forget 工具 (经治理签批)

### 4.6 评估进化: 从"输出评分"到"轨迹感知 + harness 自优化"

**P0 (已可做)**:
- 轨迹维度评分: eval trace 加执行过程维度 (tool call 顺序/参数/延迟/失败率)
- 多试一致性: 对同一 query 跑 3 次, 报 Pass@3 vs Pass^3 (区分能力 vs 运气)

**P1 (短期)**:
- 独立裁判: LLM grader 用不同模型 (如 deepseek-reasoner) 裁判 deepseek-chat 的输出
- 失败归因: agent 失败时自动定位"哪一步 tool call 导致跑偏" (TraceElephant 式)

**P2 (中期)**:
- Harness 自优化 (RHI 式): 用 eval trace 做 pairwise 对比, 自动优化 system prompt / tool 描述
- 人工标注工作流: admin 看板加"人工校正"入口, 沉淀人工标注信号进 eval dataset

### 4.7 护栏进化: 从"无状态正则"到"有状态因果防御"

**P0 (已可做)**:
- 对话级 intent state: 维护一个轻量 intent 状态对象, 每轮更新, 检测渐进式偏离
- 计划一致性验证 (PlanGuard 式): tool-loop 前预生成参考行动集, 执行时对比

**P1 (短期)**:
- 工具返回边界检测 (AgentSentry 式): 对可疑 tool output 做"不含该输出的重推理"对比, 检测注入接管
- 多轮意图漂移检测 (DeepContext 式): 用 embedding 序列追踪意图轨迹, 检测渐进式攻击

**P2 (中期)**:
- 两阶段安全 (RedVisor 式): 先安全审查 context → 再生成回答, 审查结果作为 generation 约束
- Hook 生命周期 (Claude 式): 在 agent 执行的关键节点 (pre-tool/post-tool/pre-output) 插入可配置 hook

---

## 五、优先级排序 (推理时落地可行性)

### Tier 0 — 立即可做 (纯推理时 pass / 数据结构变更, 无需训练)

| 方向 | 器官 | 预期收益 | 实现复杂度 |
|------|------|----------|------------|
| Generate-Verify-Revise | 推理 | 推理准确率 ↑, 冗余 token ↓ | 中 (tool-loop 加验证子步) |
| 动态终止监督 | 推理 | 推理时间 ↓, 过早/过晚收敛 ↓ | 低 (自验证判断替代 maxRounds) |
| 并行工具执行 | 行动 | 延迟 ↓ (多独立工具并行) | 低 (Promise.all) |
| 计划级验证 (PlanGuard) | 行动/护栏 | 注入攻击成功率 ↓ | 中 (预生成参考行动集) |
| 情景级反思 | 反思 | 学习频率 ↑ (月→即时) | 中 (单次对话失败触发 mini-reflection) |
| 轨迹维度评分 | 评估 | 评估覆盖度 ↑ | 低 (eval trace 加字段) |
| 多试一致性 | 评估 | 区分能力 vs 运气 | 低 (同 query 跑 3 次) |
| LLM reranker | 记忆 | 语义匹配准确率 ↑ | 低 (rerank 后加 LLM 重排) |
| 记忆整合 pass | 记忆 | 记忆质量 ↑, 冗余 ↓ | 中 (定期合并/降权) |

### Tier 1 — 短期可实现 (1-2 个迭代周期)

| 方向 | 器官 | 预期收益 | 实现复杂度 |
|------|------|----------|------------|
| 元推理 step | 推理 | 策略切换/回退能力 | 中 (每 N 轮插 meta-step) |
| 推理图数据结构 | 推理 | 分支/合并/回溯 | 高 (DAG + 遍历) |
| 语义触发 + 语义缓存 | 感知 | 触发准确率 ↑, 缓存命中率 ↑ | 中 (LLM 分类 + embedding) |
| 主动感知 (MRAgent 式) | 感知 | 多跳信息发现能力 | 中 (迭代检索) |
| 反事实归因 | 反思 | 归因因果性 ↑ | 中 (LLM 假设推理) |
| 反思回馈推理策略 | 反思 | 闭环: 反思→推理策略调整 | 中 (proposedChanges 扩展) |
| 执行快照 + 重试 | 行动 | 可恢复性 ↑ | 中 (每步存快照) |
| 因果图 | 记忆 | 因果链查询能力 | 高 (图数据结构) |
| 工作记忆 | 记忆/推理 | 跨步骤证据累积 | 中 (状态对象) |
| 独立裁判 LLM grader | 评估 | 评估可信度 ↑ | 低 (换模型) |
| 失败归因 | 评估 | 调试效率 ↑ | 中 (自动定位 mistake step) |
| 对话级 intent state | 护栏 | 多轮攻击检测 | 中 (状态追踪) |
| 工具返回边界检测 | 护栏 | 注入定位能力 | 中 (反事实重推理) |

### Tier 2 — 中期 (需要较大架构变更)

| 方向 | 器官 | 预期收益 | 实现复杂度 |
|------|------|----------|------------|
| 多路径探索 + 综合 | 推理 | 复杂问题准确率 ↑↑ | 高 (并行 + 综合) |
| 即时 scaffold 构建 | 推理 | 适应性 ↑ | 高 (动态框架选择) |
| 四图记忆 (MAGMA) | 记忆 | 查询自适应检索 ↑↑ | 高 (四图 + 策略遍历) |
| 主动记忆重构 | 记忆 | 多跳推理能力 ↑↑ | 高 (LLM 驱动迭代检索) |
| 统一记忆管理 (AgeMem) | 记忆 | 自主记忆操作 | 高 (新工具 + 治理) |
| MCP 桥接 V2 | 行动 | 外部工具扩展 | 高 (SDK + 4-gate) |
| 可逆执行 (Shepherd) | 行动 | 可回滚/fork/重放 | 高 (执行轨迹 first-class) |
| Harness 自优化 (RHI) | 评估 | agent loop 自动优化 | 高 (pairwise + 迭代) |
| 协作式进化 (Meta-Team) | 反思 | 多视角交叉验证 | 高 (多 agent 协作) |
| 两阶段安全 (RedVisor) | 护栏 | 检测+生成一体化 | 高 (两阶段 pipeline) |
| Hook 生命周期 | 护栏 | 可配置安全节点 | 高 (hook 系统) |

---

## 六、总结

### TandemAI 当前智慧程度评估

```
感知: 70% — 能看, 但靠正则触发, 不够语义化, 不够主动
推理: 55% — 能想, 但是线性 CoT, 无元推理, 无自验证
反思: 60% — 能学, 但是月级周期, 无情景学习, 归因非因果
行动: 50% — 能做, 但是串行执行, 无计划验证, MCP 未实现
记忆: 45% — 能记, 但是单维检索, 无多图, 无主动重构
评估: 55% — 能评, 但是输出级, 无轨迹感知, 无 harness 自优化
护栏: 40% — 能挡, 但是无状态, 正则 only, 无多轮检测
```

### 进化核心命题

> **Tandem 是推理层产品 (DeepSeek API 之上, 不自训模型), 所有突破取架构洞见不取训练方法。**

翻译规则:
- RL 类突破 (GRPO/SRPO/HCAPO) → 推理时 pass / 数据结构 / 编排拓扑
- 内部状态类突破 (RAP-ID/RedVisor) → 不适用 (API 无内部访问), 取外围思路
- 训练数据类突破 (PaCoRe/SCR) → 取推理范式 (Generate-Verify-Revise), 不取训练方法

### 最高优先级 (Tier 0 中最关键的 3 项)

1. **Generate-Verify-Revise + 动态终止** — 推理器官的核心升级, 直接提升所有 agent 路径的准确率
2. **计划级验证 (PlanGuard)** — 行动器官的安全升级, 在 agentic 场景中防注入劫持
3. **轨迹维度评分 + 多试一致性** — 评估器官的基础升级, 没有它, 其他进化无法度量
