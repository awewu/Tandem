# Rhautt Nexus 营销中台 · 宪章与产品定义（v2 · 双产品线）

> **⚠️ v2 修订（2026-08-06）**：唯一最高真相源已迁移至 `docs/NEXUS-MARKETING-PLATFORM-BASELINE.md`。
> 本文件保留为**门禁校验口径载体**（§1.2.2 权限域 / §5.5.6 能力成熟度矩阵）。**定位与边界一律以基线为准**：
> 客户赋能=独立产品线（含售后全链路，已剥离）· 双产品线分开售卖 · 产品事实基座单一 SoT · AI-GEO 护城河。
> 本文任何与基线冲突的历史表述（如"止于售前""外售不在主线"）**均已失效**。
>
> **历史状态（v1.0）**：曾取代并归档 `PROJECT-CHARTER.md` · `governance/agent-charter.md` · `docs/NEXUS-VISION-AND-PRD.md`。
> **取代并归档**：`PROJECT-CHARTER.md`(674行) · `governance/agent-charter.md`(46行) · `docs/NEXUS-VISION-AND-PRD.md`(283行)
> **派生文件**（不得与本文冲突，冲突以本文为准）：`AGENTS.md` · `CLAUDE.md` · `DESIGN.md` · `brand-registry.json` · `platform-modules.json`
> **运行台账**（自动产出，非人工真相源）：`governance/task-board.json` · `governance/quality-findings.json` · `evidence/release-evidence.json`
>
> 修订规则：本文任一条款变更，必须同时更新对应门禁；无门禁可指的条款一律标为「建议」，不得伪装成铁律。

---

## 0. 命名锁

- Software platform name: **Rhautt Nexus / 瑞合数智枢纽**
- Rhautt Comfort / 瑞合瑞德暖通科技集团 is the customer/group instance positioning —— 客户/集团实例不替换软件平台名，不作为本软件系统的名称使用。
- Rysnova / 瑞诺瓦 is the independent dealer-enablement software vendor（`Powered by Rysnova`）。
- Rheem / Ruud / Everhot / Lithnova are equipment brands.

---

## 1. 定位（锁定，不再讨论）

> **Nexus（powered by Rysnova）＝ 营销中台。**
> **核心是品牌建设**，按 **7P** 维度展开，从 **产品 + GEO** 破局，
> 用 **客户赋能工具验证效果**；**对品牌负责，对客户的专业度负责**。

**使命**：Satisfied Customers Keeps Us in Business —— 客户满意，生意才在。

### 1.1 术语锁（全文唯一所指，禁止混用）

| 词 | 唯一所指 |
|---|---|
| **客户** | **经销商（Dealer）** —— "客户赋能""客户的专业度"中的客户，一律指经销商 |
| **终端用户** | 最终业主/消费者。**不得**简称为"客户" |
| **总部** | 瑞合集团总部（付费方与品牌所有者） |
| **中台** | Nexus 自身：一套事实/内容/GEO 引擎，复用给下列前台 |
| **前台** | ① 4 个品牌站（rheem-cn · ruud-cn · everhot-cn · lithnova-cn）② 经销商工作台（dealer-workbench） |

### 1.2 边界（明确不做）

- **Tandem / 搭子 = 复制体系**，不属于 Nexus。唯一依赖是 **AI 治理网关**（员工身份与 AI 收口）。不得向 Tandem 其他板块扩张。
- **（v2 修订）客户赋能 = 独立产品线**（原"技术支持止于售前"已解除）：客户赋能覆盖 获客→选型→报价→成交→交付→终身运维→售后 全链路，独立售卖与演进；已从营销中台**可逆剥离/停挂载**（模块目录留存）。营销中台本体聚焦 **品牌赋能 + CORE + 线索飞轮**（保留 ingress/diagnosis/crm/dispatch 作为获客与派单接缝）。
- **（v2 修订）双产品线分开售卖不同买家**：品牌赋能→品牌方；客户赋能→经销商/集成商。原"外售不在主线"解除。
- **单一事实基座（红线，保留）**：产品与技术事实唯一 SoT 在 CORE，客户赋能只读消费不复制。接缝 = 产品事实发布 / 线索派单 / 成效回流。
- 定位以 `docs/NEXUS-MARKETING-PLATFORM-BASELINE.md` 为准；本节其余历史表述若与基线冲突，以基线为准。

