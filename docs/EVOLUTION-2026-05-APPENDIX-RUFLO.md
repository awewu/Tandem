# EVOLUTION-2026-05 附录 · Ruflo 研究启发

> 2026-05-12 · 对 [ruvnet/ruflo](https://github.com/ruvnet/ruflo) (前 Claude Flow) 的逆向研究.
> 作为 `docs/EVOLUTION-2026-05.md` 的增量附录, 不替换主文档.

## 0. Ruflo 是什么 (定位坐标)

| 维度 | Ruflo |
|---|---|
| **品类** | Claude 多 agent 编排平台 (开源, Rust 引擎) |
| **客群** | 个人/小团队开发者使用 Claude Code/Codex |
| **核心命题** | "给 Claude 装一套神经系统": agents 自组织成 swarm, 跨会话记忆, 跨机器联邦 |
| **关键模块** | 100+ 专精 agent · 27 hooks · MCP 服务器 · AgentDB / HNSW / SONA / ReasoningBank · Federation (mTLS+ed25519) · Goal Planner UI |
| **底座** | Cognitum.One Rust 引擎 + 多 LLM provider (Claude/GPT/Gemini/Cohere/Ollama) |

**与 Tandem 表面无关** (我们是企业协同 SaaS, 它是 dev tooling), **但底层范式高度共振** — 都在解决"多智能体如何安全、可审计、有记忆地协作".

## 1. 9 个核心范式 + 宪章过滤

每条按相同决策路径: **触发宪章哪条? → 反向重构找相容版 → 仍不合 → 反例**.

| # | Ruflo 范式 | 是否触发宪章 | 对 Tandem 的处置 |
|---|---|---|---|
| **R1** | **PII 边界自动剥离** (PII stripped before anything leaves your node) | §13 + §8 加分项 | ✅ **直接借鉴 + 升级** → EVO-7 |
| **R2** | **Trust Score 滚动评分** `0.4×success + 0.2×uptime + 0.2×threat + 0.2×integrity` | §13 (对员工) / 中性 (对 agent) | ✅ **只用于 Agent**, 不用于员工 → EVO-8 |
| **R3** | **ReasoningBank** 推理轨迹银行 | §8.2 (Memory 治理) | ✅ **派生层补强** → EVO-9 |
| **R4** | **27 Hooks 自动路由** (任务自动派 agent, 学习成功 pattern) | §15 (不替员工劳动) | 🟡 **反向重构**: 仅用在"草稿/翻译/搜索"等非决策劳动, 不用在 OKR/决议 |
| **R5** | **100+ 专精 agent 库** (coder/tester/security/reviewer/...) | §17 (sweet spot) | 🔴 **不跟** · Tandem 不做通用 Agent 市场 · 反例清单第 5 行已锁 |
| **R6** | **Agent Federation 跨组织** (Slack for Agents) | §17 + 隐私 | 🟡 **战略观察** · 民企 50-3000 不需要跨组织 agent 互连 · 给 Steward V3 留接口即可 |
| **R7** | **Swarm Self-Organize** (Queen/Topology/Consensus 自主协调) | §14 + §15 | 🔴 **反例** · 与「人在环 + 治理官 AI 是单点」抵触 · 反例新增第 7 行 |
| **R8** | **Goal Planner UI** (autonomous agents 自定 plan) | §15 (不替员工写 OKR) | 🔴 **反例** · 与 EVO-2 反 Tita 一键改写 OKR 立场一致 |
| **R9** | **MCP Server / Tool-rich (314 tools)** | §1 (少而精) | 🟡 **战略观察** · Tandem 给员工的工具上限 7 个 · 但内部技术栈可 MCP-ify 一些 dev workflow |

## 2. 新增 3 个进化点 (EVO-7/8/9)

主 EVOLUTION-2026-05.md 已有 6 进化点 (EVO-1 至 EVO-6). 附录新增 3 条, 排序按宪章贴合度:

### EVO-7 · Memory 入栈 PII 自动剥离 (从局部到系统)

- **现状**: `@/lib/auth/strip.ts` 已剥 1on1 私语 / 360 anonymizePeers. **局部, 手动调用**.
- **Ruflo 范式**: 节点边界默认 strip (emails/SSNs/keys 全部自动). 不依赖业务代码记得调用.
- **借鉴方案**:
  - 新增 `lib/privacy/redactor.ts` — 一个纯函数 `redactPII(obj, scope)`, 支持 `email | phone | id_number | private_note | api_key` 5 类
  - 在 `lib/storage/repository.ts` 增加 `Repository.afterListHook` 钩子 (默认 noop)
  - 凡是发到非本人客户端的 list 接口, 由 boot 期注入 redactor (Memory/Decision/360 提交 等等)
  - 加单元测试: 给一个含 PII 的 fixture, 断言"非本人视角"应 0 PII
- **预算**: 3 天
- **优先级**: 最高 (合规护城河增强 §13)
- **风险**: 漏 strip 字段 → 用 type-safe 列表 + ESLint custom rule 兜底

### EVO-8 · Agent Trust Score (仅对 Agent, 不对员工)

- **现状**: Steward Agent (EVO-6 V2) / Persona AI / 后续 LLM 调用都没有"信任评分", 全靠人工审计.
- **Ruflo 范式**: 每个 agent 一个 0-1 trust, `0.4×success + 0.2×uptime + 0.2×threat + 0.2×integrity`, 不当行为即时降权.
- **借鉴方案** (Tandem 化):
  - 维度调整为: `0.35×decision_acceptance + 0.25×retro_alignment + 0.20×privacy_violation_inverse + 0.20×human_override_inverse`
    - decision_acceptance: 它出的决议建议被员工采纳的比例
    - retro_alignment: 它预测的结果 vs. 实际复盘吻合度
    - privacy_violation_inverse: 触发隐私红线次数的反值
    - human_override_inverse: 员工撤回/否决次数的反值
  - 每个 AI 调用 (Persona suggestion / Steward proposal / Diagnosis) 自动记录维度数据
  - 低于阈值 (0.4) 的 agent 自动降级为"只读建议", 不能再写入任何动作
  - 在 dashboard Steward 子页可视化展示每个 agent 的信任轨迹
- **关键守门**: 此 score **只用于 AI agent, 不对员工**. 永远不在员工档案出现 (合 §13)
- **预算**: 5 天
- **优先级**: 中 (V2 阶段做)

### EVO-9 · ReasoningBank · 推理轨迹银行

- **现状**: Memory 双层 (SOP/case/redline/value), 升降级需人工签字 (`promotions`). **没有"决议怎么推出来的过程"被保留**.
- **Ruflo 范式**: ReasoningBank 把"为什么这么做"的推理轨迹保存下来, 供后续 agent 学习.
- **借鉴方案** (Tandem 化, 但严守 §15):
  - 决议 COMMIT 时, 已有 4 个选项 A/B/C/D 的 `reasoning` 字段
  - 复盘 (retrospective) 回填 `actualOutcome / learning` 时, 自动派生一条"推理轨迹"
  - 新模型 `ReasoningTrace { decisionId, predictedOutcome, actualOutcome, deltaAnalysis, retrospectiveAt }`
  - 后续决议在议事室加载选项时, 检索"相似 problem space"的过往轨迹, 显示给员工 (员工看, 不是 AI 自动选)
  - **关键**: 检索结果仅作为"参考材料"展示, 不是"AI 推荐选项 X" (合 §15 不替员工劳动)
- **与 EVO-1 协同**: EVO-1 提醒员工复盘 → 复盘填了之后 → 自动入 ReasoningBank → 后续决议变聪明. **完整的学习闭环**.
- **预算**: 6 天
- **优先级**: 中高 (V1.5 阶段做, 跟 EVO-1 配对收效大)

## 3. 反例清单新增 (附 MANIFESTO §C)

| 行号 | 反例 | 触发宪章 |
|---|---|---|
| **C7** | Agent 自主组织 swarm 后自行决策 (Queen/Consensus topology) | §14 (治理官是单点) + §15 (人在环) |
| **C8** | "Goal Planner" 让 AI 帮员工自动规划 OKR/任务 | §15 (不替员工劳动) |
| **C9** | 给员工打 Trust Score / Productivity Score | §13 (尊严) |
| **C10** | 跨组织 Agent Federation 共享员工数据 | §13.3 + §17 (民企不出客户边界) |
| **C11** | 314 个 MCP tool 一并暴露给员工 | §1 (少而精, 决议工具上限 7 个) |
| **C12** | 自动 promote SOP/case 到 Memory (无签字) | §8.2 (promotion 必须有人签) |

## 4. 选边宣言更新

> **「Ruflo 给 Claude 装一套自主神经系统, 让 agent 自己跑.**
> **Tandem 给员工装一套理性脚手架, 让员工自己想.**
>
> **Ruflo 的护城河是 swarm 自治, 我们的护城河是人在环.**
> **Ruflo 卷 agent 互连密度, 我们卷员工成长率.**
>
> **但有 3 件事我们要学:**
> **1) 隐私剥离要默认开 (EVO-7)**
> **2) AI 自己也要被评分 (EVO-8)**
> **3) 失败的推理也是资产 (EVO-9)」**

## 5. 影响主文档的更新点

- `docs/EVOLUTION-2026-05.md` 第 4.1 节"6 个进化点" → 应追加 EVO-7/8/9
- `docs/MANIFESTO.md` 反例清单 §C → 应追加 C7-C12 6 行
- `docs/EVOLUTION-2026-05.md` 下月扫描清单 → 已含 Anthropic Computer Use, 与 Ruflo 同生态

## 6. 立即可启动

| 工作流 | 排序 | 预算合计 |
|---|---|---|
| **本月剩余** | EVO-2 ✓ → EVO-1 ✓ → **EVO-7 PII 剥离** (3 天) | 3 天 |
| **下月** | EVO-3 HRIS Adapter (7 天) → **EVO-9 ReasoningBank** (6 天) | 13 天 |
| **V2** | EVO-4 Persona 工作记忆 → **EVO-8 Agent Trust** → EVO-5/6 | — |

**建议立即启动**: EVO-7 (最高优先, 隐私护城河直接强化, 3 天预算, 0 schema 改动).

---
**总结一句**: Ruflo 的"agent 中心" vs. Tandem 的"员工中心"是对偶的, 但隐私/审计/学习闭环这 3 件事它做对了, 我们应该有 Tandem 化的版本.
