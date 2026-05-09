# Tandem (牛马搭子) · 产品需求文档 (PRD)

> **版本**: v0.2 (2026-05-07 修订)
> **状态**: V1 PoC 已完成代码骨架, 待生产化部署
> **历史**: v0.1 (2026-05-07 早期草稿) 见 `PRD-v0.1-archive.md`
> **修订人**: 拿捏团队
> **同栈文档**: MANIFESTO · CONVERGENCE-PRINCIPLE · TTI-FRAMEWORK · KNOWLEDGE-ARCHITECTURE · PERSONA-EVOLUTION · AUTH-NATIVE

---

## 0. 一句话定位

> **Tandem (牛马搭子)**: 让 17 分钟达成共识的 AI 协作伙伴.

不是 IM, 不是 Jira, 不是又一个 OKR 工具. **它是企业的"决议操作系统"** — 让员工和老板共享同一个 AI 分身, 在结构化议事室里完成 80% 的日常决议, 同时把组织的隐性知识沉淀为可复用资产.

---

## 1. 核心修订: v0.1 → v0.2

| 维度 | v0.1 (草稿) | v0.2 (实施) |
|---|---|---|
| **品牌** | 拿捏 Enterprise | Tandem (牛马搭子) |
| **技术栈** | NestJS (TS) + circles-bot (Python) | Next.js 14 全栈 TypeScript |
| **AI 编排** | LangGraph 风格 + circles-bot | TAF (Tandem Agent Framework) 4 层架构 |
| **核心单元** | OKR 群 + 周报 | **DecisionCard** (决议卡, 17min 5 步流程) |
| **决策机制** | 自动 Check-in + 群聊承载 | **3+1 选项** (SOP/推演/历史/原创) + 24h 否决 |
| **AI 分身** | 通用 Persona Agent | **5 阶段进化** (newborn→partner) + 学习钩子 |
| **绩效评估** | OKR + 健康度 | **OKR + TTI 双轨** + 9 宫格人才矩阵 |
| **知识管理** | 4 层记忆 (org/team/agent/local) | **4 层架构** (Origins/Materials/Memory/Baseline) + 三方签批 |
| **身份系统** | SSO 优先 (企微/飞书) | **自研为主** (Native Auth) + SSO 辅助 |
| **数据存储** | Postgres + Qdrant + Kafka | Postgres + pgvector + SSE (V1 简化) |
| **部署形态** | 私有 + SaaS | **私有化优先**, 客户完全控制数据 |

---

## 2. 北极星指标 + 价值主张

### 2.1 北极星

> **每个决议平均成交时长 ≤ 17 分钟**, 且 **决议否决率 ≤ 15%** (员工真心认同), 且 **D 选项使用率 ≥ 20%** (员工保持原创力)

### 2.2 三大差异化

```
1. 17 分钟决议室    — 杜绝无效会议, 用结构化框架强制收敛
2. 拿捏老板分身    — 5 阶段进化, 学老板风格代老板做事 (员工本人有否决权)
3. 议事文化沉淀    — 决议→Material→Memory 三方签批, 知识资产化
```

### 2.3 反差异化 (我们不做什么)

- ❌ 不做通用 IM (Rocket.Chat 集成即可)
- ❌ 不做项目管理 (Jira / Linear 已经够好)
- ❌ 不做"全自动决策" AI (永远人在环, 24h 否决窗口)
- ❌ 不让 AI 起草高敏内容 (薪资 / 法律 / 投诉 强制员工亲自处理)

---

