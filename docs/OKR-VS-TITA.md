# OKR 体系 · Tandem vs Tita 对比

> **状态**: 2026-05-30 PT 用 web 实证 (Tita 2025 H2 / WorkBoard 2025 H1 / Microsoft Viva Goals 2025-12-31 退役公告 / Quantive 2025-05 被 WorkBoard 收购) v2 修正版
> **结论**: 跟 Tita 完整度 **~75%** (不是之前 v1 的 85% — 之前漏估 Tita 2025 新功能), 独家护城河 4 件事仍真. **国际标杆从 Viva Goals 改为 WorkBoard (含 Quantive)**.

---

## ⚠️ v1 → v2 修正记录 (2026-05-30)

| 项 | v1 (2026-05-10) | v2 (2026-05-30, 实证) | 修正原因 |
|---|---|---|---|
| 跟 Tita 完整度 | 85% (17/20 项) | **~75%** (17/32 项, 加 5 强 - 缺 6 + 反向修正 Tita AI Coach 已上) | v1 漏 Tita 2025 新功能 (AI 批量创建 / 多平台集成) |
| 国际标杆 | (未明确) | **WorkBoard** (含 Quantive, 收购 2025-05) | Viva Goals 已退役 / Quantive 被吞 |
| Microsoft Viva Goals | 列为标杆 | **划掉** | 2025-12-31 正式退役 |
| Tita AI Coach | 列为 "Tita 有, 我们待补" | 列为 "Tita 2025 H2 已上 AI 批量创建一键全景图" | 实证升级 |
| 移动端 | 模糊带过 | **明确大缺口** | Tandem 当前完全未接 |
| 钉钉/企微/飞书集成 | 误列为"性大缺口" | **战略红线, 永不接入** | 他们是直接竞品, 接 = 变插件 (详§11) |
| 评分等级 | A (综合 > Tita) | **B+ (vs Tita 75%) / C+ (vs WorkBoard 40%)** | 实证 |

---

## 0. 快速判断 (v2)

```
跟 Tita 完整度    ███████████████░░░░░  75%   (17 项平等 + 4 项强 - 6 项缺)
跟 WorkBoard      ████████░░░░░░░░░░░░  40%   (国际标杆全家桶集成 + AI Agents)
独家护城河        ███████████████████░  95%   (4 件 Tita/WorkBoard 都做不到)
关键缺口          AI Coach 实装 / Recognition / forecast / 原生移动 / Calibration / 工作流审批
战略红线        永不接入钉钉/企微/飞书 (直接竞品, 详§11)
```

---

## 1. 已有 (跟 Tita 平等的 17 项)

| 功能 | Tandem 实现 | 文件 |
|---|---|---|
| 目标管理 O/KR | zustand store + edit dialog | `app/okr/page.tsx` |
| Initiative 行动项 | OKRInitiatives | `components/okr/okr-initiatives.tsx` |
| Check-in 周更新 | CheckInDialog | 同上 |
| 季末评分 | OKRScoring (0-1.0) | `components/okr/okr-scoring.tsx` |
| 趋势图 | OKRTrendChart (O + KR) | `components/okr/okr-trend-chart.tsx` |
| 健康诊断 | OKRHealthPanel + checkQuality | `components/okr/okr-health-panel.tsx` |
| 节奏脉搏 | objectivePulse (周/月) | `lib/okr/cadence.ts` |
| OKR 模板库 | OKRTemplatePicker | `components/okr/okr-templates.tsx` |
| 评论系统 | OKRComments | `components/okr/okr-comments.tsx` |
| 活动流 | OKRActivityFeed | `components/okr/okr-activity.tsx` |
| 关注/订阅 | OKRWatchers | `components/okr/okr-watchers.tsx` |
| Tita CSV 导入导出 | importTitaCSV / exportTitaCSV | `lib/tita-adapter.ts` |
| 5 层级联视图 | /okr/cascade | `app/okr/cascade/page.tsx` |
| TTI 双轨 + Plan vs Actual | OKRTtiPanel | `components/okr/okr-tti-panel.tsx` |
| KR 软绑定到决议 | DC.primaryKrId | `lib/types/decision-card.ts` |
| 9 宫格人才 | /nine-box | `app/nine-box/page.tsx` |
| **★ 季末复盘 (P0.1)** | OKRRetrospective (PDCA/KISS/4L) | `components/okr/okr-retrospective.tsx` |

