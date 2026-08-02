# TandemAI 前沿技术深度对比分析 (2026-08-01)

> **方法**: 系统检索 ACL 2026 / ICML 2026 / arXiv 2026 全年论文 + 产品前沿 (OpenAI/Anthropic/Microsoft/DeepSeek), 逐项对标 TandemAI 现有代码, 按 **产品价值 × 落地可行性** 优先级排序.
>
> **核心约束**: Tandem 是推理层产品 (DeepSeek API 之上, 不自训模型). 所有 RL 类突破只取架构洞见, 翻译成推理时 pass / 数据结构 / 编排拓扑.

---

## 一、推理器官 (Reasoning)

### 1.1 Meta-Reasoner — "思考如何思考" (ACL 2026 Findings)

**论文洞见**: LLM 在多步推理中会陷入无效路径, 无法回溯或切换策略. Meta-Reasoner 用 contextual multi-armed bandit (CMAB) 在推理过程中动态选择策略: 回溯 / 换方法 / 重启. 准确率 +9-12%, 推理时间 -28-35%.

**TandemAI 现状**: `tool-loop.ts` 的 `verifyStep` 只做 "证据是否足够" 的二值判断. 没有 "当前路径是否有前途" 的元认知. 一旦 LLM 走偏, 会浪费剩余轮数.

**差距**: 缺少 **策略级元认知** — 不是问 "证据够不够", 而是问 "当前方向对不对".

**可借鉴点 (推理时翻译)**:
- 在 `verifyStep` 后增加 **progressive check**: 让 LLM 评估当前推理路径的信心度 (high/medium/low)
- 信心度 low + 剩余轮数 > 1 → 插入 "strategy reset" 消息, 让 LLM 换方法
- 不需要 CMAB 训练, 用规则模拟: `if confidence == 'low' && round > 1 → inject "Let me reconsider the approach"`
- **价值: 高** | **可行性: 高** | 改动量: ~30 行

### 1.2 SAVER — 自审验证推理 (ACL 2026)

**论文洞见**: LLM agent 的推理轨迹被当作 "内部信念" 指导行动, 但连贯的推理仍可能违反逻辑约束. SAVER 在行动提交前做 **对抗性审计**: 生成多个 persona-conditioned 候选信念, 用 k-DPP 采样确保多样性, 定位违反点, 做最小修复.

**TandemAI 现状**: `verifyStep` 是单次 LLM 自检, 没有 **多样性对抗**. 如果 LLM 的验证和推理共享同一个盲点, 验证会通过但答案错误.

**差距**: 验证缺少 **视角多样性** — 同一个 LLM 用同一个上下文验证自己, 存在系统性盲点.

**可借鉴点**:
- `verifyStep` 增加 **persona rotation**: 用不同 system prompt 角色验证同一结果 (如 "skeptical auditor" / "domain expert" / "safety checker")
- 两个角色都判 SUFFICIENT 才收敛; 一个说 INSUFFICIENT 则继续
- **价值: 中** | **可行性: 中** | 增加一次 LLM 调用延迟

### 1.3 PaCoRe — 并行协调推理 (ACL 2026)

**论文洞见**: 传统推理是串行的, 受上下文窗口限制. PaCoRe 用多轮并行推理轨迹 + 消息传递架构, 每轮启动多条并行推理路径, 压缩发现为消息, 综合后指导下一轮. 8B 模型在 HMMT 2025 达 94.5% (超过 GPT-5 的 93.2%).

**TandemAI 现状**: `tool-loop.ts` 是单线程串行推理. Tier0-2 做了 **工具并行**, 但推理本身仍是单路径.

**差距**: 推理路径单一, 复杂问题无法多路探索.

**可借鉴点 (架构洞见, 不取训练)**:
- 对复杂问题 (round > 2 且未收敛), 启动 **2-3 条并行推理路径**, 每条用不同 system prompt 引导
- 各路径独立跑 tool-loop, 结果汇总后用 LLM 做 synthesis
- 这本质上是 AdaptOrch 的 hybrid topology 在推理层的应用
- **价值: 高 (复杂问题)** | **可行性: 低 (3x token 成本)** | 暂列 backlog

### 1.4 MTI — 最小测试时干预 (ACL 2026)

**论文洞见**: 推理错误高度集中在少数高熵 token 上. MTI 只在这些位置做 CFG 引导, 用 KV cache 复用近似无条件分支, 几乎零开销. DeepSeek-R1-7B +9.28%.

**TandemAI 现状**: 无法干预模型内部 token 生成 (API 模式).

**结论**: **不可借鉴** — 需要模型内部访问权, API 产品无法实现.

---

## 二、记忆器官 (Memory)

### 2.1 MAGMA — 多图代理记忆 (ACL 2026)

**论文洞见**: 现有记忆系统用单一语义相似度检索, 把时间/因果/实体信息混在一起. MAGMA 把每条记忆在 **四个正交图** (语义/时间/因果/实体) 上表示, 检索是策略引导的图遍历, 按查询意图选择图. 在 LoCoMo 和 LongMemEval 上显著超越 SOTA.

**TandemAI 现状**: `lib/memory/reranker.ts` 用 BM25-lite + entity + recency + popularity + priority 五信号融合. 因果关系完全没有. 时间只有 recency 衰减, 没有时间线图. 实体只有 ID 匹配, 没有实体图.

**差距**: **无因果图, 无时间线图, 无实体关系图**. 记忆检索是扁平的, 无法回答 "这个决策导致了什么" 或 "这个 KR 的历史变化轨迹".

**可借鉴点 (数据结构, 不取图数据库)**:
- **Phase 1 (低成本)**: 在 `MemoryEntry` 的 metadata 中增加 `causedBy: string[]` 和 `caused: string[]` 字段, 记录记忆间的因果关系
- **Phase 2**: 在 reranker 中增加 **causal bonus**: 如果查询包含 "为什么" / "导致" / "影响", 因果链上的记忆获得加分
- **Phase 3**: 构建轻量实体图 — 从记忆正文中抽取实体关系, 存 KvStore
- **价值: 高 (企业治理核心需求)** | **可行性: 中** | 分阶段实施

### 2.2 MRAgent — 主动记忆重构 (arXiv 2026)

**论文洞见**: 记忆不是 "检索即用", 而是 **重构** — LLM 在记忆访问中集成推理, 迭代探索和剪枝检索路径, 基于中间证据动态调整. Cue-Tag-Content 图结构, tag 作为语义桥梁.

**TandemAI 现状**: 记忆检索是一次性的: query → rerank → top-K → 塞入 context. 没有 "先看 tag, 再决定深入哪条路径" 的两阶段检索.

**差距**: 检索是被动的, 不会根据中间发现动态调整检索方向.

**可借鉴点**:
- 在 reranker 输出 top-K 后, 增加一个 **retrieval reasoning step**: LLM 看候选摘要, 判断 "需要补充什么信息", 生成二次查询
- 这本质上是 agentic RAG 在记忆层的应用
- **价值: 中** | **可行性: 中** | 增加一轮 LLM 调用

### 2.3 Mnemis — 双路检索 (ACL 2026)

**论文洞见**: System-1 (语义相似度) + System-2 (层次化全局选择). 基础图做相似度检索, 层次图做自上而下遍历. 两者互补: System-1 找语义相近的, System-2 找结构相关但语义远的. GPT-4.1-mini 在 LoCoMo 达 93.9.

**TandemAI 现状**: 只有 System-1 (BM25-lite + signals). 没有 System-2 的层次化分类体系.

**差距**: 无法发现 "语义不远但结构相关" 的记忆. 例如: "OKR-Q3 进度" 和 "7月月报" 语义不完全重叠, 但结构上高度相关.

