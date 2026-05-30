# EVOLUTION-2026-05 附录 · Skills 生态 + Hermes Agent 平台启发

> 2026-05-13 · 公开市场双轨研究:
> - **Claude Code Skills 生态**: Anthropic 官方 skills (anthropics/skills), Superpowers 框架 (obra/superpowers, 99k+★), MCP Server 生态, Plan Mode v2
> - **Hermes Agent 平台**: Nous Research hermes-agent v0.13+, Profile 系统, Memory 三层架构, Gateway 多平台, ACP 协议, TUI (React Ink)
>
> 作为 `docs/EVOLUTION-2026-05.md` 第 4 份附录, 与前 3 份互补 (Ruflo = 范式, Claude Code = Agent View/工程, 本文 = Skills 编排 + Hermes 架构).

---

## 0. 研究标的 (双轨 6 源)

| 标的 | 性质 | 关键定位 | 对 Tandem 的映射 |
|---|---|---|---|
| **Claude Code Skills** | 开放标准 Markdown 技能文件, 跨 Claude/Cursor/Codex/Gemini CLI | "知识编码一次, 到处适用" | Tandem Agent 的"能力模块化" |
| **Superpowers 框架** | obra/superpowers, 20+ 技能, 强制 TDD + subagent 隔离 | "把 coding agent 变成 senior engineer" | Tandem Agent 的"结构化工作流" |
| **MCP Server 生态** | Model Context Protocol, 770+ servers, stdio/HTTP/SSE | "AI 的 USB-C" | Tandem 外部系统接入标准 |
| **Hermes Profile 系统** | Nous Research, 多隔离实例, 独立 config/sessions/skills | "一个 Hermes, N 个身份" | Tandem 多角色上下文隔离 |
| **Hermes Memory 三层** | 文件 + SQLite FTS5 + 可插拔 Provider (Honcho/mem0) | "记忆不是缓存, 是模型" | Tandem Persona 工作记忆升级 |
| **Hermes ACP/Gateway** | Agent Client Protocol + Telegram/Discord/Slack/WhatsApp | "同一核心, 六张面孔" | Tandem 多渠道企业 IM 接入 |

---

## 1. Claude Code Skills 生态 · 4 个核心模式

### 1.1 Skills 双层分类 (Capability Uplift vs Encoded Preference)

| 类型 | 定义 | 例子 | 对 Tandem 的意义 |
|---|---|---|---|
| **Capability Uplift** | 给 AI 新能力 (之前不会做) | Firecrawl web 抓取, Document Skills PDF 生成, Playwright 浏览器测试 | Tandem Agent 获得"外部工具调用"能力 |
| **Encoded Preference** | 编码团队特定方式 (AI 会做但做得不对) | 代码审查清单, NDA 审查流程, 提交信息格式, 会议纪要模板 | Tandem Agent 编码"企业决议文化" |

**关键启发**: Tandem 当前 Agent 是"全能型", 所有场景共用同一套 prompt 和工具. 应该拆分为:
- **Uplift Skills**: 数据分析 / 竞品扫描 / 文档生成 / 合规检查
- **Preference Skills**: 本企业的 1on1 纪要格式 / 决议投票规则 / 复盘模板 / 晋升评审话术

### 1.2 Superpowers 框架 · 7 步工作流

```
Brainstorm → Spec → Plan → TDD (RED→GREEN→REFACTOR) → Subagent Dev → Review → Finalize
```

| 阶段 | 机制 | 为什么有效 |
|---|---|---|
| **Brainstorm** | Socratic 提问, 把模糊需求变成决策文档 | 防止"我以为你要的是这个" |
| **Plan** | 拆成 2-5 分钟任务, 精确到文件路径 | 可追踪, 可验证 |
| **TDD** | 测试必须先失败 (RED), 才能写代码 (GREEN) | 消灭"编译通过但行为不对" |
| **Subagent** | 每个阶段 fresh context, 两阶段审查 | 防止上下文污染和"作弊" |
| **Review** | spec 合规审查 → 代码质量审查 | 双层守门 |

