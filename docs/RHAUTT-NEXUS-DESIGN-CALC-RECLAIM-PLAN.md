# 设计精算归位方案（design 模块）

> 状态：待评审（设计阶段，不含实现代码）· 2026-06-29
> 上游决议：`RHAUTT-NEXUS-MODULE-COMPLETENESS-AND-DATAPORT-BLUEPRINT.md` 已拍板 #1 精算优先 / #3 opportunity 强制脊柱
> 事实源：实读 `services/api/src/modules/design` · `server/core/*` · `packages/domain/hvac-kernels/*`
> 目标：把"五系统一键精算 + 必算硬校验 + 复核签章"从 legacy 归位到 `design` 领域服务，作为方案/报价可信度的根。

---

## 1. 现状事实（实读结论）

### 1.1 内核已部分迁入共享包，但 design 没用上
- `packages/domain/hvac-kernels/` 是**正式内核家**（`foundation.sharedNonVisual`，可跨应用复用）。已迁 7 个：`load-calculation/LoadCalcV3`、`hot-water`、`fresh-air(FreshAirPro+DOASCompliance)`、`hydraulic`、`heating`、`air-conditioning`、`quotation`。
- `server/core/{HotWater,FreshAir,DOAS,Heating,AirConditioning,Hydraulic,LoadCalcV3,Quotation}Engine.js` 已是**指向 kernels 的薄壳**。
- **但 `design.service` 仍 `require('server/core/LoadCalculationEngineV3')`（壳），且只调 `quickEstimate`**——既走了旧路径，又只用了一个引擎的一个方法。

### 1.2 编排器与部分内核仍是 legacy 真身（未迁）
- `OneClickCalculationEngine`（**七系统编排器**：hotwater/water/freshair/cooling/doas/heating/control）= server/core 本地真身。
- `CalculationEngine` / `FiveConstantEngine` / `WaterSystemEngine` / `CommercialTaxEngine` = 本地真身，**未迁 kernels**。

### 1.3 必算项散落、无统一出图闸（最大风险）
- 必算项分布：噪声/同时系数/alpha 主要在 server/core 真身；结露/水力 kernels 有部分。
- `OneClickCalculationEngine` 的 `compliance` 字段**仅覆盖 DOAS 段**（L348-376），不是全系统统一校验。
- 即：PRD「同时使用系数 / 噪声 / 水力 / 结露 必算，作出施工图分水岭」**当前无单一闸强制**。

---

## 2. 归位目标架构

```
design.controller  ──▶  design.service  ──▶  [CalcOrchestrator]  ──▶  packages/domain/hvac-kernels/*（唯一内核源）
                                                     │
                                                     ├─ 五系统(实为7)计算
                                                     ├─ ★必算硬校验闸（出图分水岭）
                                                     └─ 复核签章 + 免责声明
                              落库: design_project / floor_plan / calc_result（挂 design_id + opportunity_id）
                              出事件: design.changed ──▶ (单一 outbox) ──▶ quote 重算（守快照锁）
```

**两条铁律**：
1. **唯一内核源 = `packages/domain/hvac-kernels`**；`design` 不再 import `server/core` 壳，不在 design 内重写算法。
2. **未迁真身先迁 kernels 再被 design 调用**（OneClick/FiveConstant/WaterSystem/CommercialTax），保持"应用→数据口→共享内核"单向依赖。

---

## 3. 两层模型：五恒维度（体验目标） + 独立系统（交付设备）

**铁律：五恒 ≠ 五系统。** 五恒是舒适**维度/验收目标**（跨系统组合达成）；系统是**独立交付设备**。对外两层都如实体现，不把系统压成 5。

### 3.1 五恒维度层（验收/体验，权威源 `FiveConstantEngine.STANDARDS`）
| 维度 | 国标指标 | 由哪些系统达成 |
|---|---|---|
| 恒温 | 24±1℃ | 采暖 + 制冷（辐射供冷供暖） |
| 恒湿 | 50±10%RH | 除湿/湿度控制（含 DOAS 潜热） |
| 恒氧 | CO₂ <1000ppm | 新风（置换新风） |
| 恒洁 | PM2.5 <35μg/m³ | 新风净化（H13） |
| 恒静 | <35dB | 隔音降噪（→ 噪声校验闸） |

### 3.2 系统层（独立体现，对齐 OneClick 七函数）
| 独立系统 | 内核 | 贡献维度 | 现状 |
|---|---|---|---|
| **热水**（生活热水，独立） | hotwater | — | ✅ kernels |
| **净水**（直饮/软水，独立） | water (`WaterSystemEngine`) | — | ❌ 待迁 |
| **采暖**（辐射/地暖，独立） | heating | 恒温 | ✅ kernels |
| **制冷**（辐射/空调） | cooling (`air-conditioning`) | 恒温 | ✅ kernels |
| **新风**（置换新风） | freshair | 恒氧+恒洁 | ✅ kernels |
| **除湿/湿度**（恒湿核心） | doas/humidity (`fresh-air` + `FiveConstantEngine.designHumidityControl`) | 恒湿 | 🟡 部分迁 |
| **控制**（五恒大脑） | control (`FiveConstantEngine` 真身) | 五恒联动 | ❌ 待迁 |
| 编排 | `OneClickCalculationEngine` (真身) | — | ❌ 待迁 |
| 负荷/水力 | `load-calculation`/`hydraulic` (kernels) | 恒温/管路 | ✅ kernels |

