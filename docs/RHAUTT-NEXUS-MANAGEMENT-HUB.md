# Rhautt Nexus 管理中枢架构

日期：2026-06-29 · 对齐事实源：`platform-modules.json` + `docs/RHAUTT-NEXUS-REARCH-BLUEPRINT.md`（上级 PROJECT-CHARTER > PRD-v2 > CLAUDE.md）。
用途：定义「Rhautt Nexus 管理中枢」及其部署的两大板块，并更正先前 Approach-B 与锁定铁律的冲突。

## 0. 定位（不可变）
- **Rhautt Nexus / 瑞合数智枢纽** = 对内工程底座 / **控制平面**；不直接对外冠名。
- **Rhautt Comfort / 瑞合瑞德暖通科技集团** = 集团表述，非软件名。
- **瑞诺瓦 / Rysnova** = 经销商赋能体系（中立第三方形态），下辖 问诊 / CRM / BIM 三件套。

## 1. 解耦铁律（贯穿，必须遵守）
1. 中枢**不吞并**任何独立网站，只供给**非视觉骨架**（auth/tenant/DAM/contracts/domain/generated-client）。
2. 每个主站 **UI/VI 完全独立**；**禁建跨站共享 UI 组件库**；`packages/ui` 不作为统一观感层。差异是设计目标。
3. 每模块保留 `moduleNamespace/dataNamespace/productNamespace`，留独立拆库 + 单独部署路径。
4. 依赖单向向下：应用 → 非视觉骨架 → 领域服务 → 数据；同层禁横向耦合。

> **对 Approach-B 的更正**：先前 `ARCHITECTURE-ADMIN-CONSOLE-MIGRATION.md` 提的"统一视觉壳 + 共享 chrome 吞并各 app（Multi-Zones 视觉层）"**违反铁律 1/2**。保留其中**正确**的部分（SSO 走本仓自有 auth 骨架），**废弃**其中"统一视觉壳吞并主站"的部分。管理中枢自身是**内部 admin 工具**（可有自有 UI），但**不得**把自有 UI 强加给被管主站/件套。

## 2. 顶层结构

```
Rhautt Nexus 管理中枢（对内控制平面 · 非视觉骨架 · 不对外冠名）
  ├─ 非视觉骨架：auth/SSO · tenant(RLS) · DAM/file-artifact · contracts/domain/generated-client · governance/outbox
  │
  ├─（供给骨架，不吞并）▶ 板块一 · Rhautt Comfort 品牌与市场
  └─（供给骨架，不吞并）▶ 板块二 · 瑞诺瓦/Rysnova 赋能平台 · 部署管理
```

管理中枢以**内部管理控制台**形态承载两大板块入口；被管的主站/件套保持独立 UI 与独立部署。

## 3. 板块一 · Rhautt Comfort（品牌与市场物料）
**被管对象（保持独立 UI/部署）**
| 站点 | 交付 | 内容架构 / VI |
|---|---|---|
| 集团官网 `public-portal` (rhautt.com) | 自建 | 复刻 aosmith.com × ruud.com 调性（红 #E4002B + 中性企业壳） |
| Everhot `everhot-cn` (everhot.com.cn) | 自建 | 复刻 rheem.com 三受众架构，Everhot 暖红 |
| Rheem `rheem-cn` / Ruud `ruud-cn` | **外链占位** | 外部站，仅导航/卡片外链 |

**管理入口 = `apps/brand-console`（轻量，板块一控制台）**
- 站点资产：各品牌**独立产品库** · VI token · 上新 · ICP 备案 · 发布
- **市场物料管理（DAM/物料库）**：上传 / 版本 / 审批 / 投放渠道；存储走 `file-artifact`（对象存储）
- 外链配置：维护 Rheem/Ruud 外链占位
- 数据：③ 品牌运营库（各品牌独立产品库 + 内容/物料 DAM）

## 4. 板块二 · 瑞诺瓦/Rysnova 赋能平台 · 部署管理
**被管对象（保持独立 namespace/部署）**
| 件套 | apps | namespace / api |
|---|---|---|
| ① 瑞诺瓦 AI 问诊 | `consumer-diagnosis` | rysnova · /api/v2/diagnosis |
| ② 舒适家居 CRM | `dealer-workbench` · `customer-portal` | /api/v2/crm（报价→合同→施工→验收→IoT 闭环） |
| ③ 技术支持 BIM | `rysnova-bim-workbench` · `designer-workbench` | /api/v2/rysnova-bim · /design |
| 后端服务 | `services/api` · `services/calc-engine` | — |

