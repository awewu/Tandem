# 企业级 AI 协作产品深度对比 (功能 / 技术 / 页面架构 + 学习清单)

> **缘起**: `COMPETITIVE-ANALYSIS-2026-05-30.md` 是营销定位层 (高层差异 + 销售话术).
> 本文是工程层 — 拆到具体功能 / 技术架构 / 页面架构, 找出 Tandem 真正可以**借鉴 + 进化**的细节.
>
> **方法**: 5 个核心竞品 × 4 个维度 (功能 / 技术 / 页面 / 学习清单).
> **关键纪律**: 借鉴**交互范式 / 工具链 / 治理思路**, **不借**飞书/钉钉/企微集成 / 商业模型 / 文化哲学.

---

## 0. 对比框架

5 个核心竞品 (按对 Tandem 的"学习价值"排序, 非市场地位):

| # | 竞品 | 为什么值得 deep dive |
|---|---|---|
| 1 | **Linear** | Apple-class UX 标杆 / 工程师审美 / ⌘K 范式 / 性能 (60fps streaming) |
| 2 | **Notion AI + Notion 工作区** | 块编辑器 / 内联 AI 触发 / 数据库视图 / Wiki 沉淀 |
| 3 | **Claude Projects + Claude Code** | 项目知识管理 / Connectors 治理 / Artifacts 范式 / 终端 Agent 体验 |
| 4 | **Coze (字节) 企业版 + Coze Studio (开源)** | Agent 编排 / Skill marketplace / 多模 RAG / 评测台 |
| 5 | **Microsoft Copilot Cowork + Copilot Studio** | 多人 + 多 Agent 协作 canvas / Pages / 中央 Agent 治理 |

每个竞品 4 节: 功能细节 · 技术架构 · 页面架构 · Tandem 应该学的 (具体到文件路径).

---

## 1. Linear — UX + 性能标杆

### 1.1 功能细节 (Tandem 应学的)

| Linear 的细节 | 当前 Tandem | gap |
|---|---|---|
| **⌘K Command Bar** (200+ commands, fuzzy match, 上下文相关) | `components/command-palette.tsx` 有但 commands 只有 ~30 条 | 🟠 扩展到 100+ |
| **g + letter** 二段键导航 (g+i=Inbox, g+m=My Issues, g+t=Triage) | 部分实现 `components/keyboard-shortcuts.tsx` | 🟢 已有, 文档化弱 |
| **j/k 上下选择 + x 多选 + Enter 进入** | 部分页 (`/im`, `/okr`) | 🟠 全站统一 |
| **Cycle 周期视图** (本周/上周/全部) | OKR cycle 有, 但 issue/task 没分 cycle | 🟠 加 cycle filter |
| **Issue 状态可拖**（kanban + list 双视图同步） | `/tasks` 暂只 list | 🟠 加 kanban |
| **Triage 收件箱** (优先级排序待办) | `inbox` 雏形 (上一 commit 加内滚) | 🟢 接近 |
| **Roadmap timeline** (Gantt 但极简) | 无 | 🔴 0 |
| **Sub-issues** (任务树) | 无 | 🟠 议事卡片可成树 |
| **Linear Asks** (从 Slack 转 issue) | 我们走议事室 spawn | 🟢 不同范式 |
| **Auto-close on PR merge** (git 集成) | 无 (上线红线不接外部 git) | 🟢 跳过 |
| **每周自动 cycle report** (跑批生成 markdown) | KR forecast 在做 | 🟡 接近 |
| **Pulse** (团队心跳: 谁 in progress / 谁 stuck) | `/okr/cascade` + Status board 部分实现 | 🟠 加专门视图 |

### 1.2 技术架构 (Linear 揭示的)