---

### 1.2.2 权限域（D0–D5）

授权模型的唯一真相源为 `governance/permission-domains.json`；本节为宪章锚点，二者必须一致（`guard:permission-domain` 校验）。

| 域 | 名称 | 对应层 |
|---|---|---|
| **D0** | 平台与系统 | 治理底座（auth · tenant · audit-log · compliance） |
| **D1** | 品牌管理 | L2 品牌资产与内容 |
| **D2** | 产品 | L1 事实基座（产品事实 + 技术事实） |
| **D3** | 用户与体验 | L2 / L4 前台体验 |
| **D4** | 客户与赋能 | L4 客户赋能专业模块 |
| **D5** | 推广与增长 | L3 GEO 可见度引擎 |

**双轴授权**：RBAC（角色）× Entitlement（订阅）——Entitlement 当前**已冻结**（§5.3），仅保留 RBAC 生效路径。

---

## 2. 因果链（唯一有效的成功标准）

品牌建设 = 让目标客户在有需求时 **想到你 → 信任你 → 被专业地服务**。
AI 时代，"想到你"的入口从搜索排名变为 **AI 推荐**。AI 要引用我们，必须同时满足：

```
a. 有内容可引        ← L2 品牌资产与内容
b. 能被发现读懂      ← robots/sitemap/JSON-LD（guard:geo 守护）
c. 内容准确可信      ← L1 事实基座（产品事实 + 技术事实）
```

**技术支持是核心价值**，且是同一份资产的两个出口：

```
        技术事实（hvac-kernels 9域 + 国标 system-packs）
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
  ① 品牌专业度内容                    ② 经销商赋能工具
  选型依据/国标解读/计算方法            选型器/负荷计算/报价
  → AI 引用我们的技术权威(E-E-A-T)      → 经销商专业成交
        └─────────────────┬─────────────────┘
                          ▼
              品牌建设被证明有效
```

**判定链**：`L1 事实准 → L2 有内容 → L3 被 AI 引用↑ → 高意向线索↑ → L4 经销商更专业成交↑`
缺任何一环，整链价值为零。

---

## 3. 四层架构（取代旧 A/B/C 三层）

| 层 | 名称 | 职责 | 现有模块 |
|---|---|---|---|
| **L1** | **事实基座** | 唯一真相，对外内容必引，绝不编造 | **产品事实**：product-catalog · brand-product-category · mdm<br>**技术事实**：`packages/domain/hvac-kernels`(9域) · system-packs(国标) |
| **L2** | **品牌资产与内容** | AI 可引用的实体：品牌站/品类页/技术内容/案例/素材 | brand-registry · file-artifact(DAM) · site-materials · brand<br>对外站：rheem-cn · ruud-cn · lithnova-cn · everhot-cn · public-portal |
| **L3** | **GEO 可见度引擎** | 探测 → 缺口 → 生成 → 复投 → **再探测验证** | growth（GEO/舆情/文案/驾驶舱）· wechat-publishing |
| **L4** | **客户赋能专业模块** | 支持客户专业度 + 效果验证仪表 | diagnosis(品牌入口) · design(计算) · bim · quote · crm(最小)<br>**效果仪表**：ingress · attribution · analytics |

**治理底座**（横切，非独立层）：auth · tenant · audit-log · compliance · common · event-consumers。

---

## 4. 7P 归位

| P | 落点 | 层 |
|---|---|---|
| **Product 产品** | product-catalog（SKU事实）+ hvac-kernels/system-packs（技术事实） | L1 |
| **Price 价格** | quote 报价规则 · quotation 内核 | L1/L4 |
| **Place 渠道** | 品牌官网 · AI 货架(GEO) · ingress 公域入口 | L2/L3 |
| **Promotion 推广** | GEO 引擎 · 舆情 · 文案 studio · 多渠道分发 | L3 |
| **People 人员** | brand-brain · 市场角色 | L3 |
| **Process 流程** | 核准流 draft→approved · 归因 · 内容日历 | L3/L4 |
| **Physical 有形证据** | brand-registry(VI/**SI**/命名/NAP) · DAM 素材 · 案例 · 官网体验 | L2 |