**对 Tandem 的映射**: 一个"决议"从提出到落地, 本质也是同样的 7 步:
```
议题发散 (Brainstorm) → 议题定稿 (Spec) → 行动项拆解 (Plan)
→ 假设验证 (TDD) → 责任人执行 (Subagent) → 结果审查 (Review) → 归档 (Finalize)
```
Tandem 的"议事室 5 步骨架" (§3) 已经覆盖了前半段, **后半段 (执行→审查→归档) 是缺口**.

### 1.3 Subagent 隔离 · TDD 的 RED-GREEN-REFACTOR

**核心问题**: 单上下文 LLM 做 TDD 会"作弊" — test writer 的详细分析会泄露给 implementer, implementer 会 subconsciously 围绕已计划的实现写测试.

**解决方案**: 三个阶段各用独立 subagent:
- **RED Agent**: 只看需求, 写测试, 确认失败
- **GREEN Agent**: 只看失败测试, 写实现, 确认通过
- **REFACTOR Agent**: 只看实现代码, 优化, 确认仍通过

**对 Tandem 的映射**: Steward Agent (治理官, EVO-6) 当前是单 Agent, 应该拆成三角色隔离:
- **诊断 Agent**: 只看数据, 不接触配置/代码/人
- **建议 Agent**: 只看诊断结果, 生成建议, 不接触原始数据
- **执行 Agent**: 只在人类批准后执行, 且仅执行已批准项

### 1.4 MCP Server · "AI 的 USB-C"

**核心机制**: 标准化协议 (JSON-RPC 2.0) 让 AI Client 自动发现外部系统的 Resources / Tools / Prompts.

| 传统 API | MCP |
|---|---|
| 每个系统定制集成代码 | 一个协议接所有系统 |
| 手动上下文管理 | 内置 AI 上下文优化 |
| 无自动发现 | Agent 自动发现资源和工具 |

**对 Tandem 的映射**:
- Tandem 作为 **MCP Client**: 消费 HRIS / CRM / 项目管理 / 财务系统的 MCP Server
- Tandem 作为 **MCP Server**: 暴露决议/OKR/1on1/360 数据, 供外部 IDE (Zed/VS Code) 调用
- EVO-3 (HRIS Adapter) 可以直接从定制化接入改为 **MCP 标准化接入**

### 1.5 Plan Mode · 规划与执行分离

Claude Code v2 的三种模式:
- **Normal**: 标准对话式编码
- **Auto-Accept Edit**: 自动应用建议
- **Plan Mode**: 只读探索, 生成 markdown 计划存 `.claude/plans/`, 用户批准后才执行

**关键洞察**: "分离规划与执行减少 token 浪费和迭代周期."

**对 Tandem 的映射**: Tandem 当前 AI 建议是"即时生成", 可以引入 **Plan Mode 草案**:
- AI 只生成建议计划 (不自动改 OKR/决议/任何数据)
- 员工在 UI 上审查、编辑、批准
- 批准后一次性执行
- 这与 EVO-2 (OKR 纠偏) 的"纯规则 issue→suggestion, 不自动改写"设计哲学完全一致

---

## 2. Hermes Agent 平台 · 5 个架构创新

### 2.1 Profile 系统 · 多身份隔离

```
hermes profile create work --clone
hermes profile use work
hermes -p work chat -q "Hello from work profile"
```

每个 profile 有独立的: config / sessions / skills / memories / home directory / `.env`

**对 Tandem 的映射**: Tandem 用户天然有多重角色 —
- 作为 **OKR Owner**: 关注目标达成、KR 进度
- 作为 **1on1 Report**: 关注成长、反馈、private notes
- 作为 **360 Reviewer**: 关注匿名评审、不暴露身份
- 作为 **Resolution Participant**: 关注议题清晰度、投票

