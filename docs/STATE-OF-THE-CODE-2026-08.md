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
`tsc` 干净 · `vitest` 286 files / 2478 passed · 2 skipped · 0 failed · UI Charter 0 违规 · 内链 0 悬空/304 路由 · docs 索引同步 · `build` 全绿 · 部署三件套对齐。

---

## 三、关键修复：从 `stash@{4}` 找回全部丢失工作

对账时发现恢复到 `main` 后 **tsc 报 194 处错误**（`lib/types/pms` 缺 `Quote/QuoteStatus`、`drizzle-schema` 缺 comp 表、`im/service` 缺 `emitTyping/forwardMessages`、`eval/service` 缺 `runPassK` …）。根因：并行窗口把 **API 消费方**提交了，但对应的 **lib/类型/schema 更新是未提交工作**，切 `nexus-main` 前被 `git stash` 存成了 `before-nexus-checkout` 系列。

**`stash@{4}`（on main, 基线 = 当前 HEAD）** 即完整、自洽的丢失工作，共 ~140 文件，覆盖 pms/im/eval/comp/mail/okr/kpi/persona 等全部报错域。

恢复动作（已执行）：
1. 丢弃我手工重做的冗余邮箱补丁（`email-tier1`/`page.tsx`/`package.json`/`INDEX`），因它们只是 `stash@{4}` 的子集。
2. `git stash apply "stash@{4}"` —— **零冲突**干净落地（`apply` 保留 stash 作为备份）。
3. 清除 `email-tier1.ts` 中一处重复的 `getUnreadCount`（手工补丁与 stash 版重叠）。

**结果（全绿）**：
- `npx tsc --noEmit` → **Tandem 0 error**（残留仅 `qm/`，非 Tandem）。
- `npx vitest run` → **286 files / 2478 passed · 2 skipped · 0 failed**。
- 邮箱能力完整落地：详情页 DOMPurify 清洗 + 远程图阻断（P0 安全闭合）、分类标签页/优先级收件箱、`saveDraft`(html/cc/bcc/replaceUid+去重)、撰写端 Bcc、`app-rail` 未读角标、`/api/mail/unread` 角标轮询等。

## 四、待决 / 风险（体系层）

- **未提交即风险**：本次全部工作目前仍是**工作区未提交状态**（来自 stash apply）。并行窗口再次切分支会再度丢失 → **强烈建议立即 `git add -A && git commit`** 固化。
- **两项目串台**：`nexus-main`(Rhautt Nexus) 与 Tandem 无共同祖先，建议拆仓（见 §一）。
- **StratOS 阻塞**：`StrategyOS/` 是 blobless partial clone，工作树被清空，需 `github.com` 网络 `git restore .` 才能还原（当前网络超时）。
- **商业化 P4**：`lib/storage/tenant-scope.ts`（多租户查询隔离）已开工，属目标形态能力，自用阶段可暂缓。
- **未跟踪目录**：`StrategyOS/`、`qm/`（`qm/` 有独立 tsc 报错，非 Tandem，勿混入构建）。
