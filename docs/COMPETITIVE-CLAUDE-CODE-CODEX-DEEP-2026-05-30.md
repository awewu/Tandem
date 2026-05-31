# Claude Code + OpenAI Codex 深层架构与产品逻辑 (2026-05-30)

> **缘起**: 用户问 Claude Code / Codex 的**深层架构 + 产品逻辑**值得借鉴什么.
>
> 已有 `@/docs/EVOLUTION-2026-05-APPENDIX-CLAUDE-CODE.md` (158 行) 覆盖了 UI 范式 (Agent View) + 12 条 best practices, **本文不重复**.
>
> 本文聚焦 7 个底层架构决策 + Codex 差异 + 3 个产品逻辑洞见 + Tandem 真该借的 4 件事 + 3 件不该借.

---

## 0. 两者定位差异 (一段话讲清)

| 维度 | Claude Code (Anthropic) | OpenAI Codex (CLI + Cloud) |
|---|---|---|
| **GA** | 2024-Q4 (CLI) / 2025-Q2 (Agent View) | 2025-05 (Codex CLI, MIT 开源) + 2025-05 Codex Cloud (Async, ChatGPT 内) |
| **形态** | 终端 CLI + Agent View (多 session 仪表盘) | 终端 CLI (开源) + 云端异步 PR Agent (闭源) |
| **模型** | Claude Sonnet/Opus 4.x | OpenAI o3 / o4-mini / GPT-4.1 / Codex-1 |
| **项目记忆** | `CLAUDE.md` (项目根) | `AGENTS.md` (项目根, 同 spec) |
| **权限模式** | Allow / Ask / Deny (per tool × pattern) | Suggest / Auto-edit / Full-auto |
| **隔离** | git worktree / Skill SKILL.md | Sandbox container (cloud) / Local fs (CLI) |
| **战略** | "Code is a primary use case, but harness is general" | "Async agent that drafts PRs while you sleep" |

**共同点**: 都赌 **"终端 + 文件系统 + 标准协议"** 优于 "Chat UI + DB + 私有 API". 都有 markdown 项目 manifest. 都把工具调用 + 权限 + hooks 做成一等公民.

**根本差异**: Claude Code 是**交互式 agent harness** (你在终端里和它对话); Codex Cloud 是**异步 PR agent** (你扔需求, 它在 sandbox 里跑半小时回来给 PR). Codex CLI 才与 Claude Code 直接对标.

---

## 1. 共享的 7 个深层架构决策

每条: **机制 → 哲学 → Tandem 当前 → 真该借 / 不该借**.

### 架构 1: Filesystem-as-State + Markdown Manifest

**机制**:
- `CLAUDE.md` (Anthropic) / `AGENTS.md` (OpenAI) 放项目根, 每次 session 开始自动加载
- 包含: 项目概述 / 命令清单 / 编码规约 / "重要 if X then Y" 规则 / 测试方法
- 子目录可以有自己的 `.md` (路径相关上下文)
- Skills/Commands 也是 markdown (`.claude/commands/foo.md` → `/foo` slash command)

**哲学**: **State lives in files, not databases**. 崩了 git diff 看; 改了 PR review; 跨工具兼容 (Cursor / Aider / Continue 都读 `AGENTS.md`). 0 schema migration.

**Tandem 当前**:
- `@/lib/persona/company-brain.ts` 动态拼 system prompt (从 OKR active cycle / Memory / 9 宫格 注入)
- 没有 workspace 级的"manifest" 概念
- Persona profile 在 DB 里 (`persona_profiles` 表)

**真该借**:
- **每个 workspace 加一个 `tandem.workspace.md`** — 公司层声明: 4 件不变量是否启用 / OKR 周期长度 / Memory 升级阈值 / Persona 默认风格 / 文化红线
- AI Personas 每次会话**先读** workspace manifest, **再读**动态 context (OKR/Memory)
- 客户 onboarding 时: `/tandem init` → AI 读现有 OKR/议事/Memory → **AI 自己起草** `tandem.workspace.md`, 客户审一遍签字即可
- 落点: `@/lib/persona/workspace-manifest.ts` + `app/admin/workspace-manifest/page.tsx`