## 3. 系统架构 (实施版)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js 14 App Router                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /convergence  /persona/evolution  /nine-box  /admin/*    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                  Server Components + Server Actions              │
│                  + Route Handlers (Edge / Node)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
┌────────────────────── 业务层 (lib/) ────────────────────────────┐
│                                                                  │
│  ┌─ Convergence ──────────────────────────────────┐              │
│  │ state-machine · orchestrator · stall-detector   │              │
│  └─────────────────────────────────────────────────┘              │
│                                                                  │
│  ┌─ Persona ────────────────────────────────────────┐            │
│  │ evolution · learning-collector · communication-   │            │
│  │ mimicry · proxy/meeting-proxy                     │            │
│  └────────────────────────────────────────────────────┘          │
│                                                                  │
│  ┌─ Memory ────────────────────────────────────────┐             │
│  │ promotion-flow (三方签批) · retriever · steward   │             │
│  └─────────────────────────────────────────────────┘              │
│                                                                  │
│  ┌─ Auth (Native) ─────────────────────────────────┐             │
│  │ password · session · mfa · invite · bootstrap   │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                  │
│  ┌─ TAF (AI 编排, 4 层) ───────────────────────────┐             │
│  │ Layer 1-2: Provider/Router (5 模型场景路由)      │             │
│  │ Layer 3: Skills Registry (CircleBot 对齐)        │             │
│  │ Layer 4: Agent Spawn (fork/fresh/parallel)       │             │
│  │ Cross:    Budget Tracker (token 守门)            │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                  │
│  ┌─ Audit (链式 hash) ─ Realtime (SSE) ─ MultiTenant ─┐          │
│  └────────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────── Storage 抽象 (lib/storage/repository.ts) ─────────────┐
│  V1: InMemoryStore (开发)   V2: PrismaStore (生产)               │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌─────────────────── 数据 / 集成 / OSS ───────────────────────────┐
│  PostgreSQL+pgvector  ·  MinIO  ·  Rocket.Chat  ·  Cal.com       │
│  Email IMAP/SMTP  ·  Yjs+Tiptap  ·  Univer  ·  腾讯会议          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. 功能模块详解

### 4.1 议事室 (DecisionCard) ★ 核心

**5 步状态机** (`lib/convergence/state-machine.ts`, 宪章 §3 字面对齐):
```
ALIGN(2min) → FRAME(3min) → DIVERGE(5min) → CONVERGE(4min) → COMMIT(3min)
                                                          ↓
                                             ESCALATED  ←  17min 硬上限
                                             VETOED     ←  24h 否决窗口
```

每步**软预算**导出为 `STEP_BUDGET_SECONDS` 常量, 总和 = 17min 硬上限 (单元测试守护).
硬上限闭环: `boot.ts` 启动 30s tick 循环, 调用 `orchestrator.checkStalls()` 真触发 ESCALATE 事件 (不是只发信号).

**3+1 选项框架**:
- A: SOP (公司既定标准操作)
- B: AI 推演 (LLM 综合分析)
- C: 历史案例 (类似决议匹配)
- D: 员工原创 (`humanOnly: true`, AI 不可代写)

**强制守门**:
- 缺 D 选项 → 自动 ESCALATE 给主管
- 17min 超时 → 自动 ESCALATE
- COMMIT 后 24h 内任何参与者可 VETO 撤回

**实时性** (`app/api/convergence/[id]/stream/route.ts`):
- LLM 流式生成 3+1, 用户能看到边写边出
- SSE event-bus 推送 stall / time-warning 信号

### 4.2 拿捏老板分身 (Persona) ★ 差异化

**5 阶段进化** (`lib/persona/evolution.ts`):

| 阶段 | Emoji | 时长 | 能力 | 升级条件 |
|---|---|---|---|---|
| newborn | 🥚 | 0-2w | 仅旁听 | 14 天 + 5 决议 |
| apprentice | 🐣 | 2w-2m | 代汇报 standup | 60 天 + 30 决议 + ≤40% 否决 |
| assistant | 🐤 | 2m-6m | 绿区会议表态 | 180 天 + 80 决议 + ≤25% 否决 |
| deputy | 🦅 | 6m-1y | 黄区代行 1 工作日动作 | 365 天 + 200 决议 + ≤15% 否决 |
| partner | 🐉 | >1y | 跨企业代行 (除红区) | autonomy 守门: 员工本人确认 |

**学习钩子** (`lib/persona/learning-collector.ts`):
- 每次 COMMIT/VETO 自动 ingest → 更新 `decisionHistory` + `styleProfile` + `bossCaptureScore`
- 风格特征: 决策速度 / 风险偏好 / 偏好选项 / 沟通示例

**代行边界** (`lib/persona/communication-mimicry.ts` + `proxy/meeting-proxy.ts`):
- 红区 (薪资/法律/投诉) **永远禁止 AI 代行**
- 黄区需员工授权 + 24h 否决窗口
- 绿区可自动代行, 但全程水印 `isProxy=true`

