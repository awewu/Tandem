# EVOLUTION-2026-05 附录 · Claude Code Agent View + 最佳实践

> 2026-05-12 · 研究 Anthropic 2026-04-30 发布的 [Claude Code Agent View](https://claude.com/blog/agent-view-in-claude-code) (research preview) 与社区头号实践库 [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice).
> 作为 `docs/EVOLUTION-2026-05.md` 第 3 份附录, 不替换主文档. 与 Ruflo 附录互补 (Ruflo = agent 范式, Claude Code = agent 工程).

## 0. 研究标的 (双轨)

| 标的 | 性质 | 发布 | 关键定位 |
|---|---|---|---|
| **Claude Code Agent View** | 官方 CLI 多 session 仪表盘 (research preview, v2.1.139+) | 2026-04-30 | "把多个并行 agent 收编进一张表" |
| **claude-code-best-practice** | 社区 GitHub 头号 trending (83 tips, Boris Cherny 参与) | 2026 持续更新 | "从 vibe coding 到 agentic engineering" |

**为什么值得研究**: Anthropic 与社区在同一周内不约而同回答了同一个问题 — **当一个人同时跑 5+ AI 协作流时, 怎么不疯**. 这与 Tandem 的"员工同时跟 N 个搭子 + N 个决议 + N 个 OKR 复盘"是结构同构的问题.

## 1. Agent View 5 个核心范式

| # | 范式 | 关键机制 |
|---|---|---|
| **A1** | **会话状态可见** | 每行: Running / **Waiting** / Done · "Waiting" 是阻塞我的, 一眼可见 |
| **A2** | **Peek & Reply 不离场** | 按 Space 在不离开当前界面下读取 + 回复另一个会话; 按 ↑↓ 滚览邻居 |
| **A3** | **背景调度** | `/bg <任务>` 或 `claude --bg "..."` 把任务丢到后台 worktree 隔离执行 |
| **A4** | **下次运行时间显式** | 长跑 agent (PR babysitter / 仪表盘) 直接显示下次触发时间 |
| **A5** | **键盘优先** | `Esc` 退视图但 **不停会话** · `Ctrl+S/T/X/R/G` 排序/置顶/隐藏/检索/跳转 |

## 2. claude-code-best-practice · 12 大模式抽取

来源: 83 tips 归并, 与官方 best-practices doc 互相印证. 仅列与 Tandem 同构的核心:

| # | 模式 | 一句话 |
|---|---|---|
| **B1** | **Research → Plan → Execute → Review → Ship** | 所有 workflow 收敛到这 5 步骨架 |
| **B2** | **/clear 频繁清 context** | 长会话污染 = 性能下降. 任务边界硬清 |
| **B3** | **/compact 选择性压缩** | 不全清, 保留关键; "compacting always preserve modified files + test commands" |
| **B4** | **subagent 隔离投资性探索** | "use subagents to investigate X" — 不污染主上下文 |
| **B5** | **/rewind checkpoint** | Esc+Esc 选历史点回滚 (代码 + 对话) |
| **B6** | **CLAUDE.md ≤ 200 行** | 多了反被忽略; "ruthlessly prune"; `<important if="...">` 标签 |
| **B7** | **course-correct 早而频** | Esc 中断 → 重定向; 连续 2 次纠错失败就 /clear 重写 prompt |
| **B8** | **trust-then-verify** | 永远给验证手段 (tests/scripts/screenshots); 不能验证就不上 |
| **B9** | **infinite exploration 是陷阱** | 必须 scope 调查范围, 或 subagent 隔离 |
| **B10** | **Hooks 自动化护栏** | PostToolUse / Stop / Permission 钩子, 不在 prompt 反复念紧箍咒 |
| **B11** | **Skill = 进度披露** | 复杂技能拆分 SKILL.md + 多层文件, 按需加载 |
| **B12** | **Agent Teams + worktree** | 多 agent 并行写代码 = 多个 git worktree 隔离, 防写冲突 |

## 3. 宪章过滤 · 决定哪些借鉴

| 范式 | 触发宪章? | 处置 | 对应 Tandem 模块 |
|---|---|---|---|
| A1 Waiting/Done 可见 | 不触发 | ✅ **直接借鉴** | dashboard "我的工作台" 升级 |
| A2 Peek & Reply | 不触发 | ✅ **直接借鉴** | IM/决议/1on1 跨模块速查回复 |
| A3 背景 worktree | §1 (少而精) | 🟡 **反向重构** | 不让员工开 N 个并行决议室; 但 AI 后台任务可隔离执行 |
| A4 下次运行时间 | 不触发 | ✅ **直接借鉴** | 复盘提醒/Check-in/1on1 节奏显式化 |
| A5 键盘优先 | 不触发 | ✅ **借鉴**, 但中文场景慎用 | ⌘K 命令面板已有 |
| B1 RPERS 5 步 | 不触发 | ✅ **已经在做** (议事室 5 步对齐 §3) | 验证一致, 不必改 |
| B2 /clear context | §11 (反信息过载) | ✅ **借鉴** | 1on1 / 议事室 / IM 都需要"会话归档"按钮 |
| B3 /compact 选择性压缩 | §8 (Memory 治理) | ✅ **借鉴升级** | Memory promotion 时保留"必留项" |
| B4 subagent 投资 | §14 (治理官 AI) | ✅ **借鉴** | Steward Agent 用 subagent 跑深度审计 |
| B5 /rewind checkpoint | §13 (员工尊严) | 🟡 **反向用** | 决议 24h 否决窗 = checkpoint; **不让老板 rewind 员工** |
| B6 CLAUDE.md 精简 | 不触发 | ✅ **直接借鉴** | 项目 CLAUDE.md / WINDSURF rules 自审 |
| B7 course-correct 早 | §15 (人在环) | ✅ **借鉴** | 议事室 5min 节点 prompt: "继续 / 调整 / 重来?" |
| B8 trust-then-verify | §3 (17min 闭环) | ✅ **强化** | 已有 Action Item 验证, **强制每个决议必须有 verify 字段** |
| B9 infinite exploration | §1 (少而精) | ✅ **借鉴** | 议事室 hardDeadlineAt 17min 已是这条的 Tandem 表达 |
| B10 Hooks 护栏 | §14 (治理官) | ✅ **借鉴** | Steward Agent 用 hook 兜底, 不靠 prompt |
| B11 Skill 进度披露 | §1 (少而精) | ✅ **借鉴** | OKR/1on1/360 模板按需展开 (现状已部分实现) |
| B12 worktree 并行 | §17 (民企客户) | 🔴 **不需要** | 单租户不需要 git 级别隔离 |

## 4. 提取出 3 个新进化点 (EVO-10/11/12)

### EVO-10 · Workbench Agent View · 我的多线工作仪表盘

- **现状**: `/` 主页有"我的工作台" 4 张卡 (议事/17min/KR/Memory), 但**没有把"等我决定的事"和"在跑的事"分开**.
- **Claude Code Agent View 借鉴**: 1 张表 4 列 — 状态 / 标题 / 上次响应预览 / 上次交互时间. 默认按"Waiting → Running → Done"排序.
- **Tandem 化方案**:
  - 在 `/` 主页 §1 "我的工作台" 下方加一张**统一行级表** (新组件), 整合:
    - 1on1 (next scheduled / overdue)
    - 议事室 (DIVERGE 中我应出席 / CONVERGE 我未投票)
    - OKR Check-in (本周到期未做)
    - 复盘 (EVO-1 已有 retro-pending)
    - Memory 待签字 (已有 promotionsAwaitingMySignature)
  - 每行: `[状态徽] 标题 | 上次状态 | N 天前 | [一键回复]`
  - "一键回复" 复用 Peek 模式: 用户不离开主页就能完成 80% 简单操作 (例: 投决议票/做 1on1 评分/Check-in 确认)
- **预算**: 5 天
- **优先级**: 高 (V1.5, 跟 EVO-1 同期最佳)
- **关键守门**: 这张表是"提示我做主"的, 不是"老板看下属拖延"的. 显示 owner 永远是 viewer 自己 (合 §13).
- **复用**: `/api/me/dashboard` 聚合已有 todos 字段, 只缺一个 retro-pending 的合流 + UI 重排. 后端零新表.

### EVO-11 · 决议室 5-Minute Course-Correct Prompt

- **现状**: 议事室硬 deadline 17min, 中间有 5 步骨架, 但**没有显式的 course-correct 检查点**.
- **Claude Code B7 借鉴**: "After two failed corrections, /clear and write a better initial prompt." Anthropic 把这个写成了 stop-rule.
- **Tandem 化方案**:
  - 议事室计时第 5min 弹一个**温和的内嵌 prompt** (不离开议事室):
    - "目前对话已 5 分钟, 议题清晰度: [自评 1-5]"
    - 若员工选 ≤ 2: 弹出 3 个选项 — `继续推进 / 调整议题 / 放弃重来 (写入复盘)`
  - 第 10min 再次提示, 若仍 ≤ 2 且元数据显示"未到选项 A/B/C/D 阶段", 自动把决议状态置为 `ESCALATED` (现有状态机已支持)
  - **不剥夺员工权力**: 所有动作均"建议", 永远员工点击决定 (合 §15)
  - 数据: 议题清晰度自评保留进 ReasoningBank (EVO-9 协同)
- **预算**: 4 天
- **优先级**: 中高 (V1.5)
- **关键守门**: 自评分数**不进员工档案, 不上看板**. 仅本人 + ReasoningBank.

### EVO-12 · Memory Promotion 必留项 (/compact 风范)

- **现状**: Memory promotion 时, `MemoryEntry` 整体提交. 没有"必留 vs. 可压缩"的字段区分.
- **Claude Code B3 借鉴**: "compacting always preserve full list of modified files + test commands". 把"哪些不能丢"明文化.
- **Tandem 化方案**:
  - 给 `MemoryEntry` 类型加 `preserveFields: string[]` (默认: `['source_decision_id', 'created_by', 'audit_hash', 'redline_clauses']`)
  - Memory promotion 流程改造:
    - LLM 草拟摘要 (现有) → **必留字段在摘要末尾固定输出**
    - 签字方在 promotion UI 顶部看到 "必留项已锁定 ✓ 可压缩内容如下"
    - 后续若有"案例聚合"功能 (派生层), 必留项永远不能被聚合掉
  - 0 schema 改动 (Prisma 上加 1 个 string 数组字段)
- **预算**: 3 天
- **优先级**: 中 (V2, 等 Memory Promotion 真的开始日常使用后再做)

## 5. 反例清单新增 (附 MANIFESTO §C 6 行)

| 行号 | 反例 | 触发宪章 |
|---|---|---|
| **C13** | 老板的 dashboard 显示下属"Waiting" 时长排行 | §13.2 (反过度监控) |
| **C14** | "Peek & Reply" 给老板看下属的内部决议 peek | §13 + §8 (signer 之外不可读) |
| **C15** | 议事室 5min 自评分数进入员工档案 | §13 (尊严) |
| **C16** | 自动 /clear 删除员工的决议历史 | §16 (审计不可篡改) |
| **C17** | 一个员工同时开 5+ 议事室并行决议 | §1 (少而精, 17min 是单线程的) |
| **C18** | AI 在 Memory promotion 时自行决定"必留项" | §8.2 (人签字) |

## 6. 选边宣言更新

> **「Claude Code 给开发者一张表, 让你同时看 N 个 AI 在干啥.**
> **Tandem 给员工一张表, 让你同时看 N 件事都该你做点啥.**
>
> **Claude Code 让 AI 自跑后台, 人只在 Waiting 时介入.**
> **Tandem 让员工自决主线, AI 只在拐点时温和提醒.**
>
> **它要的是 agent 工作流的可观察性.**
> **我们要的是员工工作日的可掌控性.**
>
> **同源不同向. 学法不学神.」**

## 7. 影响主文档

- `docs/EVOLUTION-2026-05.md` §4.1 "进化点表" → 应追加 EVO-10/11/12
- `docs/MANIFESTO.md` §C 反例清单 → 应追加 C13-C18
- `docs/EVOLUTION-2026-05.md` 下月扫描清单 → 已含 Claude Computer Use, 后续可加 OpenAI Codex Multi-Agent (与 Agent View 对标), Cursor Agents (3 月已发)

## 8. 推荐启动序

本月剩余 (EVO-2 ✓ + EVO-1 ✓ + EVO-7 ✓ 已交付 9 天预算实际 1.5 天):

| 排序 | 进化 | 工期 | 理由 |
|---|---|---|---|
| **下一步** | **EVO-10 Workbench Agent View** | 5 天 | 本月用户可感知的"一眼看全"体验跃迁 |
| **再下** | EVO-11 5-min course-correct | 4 天 | 议事室体验补强, 与 17min 硬上限协同 |
| **再下** | EVO-9 ReasoningBank | 6 天 | 与 EVO-1/11 收尾, 形成完整学习闭环 |
| **下月** | EVO-12 Memory 必留项 | 3 天 | 等 Memory promotion 真实使用后再做 |

---
**一句话**: Claude Code Agent View 把"多并行 AI 工作流可观察"做成了官方范式; 我们把它**翻译成员工本人对自己多线工作日的可观察**, 但永远不让它变成上级的监控镜.