**不该借**: Markdown 完全替代 DB. Tandem 是多人协同 + 审计链 + 三级签批, 不能把 OKR 数据扁化到文件. **manifest 是 declarative governance layer, 不是 state**.

---

### 架构 2: 工具协议 (Tool calling + MCP)

**机制**:
- 工具按 JSON Schema 声明 (name + description + input_schema)
- LLM 输出 `tool_use` block, runtime 执行, 回灌 `tool_result`
- 多 turn loop 直到 LLM 不再调工具
- **MCP (Model Context Protocol)** 让外部进程作为工具源 (任意语言写 server, 通过 stdio/SSE 暴露工具)
- Claude Code 内置: Read / Edit / Bash / Glob / Grep / TodoWrite / Task / WebFetch
- Codex CLI 类似 + Apply Patch (diff format)

**哲学**: **Tools are first-class, not afterthought**. 不在 prompt 里塞 "你可以做 X" — 在 schema 里声明 X. LLM 学会调度多 tool, runtime 负责安全 + 重试 + 缓存.

**Tandem 当前** (重要 — 我们其实做对了核心部分):
- `@/lib/agent-runtime/tool-loop.ts` 多 turn tool loop ✅
- `@/lib/agent-runtime/mcp-bridge.ts` MCP 集成 (mode=mock + live) ✅
- `tests/unit/agent-runtime-v2.test.ts` 15 测试覆盖 ✅
- TAF router responseFormat json_schema ✅
- Skill Gateway 4 闸 ✅

**真该借**:
- **`@/lib/agent-runtime/tools/` 目录化**, 把 Read/Edit/Search/OKR 各做成独立 tool 文件 (现在分散在 services 里)
- **WebFetch tool** (Claude Code 有) — Persona 引用外部 URL 时统一走这个, 走 Skill Gateway 数据范围闸 (G2 隐私红线)
- **TodoWrite tool 提升为一等公民** — Persona 自己维护"我这次 session 要做的事", 写入数据库, UI 可见. 这是 Claude Code 最被低估的 tool.

**不该借**:
- **Bash tool 不给 Persona** — 我们不是 coding agent, 不允许 Persona 直接执行 shell. (Skill Gateway 行动范围闸已守住, 不放开)
- **Edit tool 不给 Persona** — 文件系统不是协作单位, OKR/议事/Memory 才是. Persona 修改它们走 service 层, 不走 file edit.

---

### 架构 3: 权限模型 per (tool × pattern × target)

**机制** (Claude Code 最被低估的设计):
- 不是"允许 Bash 吗?" 而是 "**允许 Bash(npm test)?**"
- 不是"允许 Edit 吗?" 而是 "**允许 Edit(src/**/*.ts)?**"
- 用户首次遇到时弹"Always / Once / No", 记入 `.claude/settings.json`
- 三态: `allow` (静默通过) / `ask` (每次弹) / `deny` (静默拒绝)
- Codex CLI 类似: `--approval-mode suggest/auto-edit/full-auto`

**哲学**: **粒度细于 tool**. "允许 Bash" 给 LLM 写删除 / 网络访问 / 安装依赖的权力, 过宽; "允许 Bash(npm test)" 只允许这一条命令, 过窄. **per (tool × pattern × target)** 是甜区: 用户体验只在新模式弹一次, 老模式静默.

**Tandem 当前**:
- `@/lib/persona/skill-gateway.ts` 4 闸 (数据范围 / 行动范围 / 时间窗口 / 组织记忆基线) ✅
- 但**没有 "per pattern" 粒度** — 整个 Skill 要么允许要么不允许

**真该借**:
- Skill Gateway **行动范围闸**升级: 不是"允许调用 SendEmail Skill" 而是 "**允许 SendEmail(to=*@company.com)**" / "**允许 SendEmail(to=customer@*)**"
- 客户行政可以"允许 Persona 给公司内任意人发邮件, 但给客户邮箱必须 ask"
- 首次场景弹"始终 / 仅此次 / 拒绝", 记入 `@/lib/persona/permission-rules.ts`
- 落点: `Skill.actionPattern: { allow: string[], ask: string[], deny: string[] }`

**不该借**: settings 文件本地化 (Claude Code 在 `.claude/`). Tandem 多租户, 权限规则必须在 DB + 审计链.

---

### 架构 4: Hooks 系统 (pre/post tool, session lifecycle)