### 4.3 OKR + TTI 双轨 (`lib/types/okr-tti.ts`)

```
KPI (硬指标 - Objective+KR)        TTI (成长度)
↓                                   ↓
完成度 100%                         60-70% 健康
按部门/岗位                          按个人
挂钩奖金/调薪/末位                  挂钩述职/晋升/高潜/IDP
                                    超额完成 = 没挑战 (反信号)
                                    永不挂钩任何金钱回报 (宪章 §4)
```

**双轨铁律 (宪章第四条)**:
- TTI 完成度**不影响**任何形式的金钱回报 (含系数浮动)
- KPI 评分**不直接决定**晋升或高潜身份
- 任何"TTI 加成系数"或类似软挂钩设计 → **禁止**
- 一旦混淆 → 反 OKR 在中国异化的核心防御失守, 全盘崩塌

**9 宫格人才矩阵** (`app/nine-box/page.tsx`):
- 横轴: KPI 完成度
- 纵轴: TTI 完成度 (倒置 - 60-70% 最佳)
- 9 个 cell: star / rising_talent / steady_performer / ...

### 4.4 知识 4 层架构 (`docs/KNOWLEDGE-ARCHITECTURE.md`)

```
Origins (素材)         Materials (议题)        Memory (信仰)       Baseline (基线)
  ↓ 90 天保留          ↓ 永久                  ↓ 永久              ↓ 永久
会议录音/邮件/IM      格式化的话题/文档        SOP/Case/Redline     公司价值观
不入 Memory          Steward 把守入口        三方签批 + 公示期    强制注入每次 LLM
```

**Memory 三方签批** (`lib/memory/promotion-flow.ts`):
- BusinessLeader + Steward + CEO 全签
- 公示 7 天 (员工可异议) → 自动生效
- 紧急通道: CEO 当日签 + 24h 公示减半
- Steward 互斥: 利益相关方不可签字 (`steward.conflictWith`)

### 4.5 自研身份系统 ★ V1 主路径 (`docs/AUTH-NATIVE.md`)

**核心理念**: 数据归你, **身份也归你**. 私有化部署不依赖任何第三方平台.

| 模块 | 实现 |
|---|---|
| 密码 | scrypt + 强度策略 + 历史 hash 复用检查 |
| Session | 自研 JWT (HS256) + httpOnly cookie + 设备指纹 |
| MFA | TOTP RFC 6238 自研 + AES-256-GCM 加密 secret + 10 个恢复码 |
| 邀请 | hash + pepper, 96 bit 熵, B2B 老板邀员工 |
| Bootstrap | 首次启动自动建 owner (env 配置, 幂等) |
| 审计 | AuthEvent 链式日志 |

**SSO 作为辅助**: 钉钉/企微/飞书 OAuth 仅作为快捷登录, 不替代主路径.

### 4.6 TAF (AI 编排) ★ CircleBot 对齐

```
Layer 1: Provider          OpenAI 兼容协议封装 (DeepSeek/Qwen/豆包/Kimi/Hermes)
Layer 2: Router            场景化路由 (reasoning_complex/tool_use/agentic/...)
Layer 3: Skills Registry   工具检索 + 红区守门 + zone 分级 (绿/黄/红)
Layer 4: Agent Spawn       fork/fresh/parallel + waitAgent + 并发 tool calls
Cross:   Budget Tracker    单请求 / 单 Agent / 租户日 三层预算
```

**6 个内置 skills** + 业务模块可继续注册.

### 4.7 反 AI 欺诈 (MANIFESTO 第九条)

- D 选项强制员工原创 (`humanOnly: true`)
- AI 代行强制水印 (`isProxy=true`)
- 24h 否决窗口 (员工撤回权)
- 高敏关键词检测拒绝代笔 (`SENSITIVE_KEYWORDS`)
- 红区议题强制退出会议代参

---

## 5. V1 → V2 → V3 路线图 (修订)

### V1 PoC (2026 Q2 已完成代码骨架, ~12500 行)

