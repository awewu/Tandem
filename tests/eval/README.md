# tests/eval — Production Eval Harness Skeleton (P1a)

## 目的

Unit tests 验证代码正确性 (函数返回正确值, 异常被处理).
**Eval** 验证**产出质量** — 给定一组真实场景, 系统输出能否达到我们对"好"的预期.

参考: 2026 Anthropic best practice — _"build the agent loop yourself + add production evals"_.

## 跟 `tests/unit/` 的区别

| 维度       | `tests/unit/`                | `tests/eval/`                                    |
| ---------- | ---------------------------- | ------------------------------------------------ |
| 验证什么   | 代码正确 (返回值/异常)       | 输出质量 (排序对不对 / 决议合不合理)             |
| 是否调 LLM | 否                           | 离线 case 不调; 真实 case 跑 nightly cron 时调   |
| Pass 标准  | 严格 ===                     | 阈值 (avg score ≥ 0.8, pass rate ≥ 90%)          |
| Runner     | vitest 直接 `expect()`       | `lib/evals/runSuite()` → `SuiteReport`           |
| 频率       | 每次 commit / CI             | nightly + commit (offline benchmark) + 人工抽样  |

## 当前 skeleton (P1a)

- `memory-rerank.eval.test.ts` — Memory 重排序基准 (offline)
  - 6 条 case, 验证 BM25 + Entity + Recency + Popularity 融合排序在常见 query 下能把"对"的 memory 排到前列
  - 不调 LLM, 跑 `lib/memory/reranker.ts::rerank` 即可

- `persona-stage-upgrade.eval.test.ts` — Persona 升级判定基准 (offline)
  - 6 条 case, 验证 `checkUpgradeEligibility` 在边界条件 (时长/决议数/否决率/已最高级) 上判定正确
  - 不调 LLM, 直接跑 `lib/persona/evolution.ts::checkUpgradeEligibility`

## 运行

```bash
# 全部 (单测 + 离线 eval)
npx vitest run

# 仅 eval
npx vitest run tests/eval

# 单个 suite
npx vitest run tests/eval/memory-rerank.eval.test.ts
```

## 加 case 的规则

1. 一个 case = 一个具体场景, 描述清楚"输入是什么 / 期望系统怎么反应"
2. `expected.contains` 用确定性子串 (token id / 关键词), 不用模糊语义
3. 需要语义评估时叠加 `llmRubricJudge` (会调 LLM, 在线 case)
4. case id 唯一, 形如 `memory-rerank.case-N` / `persona-upgrade.case-N`

## 后续 (P1b/P2)

- 在线 eval (调真 LLM) 进 `RUN_EVALS=1` 闸 + nightly cron
- 报告推送到 `/admin/usage` 看板 (LLM 输出质量是成本的另一面)
- Suite 数 ≥ 10, case 数 ≥ 50, 才算"上线门槛"
