# Tandem · 项目总览 (Project Overview)

> 本文件是 Tandem 的**权威单页总览**。当其它文档 (尤其 `README.md` / `PITCH-DECK.md`) 与本文冲突时，
> 以**战略锚点**为准。锚点分两层 (见 §二 二者并存 · 分阶段):
> - **当前阶段执行**: `docs/SELF-USE-FIRST.md` (自用路径) > `docs/OKR-DRIVEN-ARCHITECTURE.md` / `docs/MANIFESTO.md`
> - **目标形态架构**: `docs/PRD.md` / `docs/UNIFIED-TECH-DESIGN.md` / `docs/MASTER-UPGRADE.md` (200-1000 人生产级交付)

最后更新: 2026-06-20

---

## 一、一句话定义

**Tandem (牛马搭子) = Owner 自有"产研销一体企业"的内部 OKR 驱动型协作 AI 平台。**

- **北极星**: 不让 AI 替员工对老板撒谎，也不让老板用 AI 把员工挤干。
- **第一性原理**: 为 OKR 达成 / 战略执行而活 —— 任何任务必须可回溯到当前 OKR。

---

## 二、战略定位 (二者并存 · 分阶段)

> **2026-06-02 Owner 裁定**: Tandem 定为 **200-1000 人生产级交付产品** (`MANIFESTO.md` §17 sweet spot)。但落地路径仍走**自用优先**——不是降级，而是把生产级当作**目标形态**，把自用当作**当前阶段验证路径**。两者并存，不矛盾。
>
> **2026-06-20 Owner 裁定 (宪章 v2.1)**: 新增宪章 **§21 四大刚需模块必须超越品类标杆** (搭子手抄>Notion/Get · 邮箱>Gmail/Outlook · IM>企业微信 · OKR>Tita) · **§22 中央 AI = 企业级驱动器** · **§23 200 人工程级架构是基本要求 (不可妥协)**。详见 `docs/MANIFESTO.md` 文末修订日志。

### 当前阶段 (路径) — 自用优先

- 对标字节内部飞书 (2016–2020 自用 4 年再对外)、Slack/Notion/Linear/GitLab 的"先内部验证再开放"路径。
- Owner 公司全员即真实用户群，用真实工作数据喂养、为真实同事服务。
- **阶段过关标准** (达到全部 = 可推进对外交付):
  - 公司 70%+ 同事每周打开 ≥ 3 次，持续 3 个月
  - 80%+ OKR / 议事 / 1on1 在 Tandem 完成
  - 50%+ 同事主动训练 Persona
  - 至少 3 个具体的"省时间"故事
- **当前真正该做的 Top 5**: 生产部署+HTTPS+备份 / 行为埋点 / CI / 内部成本看板 / 同事 Onboarding。详见 `docs/SELF-USE-FIRST.md`。

### 目标形态 (终局) — 200-1000 人生产级交付产品

- **目标客户** (`MANIFESTO.md` §17): 50-3000 人民营企业 (sweet spot 200-1000)，7 类行业 (互联网/SaaS/跨境/文娱/教育/消费/创意)；不进政企/国企/金融监管类。
- **生产级三大架构决策** (`PRD` + `UNIFIED-TECH-DESIGN.md` + `EVOLUTION-CHECKLIST-FULL.md`):
  - **Persona 双层架构**: 本地 Hermes (Ollama/GPU) + 云 DeepSeek 双层路由 + 离线 degraded 模式；多数民企无 GPU，提供**全云 fallback** (PRD §9 风险登记已列)。
  - **TandemNode 统一原语**: 取代 `repository.ts` 按类型分仓，让知识 4 层 (Origins→Materials→Memory) = 同一原语 type 跃迁 + 签批。独立专项、高风险大重构。
  - **Skill Gateway 深度兑现**: 完整 Capture 层 (IDE 插件 / 邮件 webhook / 文档元数据) + `runSkillGateway` 真接入生产。
- **GTM / 销售 / 私有租户**: 见 `docs/PRD.md` §9（属目标形态规划，自用阶段尚不执行）。

### 过渡纪律