```
✅ 14 篇战略文档锁定 (MANIFESTO + 12 子文档)
✅ 议事室 5 步状态机 + 17min 上限
✅ 3+1 选项 LLM 流式生成
✅ Persona 5 阶段 + 学习钩子 + 代行控制台
✅ OKR/TTI/9 宫格 数据模型 + UI
✅ Memory 三方签批 + Steward 工作台
✅ TAF 4 层 + 6 个内置 skills + Agent spawn + Budget
✅ 自研身份系统 (Native Auth + MFA + 邀请制)
✅ 14 个 OSS 集成接口 (RocketChat/MinIO/Cal.com/Email/...)
✅ E2E + Unit 测试骨架
✅ 等保二级 / GDPR / PIPL 合规清单
```

### V1 GA (2026 Q3, 6-8 周)

```
□ Prisma 接入 (npm i prisma + migrate, 1 天)
□ 真实 LLM API key 接入 (按用量 / 私有化)
□ docker-compose.tandem.yml OSS 全栈起来 + 烟测
□ /api/integrations/health 全绿
□ 业务流程 E2E 跑通: 注册 → 邀请 → 议事 → COMMIT → 否决
□ 法务 review (Cal.com / MinIO AGPL)
□ 等保二级评估启动 (周期 3 月)
□ 一家种子客户私有化部署 (友好客户)
```

### V2 商业化 (2026 Q4 - 2027 Q1)

```
□ 钉钉 / 企微 / 飞书任一上架
□ 多租户 SaaS 切面
□ Persona deputy 阶段公开
□ 腾讯会议 SDK 接入 (寄生)
□ WebAuthn / Passkey
□ 销售落地页 + 视频 demo + 3 个 logo 案例
□ Steward 培训 SOP
```

### V3 生态 (2027+)

```
□ Persona partner 阶段 (跨企业)
□ Tandem 作为 OIDC Provider (反向 IdP)
□ Memory marketplace (跨企业 SOP 交换)
□ AI Native 重构议事室 (不限 17min, 但保留质量信号)
□ 国密 SM2/SM3/SM4 支持 (政企客户)
```

---

## 6. 数据归属 (Manifesto 第十三条) ★ 销售故事核心

```
所有员工数据 (聊天/邮件/Persona/决议) 归 公司所有
但有 4 项强制保障:
  1. 导出权        员工随时下载个人原始数据
  2. 匿名化         离职后 Persona 强制匿名化
  3. 否决权         AI 代行决策 24h 内可撤回
  4. 拒绝代笔       高敏内容 AI 永不代写
```

技术上:
- 数据库 100% 客户私有 PostgreSQL (不上云)
- 自研身份 (无外部依赖)
- 自托管 OSS (Rocket.Chat / MinIO / Cal.com / 邮件)
- 离线运行 (本地 Ollama 也可作 LLM provider)

---

## 7. 核心非功能需求 (NFR)

| 项 | V1 目标 | V2 目标 |
|---|---|---|
| 议事室页面首屏 | < 2s | < 1s |
| LLM 3+1 生成 P50 | < 8s | < 5s |
| 并发议事室 | 100 / 实例 | 1000 / 实例 |
| 数据库 | InMemory + Prisma 切换 | Prisma + 读写分离 |
| 可用性 | 99% | 99.9% (SLA) |
| 安全 | 等保二级评估中 | 等保二级 + 三级 (政企) |
| 国际化 | 中文 | 中英双语 |

---

## 8. 验收标准 (V1 GA)

### 功能验收 (端到端流程)

```
1. 管理员 bootstrap 登录                  ✓
2. 在 /admin/invite 生成邀请码             ✓
3. 员工在 /register?invite=XXX 注册        ✓
4. 启用 MFA (扫 Google Authenticator)     ✓
5. 在 /convergence 发起议事 (LLM 流式 3+1) ✓
6. 选定 + COMMIT                           ✓
7. /persona/evolution 看到统计 +1          ✓
8. 在 24h 内行使否决 → VETOED              ✓
9. 7 天后自动复盘 → /memories 升级提议      ✓
10. Steward 工作台签字 → Memory 入库       ✓
```

### 安全验收