当前这些角色共享同一套上下文和记忆, 存在**交叉污染风险** (例如 360 评审时意外加载了 OKR 的激进目标, 影响对被评人的公正性).

→ 引入 **Session-level Profile**: 进入不同模块时, 自动切换对应技能集和记忆视图.

### 2.2 Memory 三层架构

| 层 | 机制 | 持久化 | 检索 |
|---|---|---|---|
| **L1 文件记忆** | `MEMORY.md`, `USER.md`, `SOUL.md` | 文件系统 | 直接注入 prompt |
| **L2 会话记忆** | SQLite SessionDB, WAL mode, FTS5 | SQLite | `session_search` 工具 |
| **L3 深度建模** | 可插拔 Provider (Honcho / mem0 / supermemory) | 外部服务 | 向量检索 / dialectic |

**Honcho "dialectic" 特别值得注意**:
三层自我批判链 — Initial Assessment → Self-Audit → Reconciliation, 深度由 `dialecticDepth` (1-3) 控制.

**对 Tandem 的映射**: 当前 EVO-4 (Persona 工作记忆) 仅 L1 级别 (静态画像).
→ 升级到三层:
- **L1 静态画像**: 岗位/偏好/沟通风格 (已有)
- **L2 会话历史**: SQLite + FTS5 本地搜索 (技术可行, 数据不出租户)
- **L3 深度建模**: 每次生成画像前, Agent 自我批判三次 ("我是否过度推断? 是否有偏见? 是否尊重员工意愿?")

**宪章守门**: L3 画像 **仅本人可见**, 不进任何看板, 不上报 HR (§13 + §11.2).

### 2.3 Gateway 多平台适配 · 同一核心六张面孔

Hermes 的 `AIAgent.run_conversation()` 同一核心, 通过薄适配层服务:
- CLI (经典)
- TUI (React Ink + JSON-RPC over stdio)
- Telegram / Discord / Slack / WhatsApp / Signal
- ACP (Agent Client Protocol, Zed/VS Code)
- API Server
- Batch Runner

**对 Tandem 的映射**: Tandem 当前是 Web 应用. 中国市场走自有桌面 (Tauri) + 原生移动 App, **不接钉钉/企微/飞书** (战略红线, 他们是直接竞品, 详 `OKR-VS-TITA.md` §11).
→ **中性 Gateway 适配层** (仅 V2 考虑): 让 Tandem Agent 通过中性渠道触达用户 — SMTP/IMAP 邮箱 / Slack · Teams (海外市场) / RocketChat (OSS).

**宪章守门**: 仅推送"需要你决定的事"(Waiting), 不推送"你在拖延"(§11 反消息黏性).

### 2.4 ACP (Agent Client Protocol) · IDE 集成

ACP 是 Zed 和新兴 VS Code 集成的标准协议. Hermes 实现 `HermesACPAgent`:
- 工具映射: `read_file` → `read`
- IDE 可注册 MCP Server, Agent 看到为额外 toolsets
- 会话绑定 editor 的 `cwd`, 共享 SessionDB

**对 Tandem 的映射**: 让 Tandem 暴露 ACP 接口:
- 开发者在 IDE 选中代码 → 右键"创建决议讨论此段代码"
- IDE 侧边栏显示"我待参与的决议"
- 不开发自己的 IDE 插件, 而是作为标准 Agent 供现有 IDE 消费 (§17 不做通用工具)

### 2.5 Toolsets 动态管理

```
hermes chat --toolsets "web,terminal"
/tools disable <name>
/tools enable <name>
```

不同场景加载不同工具集, 防止权限膨胀.

**对 Tandem 的映射**: 引入 **Agent 工具集管理**:
- 决议场景: 关闭数据修改工具, 只保留读取和建议
- 1on1 场景: 关闭跨团队数据访问
- 360 评审场景: 关闭匿名揭盲工具
- Steward 审计场景: 只开放只读工具