**机制**:
- Claude Code: `.claude/hooks/` 目录, hook 是任意 shell/python 脚本
- 触发点: `PreToolUse` / `PostToolUse` / `Stop` / `UserPromptSubmit` / `SessionStart` / `SessionEnd`
- Hook 返回 `block: true` 可中止操作
- 用例: lint pre-commit, 自动跑 tests post-edit, 写日志 session-end, 防泄密 PreToolUse

**哲学**: **Governance 不在 prompt 里念紧箍咒, 在 runtime 里硬强制**. Prompt 是"我希望你这么做", Hook 是"你不这么做我就 block 你".

**Tandem 当前**:
- `@/lib/persona/skill-gateway.ts` 4 闸是 pre-tool hook ✅
- `@/lib/audit/log.ts` 是 post-tool hook ✅
- `@/lib/audit/defer.ts` 异步审计模式 ✅
- 但**没有 declarative hook 文件**, 全是硬编码在 service 里

**真该借**:
- **Hook 声明化**: 客户管理员可以在 `tandem.workspace.md` 或 `app/admin/hooks/page.tsx` 写规则:
  ```yaml
  hooks:
    pre_tool_use:
      - match: SendEmail(to=customer@*)
        action: ask
        message: "客户邮件需 1on1 leader 复核"
    post_tool_use:
      - match: CreateOkrObjective
        action: audit_extra
        notify: ['ceo', 'cfo']
    session_end:
      - if: token_usage > 50000
        action: alert
        to: 'finance'
  ```
- **不写代码可以加治理规则**, 这是 Anthropic 给企业客户的核心卖点之一
- 落点: `@/lib/persona/declarative-hooks.ts`

**不该借**: Hook 是任意 shell 脚本. Tandem 多租户 SaaS, 绝不能让客户跑任意脚本. **Hook 必须是 declarative DSL** (我们已有的 workflow engine 完全够用 — `@/lib/workflows/engine.ts`).

---

### 架构 5: Plan ↔ Act 分离 + Approval mode

**机制**:
- Claude Code 有 **Plan Mode** (Shift+Tab): LLM 只规划不执行, 输出 "I would do A, B, C", 用户审批后才执行
- Codex CLI: `--approval-mode suggest` (只看建议) / `auto-edit` (自动改文件但不跑命令) / `full-auto` (全自动)
- Codex Cloud: 整个 PR 是"plan", 用户在 GitHub 上 review 后合入

**哲学**: **AI 行动前必须有 reviewable artifact**. 直接 act = 不可审计 + 难回滚; plan first + human approve = 责任清晰 + 可教育员工.

**Tandem 当前** (这是我们最强的部分):
- **3+1 D 选项 humanOnly = 100% Plan-first** ✅
- 议事 17min 硬上限 + Decision Card 必须有 reviewable artifact ✅
- Memory 三级签批 = ultimate Plan-before-Act ✅
- **我们其实比 Claude Code 更激进** (D 选项强制员工原创, Claude Code 没有这个)

**真该借**:
- **Boss AI / Persona 日常对话也要 Plan-Act 分离** — 现在 Persona 给建议后, 用户回"好", Persona 就直接做了. 应该: 用户回"好" → Persona 先输出 "**这是我要做的**: [todo list]" → 用户再回"确认" → 才执行
- 落点: `@/lib/persona/two-step-confirm.ts` + Persona system prompt 增加 "before any action with side-effect, emit a plan and wait for user 'confirm'"

**不该借**: 把所有 AI 操作都两步走. **读操作不需要 plan** (e.g. "总结这份文档" 直接做). 只在 **side-effect 操作** (发邮件 / 改 OKR / 起草议事) 才两步.

---

### 架构 6: Subagent / Task tool (parallel exploration)

**机制**:
- Claude Code 的 `Task` tool: LLM 可以 spawn 一个 subagent, 给它独立 prompt + 工具集, 隔离上下文
- 主 agent 不污染 (subagent 用完 100K token 也只回主 agent 一段总结)
- 适用: "调研 codebase 找所有 auth 逻辑" "对比 3 种实现方案"
- Codex CLI 暂无独立 subagent, 但可手动 spawn 多个 cli session

