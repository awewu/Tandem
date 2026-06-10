# 三省六部 · FP&A 引擎 × BSC × OKR 协同规格

> **2026-06-09 · Phase 2 续篇** · 上接 `GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md`
>
> 本文回答三件事：**①** BSC / OKR / FP&A 各对应三省六部的哪个环节；**②** 三系统如何输入输出、闭环；**③** 尚书六部执行单元＝成本中心，如何在文件与软件中标注、展示各自 BSC。

---

## 0 · 一句话机理

> **三省六部是「决策流转的管道」，BSC / OKR / FP&A 是「流经管道的工具」。**
>
> 事业部（中书）出主意 → 总部/FP&A（门下）用 BSC 底线和数字把关、能驳回 → 议事室（君）盖印 → 经营单元/生产/研发（尚书六部＝成本中心）执行落真值；FP&A 落账时切换成尚书户部。

三系统不是「一个省＝一个系统」的 1:1，而是各系统在管道不同环节当主角。角色**按事分**（一笔决策的流转阶段），不按部门钉死。

---

## 1 · 系统 × 三省 × 组织实体 × 治理职能 矩阵（SSOT）

| 三省 | 治理职能 | 主角系统 | 组织实体（默认） | 在该环节做什么 |
|---|---|---|---|---|
| **中书省** | 起草 / 提案 | **OKR 草案 + FP&A 推演** | **事业部** | 起草「本季打什么仗」(Objective/KR)；FP&A 产 `DeliveryBaseline` 当草案附件（预演方案会把 BSC 推到哪） |
| **门下省** | 审议 / 封驳 | **BSC 底线 + FP&A 差异** | **总部职能部门 + FP&A 部门** | 用 BSC 底线（`assessBscBalance` 四维平衡 / baseline-guard 红线）+ FP&A variance 把关，可驳回 |
| **君（在三省之上）** | 盖印 / 共识 | 议事室共识 + 中央 AI 治理 | 议事室 / 董事会 | 最终决策权；FP&A 门下只能放行/封驳，**不能替君盖印** |
| **尚书省·六部** | 执行 / 落真值 | **OKR 执行** | **经营单元 / 生产 / 研发 / 大区（＝成本中心）** | Initiative 由六部执行，`CheckIn`/`KpiCheckIn` 更新真值 |

### 1.1 系统主场定位

- **OKR** — 横跨 **中书（提案草案）→ 尚书（执行落地）**。既是被起草的「政令」，又是被执行的「工作」。
- **FP&A** — 横跨 **中书（辅助起草，产推演基线）+ 门下（差异/合规，当封驳依据）**。是**审议大脑**，本身不决策、不执行。
- **BSC** — 主场在 **门下（封驳底线＝考核标尺/国策）**，同时是 **尚书执行后产出的「体检结果」**（闭环点）。

### 1.2 三个校准点（落软件时必须守住）

1. **「君」在三省之上**：最终盖印权＝议事室共识，FP&A 门下只能封驳/放行。
2. **FP&A 双重身份**：做推演/审议 → 门下；做记账/出报表/落财务真值 → 尚书**户部**。按「本次动作是审议还是执行」判角色，不把整个 FP&A 钉死在门下。
3. **角色按事分**：事业部的「提案决策」职能＝中书；其下属经营单元的「执行」职能＝尚书。同一实体在不同环节戴不同帽子。软件里三省六部是**一笔决策的流转阶段标签**，不是组织架构树上的固定盒子。

---

## 2 · 尚书六部 ＝ 成本中心单元（核心新增）

**定义**：尚书省管理的每个执行单元（经营单元 / 生产 / 研发 / 大区 / 各职能司）＝一个**成本中心（cost center）**，对一组跨四维的 KPI 负责。

### 2.1 数据落点（复用现有模型，不新增实体）

成本中心 ＝ 一个组织层级单元，由 `Kpi` 的 `level` + `departmentId` / `assigneeId` 标识：

- `KpiLevel`（`@/lib/types/kpi.ts:102`）：`individual < department < system < business_unit < company`。
- 成本中心通常落在 `department` / `system` / `business_unit` 三层。
- 该单元的 BSC ＝ 用 `computeBscDistribution()` + `assessBscBalance()`（`@/lib/kpi/bsc-validation.ts`）**按该单元过滤后**的四维分布。
- `KpiSubject` 树（营收/成本/利润/现金流…）是**会计科目**，与「组织成本中心」正交：成本中心是「谁负责」，科目是「算什么账」。

### 2.2 每个六部单元都要体现 BSC

每个成本中心单元卡片必须展示其**四维 BSC**（growth → process → customer → financial），其中：