---

## 5. 范围与冻结册

### 5.1 当期主线
L1 事实基座可信 → L2 技术内容化 → L3 GEO 闭环验证 → L4 效果仪表。

### 5.2 退役（从 app.module 摘除，进本册可追溯）

> 退役前必须逐个核实真实引用，**不得凭行数判定死活**。2026-08-04 核实中，4 个"疑似空壳"里有 2 个是承重件。

| 模块 | 行数 | 核实结果 | 处置 |
|---|---|---|---|
| react-candidate | 254 | 暴露 29 端点但**无任何前端调用**；routeOwnership 标 `production-candidate`，且 `/api/devices`、`/api/projects` 有 legacy-compat 等价面。属本文禁令中的"候选面"。 | **退役** |
| workflow | 90 | 仅 `GET /workflow`，无外部引用；outbox 已由 event-consumers 承担 | **退役** |
| ~~notification~~ | 133 | ❌ **承重**：`event-consumers` 用其 `createInTx` 发「签单成功」通知 | **保留** |
| ~~governance~~ | 51 | ❌ **承重**：托管 `AuditLogEntity`，被 crm/tenant/quote/product-catalog/brand-registry 等 **13 个文件**引用 | **保留**（建议后续更名归位为 audit 家族） |

### 5.3 冻结（保留代码，不投入，不占门禁预算）

**规则**：每一项必须有可判定的解冻条件。**无解冻条件的冻结不允许存在**——那等于把范围永远悬着，将来必被当作重启借口。

| 项 | 解冻条件（可判定） |
|---|---|
| entitlement（双轴授权/按子域售卖） | **出现第二个付费集团租户** |
| 多租户五层（platform→hq→brand→dealer→store） | 同上（**RLS 机制本身保留并已真实生效**，不冻结） |
| **外售 SaaS** | 同上 |
| **交付执行**：delivery · contracts · dispatch | **售前闭环（选型→方案→报价）跑通，且经销商明确提出需求** |
| **`rysnova-bim`**（深化/施工 BIM） | 同上 |
| **`lifecycle`**（终身运维）· **`aftersales`**（售后） | 同上 |
| 营销中枢 L5 实验台 · 预算 AI 再分配 | GEO 闭环验证（P2）完成且有可归因数据 |

### 5.4 客户赋能专业模块（原 PRD D4 四模块 —— 按 §1.2「止于售前」重新裁定）

| 模块 | 属售前？ | 裁定 |
|---|---|---|
| **`ai-design`** | ✅ 售前 AI 设计与审计 | **重建**（L4 唯一重建项） |
| `rysnova-bim` | ❌ 深化/施工阶段 | **冻结** |
| `lifecycle` | ❌ 终身运维 | **冻结** |
| `aftersales` | ❌ 售后 | **冻结** |

欠债由 `guard:core-domain-coverage` 追踪并记入 `evidence/release-evidence.json#prdD4CoreDomainRecovery`。
**半恢复（有目录无接线）视为阻断**——半个模块比没有更危险。

> 变更说明（2026-08-04）：原 PRD D4 要求四个模块全部恢复。按本文 §1.2 锁定的
> 「技术支持止于售前专业度」，仅 `ai-design` 属当期范围，其余三个转入 §5.3 冻结册。
> 这把该方向的工作量从"四模块重建"收敛到"一模块重建"。

### 5.4-A 售前专业度链路（技术支持模块架构 · 一期定架构，二期深化）

```
需求进入            选型计算              设计与审计            报价交付
──────────      ──────────────      ──────────────      ──────────
 diagnosis   →      design        →     ai-design     →     quote
 (2,448行)         (510行)             (待重建)            (834行)
 品牌入口          hvac-kernels        AI 方案生成         报价单
 已建成            9 域计算             + 事实核查           已建成
                      │                     │
                      ▼                     ▼
              ┌───────────────────────────────────┐
              │  合规闸 evaluateCalcGate（横切）   │  ← §5.5.4 专业度红线
              │  任一内核失败/覆盖不全 → 阻断      │     已建成 + 6 条回归测试
              └───────────────────────────────────┘
                      │
              ┌───────────────────────────────────┐
              │  审计 AiDesignAuditEntity（横切）  │  已建成
              │  记 kernelVersion / gateStatus     │
              └───────────────────────────────────┘
```

