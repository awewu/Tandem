# KPI / TTI 双轨绩效宽章 (Charter)

> **状态**: 🔒 冻结 · 2026-05-20 创建
> **取代**: TTI-FRAMEWORK.md (旧, 单轨语义不清) · 与 MANIFESTO §4 协调
> **维护**: 本宽章修改需重新会签; 实现细节 (字段/API) 不锁

---

## §1 一句话定义

> Tandem 用**双轨**绩效系统:
> **KPI** 保公司底线 (与奖金挂钩) · **TTI (= OKR 体系)** 给战略成长空间 (与奖金分离).
> 两轨**完全独立**, 共同投影到 9-box 矩阵 (KPI 纵 × TTI 横), 形成完整人才视图.

---

## §2 KPI 体系 · 公司底线保障 + 全维度健康监控

| 维度 | 规则 |
|---|---|
| **目的** | 双任务: ① 保障财年底线达成 (奖金挂钩) ② 全维度监控公司运行健康 (不挂奖金) |
| **机制** | **强制达成** (bonus scope) + **被动监控** (monitor scope) |
| **来源** | Top-down — 财务年度预算逐层分解 + 公司全维度数据采集 |
| **周期** | **年度** (财年), 季度 check-in, 年终汇总 |
| **薪酬关系** | **scope=bonus 与奖金挂钩** · scope=monitor 仅看板不挂奖金 (见 §2.0) |
| **得分意义** | bonus: 达标=拿基准奖金/超额=系数上浮/未达=不发或扣减; monitor: 仅作健康预警 |
| **9-box 位置** | **纵轴** (仅 scope=bonus 计入) |
| **代码命名前缀** | `Kpi*` (KpiCycle / KpiSubject / Kpi / KpiCheckIn / KpiSnapshot / KpiManualEntry) |
| **API 路径** | `/api/kpi/*` + `/api/kpi/analytics/*` + `/api/kpi/manual-entry` + `/api/kpi/{import,export}` |
| **录入角色** | HR / 高管 (目标设定 + 科目管理); ERP 集成 (实际值采集); 财务/HR/内勤 (人工补录) |

### 2.0 双 scope · bonus 与 monitor 分流

公司需要**全维度数据**了解运行健康度, 但**不是所有 KPI 都关联考核**.
所以 KPI 实例上携带 `scope` 字段, 分两类:

| Scope | 用途 | 进 9-box | 进奖金计算 | 健康度看板 | 数据采集 |
|---|---|:-:|:-:|:-:|---|
| **bonus** | 与年度绩效/奖金挂钩 (营收 KPI / 利润 KPI / 部门年度承诺 ...) | ✅ | ✅ | ✅ | A+B+C 三通道 |
| **monitor** | 仅监控公司运行健康 (流失率, 在线时长, 故障次数, 库存周转 ...) | ❌ | ❌ | ✅ | A+B+C 三通道 |

**关键约束**:

- 数据采集逻辑 (三通道) 对 bonus / monitor 完全相同, 仅在**消费侧分流**: 9-box / 奖金引擎只读 bonus.
- `scope` 在周期 active 后**不可修改**, 防止奖金口径漂移.
- 一个公司可以有几千个 monitor KPI (全维度), 但只有几十个 bonus KPI (关键).
- 健康度看板 (`/admin/kpi/health-dashboard`) 显示全维度 KPI 热力图 + 预警, 与个人无关.
- Monitor KPI 也走科目体系 (KpiSubject), 用同一套全维度分类.

### 2.1 数据来源 · **三通道 · 禁个人/被考核人干预**

KPI 数据**只能**由以下三个合法通道改变 (A/B/C 之外的任何来源都拒绝写入)：

| 通道 | 负责 | 允许改动的字段 | 触发条件 |
|---|---|---|---|
| **A. 管理设置 (Top-down)** | HR / 高管 / 直属主管 | `targetValue` / `weight` / `cycleId` / `assigneeId` | 仅周期启动前 |
| **B. ERP 采集 (系统集成)** | 后台定时任务 · ERP webhook · 财务系统 · BI 报表 | `currentValue` (实际进度) · `actualBreakdown[]` (多维分解) | 自动, 持续 |
| **C. 人工补录 (受限端口)** | 财务 / HR / 部门内勤 (角色绑定) | `currentValue` · `actualBreakdown[]` · `manualEntryReason` (必填) | ERP 未覆盖的指标 (e.g. 客户满意度调研 / 定性 KPI / 特殊项目里程碑) |

