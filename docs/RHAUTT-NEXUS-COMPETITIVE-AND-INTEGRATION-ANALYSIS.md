# Rhautt Nexus · 行业竞品分析 + 架构进化 + 开源/Skills 整合

> 生成：2026-06-28 · 依据公开市场调研（酷家乐/圆方/鸿业/优筑 + GitHub 开源生态）。
> 用途：指导架构进化与"造 vs 买/集成"决策。所有许可证已标注，**GPLv3/copyleft 默认禁用于闭源 SaaS 主干**。

---

## 一、竞品矩阵

| 竞品 | 定位 | 强项（护城河） | 对 Rhautt Nexus 的启示 |
|---|---|---|---|
| **酷家乐 MEP**（贝壳找房系） | C 端/设计师在线水暖电设计 | 覆盖全国 90% 户型库 + ML 自动布管布点 + 5 分钟出图 + BIM 算量报价一键导出 | **不要正面拼渲染/户型库**。我们差异化在：多租户经销商赋能、CRM→交付→IoT 闭环、PIPL/等保合规 |
| **圆方 Yfway**（尚品宅配系） | 泛家居全链路数智化 | 设计平台 Meta20 + OMS/APS/SRM/MES/WMS 制造全链 | 品牌管理板块的**供应链/拆单/排产**可借鉴；我们暂不做制造，但 MDM/事件总线要能对接 |
| **鸿业 MEP-ACS** | AutoCAD 暖通施工图 | 规范图集合规、碰撞检查、二三维同步 | 施工图深化的**规范合规**是刚需；Rysnova 深化应产出规范图，而非仅 3D |
| **优筑网** | 高端暖通集成商（自营服务） | 三维激光扫描点云 + 专业 BIM、多系统集成（采暖/空调/新风/净水/智能） | **点云/激光扫描**是高端交付差异化；可作 Rysnova 高级层 |

### Rhautt Nexus 的独特位（竞品都弱的地方）
1. **多租户 + 三档隔离（RLS/schema/物理）+ 品牌 VI 隔离** —— 竞品多为单租户工具或单一品牌。
2. **单一真相源闭环**（问诊→CRM→设计→BIM→报价锁价→合同→施工留证→IoT 生命周期）。
3. **中国合规底座**（PIPL 同意/数据保留/PII 加密、等保），竞品普遍不强调。
4. **事实源/MDM + 事件总线**做跨板块数据治理。

---

## 二、架构进化思路（基于竞品洞察）

1. **BIM 不要自研渲染** → 采用 **That Open Engine（MIT，见三）** 承载 Rysnova 的 IFC/点云/BCF（**勿用 AGPL 的 xeokit**）。把精力放在"真相源同步 + 规范出图 + 报价联动"。
2. **载荷计算引擎可信化** → 用 ASHRAE 可溯源的开源库（`hvacpy`/`python-hvac`）替换 bespoke CALC-*，强化 M15 `dataTrustLevel=verified` 门禁的**可辩护性**（验收/精算合规）。
3. **报价配置器声明式重算** → 借鉴 `openCPQ` 的"全量重算"范式，与 M11 价格快照锁定天然契合（锁定即冻结一次重算结果）。
4. **变更回流标准化** → M12 design↔Rysnova 的 `change_proposal` 用 **BCF（BIM Collaboration Format）** 标准替代自定义 jsonb，互操作性强、可对接 Navisworks/OpenProject。
5. **事件总线收口**（解决台账开口项）→ MDM `mdm_outbox_events` 与 `outbox_events` 合并为单一 outbox，投递层后续可接 NATS/Redis Streams。
6. **点云高级层** → 用 That Open/three.js 点云加载（或评估 Potree, BSD），承接"激光扫描→BIM"高端交付（对标优筑）；**不采用 AGPL 的 xeokit**。

---

## 三、开源系统 / Skills 整合清单（造 vs 集成）

> 选型铁律：**MIT / Apache-2.0 / BSD 可直接集成；LGPL 谨慎（动态链接）；GPL/AGPL 禁入闭源主干**。

