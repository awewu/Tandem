# 三件套进化蓝图 · 解耦 × Gems 补缺 × DB/模块升级（2026-07-05）

> 性质：可排期的执行蓝图（评审通过后逐套件动手）。基于当前代码实读。
> 上位对齐：`RHAUTT-NEXUS-MODULE-COMPLETENESS-AND-DATAPORT-BLUEPRINT.md`(06-29)、
> `RHAUTT-NEXUS-DUAL-IMPLEMENTATION-CONVERGENCE-LEDGER.md`(07-03)、
> `RHAUTT-NEXUS-THREE-SUITE-CLOSED-LOOP-DELTA-2026-07-05.md`、`RED-TEAM-PERSONAS.md`(6 Gems)。

---

## 0. 大前提与新标准（贯穿全蓝图）

### 0.1 唯一姿势：只进化 target，生产零风险
- 目标态 **NestJS + Postgres `rhautt_nexus`** 尚未上生产（生产 = Legacy Express + Mongo）。
- **所有解耦/补缺/DB 升级/模块重组只在 target 侧做**；Legacy 重复实现**只登记不删**，退役留到四闸全绿的网关切流（W5/W6）。

### 0.2 模块解耦标准（限界上下文）
- 每套件 = 独立限界上下文：独立 `moduleNamespace` + 独立 `/api/v2` 数据口契约。
- 跨上下文**只走 outbox 事件**（`mdm/outbox-event`），禁跨模块直接 import。
- **单一真相源**：每能力 NestJS 只保留一处；签收/验收统一归属（消除 07-03「4 处重复」）。

### 0.3 数据库标准
- Postgres `rhautt_nexus` 为唯一 SoT；**策展 SQL 迁移递增**（现最高 `019`，本蓝图新增 `020–025`）。
- 每表 `tenant_id` + **RLS FORCE**；PII 走 hash+encrypted 双列（PIPL）。
- 统一主数据 ID（MDM 签发），`opportunity_id` 为经营脊柱。
- TypeORM `synchronize` 永关；实体↔迁移零漂移。

### 0.4 每套件统一 5 步动作
`①解耦盘点 → ②Gems 复查缺口 → ③目标表+数据口契约 → ④target 实现 → ⑤Legacy 重复登记待退役`

---

## 1. ① 瑞诺瓦 AI 问诊（diagnosis · ~40%）

**①解耦盘点**：现有表 `diagnosis_sessions`（含 `opportunity_id/customer_id/report_id/share_token_hash/source_surface`）。耦合点：与 CRM（派单/归属）、compliance（同意）、product-catalog（推荐）跨界。目标边界：问诊只产出「画像+报告快照」，派单/归属交 CRM，同意交 compliance。

**②Gems 复查（G1 消费洞察官）**：
- ❌ **PIPL 同意闸（P0）**：C 端采集前无授权（`consent` 表已存在，缺调用）
- ❌ 真 LLM 未接（`ai_reasoning` 仅存字段）
- ❌ 多轮澄清对话
- ❌ **问诊→派单**：`dispatch_routing_decisions` 表已就绪，缺 diagnosis 触发
- ❌ 十年 TCO 全生命周期账

**③目标表+数据口**：
- **新迁移 `020_diagnosis_reports_and_consent_link.sql`**：新增 `diagnosis_reports`（报告快照/版本/分享，替代裸 `report_id`）；`diagnosis_sessions` 增 `consent_id`、`tco_snapshot jsonb`。
- 数据口：`POST /diagnosis/complete`（同意校验前置）→ 事件 `diagnosis.report.created`、`lead.captured`（触发 dispatch）。

**④target 实现**：接 compliance 同意闸（P0 先行）；接真 LLM 或桥接 legacy `LLMDiagnosisEngine`；`diagnosis.report.created` → 经 outbox 触发 `dispatch` 派单。

**⑤Legacy 待退役**：`pain-diagnosis.html`（2414 行）逻辑迁 `consumer-diagnosis` app（台账 C2）。

---

## 2. ② 瑞诺瓦舒适家居 CRM（crm · quote · delivery · lifecycle）

**①解耦盘点**：表 `customers/opportunities/interactions`（crm）、`quotations`（quote）、`lifecycle_links`（14 态富投影，已从 Mongo 收敛）、`contracts`（`006` 已建）、`dispatch_*`（`015` 已建）。耦合点：归属/撞单跨 dealer、quote↔contract↔payment、delivery↔lifecycle。

**②Gems 复查（G4 经销商操盘手）**：
- ❌ **§4.8 归属规则引擎**（现仅 `owner_user_id` 字段，无首触/区域/分配规则）
- ❌ 跨 dealer 撞单裁决（现仅 tenant 内 `phone_hash` 去重）
- ❌ 离职交接、SLA/跟进提醒/任务流
- ❌ **电子签约**（`opportunities.sign` 仅标记，非电子签）
- ❌ 收款节点（定金/进度款/尾款）联动 delivery