**通道 C 设计要点**：

- 独立 endpoint `POST /api/kpi/manual-entry` (与通道 A 的 `/api/kpi` PATCH **物理隔离**, 走单独路由)
- 必须传 `manualEntryReason` (字符串说明为何 ERP 不能采集)
- 必须传 `evidenceUrl` (可选, 上传证据材料链接, e.g. 调研报告 PDF)
- 角色校验: 只有 `kpi.manual_entry` 权限的用户能调 (财务/HR/部门内勤角色默认带, 主管/高管**没有**此权限)
- 100% audit-log: 谁、改了哪个 KPI、from→to、reason、evidenceUrl
- 每条 KPI 可标记 `dataSource: 'erp' | 'manual'` (UI 显示来源徽标, manual 加 "人工补录" 标签)
- 同一 KPI 可混合: 早期 manual 补录 → 后期 ERP 接入后自动切回 erp 模式

**为何独立通道而非直接给写权限**：

- 物理隔离防止越权 (主管不能借 KPI setup 权限改 actuals)
- 必填 reason + evidence = 强制留痕 + 后续审计
- UI 表现明显区分 (manual 标签), 让 9-box / 奖金计算可视化数据可信度
- 未来若全量 ERP 覆盖, 直接关闭此通道即可, 不影响其他逻辑

**绝对禁止改 KPI 的角色**：

- **被考核员工本人**: 永远只读 (即使被考核人是 HR/财务, 不能改自己的 KPI)
- **直属主管**: 仅通道 A 改 targets, 不能改 actuals
- **CEO / 高管**: 仅通道 A 改 targets, 不能改 actuals (除非也兼任 HR/财务并有权限位)

UI 表现：个人 KPI 页 · 实际进度区域永远只读, 不提供编辑控件; 财务/HR 走独立"KPI 补录"工作台 (`/admin/kpi/manual-entry`).

### 2.2 必须提供的分析机制

KPI 体系不是纯数值跟踪, **必须**提供以下多维度分析能力：

| 分析维度 | 说明 | API |
|---|---|---|
| **体系目标同步** | 高管 KPI → 部门 KPI → 个人 KPI 三层拆解一致性检查 (汇总是否等于拆解) | `GET /api/kpi/analytics/cascade` |
| **YTD (Year-To-Date)** | 年初到今日累计进度 · 同期趋势 | `GET /api/kpi/analytics/ytd?kpiId=...` |
| **环比 (MoM/QoQ)** | 本月 vs 上月 / 本季 vs 上季 | `GET /api/kpi/analytics/period-on-period?kpiId=...&granularity=month\|quarter` |
| **同比 (YoY)** | 今年 vs 去年同期 | `GET /api/kpi/analytics/year-on-year?kpiId=...` |
| **季度分布** | Q1/Q2/Q3/Q4 各季度进度柱状图 | `GET /api/kpi/analytics/quarterly?kpiId=...` |
| **目标拆解趋势** | 实际值一条线 vs 目标线 vs 里程碑点 | `GET /api/kpi/analytics/timeline?kpiId=...` |
| **全员达成率分布** | 部门内 / 公司内 KPI 达成率直方图 (于 9-box 联动) | `GET /api/kpi/analytics/distribution` |
| **预警 (达成预测)** | 基于当前速率预测年终达成, 预测不达提前预警 | `GET /api/kpi/analytics/forecast?kpiId=...` |

### 2.3 不可变铁律

- KPI 与奖金的关系**仅由 scope=bonus 触发**; scope=monitor 永远不挂奖金 (CHARTER §2.0).
- KPI 不达成 (scope=bonus) → 不发绩效奖金. 不允许"KPI 不达但因 TTI 高发奖金"的逻辑.
- KPI 目标 = top-down 分配, **个人不可自主调整目标值**.
- KPI 实际值三通道唯一: **ERP 采集 (B)** 主路径 + **财务/HR/部门内勤人工补录 (C)** 补充; 被考核员工本人/直属主管/高管都不能改 actuals.
- 通道 C 必须填 `manualEntryReason`, 否则拒写.
- 年度 KPI 周期一旦激活, **targetValue 锁死**, 不允许中途调整 (除非走特批流程 + audit log).
- ERP 采集失败时: 优先提示"数据源中断" + 告警财务/HR; 只有 ERP 本身不支持采集的指标 (不是临时故障) 才走 通道 C 补录.
- 所有管理设置 (通道 A) 改动 100% 走 audit log; 所有人工补录 (通道 C) 100% 走 audit log + 独立`kpi.manual_entry` event 类型.
- KPI 实例 `scope` 字段在周期 active 后 frozen, 不允许从 monitor 翻成 bonus (反之亦不可).