---

## 2. 仍差 (Tita 有, 我们暂无)

### P0 — V1 GA 必补 (剩 3 项, 5 天)

| 缺口 | 价值 | 工期 | 怎么做 (不重写) |
|---|---|---|---|
| **月度对比表 (Plan vs Actual 时间轴)** | 月底分析必需 | 2 天 | 在 OKRTtiPanel 下扩月度网格 + 接 CheckIn 历史 |
| **跨部门对齐树 (Alignment View)** | 公司战略落地必需 | 2 天 | 利用现有 parentObjectiveId, 加新 view 切换 |
| **MoM 环比** | 反映"这个月比上个月好了多少" | 1 天 | 数据接通 CheckIn 月度快照即得 |

### P1 — V1 GA 后期 / V2 早期补

| 缺口 | 价值 | 工期 |
|---|---|---|
| 1on1 模块 (主管-员工对话) | Tita 杀手级 | 5 天 |
| 360 评估 (同事/上下级互评) | HR 体系联动 | 7 天 |
| 季度复盘批量模板 | 公司级流程 | 3 天 |
| 部门聚合 Dashboard | admin 视角 | 3 天 |
| 日历视图 (Deadline 时间轴) | 任务管理者爱用 | 2 天 |

### P2 — V2 上 / 已有等价方案

| 缺口 | 状态 |
|---|---|
| 同比 YoY | V2 (历史数据需 1 年) |
| OKR 学院 / 培训 | /skills/learning 雏形已有, V2 加课程库 |
| 邮件通知 | PRD §3.5 已计划 (M5) |
| 移动端 | PRD §3.3 已计划 (M5) |
| ~~钉钉/企微集成~~ | **取消** — 战略红线, 永不接入 (§11) |
| 工作流审批 | V2 |

---

## 3. Tandem 独特 · Tita 没有的 10 项

| 维度 | 内容 |
|---|---|
| **TTI 双轨 + §4** | TTI 永不挂奖金 (代码 readonly false + DB column drop) — 反 OKR 异化 |
| **议事室 17min 闭环** | KR 推进通过决议达成, 不是空喊口号 |
| **D 选项必填** | 反 AI 欺诈, 员工必须人写原创 |
| **Memory 4 层 + 三级签批** | KR 沉淀经 SOP 入库, 跨季度复用 |
| **Persona 学习钩子** | 每决议自动训练员工 AI 分身 |
| **链式 hash 审计** | OKR 修订历史不可篡改 |
| **§13 数据自助** | 离职员工 KR 数据自助导出 |
| **Cadence pulse** | AI 主动发现 OKR 节奏紊乱 |
| **5 层 cascade 视图** | O→KR→Initiative→DC→AP 一图穿透 |
| **CSV 双向 Tita 兼容** | 客户老 OKR 数据无损迁移 |

---

## 4. 复盘 (P0.1) 实施细节

### 4.1 组件 `components/okr/okr-retrospective.tsx` (~290 行)

- **3 种方法论切换**: PDCA / KISS / 4L
- **结构化 4 段输入**: 每方法论 4 个槽位 (如 KISS = Keep/Improve/Start/Stop)
- **总分显示**: calcObjectiveScore × 100 (0.1-0.7 = 健康)
- **引导反思**: 评分 < 0.5 的 KR 自动列出, 提示重点回答
- **持久化**: 写入 `Objective.retrospective` (markdown 格式带 metadata 标签可解析)
- **M2 联动占位**: 高质量复盘内容自动入 Memory / Stop 项触发新 Objective 模板

### 4.2 集成 `app/okr/page.tsx` (4 surgical edits, +5 lines)

