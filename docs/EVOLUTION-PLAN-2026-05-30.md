# Evolution Plan · 2026-05-30 PT

> **缘起**: 2026-05-30 整体复盘后, 识别 19 项技术债 + 战略短板 + 2 项新需求, 整合为单一进化路线。
> **本文档地位**: §3 节点会落到 `STATUS.md` 与 backlog, 不另开 PROGRESS。
> **冲突优先级**: 与 `MANIFESTO.md` / `CHARTER-*.md` 冲突时以宪章为准 (回本文打补丁)。

---

## 0. 本轮 (2026-05-30) 已落地

| ID | 主题 | 状态 |
|---|---|---|
| **P0-UI** | UI Charter §1.2 字体硬合规 (text-size warn→error + 37 文件 snapshot allowlist) | ✅ 已 ratchet |
| **P0-UI+** | §1.3/§1.7 阴影 + 圆角同步提 error + snapshot | ✅ 已 ratchet |
| **P1-3+1** | `<ThreePlusOneSelector>` 通用渲染组件 | ✅ 落 `components/decision-layer/` |
| **P1-3+1** | `/api/me/brief-options` 端点 + `RecommendCard` 接 `generatePersonaBriefOptions()` | ✅ 落 |
| **P1-3+1** | `AuditAction` 补 `persona_brief.options_generated` / `option_picked` | ✅ 落 |
| **P3-DL** | `scripts/check-deeplinks.mjs` 内链存在性扫 (258 路由 / 0 悬空, 1 allowlist) | ✅ 落 |
| **P2-CLEAN** | `.gitignore` 加固 (dev*/live*/.tmp-*/.selfcheck-*) + 清 50 个 root tmp 文件 | ✅ 落 |
| **P2-DOCS** | `docs/INDEX.md` 全目录 + 标 STATUS.md 为 SSOT | ✅ 落 |
| **P1-HANDOFF** | `/tandem` deliver → 3 目标页消费器 (`hooks/useHandoffPrefill.ts` + `consumeHandoff` 纯函数 + 9 case 单测) | ✅ 落 |
| **P2-DOCS-CI** | `scripts/check-docs-index.mjs` (扫 docs/ vs INDEX.md, --strict gate) + 补登 6 条遗漏档案 | ✅ 落 |
| **P3-G** Stat 组件 (Stripe 风) | `components/ui/stat.tsx` + `lib/format/stat.ts` (整数/小数/百分比/货币 + delta 箭头 + sparkline + tabular-nums) + 17 单测 | ✅ 落 |
| **P3-E-tabs** PageTabs Apple Music 弹性 underline | `components/page-tabs.tsx` 改为 `absolute` 指示条 + ResizeObserver + iOS spring (`var(--ease-emphasis)`) | ✅ 落 |
| **P3-F** Motion 语言 charter rule | `check-ui-charter.mjs` 加 `no-raw-motion-duration` (warn + snapshot allowlist 7 文件 / 12 违规, 待清零提 error) | ✅ 落 |
| **P1-CAL-FIX** `/calendar` 主入口修复 | 删 95 行 demo CRUD + hardcoded `demo-user`, 改成 `redirect('/okr/calendar')` (charter §五 CAL-1 兑现) | ✅ 落 |
| **P1-DOC-2** 文档→Memory 升级 (charter §四 飞书做不到 #1) | `lib/services/document-promotion.ts` + `/api/documents/[id]/promote-to-memory/route.ts` + 文档详情页升级按钮 + 反链 chip + 8 单测 | ✅ 落 |
| **P1-DOC-4-v0** 文档→议事 stub (charter §四 飞书做不到 #2) | 文档详情页"发起议事"按钮 + URL 信号 (`/convergence?fromDocId=...&fromDocTitle=...`) + 反链 chip; convergence 端消费待下一 PR | ✅ 落 (前端 stub) |
| **P3-G-rollout** Stat 铺到 3 个数字密集页 | `app/okr/dashboard` (4 KpiCard → 4 Stat) + `app/admin/kpi/health-dashboard` (顶栏 4 inline badge → 4 Stat 行) + `app/insights` (4 严重度 button 内置 Stat 排版, 加 aria-label 保证 a11y) | ✅ 落 |
| **P3-G-rollout-2** Stat 铺到 `/admin/kpi/analytics` | 公司整体 4 卡片 (KPI 总数/bonus/bonus 加权完成率/公司层级加权完成率) → 4 Stat | ✅ 落 |
| **P3-skel** Skeleton 升级 brand-tinted shimmer | `globals.css` `.skeleton` (linear-gradient + brand-50 50% 高光 + 1.6s shimmer) + `Skeleton` 组件加 `variant=text/circle/card` + `SkeletonGroup` 复合骨架 (avatar+lines) | ✅ 落 |
| **P3-cheat** `?` 全局快捷键速查表 (Linear-class) | `components/keyboard-shortcuts.tsx` 实装 (5 分组: 导航/命令面板内/议事/IM/辅助 · ⌘/↑/↓/↵ icon 渲染 · `<input>` 内不触发 · soon 标记未实装) | ✅ 落 |
| **P3-F-clean** Motion 12 条清零 → charter rule 提 error | 7 文件清零 (im/report/animated-hero/mobile-drawer/mobile-tab-bar/right-pane/voice-input-button), allowlist 0 条, severity warn → error (再加新债 PR 即打回) | ✅ 落 |
| **P3-G-rollout-final** Stat-class typography 升级 | `app/kpi/page.tsx` `StatCard` + `app/admin/governance/okr-drift/page.tsx` `Kpi` (保持 `value: string` 兼容 caller, 升级到 text-title-2 + tabular-nums + ink hierarchy) | ✅ 落 |
| **P1-M1** 响应断点 ratchet rule | `check-ui-charter.mjs` 加 `requires-responsive-layout` (51 文件 snapshot allowlist · severity error · 阻止移动端破碎扩散) | ✅ 落 |
| **D1** Tauri 跨平台打包 | `tauri.conf.json` 加 `dmg/appimage/deb` 目标 + macOS minSystemVersion + linux deb config + category/longDescription | ✅ 落 (打包验证待 macOS/Linux 环境) |
| **P1-OKR-BULK** AI 批量创建 OKR v0 (vs Tita 2025 H2 #1 缺口) | `lib/services/okr-bulk-create.ts` (505 行: 4 选项 SOP/REASONING/HISTORICAL/ORIGINAL · 启发式模板匹配 · LLM 推演 + 降级 · D 选项 humanOnly 强制) + `/api/okr/bulk-create/options/route.ts` + 21 单测 (含 mock router LLM 路径). UI dialog 留下一 PR | ✅ 落 (服务层 + API + 测试) |
| **STRATEGY-FIX** 钉钉/企微/飞书集成 从 P0 缺口 → 战略红线 (永不接) | 修 3 份关键文档: `OKR-VS-TITA.md` v2.1 §11 / `PITCH-LAUNCH-2026-05-30.md` §13 / `OKR-FEATURE-MATRIX.md` 11.1. 原因: 他们是直接竞品, 接 = 变插件. Tita 的死路就是深接三家. | ✅ 落 |
| **P1-OKR-FORECAST** KR 季末预测 (vs Tita 2025 #缺口) | `lib/okr/trend.ts` 加 `forecastKr` (最小二乘线性回归 + R² 置信度 + 三级风险 on-track/at-risk/off-track) + `forecastObjective` (按风险排序) + reasoning 文本 + 13 单测 (覆盖 0/1 条降级 / clamp / 波动大警告 / 风险阈值边界) | ✅ 落 (服务层 + 测试) |
| **P0-LAUNCH-DEMO-USER** 22 处 demo-user 清零 (上线最后阻断) | 7 个生产页 (skills/learning, report, notifications, meetings, drive, documents, convergence) 改用 `useCurrentUserId()` hook + `/api/notifications/badge` 改要求 userId param (不再 fallback 到 demo-user). 21 处残留全是有意 fixture/seed/select 选项, 已审计 | ✅ 落 (上线 P0 解锁) |
| **PITCH-SCRIPT** 12 分钟演讲稿 | `docs/PITCH-SPEAKER-SCRIPT-2026-05-30.md` (8 段 + 6 类 Q&A + 演示动作 + 场地准备清单 + 战略红线 §7) | ✅ 落 |

**度量**: tsc 0 / vitest 357 pass + 1 pre-existing fail (agent-runtime-v2 live SDK, 与本轮无关) / charter ratchet --strict 0 violation / deeplink 0 悬空 (260 路由) / docs-index 0 unlisted 0 dangling (85/85 文档登记)。

---

## 1. P1 (本季度内必做)

### 1.1 `lib/store.ts` 89KB 拆 slice
**问题**: 单文件 Zustand → 改一字段触发全应用 rerender, IDE 卡, tsc 慢。
**目标**: 拆为 `lib/store/{ui-prefs,launchpad,im,documents,...}.ts`, 每片 ≤10KB, 用 `create()` 独立 slice。
**步骤**:
1. 用 `find lib/store.ts` 切 4-6 业务边界
2. 每片单文件, 顶层 `useUIPrefs() / useLaunchpadStore() / ...`
3. 改消费方 import (有 N 处, 改完跑 tsc + 290 tests)
4. 删 `lib/store.ts` barrel, 留个 deprecated re-export 兜底一周
**风险**: 中. 影响全部, 但 tsc + tests 兜底。
**工作量**: 1.5-2 天 (单 session 可完成第一刀)。
**负责**: 等指派。

### 1.2 `lib/im/service.ts` 40KB 拆 sub-module
**问题**: 890 行单文件, 14 个 API 都 import 它。
**目标**: 拆 `lib/im/{channels,messages,reactions,spawn-room,promote-to-memory,agent-mode,baseline-guard}.ts`。
**步骤**: 同 1.1, 单文件先 barrel re-export, 再逐步消费方迁。
**工作量**: 1-1.5 天。

### 1.3 `lib/showcases.ts` 40KB 拆
**问题**: 单文件, fixture 数据 + 业务 utils 混。
**目标**: fixture 与 utils 分离, fixture 进 `lib/fixtures/showcases/{topic}.ts`。
**工作量**: 0.5 天。

### 1.4 drizzle-store × in-memory-store **contract test**
**问题**: 两个 store 接口对齐, 但实现可能漂移 (in-memory 边界处理 vs drizzle SQL nuance)。
**目标**: 用同一组 fixture 跑两个 store, 输出必须**逐字段**一致。
**实现**:
- 新建 `tests/contract/store-contract.test.ts`
- 表驱动: 每个 repo (memories/decisionCards/personas/...) 跑 CRUD + filter + edge case
- 两个 store 实例 (in-mem + drizzle SQLite 内存模式)
- 输出 diff 即 fail
**工作量**: 1-2 天 (首轮覆盖 5-8 个最高频 repo)。

### 1.5 ~~`/tandem` handoff 消费器~~ ✅ (2026-05-30 落地, 见 §0)
- 实装: `hooks/useHandoffPrefill.ts` (导出纯函数 `consumeHandoff()` + React hook 壳)
- 消费方: `app/mail/page.tsx` (compose 预填 subject/body + 切 tab) / `app/memories/page.tsx` (起 startNewMemory 预填 title+content) / `app/im/page.tsx` (打开 CreateChannelDialog 预填 name+topic)
- 协议: 生产者 `app/tandem/page.tsx:495`, 键 `tandem.handoff.{im|mail|memory}`, payload `{ title, body, from }`
- 单测: `tests/unit/handoff-prefill.test.ts` 9 case (正常/缺字段/非法 JSON/private mode/不串扰)
- 待 P2: e2e Playwright case 跑全链路

### 1.6 UI 测试覆盖率 (Playwright e2e + Vitest UI smoke)
**问题**: 290 cases 全在 lib/. UI 几乎 0 覆盖, Playwright case 数未知。
**目标**:
- Playwright 覆盖前 10 个核心 user flow (登录 / 进 /tandem / 发议事 / 签字 / 议事 17 分钟 / Memory 升级 / BossAI 问 / 主分身 brief / IM 转议事 / 复盘)
- 关键组件 (ThreePlusOneSelector / SignatureWidget / VetoWindow) 加 vitest snapshot
**工作量**: 2-3 天首轮。

### 1.7 3+1 通用化补完 4 个剩余 scenario
当前已接: `persona_brief`. 剩 4 个 adapter 等业务接入 (P1-b/P1-c/P2/P2):

| Scenario | Adapter (已就绪) | 业务接入点 | ROI |
|---|---|---|---|
| `tti_breakdown` | `lib/decision-layer/adapters/tti.ts` | `/api/tti POST` + `/tti` 创建 UI | **高** (TTI 是 OKR 闭环大头) |
| `report_extract` | `report.ts` | `/api/ai/extract-daily-report` (已存在 LLM 调用, 改成 4 选项) | **高** (5min 日报每日触发) |
| `weekly_retro` | `weekly-retro.ts` | `/retros` 创建 UI | 中 (周触发) |
| `learning_qa` | (待补 adapter) | `/learning/lesson/[id]` 答题反馈 | 低 |

**每个**: 0.5-1 天 (adapter 已就绪, 主要接业务)。

### 1.8 反向 DAU 度量 ("决议产出周环比")
**问题**: MANIFESTO §序言反 DAU 度量, 但缺**反向**度量 (员工进步可视)。
**目标**:
- 度量定义: 单员工/团队/公司 7d 议事提交数 / 决议命中数 / TTI 推进数 / Memory 入库数
- 看板: `/insights?view=decision-pace` (现有 /insights 加 tab)
- 数据源: 已存在的 `DecisionCard` + `audit_log`
**工作量**: 1-2 天。

### 1.9 AI Cost 透明度看板
**问题**: `LlmUsageLog` 落了 (2026-05-27), `app/admin/usage/page.tsx` 已存在。审一遍:
- 团队级 token / cost / 模型分布
- 月环比 / 预警阈值
- 已支持 → 仅做 UX 检查 (无新工作)
**工作量**: 0.5 天检查 + 0.5 天补缺口。

### 1.10 Promotion SLA 延误可视化
**问题**: `promotion-flow` 三级签批延误几乎必然发生。
**目标**:
- `/memories?filter=mine-pending` 加红/黄/绿 SLA 标记
- 超期 ≥ 3 天自动逐级 escalation 提醒 (现 `memory.promotion_overdue_lv3` audit 已有, 接 UI)
**工作量**: 0.5-1 天。

---

## 2. P2 (本月内做)

### 2.1 CI/CD build matrix
**问题**: 有 `.gitlab-ci.yml` 2.7KB 但单 job. 没 `.github/workflows`。
**目标**:
- GitLab CI: tsc / vitest / playwright / check-ui-charter / check-deeplinks 5 job 并行
- 失败自动评论 MR
**工作量**: 0.5 天 (gitlab) + 0.5 天 (github mirror)。

### 2.2 Portfolio 离职导出 (D12 实装审计)
**问题**: PLATFORM-ARCH §D12 写了"加密包归属本人", 实装未审。
**目标**: 端到端跑一次"假离职"流程:
- 触发: 用户在 /portfolio 点"导出"
- 输出: PDF + 加密 zip (含 Memory / 决议 / 代表作)
- 个人邮箱 + 公司归档双链
**工作量**: 2-3 天 (如果未实装)。

### 2.3 lib/types/index.ts barrel 拆
**问题**: barrel 让 tsc 一次性加载所有 type, 慢且不利 tree-shaking。
**目标**: 不再从 `@/lib/types` re-export, 直接走子文件 (`@/lib/types/memory`)。
**步骤**:
1. 加 lint: `no-restricted-imports` 禁 `@/lib/types`
2. 用 codemod 或 grep 改全部 import
3. 删 `lib/types/index.ts`
**工作量**: 半天。

### 2.4 `skills/` vs `lib/skills/` 改名消歧
**问题**: 两个目录, 一个是 skill 产物定义, 一个是运行时, 新人易混。
**建议**:
- `skills/` (产物) → `skill-packages/`
- `lib/skills/` (运行时) → `lib/skill-gateway/` (已有, 整合)
**工作量**: 半天 + grep replace + tsc。

### 2.5 自动化 `scripts/check-docs-index.mjs`
**问题**: `docs/INDEX.md` 维护是人肉, 容易漏。
**目标**: 扫 docs/*.md 与 INDEX.md 出入, pre-commit gate 卡新 .md 未登记。
**工作量**: 1 小时。

---

## 3. P3 (季度内有时间就做)

| ID | 主题 | 备注 |
|---|---|---|
| P3-A | `app/intranet/archive/page.tsx` 补建 (`check-deeplinks` allowlist 已记) | 0.5 天 |
| P3-B | UI primitives `components/ui/*` 重写, 让 charter 自动 lint 也卡 (而不是 allowlist) | 1-2 天 |
| P3-C | 90 文件 charter allowlist 清零 (按周清 10 文件 → 9 周) | 每周 0.5 天 |
| P3-D | `eslint-plugin-tandem-ui` 替代 `check-ui-charter.mjs` (IDE 内即时反馈) | 1-2 周 |
| P3-E | Hero (§1.6) / Stage (§1.7) 自动化扫脚本 | 1 天 |
| P3-F | `--duration-*` / `--ease-*` 替换 raw tailwind transition | 半天 |

---

## 4. 不做 (明确拒绝)

| 提议 | 拒绝理由 |
|---|---|
| 增加 DAU/MAU 度量 | MANIFESTO §序言已否决 |
| AI 替员工签字 | MANIFESTO §15 / G1 护栏 |
| 中央 AI 读 IM/邮箱原文 | G2 数据红线网关 |
| 把 Tandem 改成"飞书 AI 加强版" | CHARTER-FOUR-PILLARS 立项之初已否决 |
| 让 ThreePlusOneSelector 三选项不要 D (员工原创) | MANIFESTO §2, D 不可缺 |

---

## 5. 估算总览

| 优先级 | 项数 | 工作量上限 | 工作量下限 |
|---|---|---|---|
| P1 | 10 | 17 天 | 11 天 |
| P2 | 5 | 7 天 | 4 天 |
| P3 | 6 | 7+ 周 | 持续 |

> **节奏建议**: P1 跑完约 3 周, P2 嵌入做 1 周, P3 转入日常清单。

---

## 6. 单次推进的 commit 节奏

每次推进 (无论谁动), 必须满足:

1. `npx tsc --noEmit` → 0 error
2. `npx vitest run` → 0 fail
3. `node scripts/check-ui-charter.mjs --strict` → exit 0
4. `node scripts/check-deeplinks.mjs --strict` → exit 0 (或更新 allowlist 并写明)
5. pre-commit gate 3 步全过

如要 `--no-verify`, **必须**在 commit message 解释"为什么绕"。

---

## 7. 维护本文件

- 每次 ship 一项: 把 §1/§2/§3 对应行移到 §0 (本轮已落地)
- 新识别的债: 加到 §1 末尾 (P1) 或 §2 (P2)
- 拒绝项: 加到 §4 (并引用宪章条款)
- 月底归档: 整个文件改名为 `EVOLUTION-PLAN-2026-06.md`, 重启
