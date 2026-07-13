# CA-11 · 组织 IQ 主权 (IQ Sovereignty)

> 状态: 研讨定稿 (2026-07-13) · 拥有者: Cascade
> 一句话: Tandem 的"聪明"目前 100% 借自外部云模型 API, 组织 IQ **零权重沉淀**。
> 本文冻结"IQ 借用现状"的诚实盘点 + 三级恢复阶梯, 作为 CA-11 的 SSOT。

---

## 一、IQ 借自哪里 (诚实盘点)

### 1.1 设计上的借用阶梯 (`lib/taf/index.ts` PROVIDER_CONFIGS)

全部是外部云模型 API, 无一自研:

| Provider | 归属 | 路由角色 | 输出单价 (¥/M) |
|---|---|---|---|
| `claude-opus-4-5` | Anthropic (美) | 路由规则里的"旗舰" | 540 |
| `deepseek-v3` (`deepseek-chat`) | 深度求索 (杭州) | 高性价比兜底 | 2 |
| `deepseek-r1` (`deepseek-reasoner`) | 深度求索 | 强推理 fallback | 16 |
| `qwen-max` | 阿里 | fallback | 12 |
| `doubao-pro` | 字节火山 | 高频低成本 | 2 |
| `kimi-k2` | 月之暗面 | 长文 fallback | 6 |
| `hermes-4` | 本地 Ollama/vLLM | 唯一本地逃生口 | — |

### 1.2 今天真实在借的只有一个: DeepSeek

`.env.local` 实测只配了 `DEEPSEEK_*`(+ 外部 `EMBEDDING_*`)。而 `createDefaultRouter()`
**跳过没有 apiKey 的 provider** (`lib/taf/index.ts:204`):

- 没配 `ANTHROPIC_API_KEY` → **`claude-opus-4-5` 根本没注册**。
- 所有 `primary: claude-opus-4-5` 的场景 (议事 / 3+1 / agentic / tool_use / long_context)
  **全部 fall through 到 `deepseek-r1/v3`**。
- **结论: 文档叙事里旗舰是 Claude Opus, 实际大脑 = DeepSeek, 且单点依赖一家。**
- 连语义记忆检索的 embedding 也走外部 (`EMBEDDING_API_URL`) — 检索的"聪明"也是借的。

### 1.3 断了 API 会怎样

- **脚手架不倒**: 真值查询 / 四闸治理 / 记忆库 / 路由 / 反思编排 / 四时间尺度 cron
  都是 Tandem 自己的代码, 照常运行。
- **引擎全黑**: 生成 / 推理 / 判断的"大脑"没了。
- **唯一逃生口 `hermes-4`**: 默认 apiKey=`ollama` 会注册, 但 ① 只在 `agentic` 场景当 fallback,
  非任何主力; ② 需本地真跑 Ollama; ③ 是**通用开源模型, 零组织知识** → 就算顶上也只是
  "通用小脑", 不是"组织 IQ"。

### 1.4 最尖锐的事实

**没有任何"组织 IQ"沉淀在权重里。** 全部组织智能活在 prompt + Memory + 治理配置里,
推理时**注入进一个借来的模型**。CA-11 文档引用的 `lib/training/lora.ts` 一度是空指针
(0 代码)。CA-10/CA-11 长期是纯 roadmap。

---

## 二、三级恢复阶梯

关键洞察: **要蒸馏的语料已经在持续累积** —— `CompanyBrainDecision`(决策即数据 · CA-13 飞轮)
每次 adopt/veto 都是天然的偏好信号 + reflexion 教训 + 基线仲裁。这就是"组织 IQ"的显式训练集。

### L1 · 降依赖风险 (无需训练, 几天)

- **多云分散**: 中继站网关 (`promoteToPrimary`) 已支持, 配齐 2-3 家 key, 别单押 DeepSeek。
- **本地兜底真跑起来**: 部署 Ollama + hermes-4, 让"断云不全黑"从纸面变真 (现在空跑)。
- 产出: 可用性提升, 但仍是通用模型, 无组织 IQ。

### L2 · 数据集构建 (地基) — ✅ 已落地 (2026-07-13)

- **`lib/training/dataset-builder.ts`** `buildTrainingDataset()`: 从 `CompanyBrainDecision`
  的 adopt/veto 信号导出 **SFT + DPO** 语料。纯只读, 无 GPU, best-effort。
- **信号映射**:
  - `adopted` → SFT 正样本 (completion = AI 原答)
  - `modified`/`overruled` + `correctedOutput` → SFT (completion = 更正) + DPO (chosen=更正, rejected=原答)
  - `pending`/`ignored` / 无更正的 overruled → 跳过 (无可学正样本)
- **纪律**: `implicit` 隐式默许默认剔除 (与反思循环调阈值同纪律), 可 `includeImplicit` 开启。
- **决策防火墙**: reflexion 个人教训仅 `includeReflexionLessons` 显式开启才导出, 且独立标
  `ownershipLevel='personal'`, 绝不静默混入组织语料。
- **序列化**: `sftToJsonl` / `dpoToJsonl` 直接产训练可用 JSONL。
- **测试**: `tests/unit/training-dataset-builder.test.ts` 10/10。

### L3 · 蒸馏 (需算力, 2-3 月) — ⏳ 待启动

- 用 L2 产的 JSONL LoRA 微调本地模型 (hermes-4 / qwen-7b) → **组织 IQ 进权重**。
- vLLM 本地推理接进 TAF Router `hermes-4`, 先切 `persona_dialogue`/`high_frequency`
  这类高频低敏场景当主力, 关键决策仍借云旗舰。
- 断云后本地模型**带着组织 IQ**仍能跑, 只是天花板低。

---

## 三、诚实定位

恢复的**不是**"和 Opus 一样聪明的大脑", 而是三件事:

1. **断云时组织 IQ 不丢** (数据主权 + 业务连续性)
2. **高频场景成本归零** (本地推理)
3. **组织判断可沉淀进权重** (真正的"进化", 不只是 prompt 注入)

关键决策继续借云 SOTA 是理性的 —— 自研通用大模型不是护城河, **把组织判断蒸进小模型**才是。

---

## 修订记录

- 2026-07-13 · 研讨定稿 · Cascade — 冻结 IQ 借用现状 + 三级恢复阶梯; L2 dataset-builder 已落地。
