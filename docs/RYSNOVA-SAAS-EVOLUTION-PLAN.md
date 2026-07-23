# Rysnova 独立软件公司 · 白标 SaaS 进化方案

> 状态：已批准 · 2026-07-03 · 用户裁定
> 事实源层级：`PROJECT-CHARTER.md` > `governance/locked-goal.json` > `PRD-v2.md` > `platform-modules.json` + `contracts/` > 本文档（派生视图，冲突回溯上层）
> 本文档是 R0–R4 进化的执行事实源。任何阶段动代码前回读本文。

---

## 0. 一句话定位（进化后）

**Rysnova / 瑞诺瓦是一家独立、中立的暖通舒适家居垂直软件公司**，持续迭代行业能力，以**白标私有化部署**为主交付形态，为品牌方/多品牌集成商交付冠客户名的数字化平台，合适位置标注 **Powered by Rysnova**。**Rhautt Comfort / 瑞合瑞德集团是样板客户（客户 #1）**，其交付实例名为 `Rhautt Nexus / 瑞合数智枢纽`。

---

## 1. 用户裁定（锁定决策）

- **D1 瑞诺瓦英文更名**：对外英文名固化为 **`Rysnova`**。旧英文名与拼音 slug（`ruinuowa`/`renova`/`lithnova`）**已在本批全量迁移**为 `rysnova`（问诊/C 端）与 `rysnova-bim`（BIM），代码库不再保留旧词（储能品牌 `lithnova-cn` 除外，属独立设备品牌）。
- **D2 Lithnova 释放为独立设备品牌**：聚焦**新能源储能产品系列**，建独立品牌站（与 Everhot 同构），登记于板块一。**R0 仅做品牌站 + 产品库，不进问诊/精算**（储能选型 ≠ 暖通负荷计算，属另一垂直计算域，留后需）。
- **D3 瑞诺瓦升级为独立软件公司**：Rhautt 集团相当于客户；Rysnova 帮品牌公司管理品牌与产品体系，可商业化整套软件。
- **D4 交付物按客户冠名**：产品用客户名（如 `Rhautt Nexus`），标 `Powered by Rysnova`；Rhautt 旗下品牌阵营逻辑不变。可复制给任意多品牌集成商，独立部署、换/加品牌、冠自己集团名。
- **D5 主交付形态 = 两者都要**：**先私有部署白标，后共享多租户 SaaS**。架构从第一天做成"身份与租户抽象层"，私有 = 客户组织数为 1 的特例，SaaS 为叠加不重写。

---

## 2. 身份重分层（最终）

| 层 | 值 |
|---|---|
| 软件厂商/供应商 | **Rysnova / 瑞诺瓦**（暖通舒适家垂直软件公司，中立第三方） |
| 厂商产品（内部 SKU） | Rysnova 暖通舒适家平台 |
| 样板客户实例名 | **Rhautt Nexus / 瑞合数智枢纽**（保留）+ `Powered by Rysnova` |
| C 端问诊 | **Rysnova AI 问诊** |
| 技术支持 BIM | **Rysnova 技术支持 BIM** |
| CRM | Rysnova 舒适家居 CRM |
| Rhautt 实例内设备品牌 | Rheem / Ruud / Everhot + **Lithnova（新能源储能）** |

## 3. 红线保全论证

- 宪章第一红线原文约束的是**集团门户站(rhautt.com)的定位 = Rhautt Comfort**。进化后 Rhautt Comfort 仍是集团门户唯一定位（用 Rysnova 建站产品运营）——**红线未破**。
- 被修订的是"Rhautt Nexus 是 Rhautt 的营销平台"这一**平台所有权陈述** → 改为"Rysnova 的产品，Rhautt 是客户 #1，实例冠 Rhautt 名"。
- 平台字符串 `Rhautt Nexus / 瑞合数智枢纽` **保留**为样板客户实例名，故 `nexus-naming` 守卫的 `platform` token、`package.json` name 均不变。

## 4. 架构铁律（保证"先私有后 SaaS"零返工）