### 2.4 科目主数据 (KpiSubject) · 动态优化机制

公司经营是有机体, KPI 科目体系**必须可演进**, 不能硬编码:

- **数据模型**: `KpiSubject` 树 (三层默认: 一级/二级/三级), 见 `lib/types/kpi.ts:KpiSubject`
- **管理者**: HR / 财务 / 高管 (拥有 `kpi.subject_admin` 权限位)
- **管理入口**: `/admin/kpi/subjects` 工作台 (树形 CRUD + 拖拽排序 + 批量导入)
- **生命周期**:
  - 新增: 任何时候可加新科目 (本周期 + 未来周期生效)
  - 修改 (name/description/defaultUnit/...): 任何时候 (不影响历史 KPI 数据完整性)
  - 软删除 (`active=false`): 历史 KPI 仍能读, 但不能新建引用此科目的 KPI
  - 硬删除: 禁止 (若需清理, 通过 audit log + 议事室签批 + DB 直操)
- **编码 (code)**: 业务用户自定义, e.g. `REV-001` `COST-RAW-002`. **Excel 导入按 code 匹配**, 而不是 id.
- **科目树重组**: 允许调整 parent (`/admin/kpi/subjects` 拖拽), audit 记录变更.
- **默认科目种子**: 系统初始化提供一套通用财务/运营科目种子 (10 一级 / 30 二级), 企业可基于此扩展.

### 2.5 Excel 导入导出

| 资源 | 导出 | 导入 |
|---|---|---|
| **KPI 科目体系** (KpiSubject 树) | `GET /api/kpi/subjects/export-excel` → xlsx | `POST /api/kpi/subjects/import-excel` (multipart) |
| **KPI 实例** (Kpi + targetValue) | `GET /api/kpi/export-excel?cycleId=...&scope=...&level=...` | `POST /api/kpi/import-excel` (multipart) |
| **历史快照** (KpiSnapshot, 全维度) | `GET /api/kpi/snapshots/export-excel?cycleId=...` (供 BI / 离线分析) | — (只读) |
| **人工补录批量** (KpiManualEntry) | — | `POST /api/kpi/manual-entry/import-excel` (财务/HR 月末批量补录场景) |

**Excel 格式约定**:

- 第一行 = 表头 (固定中英对照), e.g. `科目编码 / Subject Code | 科目名 / Subject Name | ...`
- 第二行起 = 数据行, **以 `code` 为唯一键** (导入时 upsert, 不是 insert)
- 不含证据材料的列 (evidenceUrl 仅在 UI 上传)
- 单元格类型严格 (数值列禁止文本, 日期列 ISO 8601)
- 导入返回结果统计: `{ inserted, updated, skipped, errors: [{ row, message }] }`
- 失败行不阻塞成功行 (best-effort 模式), 错误列表回显 UI 让用户修正后重导

**安全约束**:

- 导出: 任何 KPI 查看权限的用户都可导出自己可见范围
- 导入: 仅 `kpi.subject_admin` (科目) / `kpi.write` (实例) / `kpi.manual_entry` (补录) 三类权限分别 gate
- 上传文件最大 10MB (避免 OOM); 行数最大 50,000 (单次导入上限)
- 100% 走 audit log: 谁、何时、上传哪个文件、影响多少行
- 导入预览模式 (`?dry-run=true`): 解析但不写库, 仅返回结果统计 (避免错误大批写入)

---

## §3 TTI 体系 · 战略成长空间 (= OKR 体系)