| 维度 | Linear 选型 | Tandem 当前 | 借鉴价值 |
|---|---|---|---|
| **state** | local-first (GraphQL + Apollo Client + IndexedDB cache) | Zustand 87KB + REST + drizzle | 🟡 长期 (本地 first 是体验质变, 但 v1 不动) |
| **realtime** | WebSocket + delta sync | SSE + Yjs (协同文档) + LiveKit (av) | 🟢 已类似 |
| **router** | next-style file router + 强 typed (生成 ts) | Next.js 14 App Router | 🟢 已类似 |
| **styling** | CSS-in-JS (vanilla-extract) + theme tokens | Tailwind v3 + 三层 token | 🟢 范式一致 |
| **performance** | 60fps streaming (virtualized list 全站) | 部分页虚化 (`/im` thread) | 🟠 全站 react-virtual |
| **keyboard** | mousetrap-style global hotkey + scoped | 自研 hotkey hook | 🟢 已有 |
| **command** | cmdk (自研变种) | cmdk | 🟢 一致 |
| **图标** | 自研 SVG icon set | lucide-react | 🟡 (Linear icon 自研值得长期投资) |

**关键差异**: Linear 是 **local-first** (所有数据先入 IndexedDB, 后台同步) — 这是它丝滑的根因. Tandem v1 走 REST + Zustand, 后期可考虑切 Yjs CRDT for OKR + Issues.

### 1.3 页面架构 (Linear 的 IA)

```
Linear IA (3 层导航, 极简):
┌─ Sidebar (固定 240px)
│  ├─ Inbox             ← 所有通知 + 待办 unified
│  ├─ My Issues         ← 个人 me-first
│  ├─ Active Cycles     ← 本周
│  ├─ Projects          ← 跨 cycle 的大项目
│  ├─ Views (saved)     ← 用户自存的 filter
│  ├─ Teams             ← 团队折叠
│  │  ├─ Frontend
│  │  │  ├─ Triage
│  │  │  ├─ Backlog
│  │  │  ├─ Active
│  │  │  └─ Cycles
│  │  └─ Backend
│  └─ Settings
│
└─ Main (剩余)
   ├─ Tab/Filter bar (顶部 60px, 含视图切换 list/board/timeline)
   └─ Content (剩余, 无次级 sidebar)
```

**Tandem 当前 IA**:
```
Tandem 当前 IA (略复杂):
┌─ Sidebar
│  ├─ 召唤面板 / Dashboard
│  ├─ IM (im)
│  ├─ Docs
│  ├─ Calendar
│  ├─ OKR (cycles / cascade / calibration / calendar)
│  ├─ Convergence (议事室)
│  ├─ Memory
│  ├─ Boss AI
│  ├─ Learning
│  ├─ ... (~20 顶层入口)
```

**学习**: Linear **顶层只有 ~8 个固定入口** + Teams 折叠. Tandem 顶层 20+ 容易迷路.

**P1 行动**: `components/app-shell/sidebar.tsx` 分组:
- **Today** (Dashboard / Inbox / 今日议事)
- **Workspaces** (IM / Docs / Calendar)
- **OKR Hub** (折叠: cycles / cascade / calibration / calendar / forecast)
- **Decisions** (Convergence / Memory)
- **AI** (Boss AI / Persona / Learning)
- **Admin** (折叠)

### 1.4 Tandem 应学 (具体到文件)

| # | 学什么 | 落到哪 | 工期 |
|---|---|---|---|
| 1 | ⌘K 扩展到 100+ commands (含跳 OKR / 改 KR / 发议事) | `components/command-palette.tsx` 重写 + 各页注册 contributors | 1 周 |
| 2 | g+letter 全站二段键 (g+i=inbox, g+o=okr, g+c=convergence) | `components/keyboard-shortcuts.tsx` 已起步, 扩展 | 2 天 |
| 3 | 顶层 IA 分组 (Today/Workspaces/OKR Hub/...) | `components/app-shell/sidebar.tsx` 改 | 2 天 |
| 4 | react-virtual 全站长列表 (IM thread 已有 → 扩展到 OKR cascade / Memory list) | 各 list page | 3 天 |
| 5 | Triage Inbox 范式 (优先级排序 + 一键归类) | `/inbox` 升级 | 3 天 |

