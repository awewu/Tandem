# Tandem OKR 模块差距评估与进化路径

> **版本**: 2026-06-01 (v3, 双层结构)
> **立场**: OKR 完整底座是 Tandem 驱动企业战略落地的立身之本——底座不完整，中央 AI 发挥不了作用。中央 AI 是杠杆，但杠杆需要支点。两层都要：底座层(必达) + 杠杆层(差异化护城河)。
> **参考**: `docs/TITA-OKR-DEEP-DIVE.md` / `docs/COMPETITOR-ARCHITECTURE.md` / `docs/UNIFIED-TECH-DESIGN.md` / `docs/OKR-DRIVEN-ARCHITECTURE.md`

---

## 0. 立场演进（记录三次纠偏，防再犯）

- **v1 错误**：用"Tandem 有反虚报护城河，不必抄 Tita"掩盖差距。
- **v2 纠偏**：面对事实——功能模块差几个数量级，且"自动 rollup"是假闭环。但 v2 又走偏到"砍到只做 AI 两件事"。
- **v3 定论(本版)**：**OKR 完整性与广度是 Tandem 成功的基座**。Tandem 初心是驱动企业战略落地；OKR 底座不完整，中央 AI 没有可锚定的目标、可驱动的执行链，护城河是空中楼阁。
  - 底座层(OKR 完整性)= 立身之本，**必达**。
  - 杠杆层(中央 AI)= 差异化护城河，**建在完整底座之上**。
  - 唯一废掉：冗余的 localStorage 真值模型。

---

## 1. Tandem OKR 真实现状（看代码，非凭空）

### 1.1 两套并存的数据模型（要废一套）

| 层 | 文件 | 存储 | 用途 | 处置 |
|----|------|------|------|------|
| UI store | `lib/store/okr.ts` | localStorage (`铁山-okr-store` v3) | `app/okr/page.tsx` 主编辑页 | **降级为纯 UI 缓存，不再当真值** |
| 服务端真值 | `lib/types/okr-tti.ts` | API/DB | `app/okr/cascade` 等只读视图 | **收敛为唯一真值** |

**问题**：两套模型字段不一致（store 用 `parentId`/`type`，server 用 `measureType`/`riskStatus`），存在同步债。

### 1.2 已有页面

| 路由 | 内容 | 成熟度 |
|------|------|--------|
| `app/okr/page.tsx` (65KB) | OKR CRUD + 单父对齐 + KR 加权 + CheckIn 时间线 | 🟡 基本可用 |
| `app/okr/dashboard` | 部门聚合进度 | 🟡 浅 |
| `app/okr/cascade` | O→KR→Initiative→DecisionCard→ActionItem 五层级联（只读） | 🟡 有骨架 |
| `app/okr/calibration` | 评分校准 | 🟡 雏形 |
| `app/okr/calendar` | CheckIn 日历视图 | 🟡 有 |

### 1.3 进度传播的真相（关键）

- `lib/events/bus.ts`：`okr.kr-progressed` 事件已定义，`source` 枚举含 `'daily-report'`。
- `lib/events/subscribers.ts:148`：订阅者**只打日志 + mirrorToUsage，不向上传播到 Objective**。
- `lib/store/okr.ts:493` `addCheckIn`：人手填 `progressAfter`，反推 `currentValue`；Objective 直接写 `progressOverride`（人工覆盖），**不从 KR 聚合**。
- `source: 'daily-report'`：是预留枚举，**实际没接线**。

**结论**：Tandem 的"自动传播"是假闭环——事件发了没人往上传，进度全靠人手填。

---

## 2. 模块级差距对照（诚实打分）

| Tita 模块 | Tita 成熟度 | Tandem 现状 | 评级 | 归属层 |
|-----------|------------|-------------|------|--------|
| OKR CRUD/对齐/可见性 | 完整 | CRUD + 单父对齐 | 🟡 基本有 | 底座 |
| 进度自动传播 rollup | 唯一卖点 | 事件只打日志不传播 | 🔴 假闭环 | 底座 |
| OKRs-E 执行(任务/项目联动) | 完整 | 只有 `linkedTaskId` 字段 | 🔴 断裂 | 底座 |
| OKR 地图(全局对齐 DAG) | 完整 | 无（cascade 是树状只读） | 🔴 没有 | 底座 |
| 仪表盘监控 | 饼图/柱图/健康度/提醒 | 基础聚合 | 🟡 浅 | 底座 |
| 案例库(上千套模板) | 完整 | 无 | 🔴 没有 | 底座 |
| CFR 对话/反馈/认可 | 完整 | `1on1`+`360` 独立页未接 OKR | 🔴 割裂 | 底座 |
| 绩效考核(模板/等级/继任) | 完整 | `nine-box`+`calibration` 雏形 | 🟡 雏形 | 底座 |
| 复盘(看板/5Why/AI 诊断) | 结构化+AI | `retrospective` 文本字段 | 🔴 纯手填 | 底座+杠杆 |
| 项目管理(甘特/里程碑/依赖) | 完整 PM 套件 | `tasks` 页，无甘特/依赖 | 🔴 基本没有 | **不做** |
| 周报/汇报 | 一键生成+推送 | `report` 页 | 🟡 浅 | 底座 |
| 社交(关注/评议/提醒) | 完整 | 字段有 UI 浅 | 🟡 字段有 | 底座 |
| 组织架构层级查看 | 完整 | `organization` 页 | 🟡 有 | 底座 |