这与 MIT Sloan "HR for Agents" 2026 趋势完全对齐 — 给 Agent 服务账号 + 行为边界 + 防止权限提升.

---

## 3. HVAC 行业 AI Agent 趋势 · 4 个信号 (交叉启发)

虽然本文档主攻 Tandem, 但公开市场研究显示 HVAC 领域出现值得记录的信号:

| 信号 | 来源 | 对 HVAC 项目的映射 |
|---|---|---|
| **Life-GPT 语音交互** | A.O.史密斯 AI-LiNK (2025-11) | P0 语音入口的竞品对标 |
| **Office-in-the-Loop** | Cambridge 论文 (2026-05) | 人类反馈闭环控制 HVAC,  comfort 评分 + LLM 调节 |
| **数字孪生 + MARL** | MDPI Buildings (2026-03) | BIM + 多智能体强化学习 → 预测性维护 |
| **BAS 市场 $204B by 2030** | GlobeNewswire (2026-01) | 市场验证, agentic HVAC 是确定性趋势 |

**交叉启发**: Tandem 的 Agent 编排能力 (Skills + Subagent + MCP) 可以**反向输出到 HVAC 项目** — 让 HVAC 的语音入口和数字孪生层复用同一套 Agent 框架.

---

## 4. 宪章过滤 · 决定哪些借鉴

| 来源模式 | 触发宪章? | 处置 | 对应进化点 |
|---|---|---|---|
| Skills 双层分类 | 不触发 | ✅ **直接借鉴** | EVO-13 Agent Skills 目录 |
| Superpowers 7 步工作流 | 不触发 | ✅ **映射到决议生命周期** | EVO-14 Subagent 隔离审计 |
| Subagent TDD 隔离 | 不触发 | ✅ **借鉴到 Steward Agent** | EVO-14 |
| MCP Client/Server | 不触发 | ✅ **直接借鉴** | EVO-15 MCP Gateway |
| Plan Mode 分离 | 不触发 | ✅ **已经在做** (EVO-2 不自动改写) | 验证一致 |
| Hermes Profile 系统 | 不触发 | ✅ **直接借鉴** | EVO-17 多角色 Profile |
| Memory 三层 + dialectic | §11.2 / §13 | 🟡 **严格守门** | EVO-16 Persona 记忆三层化 |
| Gateway 多平台 | 不触发 | ✅ **借鉴** | EVO-19 企业 IM 推送 (仅 Waiting) |
| ACP IDE 集成 | §17 | 🟡 **反向用** | 暴露接口, 不自建插件 |
| Toolsets 动态管理 | §14 | ✅ **直接借鉴** | EVO-18 Agent 权限边界 |
| HVAC Office-in-the-Loop | 不触发 | ✅ **交叉启发** | 见 §7 |

---

## 5. 提取出 6 个新进化点 (EVO-13 ~ EVO-19)

### EVO-13 · Agent Skills 目录 (Capability Uplift + Encoded Preference)

- **来源**: Claude Code Skills 双层分类 + Agent Skills open standard
- **现状**: Tandem Agent 是"全能型", 所有场景共用同一套 prompt + 工具
- **方案**:
  - 在 `lib/agent/skills/` 建技能目录, 每个技能一个 Markdown 文件 (遵循 open standard)
  - **Uplift Skills**: `data-analysis.md` / `competitor-scan.md` / `doc-generation.md` / `compliance-check.md`
  - **Preference Skills**: `1on1-note-format.md` / `resolution-voting-rules.md` / `retro-template.md` / `promotion-review-tone.md`
  - Agent 根据任务类型自动加载相关技能 (类似 Superpowers auto-trigger)
  - 企业管理员可上传自定义 Preference Skills (编码企业文化)
- **预算**: 6 天
- **优先级**: 高 (V1.5, 与 EVO-10 Workbench 同期最佳)
- **宪章守门**: Preference Skills 只能编码"流程和格式", 不能编码"评价标准"(§13 尊严)

