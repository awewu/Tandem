# Rhautt Nexus 完整开发方向 · 定稿汇报（评审团过堂版）

> 状态：定稿待批 · 2026-06-28 · 由 10 位评审官 Gem（`docs/RED-TEAM-PERSONAS.md`）对蓝图过堂后产出
> 输入事实源：RHAUTT-NEXUS-REARCH-BLUEPRINT · RENOVA-ENABLEMENT-LOCKED-SPEC · FEATURE-AND-GAP-LEDGER · platform-modules.json
> 裁决口径：✅通过 / 🟡有条件通过(需补) / ⛔打回(阻断发布)

---

## 第一部分 · 评审团对蓝图的裁决

| Gem | 代表 | 裁决 | 最尖锐发现（蓝图缺口） |
|---|---|---|---|
| 1 业主洞察 | C 端用户 | 🟡 | ①问诊仅骨架/legacy；TCO 十年账、改造分支、PIPL 同意均为 [推演] 未落 |
| 2 暖通总工 | 设计师 | ⛔ | 五大系统**同时使用系数/噪声/水力/结露**落地必算未证；精度回归基线无第三方复核 |
| 3 BIM 总监 | 技术支持 | ⛔ | **M12 单一真相源 MISS**；rysnova-bim-workbench 空、BIM 寄生在 dealer-workbench |
| 4 经销商操盘手 | 经销商 | 🟡 | 留客抓手依赖"价值落差"但**精算/物料同源未交付**；brand-console/DAM 授权缺 |
| 5 数字化合规官 | 总部 | ⛔ | **M14 等保/PIPL MISS（P0 发布闸）**；契约覆盖率 17%；RLS 未 staging |
| 6 竞争战略 | 市场 | 🟡 | 护城河=标准计算+物料同源+情报网，**三项恰是未交付项**，窗口期优势易被复制 |
| 7 平台工程师 | IT 工程 | ⛔ | 两后端并存未收口；事件总线推迟却无 P1/P2 **过渡直连方案**；MDM 副本一致性边界未定 |
| 8 架构治理 | 架构师 | 🟡 | **五处事实源**(宪章/PRD/locked/target/product-modules)仲裁规则缺；15模块↔2板块↔4数据面映射需对齐 |
| 9 施工交付经理 | 施工 | ⛔ | delivery **验收留证/进度款联动/物料齐套/资产交接断链**全为 [推演] 未落 |
| 10 店长/一线销售 | 销售 | 🟡 | 派单 SLA、现场报价时效、移动端一等公民、第三方报价不劣化 均未落 |

**裁决汇总**：⛔ 打回 5（Gem 2/3/5/7/9）· 🟡 有条件 5（Gem 1/4/6/8/10）· ✅ 0。
**结论**：蓝图**方向正确、结构成立**，但**不可直接进入交付**——5 项阻断必须先清。

---

## 第二部分 · 评审共识（合并去重的阻断/必补项）

**A. 发布闸（P0，不达不上线）**
- A1 **M14 中国合规**：PIPL 同意管理 + 数据保留/出境 + 等保二级备案（Gem5/1）。
- A2 **契约覆盖率收口闸**：599 端点 17%→目标，每迁一端点强制补 OpenAPI，guard 卡住漂移（Gem5/7）。

**B. 工程接缝（P1，套间协同前提）**
- B1 **M12 design↔rysnova-bim 单一真相源**（Gem3/8）。
- B2 **M15 数据总线/MDM + P1/P2 过渡直连方案 + 副本一致性边界**（Gem7）。
- B3 **后端收口**：Express+Mongo → NestJS+PG 的 expand-contract 迁移、双写双读窗口、回滚点（Gem7）。
- B4 **事实源仲裁规则**：五处边界文档定唯一仲裁顺序（Gem8）。

**C. 领域可信（P1，差异化护城河）**
- C1 **design 精度回归基线**：同时使用系数 + 噪声/水力/结露必算 + 第三方复核接口（Gem2/6）。
- C2 **产品库 verified 可信链**：精算必填参数契约 + CDC 同步校验 + 死信处理（Gem4/7）。

**D. 闭环落地（P1/P2，端到端可成单）**
- D1 **问诊建设 + 问诊→派单 SLA**（Gem1/10）。
- D2 **电子合同签约 + 报价时效/折扣审批**（Gem4/10）。
- D3 **delivery 交付闭环**：验收影像/电子签留证 + 进度款节点联动 + 物料齐套 + 安装→lifecycle 资产交接（Gem9）。
- D4 **移动端一等公民 + 分享页转化 + 第三方报价不劣化**（Gem10/4）。

---

## 第三部分 · 定稿开发方向（分阶段路线）