**架构铁律（一期定死，二期只填实现）**：

1. **依赖方向单向**：`diagnosis → design → ai-design → quote`。**禁止反向依赖**，禁止 quote 直接调 hvac-kernels（必须经 design 的合规闸）。
2. **内核入参契约唯一**：所有内核调用必须经 `design/kernel-contract.ts` 定义的统一契约与适配层。
   > 现状（§8-#6）：`runCalc` 把同一扁平 input 直接扇出给 8 个内核，各内核参数形状不同 → `load` 收不到 city 而失败。
   > **一期只定契约，二期实现适配器。**
3. **合规闸不可绕过**：任何对外输出的方案/报价，其 `gate.pass` 必须为 true。半合规即不合规。
4. **止于售前**：本链路到 `quote` 为止。施工/验收/运维不在链上（§1.2 / §5.3 冻结）。
5. **成熟度如实标注**：`ai-design` 在 §5.5.6 矩阵中为**规划**，不得在任何文档/界面宣称已建成。

---

## 5.5 治理铁律（每条都有可执行门禁）

| # | 铁律 | 门禁 |
|---|---|---|
| 5.5.1 | **RLS 为隔离主干**：应用连接必须用非超级用户 `rhautt_app`（NOSUPERUSER/NOBYPASSRLS）。超级用户绕过全部策略，等于没有隔离。 | `guard:rls-enforcement`（真库真角色实证） |
| 5.5.2 | **事实链隔离**：营销/GEO 内容必引 L1 事实，**绝不回写精算内核与产品可信链**。 | `guard:product-fact-base` |
| 5.5.3 | **AI 治理**：AI 产出默认 `draft`，人工核准才 `approved`；每次调用必须记录真实 token 成本（禁止硬编码 0）。AI 统一经 Tandem 治理网关。 | `guard:event-contract` · 成本落 `growth_copy_asset.tokens_cost` |
| 5.5.4 | **专业度红线**：设计计算的合规闸，任一内核失败或覆盖不完整**一律阻断**，不得部分合规。 | `guard:core-domain-coverage`（含 design-calc-gate 回归测试） |
| 5.5.5 | **GEO 机器可读**：对外站每页 canonical/OG/JSON-LD + 站根 robots(AI爬虫白名单)/sitemap。改页必跑 `npm run geo:build`。 | `guard:geo` |
| 5.5.6 | **设计标准 · 三层权威分离**（2026-08-04 裁定，见下表）：混用即违规。禁内联 hex、禁内联布局样式。 | `guard:rheem-vi-production:strict` · `guard:geo` |
| 5.5.7 | **Schema 治理**：仅 curated SQL 迁移，TypeORM `synchronize=OFF` / `migrationsRun=false`。 | `guard:postgres-target-schema` |
| 5.5.8 | **生产声明须有可执行证据**，且证据须来自**真实运行**；凡状态标 `simulated` 者不得充当生产证明。 | `guard:ledger`（`--fail-on=real`） |
| 5.5.9 | **门禁预算**：门禁总数受限于真实维护能力；连续保不绿者退役。**保不住的门禁是负债不是安全网。** | `guard:ledger` 账本 |

### 5.5.6-A 设计标准的三层权威（不可混用）

| 层 | 权威来源 | 主色 | 性质 |
|---|---|---|---|
| **VI · 对外品牌站**<br>（rheem-cn / ruud-cn / everhot-cn / rhautt / rysnova-cn） | **设备厂商官方品牌工具包**<br>`docs/brand-standards/*`（Ruud 已规范化，来源 `My.Ruud.com/BrandStandards`）+ `packages/tokens/*.css` | **`#E4002B`（PMS 185 C · RGB 228 0 43）** | 🔒 **授权约束，非审美偏好。CORE / NON-NEGOTIABLE，不可更改** |
| **UI · 内部工作台**<br>（dealer-workbench / 品牌控制台） | **Tandem** `docs/UI-DESIGN-COMMUNICATION.md` + `lib/design-tokens.ts`（三层 Token / Apple Soft 阴影 / 组件语言） | `#C8202C`（`--brand-500`） | 集团内部工具统一，可借鉴照搬 |
| **UX · 体验层**（全部界面） | `DESIGN.md §9-16` + `docs/ux/UX-AUDIT-CHECKLIST.md`（A–I 逐屏） | — | 状态五态/反馈/WCAG AA/渐进披露/响应式/表单/IA/性能 |