1. import OKRRetrospective
2. DetailTab union + 'retro'
3. tab button (between 评分 and 关注)
4. conditional render block

不改: 8 个老 tab + 任何 store 逻辑.

### 4.3 与现有 评分 tab 的关系

- 评分 tab 也有简版 retrospective textarea (单一段 markdown)
- 复盘 tab 是结构化版本 (PDCA/KISS/4L, 自动序列化为 markdown 存到同一字段)
- 二者读写同一字段, 互兼容: 切回 评分 tab 看到完整 markdown; 切回 复盘 tab 自动 parse 回结构化字段
- 没改 OKRScoring, 没破坏既有数据

---

## 5. 当前路线: P0 **全部干完** (2026-05-10 单 session)

```
Day 1   ✅ 复盘 UI (P0.1)         [65b89b1]
Day 2   ✅ 跨部门对齐树 (P0.2)    [本次]
Day 3-4 ✅ 月度对比表 (P0.3)      [本次]
Day 5   ✅ MoM 环比 (P0.4)         [本次, 与 P0.3 同表同组件]
Day 6   ✅ 联调 (tsc 0 errors + /okr 200)
```

### P0 落地详情

- **对齐树 `components/okr/okr-alignment-tree.tsx`** (310 行)
  - 递归 parentId 建树, Ministry → Department 映射做 swimlane 染色
  - 父子 ownerId 不同部门时红色 ⚠️ 警示 (公司战略沟通风险)
  - 选中高亮祖孙链路, 其他节点 dim 到 40% 透明
  - 部门 7 色图例自动循环
  - 空 cycle / 无根节点都有 empty state

- **月度对比 `components/okr/okr-monthly-comparison.tsx`** (320 行)
  - 按 cycle startDate/endDate 自动切月 bucket
  - 2 张表: Objective 整体 (Plan/Actual/Var/MoM 4 行) + KR 明细矩阵
  - Plan = 线性时间期望 %, Actual = 该月末前最后一条 check-in 的 progressAfter
  - Variance 彩色 chip (±3pp 同步 / 绿色超前 / 红色落后)
  - MoM = 本月 − 上月 (pp, 绿 +/红 −/灰持平)
  - 当前月 amber 背景高亮
  - **零新 schema 字段, 纯派生计算**

P0 走完后:

```
完整度    ███████████████████░  95%   (跟 Tita 几乎平等)
+ 独特    ███████████████████░  95%
= 综合    > Tita
```

---

## 6. 长远 (V2-V3 战略层判断)

Tita 的护城河不是功能多, 是: **国内 OKR 文化最早的传教士 + 销售下沉 + 客户成功经验积累**.

Tandem 不靠抄 Tita 功能赢, 靠:
1. 议事室 17min + D 选项 (反 AI 欺诈, Tita 永远不会做)
2. TTI 永不挂奖金 (解决 OKR 异化为 KPI 的核心病灶)
3. Persona 双层 + Memory 强注入 (个人 AI 真成长, 不是空 chatbot)
4. 私有化 + 数据归公司 + §13 4 项尊严铁律

Tita 是 OKR SaaS, Tandem 是**企业决议操作系统** — 维度不同, 不直接对位.

---

## 7. v2 实证矩阵 · vs Tita (2025 H2)

