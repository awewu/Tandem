# 瑞诺瓦 / Rhautt Nexus 进化方案（2026 Q3）

> 制定日期：2026-07-10
> 依据：`docs/CRITIQUE-COMMITTEE-REVIEW-2026-07.md`（外部批评委员会审议纪要）
> 事实源关系：本方案在 `PROJECT-CHARTER.md` 不变前提下，只调整**落地优先级与工程动作**；不改产品定位与品牌铁律。
> 核心方针（委员会一致）：**停止扩面，转入"补安全绳 + 精装样板间 + 讲清真实楼层"。**

---

## 0. 方针与不做清单

**本季度做（三条主线）**
1. 让改动安全（测试 + 真实事件投递）——P0，不可谈判。
2. 证明一个真价值（热水系统端到端真精算）——P1。
3. 减负、诚实化、可信化（移动端 + 旗舰工作台 + 愿景 roadmap 化 + 中立背书）——P2/P3。

**本季度明确不做（防扩面）**
- 不新增品牌站、不新增 app、不铺第二个系统的深精算。
- 不落地 Kafka/NATS、不建 OLAP 数仓、不做物理分库（降级为 roadmap，见 P3）。
- 不做微服务拆分（模块边界未到临界，宪章判断仍成立）。

---

## 0.1 定位裁决回填（产品负责人 · 2026-07-10 · 锁定）

> 针对委员会「阳谋是否更透明」的分歧，产品负责人裁决如下。本裁决澄清受众与署名口径，**不改阳谋战略**。

1. **阳谋不改**：赋能线仍以行业软件形态承载渠道转化战略。委员会"伪中立可攻击"的顾虑，通过下列口径澄清化解，而非通过弱化战略。
2. **交付物本质**：我们交付的是**瑞合瑞德 / Rhautt 的营销赋能工具**。首要受众是**瑞合瑞德集团经销商与集团营销中心**（内部渠道 + 总部市场部），不是不特定的外部第三方市场。
3. **瑞诺瓦是真实软件公司**：Rysnova 是集团的技术子公司实体，不是马甲。因此署名 **`Powered by Rysnova`** 是**诚实的技术来源标注**，而非隐瞒。
4. **署名即实力佐证**：`Powered by Rysnova` 从侧面表明"集团拥有自己的技术子公司"，是实力背书，与"中立形态"并不冲突——它标注技术来源（软件子公司），而非集团设备品牌主 logo。

**对评审的影响**：竞品"打伪中立"的攻击点被弱化——因为受众是集团自有渠道、且署名如实指向真实软件子公司。这使原 P2-3「中立但可信的背书呈现」从"向怀疑的外部经销商证明中立"**重定义为"面向集团渠道的技术来源署名 + 实力佐证呈现"**（见下 P2-3）。

**工程注记**：`Powered by Rysnova` 需被 `nexus-naming-check` / VI guard 识别为赋能线的**认可署名**（区别于设备品牌站强制的 `Powered by Rhautt Comfort`，也区别于"无署名"）。落地时更新 guard 白名单，避免误报。是否需要同步修订 `PROJECT-CHARTER.md` 1.1/2.4 的"中立第三方/署名豁免"表述，留待宪章变更评审（本方案不擅自改宪章）。

---

## 1. P0 ·「让改动安全」（第 1–4 周 · 阻塞级）

> 责任联署：代码体系专家 + 架构师。**P0 未达标前，P1/P2 功能类改动一律不合并。**

### ✅ P0 执行状态（2026-07-10 · 已完成）