**部署管理能力（控制台板块二）**
- **租户开通**：PostgreSQL-RLS 多租户 provisioning（tenant/dealer/store/role 开户）
- **版本 / 发布渠道**：按件套 namespace 独立发布（dev → staging → prod）
- **环境与部署状态 / 回滚**：对接 docker-compose / 部署编排 + rollback drill
- **Feature flags · License/Seat**：按租户/件套开关与席位
- **健康 / SLO 监控**：可观测性 + 治理产物（SBOM/SLSA · 50+ guard · hammer L1–L9）
- 依托底座 domains：`tenant · governance · workflow · notification · file-artifact`

> 铁律：中枢**编排**部署，不吞并各件套运行时；每件套保留独立部署路径。

## 5. 数据层映射
- ① 底座主库（PG）：auth/tenant/governance
- ② 赋能体系库（PG-RLS + Mongo）：板块二三件套
- ③ 品牌运营库：板块一产品库 + DAM
- ④ 分析数仓（OLAP 只读脱敏）：business-console 总部汇总（属底座/总部，不算件套）

## 6. RBAC（管理中枢内）
- `platform_admin / hq_admin`：两板块全可见
- 品牌运营角色：仅板块一
- 平台运维角色：仅板块二
- 复用本仓底座单一认证（见安全审计 P0 收敛）；SSO 经本仓自有 auth 骨架，非视觉壳。

## 7. 落地顺序（与认证审计/SSO 对齐）
1. **P0 认证收敛**（修审计 S1/H2 + `packages/auth` 非视觉骨架）——SSO 地基。
2. **板块一**：建 `apps/brand-console`（站点资产 + DAM + 外链配置）。
3. **板块二**：建部署管理控制台（租户/发布/环境/健康），对接 `governance/` + docker 编排。
4. 两板块入口聚合为「管理中枢」内部控制台；被管主站/件套保持独立。

## 8. 待你确认的取舍
- **管理中枢形态**：单一内部控制台含两板块 ✅推荐（小团队）；或 brand-console 与部署控制台两个独立内部 app（蓝图当前把 brand-console 列为独立 app）。
- 落地是否先走 P0（认证收敛）——强依赖。

## 9. 阶段锁定 · v-next 公域接入层（2026-07-01）

### 已固化成果
- **公域接入层（Ingress）· 切片 1**：新增 `services/api/src/modules/ingress/`（module/controller/service）。
  - `POST /api/v2/ingress/lead`：匿名面（无 AuthGuard）+ 内存滑动窗口限流（`INGRESS_RATE_LIMIT`）+ PIPL 同意前置（`consent!==true`→400）。
  - 获客暂存租户 `INGRESS_CAPTURE_TENANT_ID`（默认 `rhautt-acquisition-pool`）单个 RLS 事务内：`CrmService.createLeadInTx` 建 lead（客户/商机/lifecycle 串联）+ 发 `lead.created` + 发 **PII-free** `lead.captured`。
- **CRM**：新增 `CrmService.createLeadInTx(em, dto)` —— 显式 tenantId、事务内、去重（`tenant_id+phone_hash`）、供骨架层复用。
- **PIPL 加固**：手机号等 PII **不进 outbox**；PII 单一可治理副本落 `customers.phone_encrypted`；outbox 仅携 `customerId` + 归因维度。
- **依赖方向**：`营销站 → Ingress(骨架) → CRM(领域) → 数据`，单向向下，未违解耦铁律。

### 边界修正
- **经销商开户/招商归 ERP**：原「切片 2（dealer.application → 开户）」**取消**，未来改为 Nexus↔ERP 集成边界（只收发事件，不自建开户流）。

### 验证闸（本轮）
- `tsc --noEmit`：0 error。
- 8 个 CI 门禁守卫全绿：`target-api-boot-smoke · postgres-target-schema · postgres-rls-behavior · postgres-transaction-outbox · workflow-outbox-contract · route-target-map · target-dependencies · trunk-migration`。
- 无新增迁移（复用 `customers/opportunities/mdm_outbox_events`）。

### 遗留（非本轮范围）
- `customers.phone_encrypted` 列内目前明文 → 需 migration + KMS/env 列级加密（既有 TODO，与 outbox 加固独立）。
- Nexus↔ERP 集成事件契约待定义。
- 切片 3：`lead.captured` 归因 → analytics（当前无订阅者，dispatch 直接标记 delivered，不产死信）。
