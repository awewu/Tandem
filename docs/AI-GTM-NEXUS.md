# AI GTM Nexus · 开发规划（清爽重做版 · 新世界主线）

> 命名：本主线以 **AI GTM Nexus** 为独立标识，不与旧 NEXUS-* 文档/遗留代码搅和。软件平台名仍为 Rhautt Nexus / 瑞合数智枢纽（命名锁不变）；AI GTM Nexus 是"营销中台新世界"的工作主线名。

> 承接：基线 `NEXUS-MARKETING-PLATFORM-BASELINE.md`(v2.1) · PRD `NEXUS-PRD-v2.md` · 指标 `NEXUS-MARKETING-METRICS-SYSTEM.md` · 代码明细 `NEXUS-CODE-INVENTORY.md`。
> 版本 2026-08-06 · **清爽重做路线**（取代"分波拆旧退场"）。

## 0. 核心方针（不被旧世界捆绑）
- **NestJS(`services/api`) + Next(`apps/`) = 唯一干净世界。** 所有新能力只在这里按十模块设计建。
- **遇到旧/乱/耦合 → 不拆线头、不逐段迁移。** 需要的功能按新设计**重写**；其余**整体丢弃**。
- **只移植"皇冠资产"**（护城河，重写纯浪费）；其余遗留一律弃。
- **飞轮是目标不是枷锁**：在干净骨架里干净实现，不背旧包袱。
- 每步 guard:ledger 0 红 + 冒烟；弃旧在新能力就位后一次性切除，可回滚。

## 1. 移植 vs 重写 vs 丢弃（一次性说清）
### ✅ 移植皇冠资产（已在干净侧/可搬，不重写）
- GEO 全套（`growth`：探测/三层可见度/策略库自进化/受治理动作/分渠道归因）
- 暖通 9 域技术内核（`packages/domain/hvac-kernels`）
- 产品事实基座（`product-catalog`：PIM/positioning/内容工作流/关系/推荐）
- 品牌站管理（`brand-registry`）+ 站点素材（`site-materials`）
- 干净底座（`auth`/`tenant`/RLS/`mdm`/`compliance`/`entitlement`/`file-artifact`/`notification`）
- 度量（`cockpit`/`analytics`）
- 获客接缝（`diagnosis`/`ingress`/`crm`/`dispatch`）— 干净的留，混淆的（如 legacy front-office-runtime C 端）**重写**，不迁移

### ✍️ 按新设计重写（本就没有 或 旧的太乱）
- 权限：能力×scope 勾选后台
- CMO/事业部 五层驾驶舱 · GTM 战略呈现层
- 模块1 竞品/行业洞察 · 模块2 CDP+品牌定位
- 模块6 渠道与伙伴营销（招募/分层/返利/co-op/进销存）
- 产品管理补强（生命周期/NPI/卖点/定价审批）
- 分身×搭子 Agent 框架（双注册表/五分身/工作台）
- 遗留 C 端获客前台（front-office-runtime 的问诊/留资）→ 在 NestJS `diagnosis`/`ingress` 干净重写

### 🗑️ 整体丢弃（不拆、不迁移）
- 遗留 Express `server/`（48k，双栈技术债）——新能力就位后**整体删**，不再分波拆线头
- 客户赋能模块（quote/design/delivery/contracts/bim）——独立产品，移出本仓/另起
- 一切耦合/混淆代码：遇到即弃并按新设计重写

---

## 2. 阶段规划

### Phase 0 · 立干净骨架 + 移植皇冠
1. `services/api` 按十模块归位（productLine 标注：core/brand；客户赋能已剥离）。
2. 移植/确认皇冠资产在位（GEO/内核/事实基座/品牌站/底座/度量/获客）。
3. **能力×scope 权限勾选后台**（地基：驱动 nav/API/驾驶舱）。
4. `console.css` 接入 `packages/ui`（内部工具统一 token；对外品牌站各守独立 VI）。
- 出口：干净骨架可跑，皇冠在位，权限地基就绪。

### Phase 1 · 飞轮第一环 + 产品管理（差异化，最快见效）
1. 🗡️ **AgenticGEO**：探测→缺口→生成(draft)→复投→验证 lift→调权重 受治理自主闭环（green/yellow/red 分区 + 人核准 + 审计；推理走 Tandem governed-chat）。
2. 🛡️ **产品管理补强**：生命周期 + NPI 上市 + 卖点体系 + 定价审批(毛利闸) + 产品→营销联动。
- 出口：GEO 飞轮在干净骨架自主转；产品管理喂通营销策划。

### Phase 2 · 大脑 + 度量 + 战略层
1. 模块1 竞品/行业洞察（按品类）+ 洞察→策略。
2. 模块2 CDP + 品牌定位/messaging house。
3. 模块9：多触点归因 + 线索打分 + **CMO/事业部驾驶舱聚合层**（九屏按 BU 切片）+ MROI/预算。
4. **GTM 战略呈现层**：定位/价值主张/4P play/战役主题/品牌 OKR，cascade 成可测 OKR + CMO 舱闭环监控。
- 出口：战略→执行→度量闭环；有舱。

### Phase 3 · 命脉：渠道与伙伴营销
- 6.1 招募 + 6.2 分层认证 + 6.4 返利(毛利闸) + 6.11 绩效；再 6.5 co-op · 6.6 赋能包 · 6.9 进销存 · 6.8 窜货 · 6.12 可售目录授权。
- 出口：能招募/发返利/拨 co-op/看 sell-through。

### Phase 4 · 弃旧 + 扩面 + Agent 补全
1. **一次性弃旧**：生产入口切 NestJS → **删 `server/` 48k + 遗留孤儿** → 退役/改写相关门禁。（前置：Phase 0–3 已让 NestJS 覆盖营销中台所需能力）
2. 传播扩面：SEO · 付费投放 · 多社媒 · 营销自动化旅程 · 展会/PR。
3. 五分身补全（CMO/产品/品牌/渠道，照 GEO 分身复制）+ 搭子工作台 UI。
4. 模块10 补全：三级 OKR · 计费 · 集成连接器 · 可观测/DR。
- 出口：单一 NestJS 栈，旧世界清零；全渠道传播；平台级 Agent。

---

## 3. 里程碑 / 依赖 / 风险
- 里程碑：M1 权限后台+GEO飞轮 → M2 CMO舱+战略层 → M3 渠道营销 → M4 弃旧+全渠道。
- 依赖：Phase 0 硬前置（骨架/权限/token）；GEO 飞轮可与 Phase 0 并行；弃旧(Phase 4)前置=能力覆盖到位。
- 风险：范围大→严格按 Phase 串行、每 Phase 可交付；缺业务方验证→每 Phase 前拉品牌市场部/经销商确认；GEO 依赖外部引擎→冗余+降级+lift 置信。
- 原则复述：**不拆旧线头，需要就重写，其余整体丢；只护皇冠资产。**

_取代 `NEXUS-LEGACY-SERVER-RETIREMENT-PLAN.md` 的"分波拆解"——现改为 Phase 4 一次性弃旧。_