### EVO-14 · Steward Agent Subagent 隔离审计 (三权分立)

- **来源**: Superpowers TDD RED-GREEN-REFACTOR subagent 隔离
- **现状**: Steward Agent (EVO-6) 是单 Agent, 诊断+建议+执行一条龙
- **方案**:
  - **诊断 Subagent**: 只读数据, 生成审计报告, 不接触配置
  - **建议 Subagent**: 只看审计报告, 生成改进建议, 不接触原始数据
  - **执行 Subagent**: 只在人类批准后执行, 且仅执行已批准项, 有操作日志
  - 三个 Agent 之间通过结构化消息通信 (审计报告 JSON / 建议 JSON / 执行指令 JSON)
  - 防止"诊断偏见影响建议客观性"和"建议越权直接执行"
- **预算**: 8 天
- **优先级**: 中 (V2, Steward Agent 先跑起来再拆分)
- **宪章守门**: 执行 Agent 永远需要人类批准 (§15); 诊断 Agent 不能访问个人敏感数据 (§13.2)

### EVO-15 · MCP Gateway (外部系统标准化接入)

- **来源**: MCP Server 生态 (770+ servers, "AI 的 USB-C")
- **现状**: EVO-3 (HRIS Adapter) 计划做定制化接入
- **方案**:
  - Tandem 作为 **MCP Client**: 通过 MCP 协议接入 HRIS / CRM / 项目管理 / 财务系统
  - Tandem 作为 **MCP Server**: 暴露决议/OKR/1on1/360 的只读接口, 供外部 IDE 消费
  - 内部实现: `lib/mcp/client.ts` (消费外部 Server) + `app/api/mcp/route.ts` (暴露 Tandem Server)
  - 优先接入: HRIS (替代 EVO-3 定制化方案) → 项目管理 (Jira/Linear) → CRM
- **预算**: 7 天
- **优先级**: 高 (V1.5, 与 HRIS Adapter 合并做)
- **宪章守门**: MCP Server 只暴露聚合数据, 不暴露个人原始记录 (§13.2); 写操作必须过人类批准 (§15)

### EVO-16 · Persona 记忆三层化 + Honcho Dialectic

- **来源**: Hermes Memory 三层架构 + Honcho "dialectic" 自我批判
- **现状**: EVO-4 (Persona 工作记忆) 仅 L1 静态画像
- **方案**:
  - **L1 静态画像** (已有): `persona_profile` 表, 岗位/偏好/沟通风格
  - **L2 会话记忆** (新增): 本地 SQLite + FTS5, 存储用户与 Agent 的历史对话, 支持全文检索
  - **L3 深度建模** (新增): 每次更新画像前, Agent 执行 dialectic 三层批判:
    1. **Initial Assessment**: "基于这些会话, 我推断用户的风格是..."
    2. **Self-Audit**: "我是否过度推断? 是否有确认偏误? 是否忽略了用户明确拒绝过的建议?"
    3. **Reconciliation**: "综合以上, 最保守且有用的画像是什么?"
  - `dialecticDepth` 默认 2 (平衡质量与成本)
- **预算**: 6 天
- **优先级**: 中 (V1.5, 等 EVO-4 基础版跑起来后升级)
- **关键守门**: L3 画像 **仅本人可见**, 不进任何看板, 不上报 HR, 不用于晋升评估 (§13 + §11.2 铁律)

### EVO-17 · 多角色 Profile 系统 (Session-level 隔离)

- **来源**: Hermes Profile 系统
- **现状**: Tandem 用户在不同模块间共享同一上下文
- **方案**:
  - 定义 4 个内置 Profile: `okr-owner` / `1on1-report` / `360-reviewer` / `resolution-participant`
  - 每个 Profile 有独立的:
    - **技能集**: 如 `360-reviewer` 只加载评审相关技能
    - **记忆视图**: 如 `1on1-report` 只能看自己的 private notes
    - **工具权限**: 如 `resolution-participant` 关闭数据修改工具
  - 用户进入不同模块时自动切换 Profile (透明)
  - 管理员可创建自定义 Profile (如 `interviewer` 面试者视图)
