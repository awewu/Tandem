# 代码现状整合汇总 · 2026-08-02

> **口径**: 本文是一次性"整合汇总"快照，记录 2026-08 并行开发窗口错乱后的恢复结论与体系化盘点。
> 权威总览仍见 `PROJECT-OVERVIEW.md`，状态点位仍见根 `STATUS.md`，本文是二者之间的一次对账。

---

## 一、事件与恢复结论（并行窗口 / git 错乱）

**结论：无代码丢失。**

同一 `e:\Hermes` 工作目录下混入了**两个无共同祖先的项目**（`git merge-base` 为空）：

| 分支 / 快照 | 文件数 | 内容 |
|---|---|---|
| `sprint3-recovery-wip` | 2433 | Tandem 最全最新（= `main` + 231 文件 / +31,693 行，纯增量） |
| `main` = `github/main` | 2202 | Tandem 稳定线 |
| `nexus-main` | 1677 | 另一项目 Rhautt Nexus（HVAC 平台），与 Tandem 无关 |

工作区一度停在 `nexus-main`，导致 Tandem 文件"看似被删"。

**恢复动作（已完成）**：
- `git checkout main`；`main` 经快进已包含 `sprint3-recovery-wip` 全部增量（`merge --ff-only` 报 Already up to date）。
- 关键文件已回到工作区（`app/mail/page.tsx`、`lib/mail/*`、`lib/pms/selector-engine.ts`、`tests/unit/tenant-scope.test.ts` 等）。
- 另有 6 个 `stash`（before-nexus-checkout ×5 + WIP ×1）作为额外保险，暂不清理。

**建议**：将 `nexus-main`（Rhautt Nexus）拆到独立仓库，避免并行窗口再次串台。始终加载的 `AGENTS.md` 描述的是 Rhautt Nexus，做 Tandem 时以 Tandem 宪章 + 项目记忆为准。

---

## 二、体系化盘点

### 产品定位
瑞合瑞德集团（产研销企业）一体化企业管理软件"牛马搭子"。战略为**二者并存·分阶段**：当前**自用优先**（`SELF-USE-FIRST.md`），目标形态**200–1000 人生产级交付**（`PRD.md` / `MASTER-UPGRADE.md`）。

### 宪章 SoT 优先级（`docs/INDEX.md`）
`MANIFESTO.md` → `CHARTER-UI-V1.md` → `CHARTER-FOUR-PILLARS.md` → `CHARTER-KPI-TTI.md` → `PLATFORM-ARCHITECTURE-2026-05-29.md` → `PRD.md` → `OKR-DRIVEN-ARCHITECTURE.md` → `CENTRAL-AI-ARCHITECTURE.md`。状态真相源 = 根 `STATUS.md`。

### 四大核心机制
1. 议事室 Convergence（17 分钟闭环，AI 给 3 选项 + D 选项人写，COMMIT→24h 否决窗）。
2. 拿捏老板分享 Persona（5 阶段进化，autonomy 永不越级，红区强退）。
3. KPI × TTI 双轨（KPI 挂奖金、TTI 不挂钱，九宫格识别螺丝钉）。
4. Memory 三级签批（ceo+clevel+steward）+ AI 反向降级。

### 技术架构
Next.js 14 App Router / 自建 TAF 思考层 / CompanyBrain 四道闸 Skill Gateway / DeepSeek V3 + 本地兜底 / Drizzle ORM + PostgreSQL(:5432) + 审计链 hash / Tauri v2 桌面。

### 代码规模（`STATUS.md` 实测）
app 页面 104 · API 路由 170 · 组件 100 · lib 模块 217 · TS/TSX ≈ 97,400 行。

### 质量门禁基线（2026-06-09 冲刺）
`tsc` 干净 · `vitest` 937 passed（后续 PMS 轮到 2408 passed）· UI Charter 0 违规 · 内链 0 悬空/304 路由 · docs 索引同步 · `build` 全绿 · 部署三件套对齐。

---

## 三、2026-08 邮箱攻坚现状（对账）

目标：补齐 Tandem 邮箱与 Gmail 的差距（P0 安全 / P1 撰写·搜索·标签 / P2 杂项）。

**已落库（`main`）**：
- 纯函数模块：`lib/mail/sanitize-html.ts`(111) · `search-query.ts`(130) · `categorize.ts`(123) · `rules.ts`(111)。
- 单测：`mail-sanitize`(如有) · `mail-search-query` · `mail-categorize` · `mail-rules` · `mail-search-filter`。
- API：`app/api/mail/unread/route.ts`（导航角标轮询）。
- 服务层：`lib/integrations/email-tier1.ts` 补回 `getUnreadCount`（修复 `unread/route.ts` 的导入构建断裂）。

**尚未接线（并行错乱期丢失、未进快照的"wiring"，待重做）**：
- `app/mail/page.tsx`：详情页 P0 `sanitizeEmailHtml` + 远程图阻断；撰写端 Bcc/附件/自动补全/工具栏；分类标签页 + 优先级收件箱；`parseMailQuery` 搜索接线；草稿自动保存/恢复/回撰写器；签名/模板/撤回发送/附件预览/键盘快捷键。
- `lib/integrations/email-tier1.ts`：`saveDraft` 升级（html/bcc/replaceUid + 去重）、`EmailMessage.cc` 字段、`fetchMessageByUid` 填充 cc。
- `app/api/mail/inbox/route.ts`（PUT 草稿）：接收 html/bcc/replaceUid。
- `components/app-rail.tsx`：邮件未读角标 + 轮询 + 新邮件 toast。

> **P0 安全提醒**：详情页仍以 `dangerouslySetInnerHTML` 直渲染 `htmlBody` 且加载远程图，`sanitizeEmailHtml` 已就绪但**未接线** → XSS/追踪像素风险仍在，应优先接。

---

## 四、待决 / 风险（体系层）

- **两项目串台**：建议拆仓（见 §一）。
- **邮箱 wiring 重做**：§三未接线项，按 P0→P1→P2 恢复。
- **商业化 P4**：`lib/storage/tenant-scope.ts`（多租户查询隔离）已开工，属目标形态能力，自用阶段可暂缓。
- **未跟踪目录**：工作区残留 `StrategyOS/`、`qm/`（`qm/` 有独立 tsc 报错，非 Tandem，勿混入构建）。