**铁律**：
1. **不得把 Tandem 的 `#C8202C` 套到对外品牌站**——那会违反厂商官方品牌标准（授权风险）。
2. **不得把厂商官方 VI 的稀缺红用法搬进内部后台**（既有审计 §7.3：红色应保持稀缺，CTA 不得全做成实心红磁贴）。
3. **SI（空间识别）与 VI 同源**：同属厂商官方工具包，不由工程侧自创。

### 5.5.6-B 内容治理：数值锁死 · 文案可运营

内容分三类，处理方式不可混用：

| 类 | 例子 | 谁维护 | 机制 |
|---|---|---|---|
| **运营自助** | 产品主数据 · 站点新闻 · 产品上架 · 站点设置 · Logo | **运营（无需开发）** | 已有后台 CRUD（`products/page.tsx` · `brand-sites/*`） |
| **文案可运营** | 技术内容页的标题/引言/判定叙述/FAQ 问法 | **运营** | `content/tech-content.zh-CN.json` → `npm run tech:content` |
| **数值锁死** | 国标限值 · 推荐流速 · 风速上限 · 计算参数 · 厂商官方色值 | **只能由内核/官方工具包决定** | 见下两道闸 |

**数值锁的两道闸**：
1. **结构闸**：文案 JSON **不设放表格数据的字段**——限值表只能由 `packages/domain/hvac-kernels` 导出。运营无处可填。
2. **文本闸**：文案字段内**禁止裸写「数字+单位」**（`dB(A)` / `m/s` / `m³/h` / `W/m²` / `kW` / `℃` / `次/h`）。技术量必须用 `{占位符}` 由内核填充。
   > 实测漏洞（2026-08-04）：只有结构闸时，运营可在 FAQ 里写「99 dB(A)」并成功发布，与上方限值表自相矛盾。故补第二道闸。

**为什么数值不能交给运营**：国标数值一旦被手改，就与计算内核脱节——经销商按页面报的数与系统算的数不一致，**专业度直接崩**，而这正是 §1 定义中 Nexus 要负责的东西。

守卫：`guard:tech-content`（页面 = 当前文案 + 当前内核数值，任一漂移即红）。

### 禁令
Agents 不得：改产品边界命名 · 提升候选面 · 绕过 API 契约 · 无证据删除或丢失资产 · 声称实时 IoT 控制责任 · 向 Tandem 其他板块扩张 · **变更对外品牌站的厂商官方色值**。

### 正向义务
1. **先证明后宣称**：任何"已完成/生产可用"必须附可执行命令。
2. **改治理物须引更高权威**：修改门禁/契约须引用本文具体条款。
3. **发现文档与现实不符必须上报**，不得沉默绕过。

---

#### 5.5.6 能力成熟度矩阵

> **本矩阵为能力状态的权威口径；正文任何表述与本矩阵冲突时，以本矩阵为准。**
> 状态图例：**已建成**（有运行实例与可执行证据）/ **进行中**（部分落地）/ **规划**（尚未落地，不得对外宣称）
> **功能级展开（含用户利益、前端可用性）见 `docs/NEXUS-FUNCTION-CATALOG.md`（权威功能目录）。**

