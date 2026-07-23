# 三件套闭环性 · 刷新 delta + 结构性隐患收敛对齐（2026-07-05）

> 性质：闭环分析进化（delta），非实施规范。基于**当前代码实读**，对齐既有台账。
> 事实源：`server-production.js`、`server/modules/v2.router.js`、`server/modules/productionAppFactory.js`、
> `services/api/src/modules/**`、`docs/RHAUTT-NEXUS-MODULE-COMPLETENESS-AND-DATAPORT-BLUEPRINT.md`(06-29)、
> `docs/RHAUTT-NEXUS-DUAL-IMPLEMENTATION-CONVERGENCE-LEDGER.md`(07-03)、`docs/RED-TEAM-PERSONAS.md`(6 Gems)
> 上位：本文件是既有收敛台账的**现状复核 + 增量**，收敛顺序仍以台账 §3（W0→W6）与 §3B（R-1~R-6）为准。

---

## 0. 结论速览
- 06-29 完整性评分的「共同规律」仍成立：**壳基本完成、智能核缺失或困在 legacy**。
- 07-03 结构性隐患**当前仍成立且已定位到根**：根因不是「一功能 4 处」，而是**两套完整并行的 `/api/v2` 面**（Legacy Express 自实现 ↔ NestJS 目标），签收/生命周期重复只是其症状。
- **新增 delta**：`brand-registry` / `brand/:slug/products` / `product-catalog` **仅存在于 NestJS(:3300)**，Legacy 生产 `v2.router.js` 未挂载；品牌站构建管线本就指向 :3300，逻辑自洽，但坐实了双面裂缝。

---

## 1. 结构性隐患复核（07-03 → 今日）

### 1.1 两套并行 `/api/v2` 面（根因）
| 域 | Legacy Express `v2.router.js` | NestJS `services/api` | 状态 |
|---|---|---|---|
| auth / crm / diagnosis / design / lifecycle / rysnova-bim / analytics / governance | ✅ 自实现 | ✅ 自实现 | **双实现重叠** |
| quotation（Legacy） vs quote（NestJS） | ✅ quotation | ✅ quote | 命名/实现分叉 |
| contracts / system-packs / audit | ✅ | 部分/无对应 | Legacy 独有 |
| brand / brand-registry / product-catalog / mdm / delivery / growth / tenant / entitlement / compliance / notification / workflow / ingress / dispatch / file-artifact | ❌ 未挂 | ✅ | **仅 NestJS** |

- 生产主路：`server-production.js` → `productionAppFactory`（Express）；**未 require NestJS**。NestJS 经 `dev:nestjs` 独立启动，监听不同端口。
- 客户端视角存在两个 API 根；能力真相源按域分裂。

### 1.2 签收 / 验收重复实现（症状，仍在）
- NestJS：`services/api/.../rysnova-bim.controller.ts`(signoff-package/customer-signoff) + `lifecycle.service.ts#markAccepted`
- Legacy：`server/modules/rysnova-bim/rysnova-bim-artifact.service.js` + `comfort-domain/comfortDomainFacade.js` + `lifecycle/lifecycle.service.js`
→ 与既有台账 §1「客户签收 4 处」一致，未收敛。

### 1.3 收敛已有既定方案（不重造）
台账已拍板：W5 前端按成熟度切换（C1→C3→C6→C5→C7）、D-1 去重 business-console、D-2 补 rysnova-bim-workbench 空壳、R-1~R-6（经销商 5 阶段并入 dealer-workbench、剥离问诊/总部、修双后端错位、对客分离）。**本 delta 不新增方案，仅复核仍有效。**

---

## 2. 三件套完整度 delta（vs 06-29）

| 套件 · 模块 | 06-29 | 今日 | 变化 |
|---|---|---|---|
| ① diagnosis | ~40% | ~40% | 无实质变化；LLM/多轮/派单/PIPL 闸仍缺 |
| ② crm | ~60% | ~60% | 无变化 |
| ② quote | ~65% | ~65% | 无变化；电子签/收款节点仍缺 |
| ② delivery/lifecycle | 50–60% | 50–60% | 无变化；IoT 仍 mock |
| ③ design | ~35% | ~35% | 无变化；五系统仅 1 桥、必算硬校验仍缺 |
| ③ rysnova-bim | ~70% | ~70% | 无变化 |
| — 公开数据口 | 蓝图 B.2 规划 | **已实现（NestJS）** | ✅ `GET /api/v2/brand/:slug/products` 已从硬编码 everhot **泛化为品牌无关**；新增 `GET /api/v2/brands` 品牌注册表 API（支撑「持续新增品牌」） |

**净增量**：数据口蓝图 B.2 的公开产品端点从「规划」落为「已实现且品牌无关」，并新增品牌注册表 API。功能内核（智能/计算/规则）分值未动。

---

## 3. 6 Gems 快速过堂（当前状态）

| Gem | 关键挑战 | 现状判定 |
|---|---|---|
| G1 消费洞察 | 十年 TCO、旧改诊断、隐私同意 | ❌ TCO 未建、PIPL 同意闸(P0)未落 |
| G2 暖通总工 | 系统级协调、必算硬校验、责任签章 | ❌ design 仅 1 桥、硬校验/签章缺 |
| G3 BIM 交付 | 碰撞/净高/管综、2D↔深化一致、版本冻结 | ⚠️ 工作流全(70%)但真几何为占位 |
| G4 经销商操盘 | 三层目录、定价、联名、财务落地 | ⚠️ quote 壳全、电子签/分期缺 |
| G5/G6 战略横切 | 双运行时/双数据口一致性 | ❌ 双 `/api/v2` 面未收敛（本 delta §1） |

---

## 4. 建议的最低风险第一步（待确认后执行）
在不合并运行时、不删任何实现的前提下，风险最低且高价值的收敛动作候选：
- **A. 双面差异清单固化**：把 §1.1 表升级为机器可校验的「域→真相源」登记（扩展 `routeOwnership.js` 或新增 guard），防止两侧继续各改各的（对应台账 D-5 真相源纪律）。**纯登记，零运行时改动。**
- **B. D-1 去重**：归并 `apps/business-console` → `dealer-workbench`（前端 app 层，影响面可控）。
- **C. quote/quotation 命名分叉**：登记为待收敛配对，明确目标态 = NestJS `quote`。

> 三者都不动生产运行时行为，A 最安全。合并运行时 / 迁移 legacy 内核属 W1/W5 大工程，须单独排期。