```
✓ 红区 skill (hr.salary_read) 拒绝 AI 代行
✓ 5 次密码错误账号锁 15min
✓ MFA 启用后无 TOTP 不能 access 高敏 API
✓ 链式 hash 审计日志不可篡改
✓ /api/integrations/health 探针全绿
```

---

## 9. 团队 + 预算 (12 人 / 14 月 / 1200 万 RMB)

参考独立文档 `docs/COST-MODEL.md` 与 `docs/MILESTONES.md`.

### V1 已完成 (本会话 + 战略阶段)

```
代码:   84 个 TS/TSX, ~12500 行
文档:   16 篇 (MANIFESTO + 12 战略子文档 + USER-GUIDE + AUTH-NATIVE + COMPLIANCE)
API:    24 个 endpoint
UI:     13 个 demo 页 (含 /login, /register, /admin/invite, /persona/evolution, ...)
测试:   2 个文件 (vitest + playwright)
依赖:   docker-compose.tandem.yml + .env.local.example 全配置
```

### 下一步关键路径

```
1. 法务 review AGPL 协议       (1 周)
2. Prisma 接入 + 真实数据流验证  (3 天)
3. 真实 LLM key 接入 + 成本测算  (1 周)
4. 私有化部署 SOP + 友好客户试用 (4 周)
5. 等保二级评估启动             (3 月)
6. 应用市场上架 (任一)           (4-8 周)
```

---

## 10. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| AGPL 协议 (Cal.com / MinIO) | 高 | 中 | 法务 review, 备选 SeaweedFS / 公有云 OSS |
| 腾讯会议 ISV 准入慢 | 高 | 中 | 提前 4 周 BD, V2 才依赖 |
| 应用市场审核长 | 高 | 低 | 平行提交三家, 不阻塞私有化 |
| 等保二级评估时长 | 高 | 中 | M3 启动, 不阻塞 V1 GA |
| LLM 成本失控 | 中 | 高 | TAF Budget Tracker 三层守门 |
| 客户对"分身"恐惧 | 中 | 高 | autonomy 守门 + 数据归属 4 项保障故事 |
| Persona deputy 阶段误代行 | 中 | 高 | 24h 否决 + 红区强退 + 全程水印 |

---

## 11. 决策日志 (重大架构变更)

