# Rhautt Nexus 完整开发计划（主计划）

> 状态：可执行 · 2026-06-28 · 事实源仲裁：宪章 > governance/locked-goal.json > PRD-v2 > platform-modules/contracts > 本文
> 基线来自真实 guard：`prd-code-crosswalk-check.js`（非假设）。配套：蓝图 / 锁定规格 / 功能台账 / 定稿 / 10评审Gem。

---

## 0. 真实交付基线（crosswalk 实测 2026-06-28）

**15 模块 = Full 7 / Partial 5 / MISS 3**

| 状态 | 模块 | 含义 |
|---|---|---|
| ✅ Full(7) | M04 设计师台 · M06 计算引擎 · M07 产品目录 · M08 渠道情报 · M09 联合品牌DAM · M10 CRM线索 · M13 IoT mock | 双锚点齐 |
| 🟡 Partial(5) | M01 问诊 · M02 BIM · M03 客户门户 · M05 业务控制台 · M11 财务快照 | 前端有/后端路由缺 |
| 🔴 MISS(3) | M12 真相源 · **M14 合规(P0)** · M15 数据总线/MDM | 代码完全没有 |

**后端真实态**：Express+Mongo 在跑；NestJS+PG `productionClaim:false`；RLS=模拟未staging。

---

## 1. 总体节奏与依赖

```
Phase 0 共识收口 [✅基本完成]
   └─▶ Phase 1 P0 发布闸（合规+契约+后端收口决策+RLS staging+备份）
          └─▶ Phase 2 P1 工程接缝（M12/M15 + 5个Partial后端 + 精度基线）
                 └─▶ Phase 3 件套成型（CRM收编/BIM拆出/交付闭环/板块一建站）
                        └─▶ Phase 4 增强（移动端/孪生/情报网/第4件套）
```
里程碑口径沿用 PRD：**V1.0=发布闸 · V1.1=接缝 · V2=件套成型与增强**；上线节奏接 COLD-START（D0-30 种子 / D31-60 扩散 / D61-90 验收）。

---

## 2. 逐阶段详细计划

### Phase 0 · 共识收口 [✅ 基本完成]
| 任务 | 交付物 | 状态 |
|---|---|---|
| 两板块+三件套声明 | platform-modules.json | ✅ |
| 蓝图/锁定规格/台账/定稿 | 4 份文档 | ✅ |
| 事实源仲裁顺序 | 定稿 §5 | ✅ |
| brand-registry 外链/自建标注 | rheem/ruud=external, everhot=self | ✅ |
| 10 评审 Gem | RED-TEAM-PERSONAS | ✅ |
| **遗憾2 定位** | 待用户确认 | 🔴 开口 |
**出口门禁**：事实源一致（已达）；Gem8 复审。

### Phase 1 · P0 发布闸（不达不上线）· 目标 V1.0
| # | 任务 | 交付物 | 出口判据 | Owner Agent |
|---|---|---|---|---|
| 1.1 | **后端收口决策 B3** | Express→NestJS+PG expand-contract 迁移方案（双写双读窗口/回填/回滚点） | 方案评审通过 | architecture-governor · data-platform-architect |
| 1.2 | **M14 合规** | consent/PIPL 同意管理 + dataRetention + encryptPII + 等保二级备案启动 | crosswalk M14=Full；合规 guard 通过 | security-supply-chain |
| 1.3 | **A2 契约门禁** | 每迁一端点强制补 OpenAPI；覆盖率 guard 卡漂移 | 契约覆盖率达标、漂移阻断 | frontend-contract-auditor |
| 1.4 | RLS staging 证明 | 真实 POSTGRES_STAGING_URL 迁移 + 跨租户拒绝测试 | postgres-staging-smoke 通过 | data-platform-architect |
| 1.5 | 数据备份/恢复演练 | backup-restore drill 证据 | drill 通过 | sre-guardian |
**出口门禁**：crosswalk MISS(P0)=0 · 契约达标 · RLS staging proof · 备份演练通过 · 2 租户端到端演练。**复审 Gem 5/7。**

### Phase 2 · P1 工程接缝（套间真打通）· 目标 V1.1
| # | 任务 | 交付物 | 出口判据 | Owner |
|---|---|---|---|---|
| 2.1 | **M12 单一真相源** | design_id + rysnova-bim_sync 变更双向同步 | crosswalk M12=Full | solution-design-rysnova-bim-director |
| 2.2 | **M15 数据总线/MDM** | global_product_id 主数据 + outbox 事件总线 + P1过渡直连方案 + 副本一致性边界 | crosswalk M15=Full | backend-platform-builder |
| 2.3 | M01 问诊后端 | server/routes ai-diagnosis + 问诊→派单 SLA | M01=Full | customer-project-lifecycle-director |
| 2.4 | M02 BIM 后端 | bim 路由 + 碰撞/净高/管线综合接口 | M02=Full | rysnova-bim-engineering-builder |
| 2.5 | M03 客户门户后端 | customers 路由（方案/订单/施工/维保/IoT状态） | M03=Full | customer-project-lifecycle-director |
| 2.6 | M05 业务控制台后端 | admin 路由（多租户/汇总/审计） | M05=Full | backend-platform-builder |
| 2.7 | **M11 财务快照** | price_snapshot/quotation_lock + 分期/发票/结算 | M11=Full | quote-cost-governor |
| 2.8 | **C1 design 精度基线** | 同时使用系数 + 噪声/水力/结露必算 + 回归基准集 + 第三方复核接口 | 精度回归测试通过 | solution-design-rysnova-bim-director |
| 2.9 | D2 电子合同 | 第三方电子签 + 合同存证 | 签约闭环跑通 | quote-cost-governor |
**出口门禁**：crosswalk MISS=0、Partial≤2 · M12/M15 落地 · 精度基线证据。**复审 Gem 2/3/7/8。**