- 自用阶段验证的功能闭环 → 生产级交付前必须通过"防假闭环断言" (用户→存储→生产 LLM 注入→audit)。
- 当 `SELF-USE-FIRST.md` (自用路径) 与 `PRD`/`MASTER-UPGRADE.md` (目标形态) 表述冲突时：**当前阶段执行以 `SELF-USE-FIRST.md` 为准；终局架构以 `PRD`/`UNIFIED-TECH-DESIGN.md` 为准**。

---

## 三、四大核心机制

| 机制 | 一句话 | 反滥用设计 |
|---|---|---|
| **议事室 (Convergence)** | 17 分钟硬上限闭环，AI 给 3 选项 + D 选项必须人写 | D 占比是反 AI 欺诈 / 防挤干的早期信号；COMMIT→24h 否决窗 |
| **拿捏老板分身 (Persona)** | 5 阶段 (🥚新手→🐉拿手) 永不跳级 | autonomy 升阶必须**员工本人 consent**；薪资/法律/裁员永久红区 AI 强退 |
| **双轨 KPI × TTI** | KPI 挂钩奖金 (100% 合格)；TTI 成长度永不挂钩金钱 | 9 宫格识别"KPI 高 TTI 低 = 疲于奔命的螺丝钉" |
| **Memory 三级签批 + AI 反向降级** | 知识库靠淘汰而非累积 | 低引用率条目 AI 主动建议降级/归档，库每年自然瘦身 |

---

## 四、架构

```
┌─ 应用层 ──────────── Next.js 14 (App Router) + React 18 + Tailwind (严格 design-token)
│
├─ 思考层 (自建 TAF) ── · 议事室 orchestrator (17min 闭环 state-machine)
│                       · Persona 进化 (5 阶段守门)
│                       · Memory 三级签批 + 降级扫描
│                       · 3+1 决议引擎 (baseline-guard + constitution + OKR 三层)
│
├─ 中央治理 ──────────  CompanyBrain + Skill Gateway 4 道闸:
│                       ① Baseline-Guard ② OKR Drift ③ Data Scope ④ Action Scope
│                       (所有外部个人 AI 调用经此层约束)
│
├─ Runtime ──────────── DeepSeek V3 (主) + 本地兜底 · 真流式 SSE
│
└─ 持久化 ──────────── Drizzle ORM + PostgreSQL (私有部署) · 审计链 hash
```

**§13 员工尊严 4 铁律 (技术兜底, 不可绕过)**: 导出权 / 匿名化 / 否决权 / 拒绝代笔。

**§22/§23 (宪章 v2.1)**: 中央 AI 是**企业级驱动器** (既是 4 道闸守边界, 也是主动驱动经营的引擎, 但驱动必经 `proposeAction`); **200 人工程级架构是不可妥协基线** (租户隔离零信任 / 安全 P0 零容忍+对抗性测试 / list 下推)。

---

## 五、信息架构 (导航)

**Hub + 页内 Tab 范式** (重模块二级栏只放少数 Hub 入口，子页收进内容区顶部横向 tab，按角色过滤):

| 模块 | 结构 |
|---|---|
| OKR | 我的目标对齐 / 5 层级联树 / 校准会 / 日历 / 日报周回顾 / 洞察分析 |
| Tandem | 议事室 / 会议室 / **决议台账** |
| 知识 | 文档 / 企业 Memory / 知识图谱 / 多维表格 / 云盘 (扁平，5 个独立功能) |
| 拿捏 (4 Hub) | 我的分身 / 自我画像与成长 / 学习中心 / 外部 AI 接入 |
| 管理 (6 Hub) | 用户权限 / KPI 设置 / 中央 AI 治理 / 内容管理 / 系统运维 / 工程参考 |
| KPI | 平衡记分卡 (BSC 四维) + 月/季/年 as-of 时点回看 |
| 反馈 | 1on1 / 360 / 9 宫格 |
| 协作 | IM / 邮件 |

实现: `components/nav-modules.ts` (NavItem.tabs) + `components/hub-tabs.tsx` + `app/layout.tsx`。