**可借鉴点**:
- 给 MemoryEntry 增加 `categoryPath: string[]` (如 `["OKR", "Q3", "进度"]`), 检索时做层次匹配
- **价值: 中** | **可行性: 高** | KvStore metadata 扩展

### 2.4 GAM — 解耦编码与整合 (ACL 2026)

**论文洞见**: 对话中实时写入会引入噪声. GAM 把记忆生命周期分两阶段: **Episodic Buffering** (局部事件图, 隔离噪声) → **Consolidation** (语义变化触发时才整合到全局图). 灵感来自睡眠依赖记忆整合.

**TandemAI 现状**: 所有记忆实时写入, 没有缓冲期. `materializePromotion` 是三级签批的写入控制, 但不是噪声过滤.

**差距**: 对话中的临时信息直接进记忆库, 可能引入噪声.

**可借鉴点**:
- 已有 `memoryCaptureCandidates` 仓 — 这就是 episodic buffer!
- 补一个 **consolidation trigger**: 不是每条 capture 都晋升, 而是等 "语义变化" (新主题出现) 时批量整合
- **价值: 中** | **可行性: 高** | 现有架构已支持, 只缺 trigger 逻辑

### 2.5 SimpleMem — 语义无损压缩 (arXiv 2026)

**论文洞见**: 三阶段: (1) 语义结构化压缩 — 蒸馏为多视图索引记忆单元; (2) 在线语义合成 — session 内实时合并相关记忆消除冗余; (3) 意图感知检索规划. F1 +26.4%, token -30x.

**TandemAI 现状**: 记忆正文原样存储, 没有压缩. 长对话的 memory body 可能很长, 检索时塞入 context 浪费 token.

**差距**: 记忆未压缩, 信息密度低.

**可借鉴点**:
- 在 `materializePromotion` 时增加 **compression pass**: 用 LLM 把原始记忆压缩为结构化摘要 + 关键事实
- 存压缩版 + 原始版, 检索时用压缩版, 需要细节时展开原始版
- **价值: 高 (长对话场景)** | **可行性: 高** | 一次 LLM 调用

### 2.6 SELFCOMPACT — 自压缩代理 (arXiv 2026)

**论文洞见**: 让模型自己决定 **何时压缩、如何压缩**. 给模型一个 compaction tool + 轻量 rubric (子任务完成时压缩, 推理中不压缩). 不需要微调.

**TandemAI 现状**: `tool-loop.ts` 的 `compaction.ts` 是固定间隔压缩. 不考虑轨迹结构.

**差距**: 压缩时机不智能 — 可能在推理中途压缩, 丢失关键信息.

**可借鉴点**:
- 把 compaction 做成一个 **tool** 暴露给 LLM, 让它自己决定何时调用
- 加 rubric: "当当前子任务已完成且需要继续下一个时, 调用 summarize_context"
- **价值: 中** | **可行性: 高** | tool-loop 已有 tool 注册机制

### 2.7 CWL — 上下文窗口生命周期 (arXiv 2026)

**论文洞见**: 不是压缩, 而是 **结构化驱逐**. agent 标注轨迹为有类型的、依赖链接的 episode, 超预算时按优先级驱逐. 保留用户轮次和活跃推理上下文, 丢弃效果已持久化的行动 episode. 单 agent 完成 89 个连续任务, 80M token 无退化.

**TandemAI 现状**: `compaction.ts` 做的是全量摘要, 不是结构化驱逐.

**差距**: 压缩会丢失因果结构, 且压缩本身可能引入幻觉.

**可借鉴点**:
- 在 tool-loop 的 messages 中增加 **episode 标注** (如 `<!-- episode: search_okr, status: completed -->`)
- 压缩时优先保留: 用户消息 + 最近 N 轮 + 未完成 episode; 丢弃: 已完成且结果已持久化的 episode
- **价值: 高 (长 horizon agent)** | **可行性: 中** | 需要改 message 结构

---

## 三、评估器官 (Evaluation)

### 3.1 Claw-Eval — Pass^3 一致性评估 (ACL 2026)

**论文洞见**: 单次通过可能是运气. Pass^3 要求 **3 次独立试验全部通过** 才算成功. 300 人工验证任务, 2159 条 rubric, 三维度 (Completion/Safety/Robustness). 关键发现: trajectory-opaque 评估会漏掉 44% 安全违规和 13% 健壮性失败.

**TandemAI 现状**: Tier0-4 加了 `verifyConvergeGrader` 和 `planGuardGrader`, 但评估是 **单次** 的. 没有 Pass^k 一致性度量. 没有 Safety 和 Robustness 维度.

**差距**: 评估只看 "能不能做对", 不看 "每次都能做对吗". 这正是生产级可靠性的核心.

**可借鉴点**:
- 在 eval runner 中增加 **multi-trial mode**: 对同一 case 跑 3 次, 记录 Pass^3
- 增加 **Safety grader**: 检查 trace 中是否有未授权 tool call / PII 泄露 / 越权操作
- 增加 **Robustness grader**: 注入轻微扰动 (如改 prompt 措辞), 看结果是否一致
- **价值: 极高 (生产级核心)** | **可行性: 高** | eval 框架已有, 只需扩展

### 3.2 TraceElephant — 失败归因 (ACL 2026)

**论文洞见**: 多 agent 系统中, 失败归因 (哪个 agent / 哪一步导致失败) 在全量 trace 下准确率比 output-only 高 76%. 220 条标注失败轨迹, 3 个代表性系统.

**TandemAI 现状**: eval trace 记录了 tool calls 和结果, 但没有 **失败归因** — 不会自动定位 "是哪一步的推理/工具调用导致了最终失败".

**差距**: 失败时只知道 "失败了", 不知道 "为什么失败" / "哪一步是决定性错误".

**可借鉴点**:
- 在 eval grader 中增加 **failure attribution pass**: 失败 trace 用 LLM 回溯分析, 标注 `decisiveFailureStep` 和 `failureReason`
- 归因结果存入 `EvalAttribution` (已有此仓!)
- **价值: 高 (调试/改进闭环)** | **可行性: 高** | 仓库已就位

### 3.3 可靠性衰退曲线 (arXiv 2026)

**论文洞见**: 4 个度量: RDC (pass k 随任务时长衰退) / VAF (方差放大因子) / GDS (优雅降级分) / MOP (崩溃 onset 点). 关键发现: 前沿模型崩溃率最高 (19%), 因为它们尝试更激进的策略 ("MOP paradox"). memory scaffold 普遍损害长 horizon GDS.

**TandemAI 现状**: 没有任何可靠性度量. eval 只看单次 pass/fail.

**差距**: 完全没有 reliability 维度. 生产部署时不知道 "任务越长, 可靠性降多快".

**可借鉴点**:
- 在 eval 系统中增加 **task duration bucket**: short / medium / long / very-long
- 对每个 bucket 计算 Pass^k, 画 RDC
- GDS: 部分完成给部分分 (不是 0/1)
- **价值: 高** | **可行性: 中** | 需要分类任务时长

---

## 四、行动/安全器官 (Action & Guardrails)

### 4.1 PlanGuard — 计划一致性验证 (arXiv 2026)

**论文洞见**: 隔离的 Planner 只看用户指令生成参考行动集, 执行时对比实际 tool call. 层级验证: 先硬约束 (未授权工具直接拦截), 再 Intent Verifier (参数偏差是格式变体还是恶意劫持). ASR 从 72.8% 降到 0%.

**TandemAI 现状**: Tier0-3 实现了 PlanGuard, 但只做 **偏离计数**, 不拦截. 没有 Intent Verifier 区分 "良性格式偏差" vs "恶意注入".