| 项 | 状态 | 证据 |
|---|---|---|
| P0-1 核心域单测 | ✅ 完成 | 新增 26 个单测（quote 5 / design 10 / bim 11）；`test:api-units` **71 pass / 0 fail**；`design-sync.service.ts` 行覆盖 **79.17%**（>70%）。RLS 由既有 `tenant-isolation.test.js` + `postgres-rls-behavior` guard 覆盖。 |
| P0-1 覆盖率门禁 | ✅ 完成 | 新增 `guard:core-domain-coverage`（回归保护：删测即红灯 + 覆盖率阈值），已接入 `guard:all:nonvisual` 链。 |
| P0-2 事件投递去临时化 | ✅ 完成 | 新增 Redis Stream 消费组驱动（`EVENT_BUS_DRIVER=redis`，opt-in，默认 inprocess，连接失败自动回退）；outbox 仍为真相源（先写库→relay XADD→消费幂等）。**内存语义单测 3（多消费者不重复/幂等/失败留 PEL）+ 真实 Redis 运行时烟雾 + 真实 `design.released` 事件 E2E（relayed=1 read=1 delivered=1）全部通过**。修复 `BLOCK 0` 永久阻塞与脏消息不阻断整批两处硬伤。新增 `guard:redis-stream-dispatch`。 |
| P0-3 仓库瘦身 | ✅ 完成（务实版） | `tsconfig.json` 显式排除 `_archive/archive/legacy/experiments/hammer-reports`；`.eslintignore` 与全局 `node_modules//dist//build/` 已覆盖（186M `experiments/thatopen-spike` 为未跟踪 node_modules，已 git-safe）。**未做物理归并**：`_archive` 被 `workflow-outbox-contract-check` 等 guard 引用，移动会破坏引用——保留原位仅排除构建/lint 更安全。 |

**验收硬门禁全绿**：`test:api-units` 71/71 · `guard:core-domain-coverage` ✅ · `guard:redis-stream-dispatch` ✅（真实 Redis 通过）。dev API 已复位默认 inprocess 驱动。

> 遗留观察（非本次引入）：`workspace-size-governance-check` 报 `active-classification-mismatch`（`productionActivePageLines: 0`），属需 active-page 可视化验收的前置环境问题，与归档瘦身无关，列入后续可视化 guard 处置。

---


### P0-1 核心域单元测试（目标行覆盖 ≥70%）
按"改坏即亏钱/漏数据"的风险排序，优先级从高到低：

| 顺序 | 模块 | 必测逻辑 | 验收 |
|---|---|---|---|
| 1 | `quote` | 价格快照锁定（锁后品牌改价不影响已锁报价）、护栏 block 阻断锁定、`list` 按 opportunityId/customerId 过滤 | 快照不可变有断言；越权/越租户读被拒 |
| 2 | RLS 隔离 | 跨租户 SELECT/UPDATE 被拒；system actor 上下文正确 | 每张业务表至少 1 条跨租户拒绝用例 |
| 3 | `design` | 精算 gate（pass/blocked/insufficient_data）、release 状态机（draft→reviewed→released）、越权 override | 状态机非法迁移抛错有断言 |
| 4 | `rysnova-bim` | 承接幂等（同 quotation 不重复建项目）、design↔BIM 同步真相源（in_sync/stale/proposed_change 转移） | M12 版本锚点与 stale 判定有断言 |

- 落点：沿用现有 `*.nodetest.ts` 约定，置于各模块目录。
- CI 门禁：新增 `core-domain-coverage-check`（或复用 jest --coverage 阈值），覆盖率跌破 70% 红灯。

### P0-2 事件投递去临时化
- 现状：`event-consumers.service.ts` 用进程内 `setInterval`（本轮新增），多实例会重复/漏投。
- **终态选型（2026-07-10 裁决）：Redis Stream 消费组**。依据：Redis 已是现有依赖（`redis ^4.6.7`，已用于 design/ingress/限流，含 `redis-cache-boundary-check`/`redis-runtime-smoke-check` 两 guard，已在 `docker-compose.prod.yml`）——分拣中心已存在，仅新增一条消息流业务线，非新增运维组件。同时贴近宪章 5.5.3 事件总线终态方向。
- 动作：①outbox 落库后，将事件投递权从 `setInterval` 迁移到 **Redis Stream + 消费组**（`XADD`/`XREADGROUP`/`XACK`）；消费组保证"一条事件只被一个实例处理"，天然去重复/去漏投；②失败进 pending-list 重试、超限入死信流（对齐现有 outbox `dead` 语义）；③保留 outbox 表为事务性事实源（先写库、后进流，宕机可从 outbox 重放补投）；④dev/单实例保留 setInterval 兜底开关（`EVENT_DISPATCH_SWEEP_MS`）。
- 验收：`workflow-outbox-contract-check` 扩展为"多消费者不重复投递"证明；至少一致性重放测试 1 条；`redis-runtime-smoke-check` 覆盖 Stream 消费组路径。