| 维度 | 规则 |
|---|---|
| **目的** | 沉淀工作方向、边界、进度、季度评估、高潜识别、价值传递 |
| **机制** | **柔性**, OKR 范式 (60-70% 完成 = 健康绿区间) |
| **核心** | 员工**自己填为核心**, **以信任为核心** — 不需 ERP / 主管验证, 不走严格审批, 重咨询轻考核 |
| **来源** | Bottom-up — 个人/团队提议, 主管 align (非审批), 公司 OKR 树挂载 |
| **周期** | **季度** (默认), 也支持半年/年/双月/月/自定义 |
| **薪酬关系** | **与奖金完全分离** — `affectsCompensation: false` 写死, 编译期阻断 |
| **得分意义** | 高分 → 未来战略空间 (升职 / 调岗 / 培养 / 高潜池) |
| **9-box 位置** | **横轴** |
| **代码命名约定** | OKR 体系内部沿用 Tita 范式: `Objective` / `KeyResult` / `Initiative` / `CheckIn`. **集合名 = TTI 体系** (= OKR 体系). 文档与 UI 标签统一称 "TTI". |
| **API 路径** | `/api/okr/*` (= TTI), `/api/tti/*` (legacy/alias) |
| **录入角色** | 任何员工 · 100% 自主填报 |

### 3.1 TTI 四要素结构 (员工填报表单)

每条 TTI (= OKR `KeyResult` 或 `Objective`) 都要覆盖四个要素，员工自主描述：

| 要素 | 说明 | 字段映射 |
|---|---|---|
| **改进实现** | 要进化到的未来状态 / 能力升级 / 价值交付点 | `Objective.description` + `KeyResult.title` |
| **推进事项** | 具体动作项 / 里程碑 / 推进子任务 | `Initiative[]` + `CheckIn.nextSteps` |
| **关键障碍** | 阻碍进度的问题 / 依赖 / 资源缺口 | `CheckIn.blockers` |
| **预期目标值** | 定量/定性目标设定 (员工自设) | `KeyResult.targetValue` + `KeyResult.measureType` |
| **实际进度** | 进度 % + 信心值, 员工 check-in 时填 | `KeyResult.currentValue` + `CheckIn.progressAfter` + `CheckIn.confidenceAfter` |

### 3.2 信任机制 · 软考核

- 主管只能 "align" / "评论" / "watch", 不能**驳回**员工填的 progress (仅能在 retrospective 阶段给 finalScore)
- TTI 不需 ERP 校验, 不设接入系统数据源 (除非员工自动选择挂接某个指标, 例如"发 5 个 PR"挂 GitHub)
- 60-70% 健康区间 → 鼓励员工设有挑战的 stretch goal, 不惩罚未达成
- audit-log 仅记关键生命周期事件 (create/archive/finalize), 不记每次 progress 填报变化

### 3.3 不可变铁律

- TTI 完成情况 **不允许影响任何形式的金钱回报** (含系数浮动, 含年终奖, 含调薪). 见 MANIFESTO §4.
- TTI 任何字段不允许新增 `affectsXxxComp / bonus / pay` 类字段.
- 60-70% 完成 = 健康. > 90% = 目标设过低 (橙色警告). 这与 KPI 100% 合格的语义完全不同.
- 主管不能修改下属的 TTI progress / blockers / nextSteps (只读可评论).

---

## §4 9-box 矩阵 · 双轨投影

```
                       ↑ 高 KPI (底线超额, 拿满奖金)
                       │
  🔄 人岗错位          │  🌱 升星人才       │  ⭐ 明星
  (低 KPI · 高 TTI)    │  (中 KPI · 高 TTI) │  (高 KPI · 高 TTI)
  ────────────────────┼────────────────────┼────────────────────
  😴 投入不足          │  🧱 核心力量       │  🚀 高产
  (低 KPI · 中 TTI)    │  (中 KPI · 中 TTI) │  (高 KPI · 中 TTI)
  ────────────────────┼────────────────────┼────────────────────
  🚨 必须干预          │  ➖ 平台期         │  ⚠️ 风险枯萎
  (低 KPI · 低 TTI)    │  (中 KPI · 低 TTI) │  (高 KPI · 低 TTI)
                       │
                       └──→ 高 TTI (战略成长好, 未来空间大)
              低 TTI                                 高 TTI
```

### 4.1 阈值

| 分位 | KPI | TTI |
|---|---|---|
| 高 | ≥ 0.90 | ≥ 0.70 |
| 中 | 0.70 — 0.89 | 0.40 — 0.69 |
| 低 | < 0.70 | < 0.40 |