---

## 2. Notion AI + Notion 工作区 — 块编辑器 + 内联 AI

### 2.1 功能细节

| Notion 的细节 | 当前 Tandem | gap |
|---|---|---|
| **/ 命令唤起块 (heading/list/toggle/code/table/embed)** | 文档编辑器还基础 | 🔴 缺 |
| **@提及人 / @提及文档 / @提及 OKR (Universal @)** | `composer` 有 @ 但仅人 | 🟠 加 @KR / @doc / @memory |
| **AI ":: 帮我..." 块内联** (选中文本 → "Improve writing / Translate / Summarize") | 无 | 🔴 缺 (高 ROI) |
| **数据库视图: Table / Board / Calendar / Timeline / Gallery 5 选** | KR/Task 只有 list | 🟠 加视图切换 |
| **数据库 filter + sort + group + 公式列** | OKR list 简单过滤 | 🟠 加 |
| **页面权限: workspace/private/restricted/shared link** | docs 走 permissions{read,write} 但 UI 弱 | 🟠 加 share dialog |
| **Wiki 自动反链** (引用某页 → 该页显示 backlinks) | 仅 spawnedDecisionCardId 反链 | 🟠 加 universal backlink |
| **Templates marketplace** (1000+ 模板) | 无 | 🟠 OKR 模板有 (3+1 起草) |
| **AutoFill / Smart Connections** | 无 | 🟢 (Memory 升级签批是替代) |

### 2.2 技术架构

| 维度 | Notion | Tandem | 借鉴 |
|---|---|---|---|
| **block model** | tree of blocks (uuid + parent + type + properties + children) | doc.content = plain text + ydoc | 🔴 大重构 (P2) |
| **realtime** | OT + WebSocket | Yjs (CRDT) | 🟢 我们更先进 |
| **search** | Elasticsearch + Postgres FTS | drizzle Postgres FTS | 🟡 加 vector |
| **AI inline** | OpenAI + Claude (用户选 model) | TAF router 多 provider | 🟢 一致 |
| **mobile** | RN | Tauri desktop, web mobile | 🟡 v1 web responsive |

**关键学习**: Notion 的 **block model** 是它 Wiki 沉淀的核心 — 每段都是可独立引用 / 移动 / 转换的对象. Tandem 当前 doc 是 plain text, 文档→议事的反链只有"整篇关联", 没法"段落级关联". P2 可考虑迁块模型 (但要权衡 Yjs CRDT 复杂度).

### 2.3 页面架构

```
Notion 工作区 IA (2 层):
┌─ Sidebar
│  ├─ Search        ← 全站 ⌘P / ⌘K
│  ├─ Updates       ← 通知
│  ├─ Settings
│  ├─ Templates
│  ├─ Trash
│  └─ Workspaces (折叠)
│     ├─ Private (个人)
│     └─ Shared (团队)
│        └─ 任意嵌套页面树 (无限层)
│
└─ Main (单页布局, 极简)
   ├─ 顶栏: breadcrumb + share + ... 菜单
   └─ 内容: 块编辑器 (无次级 nav)
```

**关键差异**: Notion **整个产品就是嵌套页面** — 所有功能都通过"在某页里加某块"实现. Tandem 是 **多产品聚合** (IM/Doc/Cal/OKR/...) — 适合企业协作, 但每次跳产品有切换成本.

**Tandem 不该走 Notion 单产品路径** — 我们是 OKR OS, 多产品是必须. **但可以学**: 文档 / 议事 / Memory 之间用**统一块引用** (`@@kr_xxx`, `@@doc_xxx:section_3`, `@@memory_xxx`) 让任何文本都能跨产品 deep link.

### 2.4 Tandem 应学