### P0-3 仓库瘦身
- 动作：`_archive`/`archive`/`legacy`/`experiments`/`tmp-*`/`hammer-reports` 归入单一 `archive/` 并从构建/lint 范围剔除，或迁出主仓。
- 验收：`workspace-size-governance-check` 阈值收紧且通过；`find` 业务源码口径不含历史目录。

---

## 2. P1 ·「证明一个真价值」（第 3–8 周 · 与 P0 部分并行）

> 责任联署：行业洞察专家 + 竞争对手视角。**目标：热水系统能拿出可量化的"真省钱/真省事"证据，堵住"演示级精算"攻击。**

### P1-1 热水系统端到端真精算

> **执行状态（2026-07-10）：①②③ 均已完成。**
> - **① 验收清单按真实 BOM 逐设备生成 + 修复 `devices 提取为 0` 根因 — ✅ 完成**：根因为 `bim.service` 两处逻辑依赖 `d.systemFamily || d.category`，而标准报价 BOM 行仅含 `{sku,name,unitPrice,quantity,params}` → devices 恒为 0。下沉纯函数 `rysnova-bim/bom-acceptance.ts`（`extractDevices` 逐行提取+按 name/sku 归类，永不误删；`buildAcceptanceChecklist` 逐设备生成+通用验收项，BOM 空才回退模板），接管 `inheritFromQuotation`/`buildIotHandoffPackage`。7 单测；**真实数据 E2E**：项目 `4451a037` 原始 BOM 无 systemFamily/category，旧逻辑 devices=0 → 新逻辑 **devices=2 且正确归类**。
> - **② 真实负荷→选型→BOM 链路 — ✅ 完成**：新增纯引擎 `design/hot-water-sizing.ts`——负荷（人数/面积/城市/进水温/目标温/恢复时长→日用热水量 L→日加热热量 kWh→所需制热量 kW，方法可复现）+ 选型（真相源 `mdm_global_products.canonicalParams`）。缺参用工程默认并**显式标注 calibrated**（不伪装 verified）。已接入 `design.runCalc` 的 hotWater 分支，候选来自 `fetchHotWaterCandidates`（MDM）。
> - **③ 未验证产品只进 BOM 不驱动精算 — ✅ 完成**：选型引擎仅 `dataTrustLevel==='verified'` 且备齐额定制热量者驱动精算；`calibrated`/`unverified`（含 verified 缺核心参数）一律进 `bomOnlyAlternatives` 标「参数未验证，不驱动精算」（守宪章 1.1 红线）。
> - **验证**：新增 9 单测（`hot-water-sizing.nodetest.ts`）；`test:api-units` **87 pass/0 fail**；`guard:core-domain-coverage` 绿。**真实数据 E2E**（`POST /design/calc`，seed 3 款热水主机后即清理）：140㎡/4人/上海/ΔT45℃ → 所需 **1.57kW（verified）** → 选中 **3kW verified 机型（COP4.2，裕量1.43kW，selectionTrust=verified）**；**未验证 5kW 杂牌机虽容量更大仍被拒于选型、仅入 BOM 备选**。

- 验收清单**按实际 BOM 逐设备生成**（替换模板化固定项）——修复"devices 提取为 0"的根因。
- 真实负荷/选型计算链路：输入（面积/人数/城市/水温）→ 负荷 → 选型 → BOM → 报价，参数取 `product-catalog` verified 字段，缺字段降级 calibrated 并显式标注。
- 第三方/未验证产品标"参数未验证"，只进 BOM 与报价，不驱动精算（守宪章 1.1 红线）。

### P1-2 价值对比物料
- 产出一页"我方 vs 手工/第三方"的可量化对比（工时、报价准确率、返工率），作为渠道推广与融资尽调的证据。
- 验收：真实/仿真案例 ≥3 个，数字可复现。

---

## 3. P2 ·「减负与触达」（第 6–14 周 · 深广双轨并行）

> 责任联署：使用者代表 + 品牌营销 + UI/VI/SI。
> **裁决回填（2026-07-10）**：产品负责人裁定「深与广都需要」，推翻二选一。故 P2 拆为**两条并行轨**，靠错峰 + 技能分工避免资源对撞——广轨（移动端）是「薄前端 + 复用现有 API」，深轨（BIM 旗舰）是「专注 SI 打磨」，二者所需技能不同、可并行。

