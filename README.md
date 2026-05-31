# Tandem · 牛马搭子

> **Owner 自有"产研销一体企业"的内部 OKR 驱动型协作 AI 平台。** Web + 桌面同一套 UI。
> 北极星: *不让 AI 替员工对老板撒谎, 也不让老板用 AI 把员工挤干。*
>
> **完整总览见 [`docs/PROJECT-OVERVIEW.md`](docs/PROJECT-OVERVIEW.md)。战略锚点以 [`docs/SELF-USE-FIRST.md`](docs/SELF-USE-FIRST.md) 为准 (自用优先, 商业化是远期可选项)。**

## Stack

- **前端** — Next.js 14 (App Router) · React 18 · TypeScript · Tailwind (严格 design-token, 禁 raw Tailwind) · shadcn/ui · Zustand
- **持久化** — Drizzle ORM + PostgreSQL (`drizzle/` migrations, `drizzle.config.ts`) · 审计链 hash
- **思考层 (自建 TAF)** — 议事室 orchestrator · Persona 5 阶段守门 · Memory 三级签批+降级 · 3+1 决议引擎
- **中央治理** — CompanyBrain + Skill Gateway 4 道闸 (Baseline / OKR Drift / Data Scope / Action Scope)
- **LLM** — DeepSeek V3 主 + 本地兜底 · 真流式 SSE
- **桌面** — Tauri v2 (Rust, `src-tauri/`), 同一 UI 双运行时

## 四大核心机制

1. **议事室 (Convergence)** — 17 分钟硬上限闭环, AI 给 3 选项 + D 选项必须人写; COMMIT→24h 否决窗
2. **拿捏老板分身 (Persona)** — 5 阶段永不跳级, autonomy 升阶必须员工本人 consent, 红区 AI 强退
3. **双轨 KPI × TTI** — KPI 挂钩奖金 (100% 合格); TTI 成长度永不挂钩金钱; 9 宫格识人
4. **Memory 三级签批 + AI 反向降级** — 知识库靠淘汰而非累积

## 信息架构 (Hub + 页内 Tab)

OKR · Tandem (议事/会议/决议台账) · 知识 (文档/Memory/图谱/多维表/云盘) · 拿捏 (4 Hub) · 管理 (6 Hub) · KPI (BSC 四维 + 月/季/年 as-of) · 反馈 (1on1/360/9宫格) · 协作 (IM/邮件)

实现: `components/nav-modules.ts` · `components/hub-tabs.tsx` · `app/layout.tsx`

## Quick start

### Web (开发)

```powershell
npm install
npm run dev
# → http://localhost:3005  (dev 需 NODE_ENV=development)
```

- 数据库: 本机原生 PostgreSQL `localhost:5432/tandem` (`.env.local` 覆盖)
- Owner: `admin@tandem.local` + `.env.local` 的 `TANDEM_BOOTSTRAP_OWNER_PASSWORD`
- Demo 账号 (由 `scripts/seed-demo-users.mjs` 创建, 密码 `Demo1234!@#`): `employee@` / `manager@` / `hr@tandem.local`

### 测试

```powershell
npx vitest run        # 单元/集成 (722/722)
npx playwright test   # e2e
npm run lint:dead-code # 死代码巡检 (:strict 用于 CI)
```

### 资料批量导入与一键投喂 (新)

```powershell
# 批量递归导入本地硬盘中的 Word/Excel/PPT/PDF/TXT 资料
# 自动通过 Node 侧高效无损提取纯文本，双写创建为协作文档并投喂为个人 Memory，AI 瞬间直接引用学习！
npm run db:import:local -- "D:\SOPs-Folder"
```

### 桌面 (Tauri)

```powershell
npm run tauri:dev     # Rust + 前端 热重载
npm run tauri:build   # 打包 .exe (先停掉 npm run dev)
```

详见 [`DESKTOP.md`](DESKTOP.md) (MSVC Build Tools / WebView2 前置)。

## Project layout

```
app/            # Next.js App Router: 页面 + api/ Route Handlers
  ├── okr/ convergence/ meetings/ decisions/      # OKR + 议事
  ├── kpi/ 1on1/ 360/ nine-box/                   # 指标与反馈
  ├── persona/ learning/ summon/                  # 拿捏分身与成长
  ├── admin/ knowledge/ memories/ im/             # 管理 / 知识 / 协作
  └── layout.tsx                                  # AppRail + SubSidebar + HubTabs
components/     # ui/ (shadcn) + nav-modules.ts + hub-tabs.tsx + 业务组件
lib/            # agent-runtime/ persona/ memory/ decision-layer/ convergence/ retrospective/ …
drizzle/        # SQL migrations + meta
src-tauri/      # Rust 桌面外壳 (Tauri v2)
docs/           # 宪章/架构/总览 (权威: SELF-USE-FIRST > OKR-DRIVEN-ARCHITECTURE/MANIFESTO)
scripts/        # 运维/迁移/种子/巡检脚本
tests/          # unit/ integration/ e2e/
```

## UI 设计宪法 (不可妥协)

组件**只用 L3 语义类** (`.text-title-*` / `.shadow-soft-*` / `.surface-*` / `.hero-ink` / `.glass`), 禁 raw `bg-slate-*`/`text-amber-*`/Tailwind 默认 shadow。Stage 配色唯一走 `STAGE_META.tone → TONE_TOKENS`。
细则: [`docs/CHARTER-UI-V1.md`](docs/CHARTER-UI-V1.md) · 实现 SSOT: `app/globals.css` · TS 层: `lib/design-tokens.ts`。

## License

MIT