- **预算**: 5 天
- **优先级**: 高 (V1.5, 与 EVO-13 Skills 目录协同)
- **宪章守门**: Profile 切换只影响"我能看到什么", 不影响"老板能看到我什么"(§13.2)

### EVO-18 · Agent 工具集动态管理 (权限边界)

- **来源**: Hermes `/tools enable/disable` + MIT Sloan "HR for Agents"
- **现状**: Tandem Agent 默认加载全部工具, 存在权限膨胀风险
- **方案**:
  - 每个 Profile 绑定一个 **Toolset 白名单**
  - 场景示例:
    - 决议诊断: `['read_okr', 'read_resolution', 'suggest_action']`
    - 1on1 记录: `['read_1on1', 'write_note', 'suggest_growth_plan']` (不能 `read_team`)
    - Steward 审计: `['read_aggregate', 'audit_log']` (不能 `write_anything`)
  - 运行时动态加载/卸载, 工具调用前权限检查
  - 敏感操作 (如 `anonymizePeers`, `privateManagerNote`) 单独列入 `restricted-tools`, 需二次确认
- **预算**: 4 天
- **优先级**: 高 (V1.5, 安全基线)
- **宪章守门**: `restricted-tools` 列表由宪章 §13.2 直接推导, 非管理员可配置

### EVO-19 · 中性 IM Gateway (仅 Waiting 推送 · 不接钉钉/企微/飞书)

> 2026-05-30 战略红线调整: 原名"企业 IM Gateway" 准备接钉钉/企微/飞书, 现改为“中性” — 他们是直接竞品, 接 = 变插件.
仅接: Slack/Teams (海外) / SMTP-IMAP 邮箱 / RocketChat (OSS). 详 `OKR-VS-TITA.md` §11.

- **来源**: Hermes Gateway (Telegram/Discord/Slack/WhatsApp/Signal 中性渠道)
- **现状**: Tandem 是纯 Web 应用, 用户必须主动打开
- **方案**:
  - 构建轻量 Gateway 层, 支持中性渠道 (Slack / Teams / SMTP-IMAP) — **不接企业微信 / 钉钉 / 飞书 Webhook**
  - 仅推送 **"Waiting" 状态项** (需要你决定的事):
    - 决议待投票 ("XX 决议等你投票, 还剩 2 小时")
    - 1on1 待确认 ("下周三 1on1 请确认时间")
    - Check-in 到期 ("本周 OKR Check-in 还未完成")
  - 不推送: "Running"(正在进行的不打扰), "Done"(已完成的无需通知), 任何催促/焦虑类消息
  - 用户可直接在 IM 内完成简单操作 (投票/确认/快捷回复), 复杂操作跳转 Web
- **预算**: 7 天
- **优先级**: 中 (V1.5, 用户体验跃迁)
- **宪章守门**: 推送频率上限 (每人每天最多 3 条), 禁止排行/ streak / "你落后了"(§11 + §13)

---

## 6. 对 HVAC 项目的交叉启发

Tandem 的 Agent 编排能力 (Skills + Subagent + MCP) 可以**反向输出**到 HVAC 项目:

| Tandem 能力 | HVAC 复用点 | 工期 |
|---|---|---|
| EVO-13 Skills 目录 | HVAC 设备协议作为 Skill (空调/新风/地暖/除湿各一个 skill) | 2 天 |
| EVO-15 MCP Gateway | HVAC 设备暴露为 MCP Server, 语音入口作为 MCP Client | 1 天 |
| EVO-16 Dialectic | 语音助手理解用户 comfort 偏好的自我批判 ("我是否过度调节?") | 1 天 |
| EVO-19 Gateway | 语音/企业微信推送设备异常 (仅 critical, 不骚扰) | 2 天 |