### A. BIM / 3D 可视化（Rysnova M02/M12）
> ⚠️ **许可证更正（2026-06-28 实测 npm registry）**：`@xeokit/xeokit-sdk@2.6.112` 实为 **AGPL-3.0**（已转 AGPL + 商业双授权），**非 Apache-2.0**。AGPL 强 copyleft 传染网络服务，**禁入闭源主干**。首选改为 **That Open Engine（MIT）**。

| 项目 | 许可证（实测） | 集成点 | 适配度 |
|---|---|---|---|
| **That Open Engine** `@thatopen/components`+`@thatopen/fragments` | **MIT ✅** | Rysnova 前端查看器：IFC 解析/几何/批注（基于 three.js） | ★★★★★ **首选** |
| **web-ifc** | **MPL-2.0 ✅**（文件级弱 copyleft） | IFC→几何 WASM 解析核心（That Open 底层） | ★★★★ 配套 |
| **three / three-mesh-bvh** | **MIT ✅**（three 已是依赖） | 渲染/拾取底座 | ★★★★ 已有 |
| ~~xeokit-sdk~~ | **AGPL-3.0 ❌** | 功能强但 copyleft；如必用需购 **商业授权** | 禁入主干 |
| **Speckle** | Apache-2.0（核实具体包） | 设计数据协作/版本 | ★★★ 评估 |

### B. 暖通载荷/精算引擎（CALC-* / design 模块）
| 项目 | 许可证 | 能力 | 适配度 |
|---|---|---|---|
| **hvacpy** | MIT ✅ | ASHRAE HOF 2021 制冷/制热负荷、湿空气、设备选型、风管、62.1 通风 | ★★★★★ 作精算微服务 |
| **python-hvac** | 评估(看 LICENSE) | RTS 法负荷、EN 12831、VRF、换热器、冷媒管径 | ★★★★ 深化能力 |
| hvac-engine (Java) | 评估 | 湿空气热力学、线程安全 | ★★★ 若走 JVM |
| HVACgooee | **GPLv3 ❌** | 拓扑驱动热损失 | 禁入主干（copyleft） |

> 说明：精算引擎建议**独立 Python 微服务**（FastAPI），经事件总线/REST 与 NestJS 交互，产出带 ASHRAE 出处的计算单 → 喂 M15 `verified` 门禁。

### C. 报价配置（CPQ / M11）
| 项目 | 许可证 | 集成点 | 适配度 |
|---|---|---|---|
| **openCPQ** | 开源(核实) | 声明式产品配置 → 报价项生成，配合价格快照锁定 | ★★★★ 借范式 |
| json-rules-engine (Node) | ISC ✅ | 价格护栏/毛利下限/促销规则引擎 | ★★★★ 直接用 |

### D. 平台底座 / Skills
| 能力 | 推荐 | 许可证 | 用途 |
|---|---|---|---|
| 工作流编排 | **Temporal**（已用） | MIT ✅ | 保持 |
| 事件总线投递 | **NATS JetStream** / Redis Streams | Apache/BSD ✅ | outbox 投递层（合并后） |
| 规则引擎 | json-rules-engine | ISC ✅ | 合规/定价/SLA 规则 |
| BCF 交互 | bcf-js / OpenCDE BCF API | 评估 | M12 变更回流标准化 |
| Agent Skills | 新增 `bim-ifc`、`hvac-loadcalc` skills | 内部 | 把上面集成沉淀为可复用技能 |

---

## 四、落地优先级建议

- **P0（高 ROI、低风险）**：xeokit 接入 Rysnova 查看器；json-rules-engine 接 M11 价格护栏。
- **P1**：hvacpy 独立精算微服务（喂 verified 门禁）；openCPQ 范式重构报价配置。
- **P2**：BCF 标准化 M12 变更回流；事件总线合并 + NATS 投递层；点云高端层。
- **风险闸**：所有引入项先过**许可证审查**（禁 GPL/AGPL 入闭源主干）+ 供应链 SBOM 登记（对接等保/供应链安全要求）。