**③目标表+数据口**：
- **`021_crm_attribution_and_handover.sql`**：`crm_attribution_rules`（首触/区域/分配）、`crm_collision_cases`（撞单裁决）、`crm_owner_handovers`（离职交接）。
- **`022_quote_payment_and_esign.sql`**：`payment_schedules`（节点：定金/进度款/尾款，联动 delivery 里程碑）、`contract_signatures`（电子签存证，扩展现有 `contracts`）。
- 数据口：`opportunity.assigned`/`opportunity.stage.changed`、`quote.locked`/`quote.signed`/收款节点事件（全走 outbox）。

**④target 实现**：归属/撞单/交接规则层（与派单器共用裁决原语）；接第三方电子签（e签宝，webhook 存证 file-artifact）；delivery 里程碑完成 → 自动触发 payment_schedule 收款节点。

**⑤Legacy 待退役**：经销商 5 阶段并入 `dealer-workbench`（台账 R-1，~40 遗留页）；`quotation`(Legacy) → `quote`(NestJS) 收敛；`business-console` 去重（D-1）。

---

## 3. ③ 瑞诺瓦技术支持（design · rysnova-bim）

**①解耦盘点**：`design` 表 `floor_plans`（桥 `LoadCalculationEngineV3`）；`rysnova-bim` 产物全生命周期 + M12 design-sync 单一真相源（`002`）。耦合点：design↔bim（M12 已治理）、design↔quote（BOM 继承）、精算内核仍在 legacy。

**②Gems 复查（G2 暖通总工 / G3 BIM 交付）**：
- ❌ **五系统精算**（HS/WT/AIR/HEAT/CTRL，现仅 1 桥）+ DOAS 两档
- ❌ **必算硬校验**（同时使用系数/噪声/水力/结露）——出图分水岭
- ❌ 复核签章 + 免责声明
- ⚠️ 真几何/碰撞检测/净高/管综（`bim_data` jsonb 占位）
- ❌ 2D↔深化一致、版本冻结签章

**③目标表+数据口**：
- **`023_design_calc_results_and_signoff_gate.sql`**：`design_calc_results`（五系统结果 + 硬校验通过位）、`design_signoffs`（复核签章/免责）。
- **`024_bim_geometry_and_version_freeze.sql`**：`bim_versions`（版本冻结/回滚）、几何/碰撞结果表或显式标 `demo`。
- 数据口：`design.changed`（→ bim M12）、`design.signed-off`（出图闸）、`artifact.approved`。

**④target 实现**：桥接 legacy `CalculationEngine/FiveConstantEngine/DOASComplianceEngine` 或归位 `packages/domain/hvac-kernels`；硬校验作出图闸；`rysnova-bim-workbench` 空壳补 2D 画布/BOM（台账 D-2/R-4）。

**⑤Legacy 待退役**：`rysnova-bim-designer.html`/`designer.html`/`floorplan-bim.html` → `designer-workbench` + `rysnova-bim-workbench`（台账 C4）。

---

## 4. 迁移号台账（提议，评审后锁定）
| 迁移 | 内容 | 套件 | 前置 |
|---|---|---|---|
| `020_diagnosis_reports_and_consent_link` | 报告快照表 + 同意/TCO 列 | ① | consent(007) |
| `021_crm_attribution_and_handover` | 归属/撞单/交接表 | ② | crm(001) |
| `022_quote_payment_and_esign` | 收款节点 + 电子签存证 | ② | contracts(006) |
| `023_design_calc_results_and_signoff_gate` | 五系统结果 + 硬校验 + 签章 | ③ | design(008) |
| `024_bim_geometry_and_version_freeze` | 版本冻结 + 几何/碰撞 | ③ | bim(002) |
| `025_lifecycle_warranty_registration` | 品牌站保修回流 lifecycle | ② | lifecycle(013) |

> 每张迁移遵守 §0.3：`tenant_id` + RLS FORCE + 索引；实体同步更新，`tsc` + `apply-migrations` + `rls-apply-proof` 三绿。

---

## 5. 波次与验收门
- **W-A（P0 先行）**：`020` 同意闸 + 问诊→派单接线（发布门级 P0）。
- **W-B（经营闭环）**：`021`+`022` CRM 归属/撞单 + 电子签/收款 → 打通 `报价→合同→施工→验收`。
- **W-C（技术核）**：`023`+`024` 精算五系统 + 必算硬校验 + BIM 版本冻结（依赖内核归位，工作量最大）。
- **W-D（回流）**：`025` 保修回流 + IoT 落库脱 mock。
- **验收门（每波）**：`tsc --noEmit` 绿 · 迁移可 apply · RLS proof 绿 · 对应 guard 绿 · 契约测试（`test:contracts`）绿 · 关键路径 e2e。

## 6. Legacy 待退役登记（收敛台账回填，不删）
每完成一套件 target 实现，将对应 Legacy 实现（`server/modules/{diagnosis,crm,quotation,lifecycle,rysnova-bim}` + `public/*.html`）标记为「待退役·当前真相源仍为生产」，回填 `RHAUTT-NEXUS-DUAL-IMPLEMENTATION-CONVERGENCE-LEDGER.md`，退役经四闸网关切流。