**差距**: PlanGuard 是被动的 (记录偏离), 不是主动的 (拦截可疑调用). 缺少层级验证.

**可借鉴点**:
- PlanGuard 偏离 > 阈值时, 不是只记数, 而是 **触发 Intent Verifier**: 让 LLM 判断偏离是良性还是恶意
- 良性 → 放行 + 记录; 恶意 → 拒绝 tool call + 审计 + 降级为 "无法执行" 响应
- 增加硬约束: tool whitelist (PlanGuard 参考集之外的 tool 直接拒绝)
- **价值: 极高 (有外网用户 + 不可信输入)** | **可行性: 高** | 现有 PlanGuard 基础上扩展

### 4.2 FIDES — 信息流确定性执行 (Microsoft Agent Framework 2026)

**论文洞见**: 每条内容携带 integrity label (trusted/untrusted) + confidentiality label (public/private). 标签通过中间件自动传播, 策略在敏感工具执行前 **确定性** 检查. 不依赖模型判断 — 模型决定做什么, 框架决定什么被允许.

**TandemAI 现状**: 有 `output-guard.ts` 做输出矫正, 有 `skillGateway` 四闸. 但没有 **信息流标签** — 不可信内容 (web search / 手抄 / 邮件) 进入 context 后, 下游 tool call 不追踪其来源.

**差距**: 不可信内容混入 context 后, 模型可能基于它调用敏感工具 (如写 Memory / 发通知), 框架无法确定性阻止.

**可借鉴点**:
- 给 tool call 结果增加 `integrity: 'trusted' | 'untrusted'` 元数据
- untrusted 内容在 context 中用标记包裹 (如 `[UNTRUSTED: ...]`)
- 敏感工具 (writeMemory / sendNotification / executeAction) 执行前检查 context 中是否有 untrusted 内容
- 有 untrusted 内容 → 拒绝或要求人工审批
- **价值: 极高 (安全核心)** | **可行性: 中** | 需要改 tool result 格式

### 4.3 IPIGUARD — 工具依赖图防御 (EMNLP 2025)

**论文洞见**: 把任务执行建模为 Tool Dependency Graph (DAG) 遍历. 严格按拓扑序执行, 禁止访问未预批准的工具. 支持 Argument Estimation (动态填充未知参数) 和 Node Expansion (只读操作可动态扩展).

**TandemAI 现状**: PlanGuard 生成参考行动列表, 但不是 DAG — 没有依赖关系, 没有拓扑序约束.

**差距**: PlanGuard 是扁平列表, 不是图. 无法约束 "必须先查再写" 的依赖关系.

**可借鉴点**:
- `generateReferenceActions` 升级为 **生成 Tool DAG**: 不只列工具, 还标注依赖关系
- 执行时验证: 当前 tool call 的前置工具是否已执行
- **价值: 中** | **可行性: 中** | 需要改 PlanGuard 数据结构

### 4.4 RAP-ID — 机制级注入检测 (ACL 2026 Findings)

**论文洞见**: 不看输出, 看模型内部状态 — 检测 "冒充者" 行为: 模仿系统指令语义 (Directive Likeness) / 篡夺注意力 (Counterfactual Gain) / 触发潜在风险概念 (Policy Conflict). 训练-free, 只需前向传播.

**TandemAI 现状**: 无法访问模型内部状态 (API 模式).

**结论**: **不可借鉴** — 需要模型内部访问权.

### 4.5 RedVisor — KV Cache 复用防御 (arXiv 2026)

**同上**: 需要模型内部访问权. **不可借鉴**.

---

## 五、编排拓扑 (Orchestration)

### 5.1 AdaptOrch — 任务自适应拓扑 (arXiv 2026)

**论文洞见**: 模型能力趋同时, 编排拓扑 > 模型选择. 4 种规范拓扑: parallel / sequential / hierarchical / hybrid. 基于 DAG 属性 (并行宽度/关键路径深度/子任务耦合度) 线性时间路由. 同模型下 +12-23%.

**TandemAI 现状**: `tool-loop.ts` 是固定 sequential topology. `agent-definitions.ts` 定义了不同 agent, 但没有 **拓扑路由** — 所有任务走同一种编排.

**差距**: 所有任务走同一种编排, 简单查询和复杂多步推理用同样的拓扑, 要么浪费 (简单任务用复杂拓扑) 要么不够 (复杂任务用简单拓扑).

**可借鉴点**:
- 在 `runToolLoop` 前增加 **topology router**: 分析任务复杂度, 选择编排模式
  - 简单查询 (单工具) → direct (跳过 loop)
  - 多步推理 (预估 > 3 步) → sequential (当前模式)
  - 独立子任务 → parallel (Tier0-2 已支持工具并行)
  - 复杂依赖 → hierarchical (lead agent + subagents)
- **价值: 高 (效率/准确性)** | **可行性: 中** | 需要任务分解器

### 5.2 Claude Code Agent Teams — 产品前沿 (Anthropic 2026)

**产品洞见**: Subagents (独立 context, 结果汇报回主 agent) vs Agent Teams (共享任务列表, 互相通信). Subagents 适合独立任务, Agent Teams 适合有依赖的协作. 关键: 按 **技术域** 分 (frontend/backend/QA/security), 不按 **业务角色** 分.

**TandemAI 现状**: `agent-definitions.ts` 定义了多个 agent persona, 但它们是 **串行调用** 的, 不是并行团队.

**差距**: 没有 multi-agent 协作. 复杂任务 (如 "分析 OKR 进度并生成改进建议") 是单 agent 串行完成.

**可借鉴点**:
- 复杂任务可拆分为: 数据收集 agent + 分析 agent + 建议生成 agent
- 各自独立 context, 结果汇总
- 这与 AdaptOrch 的 hierarchical topology 一致
- **价值: 中** | **可行性: 低 (token 成本 3x)** | 暂列 backlog

---

## 六、信用分配/学习 (Credit Assignment & Learning)

### 6.1 HCAPO — 事后信用分配 (arXiv 2026)

**论文洞见**: 长 horizon 任务中, 稀疏奖励无法定位 "哪一步贡献了成功/失败". HCAPO 用 LLM 自身作为事后 critic, 回溯评估每步的 Q-value. +7.7% (WebShop) / +13.8% (ALFWorld).

**TandemAI 现状**: CA-13 只计数 (decision_recorded + feedback_submitted), 不归因. 不知道 "中央 AI 的哪条建议真正改善了 KR".

**差距**: 学习飞轮缺归因 — 只知道 "建议被采纳了", 不知道 "这个建议是否有效".

**可借鉴点 (推理时翻译, 不取 RL)**:
- 在 KR check-in 后, 增加一个 **hindsight attribution pass**: LLM 回溯 "这个 KR 的变化, 哪些决策/建议可能贡献了"
- 结果写入 `EvalAttribution` 仓
- 月度 reflection 汇总时, 用归因数据生成 "哪些类型的建议最有效" 的洞察
- **价值: 极高 (学习飞轮核心)** | **可行性: 高** | 一次 LLM 调用

### 6.2 SRPO — 自反思策略优化 (ICML 2026)

**论文洞见**: LLM 分析自己的完整轨迹, 把错误合成为 "反思补丁", 用反思条件的重 rollout 作为蒸馏目标. 把稀疏终端信号变成密集 token 级信号. 只需 8% 训练 FLOPs.

**TandemAI 现状**: Tier0-5 的 `recordEpisodicReflection` 记录了情景反馈, 但没有 **反思补丁** — 不会生成 "如果重来, 应该怎么做" 的修正策略.

**差距**: 记录了错误信号, 但没有生成可复用的修正知识.

