# 产品闭环功能完整性诊断（PRD）

> 2026-07-06 · 基于 NestJS(`services/api`) 真相源实际路由与实现扫描。
> 评级：✅ 完整（真实落库/贯通）· 🟡 部分（有契约/有降级，引擎或外部未接）· ⛔ 缺失。
> 方法：路由映射 + 关键方法实现核查 + stub/占位/TODO 全量扫描 + 主链事务串联核查。

---

## 1. 闭环全景与评级

```
获客 → 转化 → 设计 → 深化 → 交付 → 客户/售后 → 数据回流
```

| 环节 | 关键能力 | 状态 | 说明 |
|---|---|---|---|
| 获客 | AI问诊(公开分析/推荐/报告/定金) | ✅ | diagnosis 域真实落库；定金意向/确认/退款完整 |
| 获客 | GEO可见性 / 舆情 / 活动ROI / AI文案 | 🟡 | 引擎与打分**真实**；外部平台抓取需凭证→未配置即 `not-configured`（架构就绪，属部署配置非代码缺口） |
| 转化 | CRM 漏斗/客户360/跟进/阶段 | ✅ | crm 域真实落库 |
| 转化 | 报价 quote/econet/负荷 | 🟡 | 微服务不可达时降级本地估算（标注 unverified） |
| 转化 | **签单→自动承接BIM** | ✅ | `crm.sign` 同一 RLS 事务内 `lifecycle.advanceInTx`+`publishInTx`，随后 `bim.inheritFromQuotation`——**主链原子贯通** |
| 设计 | 精算/放行/项目/平面读写 | ✅ | design 核心 CRUD + 校验闸真实 |
| 设计 | 设备推荐/BOM/AutoLayout/碰撞/管路/CAD/3D渲染/导出/模板 | 🟡 | **有路由有契约，引擎未接**，返回 `implemented=false` 结构化占位（前端可降级） |
| 设计 | AI方案建议/校验/解读 | 🟡 | 规则占位；LLM 编排 TODO；如实标注 |
| 深化 | Rysnova 承接/产物/审批/完整性/交付包/签收 | ✅ | rysnova-bim 域真实（本次已迁 Postgres，artifacts/outbox 落库验证通过） |
| 深化 | 云端碰撞检测/工程量 | 🟡 | BVH/空间索引未接，返回零碰撞/`placeholder` 工程量占位 |
| 交付 | 交付承接/验收/14态/IoT移交 | ✅ | delivery+lifecycle 真实落库；BOM导出真实 |
| 客户 | 客户门户进度/验收/报告分享 | ✅ | customer-portal + diagnosis 报告分享真实 |
| 回流 | outbox 事件/审计 | ✅ | 业务写与 outbox 同事务，`mdm_outbox_events` 真实 |
| 底座 | 身份SSO/RLS/权益/合规/派工/通知 | ✅ | 真实（本次身份已收敛 Postgres） |

---

## 2. 关键结论

- **主干闭环贯通**：`获客(问诊) → 转化(CRM+签单) → 承接(BIM) → 交付(delivery/lifecycle) → 客户(门户)`
  全链真实落库、跨域用 outbox 事件驱动、签单→承接**原子事务**。核心商业闭环成立。
- **缺口集中在「重计算/AI/外部连接器」三类**，均为**诚实占位**（有契约、可降级、标注 `implemented=false`/`unverified`/`not-configured`），不是断链，但影响「设计深化」环节的自动化深度。

---

## 3. 缺口清单与优先级