**design 对外数据口**（数据口蓝图 B.2）：
- `POST /api/v2/design/calc`（一键精算，入 opportunity_id + 户型/参数 → 出**七系统结果 + 五恒维度达标表 + 校验闸结论 + 签章态**）。
- 复用现有 `floor-plans/projects/load-calc`。

---

## 4. ★必算硬校验闸（出图分水岭）

这是本方案的核心新增——**把散落的必算项聚合成单一 Gate，未通过不得出施工图/锁报价**：

| 必算项 | 来源内核 | 闸规则（示例，待精度基线确认） |
|---|---|---|
| 同时使用系数 | WaterSystem(alpha)/各系统 diversity | 缺系数或越界 → 阻断 |
| 噪声 | （legacy 真身，待迁/补） | 超标分贝 → 阻断 |
| 水力（压损/平衡） | `hydraulic` (kernels) | 压损超限/失衡 → 阻断 |
| 结露 | `fresh-air`/kernels 部分 | 露点风险 → 阻断 |

- **Gate 输出**：`{ pass: bool, blockers: [...], warnings: [...] }`。
- **强制点**：`pass=false` → ① 不可生成施工图（rysnova-bim 深化拒绝继承）；② 不可锁报价（quote `lock` 拒绝）。
- **落点建议**：作为 `CalcOrchestrator` 的收口步骤，统一聚合各内核的合规字段（补 OneClick 仅 DOAS 段的盲区）。

---

## 5. 复核签章 + 免责声明
- 精算结果产出后进入 `draft → reviewed(签章) → released` 状态；仅 `released` 可驱动出图/锁价。
- 签章记录复核人/时间/版本（落 `calc_result.meta` 或独立审计）；附标准免责声明文本（参数来源/精度边界）。
- 与 rysnova-bim `design-sync`(M12) 对齐：签章版本即 design 真相源版本锚点。

---

## 6. 决议落点（opportunity 强制 + 联动报价）
- **opportunity 强制（决议#3）**：`design_project` / `calc_result` 必须挂 `opportunity_id`（现 `meta.customerId` 不足），无 opportunity 不得落精算结果。
- **联动报价**：精算 `released` 或 `design.changed` → 发**单一 outbox** 事件 → `quote` 按需重算；**守快照锁**——已锁报价不自动跟变，需经销商显式确认重算（PRD §4.9）。

---

## 7. 分阶段归位（可独立验证）

| 阶段 | 内容 | 验证 |
|---|---|---|
| P1 | design.service 改指 `packages/domain/hvac-kernels`（弃 server/core 壳） | 现有 quickEstimate/load-calc 行为不变 |
| P1 | 迁 `OneClickCalculationEngine` → kernels，design 暴露 `POST /design/calc` 编排七系统 | 七系统结果与 legacy 一致（回归基准集） |
| P1 | 迁 `WaterSystemEngine` / `FiveConstantEngine(control)` → kernels | 水系统/控制纳入编排 |
| P1 | **必算硬校验闸**聚合 + 强制点（拒出图/拒锁价） | 缺必算项时 Gate 阻断，且报价锁被拒 |
| P2 | 复核签章 + 免责声明状态机 | 仅 released 可出图/锁价 |
| P2 | `design.changed` 单一 outbox → quote 重算（守快照锁） | 改型触发重算，已锁报价不自动跟变 |
| P2 | 迁 `CommercialTaxEngine` → kernels（与 quote 税费共用） | 税费口径统一 |
| P3 | TCO 十年账 + 三档方案对比联动 | 三档切换实时联动报价 |

---

## 8. 已拍板决议（2026-06-29）
1. **校验闸精度基线 = 国标为底线**：同时系数/噪声/水力/结露以国标（GB 50736 等）为底线，企标只能更严不能更松；据此建回归基准集（需 HVAC 专家产出基准数据）。
2. **噪声内核 = 新建独立 `noise` kernel**：在 `packages/domain/hvac-kernels/noise` 收口散落的噪声逻辑，纳入校验闸。
3. **对外系统口径 = 两层模型（系统独立 + 五恒维度层）**：对外按**独立系统**如实体现（热水/净水/采暖/制冷/新风/除湿/控制，各自独立、不合并），其上叠加**五恒舒适维度层**（恒温/恒湿/恒氧/恒洁/恒静，作验收目标）。**五恒 ≠ 五系统**；湿度=恒湿维度，由独立除湿/湿度控制系统交付。详见 §3。
4. **签章法律责任 = 经销商自负合规 + 电子签，平台不深度介入**：
   - 复核合规与设计责任**归经销商**（经销商是对客主体）；电子签由经销商完成。
   - 平台/制造商**仅提供工具与电子签能力，不背书、不承担设计责任、不深度介入**——契合"中立第三方工具"阳谋定位。
   - **免责声明**必须明确：精算为工具辅助、责任主体为经销商；平台不对设计结果担责。

### 决议传导
- §4 校验闸阈值以国标为基线建基准集；新增 `noise` kernel 作为校验闸输入源。
- §5 复核签章语义改为"**经销商自负责任 + 电子签**"：签章=经销商法律确认，平台只记录与提供签署能力；免责声明前置。

---

## 9. 不做什么
- 不在 `design` 模块内重写/复制 HVAC 算法（必须调 kernels）。
- 不让未过校验闸的方案出施工图或锁报价。
- 不绕过 opportunity 落精算结果。
- 不自动改写已锁报价（守快照锁）。