**可借鉴点 (推理时翻译)**:
- `recordEpisodicReflection` 增加 **reflection patch 生成**: 当 signal 是 negative 时, 让 LLM 生成 "如果重来, 应该怎么做" 的修正策略
- 修正策略存入 episodic reflection 的 `patch` 字段
- 下次类似场景出现时, 检索历史 patch 作为 few-shot 示例注入 prompt
- **价值: 高 (学习闭环)** | **可行性: 高** | 一次 LLM 调用

### 6.3 HiMPO — 记忆写入信用分配 (arXiv 2026)

**论文洞见**: 记忆写入的信用被下游工具失败/噪声/推理错误纠缠. HiMPO 用局部反事实 (替换前/后记忆, 同一 pre-write state) 估计记忆写入的局部效用, 用 hindsight relevance 做有界过滤器.

**TandemAI 现状**: `materializePromotion` 是人工签批的, 不需要自动信用分配.

**结论**: **低优先级** — TandemAI 的记忆写入是人工治理的, 不是 RL 自动学习的. 但洞见可用于评估 "哪些记忆被检索后真正有帮助" (反事实: 不检索这条记忆, 答案会变差吗).

---

## 七、结构化输出/工具调用 (Structured Output & Tool Calling)

### 7.1 DeepSeek V4 — 思考模式 + 工具调用 (2026-04)

**前沿洞见**: V4 把 "chat vs reasoner" 合并为 request 参数. 思考模式支持 tool calling (之前不支持). strict mode 做 server-side JSON Schema 验证. 1M context, 384K output.

**TandemAI 现状**: `lib/taf/provider/` 路由器按 scenario 选模型, 但没有利用 V4 的 thinking mode + tool calling 组合. `tool-loop.ts` 在 thinking mode 下可能丢失 `reasoning_content`.

**差距**: 没有利用 V4 思考模式 + 工具调用的组合能力. 复杂推理任务可能在非思考模式下工具调用质量不足.

**可借鉴点**:
- `scenario: 'reasoning_complex'` 时, 启用 V4 thinking mode + tool calling
- 保存 `reasoning_content` 到 eval trace (用于归因/调试)
- 探索 strict mode 减少 tool call 参数幻觉
- **价值: 高** | **可行性: 高** | 配置变更

### 7.2 OpenAI Responses API — 统一接口 (2026)

**前沿洞见**: Assistants API 2026-08-26 日落. Responses API 统一 endpoint, 内置工具 (web_search/file_search/code_interpreter/computer_use), `previous_response_id` 链式对话, 自动上下文管理.

**TandemAI 现状**: 用 OpenAI 兼容 API (DeepSeek). 不直接依赖 OpenAI SDK.

**结论**: **间接受益** — DeepSeek 兼容 OpenAI 格式, Responses API 模式可能影响 DeepSeek 后续 API 设计. 持续关注, 暂不迁移.

### 7.3 Programmatic Tool Calling (OpenAI 2026)

**前沿洞见**: 模型可以写 JavaScript 代码来协调工具调用 — 并行调用、循环、条件、中间结果处理. 适合有可预测控制流的场景.

**TandemAI 现状**: tool-loop 是应用层编排, 模型不能自己写代码编排工具.

**结论**: **不可直接借鉴** (DeepSeek 不支持), 但洞见有价值 — 复杂工具编排可以预编译为执行计划, 而非每步都问 LLM.

---

## 八、优先级排序 (按 产品价值 × 可行性)

### P0 — 立即行动 (高价值 + 高可行性)

