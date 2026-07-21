# 中央 AI "退化成知识库检索"诊断 (2026-07-20)

> 状态: 诊断定稿 · 拥有者: Cascade · 类型: 只诊断, **未改任何运行时行为**
> 一句话: 中央 AI (CompanyBrain) 的推理层**存在**, 但被 **基座 prompt + S2 设计 + 门控 + 路由** 四重叠加**捂住嘴**, 表现退化为"检索事实 + 引用 Memory"。
> 关联: 模型来源问题见 `CA-11-IQ-SOVEREIGNTY.md` (本文只谈"行为为何像检索", 不重复"IQ 借自谁")。

---

## 一、实际工作机理 (调用链)

两条入口一致:
- BossAI: `app/api/boss-ai/stream/route.ts`
- IM @中央AI: `lib/im/service.ts` → `invokeCompanyBrainReply`

```
1. buildCompanyBrainSystemPrompt   注入公司 Memory(rerank) + OKR 上下文 + 红线 + 身份约束
2. preSearchLayer                  时间敏感/覆盖率低 → 联网 (可选)
3. S2 companyBrainReasoningPass     关键词门控 → 多步 ReAct (只收集事实)
4. S1 companyBrainPerceptionPass    S2 未命中才跑 → 只读工具检索
5. injectSelfHints                  召回历史自省
6. router.chatStream                scenario='reasoning_complex', temp 0.6 → 最终作答
```

**关键事实**: 最终答案确实由 LLM 生成; S1/S2 只是把"事实块"塞进 system prompt。问题在提示工程/门控/路由, 不是没接 LLM。

---

## 二、四个根因 (均有 file:line 佐证)

### 根因 1 (最致命 · 基座 prompt 堵嘴) — `lib/persona/company-brain.ts:273-276`
```
'- 回复应包含明确的 Memory 引用 (例: "根据公司 Memory \'XXX\', ...")',
'- 语气分析型, 不情绪化; 简洁, 不超过 4 句话',
```
"**不超过 4 句话** + **强制引用 Memory 'XXX'**" 从结构上禁止展开推理。任何模型被要求"4 句话内、先引用知识库", 输出必然像知识库摘要。

### 根因 2 (S2 是"取数"不是"推理") — `lib/persona/company-brain-reasoning.ts:103`
`REASONING_SYSTEM` 收尾:
> 输出: 一段结构化的"深推理简报", 列出查到的真实事实 (含具体数字), **不臆测、不结论**。

"深推理"被设计成只收集事实、不下结论。结论交给最终模型, 而最终模型又被根因 1 限成 4 句话引用体。所谓多步推理产出的是事实清单, 不是推理链。

### 根因 3 (强反臆测约束压制分析) — `company-brain-perception.ts:253` / `company-brain-reasoning.ts:194`
S1/S2 注入块结尾反复约束"回答必须与真值一致、不要臆测"。反幻觉本对, 但与"4 句话 + 引用体"叠加后, 把模型推向**复述检索结果**而非**基于结果推理**。

### 根因 4 (窄关键词门控 → 多数提问不触发推理) — `company-brain-reasoning.ts:74-90`
```
const COMPLEX_QUERY_RE =
  /比较|对比|\bvs\b|哪个更|谁更|为什么|原因|导致|怎么办|应该|建议|推荐|优先级|砍哪|留哪|看法|判断|评估|分析|策略|方案|路线|该不该/i;
```
提问不含这些词 → **S2 跳过**, 只跑 S1 感知 = 纯检索。这就是字面意义的"退化成知识库检索"。

---

## 三、模型层: 诚实归因 (反直觉点)

`reasoning_complex` 首选 `claude-opus-4-5` 但未配 `ANTHROPIC_API_KEY` → 未注册; 生效的只有 DeepSeek。
`TandemRouter.resolveCandidates` 的 function-calling 过滤 (`lib/taf/router.ts:338-343`) 造成:

| 阶段 | 是否带 tools | 实际模型 | 说明 |
|---|---|---|---|
| 最终作答 | 否 | `deepseek-r1` (deepseek-reasoner) | **强推理模型**, 首个可用候选 |
| S1/S2 工具轮 | 是 | `deepseek-chat` (v3) | r1 `functionCalling:false` 被过滤掉 |

**讽刺**: 真推理模型 (R1) 只用在被限成"4 句话引用体"的最终答复上 → 推理力被约束浪费; 工具阶段的"思考"反而由非推理 chat 模型做。

⚠️ **需确认的开关**: 若配了中继网关 `LLM_GATEWAY_*`, 它会被 `promoteToPrimary` 顶为所有场景首选 (`lib/taf/index.ts:216`) → 连最终答复都走网关模型; 若网关指向廉价 chat 模型, R1 的好处也没了。**排障第一步先确认是否启用了网关**。

---

## 四、可复现实验 (不改代码, 只观察)

同一意图换措辞, 观察命中 S1 还是 S2 (看 BossAI SSE `emitStep` 的 `reasoning` vs `perception` 步骤, 或 audit `output_guard.checked` 的 `metadata.stage`):

| 提问措辞 | 预期命中 | 依据 |
|---|---|---|
| "研发线**为什么**落后?" | S2 (深推理) | 命中 `为什么` |
| "研发线现在啥情况?" | S1 (仅检索) | 无关键词 → `shouldDeepReason=false` |
| "华东区**应该**砍哪个项目?" | S2 | 命中 `应该`/`砍哪` |
| "帮我盘一下华东区" | S1 | 无关键词 |
| "Q3 **策略**对吗?" | S2 | 命中 `策略` |
| "Q3 目标进度多少" | S1 | 无关键词 |

**预期结论**: 即便命中 S2, 最终答复仍受"4 句话 + 引用体 + 不臆测"约束 → 输出深度受限。两组问题的答案质量差异, 主要来自"是否触发 S2", 而非模型推理力本身。

---

## 五、修复候选 (已列出, 本次**未实施**, 待团队决策)

按影响面从小到大:

1. **解绑基座约束** (`company-brain.ts:276`): "不超过 4 句话" → 分级 (闲聊简短 / 分析类可展开); "必须引用 Memory" → "引用时标注来源"而非强制开头。**最快解锁, 单文件低风险。**
2. **S2 升级为出结论** (`company-brain-reasoning.ts` `REASONING_SYSTEM`): 收集事实后追加"评估→风险→建议"结构化结论 (仍标注事实来源、区分事实与判断)。
3. **拓宽/换掉 S2 门控** (`shouldDeepReason`): 窄正则 → 更宽意图判定, 或对中央 AI 默认走 S2。让多数实质提问触发多步推理。
4. **路由修正**: 让最终作答也能吃到 R1 的推理力而不被 4 句话捂住; 或确认/关闭误配的网关。

> 实施任一项都应: 最小改动 + 加回归测试 + 不弱化现有反幻觉保证 (区分"事实"与"判断", 判断部分可展开, 事实部分仍需真值支撑)。