---

## 六、技术栈 (代码实况)

- **前端**: Next.js 14 · React 18 · TypeScript · Tailwind (严格 design-token，**禁 raw Tailwind 调色**) · shadcn/ui · Zustand
- **持久化**: Drizzle ORM + PostgreSQL (`drizzle/` migrations, `drizzle.config.ts`)
- **桌面**: Tauri v2 (Rust, `src-tauri/`) · 同一 UI 双运行时
- **LLM**: DeepSeek V3 主 + 本地兜底 · 真流式 SSE
- **测试**: vitest (722/722 通过) · Playwright e2e · CI (`.github/workflows/`)
- **一键生产引导 (Day 1)**: `npm run db:seed:production` 建立真实非 mock、不带员工的公司级 KPI 基准
- **一键硬盘资料投喂 (本地/生产)**: `npm run db:import:local -- "D:\你的本地资料夹"` 递归扫描并自动将 Word/Excel/PPT/PDF/TXT 资料深度解析并投喂为 Document + 个人 Memory 供 AI 吸收
- **生产反代支持**: `deploy/Caddyfile.example` 宿主机 1 分钟 HTTPS 反代，提供完全符合安全上下文的离线 PWA 运行环境

详细登录/服务/账号见 `docs/` 与本仓 memory。dev: `npm run dev` (PORT=3005)。

---

## 七、UI 设计宪法 (不可妥协)

- 组件**只用 L3 语义类** (`.text-title-*` / `.shadow-soft-*` / `.surface-*` / `.hero-ink` / `.glass` 等)，禁 raw `bg-slate-*`/`text-amber-*`/Tailwind 默认 shadow。
- Stage 配色唯一走 `STAGE_META.tone → TONE_TOKENS`。
- 心智模型: Hero=Vercel+Apple Music，内容卡=Notion+Stripe，命令面板=Linear。
- 细则: `docs/CHARTER-UI-V1.md` · 实现 SSOT: `app/globals.css` · TS 层: `lib/design-tokens.ts`。

---

## 八、关键文档索引

| 文档 | 用途 | 权威度 |
|---|---|---|
| `docs/SELF-USE-FIRST.md` | 当前阶段战略锚点 (自用路径) | 最高 (阶段执行) |
| `docs/PRD.md` / `docs/MASTER-UPGRADE.md` | 目标形态 (200-1000 人生产级交付) + GTM | 最高 (终局规划) |
| `docs/UNIFIED-TECH-DESIGN.md` / `docs/EVOLUTION-CHECKLIST-FULL.md` | 生产级三大架构 (Persona 双层 / TandemNode / Skill Gateway) | 高 |
| `docs/OKR-DRIVEN-ARCHITECTURE.md` | OKR 驱动架构 (与 MANIFESTO 同级) | 高 |
| `docs/MANIFESTO.md` | 顶层承诺 (含 §17 sweet spot) | 高 |
| `docs/CHARTER-UI-V1.md` | UI 设计宪章 + 违规事故档案 | 高 |
| `docs/PROJECT-OVERVIEW.md` | 本文 (单页总览) | 高 |
| `PITCH-DECK.md` | 旧 SaaS 商业化口径 | **慎用 (口径偏旧)** |
| `README.md` | 工程入门 (已于 2026-05-31 重写为 Tandem 口径) | 中 |

---

## 九、诚实提示 (文档漂移)

- **阶段 vs 终局**: `SELF-USE-FIRST.md` 写"商业化是远期可选项"，描述的是**当前阶段路径**；`PRD.md`/`MASTER-UPGRADE.md` 的 GTM/销售/私有租户描述的是**目标形态**。两者并存不矛盾 (见 §二)，但 GTM 章节在自用阶段尚不执行。
- `PITCH-DECK.md` 的"四、商业"章节口径偏旧，以 `PRD.md` §9 GTM 为准。
- `REFLECTION-2026-05.md` / `META-REVIEW-2026-05-27.md` 含 SaaS 创业语境判断，已被 `SELF-USE-FIRST.md` 推翻或重排，不要照搬。