| 优先级 | 缺口 | 位置 | 建议 |
|---|---|---|---|
| ~~P1~~ ✅已交付 | 设备推荐引擎（负荷×产品目录） | `design.service.equipmentRecommendation` | 已接 hvac-kernels 负荷 + product-catalog `priceBandsForSystems`，`implemented:true`（无匹配品诚实 `priced:false`） |
| ~~P1~~ ✅已交付 | BOM 生成引擎 | `design.service.generateMaterials` | 主设备取产品目录牌价中位数 + 辅材面积系数量算 + 人工估算，`implemented:true`，`trust:estimate` |
| ~~P1~~ ✅已交付 | 云端碰撞/工程量 | `rysnova-bim/cloud-capability` | 碰撞=真实 AABB 相交/净距(硬/软+定位)；BOQ=几何包围盒量算 或 面积×系统系数量算。仅 IFC 导出仍待引擎 |
| ~~P2~~ ✅已交付 | AI 方案 LLM 编排 | `ai-design.reviewCalcGate` | 接统一 `ai-gateway`（大模型 + 确定性兜底 + 合规打标）；事实锚点喂模型，不自出合规结论 |
| ~~P2~~ ✅已交付 | AutoLayout 自动布点 | `design.generateLayout` | 确定性网格布点（主机+末端坐标），`implemented:true` |
| ~~P2~~ ✅已交付 | 碰撞检测 | `design.collisionCheck` | 真实 AABB 相交/净距，与 cloud clash 同口径 |
| ~~P2~~ ✅已交付 | 管路水力选型 | `design.optimizePipes` | 流速法 d=√(4Q/πv) 向上取标准 DN，`implemented:true` |
| ~~P2~~ ✅已交付 | 方案导出 | `design.exportDesign` | pdf-lib 生成真实方案 PDF(base64)；DWG 诚实待 CAD 引擎 |
| ~~P2~~ ✅已交付 | 设计模板库 | `design.listTemplates/useTemplate` | 内置 5 套家用/商用模板 + 从模板真实落库建项目 |
| **P2（需外部引擎）** | 报价微服务 | `quote.service` 本地估算 | 本地估算已可用；部署独立报价微服务为可选增强 |
| **P3（需外部依赖）** | CAD 解析 / 3D 渲染 / DWG 导出 | `design.uploadCad/parseCad/render3d`；`cloud.exportIfc` | 需 CAD 解析器/渲染农场/IFC 引擎，非纯算法可补，诚实 `implemented:false` |
| **P3（部署项）** | GEO/舆情外部抓取 | `growth` 连接器 `not-configured` | 配置各平台凭证（非代码缺口） |
| ~~P3~~ ✅已交付 | 售后工单/保修 | `aftersales` 域（NestJS 原生） | 新建 `/api/v2/aftersales`：工单 CRUD+派工+状态+关闭（中文状态映射）、保修台账（到期状态派生），RLS 租户隔离 + dealer/store 归属过滤；迁移 034 建表；dealer 前端 `api.ts` 已从本地 mock 切到真实域 |

---

## 4. 验证证据

- 主链：`crm.service.sign` L143-167（lifecycle+outbox 同事务 + bim 承接）。
- 落库：`rysnova_bim_artifacts` 写入 + `mdm_outbox_events` 事件（本次迁移验证）。
- 冒烟：11 域 `/api/v2` 经 3001 代理全 200；`devices?scenario=` + `taxonomy.segmentModels` 生效。
- 单测：`npm run test:api-units` 24/24（cloud/design/ai-design 引擎），已入 `validate`。
- **端到端闭环验证：`npm run e2e:closed-loop` → 25/25 PASS**（获客→设计深化 11 项→报价→签单→BIM 承接→云碰撞/工程量→AI 复核→售后工单全生命周期+保修台账，经 3001 代理真实建单/落库）。
- **闭环真 bug 修复（本轮 E2E 抓出）**：`contracts` 表 schema 漂移——`ContractEntity` 的电签列（`esign_contract_id`/`esign_status`/`esign_sign_url`/`signed_pdf_key`）从未建表，导致 `crm.sign → bim.inheritFromQuotation` 读写合同时 `QueryFailedError: column ContractEntity.esign_contract_id does not exist` → 500。已补幂等迁移 `database/postgres/migrations/033_contracts_esign_columns.sql` 并应用，签单+承接恢复。

---

## 5. 一句话结论

**商业全闭环已贯通、可运行，并经端到端验证 25/25 PASS**：获客→设计深化（负荷/设备/BOM/布局/碰撞/水力/工程量/PDF/模板/精算闸全部真实算法）→报价→签单→BIM 承接→云能力→AI 复核→售后工单+保修全链路真实建单落库。P1/P2/P3 纯算法与领域端点已全部交付并有单测护栏（`test:api-units` 24/24，入 `validate`）；剩余仅「客观需外部引擎/凭证」项（CAD 解析、3D 渲染、DWG/IFC 导出、外部抓取凭证），均诚实标注 `implemented:false`。回归随时可跑：`npm run e2e:closed-loop`。