KPI 阈值更严苛 (90% / 70%) 体现 "100% 合格" 的硬指标基线;
TTI 阈值更宽松 (70% / 40%) 体现 "60-70% 健康" 的成长性区间.

### 4.2 9 格语义解读

| 格 | 解读 | 管理动作 |
|---|---|---|
| ⭐ 明星 | 底线稳 + 战略成长好 | 关键保留, 升职/扩责任 |
| 🚀 高产 | 底线超额, 但成长一般 | 给挑战项目 / 拉 TTI |
| ⚠️ 风险枯萎 | 底线扎实但没有未来空间 | **干预** — 长期会枯, 给成长机会 |
| 🌱 升星人才 | 战略成长好, 底线接近达 | 关键培养, 给 KPI 突破机会 |
| 🧱 核心力量 | 双线中等, 稳健贡献 | 维持 + 选项激励 |
| ➖ 平台期 | 底线中等, 成长停滞 | 1on1 深聊, 找新方向 |
| 🔄 人岗错位 | 成长性好但坐错位置 | 调岗 / 换 KPI 类型 |
| 😴 投入不足 | 中等成长但底线不达 | 警告 + 主管深谈 |
| 🚨 必须干预 | 双线都低 | PIP / 调离 / 培训 |

---

## §5 实现路线 · 里程碑

### M1: 双轨语义对齐 (当前 sprint, ~30min)

- ✅ 本宽章创建 (本文档)
- 🔄 9-box UI 轴换位 (纵 KPI · 横 TTI)
- 🔄 9-box API 横轴接 KR 完成率, 纵轴 placeholder 0 (待 KPI 表)
- 🔄 独立 `TTI` interface 加 `@deprecated` 注释 (V2 合并到 OKR)
- 🔄 STATE-OF-THE-CODE 加 KPI 里程碑

### M2a: KPI 实表建设 + 管理通道 + 人工补录 + 科目主数据 + Excel I/O (下个 session, ~3d)

#### M2a-Core (~1d): 数据层 + 三通道 API

- ✅ `lib/types/kpi.ts`: `KpiCycle` / `KpiSubject` / `Kpi` (含 `scope: bonus|monitor` + `subjectId`) / `KpiCheckIn` / `KpiSnapshot` / `KpiManualEntry`
- ✅ Repository 注册 (kv-backed, 无需 Drizzle migration)
- 通道 A `/api/kpi/cycles` `/api/kpi` (HR/高管 setup)
- 通道 C `/api/kpi/manual-entry` (独立 endpoint, 角色 gate)
- 角色/权限位 `kpi.subject_admin` / `kpi.write` / `kpi.manual_entry` (财务/HR/部门内勤 默认启用对应位)
- audit log 接 KPI 事件: `kpi.target_set` / `kpi.target_locked` / `kpi.actuals_imported_erp` / `kpi.actuals_manual_entry` / `kpi.subject_changed` / `kpi.year_end_close`

#### M2a-UI (~1d): 三个 admin 页 + 个人页

- HR/高管页 `/admin/kpi/setup` (年度目标分解 · 三层 cascade 校验 · 按 subject + scope filter)
- 科目管理页 `/admin/kpi/subjects` (树形 CRUD + 软删除)
- 财务/HR/内勤页 `/admin/kpi/manual-entry` (补录工作台 · 仅 ERP 未覆盖 KPI 可选 · 必填 reason)
- 健康度看板 `/admin/kpi/health-dashboard` (全维度 monitor KPI 热力图 + 预警)
- 个人查看页 `/kpi` (仅 bonus scope 与个人挂钩的 KPI · 只读 actuals · 显示 dataSource 徽标)

#### M2a-Excel (~1d): Excel I/O

- 引入 xlsx 库 (`exceljs` 或 `xlsx`, 评估 bundle size)
- `/api/kpi/subjects/{import,export}-excel` (科目树批量导入/导出)
- `/api/kpi/{import,export}-excel` (KPI 实例批量 · code 为唯一键 upsert)
- `/api/kpi/snapshots/export-excel` (历史快照导出, BI/离线分析)
- `/api/kpi/manual-entry/import-excel` (财务/HR 月末批量补录)
- 导入预览模式 (`?dry-run=true`): 解析不写库
- 错误回显 UI: `errors: [{ row, message }]` 在每个 admin 页支持下载错误明细