---

## 3. 双层进化结构

### 底座层 · OKR 完整性（必达，立身之本）

> 这一层不是"是否做"，而是"必须做到完整"。OKR 底座完整，中央 AI 才有可锚定的目标、可驱动的执行链。

| # | 任务 | 当前缺口 | 工作量 |
|---|------|---------|--------|
| B1 | **单一数据模型收敛** | localStorage 与 server 两套并存 | 3-5 天 |
| B2 | **真 rollup 引擎** | task→KR→O→顶层 真传播；废 `progressOverride` 默认 | 3-5 天 |
| B3 | **OKRs-E 执行联动** | Initiative/Task 完成驱动 KR `currentValue` | 3-5 天 |
| B4 | **完整对齐 + OKR 地图** | 单父 → 多父对齐；树状 → 全局 DAG 地图 | 5-7 天 |
| B5 | **评分 + 结构化复盘** | 评分雏形；复盘纯文本 | 4-6 天 |
| B6 | **仪表盘健康度监控** | 基础聚合 → 健康度/落后预警/一键提醒 | 3-5 天 |
| B7 | **CFR/360/绩效与 OKR 打通** | 独立页 → 锚定到 OKR | 7-10 天 |
| B8 | **案例库** | 零 → 内置岗位 OKR 模板 | 2-4 天 |

### 杠杆层 · 中央 AI 差异化护城河（建在完整底座上）

> Tita 的命门：进度靠人诚实填。Tandem 唯一打得过的地方：AI 从真实工作流萃取进度 + 中央治理。这是 Tita 架构上做不到的。

| # | 任务 | 依赖 | 工作量 |
|---|------|------|--------|
| L1 | **AI 自动萃取进度 + 反虚报** | 接通 `source: 'daily-report'` + output-guard 校验；依赖 B2 | 5-7 天 |
| L2 | **中央 AI 复盘诊断 / OKR 漂移检测** | 走 governedChat；依赖 B5/B2 | 5-7 天 |

**两层关系**：底座 B1-B2 是地基中的地基(先做)；杠杆 L1 与 B3 同步设计接口(`source: 'daily-report'` 是埋好的对接点)；其余底座项沿途补全；L2 在评分复盘(B5)就绪后接入。

---

## 4. 唯一废掉 / 明确不做

| 项 | 处置 | 理由 |
|----|------|------|
| localStorage 真值模型 | 废（降级为 UI 缓存） | 冗余、同步债、低价值 |
| 完整重型项目管理套件（甘特/依赖/资源调度） | **不做** | 那是 PM 工具(Tita PM 起家)的活，不是 OKR 底座的活；`tasks` 保持轻量即可 |

---

## 5. 执行顺序建议

1. **地基中的地基**：B1 模型收敛 + B2 真 rollup（其他都依赖这个真值与传播）
2. **执行闭环 + 护城河接口同步**：B3 执行联动 与 L1 反虚报接口一起设计（`source: 'daily-report'` 对接点）
3. **沿底座补全**：B4 对齐地图 → B6 仪表盘 → B5 评分复盘 → B7 CFR 打通 → B8 案例库
4. **杠杆接入**：L1 反虚报（B2/B3 后）→ L2 AI 复盘诊断（B5 后）

---

## 6. 一句话

> **OKR 完整底座(B1-B8)是 Tandem 驱动企业战略落地的立身之本，必达；中央 AI 杠杆(L1-L2)是 Tita 架构上做不到的差异化护城河，建在完整底座之上。先收敛模型 + 修真 rollup(地基)，再沿底座补全，杠杆紧随。唯一废掉冗余 localStorage 真值；唯一不做重型 PM 套件。**