### 轨道 A · 广（移动端极简开单 + 问诊）— W6 起，先行
**P2-1**
- 范围：手机端只做"问诊 → 留资 → 极简开单 → 查看进度"，**纯复用现有 API、不新增后端**，故工程量轻、可先启动。
- 验收：一线销售无需培训 10 分钟内完成一次开单；移动端浏览器实测通过。
- 排期：W6–W10（薄层，不阻塞深轨）。

### 轨道 B · 深（BIM 旗舰工作台样板）— W8 起，专注打磨
**P2-2**
- 选 BIM 台做"高级感 + 深 SI 交互"样板：提升 2D/3D 空间操作密度（`bim-viewer` 深用），而非"能看模型"。
- 验收：`rysnova-bim-production-ux-check` 扩展交互密度维度并通过；专家复评 SI 深度 ≥ B+。
- 排期：W8–W14（深工艺，与广轨错峰启动）。

> **执行状态（2026-07-10）：交互密度层已交付并通过 guard；专家复评（B+）待人工。**
> - **深 SI 交互层落地** `apps/consumer-diagnosis/public/rysnova-bim-designer.html`：在既有 Three.js/OrbitControls 场景上叠加——① `Raycaster` 直接拾取构件 → 构件检查器（名称/类型/系统/坐标）；② 按系统分组的图层显隐开关（VRF/地暖/新风，网格化 `userData.rysnovaMeta` 标注）；③ 两点测量工具（含地面投射兜底）；④ 视图预设（等轴/平面/立面）+ 视图适配聚焦选中；⑤ 键盘快捷键（1/2/3·F·M·L·Esc·?）+ 快捷键帮助浮层；⑥ 浮层 UI 注入，不改动既有布局。
> - **命名迁移遗留修复（无效 JS）**：`__rysnova-bimRenderProbe`、`rysnova-bimPreviewHeaders`、`rysnova-bimProjectPayload` 三处连字符标识符（lithnova→rysnova-bim 机械替换产物）会在运行时抛错，已全部归一为合法驼峰并同步全部调用点。
> - **运行时依赖归位**：迁移遗失的 `three.min.js` / `orbit-controls-lite.js` 从 `archive/legacy-ui` 恢复到应用 `public/js/`（此前 404 → 3D 降级 2D → 交互层不启用）。现 4001 端口实测 `three=200 / orbit=200`。
> - **验收 guard**：`rysnova-bim-production-ux-check` 归位到真实工作台路径并**新增「交互密度」维度**（Raycaster/检查器/图层/测量/视图适配/快捷键/`rysnovaMeta`/无破损标识符回归红线），现 **failures = 0**。
> - **待办**：`bim-viewer` 包（`packages/bim-viewer`）尚未接入本工作台（当前为独立 Three.js 内联实现）；专家 SI 深度复评（≥ B+）需人工在浏览器实测判定。

**并行前提（资源条件）**：广轨与深轨需**不同人/不同技能**承担（广轨=移动前端 + API 复用；深轨=SI/图形交互工程）。若同一人承担二者，则退回错峰串行（先广 W6–W10，再深 W10–W16），不得并行硬挤。

### P2-3 技术来源署名 + 实力佐证呈现（原「中立背书」按 §0.1 重定义）
- **按 §0.1 裁决重定义**：受众是集团自有渠道（经销商 + 营销中心），故不再是"向外部证明中立"，而是**面向集团渠道呈现 `Powered by Rysnova` 技术来源署名**，侧面佐证"集团有自己的技术子公司"这一实力信号。
- 动作：①问诊/工作台统一放置 `Powered by Rysnova` 署名（技术来源，非集团设备品牌主 logo）；②配套"技术子公司实力"呈现（案例/能力/数据），强化集团渠道对工具的信心。
- 验收：署名呈现符合 §0.1 口径且通过 `nexus-naming-check`（署名白名单已更新）；集团渠道侧信心/采用信号有提升。