**哲学**: **Context window 是稀缺资源, 不让 expensive exploration 污染主 session**. 这是 Anthropic 的 "**Agent Teams**" (CLAUDE.md 里也提及) 设计核心.

**Tandem 当前**:
- `@/lib/agent-runtime/subagent.ts` + `tests/unit/subagent.test.ts` 5 测试 ✅
- 但**没有用在 Boss AI / Persona 日常**, 仅供 Skill Gateway 内部用

**真该借**:
- **议事 3+1 Option B (LLM 推演) 应该 spawn 3 个 subagent 并行**:
  - 1 个从"销售视角"
  - 1 个从"财务视角"
  - 1 个从"HR 视角"
  - 主 agent 合并三视角 → 给出综合 Option B + 标注分歧点
- 这比"单 LLM 加 chain-of-thought" 输出更结构化, 更接近真实公司议事
- 落点: `@/lib/decision-layer/multi-perspective.ts` (新建), `@/lib/decision-layer/three-plus-one-engine.ts:buildOptionB` 改造

**不该借**: 让 Persona 自由 spawn subagent. **Subagent 是 expensive (多 token 多延迟)**, 必须 budget 化 — `@/lib/persona/skill-gateway.ts` 加一闸 "subagent count ≤ 3 per session".

---

### 架构 7: Durable Artifacts / Resume / Compact

**机制**:
- Claude Code session 可以 `/resume <session-id>` 继续 (Claude Code Agent View 把 session 列表化)
- `/compact` 主动压缩 history (保留: modified files / tool calls / 关键 decisions)
- `/clear` 硬清, 但 modified files 留下
- 80% context 自动触发 compact 警告

**哲学**: **Session 是会话, Artifact 是产物**. 会话可丢 (token 满了就 compact), 产物不可丢 (文件 / git commit / PR). 这让 agent 行为变得 **stateless from session perspective, durable from artifact perspective**.

**Tandem 当前**:
- 议事 Decision Card 是 durable artifact ✅
- OKR / KR / CheckIn 是 durable artifact ✅
- Memory promotion 是 durable artifact ✅
- **Boss AI / Persona chat 不是 durable** — refresh 就丢
- `@/tests/unit/compaction.test.ts` 5 测试有压缩基础设施 ✅

**真该借**:
- **Boss AI / Persona chat session 都要有 ID 可 `/resume`** — 重启浏览器后能继续
- **session compaction 自动化**: token 用到 80% 时, AI 自己 emit "我把前面 N 轮压成 1 句摘要, 你确认?" (人按确认 → 压缩, 不按 → 继续)
- 落点: `@/lib/persona/session-store.ts` (新建) + UI `/persona/sessions/[id]`

**不该借**: 强制每个 chat 都 durable. **个人闲聊 / quick query 不该污染审计链**. Session 加 `audit_required: boolean` flag — 默认 false (临时); 涉及 OKR/议事/Memory 调用时自动 true.

---

## 2. Claude Code vs Codex 的关键差异 (Tandem 该看清的)

| 维度 | Claude Code | Codex Cloud | 启示 |
|---|---|---|---|
| **同步 / 异步** | 同步 (interactive CLI) | 异步 (启动后半小时回来给 PR) | Tandem 议事是同步 (17min). 但 **Boss AI 任务委派可以学 Codex 异步**: 用户说"帮我起草 Q3 OKR 全景图", Boss AI 进入 background, 完成后 push 通知 |
| **Sandbox** | 用户本机 fs | container (隔离) | Tandem 多租户本就是隔离的, 但**测试环境 / playground 可以用 sandbox**: 客户试新 Skill 时, 跑在 isolated workspace |
| **代码 patch 格式** | 直接 Edit tool (full file 或 replace) | Apply Patch (unified diff) | Tandem **OKR 修改不该 full replace** — 应该改成 "**patch format**" (e.g. `{op: 'set_target', path: 'okr/q3/kr_1/target', value: 105}`), 这样冲突可 merge, audit 可 diff. 现在我们直接 `updateObjective(patch)` 是平的 |
| **GitHub 集成** | 间接 (用户在 CLI 里 `gh pr create`) | 深度 (Codex Cloud 直接开 PR) | Tandem **不接 GitHub**, 但**议事 commit 阶段可以学 PR 范式**: 议事产物自动生成"changes" 视图 (这条议事改了哪些 OKR / 哪些 Memory), 签字方 review 后合入 |