| 能力 | 状态 | 证据/说明 |
|---|---|---|
| PostgreSQL RLS 租户隔离 | 已建成 | `guard:rls-enforcement`：非超级用户角色，错租户 0 行 |
| 事务性 outbox 事件投递 | 已建成 | `guard:postgres-transaction-outbox` · redis-stream 消费组语义单测 |
| GEO 机器可读层（对外站） | 已建成 | `guard:geo`：4 静态站 68 页全绿 + robots/sitemap |
| AI 治理网关（收口 Tandem） | 已建成 | 真实模型调用 + token 成本落账 |
| 设计计算合规闸 | 已建成 | design-calc-gate 6 条回归测试 |
| hvac-kernels 9 域计算 | 进行中 | 7,456 行引擎已接线；测试覆盖不足，P0 补齐中 |
| 技术内容化（L2 内容页） | 进行中 | everhot 61 页；Rheem/Ruud 各 3 页，P1 扩充 |
| GEO 闭环实验（第7层） | 已建成 | 探测→缺口→内容→复投→验证 lift 端到端跑通；后端 5 端点 + growth_geo_experiment 表(RLS) + 前端 GeoExperimentPanel（before→lift→after 可视化）。 |
| GEO 策略库（AgenticGEO 式） | 已建成 | 研究支撑策略库（geo-strategies.ts，7 策略带论文实测增益）；statistics/cite-sources/anchor-chunks 为保底必选（默认注入高增益手法）；策略键落 growth_copy_asset.strategy_keys。实测：FAQ 生成体现"依据 GB/T 23137"等引用。 |
| GEO 自进化（lift→权重反哺） | 已建成 | computeStrategyWeights：已验证实验的 lift 按所用策略归因 → 平均 lift 作 weightOverrides → 下次生成优先用高 lift 策略。端点 `geo/strategy-weights`。当前无已验证 lift 故权重为空（正确：无数据不臆造）。 |
| GEO 可见度三层拆分 | 已建成 | fetched≠cited≠mentioned（arXiv 2509.08919）：cited(含我方域名出处/真引用) / mentioned(仅品牌名) / none。即时计算对历史数据生效。**实测纠偏：旧"可见度 67%"实为 cited 0% + mentioned 2 —— 过去把"被提及"高估成"被引用"。** |
| 多模态生成（文生图） | 进行中 | 架构就绪：Tandem `/api/image-generation`（OpenAI 兼容文生图，服务令牌通道）+ Nexus `materials/generate-image`（落物料库，含合规/审核字段）。**provider key 未配 → 如实 501/503 降级，不伪造图**；配任一兼容服务（混元生图/gpt-image/通义万相）即出图，零改代码。腾讯白皮书对标（妙思 CTR+19%）。 |
| GEO 受治理动作引擎（Foundry Ontology 借鉴） | 已建成 | 学 Palantir Foundry「动词/kinetics」工程机制（学思想·不共享 Tandem 代码·只覆盖 GEO 主线）：geo-actions.ts 定义受治理 Action（validate→zone闸→execute→审计）。generate-content(yellow)/run-experiment(green)/verify-lift(green) 收敛为动作，**人与 AI Agent 走同一套治理闸**。实测：AI 代行黄区动作被拦「须核准」、核准后放行、绿区自动放行，审计链 blocked→executed 完整入库（对齐宪章 §12）。这是通往 AgenticGEO「AI 自主调动作」的架构地基。 |
| 客户赋能专业模块（D4 重建） | 规划 | rysnova-bim / ai-design / lifecycle / aftersales |
| **Temporal 工作流编排** | 规划 | 未落地运行实例 |
| **事件总线终态（Kafka/NATS）** | 规划 | 当前为 PG outbox + redis-stream |
| **OLAP 数仓 / CDC 分析上行** | 规划 | 未落地 |
| **板块级物理分库** | 规划 | 当前单库 schema 隔离 + RLS |
| **HA/DR 故障切换与 PITR 恢复演练** | 规划 | 未演练 |
| 多租户外售（entitlement 双轴） | 规划 | 已冻结，见 §5.3 |

---

## 6. 北极星与度量

**北极星（当期）＝ `GEO→高意向线索数`**（副指标：经销商成交率）。
理由：它正是 A（品牌建设）交接给 B（经销商成交）的**交界量**，同时可测、可归因、直连使命。
（「活跃且盈利的经销商数」的**盈利口径尚不可测**，见 §8-#1；口径成熟后升级为北极星。）

### 6.1 两张验收表（付费方与受益方不是同一张）

| 看表人 | 关心什么 | 指标 |
|---|---|---|
| **总部**（付费方 · 品牌所有者） | 品牌是否被看见、招商是否变容易 | GEO 可见度指数（被引率×排名×意图权重）· **GEO→高意向线索数** · 技术内容覆盖率 · 招商转化 |
| **经销商**（客户 · 受益方） | 我是否更专业、是否多赚钱 | **成交率**（GEO 来源 vs 其他来源）· 方案合规闸通过率 · 报价响应时长 |