- **4 大强考核 KPI**（`scope='bonus'`，四维各 ≥1 个，`assessBscBalance` 守门）＝ 该单元年度底线，挂奖金、进 9-box。
- **其余 monitor KPI**（`scope='monitor'`）＝ 参考追踪，全维度健康，不碰奖金。
- 单元 BSC 健康度直接复用 `assessBscBalance` 的 `healthy/warning/imbalanced` 三级 + 雷达图。

---

## 3 · 三系统输入输出 / 闭环

```
①BSC setup(年): 各成本中心单元定4大bonus KPI(四维平衡) + monitor + causal战略地图
        │ target/strength
        ▼
②OKR setup(季): O/KR/Initiative, KR.targetKpiId+expectedKpiDelta ──锚定──▶ BSC KPI
        │ KR进度/CheckIn/Initiative状态 (过程内容)
        ▼
③FP&A推演(随时): 抓OKR live + 读BSC causal + KPI现值
        │  模拟: KR进度×expectedΔ → 直接KPI → causal传导(strength) → 下游KPI
        ▼
   DeliveryBaseline (投影末值, 不写真值)
        │
   ┌────┴───────────┬──────────────────┐
   ▼                ▼                  ▼
④门下/议事共识     ⑤真实交付→CheckIn   (持续)
  →commit绑定OKR    /KpiCheckIn更新真值
   └────────────────┴──── ⑥差异分析(actual vs baseline) ──┐
                                                          ▼
                          analyzeOkrHealth + validateCausalLink(修正strength)
                                                          │
                              反哺: 下季OKR调整 + BSC因果模型自我校正 ◀┘
```

**闭环点**：⑥ 的差异不仅归因 OKR 健康，还**反过来校正 BSC 战略地图的 `KpiCausalLink.strength`** —— causal 假设从主观打分进化为数据验证值（`validated=true`）。

### 3.1 边界铁律（守住才不污染真值）

- FP&A **只读 OKR/BSC、只产预测**，永不写 `KeyResult.currentValue` / `Kpi.currentValue` / bonus。
- 写 OKR 真值 → 仅 `CheckIn` / rollup / Initiative 驱动。
- 写 BSC 真值 → 仅 `KpiCheckIn` / ERP / 人工补录（`KpiManualEntry`）。
- 写 OKR 决策（commit/绑定）→ 仅议事室共识。

### 3.2 数据契约缺口（落地前置）

当前 `KeyResult`（`@/lib/types/okr-tti.ts:84`）**无任何指向 BSC `Kpi` 的字段**，`/kpi` 页靠标题模糊匹配做对齐（假联动）。FP&A 抓不到「OKR→BSC」因果起点。

**必须新增**：`KeyResult.targetKpiId?` + `KeyResult.expectedKpiDelta?`（或 `OkrKpiLink` 关联表）。这是中书↔门下的数据契约，没它门下无法对照 BSC 封驳。

---

## 4 · 软件展示标注规范（让大家一眼看懂）

> 目标：在每个相关界面用统一徽标/泳道标注「这是哪一省 / 哪一部 / 哪个成本中心 / 哪一维 BSC」。

| 界面 | 标注内容 | 实现要点 |
|---|---|---|
| OKR 详情 / KR 卡片 | `中书省·提案` 徽标 + 锚定的 `targetKpiId` BSC 维度色块 | KR 显示「驱动哪个 BSC KPI、预期 Δ」 |
| `/kpi`（BSC 看板） | `门下省·底线` 徽标 + 四维雷达 + 成本中心切换器 | 按 `level`+`departmentId` 过滤展示**单元 BSC** |
| 成本中心单元卡 | `尚书·{六部}` 徽标 + 该单元四维 BSC 健康度（healthy/warning/imbalanced） | 复用 `assessBscBalance`；4 大 bonus 高亮，monitor 弱化 |
| FP&A 推演面板 | `门下省·推演` + DeliveryBaseline（投影 vs 现值 vs 目标三条线） | 标「预测，非真值」水印，禁止误读为真值 |
| 三省六部治理页 | 阶段流转标签：中书→门下→君盖印→尚书六部 | stage 标签复用 `Pillar` + 君（议事室）节点 |
| 议事室 / DecisionCard | `君·盖印` 节点 + 关联 Initiative | commit 动作只在此处发生 |

**统一徽标文案**（SSOT，建议落 `design-tokens`）：

- 中书省 = `提案`（事业部出主意）
- 门下省 = `审议·封驳`（总部/FP&A 把关）
- 君 = `盖印·共识`（议事室）
- 尚书六部 = `执行·成本中心`（经营单元/生产/研发/大区）
- 户部（FP&A 落账态）= `执行·财务`

---

## 5 · 实际例子