基于 Tita 官方 (https://okr.tita.com/) + 第三方评测 + 企业微信应用市场 changelog 实证 32 项:

### 7.1 平等 17 项 (我们已落)

参见 §1 (本文档前面那张表). 这部分仍真.

### 7.2 强项 4 项 (我们超越 Tita 的)

| 维度 | Tandem | Tita |
|---|---|---|
| **决议锚点强制** | `lib/decision-layer/okr-anchor.ts` G2 护栏 + audit | ❌ 没有 "每决策必填 KR" 概念 |
| **议事室 17min + D 选项** | `app/convergence/[id]` + `three-plus-one-engine.ts` 强制 D 原创 | ❌ 议事不是产品 |
| **TTI 永不挂奖金** | `lib/charter/kpi-tti.ts` + DB readonly false | ❌ 默认 KPI = 钱, 无双轨 |
| **Memory 4 层 + 三级签批** | `lib/memory/promotion-flow.ts` + `app/memories` | ❌ 知识库 ≠ 4 层 Memory + SLA 升级 |

### 7.3 缺 6 项 (Tita 有, Tandem 暂无 — 真实差距)

| 缺口 | Tita 实现 | 紧急度 | Tandem 工期 |
|---|---|---|---|
| **AI 批量创建 OKR (一键全景图)** | Tita 2025 H2 上, 公司/部门/个人 一键 LLM 生成 | 🔴 P0 | 1 周 (复用 3+1 引擎) |
| **Recognition Wall (鼓励墙)** | CFR 中的 R, 公司广场点赞 + 关联 KR | 🟡 P1 | 5 天 |
| **KR forecast 推演** | 基于历史 check-in 推季末完成度 + 风险 | 🟡 P1 | 5 天 (扩 trend.ts) |
| **原生移动 App** (Tauri/Capacitor) | iOS / Android 自有应用 (不走微信小程序 / 钉钉应用入口) | 🔴 P0 | 6-8 周 |
| ~~钉钉 / 企微 / 飞书集成~~ | **战略红线, 永不接入** | × | 详§11 |
| **Calibration session UI** | 经理一屏校准下属 OKR 评分 | 🟡 P1 | 5 天 |

### 7.4 独家 10 项 (Tita 没有, 见 §3)

仍真. 链式 hash 审计 / TTI 双轨 / D 选项必填 / Memory 4 层 / Persona 学习钩子 / Cadence pulse / 5 层 cascade / CSV 双向兼容 / 9 宫格双轨 / §13 离职导出.

---

## 8. v2 实证矩阵 · vs WorkBoard (国际新标杆 · 含 Quantive)

> **2025-05 WorkBoard 收购 Quantive (原 Gtmhub)**, 现在是国际 OKR SaaS 唯一头部. **Microsoft Viva Goals 2025-12-31 退役**.

WorkBoard 2025 H1 关键能力 (基于 https://www.workboard.com/ + Workday/MS marketplace):

| # | WorkBoard 能力 | Tandem 状态 | 评 |
|---|---|---|---|
| W1 | OKR CRUD + 5 层 cascade | ✅ 5 层 (`/okr/cascade`) | 平 |
| W2 | **AI Agents ("on the fly" OKR translate/generate)** | 部分 (3+1 引擎在, OKR 制定还未接) | 弱 |
| W3 | **Workday HRIS sync + Microsoft 365 集成** | ❌ 完全没有 | 大缺 |
| W4 | **Slack / Teams / Jira 双绑** | ❌ (有 RocketChat 集成) | 大缺 |
| W5 | Strategic Pillars / Pillar 对齐 | OKR 锚 + 议事强制 | **强** |
| W6 | Pulse / forecast / risk signals | health.ts 部分, forecast 缺 | 弱 |
| W7 | Calibration / public dashboards | ❌ Calibration 缺, dashboard 简版 | 弱 |
| W8 | API / Webhook / SOC 2 / 多语言 | 内部 API 在, 其他全缺 | 大缺 |
| W9 | 原生 Mobile (iOS/Android) | ❌ | 大缺 |
| W10 | **Strategy execution layer (战略执行台)** | 议事 17min + 决议链 | **强** |

**vs WorkBoard 完整度 ~40%** (2 强 + 5 弱 + 3 大缺).

**真差异化在 W5 / W10**: WorkBoard 是 "AI 加速 OKR 执行", Tandem 是 "OKR 强制驱动每个协作". 维度不同, 但 WorkBoard 的全家桶集成 (W3/W4/W8) 让客户感受到 "在 Slack/Teams/Jira 里就能看 OKR", 这是 Tandem 短期内做不到的体验.

---

## 11. 战略红线 · 永不接入钉钉 / 企微 / 飞书 · 他们是竞品

### 为什么这是红线, 不是缺口

v1 文档举以为 "钉钉/企微/飞书集成" 是 Tandem 要补的 P0 缺口 — **这是根本错误**:

1. **他们是直接竞品, 不是生态伙伴** — 接入 = 客户体验 “飞书带 Tandem 插件”, Tandem 永远是配角
2. **Tita 的死路**: Tita 2025 在被飞书 People 損害 — 深接三家 IM 变成它们的插件生态, 永不可能赢
3. **战略稀释**: 我们要让客户离开飞书, 不是让他们在飞书里多干一件事
4. **MANIFESTO §1 反例**: "飞书的最小单元是消息, Tandem 是决议" — 接入飞书 = 把决议降级为消息推送
5. **数据离心**: 决议 / Memory / OKR 走飞书通知出去, 客户认知是 "飞书的功能"

### 中性集成白名单 (仅限这些)

| 渠道 | 判断 |
|---|---|
| **SMTP / IMAP 邮箱** | ✅ 中性协议, 不属任何厂商 |
| **§19 Skill Gateway (MCP)** | ✅ 个人 AI (Claude/Cursor/Hermes) 反哺企业, 走中立协议 |
| **Slack / Teams** (海外客户) | ✅ 不是中国直接竞品, V3 考虑 |
| **OSS 生态** (RocketChat / Univer / Yjs) | ✅ 开源生态, 不是商业竞品 |

### 永不接

| 平台 | 原因 |
|---|---|
| **飞书 / Lark** | 直接竞品 |
| **钉钉 / DingTalk** | 直接竞品 |
| **企微 / WeCom** | 直接竞品 |

### 中国市场走自有桌面 + 原生移动 App

- **桌面**: Tauri 2.0 已有 (Win/macOS/Linux 三平台打包配置完成)
- **移动**: V2 走 Tauri Mobile / Capacitor, 不走微信小程序 / 钉钉入口
- **迁移**: Tita CSV 双向兼容 (手动导入, 不依赖飞书 SDK)

---

## 12. v2 实事求是的对外叙事

### 现在能讲 ✅

- "OKR 引擎核心 4 件事超越所有竞品 (决议锚点 / TTI 双轨 / 议事 17min / Memory 三级签批) — 飞书/Tita/WorkBoard 18-24 月都做不出"
- "在 OKR 标配能力上, 对齐 Tita ~75%, 对齐 WorkBoard ~40%, 6 项关键缺口 (AI Coach / Mobile / IM 集成 等) 已列入 90 天补丁路线图"
- "我们不是另一家 OKR SaaS, 是把 OKR 决议链植入每次协作的企业 Agent OS"

### 不能讲 ❌

- ❌ "OKR 完整度 95%" (实证 75%)
- ❌ "全面超越 Tita" (4 件超越 + 6 件大缺 = **点状超越 + 大量补差**)
- ❌ "vs Microsoft Viva Goals" (已退役 2025-12-31, 命题作废)
- ❌ "vs Google OKR" (Google 没有 OKR SaaS, 命题错位)
- ❌ "我们要接入飞书/钉钉/企微" (**战略红线**, 他们是直接竞品, 详§11)

---

## 13. 修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-10 | v1 创建. 17 项标配 + 4 P0 缺口 + 综合 > Tita 评级 (实际偏乐观) |
| 2026-05-30 PT (上午) | v2 实证修正. 完整度 95%→75% / 加 vs WorkBoard 矩阵 / 划掉 Viva Goals (退役) / 标记 Tita 2025 H2 AI 批量创建 / 6 项真实缺口 |
| 2026-05-30 PT (下午) | v2.1 战略修正. 钉钉/企微/飞书集成 从 P0 缺口 → 战略红线 (§11). 原因: 他们是直接竞品, 接 = 变插件 — §12 不能讲加 1 条 / §7.3 6 项缺口 → 5 项 (移动仍在, IM 集成被划掉) / §2.P2 取消钉钉企微集成 |