| # | 升级 | 器官 | 改动量 | 价值 |
|---|------|------|--------|------|
| 1 | **PlanGuard 层级验证** (Intent Verifier + 硬约束拦截) | 安全 | ~60 行 | 安全核心, 有外网用户 |
| 2 | **Pass^3 多试一致性** (eval runner 跑 3 次) | 评估 | ~40 行 | 生产级可靠性度量 |
| 3 | **失败归因 pass** (失败 trace 自动定位决定性错误步) | 评估 | ~50 行 | 调试/改进闭环 |
| 4 | **Hindsight 归因 pass** (KR 变化归因到决策) | 学习 | ~60 行 | 学习飞轮核心 (#11) |
| 5 | **SRPO 反思补丁** (negative signal → 修正策略 → 检索复用) | 学习 | ~50 行 | 学习闭环 |
| 6 | **DeepSeek V4 thinking + tool calling** | 推理 | 配置 | 推理质量提升 |

### P1 — 短期推进 (高价值 + 中可行性)

| # | 升级 | 器官 | 改动量 | 价值 |
|---|------|------|--------|------|
| 7 | **FIDES 信息流标签** (trusted/untrusted 传播) | 安全 | ~100 行 | 注入防御确定性 |
| 8 | **SimpleMem 压缩 pass** (materializePromotion 时压缩) | 记忆 | ~60 行 | token 效率 30x |
| 9 | **MAGMA 因果图** (MemoryEntry 加 causedBy/caused) | 记忆 | ~80 行 | 企业治理核心 |
| 10 | **Meta-Reasoner 策略重置** (低信心度 → 换方法) | 推理 | ~30 行 | 推理效率 |
| 11 | **SELFCOMPACT 自压缩 tool** (模型自己决定何时压缩) | 记忆 | ~40 行 | 长任务不丢信息 |
| 12 | **Safety grader** (eval 检查未授权操作/PII) | 评估 | ~50 行 | 安全度量 |

### P2 — 中期探索 (中价值 + 中可行性)

| # | 升级 | 器官 | 改动量 | 价值 |
|---|------|------|--------|------|
| 13 | **CWL 结构化驱逐** (episode 标注 + 依赖感知压缩) | 记忆 | ~120 行 | 80M token 无退化 |
| 14 | **AdaptOrch 拓扑路由** (任务复杂度 → 编排模式) | 编排 | ~150 行 | 效率/准确性 |
| 15 | **MRAgent 主动检索** (两阶段: tag → 深入) | 记忆 | ~80 行 | 检索精度 |
| 16 | **Mnemis 层次化分类** (MemoryEntry 加 categoryPath) | 记忆 | ~40 行 | 结构相关发现 |
| 17 | **GAM 整合触发器** (capture → 语义变化时整合) | 记忆 | ~50 行 | 噪声过滤 |
| 18 | **可靠性衰退曲线** (duration bucket + RDC) | 评估 | ~80 行 | 长任务可靠性 |

### P3 — 长期 backlog (高价值 + 低可行性)

| # | 升级 | 器官 | 障碍 |
|---|------|------|------|
| 19 | **PaCoRe 并行推理路径** | 推理 | 3x token 成本 |
| 20 | **Agent Teams 多 agent 协作** | 编排 | token 成本 + 复杂度 |
| 21 | **IPIGUARD 工具 DAG** | 安全 | 数据结构大改 |

### 不可借鉴 (需模型内部访问)

| 论文 | 原因 |
|------|------|
| MTI (最小测试时干预) | 需 KV cache 访问 |
| RAP-ID (机制级注入检测) | 需模型内部状态 |
| RedVisor (KV cache 复用防御) | 需模型内部状态 |

---

## 九、与 Tier0 已实现的对照

| Tier0 已实现 | 对应前沿 | 差距 | 下一步 |
|---|---|---|---|
| Generate-Verify-Revise | SAVER (自审验证) | 缺 persona 多样性 | P1: #10 (Meta-Reasoner) 补策略重置 |
| 并行工具执行 | PaCoRe (并行推理) | 只并行工具, 不并行推理 | P3: #19 (backlog) |
| PlanGuard | PlanGuard (论文) | 缺层级验证 + 硬拦截 | P0: #1 (Intent Verifier) |
| 轨迹评分 | Claw-Eval (Pass^3) | 缺多试一致性 | P0: #2 (Pass^3) |
| 情景级反思 | SRPO (反思补丁) | 缺修正策略生成 | P0: #5 (反思补丁) |
| LLM reranker | Mnemis (双路检索) | 缺 System-2 层次检索 | P2: #16 (层次化分类) |

---

## 十、总结

**6 篇不可借鉴** (需模型内部访问) → 排除.

**21 项可借鉴**, 按优先级:
- **P0 (6 项)**: PlanGuard 层级验证 / Pass^3 / 失败归因 / Hindsight 归因 / 反思补丁 / V4 thinking+tools
- **P1 (6 项)**: FIDES 标签 / SimpleMem 压缩 / MAGMA 因果图 / Meta-Reasoner / SELFCOMPACT / Safety grader
- **P2 (6 项)**: CWL 驱逐 / AdaptOrch 拓扑 / MRAgent 检索 / Mnemis 层次 / GAM 整合 / 可靠性曲线
- **P3 (3 项)**: PaCoRe 并行推理 / Agent Teams / IPIGUARD DAG

**最大缺口**: 安全 (FIDES 信息流标签) + 评估 (Pass^3 + 失败归因) + 学习 (Hindsight 归因 + 反思补丁). 这三项是 TandemAI 从 "能用" 到 "可信可学" 的关键跃迁.

---

## 十一、可观测性 / LLM FinOps (Observability & Cost)

### 11.1 结构化调用埋点 — TandemAI 已有 vs 前沿最佳实践

**前沿共识 (2026)**: 每次 LLM 调用应发射结构化事件, 包含: `request_id`, `user_id`, `feature`, `model`, `prompt_tokens`, `completion_tokens`, `total_cost_usd`, `latency_ms`, `error_class`. 缺任何一个维度都会让其余分析失效. OpenLLMetry 的 `gen_ai.*` 语义约定已成标准.

**TandemAI 现状** (`lib/analytics/track.ts` + `lib/taf/router.ts:189` `recordLlmUsage`):
- 已有 `LlmUsageLog` 表: `scenario`, `provider`, `model`, `tokensIn`, `tokensOut`, `latencyMs`, `costMicroUsd`, `userId`, `requestId`, `success`, `errorMessage`.
- 已有 `estimateCostMicroUsd()` 内置 pricing 表 (DeepSeek/Anthropic/OpenAI/Kimi/Doubao/Qwen).
- 已有 `/admin/usage` 看板: provider 维度 / scenario 维度 / 每日趋势 / 失败原因 / BossAI 专属面板.
- **已有 = 前沿基线的 80%**.

**差距 (逐项)**:

| 前沿要求 | TandemAI 现状 | 差距 |
|---|---|---|
| `feature` 标签 (per call site) | `scenario` 标签 (per router call) | scenario 是粗粒度 (6 种), 前沿要求 5-15 个细粒度 call site 标签. 同一 scenario 下不同 call site 的成本无法区分. |
| p50/p95 cost per conversation | 只有 per-call cost | 无会话级聚合 — 不知道一次 BossAI 对话平均花多少钱, p95 是否失控. |
| 7-day trailing band 异常检测 | 无告警 | 无异常检测 — prompt 改动悄悄加 token, 或 retry 飙升, 都不会被发现. |
| Cache hit rate + savings | 无缓存层 | 无 prompt cache / semantic cache — 重复 prefix 每次全价重算. |
| Error-class as cost dimension | `errorMessage` 有但无分类 | 错误无分类 — 429 retry 5 次 = 5x 成本, 看板不按 error class 聚合. |

**可借鉴点**:

1. **Call-site 级 feature 标签** (~20 行): `TrackLlmInput` 增加 `feature?: string` (如 `boss_ai_stream` / `verify_step` / `reranker` / `output_guard`). 看板加 "Top 10 feature by cost". **价值: 高 | 可行性: 极高**

2. **会话级成本聚合** (~40 行): `recordLlmUsage` 增加 `sessionId?`. 看板加 p50/p95 cost per session. **价值: 高 | 可行性: 高**

3. **3-sigma 异常检测** (~60 行): 每小时对每个 feature 算 7 天 trailing cost 均值+标准差. 超标写 audit `llm.cost_anomaly` + 看板标红. **价值: 高 | 可行性: 中**

4. **Error-class 维度** (~15 行): 从 `errorMessage` 正则提取 `429` / `500` / `timeout` / `json_parse`. 看板失败表加成本列. **价值: 中 | 可行性: 极高**

### 11.2 Prompt Prefix Caching — 最高 ROI 单点优化

**前沿数据 (2026)**:
- Anthropic: cached input tokens cost 0.1x base (90% off). 80-95% of agent request 是重复 prefix.
- OpenAI: 自动缓存, ~50% savings on repeated prefixes.
- Agent 工作负载: system prompt + tool schemas + knowledge base = 大量重复 prefix.
- 关键规则: prefix 必须 byte-identical. 动态内容 (timestamp / per-request userId) 放 prompt 末尾.

**TandemAI 现状**:
- `tool-loop.ts` 每轮把完整 messages 送 DeepSeek API. system prompt + tool schemas 在多轮中重复发送.
- DeepSeek API 是否支持 prefix caching: **未验证** (DeepSeek 文档未明确, 需探针).
- `company-brain-perception.ts` 缓存了 perception 结果 (30s TTL), 但这不是 prompt cache, 是结果 cache.

**差距**: 无 prompt-level caching. 多轮 tool-loop 每轮全量重算 prefix tokens.

**可借鉴点**:
- **探针**: 先测 DeepSeek API 是否自动做 prefix caching (对比第 2 轮 vs 第 1 轮的 `prompt_tokens` — 如果减少, 说明 API 已自动缓存).
- 如果不支持: 考虑在 `router.ts` 层做 **应用级 prefix cache** — 相同 system prompt + tool schema 的请求, 只发送 diff 部分 (需要 API 支持, DeepSeek 可能不支持).
- 如果支持: 确保 system prompt + tool schemas 在 messages 开头, 动态内容放末尾.
- **价值: 极高 (60-75% input cost reduction)** | **可行性: 需探针验证**

### 11.3 Semantic Caching — 语义级响应缓存

**前沿数据 (2026)**:
- ~31% of LLM queries 展现语义相似性 (不同措辞问同一问题).
- Hit rate 61.6-68.8%, accuracy 92.5-97.3%.
- 100% cost savings on cache hits (无 API 调用).
- 风险: similarity threshold 太松 → 错误命中; 太紧 → hit rate 低. 需要审计.

**TandemAI 现状**: 无 semantic cache. 同一个问题 "公司 OKR 进度如何" 和 "OKR 怎么样了" 会各自走完整 LLM 调用.

**可借鉴点**:
- 在 `router.chat()` 前增加 **semantic cache layer**: 用 embedding (已有 `lib/infra/embedding.ts`) 对 query 做 vector, 检索最近 N 条缓存响应.
- similarity > 0.92 → 直接返回缓存 (跳过 LLM 调用).
- 缓存条目: `{ queryEmbedding, query, response, createdAt, feature, userId }`.
- TTL: 5 分钟 (OKR 数据变化快, 不宜长缓存).
- **价值: 中 (高频重复问题场景)** | **可行性: 中** | 需要 embedding provider 配置

### 11.4 模型路由 — 复杂度感知分流

**前沿数据 (2026)**:
- Pre-inference router: 基于 query 本身在调用前决定模型. RouteLLM 报告 cost -85% 维持 95% GPT-4 性能.
- Cascade: 先试便宜模型, confidence 不足才升级. 节省 up to 98%.
- GPT-5 架构内置 fast model + reasoning model 自动路由.

**TandemAI 现状** (`lib/taf/router.ts` + `lib/taf/provider/types.ts`):
- `scenario` 标签路由: `high_frequency` / `reasoning_complex` / `tool_use` / `long_context` / `persona_dialogue` / `agentic`.
- 调用方显式指定 scenario, 不是自动路由. `answer-pipeline.ts` 的 `shouldFullCritique` 是粗粒度复杂度判断 (复杂/决策类 or 长回答才跑 output-guard).
- 没有 cascade (先试便宜模型, 失败再升级).

**差距**: 路由是手动的 (调用方选 scenario), 不是自动的 (系统判断复杂度). 没有 cascade fallback.

**可借鉴点**:
- 在 `router.chat()` 前增加 **complexity classifier**: 用 `high_frequency` scenario 的轻量 LLM 判断 query 复杂度 (simple / moderate / complex).
  - simple → `high_frequency` (DeepSeek-Chat)
  - moderate → `persona_dialogue` (DeepSeek-Chat, more tokens)
  - complex → `reasoning_complex` (DeepSeek-Reasoner, thinking mode)
- **价值: 高 (40-70% cost reduction)** | **可行性: 中** | 增加一次轻量 LLM 调用 (~50ms)

---

## 十二、人在回路 (Human-in-the-Loop)

### 12.1 TandemAI 已有的 HITL 架构 — 代码级审视

**TandemAI 现状** (`lib/ontology/propose-action.ts` + `lib/types/proxy-action.ts` + `lib/persona/proxy-actions.ts`):

TandemAI 已有一套 **成熟的 HITL 系统**, 比多数 2026 文章描述的 pattern 更完整:

| 前沿 HITL Pattern | TandemAI 实现 | 代码位置 |
|---|---|---|
| Pre-action approval (执行前暂停) | `proposeAction` 黄区 → `awaiting_veto`, 暂不写 | `propose-action.ts:147-164` |
| Checkpoint approval (多阶段里程碑) | 无 (单次提议, 不是多阶段) | — |
| Escalation-on-anomaly (异常升级) | `deriveActionZone` 内容命中红线 → 升红拒绝 | `derive-zone.ts:75-120` |
| Durable pause/resume (持久化暂停) | `ProxyAction` 存 store, `vetoUntil` 控制窗口 | `proxy-actions.ts:49-110` |
| Approve / reject / edit-and-approve | `confirmProxyAction` / `vetoProxyAction` / 无 edit | `proxy-actions.ts:116-177` |
| Timeout delegation (超时委托) | `reconcileOntologyActionVetoWindows` 静默过期 = 隐式批准 | `propose-action.ts:237-275` |
| Immutable audit trail | `audit()` 每步留痕 (drafted/vetoed/executed/expired) | `proxy-actions.ts:81-90` |
| Risk classification (风险分级) | `deriveActionZone`: green/yellow/red + 委托级别越权检测 | `derive-zone.ts:75-120` |
| Graduated trust (分级信任) | `DelegationLevel` 6 级 (observe_only → cross_company) | `persona.ts:18-24` |
| 宪法硬约束 | 宪法 A: 中央 AI 永不可作为 proposer | `propose-action.ts:74-84` |

**这已经覆盖了前沿 HITL 的 8/10 个核心 pattern**.

### 12.2 差距分析 — 前沿有而 TandemAI 没有的

| 前沿要求 | TandemAI 缺失 | 风险 |
|---|---|---|
| **Edit-and-approve** (人工修改参数后执行) | 只有 approve/reject, 不能 edit. 人工想改参数只能 veto 后重提. | 中 — 参数微调场景需两次往返 |
| **Approval packet rich context** (审批包含推理过程+证据+备选方案) | `ProxyAction.body` 只有提议理由, 不含推理 trace / 工具结果 / 被拒备选方案. | 高 — 审批者看不到 AI 的推理过程, 容易 rubber-stamp |
| **Confidence-based routing** (低置信度自动升级人工) | 无置信度信号. AI 提议不附带 self-assessed confidence score. | 中 — 高置信度的低风险提议和低置信度的高风险提议走同一条路 |
| **Checkpoint approval** (多阶段里程碑审批) | 无. 复杂多步计划 (如 "先查 → 再分析 → 再写") 不支持中间检查点. | 低 — 当前场景多为单步提议 |
| **Anti-automation-bias UX** (防 rubber-stamping) | 审批 UI (`app/persona/me/proxy-actions/page.tsx`) 只显示 title + body, 不展示 "为什么你应该仔细看" 的提示. | 高 — OWASP ASI09: 人类对自信的 AI 输出过度信任 |

### 12.3 可借鉴点

1. **Approval packet 增强** (~40 行):
   - `ProxyAction.metadata` 增加 `reasoningTrace?: string[]` (tool-loop 的工具调用摘要) + `evidenceRefs?: {type, id}[]` (引用的 Memory/OKR) + `alternativesConsidered?: string[]` (AI 考虑过但拒绝的方案).
   - 审批 UI 展示这些, 让审批者看到 "AI 为什么这么提议" + "还有什么备选".
   - **价值: 极高 (防 rubber-stamping)** | **可行性: 高** | metadata 扩展, 无 DDL

2. **Confidence score** (~30 行):
   - `proposeAction` 时让 LLM 输出 `confidence: 'high' | 'medium' | 'low'`.
   - 低置信度 + 黄区 → 自动升级为需要显式确认 (不静默过期).
   - 高置信度 + 绿区 → 保持自动执行.
   - **价值: 高** | **可行性: 高**

3. **Edit-and-approve** (~60 行):
   - 审批 UI 增加 "修改参数后批准" 选项.
   - 修改后的参数存入 `ProxyAction.metadata.editedInput`, `materializeOntologyProxyAction` 优先使用 editedInput.
   - **价值: 中** | **可行性: 中**

4. **Anti-rubber-stamping UX** (~20 行):
   - 审批 UI 在 body 下方加提示: "请确认 AI 的提议理由是否合理 — 如果你不理解为什么, 请选择否决".
   - 对高 zone (yellow) 提议, 要求审批者输入一句话理由 (不能空确认).
   - **价值: 高 (安全文化)** | **可行性: 极高**

### 12.4 前沿 HITL vs TandemAI 架构对照总结

**TandemAI 的 HITL 架构在 2026 前沿中属于第一梯队** — 已有 zone 分级、持久化否决窗、宪法硬约束、审计链、委托级别越权检测. 这些在多数 2026 HITL 文章中被描述为 "理想状态".

**最大差距不在机制, 而在 UX** — 审批者看不到 AI 推理过程, 容易 rubber-stamp. 这是 OWASP ASI09 (Human-Agent Trust Exploitation) 的直接风险.

---

## 十三、流式 / 投机执行 (Streaming & Eager Execution)

### 13.1 Eager Tool Calling — 流中提前派发工具

**前沿洞见 (2026, PASTE + eager-tools)**:
- 传统: LLM 流式生成 → `message_stop` → 工具执行. 工具等待生成完成.
- Eager: 每个 tool_use block 在流中 "seal" (参数 JSON 闭合) 时立即派发, 不等 message_stop.
- 效果: wall-clock latency = max(stream, max(tool)) 而非 stream + max(tool). 4s stream + 2.5s tool → 4s (而非 6.5s).
- PASTE 进一步: 基于历史 trace 的 pattern mining, 在 LLM 生成前 **投机执行** 预测的下一个工具 (利用空闲资源, 不阻塞主路径).

**TandemAI 现状** (`lib/agent-runtime/tool-loop.ts`):
- `runToolLoop` 用非流式 API (`router.chat()`). 等 LLM 完整返回后才解析 tool_calls, 然后执行.
- Tier0-2 做了 **同轮工具并行** (Promise.all), 但工具执行仍然在 LLM 生成完成之后.
- BossAI stream (`app/api/boss-ai/stream/route.ts`) 用 SSE 流式推给前端, 但 LLM 调用本身是非流式的 (等完整 response 再 stream 给前端).

**差距**: 两层串行 — (1) LLM 生成 → 工具执行串行; (2) LLM 非流式 → 前端流式串行.

**可借鉴点**:
- **Phase 1 (低成本)**: `router.chatStream()` 已有流式能力. `runToolLoop` 可切换到流式模式, 在流中检测 `tool_calls` delta, 参数 JSON 闭合时立即派发.
  - 需要处理: DeepSeek API 的 tool_call delta 格式 (是否支持 per-block seal 检测).
  - **价值: 高 (延迟 -30-40%)** | **可行性: 中** | 需要改 tool-loop 核心循环

- **Phase 2 (PASTE 投机执行)**: 记录历史 tool-call 序列 pattern (如 `memory.search → okr.read → okr.health_digest`), 在 LLM 生成前投机预跑预测的下一个只读工具.
  - 只对 **只读 + 幂等** 工具做投机 (写工具永远不投机).
  - 投机结果缓存: 如果 LLM 确实调用了预测的工具, 直接用缓存结果; 否则丢弃.
  - **价值: 高 (复杂任务延迟 -50%)** | **可行性: 低** | 需要 pattern mining + 投机调度器

### 13.2 Partial JSON Streaming — 流式工具参数解析

**前沿洞见 (2026)**:
- 模型流式生成 tool call 参数时, JSON 是逐字符到达的. `{"que` → `ry": "annu` → `al repo` → ...
- 朴素方法: 累积 buffer + 每次全量 `JSON.parse` → O(n²) + 几乎每次抛错.
- 正确方法: streaming parser (如 `jiter` partial mode) → O(n) + 返回可读前缀.
- UI 价值: 用户在工具执行前就能看到 "正在搜索: agent infra NYC" 而非空白等待.

**TandemAI 现状**: 非流式 tool-loop, 不存在 partial JSON 问题. 但如果切换到流式 (13.1 Phase 1), 就需要处理.

**可借鉴点**:
- 如果实施 eager tool calling, 需要引入 partial JSON parser.
- 可以用 npm `partial-json` 或自行实现 (逐字符 walk + close open structures).
- 对 string 字段: 立即可用 (monotonic growth). 对 number 字段: 等闭合 (12 可能变成 120).
- **价值: 中 (UX 提升)** | **可行性: 中** | 仅在流式模式下需要

### 13.3 BossAI SSE 流 — 当前架构 vs 前沿标准

**前沿标准 (2026, IETF draft-spk-agentproto-llm-stream)**:
- 标准化 SSE 事件类型: `stream.start` / `content.delta` / `content.stop` / `tool.call` / `usage` / `error` / `stream.end`.
- 每个 SSE event data 字段包含一个完整 JSON 对象.
- `tool.call` 事件携带 tool name + arguments, 模型不执行工具只发请求.

**TandemAI 现状** (`app/api/boss-ai/stream/route.ts`):
- 自定义 SSE 事件: `step` / `content` / `citation` / `correction` / `done` / `error`.
- 非标准事件类型, 但功能覆盖类似 (step = stream.start, content = content.delta, done = stream.end).
- `usage` 事件无 (token/cost 不推给前端).

**差距**: 事件类型非标准. 如果未来要接第三方 LLM gateway 或 observability 工具, 需要适配.

**可借鉴点**:
- 低优先级 — 当前自定义 SSE 能满足产品需求. 如果考虑接入 OpenLLMetry 或第三方 agent observability 平台, 可对齐 `gen_ai.*` 语义约定.
- **价值: 低** | **可行性: 中** | 仅在需要第三方互操作时

---

## 十四、多模态 (Multimodal)

### 14.1 多模态输入 — 文档/图片理解

**前沿洞见 (2026)**:
- GPT-5 / Claude 4 / Gemini 2 均支持原生多模态 (text + image + PDF).
- Agent 场景: 用户上传截图 / PDF / Excel → agent 理解内容 → 调用工具.
- DeepSeek V4: 支持 vision (图片输入), 但文档解析仍需应用层预处理.

**TandemAI 现状**:
- `lib/document-parser.ts` 已有文档解析能力 (PDF/Word/Excel → text).
- `tool-loop.ts` 的 `ToolLoopInput` 有 `images?: { url: string; mimeType: string }[]` 字段 — 已预留多模态入口.
- `lib/taf/provider/openai-compatible.ts` 的 `transformMessageForWire` 处理 image_url 格式.
- 但 **实际使用路径未打通**: BossAI / IM 入口不接收图片上传, 只处理 text.

**差距**: 多模态管道已预埋但未激活. 用户不能发图片给中央 AI.

**可借鉴点**:
- **Phase 1**: BossAI drawer 增加图片上传按钮 → 存 public/ → 传 url 给 `runToolLoop` 的 `images` 参数.
- **Phase 2**: 文档上传 → `document-parser.ts` 解析 → 正文作为 tool result 注入 context.
- **价值: 中 (PMS 场景: 设备照片 / 合同扫描)** | **可行性: 高 (管道已预埋)**

### 14.2 多模态输出 — 图表/表格生成

**前沿洞见 (2026)**:
- Agent 输出不只是 text — 可以生成图表 (Mermaid/Chart.js JSON)、结构化表格、卡片.
- OpenAI Computer Use: 模型可以操作 UI 元素.
- Claude Artifacts: 生成可交互的代码/图表/文档.

**TandemAI 现状**:
- BossAI 输出纯 text (Markdown). `boss-ai-drawer.tsx` 渲染 Markdown.
- 四方案 (Megaplan) 是结构化卡片 UI, 但不是 AI 生成的图表.
- 无 chart generation / table generation 能力.

**差距**: AI 输出纯文本, 不能生成可视化.

**可借鉴点**:
- 让中央 AI 在回答中输出 **structured blocks** (如 ```chart { type: "bar", data: {...} }```), 前端渲染为图表.
- 对 OKR 进度 / PMS pipeline 等数据型问题, AI 生成图表比纯文字更有效.
- **价值: 中 (UX 提升)** | **可行性: 中** | 需要前端渲染组件 + prompt 引导

---

## 十五、更新后的优先级总表

### P0 — 立即行动 (高价值 + 高可行性)

| # | 升级 | 器官 | 改动量 | 价值 |
|---|------|------|--------|------|
| 1 | **PlanGuard 层级验证** (Intent Verifier + 硬约束拦截) | 安全 | ~60 行 | 安全核心, 有外网用户 |
| 2 | **Pass^3 多试一致性** (eval runner 跑 3 次) | 评估 | ~40 行 | 生产级可靠性度量 |
| 3 | **失败归因 pass** (失败 trace 自动定位决定性错误步) | 评估 | ~50 行 | 调试/改进闭环 |
| 4 | **Hindsight 归因 pass** (KR 变化归因到决策) | 学习 | ~60 行 | 学习飞轮核心 (#11) |
| 5 | **SRPO 反思补丁** (negative signal → 修正策略 → 检索复用) | 学习 | ~50 行 | 学习闭环 |
| 6 | **DeepSeek V4 thinking + tool calling** | 推理 | 配置 | 推理质量提升 |
| 7 | **Approval packet 增强** (推理 trace + 证据 + 备选方案) | HITL | ~40 行 | 防 rubber-stamping |
| 8 | **Call-site 级 feature 标签** (LlmUsageLog 加 feature) | 可观测 | ~20 行 | 成本可归因 |

### P1 — 短期推进 (高价值 + 中可行性)

| # | 升级 | 器官 | 改动量 | 价值 |
|---|------|------|--------|------|
| 9 | **FIDES 信息流标签** (trusted/untrusted 传播) | 安全 | ~100 行 | 注入防御确定性 |
| 10 | **SimpleMem 压缩 pass** (materializePromotion 时压缩) | 记忆 | ~60 行 | token 效率 30x |
| 11 | **MAGMA 因果图** (MemoryEntry 加 causedBy/caused) | 记忆 | ~80 行 | 企业治理核心 |
| 12 | **Meta-Reasoner 策略重置** (低信心度 → 换方法) | 推理 | ~30 行 | 推理效率 |
| 13 | **SELFCOMPACT 自压缩 tool** (模型自己决定何时压缩) | 记忆 | ~40 行 | 长任务不丢信息 |
| 14 | **Safety grader** (eval 检查未授权操作/PII) | 评估 | ~50 行 | 安全度量 |
| 15 | **Confidence score** (AI 提议附带置信度, 低置信升级人工) | HITL | ~30 行 | 安全路由 |
| 16 | **Prompt prefix caching 探针** (验证 DeepSeek 是否自动缓存) | 可观测 | 探针 | 60-75% input cost |
| 17 | **会话级成本聚合** (p50/p95 per session) | 可观测 | ~40 行 | 识别成本尾部 |
| 18 | **Anti-rubber-stamping UX** (审批要求输入理由) | HITL | ~20 行 | 安全文化 |

### P2 — 中期探索 (中价值 + 中可行性)

| # | 升级 | 器官 | 改动量 | 价值 |
|---|------|------|--------|------|
| 19 | **CWL 结构化驱逐** (episode 标注 + 依赖感知压缩) | 记忆 | ~120 行 | 80M token 无退化 |
| 20 | **AdaptOrch 拓扑路由** (任务复杂度 → 编排模式) | 编排 | ~150 行 | 效率/准确性 |
| 21 | **MRAgent 主动检索** (两阶段: tag → 深入) | 记忆 | ~80 行 | 检索精度 |
| 22 | **Mnemis 层次化分类** (MemoryEntry 加 categoryPath) | 记忆 | ~40 行 | 结构相关发现 |
| 23 | **GAM 整合触发器** (capture → 语义变化时整合) | 记忆 | ~50 行 | 噪声过滤 |
| 24 | **可靠性衰退曲线** (duration bucket + RDC) | 评估 | ~80 行 | 长任务可靠性 |
| 25 | **Eager tool calling** (流中 seal 即派发) | 流式 | ~100 行 | 延迟 -30-40% |
| 26 | **复杂度自动路由** (query → 模型选择) | 可观测 | ~60 行 | 40-70% cost |
| 27 | **多模态输入激活** (BossAI 图片上传) | 多模态 | ~40 行 | PMS 场景 |
| 28 | **3-sigma 成本异常检测** (trailing band 告警) | 可观测 | ~60 行 | 成本泄漏早发现 |

### P3 — 长期 backlog (高价值 + 低可行性)

| # | 升级 | 器官 | 障碍 |
|---|------|------|------|
| 29 | **PaCoRe 并行推理路径** | 推理 | 3x token 成本 |
| 30 | **Agent Teams 多 agent 协作** | 编排 | token 成本 + 复杂度 |
| 31 | **IPIGUARD 工具 DAG** | 安全 | 数据结构大改 |
| 32 | **PASTE 投机执行** | 流式 | pattern mining + 调度器 |
| 33 | **Semantic response caching** | 可观测 | embedding provider + threshold tuning |
| 34 | **Edit-and-approve** | HITL | 审批 UI + materialize 改造 |

### 不可借鉴 (需模型内部访问)

| 论文 | 原因 |
|------|------|
| MTI (最小测试时干预) | 需 KV cache 访问 |
| RAP-ID (机制级注入检测) | 需模型内部状态 |
| RedVisor (KV cache 复用防御) | 需模型内部状态 |

---

## 十六、更新后的 Tier0 对照表

| Tier0 已实现 | 对应前沿 | 差距 | 下一步 |
|---|---|---|---|
| Generate-Verify-Revise | SAVER (自审验证) | 缺 persona 多样性 | P1: #12 (Meta-Reasoner) |
| 并行工具执行 | PaCoRe / Eager tool calling | 只并行工具, 不并行推理, 不流中派发 | P2: #25 (Eager) / P3: #29 (PaCoRe) |
| PlanGuard | PlanGuard (论文) | 缺层级验证 + 硬拦截 | P0: #1 (Intent Verifier) |
| 轨迹评分 | Claw-Eval (Pass^3) | 缺多试一致性 + Safety/Robustness | P0: #2 (Pass^3) / P1: #14 (Safety) |
| 情景级反思 | SRPO (反思补丁) | 缺修正策略生成 | P0: #5 (反思补丁) |
| LLM reranker | Mnemis (双路检索) | 缺 System-2 层次检索 | P2: #22 (层次化分类) |
| ProxyAction + veto window | HITL 前沿 patterns | 缺 approval packet / confidence / edit | P0: #7 (packet) / P1: #15 (confidence) |
| LlmUsageLog + /admin/usage | LLM FinOps 最佳实践 | 缺 feature 标签 / 会话聚合 / 异常检测 / cache | P0: #8 (feature) / P1: #16-17 (cache/session) |
| output-guard | FIDES (信息流标签) | 缺 untrusted 标签传播 | P1: #9 (FIDES) |
| document-parser + images 预留 | 多模态前沿 | 管道未激活 | P2: #27 (多模态激活) |

---

## 十七、总结 (更新版)

**6 篇不可借鉴** (需模型内部访问) → 排除.

**34 项可借鉴**, 按优先级:
- **P0 (8 项)**: PlanGuard 层级验证 / Pass^3 / 失败归因 / Hindsight 归因 / 反思补丁 / V4 thinking+tools / Approval packet / Feature 标签
- **P1 (10 项)**: FIDES 标签 / SimpleMem 压缩 / MAGMA 因果图 / Meta-Reasoner / SELFCOMPACT / Safety grader / Confidence score / Prefix cache 探针 / 会话成本 / Anti-rubber-stamp UX
- **P2 (10 项)**: CWL 驱逐 / AdaptOrch 拓扑 / MRAgent 检索 / Mnemis 层次 / GAM 整合 / 可靠性曲线 / Eager tool / 复杂度路由 / 多模态 / 3-sigma 异常
- **P3 (6 项)**: PaCoRe / Agent Teams / IPIGUARD DAG / PASTE 投机 / Semantic cache / Edit-and-approve

**三大缺口 (不变)**: 安全 (FIDES 信息流标签) + 评估 (Pass^3 + 失败归因) + 学习 (Hindsight 归因 + 反思补丁).

**新增三大缺口**:
- **HITL UX** (Approval packet + anti-rubber-stamping) — 机制已有一流, 但 UX 让审批者盲签.
- **可观测性** (Feature 标签 + 会话聚合 + 异常检测) — 基础已有 80%, 但缺细粒度和告警.
- **流式延迟** (Eager tool calling) — 当前两层串行, 可砍 30-40% 延迟.

**TandemAI 的结构性优势** (与前沿对比):
1. **HITL 治理链** — `proposeAction` + zone + veto window + 宪法 A + 委托级别, 比多数 2026 文章描述的 "理想 HITL" 更完整.
2. **可观测性基线** — `LlmUsageLog` + pricing 表 + admin 看板, 已有前沿 FinOps 的 80%.
3. **Eval 基础设施** — EvalTrace + EvalAttribution + graders + summary, 比多数 agent 产品更成熟.
4. **多模态预留** — `images` 字段 + `document-parser.ts` + provider 支持, 管道已预埋.