**例 A · SLA 传导链（process→customer→financial，部门成本中心）**
- BSC 底线（研发体系，4 大之一）：process「核心系统 SLA」目标 99.9%（现 99.5%，weight 30）；customer「续费率」目标 92%（现 88%）。Causal：SLA→续费率 strength 0.6。
- OKR（Q2 手段，中书）：O「让核心系统稳如磐石」→ KR1「支付链路重构 100%」(`targetKpiId`=SLA, `expectedΔ`=+0.3pt)，Initiative「重构连接池」(挂议事室 DecisionCard)。
- FP&A 推演（门下，Q2 中，KR1 进度 60%）：SLA 投影 = 99.5 + 0.3×60% = 99.68% → causal 传导 → 续费率 88→89%；折算 ARR +120 万。落 DeliveryBaseline。
- 闭环（Q2 末）：KR1=100% 但 SLA 实际 99.65%（< 推演）。差异归因：causal strength 高估 → `validateCausalLink` 0.6 下修 0.45 → 下季 OKR 提示「光重构不够，需配套告警 KR」。

**例 B · 技能驱动交付（growth→process，个人 / TTI 语义）**
- BSC 个人底线（growth bonus）：「关键技能掌握度」；monitor：技术分享次数。
- OKR（个人手段，按 TTI 健康区间 60-70%，不挂钱）：KR「3 个 AI 工具内训 + 落地 2 个自动化脚本」。
- FP&A 推演：个人 KR 进度 → 经 growth→process causal 投影部门「研发交付率」提升。
- 闭环：实际交付率验证「技能↑→交付↑」假设。

**例 C · 销售直驱财务（financial，事业部成本中心）**
- BSC（事业部 financial bonus）：「事业部营收」目标 5000 万。
- OKR（中书）：O「拿下 3 个标杆客户」→ KR「签约 ARR ≥ 1500 万」(`targetKpiId`=营收, `expectedΔ`=+1500 万)。
- FP&A 推演：抓 pipeline 进度（60%＝2 单在谈）→ 投影营收达成时点 + 现金流 → rollup 到公司 BSC financial。
- 闭环：实际签约 vs 推演 → 修正「pipeline→营收」转化率假设。

---

## 6 · 落地清单（最小改动）

- [x] **数据契约桥**：`KeyResult` 加 `targetKpiId?` + `expectedKpiDelta?`（`lib/types/okr-tti.ts` + `lib/store/okr.ts`；KvStore JSON 存储无需迁移；OKR 编辑器加锚定字段）。
- [x] **DeliveryBaseline 投影器**：`lib/governance/delivery-baseline.ts` 纯函数（OKR 进度 × expectedΔ + causal 改善比例传导）+ `analyzeBaselineVariance` 差异 + 单测 9/9 绿。
- [x] **成本中心 BSC 视图 + FP&A 推演视图**：`components/governance/fpa-views.tsx`，接入 `/governance/three-departments` 视图切换（按 `level`+`departmentId` 过滤 `computeBscDistribution`/`assessBscBalance`；FP&A 视图抓 OKR 锚定 KR → DeliveryBaseline）。
- [x] **三省徽标语义升级**：`PILLAR_META` 加 `who`/`desc`（中书=事业部 / 门下=总部·FP&A / 尚书=经营单元·成本中心）。
- [x] **差异/校正闭环（机理层）**：`lib/governance/baseline-calibration.ts` 纯函数 `calibrateCausalStrength`（baseline vs actual → 按入边贡献占比分摊差异 → 每条 `KpiCausalLink` 产 strength 校准建议 + validated 信号；`maxStep` 限幅）+ 单测 8/8 绿。`delivery-baseline` 因果贡献加 `linkId` 溯源贯通。**只产建议不写库（宪法 A）**。
- [x] **校准建议落地（人工批准链路）**：发现既有 `PATCH /api/kpi/causal-links/[id]` 已是受 `kpi.write` 守门的写回原语（strength + validate），无需新写动作。新增纯映射 `toCausalLinkPatch`（建议→PATCH 体）+ FP&A 视图 `CalibrationPanel`：列校准建议、人工点「应用」走既有 PATCH 写回（**不自动写**，宪法 A）。单测 9/9（含映射）。
  - 备注：因 OKR 为客户端 zustand，baseline/校准在 FP&A 视图客户端算（server 读不到 KR drivers），故走「人工 Steward 批准」而非 `proposeAction`（后者是员工分身自委托，校准属治理配置变更）。
- [ ] **KR 锚定方向校验**（KR.targetKpiId 与 KPI 维度方向一致性提示）+ **推演 commit→议事室盖印**（下一阶段）。
- [ ] **隐式反馈**：close 时无人工应用/否决的建议，按策略归档（下一阶段）。

> 已落：①数据契约桥 → ②DeliveryBaseline 纯函数+单测 → ③成本中心 BSC + FP&A 视图 + 徽标 → ④差异校正纯函数+单测（linkId 溯源） → ⑤校准建议人工批准链路（CalibrationPanel + 既有 PATCH 写回）。