**具体建议**: HVAC P0 语音入口 (3 天 demo) 可以基于同一套 Agent 框架:
- 语音输入 → Intent 识别 (Skill: `hvac-voice-intent`)
- 设备控制 → MCP Client 调用设备 MCP Server
- 用户反馈 → Office-in-the-Loop 闭环 ("现在舒适吗? 1-10 分")
- 异常推送 → Gateway 层 (仅 critical, 如漏水/超温)

这样 Tandem 和 HVAC 共享 Agent 内核, 减少重复建设.

---

## 7. 反例清单新增 (附 MANIFESTO §C)

| 行号 | 反例 | 触发宪章 | 来源 |
|---|---|---|---|
| **C19** | Agent Skills 编码员工能力评价标准 ("该员工沟通差") | §13 (尊严) | EVO-13 Preference Skills 边界 |
| **C20** | L3 深度画像用于晋升/调薪决策 | §11.2 + §13 | EVO-16 守门 |
| **C21** | Profile 隔离被 HR 用来"看看员工在 360 里说了什么" | §13.2 | EVO-17 滥用 |
| **C22** | MCP Server 暴露个人 360 原始评分给外部系统 | §13.2 + §8 | EVO-15 数据边界 |
| **C23** | IM Gateway 推送 "你的团队有 3 人 check-in 逾期"给老板 | §11 + §13.2 | EVO-19 推送范围 |
| **C24** | Agent 工具集绕过权限检查 (prompt injection 加载 `restricted-tools`) | §14 | EVO-18 安全 |

---

## 8. 推荐启动序 (本月)

当前已交付: EVO-1 ✓ / EVO-2 ✓ / Ruflo 附录 ✓ / Claude Code Agent View 附录 ✓

| 排序 | 进化 | 工期 | 理由 |
|---|---|---|---|
| **下一步** | **EVO-18 Agent 工具集管理** | 4 天 | 安全基线, 所有后续 Agent 功能的前提 |
| **再下** | **EVO-13 Agent Skills 目录** | 6 天 | 本月用户可感知的"Agent 变聪明"体验跃迁 |
| **再下** | **EVO-17 多角色 Profile** | 5 天 | 与 EVO-13 协同, 解决上下文污染 |
| **下月** | EVO-15 MCP Gateway | 7 天 | 等 HRIS Adapter 需求明确后接入 |
| **下月** | EVO-14 Steward Subagent 隔离 | 8 天 | 等 Steward Agent 先跑起来 |
| **下下月** | EVO-16 Persona 记忆三层化 | 6 天 | 等 EVO-4 基础版有真实数据后升级 |
| **下下月** | EVO-19 企业 IM Gateway | 7 天 | 等 Web 核心体验稳定后再扩展渠道 |

**若用户选择切换 HVAC 项目**: P0 语音入口 3 天 demo 可以复用 EVO-13/15/16/19 的 Agent 内核, 实际增量开发约 1.5 天.

---

## 9. 选边宣言

> **「Claude Code Skills 让 AI 编码 agent 变成可配置的资深工程师.**
> **Tandem Skills 让组织决议 agent 变成可配置的企业文化载体.**
>
> **Superpowers 用 subagent 隔离防止 AI 作弊.**
> **Tandem 用 subagent 隔离防止 Agent 越权.**
>
> **Hermes 用 Profile 让一个人有 N 个隔离身份.**
> **Tandem 用 Profile 让一个员工在不同场景下只加载该加载的记忆.**
>
> **MCP 是 AI 的 USB-C, 让任何系统即插即用.**
> **Tandem 的 MCP Gateway 让组织数据安全地进入 AI 工作流, 而非把员工数据廉价地卖给大模型.**
>
> **学法, 更学其之所以然.**
> **不学其监视之术, 学其隔离之智.**
> **不学其自动化之便, 学其人在环之界.**
> **不学其全知全能之梦, 学其有所不为之道.**」