### Phase 3 · 件套成型（端到端可成单）· 目标 V2
| # | 任务 | 交付物 | Owner |
|---|---|---|---|
| 3.1 | ②CRM 收编 | legacy crm/sales 原型重开发 + customer-portal 建成 | customer-project-lifecycle-director |
| 3.2 | ③BIM 拆出 | 从 dealer-workbench 拆出 → rysnova-bim/designer-workbench + 收编 legacy bim | solution-design-rysnova-bim-director |
| 3.3 | **D3 交付闭环** | delivery 验收影像/电子签留证 + 进度款节点联动 + 物料齐套 + 安装→lifecycle 资产交接 | iot-lifecycle-architect |
| 3.4 | 板块一建站 | 集团官网(aosmith架构×ruud VI) + Everhot 精修 + brand-console + DAM 分级授权 | ui-vi-director |
| 3.5 | 产品库可信链 | verified 精算必填参数契约 + CDC 同步 + 死信处理 | data-platform-architect |
**出口门禁**：完整闭环第一单（问诊→报价→签单→施工→验收→收款）· 三件套独立可上线。**复审 Gem 9/4/全员。**

### Phase 4 · 增强 · 目标 V2+
| 任务 | Owner |
|---|---|
| D4 移动端一等公民 + 分享页转化 + 第三方报价不劣化 | ui-vi-director |
| DigitalTwin 真三维（接 Three.js）+ 摄像头 AI 真实化 | iot-lifecycle-architect |
| 运行数据反哺精算（实测→设计校准回路） | solution-design-rysnova-bim-director |
| 情报网/转化仪表盘（跨租户脱敏行业基准） | analytics owner |
| 第 4 件套扩张机制验证（产品注册+复用底座） | architecture-governor |

---

## 3. 模块级任务矩阵（15 模块收口路径）

| 模块 | 现状 | 目标 | 阶段 |
|---|---|---|---|
| M01 问诊 | 🟡 | 后端路由+派单 → Full | P2 |
| M02 BIM | 🟡 | 后端路由 → Full | P2 |
| M03 客户门户 | 🟡 | 后端路由 → Full | P2 |
| M05 业务控制台 | 🟡 | 后端路由 → Full | P2 |
| M11 财务快照 | 🟡 | price_snapshot → Full | P2 |
| M12 真相源 | 🔴 | design_id+sync → Full | P2 |
| M14 合规 | 🔴 | consent/pipl → Full | **P1(P0闸)** |
| M15 总线/MDM | 🔴 | event_bus+MDM → Full | P2 |
| M04/06/07/08/09/10/13 | ✅ | 保持 + 真实化 mock(M13) | P4 |

---

## 4. 验收门禁（映射 locked-goal.json acceptanceGates）
guard:all · harness:all · test:production-readiness · perf:capacity · 浏览器视觉 · OpenAPI+生成客户端 · 多租户隔离 · 总部汇总 · 审计日志 · **105 legacy HTML 迁移证据** · 对象存储 smoke · **PostgreSQL staging RLS proof** · Temporal runtime proof · Redis staging/TLS proof · SBOM · SLSA provenance · rollback drill。

---

## 5. 角色分工（已有 17 开发 agent + 10 评审 Gem）
- **造的人（developmentGroup 17）**：orchestrator-chief 统筹；各 builder/architect/director 按上表 Owner 分工。
- **挑刺的人（10 Gem）**：每阶段出口对应 Gem 过堂（P0→Gem5/7，P1→Gem2/3/7/8，P2→Gem1/4/10，P3→Gem9/全员，全程 Gem6 战略+Gem8 架构）。

---

## 6. 风险与开口项
- 🔴 **遗憾2 内容未知**（PRD §12 缺）— 待用户确认/补。
- 🔴 **后端收口决策 B3 未定**（Express 桥接 vs NestJS 一步到位）— Phase 1.1 必须先定，否则 M14 落点悬空。
- 🟡 契约覆盖率需以 guard 重新出证（实测 ≈825 handlers，旧文 599 口径不同）。
- 🟡 护城河三项（标准计算/物料同源/情报网）= 最大未交付项，优先级高于功能堆砌（Gem6）。

---

## 7. 一句话执行序
**先定 B3 后端收口 → 落 M14 合规闸(P0) → 补 5 个 Partial 后端 + M12/M15 接缝 → 件套成型成第一单 → 增强。** 每阶段 Gems 复审，crosswalk 实测驱动，不达门禁不进下阶段。