---

## 3. 产品逻辑级洞见 (3 个真深的)

### 洞见 1: "Models are commodities, the harness is the moat"

**Anthropic 公开战略**: 卖 Claude (model) **和** Claude Code (harness). 长期看 model 会同质化 (DeepSeek/Llama/Qwen 追平 Claude), 但 **harness (工具协议 + 权限 + hooks + skills + manifest)** 是 sticky 客户的根本.

**OpenAI 同理**: Codex CLI 开源 (MIT) — 因为 harness 即使开源也带 OpenAI 的工具生态优势.

**对 Tandem 的启示**:
- **Tandem 本来就是 100% harness**, 模型走 TAF router 多 provider 热插拔 — 这是**比 Claude Code 更纯的 harness 公司**
- 但我们没意识到这是优势, 销售话术全在讲"4 件不变量"产品功能
- **应该新增叙事**: "Tandem 是企业 AI 协作 harness, 客户可以挂任意 LLM (DeepSeek/Claude/GPT/Hermes/私有), 我们只负责协作层 / 治理层 / 不变量"
- 加到 `@/docs/PITCH-LAUNCH-2026-05-30.md` 战略章节

### 洞见 2: "CLI is the UI" — 但只对开发者. 我们的"CLI"是 forms + cards + grids

**Claude Code 的核心赌注**: 开发者已经在 CLI 里工作, 别强迫他们切换到 ChatGPT 网页 chat. Cursor / Aider / Codex CLI 同样赌.

**Tandem 的对应赌注**: 管理者 / 业务员工已经在**表单 / 卡片 / 网格 / Calendar** 里工作 (Tita / 飞书 / Excel), 别强迫他们切换到 ChatGPT 网页 chat 学 prompt.

**对 Tandem 的启示**:
- **Boss AI 当前的 chat surface 过大** — 用户对话 70% 完全可以用"按钮 + 表单 + 卡片"替代
- 例: "帮我起草 Q3 OKR" 不应该是 chat, 应该是 `/okr/bulk-create` (已做) + 4 选项 grid
- 例: "评估这个 Persona Skill" 不应该是 chat, 应该是 admin/evals/page (上次列了)
- **削减 chat surface, 扩大 form/card surface** — 这是产品哲学不是 UI
- 但议事 Decision Card / Persona 1 对 1 这种 **真正需要对话的场景保留 chat**, 不一刀切

### 洞见 3: "/init 让 AI 自己读 codebase 生成 CLAUDE.md" — Onboarding 革命

**Claude Code `/init`**: 第一次进入项目, AI 自己:
1. 读所有顶层文件
2. 推断技术栈
3. 找测试命令
4. 找 lint/format 命令
5. 输出 `CLAUDE.md` 草稿
6. 用户审一遍签字

**这是 Anthropic 给企业客户的 onboarding 黑科技** — 客户不用学怎么写 prompt, AI 自己学.

**对 Tandem 的启示** — **这是 Tandem 客户冷启动的最大武器**:
- 客户第一次接入: 让客户上传 (a) 现有 OKR 表 (Excel/Tita 导出) (b) 上 1 季度议事记录 (c) 公司红线文档
- AI 跑 `/tandem init`:
  1. 读 OKR Excel → 推断公司层级 / cycle 长度 / 命名规范
  2. 读议事记录 → 推断决议密度 / 主题分布
  3. 读红线文档 → 抽出公司层"不变量" (除了 Tandem 默认 4 件之外, 客户可能有"不打折"/"不裁员"等私有红线)
  4. 输出 `tandem.workspace.md` 草稿 + 3 套 OKR 模板 + 5 条公司红线
  5. 客户 CEO + Steward 审一遍签字
- **客户第一天就有了"上下文丰富的 Tandem"**, 不是"空白 Tandem 等你填"
- **这是 Tandem 冷启动从 0 到 1 的关键** — 上一轮"想清楚了吗"我承认数据冷启动是真问题, 这就是答案
- 落点: `@/lib/onboarding/init-wizard.ts` (新建) + `app/onboarding/page.tsx`

---

## 4. Tandem 真该借的 4 件事 (按优先级, 不给工期)