> 两表分立是刻意的：总部要的是"品牌好卖"，经销商要的是"我赚钱"。
> **只做其中一张，另一方就会觉得这套系统与自己无关。**

| 其他健康度 | 指标 | 层 |
|---|---|---|
| 专业度 | 合规闸通过率 · 计算覆盖完整率 | L4 / §5.5.4 |
| 内容地基 | 对外站 GEO ready 率 · 技术内容页数 | L2 / §5.5.5 |

---

## 7. 路线图

| 期 | 主题 | 验收（可证伪） |
|---|---|---|
| **P0** | 保住核心资产可信度 | 合规闸静默降级已修 ✅；hvac-kernels 9 域基准算例覆盖 |
| **P1** | 技术内容化 | Rheem/Ruud 覆盖主力品类；内容必引 L1 事实；`guard:geo` 全绿；守 DESIGN/VI/SI |
| **P2** | GEO 闭环验证 | 能证明"某内容上线后该问题被引率 X%→Y%" |
| **P3** | 效果仪表 + 赋能工具 | 能回答"GEO 线索的成交率是否高于其他来源" |
| **P4** | 复制 | 方法论复制到其他品牌/集团（Tandem 为复制体系） |

---

## 8. 未决事项（禁止伪装成已决）

| # | 事项 | 状态 |
|---|---|---|
| 1 | 「活跃且盈利的经销商数」的**盈利口径** | 未定，当期用 §6 代理指标 |
| 2 | 集团站 rhautt.com（Next 应用）GEO 测量手段 | 待建，缺口记于 `evidence/release-evidence.json#geoUnmeasuredSites` |
| 3 | 遗留路由面 reconciliation（`guard:catalog` 与 `guard:routes` 互斥） | 待裁定 |
| 5 | **VI/SI 标准仅 Ruud 一家规范化**：`docs/brand-standards/RUUD-OFFICIAL-VI-SI-STANDARD.md`（权威·锁定，逐字来自官方工具包）。**Rheem / Everhot / Lithnova 无对应 VI/SI 标准文件**（Rheem 仅有 `skills/rheem-design-director/references/` 下散落参考，非权威锁定件）。<br>影响：P1 技术内容化要在这些品牌站上生成页面，届时 VI 有 token 可守、**SI 无据可依**。<br>处置：需从各厂商官方品牌工具包补齐，**不由工程侧自创**。 | 待补官方来源 |
| 6 | **`runCalc` 与内核之间无入参契约（二期深化）**：`design.runCalc` 把同一个扁平 `input` 扇出给 8 个内核，但每个内核有各自的参数形状。实测 `{area,city,rooms}` 调用时 —— `load` 报「未找到城市 undefined 的气候数据」（城市没传到）、`airConditioning` 无 rooms 时给出 25 W/m² 的退化结果、`freshAir` 用 `occupancy` 而非 `residents`。<br>此前因失败被静默吞掉而无人察觉（已由 §5.5.4 合规闸暴露）。<br>处置：二期为内核定义统一入参契约 + 适配层 + 契约测试。 | 二期 |
| 7 | **`hydraulic` 未真正参与计算（二期深化）**：`runCalc` 中 `systems['hydraulic'] = HydraulicEngine`（存的是**类本身**，从未调用），却计入 coverage。属"假计算项"。 | 二期 |
| 4 | **空调冷负荷两条路径不一致（专业度风险，需领域评审）**：`AirConditioningEngine` 房间级 `calculateRoomLoad` = **120 W/m²**（与 `quickEstimate` 及行业常识一致）；整机级 `calculateCoolingLoad` = **25 W/m²**（120m² 上海仅 3,056 W，且 `freshAir` 分项为 0）。**同引擎内相差 4.8 倍**，若按整机路径选型将严重偏小。<br>证据：`packages/domain/hvac-kernels/air-conditioning/AirConditioningEngine.js` L108-140（整机）vs L243-263（房间级）。<br>**不得由工程侧擅自改负荷常数**——需暖通领域评审对国标核定后修正，并同步更新黄金值。 | **待领域评审** |

---

*本文件为定稿基线。任何与本文冲突的历史文档均已归档，不再具备效力。*