- **身份层 identity resolver**：实例名/VI/logo/domain/Powered-by = 配置。私有=部署期解析，SaaS=运行期按租户解析，**同一接口**。
- **租户层 customer_org 顶层边界**：代码永远按 `customer_org → 经销商 → C端` 分层 scope。私有 = 单例 org；SaaS = 多 org + RLS。**建一次，两用**。
- **部署层**：白标构建/配置流水线打每客户品牌包。
- **计费**：留到 SaaS 阶段，用量事件走已有 outbox 留缝，不提前建。

## 5. 分阶段路线

| 阶段 | 内容 | 可逆 | 出口门禁 |
|---|---|---|---|
| **R0 命名收口** | Rysnova 更名 + Lithnova 储能站登记 + BIM 改名；引入厂商身份 + Powered-by；守卫期望值同批改 | 是 | `guard:nexus-naming` + `guard:all` 全绿 |
| **R1 宪章修订 + 中立性** | 改宪章/locked-goal（厂商=Rysnova、实例冠客户名、交付=私有+SaaS-ready）；品牌偏好按 customer_org 配置 | 治理可逆 | 精算回归基线不变 |
| **R2 抽象层** | identity resolver + customer_org 顶层边界（私有=单例）；经销商 RLS 不动 | 是 | staging RLS + 单例部署证明 |
| **R3 白标流水线** | 白标构建/部署流水线 + workbench 外壳白标；部署第 2 个样板客户验证可复制 | 是 | `browser-visual` 无回归 |
| **R4a SaaS 化** | 多 org 运行期切换 + 自助开通 | 部分 | 多租户隔离自动化测试 |
| **R4b 计费** | 订阅/计量/账单 | 部分 | 计量事件对账 |

P0 合规闸（M14 PIPL/等保）贯穿不取消；SaaS 阶段竞品同台使其更关键。

## 6. R0 精确范围（本批动代码）

**改（身份层，机器可读事实源 + 守卫同批）**：
- `brand-registry.json`：`renova-cn` 英文名 Lithnova→Rysnova + 迁移债 slug 注记；新增 `lithnova-cn` 储能品牌（self-built，Everhot 同构）；新增厂商 `rysnova` 与 Powered-by 约定。
- `platform-modules.json`：brandPair `瑞诺瓦/Rysnova`；件套名 `Rysnova AI 问诊/Rysnova 技术支持 BIM`；Lithnova 储能入板块一 apps。
- `CLAUDE.md`：身份段（厂商 Rysnova / 实例冠客户名 / Lithnova 储能 / Powered-by）。
- `governance/locked-goal.json`：`ruinuowa` boundary 英文名→Rysnova；`independentProductModules` displayName→Rysnova BIM；`publicExperience` 澄清；新增 vendor/delivery 口径。
- `scripts/agent-guards/nexus-naming-check.js`：CLAUDE.md 期望 token 同批更新为新措辞；保留 `platform` token 与 `\bRenova\b` 禁令（Rysnova 非子串，安全）。

**已迁移（本批完成技术命名空间）**：
- `lithnova`→`rysnova-bim`（`services/api/src/modules/rysnova-bim`、`/api/v2/rysnova-bim`、`apps/rysnova-bim-workbench`、dataNamespace、PascalCase `Lithnova*`→`Rysnova*`）。
- `ruinuowa`/`renova`→`rysnova`（slug、token 文件名、`/rysnova*` 别名、`rysnova.com.cn` 域名）。
- 保留：平台实例名 `Rhautt Nexus / 瑞合数智枢纽`；独立储能设备品牌 `lithnova-cn`。

## 7. 仍开口项（后续阶段拍板）

- 公司结构（子公司 / 分拆 / 合资）→ 决定 IP 归属与竞品同台数据治理义务。
- ~~技术 namespace 迁移~~（已于本批全量完成：rysnova/rysnova-bim）。
- Lithnova 储能是否未来接入独立储能计算域。
- SaaS 计费模型（按席位/按租户/按用量）。