| # | 学什么 | 落到哪 | 工期 | ROI |
|---|---|---|---|---|
| 1 | **/ 命令唤起块** (heading/list/code/quote/embed/divider) | `components/editor/slash-menu.tsx` 新建 | 3-4 天 | ★★★★ |
| 2 | **AI 内联 ::命令** (选中 → Improve/Summarize/Translate/转议事卡片) | `components/editor/ai-inline-menu.tsx` 新建 | 2-3 天 | ★★★★★ |
| 3 | **Universal @ 提及** (人 / KR / Doc / Memory / Decision Card) | `components/composer.tsx` 扩展 mention provider | 2 天 | ★★★★ |
| 4 | **数据库视图切换 (Table/Board/Calendar)** for OKR + Tasks | `app/okr/cascade/page.tsx` + `app/tasks/page.tsx` 加 view selector | 3 天 | ★★★ |
| 5 | **Universal Backlinks** (任何对象被引用都 surface) | `lib/services/backlink-index.ts` 新建 | 1 周 | ★★★ |
| 6 | **OKR / 议事 模板 marketplace** | `app/templates/page.tsx` + okr-bulk-create 复用 | 1 周 | ★★ |

---

## 3. Claude Projects + Claude Code

### 3.1 功能细节

| Claude 的细节 | 当前 Tandem | gap |
|---|---|---|
| **Projects: 上传 200K+ token 知识库 + 跨对话保留** | Persona memory 是 ephemeral | 🟠 加 Persona Projects |
| **Custom Instructions (System Prompt 持久化)** | Persona profile 部分实现 | 🟡 已类似 |
| **Artifacts** (右侧栏 live preview 代码/markdown/svg/react) | 无 | 🔴 缺 (UX 革命) |
| **Computer Use** (autonomous screen + mouse + keyboard) | 无 | 🟢 不在战略 |
| **Claude Code** (terminal coding agent) | 不接 (战略红线之外) | 🟢 跳过 |
| **Connectors** (官方: Google Drive / Slack / GitHub / Jira / Linear / Asana / Salesforce / Zapier / MCP) | 自研 MCP Bridge V2 (mode=live) | 🟢 V2 在做 |
| **MCP (Model Context Protocol)** 官方标准 | 已接入 mock + live mode (V2-#13) | 🟢 同步 |
| **Audit Logs API** (admin export) | 自研 audit chain | 🟢 已有 |
| **SOC 2 Type II + ISO 27001** | 待认证 | 🔴 上线后必做 |
| **Cross-conversation Memory** (Sept 2025 新功能) | Memory 4 层 + 三级签批 | 🟢 我们更治理化 |
| **Computer use API + Code Execution Tool** | 无 | 🟢 不做 |
| **Skills (Custom Skills marketplace)** | Persona Skills (V2) | 🟢 V2 在做 |

### 3.2 技术架构 (从开发者 docs 看 Anthropic 的栈)

| 维度 | Anthropic Claude | Tandem | 借鉴 |
|---|---|---|---|
| **prompt caching** | ✅ 原生 (Anthropic API ephemeral cache 5min) | ✅ 已实现 (lib/taf/provider/anthropic + 测试) | 🟢 |
| **streaming** | SSE + tool_use deltas | SSE + tool-loop | 🟢 |
| **structured output** | JSON schema strict | ✅ `lib/taf` json_schema + 测试 | 🟢 |
| **multi-turn tool loop** | 原生支持 (auto-loop) | `lib/agent-runtime/tool-loop.ts` | 🟢 |
| **MCP server** | 官方 SDK (npm `@modelcontextprotocol/sdk`) | mcp-bridge V2 加载 SDK | 🟢 |
| **Skills marketplace** | 公开 + private skills | Persona Skills + Skill Gateway 4 闸 | 🟢 (治理更强) |
| **Artifacts protocol** | XML 标签 (`<antartifact>`) + 右侧栏渲染 | 无 | 🔴 P1 加 |

### 3.3 页面架构

```
claude.ai (极简单页, AI-first):
┌─ Sidebar (240px)
│  ├─ + New chat
│  ├─ Recents (聊天列表)
│  ├─ Projects
│  ├─ Starred
│  └─ Settings
│
└─ Main
   ├─ Top: model selector + share
   ├─ Center: Chat (无限滚动)
   └─ Right: Artifacts panel (条件渲染, 出现时主区压缩)
       ├─ Code preview + Run
       ├─ Markdown preview
       └─ SVG / React component preview
```

**关键学习**:
- **Artifacts 范式** 让 AI 输出从"一段 markdown 文本"升级到"可交互的对象" — 看一眼就懂 + 可改可保存. Tandem 的 Boss AI / Persona 都该有类似 panel.
- **Projects** 是 Claude 的 **轻量级知识 namespace** — 比 Tandem 的 Memory 4 层签批轻量 100×. 适合"私人项目知识"场景 (个人草稿 / 小团队工作集). Tandem 应该补一层 "**Project**" 在 Memory 4 层之外.

### 3.4 Tandem 应学

| # | 学什么 | 落到哪 | 工期 | ROI |
|---|---|---|---|---|
| 1 | **Artifacts 右侧栏** (Boss AI / Persona 回复带可渲染对象) | `components/boss-ai/artifact-panel.tsx` + protocol 设计 | 1-2 周 | ★★★★★ |
| 2 | **Persona Projects** (轻量 Memory namespace, 不走三级签批) | `lib/persona/projects.ts` + table | 1 周 | ★★★★ |
| 3 | **MCP 官方 SDK 接入** (而非 mock) | `lib/agent-runtime/mcp-bridge.ts` 已 mode=live, 接 `@modelcontextprotocol/sdk` 真依赖 | 3 天 | ★★★ |
| 4 | **Connector permission UI** (每个 MCP server 单独 toggle + scope 编辑) | `app/settings/connectors/page.tsx` 新建 | 1 周 | ★★★ |
| 5 | **Custom Instructions = Persona profile UI 升级** | `app/persona/profile/page.tsx` | 3 天 | ★★ |

---

## 4. Coze 企业版 + Coze Studio (开源)

### 4.1 功能细节

| Coze 的细节 | 当前 Tandem | gap |
|---|---|---|
| **可视化 workflow 节点编排** (drag & drop, 类似 N8N) | 无 (我们走 Persona Skills) | 🟢 不走可视化, 走 Persona Skills + Decision Card |
| **知识库 (RAG)** 上传 PDF / 网页 / 自定义切片策略 | Memory 4 层有, RAG 雏形 | 🟠 加切片策略 UI |
| **Plugin marketplace** (1000+ 第三方插件: 高德/天气/翻译/...) | 战略红线: 不接外部 plugin | 🟢 跳过 |
| **多模态: 图 / 视频 / 音频生成** | 无 | 🟢 v1 跳过 |
| **Coze Loop 评测台** (prompt 版本化 + A/B 测试 + 评分) | `tests/unit/evals-runner.test.ts` 21 测试基建 | 🟡 加 UI |
| **Bot 调试器** (变量 inspector + token 估算 + 实时调用链) | 无 | 🟠 加 Persona debugger |
| **多渠道发布** (飞书/微信/Web/API) | 战略红线: 仅 Tandem 自有 + 中性 IM Gateway | 🟢 跳过飞书/微信 |
| **企业治理** (审计 / 配额 / 权限 / 团队) | 已有 (audit chain + RBAC) | 🟢 |
| **Agent Group** (多 Agent 协作) | Persona 单一 + Sub-agent (V2) | 🟠 |
| **HiAgent (字节内部 BI 助手)** | 无类似 | 🟢 不做 |

### 4.2 技术架构 (从 Coze Studio 开源代码看)

Coze Studio 2025 开源 (Apache 2.0), 关键栈:

| 维度 | Coze Studio | Tandem | 借鉴 |
|---|---|---|---|
| **lang** | Go (backend) + React (frontend) | TypeScript (Next.js full-stack) | 🟢 我们更同构 |
| **workflow engine** | DAG 节点 (LLM/Code/Knowledge/HTTP/Condition/...) | `lib/workflows/engine.ts` event-driven | 🟡 不同范式 |
| **knowledge** | Milvus 向量库 + 多种 embedding | drizzle + pgvector | 🟢 我们更轻 |
| **plugin SDK** | OpenAPI / Python / NodeJS | MCP + Persona Skills | 🟢 走 MCP 标准 |
| **prompt版本化** | 内置 | 无 | 🟠 P1 加 |
| **trace** | 调用链可视化 | audit chain | 🟡 加 visualizer |

### 4.3 页面架构

```
Coze 工作台 (开发者向):
┌─ Top nav: Workspace / Bots / Plugins / Knowledge / Workflows / Library
├─ Sidebar (workspace 切换 + 团队)
└─ Main
   ├─ Bot Builder (3 列):
   │  ├─ Left: 配置 (prompt / variables / capabilities)
   │  ├─ Center: workflow 节点画布
   │  └─ Right: Preview chat + debugger
   └─ Knowledge Builder:
      └─ 上传 / 切片 / 索引 / 测试检索
```

**关键差异**: Coze 是 **开发者工作台** — 用户是 prompt engineer / 开发者. Tandem 是 **业务员工 + 管理层** — 用户不需要画 DAG.

**学习**: Coze Loop **评测台** 范式很值得学 — 它是 prompt 工程的 IDE. Tandem 的 evals-runner 基建已有 (21 单测), 但**缺 UI** — admin 看不到 prompt 在哪些场景效果好/差.

### 4.4 Tandem 应学

| # | 学什么 | 落到哪 | 工期 | ROI |
|---|---|---|---|---|
| 1 | **Evals UI** (admin 视角看 prompt 在各场景 win rate / latency / token) | `app/admin/evals/page.tsx` 新建 | 1 周 | ★★★★ |
| 2 | **Knowledge 切片策略 UI** (上传 PDF → 选切片粒度 / overlap / 索引模型) | `app/memory/builder/page.tsx` | 1 周 | ★★★ |
| 3 | **Persona Debugger** (开发期: 变量 inspector + tool call trace + token 估算) | `app/persona/[id]/debug/page.tsx` | 1 周 | ★★★ |
| 4 | **Prompt 版本化 + Diff** (改 prompt 走 PR-like review) | `lib/persona/prompt-versions.ts` + UI | 1.5 周 | ★★ |
| 5 | **Agent Group** (3+1 议事中多 Persona 协同提案) | `lib/decision-layer/multi-persona.ts` | 2 周 | ★★ |

---

## 5. Microsoft Copilot Cowork + Copilot Studio

### 5.1 功能细节

| Microsoft 的细节 | 当前 Tandem | gap |
|---|---|---|
| **Copilot Pages** (canvas: 多人 + 多 Agent 同时编辑) | 协同文档有 (Yjs), 但 AI 不是"协作者"角色 | 🟠 P1 加 AI as collaborator |
| **Loop components** (跨 Outlook/Teams/Word 同步对象) | 议事卡片 spawnedFrom 反链类似 | 🟢 |
| **Catalog** (中央 Agent 商店) | 无 | 🟠 |
| **Custom GPTs / Agent marketplace 内部** | Persona Skills 类似但弱 | 🟠 加 marketplace UI |
| **M365 全家桶集成** | 战略红线: 不集成 | 🟢 跳过 |
| **Power Platform 集成** (Power BI / Power Automate) | 无 | 🟢 跳过 |
| **Viva Goals (OKR)** | 已退役 (2025-12), 给我们窗口 | 🎯 战略机会 |
| **Microsoft Graph 数据底座** | 自研 Tandem Atlas (CENTRAL-AI-ARCHITECTURE.md) | 🟢 自有 |

### 5.2 技术架构

| 维度 | Microsoft | Tandem | 借鉴 |
|---|---|---|---|
| **底座** | Microsoft Graph (所有 M365 数据统一 API) | Tandem Atlas (CENTRAL-AI-ARCHITECTURE) | 🟢 |
| **Agent runtime** | Copilot Studio (low-code) + AI Builder | Persona + Skill Gateway | 🟢 |
| **realtime** | Fluid Framework (CRDT) | Yjs (CRDT) | 🟢 |
| **search** | Microsoft Search (Graph + Bing) | Postgres FTS + pgvector | 🟡 加 vector |
| **identity** | Entra ID (Azure AD) | 自研 auth + scrypt | 🟢 |

### 5.3 页面架构 (Cowork canvas)

```
Copilot Cowork Pages (2025-11 新):
┌─ Pages 列表 (sidebar)
└─ Page Canvas (单页):
   ├─ Top: title + 协作者头像 + 加 Agent 按钮
   ├─ Middle: 块编辑器 (类似 Notion) + AI 块 inline
   │   └─ 任意位置可 "@Sales Agent draft outreach email"
   └─ Right: Agents panel (条件渲染)
       ├─ 已加入 Agent 列表
       └─ 每个 Agent 的输出 inline 插入 page
```

**关键学习**:
- **AI 作为协作者** (不是工具栏按钮, 而是和人平级的 collaborator) — 这是范式转移. Tandem 议事室已经有"4 个 Persona + 真人" 平级范式, 但**文档没有**.
- **Catalog** (中央 Agent 商店) — Tandem 应该有 `/persona/catalog` 让所有 Persona 集中展示 + 一键添加到任意议事/文档.

### 5.4 Tandem 应学

| # | 学什么 | 落到哪 | 工期 | ROI |
|---|---|---|---|---|
| 1 | **AI as collaborator** 范式落到文档 (Yjs awareness 加 Persona 角色) | `lib/docs/yjs-persona-cursor.ts` + 编辑器 | 1 周 | ★★★★ |
| 2 | **Persona Catalog** 中央商店 | `app/persona/catalog/page.tsx` | 3-4 天 | ★★★ |
| 3 | **文档内联 AI 块** (Notion + Copilot 都有, 必加) | 与 Notion 学习项重叠 | — | ★★★★★ |
| 4 | **Universal data graph** (Tandem Atlas 升级到 Microsoft Graph 级 API) | `lib/atlas/api.ts` | 2 周 | ★★ (长线) |

---

## 6. 综合学习清单 (Tandem 90 天可落地)

按 **ROI ÷ 工期** 排序的 Top 20:

| # | 学什么 | 来源 | 工期 | 落到哪 | ROI |
|---|---|---|---|---|---|
| 1 | **AI 内联 ::命令** (选中 → Improve/Summarize/翻译/→议事卡片) | Notion / Copilot | 2-3 天 | `components/editor/ai-inline-menu.tsx` | ★★★★★ |
| 2 | **Artifacts 右侧栏** (Boss AI 输出可交互对象) | Claude | 1-2 周 | `components/boss-ai/artifact-panel.tsx` | ★★★★★ |
| 3 | **AI as collaborator** (Yjs awareness 加 Persona 角色, 文档/议事/IM) | Copilot Cowork | 1 周 | `lib/docs/yjs-persona-cursor.ts` | ★★★★★ |
| 4 | **顶层 IA 分组** (Today/Workspaces/OKR Hub/Decisions/AI/Admin) | Linear | 2 天 | `components/app-shell/sidebar.tsx` | ★★★★★ |
| 5 | **/ 命令块编辑器** (heading/list/code/embed/divider/AI block) | Notion | 3-4 天 | `components/editor/slash-menu.tsx` | ★★★★ |
| 6 | **Universal @ 提及** (人 / KR / Doc / Memory / Decision Card) | Notion / Linear | 2 天 | `components/composer.tsx` mention provider | ★★★★ |
| 7 | **⌘K 扩展 100+ commands** (跳 OKR / 改 KR / 发议事 / 全文档) | Linear | 1 周 | `components/command-palette.tsx` 重写 | ★★★★ |
| 8 | **g+letter 全站二段键** | Linear | 2 天 | `components/keyboard-shortcuts.tsx` | ★★★★ |
| 9 | **数据库视图切换** (Table/Board/Calendar) for OKR + Tasks | Notion | 3 天 | `app/okr/cascade` + `app/tasks` | ★★★★ |
| 10 | **Triage Inbox 范式** (优先级排序 + 一键归类) | Linear | 3 天 | `/inbox` | ★★★★ |
| 11 | **Persona Projects** (轻量 Memory namespace) | Claude | 1 周 | `lib/persona/projects.ts` + table | ★★★★ |
| 12 | **Evals UI** (prompt win rate / latency / token) | Coze Loop | 1 周 | `app/admin/evals/page.tsx` | ★★★★ |
| 13 | **Persona Catalog** 中央商店 | Copilot | 3-4 天 | `app/persona/catalog/page.tsx` | ★★★ |
| 14 | **Universal Backlinks** (任何对象被引用 surface) | Notion | 1 周 | `lib/services/backlink-index.ts` | ★★★ |
| 15 | **react-virtual 全站长列表** (Memory / cascade) | Linear | 3 天 | 各 list page | ★★★ |
| 16 | **Knowledge 切片策略 UI** (上传 PDF + 切片粒度) | Coze | 1 周 | `app/memory/builder/page.tsx` | ★★★ |
| 17 | **Persona Debugger** (变量 / tool call / token 估算) | Coze | 1 周 | `app/persona/[id]/debug` | ★★★ |
| 18 | **Connector permission UI** (MCP server 单独 toggle + scope) | Claude | 1 周 | `app/settings/connectors/page.tsx` | ★★★ |
| 19 | **Prompt 版本化 + Diff** | Coze | 1.5 周 | `lib/persona/prompt-versions.ts` | ★★ |
| 20 | **OKR / 议事 模板 marketplace** | Notion | 1 周 | `app/templates/page.tsx` | ★★ |

**90 天预算分配建议** (按 ★ 数量加权):
- **Week 1-2**: #1 (AI 内联) + #4 (IA 分组) + #6 (Universal @) + #8 (g+letter) = **5★+5★+4★+4★ = 18★**
- **Week 3-4**: #2 (Artifacts) + #5 (/ 命令块) — 这两个一起做最高效 (块编辑器 + AI 块)
- **Week 5-6**: #3 (AI as collaborator) + #7 (⌘K 重写)
- **Week 7-8**: #9 (数据库视图) + #10 (Triage)
- **Week 9-12**: #11-13 (Persona Projects / Evals / Catalog)

总计可拿 18 项, 平均每项 1 周, 90 天约 12-13 周, 时间充裕.

---

## 7. 三条永久红线 (借鉴不能逾越)

无论学什么, 必须守:

1. **不集成飞书 / 钉钉 / 企业微信** (战略红线)
2. **不破坏 4 件不变量** (OKR XOR / 17min 上限 / D humanOnly / Memory 三级签批)
3. **不引入"AI 给最佳建议"哲学** (我们是 3+1, AI 给参考, 员工原创)

例: Notion AI "Improve writing" 直接覆盖用户文本 — Tandem 应该改为"建议旁边显示, 用户选择采纳" (符合 D humanOnly 哲学).

例: Coze 的 "best Agent recommendation" — Tandem 应该走"4 套全景图" (符合 3+1 哲学).

---

## 8. 修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1 创建. 5 个核心竞品 × 4 维度 (功能/技术/页面/学习清单) 深度对比. 综合学习清单 20 项 + 90 天预算分配. |