| 日期 | 决策 | 替代方案 | 理由 |
|---|---|---|---|
| 2026-05-07 | 改名 Tandem | 拿捏 Enterprise | 国际化 + 中性 + 易传播 |
| 2026-05-07 | 全 TS, 砍 Python | NestJS+Python 双栈 | 团队同栈, 减少跨语言成本 |
| 2026-05-07 | TAF 自研 | LangGraph / circles-bot | 专为议事室场景设计, 更贴合 |
| 2026-05-07 | 自研身份为主 | NextAuth | 私有化 + 数据归属故事 |
| 2026-05-07 | 17min 硬上限 | 自由议事 | 强制收敛 + 反"会而不议" |
| 2026-05-07 | 3+1 框架 (D 必须人写) | 单选 / 多选 | 反 AI 欺诈 + 保留人的判断力 |
| 2026-05-07 | 9 宫格 KPI×TTI | 单 KPI | 双轨防止"完成 100% 没成长" |
| 2026-05-07 | Memory 三方签批 | 任意员工提交 | 防劣币驱逐良币, Steward 守门 |
| 2026-05-07 | **删除 TTI yearEndBonusModifier 字段** | v0.2 早期曾写入「软挂钩年终奖 ±10%」 | 直接抵触宪章 §4「TTI 不影响任何形式金钱回报 (含系数浮动)」. 修复: 类型 `affectsCompensation: readonly false`, API 不接受 bonus 字段, 移除 seed 数据, 同步 PRD §4.3 + USER-GUIDE. 选定方案: **以宪章为基准** (而非修改宪章) — 宪章是地基, PRD 在它之下展开. |
| 2026-05-07 | **议事室状态机重命名 + 拆步 + 时间预算** | v0.2 早期: `CONTEXT_GATHER → OPTION_GENERATION → DELIBERATION → CONVERGENCE → COMMIT` (5 步但与宪章字面不符) | 宪章 §3 明文 5 步: ALIGN/FRAME/DIVERGE/CONVERGE/COMMIT, 各 2/3/5/4/3 min. 修复: 重命名 + 拆 ALIGN/FRAME (原 CONTEXT_GATHER 折叠两步) + 合 DELIBERATION → DIVERGE 内部 + 导出 `STEP_BUDGET_SECONDS`. 测试守护: 五步预算总和必须 = 17min. UI 同步 `STEP_LABEL`. |
| 2026-05-07 | **17min 硬上限闭环 + 7 天复盘 cron** | 之前 stall-detector 只发 SSE + audit, 状态机不动 | `lib/boot.ts` 启动 30s tick 循环驱动 `orchestrator.checkStalls()`: 17min 真触发 ESCALATE 事件, 推动状态机. 同时启动 10min 间隔的 `scanRetrospectives()` 完成 PRD §8 验收第 9 步 (7 天后自动复盘). 生产环境替换为 cron / job queue. |
| 2026-05-07 | **Memory 三级签批门 (Lv1/Lv2/Lv3)** | 之前是单级"三方签批" (BusinessLeader+Steward+CEO), 团队 SOP 也要 CEO 签 → 不可行 | 宪章 §8.1: Lv1 团队级 (team_leader+steward, 3d) / Lv2 部门级 (dept_leader+steward+kr_owner, 5d) / Lv3 公司级 (ceo+clevel+steward, 14d). 实现: `PROMOTION_REQUIRED_ROLES` + `PROMOTION_SLA_DAYS` + `escalateOverduePromotions()` 自动 SLA 升级 (Lv1→Lv2→Lv3→通知治理委员会). 旧 V1 数据 (无 level) 默认按 'company' 处理向后兼容. API: `/api/tandem/memory/promotion`. |
| 2026-05-07 | **Memory 降级流程** | 宪章 §8.2 要求"严肃流程, 与升级同等", 之前完全缺失 | 新建 `MemoryDowngradeRequest` + `lib/memory/downgrade-flow.ts`. AI 触发 (引用率连续低于均值 30%) → Steward 评估 → 决议 (kept / revising / archived / historical_only). 严禁基于时间自动归档. cron: `scanLowReferenceMemories()` 10min 一次. API: `/api/tandem/memory/downgrade`. |
| 2026-05-07 | **Persona 自动升阶 (autonomy 守门)** | 之前只有 `checkUpgradeEligibility`, 没真自动升 → 员工要手动点 | 策略: newborn→apprentice / apprentice→assistant 静默自动升 (低风险阶段, 24h 否决保护); assistant→deputy / deputy→partner **必须员工本人确认** (黄区/跨企业代行扩张需 explicit consent, 写入 `growthAreas` 待 UI 暴露). cron: `scanPersonaUpgrades()` 10min 一次. API: `/api/tandem/persona/upgrade`. |

---

## 12. 引用与同栈文档

```
docs/
├── MANIFESTO.md                      18 条铁律 (产品哲学根)
├── PRD.md                            ★本文 (v0.2 修订)
├── PRD-v0.1-archive.md               历史草稿
├── CONVERGENCE-PRINCIPLE.md          议事室 5 步原理
├── TTI-FRAMEWORK.md                  TTI 双轨 60-70% 健康
├── KNOWLEDGE-ARCHITECTURE.md         4 层知识架构
├── PERSONA-EVOLUTION.md              5 阶段进化路线
├── MEETING-PROXY.md                  寄生腾讯会议
├── OKR-FEATURE-MATRIX.md             60+ OKR 功能
├── AUTH-NATIVE.md                    自研身份系统
├── COMPLIANCE-CHECKLIST.md           等保 / GDPR / PIPL
├── MARKETPLACE-SUBMISSION.md         应用市场上架
├── USER-GUIDE.md                     终端用户指南
├── COST-MODEL.md                     12 人 14 月预算
├── MILESTONES.md                     里程碑
└── progress.txt                      代码进度持续更新
```

---

**本 PRD 是 V1 的最终对齐版本**. 任何后续变更必须更新 §11 决策日志. 战略层文档 (MANIFESTO 等) 不可改, 本 PRD 在它们之下展开.

> "不做更多功能, 而是让每个决议在 17 分钟内有结果." — Tandem 团队