### M2b: KPI ERP 采集通道 + 分析机制 (M2a + 1d)

- `lib/integrations/erp/`: 通用 ERP adapter (Pull-based 定时 + Push-based webhook 双模式)
- `/api/kpi/import` (内部接 ERP webhook, 校验签名, 写 actuals)
- 后台定时任务 `scanKpiActuals` (每日 02:00 拉一次)
- 8 个分析 endpoint (`/api/kpi/analytics/*`): cascade / ytd / period-on-period / yoy / quarterly / timeline / distribution / forecast
- 9-box 纵轴接通 KPI 真数据
- 个人 KPI 页 + Manager 仪表盘渲染分析图表 (Recharts)

### M2c: TTI 四要素 UI 加强 (M2a + 0.5d)

- `/okr` 页加 "四要素" 引导式表单 (改进实现 / 推进事项 / 关键障碍 / 预期目标值 / 实际进度)
- 主管视图禁用对下属 TTI progress 字段的写入权限 (仅评论)
- TTI check-in UI 突出"信任不审批"措辞 (UI 措辞: "记录, 不审批")

### M3: 整合到绩效奖金计算 (M2 + 1d)

- `lib/payroll/bonus-calc.ts`: 基于 KPI 完成率 × 基础奖金 × 系数
- 年终关闭流程: `/api/kpi/year-end-close`
- HR Dashboard 显示 KPI 分布 + 奖金池预算

### M4: 9-box 拉通到决策卡片 (M3 + 0.5d)

- 决策卡片 (议事室结论) 可以引用 9-box 格作为人才证据
- Persona 升级阶段判定可参考 9-box 位置

---

## §6 与现有系统的兼容性

### 6.1 现有的独立 `TTI` interface 怎么办

`@e:\Hermes\lib\types\okr-tti.ts:115-145` 那个独立 `TTI` interface (与 KR 平行的"个人成长目标"):

- **当前状态**: 仍被 13 个文件引用 (Convergence orchestrator / decision cards / 议事室上下文等)
- **决议**: 加 `@deprecated`, 但**不立即删除** (兼容现有调用方)
- **V2 合并方向**: 它的语义其实就是"个人成长 Objective", 应合并到 OKR `Objective` (`level: 'individual'`) 里
- **不允许新代码使用** `TTI` interface 创建新数据, 走 `Objective` + `KeyResult`

### 6.2 现有的 `affectsCompensation: false` 字段

- `TTI` interface 上的 `affectsCompensation: false` 是宪章 §4 的硬约束
- 即使 deprecate 也要保留这个字段的语义 — 任何"OKR-like" 软目标都不挂钱
- 将来 `Objective` / `KeyResult` 隐含 `affectsCompensation: false`, 不需要显式字段
- 将来 `Kpi` 实体显式 `affectsCompensation: true`, 与之对称

---

## §7 命名/术语规范 (UI 文档统一)

| 场合 | 用法 |
|---|---|
| 用户面前 (UI 标签) | "KPI" / "TTI" (TTI 不展开 OKR 三件套, 让用户感觉是统一体系) |
| 代码内部 | OKR 三件套 (Objective/KeyResult/Initiative/CheckIn) 沿用 Tita 范式 |
| API 路径 | `/api/okr/*` (现存) 或 `/api/tti/*` (alias). KPI 走 `/api/kpi/*` |
| 文档 | "TTI 体系 (= OKR 体系)" 同义并列, 优先用 TTI |
| 9-box 轴标签 | "KPI 完成率" 纵轴 / "TTI 完成率" 横轴 |

---

## §8 不可变规则总结

1. KPI 与奖金挂钩, TTI 与奖金永不挂钩 (含系数浮动)
2. KPI 阈值 90% / 70% / <70%; TTI 阈值 70% / 40% / <40%
3. 9-box 纵轴永远 KPI, 横轴永远 TTI
4. TTI 体系内禁止新增任何 `affects*Comp` / `bonus` / `pay` 字段
5. KPI 录入需 HR / 主管角色; TTI 任何员工自主
6. 本宽章修改需走 议事室 决策流程 (≥ Lv2 签批)