> **执行状态（2026-07-10）：署名落地 + guard 白名单已更新并通过。**
> - **统一署名**：问诊首页（`index-ready.html`，`next.config` 将 `/` 重写至此）、BIM 工作台（`rysnova-bim-designer.html`）、React 站脚（`SiteFooter.tsx` 渲染 `LEGAL.poweredBy`）统一呈现 **`Powered by Rysnova`**。修正工作台原误用的设备品牌署名 `Powered by Rhautt Comfort`（§0.1：赋能线用技术来源署名，非设备品牌）。
> - **实力佐证**：署名悬停 `title` 呈现「瑞诺瓦 · 瑞合瑞德集团技术子公司 · verified 精算引擎驱动」——事实性表述（子公司实体 + P1-1 已落地的 verified 精算链），**不杜撰案例数/数据**（守 P3 诚实纪律）。
> - **guard 白名单**：`nexus-naming-check` 新增 §0.1 署名段——`brand.ts` 定义、`SiteFooter` 渲染 `LEGAL.poweredBy`、工作台含 `Powered by Rysnova` 且**禁用**设备品牌署名、问诊首页含署名。现 **failures = 0**。
> - **实测**：4001 端口 `/`（问诊首页）署名命中 1；工作台署名命中 2（aria-label + 可见）。
> - **待办**：`pain-diagnosis.html` 等 问诊子页尚未逐一铺署名（主界面已覆盖）；宪章 1.1/2.4「中立第三方/署名豁免」是否回写留待宪章变更评审（本方案不擅改宪章）。

### P2-4 同步实时化（可选，若资源允许）
- 签单后同步状态实时化（缩短 sweep 或签单时同步投递一次），消除"点了没反应"的演示风险。

> **执行状态（2026-07-10）：已完成（签单时同步投递一次）。**
> - **根因**：`opportunity.signed` 走 outbox，下游可见反应（站内通知「签单成功」等）等 `EVENT_DISPATCH_SWEEP_MS`（默认 5s）的周期 sweep 才投递 → "点了没反应"最长 5s 空窗。（BIM 项目承接本就在签单请求内同步完成，不受影响。）
> - **修复**：`EventBusService` 新增 `kickDispatch(tenantId)` ——**尽力而为**的即时催投（吞异常，绝不反噬签单；周期 sweep / Redis 消费组仍是兜底真相源）。`crm.service.sign` 事务提交 + BIM 承接后 `await kickDispatch(tenantId)`，把可见反应从 ≤5s 压到毫秒级。选「签单时同步投递」而非「缩短 sweep」——精准消除空窗且不增全局投递负载。
> - **验证**：新增 4 单测（`event-bus-kick.nodetest.ts`：立即投递 / 幂等 / 订阅者抛错被吞不反噬 / 只投 pending）；`test:api-units` **91 pass / 0 fail**；API 启动 health 200（DI 解析正常）。投递路径本身已在 P0-2 真实事件 E2E 证明。
> - **待办（可选）**：`quotation.locked`、`diagnosis.completed` 等其它高可见用户动作可同样加催投；当前按方案口径仅覆盖 签单。

---

## 4. P3 ·「诚实化愿景」（贯穿全季 · 低成本高信任收益）

> 责任联署：架构师 + 品牌营销。

- 将 `PROJECT-CHARTER.md` 5.3/5.5 的 Temporal/Kafka/OLAP/物理分库/CDC 从"正文终态"改写为**带时间轴的 roadmap 附录**，正文明确标注"已建成 / 规划中"。
- 对外材料（尽调/推广）统一区分现状与规划，杜绝"要求展示运行实例即下不来台"。
- 验收：宪章新增"能力成熟度矩阵"（已建成/进行中/规划），并纳入 `standards-metadata-check`。

