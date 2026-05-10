# OKR 体系 · Tandem vs Tita 对比

> **状态**: 2026-05-10 用户问"OKR 体系恢复并进化完整了吗? 和 Tita 哪些差距"
> **结论**: 基础完整度 **85%** (已恢复 1244 行 /okr + 245 行 /okr/cascade + 8 sub-components + 3 helper libs + Tita CSV 双向兼容). 4 项 P0 缺口列表见下, 第 1 项已补.

---

## 0. 快速判断

```
完整度    ████████████████░░░░  85%   (17 / 20 项 Tita 标配, 含本次复盘 P0.1)
独特价值  ███████████████████░  95%   (10 项 Tita 没有的)
差距      P0 4 项 → 6 天工 → 90%+
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
| 钉钉/企微集成 | Launchpad 跳板已计划 (M2) |
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