只列**有客户价值** + **代码层落点清晰**的, 不再写 wishlist.

| # | 借什么 | 客户价值 | 落点 |
|---|---|---|---|
| 1 | **`/tandem init` 冷启动 onboarding** (洞见 3) | 第 1 个客户从"空白屏" 到"有 OKR + 模板 + 红线"的路径 | `@/lib/onboarding/init-wizard.ts` + Persona 跑读 Excel/PDF + LLM 生成 manifest |
| 2 | **`tandem.workspace.md` workspace manifest** (架构 1) | 客户在 1 个文件里看清 "我们的 Tandem 长这样" | `@/lib/persona/workspace-manifest.ts` + `app/admin/workspace-manifest/page.tsx` |
| 3 | **declarative hooks** (架构 4) | 客户不写代码就能加治理规则, 卖给 Steward / 法务 / 合规的核心 | 复用 `@/lib/workflows/engine.ts` event 模型, 加 `pre_tool_use` 触发点 |
| 4 | **Plan-Act 两步确认 for Boss AI side-effect** (架构 5) | 防止 Persona 误操作 (改 OKR / 发邮件), 与 D humanOnly 哲学一致 | `@/lib/persona/two-step-confirm.ts` |

**为什么没列其他**:
- "Subagent 多视角" — 工程师 wishlist, 客户感知弱, 等 Beta 反馈再做
- "session resume" — 内部体验改善, 不卖钱
- "permission per pattern" — 当前 Skill Gateway 4 闸够用, 等真有客户嫌粗了再细化
- "TodoWrite tool" — 议事 Decision Card 已是类似 artifact, 不重复造轮子

---

## 5. 3 件不该借 (战略红线)

### ❌ 不借 1: **CLI 作为终端用户 UI**

Claude Code / Codex CLI 都赌"用户已在 CLI 里". Tandem 用户是**业务员工 + 管理层**, **永远不会进 CLI**.

我们可以学"键盘优先 + 命令面板" (Linear / Claude Code 共享), 但**不能学"CLI is the UI"**.

### ❌ 不借 2: **Bash / Edit / WebFetch 作为通用 Persona 工具**

Claude Code 给 LLM "任意执行 shell + 任意改文件 + 任意访问网络". 这是 dev tool 该有的, **不是协作 OS 该有的**.

Tandem Skill Gateway 4 闸已经守住这条线, **绝不放开**.

### ❌ 不借 3: **Markdown 完全替代 DB**

Claude Code 没有 DB, 状态全在 fs. **企业协作 OS 不能这么做** — 多人协同 + 审计链 + 三级签批必须 DB.

**markdown 是 declarative governance layer (manifest / hooks / skills), 不是 state.**

---

## 6. 与已有文档的关系

| 文档 | 关系 |
|---|---|
| `EVOLUTION-2026-05-APPENDIX-CLAUDE-CODE.md` (5-12 写的) | 覆盖 UI 范式 (Agent View) + best practices 12 条. **本文不重复**, 是底层架构 + 产品逻辑补集 |
| `COMPETITIVE-ANALYSIS-2026-05-30.md` | 营销层 (Claude Enterprise 不是竞品而是 provider). **本文是工程层** |
| `COMPETITIVE-DEEP-DIVE-2026-05-30.md` | 5 大产品横向. 本文是 Claude Code + Codex 纵向深挖 |
| `PLATFORM-ARCHITECTURE-2026-05-29.md` | Tandem 18 项架构决议. **本文找架构 1/4/5 对接点** |

---

## 7. 一句话

> **Claude Code 和 Codex 的真正护城河不是模型, 是 "filesystem + markdown manifest + permission-per-pattern + hooks + plan-act 分离" 这套 harness 协议.**
>
> **Tandem 本来就是 100% harness 公司, 但我们在底层架构上还没把这套协议化的优势讲出来 — 一是销售话术全在讲产品功能, 二是 onboarding 还是空白屏不是 /init.**
>
> **借 4 件事就够: /tandem init + workspace.md + declarative hooks + Plan-Act 两步确认. 其他都是工程师 wishlist.**

---

## 8. 修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1. 7 个深层架构 + Claude Code/Codex 差异 + 3 个产品逻辑洞见 + 4 件真该借 + 3 件不该借 |