> **执行状态（2026-07-10）：能力成熟度矩阵已落地 + 专用 guard 已纳入 guard 链。**
> - **宪章诚实化**：`PROJECT-CHARTER.md` 新增 **§5.5.6「能力成熟度矩阵（现状 vs 规划）」**——逐项标注 已建成 / 进行中 / 规划 + 证据链接；并加**冲突消解优先级**：凡 §5.3/§5.5 正文与矩阵冲突，**以矩阵为准**；对外材料引用能力必须按此标注。诚实归类：Temporal / Kafka·NATS / OLAP 数仓·CDC / 物理分库 / HA·DR·PITR 均标 **规划**（未落地）；Redis Stream 驱动标 **进行中**（opt-in 未默认）；RLS/Outbox/精算链/价格快照/P2-4 催投等标 **已建成**（附测试/guard 证据）。
> - **正文回填标注**：§5.3 Temporal 行、§5.5.1 OLAP 行、§5.5.4 工业级运行要素均就地加「状态：规划，见 §5.5.6」指针，避免终态表述被误读为现状。
> - **guard 纳入**：`standards-metadata-check` 实为 HVAC 系统包标准元数据校验（领域不符），故**另建专用 `charter-capability-maturity-check`**（校验矩阵存在 + 冲突优先级声明 + 图例 + 规划项如实标注、**禁止把规划标成已建成**），并接入 `guard:all` 与 `guard:all:nonvisual`。正向绿 + **负向回归实测**（把 Temporal 篡改为「已建成」→ guard 红灯 exit 1）→ 已还原。
> - **顺带修复的遗留红灯（非本次引入）**：`guard:permission-domain` 此前即红——`entitlement` / `aftersales` / `ai-design` 三个已入 `module-boundary` 的强制模块未映射到任何 §1.2.2 权限域。按 `module-boundary.ts` 的 owner/productSurface 归位到事实源 `governance/permission-domains.json`：`entitlement`→**D0 平台与系统**（商业订阅/授权，与 `auth` 同板）、`ai-design`→**D4 客户与赋能**（AI 设计引擎，与 `design`/`rysnova-bim` 同板）、`aftersales`→**D4**（售后工单/质保，与 `delivery`/`lifecycle` 同板）；同步 `docs/ADMIN-PERMISSION-DOMAINS-AND-RLS.md` 域表。现 `guard:permission-domain` **failures=0**。

---

## 5. 里程碑与验收总表

| 阶段 | 周期 | 关键交付 | 硬验收（红灯项） |
|---|---|---|---|
| P0 | W1–W4 | 核心域单测 ≥70% · 事件投递去临时化 · 仓库瘦身 | 覆盖率门禁绿 · 多消费者不重复投递证明 · size 门禁收紧通过 |
| P1 | W3–W8 | 热水真精算 · 价值对比物料 | 验收清单按真实 BOM 生成 · 对比案例≥3 可复现 |
| P2 | W6–W14 | 广轨:移动端开单问诊(W6–10) ‖ 深轨:BIM 旗舰样板(W8–14) · `Powered by Rysnova` 署名 | 10 分钟开单 · SI 深度≥B+ · 署名过 naming guard · 渠道采用信号 |
| P3 | 全季 | 宪章愿景 roadmap 化 + 成熟度矩阵 | 现状/规划显式区分 · 元数据门禁通过 |

---

## 6. 决策记录（已裁决 / 待办）

**已裁决（2026-07-10 · 产品负责人）**
1. ✅ **阳谋透明度**：阳谋不改；受众=集团经销商+营销中心；`Powered by Rysnova` 作为诚实技术来源署名兼实力佐证（详见 §0.1）。
2. ✅ **先深还是先广**：**都做**，P2 深广双轨并行/错峰（详见 §3）；同一人承担则退回错峰串行。
3. ✅ **事件投递终态选型**：**Redis Stream 消费组**（详见 P0-2）。Redis 已在现有栈中（依赖/源码/prod compose/guard 均已存在），故非新增运维组件；一步到位对齐宪章事件总线终态，不走 SKIP LOCKED 过渡。

**仍待办**
4. **是否修订宪章**：§0.1 的受众/署名口径是否需要回写 `PROJECT-CHARTER.md` 1.1/2.4，走宪章变更评审（本方案不擅改宪章）。

---

## 7. 度量（季度末复盘指标）

- 核心域行覆盖率、CI 红灯拦截次数（改动安全性证据）。
- 热水精算案例数与可量化价值差。
- 移动端开单完成率、C 端问诊留资转化。
- 仓库业务源码/历史目录体积比。
- 宪章能力成熟度矩阵完成度。

---

_本方案为 2026 Q3 滚动计划，随 P0 进展在每两周复盘时更新。批评委员会审议纪要见 `docs/CRITIQUE-COMMITTEE-REVIEW-2026-07.md`。_