```
Phase 0  共识收口（进行中，基本完成）
  - 蓝图/锁定规格/platform-modules/功能台账 已建 ✅
  - 补：事实源仲裁规则(B4) + 声明层(brand-registry 对齐, rheem/ruud 外链)

Phase 1  发布闸 P0（不达不开放）
  - A1 M14 合规闸（PIPL 同意 + 数据保留 + 等保备案启动）
  - A2 契约覆盖率收口闸（OpenAPI guard 卡漂移）
  - RLS staging 迁移证明 + 数据备份 restore 演练
  - 出口标准：crosswalk MISS=0、契约达标、2 租户端到端演练

Phase 2  工程接缝 P1（套间真打通）
  - B1 M12 真相源 · B2 M15 总线/MDM(+过渡直连) · B3 Express→NestJS+PG 收口
  - C1 design 精度基线 · C2 产品库可信链 CDC
  - D1 问诊建设 + 派单 SLA · D2 电子合同

Phase 3  件套成型 P1/P2（端到端成单）
  - ②CRM：收编 legacy crm/sales 原型 + customer-portal 建成
  - ③BIM：从 dealer-workbench 拆出 → rysnova-bim/designer-workbench + 收编 legacy bim
  - D3 delivery 交付闭环（留证/进度款/齐套/资产交接）
  - 板块一：集团官网(aosmith×ruud) + Everhot 精修 + brand-console + DAM 授权

Phase 4  增强 P2/P3
  - D4 移动端一等公民 · DigitalTwin 真三维 · 运行反哺精算 · 情报网/转化仪表盘
  - 第 4 件套扩张机制验证（产品注册 + 复用底座）
```

---

## 第四部分 · 验收门禁（每阶段过 Gems 复审）

| 阶段 | 出口门禁 | 复审 Gem |
|---|---|---|
| P0 | 合规备案启动 + 契约达标 + 备份演练 + MISS=0 | Gem 5/7 |
| P1 | M12/M15 落地 + RLS staging + design 精度基线 | Gem 2/3/7/8 |
| P2 | 问诊→派单→报价→合同 端到端跑通 | Gem 1/4/10 |
| P3 | 完整闭环第一单(含施工验收收款) + 三件套独立可上线 | Gem 9/4/全员 |

---

## 第五部分 · 事实源仲裁与一致性收口（落实 Gem8 / B4）

**单一事实源仲裁顺序（冲突时从上到下）**：
1. `PROJECT-CHARTER.md`（宪章 v1.4，最高人读事实源）
2. `governance/locked-goal.json`（**机器可读锁定源**，状态 `locked-active-not-production-complete`）
3. `PRD-v2.md`（宪章的需求展开）
4. `platform-modules.json` + `contracts/`（板块/模块/契约声明）
5. 本批文档（蓝图 / 锁定规格 / 台账 / 定稿）= 上述的**派生视图**，冲突时回溯 1–4

**与 locked-goal.json 对账结论（已收口）**：
- ✅ 定位、瑞诺瓦=Rysnova、三件套、双栖、IoT handoff、namespace 保留 —— 完全一致。
- ⚠️ **CRM 件套差别**：locked-goal 的 `independentProductModules` 只注册了 **问诊 + BIM** 为可独立上线模块；**CRM 是件套但更深共享底座、未单独 standalone 注册**。三件套模型成立，差别已在锁定规格注明。
- ⚠️ legacy HTML 数量以 locked-goal 为准 = **105**（非 106）。
- ⚠️ 既有 17 人 `developmentGroup`（agent 控制层）与本批 10 个评审 Gem **互补**：前者是"造的人"，后者是"挑刺的人"，不冲突。

**仍未关闭的缺口（诚实标注）**：
- 🔴 **PRD「遗憾2」未定位**：PRD §12 仅有 12.1(遗憾1)/12.2(遗憾3)，遗憾2 全仓未检索到 —— 待用户提供或确认是否已废弃。
- 🟡 **路由/契约数待重核**：实测 express route handlers ≈ **825**（personas 引用的 599 口径不同），17% 契约覆盖率需以 guard 重新出证。

## 定稿结论

- 蓝图**结构与定位获评审团认可**，可作为开发纲领；但**进入交付前必须先清 5 项阻断（A1/A2/B1/B2/B3 + C1/D3）**。
- 真正的护城河（标准级计算 C1、物料同源、情报网）= 当前最大未交付项，**优先级应高于功能堆砌**（Gem6 警示）。
- 交付节奏锁定为 **P0 发布闸 → P1 接缝 → P2/P3 件套成型**，每阶段 Gems 复审，杜绝"文档很美落不了地"。
