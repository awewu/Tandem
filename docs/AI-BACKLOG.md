# Tandem · AI 能力 Backlog

> 雷达扫到的、过了 4 道闸门、值得评估的 AI 能力候选清单。
>
> **每季度 review 一次**，重新打分排序。完成的归档到底部 `## 已完成`。
>
> 协作文档: `ROADMAP-AI.md` (策略框架) · `AI-RADAR.md` (信号扫描)

---

## 评估维度（每条 backlog 必填）

| 字段 | 说明 |
|---|---|
| **ID** | `B-NNN` 三位数字，永久不变 |
| **能力** | 一句话描述要做什么 |
| **来源** | 雷达哪个月扫到的 / 来自哪个 provider |
| **解谁的痛** | 具体用户场景，不能是抽象的"提升体验" |
| **接入成本** | 1 (≤1天) / 2 (1-3天) / 3 (1-2周) / 4 (>2周) |
| **价值** | 1 (锦上添花) / 2 (有用) / 3 (强需求) / 4 (战略级) |
| **状态** | 观察 / 待评估 / 进 sprint / 已完成 / 已丢弃 |
| **拥有者** | 谁负责跟进 |

**优先级 = 价值 - 接入成本**。> 0 才考虑做。

---

## 当前 Backlog（按优先级降序）

### 🔴 战略级 / 高优先 · OKR-DRIVEN 灵魂层 (2026-05-27/28 立项)

> 这 4 条来自 `docs/OKR-DRIVEN-ARCHITECTURE.md` § 三 14→18 器官升级. 是 Tandem 从"组件集合"晋级"企业级 Agent"的第一性原理落地. 优先级一律 +战略级.

#### B-014 · OKR Anchor 注入器 (CompanyBrain system prompt) ✅ **已完成 (2026-05-28)**

- **来源**: OKR-DRIVEN §三 第1条 (企业 AI = 组织目标聚焦达成)
- **解谁的痛**: CompanyBrain 此前不知道公司在追什么 OKR, 任何答复都不能聚焦战略目标
- **接入成本**: 1 (实际 ~1h)
- **价值**: 4 (战略级)
- **状态**: ✅ **已完成**
- **拥有者**: Cascade
- **交付物**:
  - `lib/persona/company-brain.ts` 新增 `buildOkrAnchorContext()` — 拉 active 周期公司层 Objective + KR 进展 + at-risk 标记
  - `buildCompanyBrainSystemPrompt()` 嵌入 OKR 上下文在最前
  - 加 LLM 输出约束 "任何建议都应回答这服务/不服务哪个 OKR"

#### B-015 · OKR Drift Detection (Baseline-Guard 第二闸)

- **来源**: OKR-DRIVEN §三 第2条 (整体能力提升 + 约束聚焦) + §四 Skill Gateway 闸②
- **解谁的痛**: 议事 / 个人 AI 调用 / Decision 漂离当前 OKR 时无人警告. 没有"约束聚焦"这一向.
- **接入成本**: 3 (1 周)
- **价值**: 4 (战略级)
- **状态**: 待 sprint (V1.5 OKR-DRIVE-M1 必含)
- **拥有者**: TBD
- **设计**:
  - 为 Decision/skill 调用计算"OKR 对齐度" (用 LLM 仲裁或简单 keyword 匹配 + KR cascade)
  - 阈值 ≤ 0.3 → 进议事室升级; 0.3-0.6 → 进黄区签批; ≥ 0.6 → 直接放行
  - 加 `governance.okr_drift_detected` audit
- **依赖**: B-014 (需先有公司 OKR 上下文)

#### B-016 · 个人 AI 产出 Capture 层 (IDE 插件优先)

- **来源**: OKR-DRIVEN §三 第3条 + MANIFESTO 第十九条
- **解谁的痛**: 员工用 Claude Code/Cursor 写的代码、用 Notion AI 写的文档、用个人 AI 做的决议, 当前**无路径回流到 Tandem 企业资产**. 个人 AI 的产出在组织维度等于 0.
- **接入成本**: 4 (1-2 月, 多端)
- **价值**: 4 (战略级 — 这是反哺组织的唯一通道)
- **状态**: 待 sprint (V2 启动)
- **拥有者**: TBD
- **路径**:
  1. **IDE 插件 (VSCode/JetBrains)**: 监听 commit / PR / chat 历史 → push 到 Tandem Material 层 (个人级)
  2. **邮件 webhook**: 个人 AI 起草邮件落 cc 到 capture@tandem.local → 进 Tandem
  3. **文档元数据**: Notion/Lark 文档加 `x-tandem-capture` header → 自动同步 Material
- **依赖**: 无, 但 MCP 化 (B-002) 完成后更顺

#### B-017 · Skill Gateway 4 道闸

- **来源**: OKR-DRIVEN §四 Skill Gateway + MANIFESTO 第十九条
- **解谁的痛**: 个人 AI 调企业数据/工具时, 当前无统一组织级网关. 数据泄漏 / 红区破窗 / 合规黑洞风险.
- **接入成本**: 4 (1-2 月)
- **价值**: 4 (战略级 — 第十九条宪章落地)
- **状态**: 观察 → 待 sprint (V2-V3, 跟 B-016 协同)
- **拥有者**: TBD
- **设计 4 道闸**:
  1. **Baseline-Guard**: 红/黄/绿/灰区分类 + LLM 仲裁 (B-015 复用)
  2. **OKR Drift Detection**: 跟 active OKR 对齐 (B-015)
  3. **Data Scope**: RBAC + 4 级所有权
  4. **Action Scope**: ProxyAction 24h 否决窗
- **依赖**: B-002 (MCP) + B-015 (Drift) + B-016 (Capture)

---

### 🔴 战略级 · Persona 分身 AIGC 进化能力 (Gems-like 三件套)

> 来源: 2026-05-31 Owner 复盘. MANIFESTO §19 立宪 "拥抱个人 AI", 当前只做了**反向**通道 (Claude Code 经 MCP 调进 Tandem); **正向通道完全没做** (Tandem 分身主动出站调 GPT-image / Perplexity / Notion AI). Gemini Gems 三件套 (自定义 instructions + 知识库 + 工具勾选) 在 Tandem 实现度 ≈ 20%, 是当前最大架构欠款. 三条立项, 跟 OKR-DRIVE-M1 之后串行排.

#### B-021 · Persona Skill Builder UI (Gems-like 配置面板)

- **来源**: 2026-05-31 Owner 复盘 + MANIFESTO §19 + `lib/persona/company-brain.ts:91` `enabledSkills` 字段空跑
- **解谁的痛**: 员工 — 当前分身能力固化在代码里, 用户不能像 Gems 那样自己组装"我的财务搭子" = 自定义 instructions + 上传知识 + 勾选工具集. `enabledSkills` 字段已存在但 UI 0 行.
- **接入成本**: 3 (3-5 天)
- **价值**: 4 (战略 — §19 落地的用户侧入口)
- **优先级**: 0 (V2 起手)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - `/persona/builder` 单页: 三 Tab (Instructions / Knowledge / Skills)
  - Instructions: 用户可覆盖 StyleProfile 自动学到的风格 (差量存 `personaInstructionOverride` 字段)
  - Knowledge: 上传 md/pdf → 切片入 Memory 表 (type='persona_knowledge', ownerUserId 隔离)
  - Skills: 勾选 `enabledSkills[]` (来源 = B-022 注册表)
  - 所有变更进 audit (`persona.builder.updated`)
- **依赖**: B-022 (要有出站 skill 注册表才有得勾)

#### B-022 · 出站 Skill 适配器 (Tandem 分身 → 外部 AIGC, 经 Skill Gateway)

- **来源**: 2026-05-31 Owner 复盘 + MANIFESTO §19 (出站亦经此闸) + `app/summon/external/page.tsx` 当前是 PlaceholderPage
- **解谁的痛**: 员工 — Tandem 分身现在是"哑壳", 不会调外部 AIGC. 想让分身"帮我搜一下竞品近期新闻"/"画一张架构图"/"读这个 PDF 摘要" 全部做不到. 第 §19 条 "拥抱个人 AI" 只兑现了一半.
- **接入成本**: 4 (1-2 周)
- **价值**: 5 (战略 — Tandem 分身首次具备 AIGC 进化能力)
- **优先级**: 0 (V2 起手, 跟 B-021 协同)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - 新增 `lib/skill-gateway/outbound/` 目录, 每个外部 AIGC 一个 adapter
  - 首发 5 个: `web.search` (Perplexity) / `image.gen` (GPT-image-1) / `doc.summarize` (Anthropic) / `mcp.notion` / `mcp.github`
  - 统一接口 `OutboundSkill { id, label, requiredScope, invoke(input, ctx) }`
  - 调用前必经 `runSkillGateway()` (现有 `lib/skill-gateway/index.ts`), `actionScope='send_external'` 默认 HARD_BLOCK, 由用户在 Builder 显式授权升黄
  - 失败 fail-soft, 写 `LlmUsageLog` 归因到 actor
  - 全部调用走 audit (`skill_gateway.outbound_invoked`)
- **依赖**: B-017 (Skill Gateway 4 道闸已落) + B-023 (BYOK)

#### B-023 · BYOK 凭据库 (员工自带 API Key)

- **来源**: MANIFESTO §19 + `app/summon/external/page.tsx:16` "员工自带 key (BYOK) 不消耗公司 token (v2)" + 当前代码 0 行
- **解谁的痛**: 财务 / 员工 — 出站 AIGC 调用若全用公司 key, 成本不可控且无法归因到个人; 员工自带 key 还可让 Tandem 兑现 §19 "Tandem 不重发明个人 AI" 的真正承诺.
- **接入成本**: 3 (1 周)
- **价值**: 4 (成本 + 合规 + §19 兑现)
- **优先级**: 0 (V2, B-022 前置)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - `KvStore` collection='byok_credential', key=`${userId}:${provider}`, value=AES-GCM 加密 (KEK 走 env `BYOK_KEK`)
  - 新增 `lib/byok/credential.ts`: `getKey(userId, provider)` / `setKey(userId, provider, plaintext)` / `revokeKey(...)`
  - `/persona/builder` 多一 Tab "Credentials": 录入 + 测试连通性 (调一次最便宜的 ping 端点)
  - 出站 adapter 优先取 actor key, fallback 到公司 key (公司 key 用量进 LlmUsageLog 加 fallback 标签)
  - 所有 set/revoke 进 audit
- **依赖**: 无 (但 B-022 必须等它)

---

### 🔴 战略级 · Persona 进化五引擎 (真"进化", 不是假学习)

> 来源: 2026-05-31 Owner 复盘 "再想想分身如何进化". 当前 persona 子系统是**3 引擎漏气 + 2 引擎根本没装**: 能力/知识/风格三引擎写了一半 (`learning-collector.ts:33` 只 +1 计数, `enabledSkills` 有字段无 UI, communicationExamples 单向写不读回); **战略引擎**(OKR 切换 → 重组分身) 0 行; **反思引擎**(VETOED 归因) 只数数不诊断. 五引擎缺一就跑不起飞轮 — 之前 B-021/B-022/B-023 的 "Gems-like 三件套" 没这五条等于摆设.
>
> 五引擎: ① 能力 (skill 加载 = B-022) ② 知识 (Memory/上传) ③ 风格 (StyleProfile) ④ 战略 (OKR 同步) ⑤ 反思 (失败归因). 闭环 = 议事 outcome → 反思诊断 → 反推前 4 引擎调整 → 下次议事更准.

#### B-024 · Persona 反思引擎 (VETOED 归因 + 负样本库)

- **来源**: 2026-05-31 Owner 复盘. 现状 `lib/persona/learning-collector.ts:33-42` 只 `+1 vetoedByUser`, **不问"为什么被否"**. 计数 ≠ 学习, 否决 100 次还是同样错.
- **解谁的痛**: Owner / 员工 — 当前所有"训练台/学习闭环/StyleProfile" 都是**假学习**, 因为没有诊断机制反向修. 这条不落, 之前 B-021/B-022/B-023 全是摆设.
- **接入成本**: 4 (5-7 天)
- **价值**: 5 (战略 — 五引擎根. 不落这条, persona 进化整盘是假象)
- **优先级**: 0 (V2 起手, **B-021/B-022/B-023 之前**)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - 议事 VETOED / Decision selected='D' (用户推翻 AI 建议) 触发 LLM 写一条 `RetroNote`: 议题 / 被否选项 / 被否原因 / 反推归类 (knowledge_gap | style_drift | skill_misuse | okr_drift | other)
  - 落库: `Memory` 表 type='retro_note' + `KvStore` collection='persona_negative_examples'
  - **反推前 4 引擎**:
    - skill_misuse 累积 ≥ 3 次 → 自动从 `enabledSkills` 卸该 skill, 通知用户
    - knowledge_gap → 提示用户"建议上传 X 类知识" (跳 B-021 Knowledge Tab)
    - style_drift → 该 RetroNote 摘要进 next prompt 的 `negative_examples` 段
    - okr_drift → 落 `okr-drift` audit + 跳 B-025 realign
  - 新增 `lib/persona/reflection.ts` `reflectOnVeto(decisionId)` (LLM 单点调用, fail-soft)
- **依赖**: 无 (基于现有 `learning-collector` + Memory + LLM)

#### B-025 · Persona 战略引擎 (OKR 切换 → 重组分身)

- **来源**: 2026-05-31 Owner 复盘. 全代码搜不到 OKR 切换 → 重组 `enabledSkills` / 淘汰过时 examples 的逻辑. §19 + OKR-DRIVEN 灵魂没接通.
- **解谁的痛**: Owner — Q3 OKR 切到 Q4, 分身**毫无感知**继续干上季度的活. 跟 OKR-DRIVEN 第 4 条 "牛马 = OKR 驱动器严格版" 直接矛盾.
- **接入成本**: 3 (1 周)
- **价值**: 5 (战略 — §19 + OKR-DRIVEN 代码兑现)
- **优先级**: 0 (V2, B-024 之后)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - 监听 `eventBus` 事件 `okr.cycle_changed` (新增, 由 OKR 模块发)
  - 触发 `realignPersonaToOkr(userId, oldOkr, newOkr)`:
    1. 跑 `skillRegistry.search(newOkr.kr.title)` 找新 OKR 高相关 skill, 提议 register
    2. 跑相同检索, 旧 OKR 不沾边的 skill 标记为 candidate-unregister
    3. `communicationExamples` 加 staleness 标记 (旧 cycle 的衰减权重 0.3)
    4. 写 `growthArea` `category='okr_realign'` status='identified' 等用户确认
  - 通知:"OKR 切到 Q4 后, 我建议: 卸 [X], 加 [Y], 你确认?"
  - 跟 B-021 Persona Builder Skills Tab 共用 UI 入口
- **依赖**: B-022 (要有 skill 市场才有得加) + B-014 OKR 注入器 (已落)

#### B-026 · 跨 Persona 学习 · Anti-pattern 共享库

- **来源**: 2026-05-31 Owner 复盘. 当前每个 persona 各自踩坑, 30 个同事重复犯同类错.
- **解谁的痛**: Steward / HR / 新员工 — 同岗位 (e.g. 销售 / 工程师) newborn 入职时, 应继承组织级"前人踩过的坑"; 现状 0.
- **接入成本**: 4 (1-2 周, 等 B-024 跑出语料)
- **价值**: 4 (组织级 — 30 人不再重复试错)
- **优先级**: 0 (V2.5, 紧跟 B-024)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - `lib/persona/anti-pattern.ts` `aggregateRetroNotes(opts: { okrAnchor?, role? })`
  - LLM 把 N 条同岗位/同 OKR 的 RetroNote 抽象成"某岗位 X 类员工常犯 Y 类错" (去敏感化 — 不带姓名/具体决议 ID)
  - 落到 `Memory` type='org_anti_pattern' tenantId 范围, 不带 ownerUserId
  - 同岗位 newborn / apprentice 入职时, system prompt prepend top-5 相关 anti-pattern
  - 季度 Steward review 一次, 失效的标记 archived
  - 隐私守门: 抽象前 LLM 必须返回 `containsPii: false`, 否则人审
- **依赖**: B-024 (需要 RetroNote 语料)

#### B-027 · 价值观锚 (Constitutional Persona)

- **来源**: 2026-05-31 Owner 复盘. 当前没"老板的不可妥协原则"显式建模, 对话久了 persona 容易漂.
- **解谁的痛**: Owner — 跟 OKR Drift 平级, 但管"性格红线"而不是"目标偏离". 比如 "绝不在没合同情况下打折" 这类硬规则.
- **接入成本**: 2 (2-3 天 + 季度 review)
- **价值**: 3 (防漂移, 比 OKR drift 更底层)
- **优先级**: 1 (V2.5)
- **状态**: ✅ MVP 已落地 (2026-05-31)
- **拥有者**: TBD
- **设计 (✅ = 已实现)**:
  - ✅ `KvStore` collection='persona_constitutions', key=userId, value=`PersonaConstitution { rules: ConstitutionRule[], createdAt, updatedAt }` (`lib/types/persona-constitution.ts`, MAX_ACTIVE_RULES=10)
  - ✅ Service `lib/persona/constitution.ts` (load/add/archive + `getConstitutionPromptSegment`) + audit `persona.constitution.rule_added/archived`
  - ✅ API `app/api/persona/[userId]/constitution/route.ts` (GET/POST/DELETE, 写权限限本人/admin, steward 只读)
  - ✅ 每次 system prompt 拼装硬前置, 标 "## 不可妥协原则 (违反 = 重答)" (`lib/persona/compose-prompt.ts` + 生产注入在 `lib/decision-layer/three-plus-one-engine.ts` Option B, 优先级高于组织记忆基线)
  - ✅ UI: `/persona/training` 挂 `PersonaConstitutionCard` (增删 + 归档历史, 10 条上限)
  - ⏳ (后续 sprint) LLM 输出后 baseline-guard 二次扫描: 输出是否违反 constitution rule, 违反 → 重生成 + audit
  - ⏳ (后续 sprint) 季度 `governance.constitution_review` 任务: Owner / Steward review 每条是否仍有效
- **依赖**: 无

#### B-028 · 探索预算 (Multi-Armed Bandit)

- **来源**: 2026-05-31 Owner 复盘. 当前分身永远只用熟练 skill, 无主动尝试.
- **解谁的痛**: Owner — persona 不主动学新 skill = 永远停在当前能力上限.
- **接入成本**: 3 (3-5 天)
- **价值**: 3 (主动性 — 让 persona 自己找进化方向)
- **优先级**: 1 (V3, 等 B-022/B-024 数据积累)
- **状态**: 观察
- **拥有者**: TBD
- **设计**:
  - 给每 persona 每周 N 次 (默认 3) "试新 skill" 配额
  - ε-greedy: 90% 用 top-success skill, 10% 试 `enabledSkills` 中调用次数 <5 的或新加载的
  - 每次试用结果 (用户接受 / 否决) 进入 `LlmUsageLog` 标 `experimentalSkill: true`
  - 累积成功率 > 阈值 → 该 skill 升为常用; 失败 ≥ 3 次 → 候选 unregister
  - bandit state 落 `KvStore` collection='persona_bandit_state'
- **依赖**: B-022 (skill 市场) + B-024 (反思反馈)

---

### � BSC 平衡记分卡补全 (KPI 体系深化)

> 来源: 2026-05-30 Owner 复盘 "KPI 是否引入 BSC 核心精神". 现状:
> - ✅ 已落: `KpiSubject.bscPerspective` + `Kpi.bscPerspective` 字段 (`lib/types/kpi.ts`); `/kpi` 个人页四维分组渲染 (`app/kpi/page.tsx`); `KpiSubject` 树带 BSC 维度.
> - ⚠️ 未落: **因果传导链 (Strategy Map)** + **四维配比强制校验**. BSC 原版灵魂 = "Learning & Growth → Internal Process → Customer → Financial" 因果链 + 维度权重分布 (financial ≤ 50%).
> 这两条补齐后, BSC 才算精神 + 形式都到位.

#### B-019 · BSC Strategy Map · 因果传导链建模

- **来源**: CHARTER-KPI-TTI §2 + 2026-05-30 复盘
- **解谁的痛**: HR / 高管 — 当前 BSC 四维仅作分类标签, 无法回答"我投学习成长这个 KPI, 是否最终拉动了财务 KPI"; 缺战略地图可视化, 年终复盘无因果证据.
- **接入成本**: 2 (2-3 天)
- **价值**: 3 (BSC 灵魂到位, 长期决策证据链)
- **优先级**: 0 (V1.5 补)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - 新增 `KpiCausalLink` 表: `{ id, fromKpiId, toKpiId, hypothesis: string, strength: 'weak'|'medium'|'strong', validatedAt?, evidenceUrl? }`
  - 约束: `from.bscPerspective` 在因果链下游 (growth → process → customer → financial 单向, 反向需走议事室特批)
  - `/admin/kpi/strategy-map` 工作台: 拓扑图 (D3/Reactflow) 显示四维节点 + KPI 子节点 + 因果链
  - 年终关闭流程加 "因果链验证" 步骤: 标记哪些 hypothesis 被实际数据印证 (strong/medium/weak)
- **依赖**: 无 (复用 `Kpi.bscPerspective` 已落字段)

#### B-020 · BSC 四维配比强制校验

- **来源**: Kaplan/Norton 原版 BSC 建议 + 2026-05-30 复盘
- **解谁的痛**: HR / 高管 — `/admin/kpi/setup` 当前只校验三层 cascade 一致性, 不校验"四维权重分布", 容易出现 "财务 KPI 占 80%, 学习成长 5%" 的失衡, 退回单一财务考核.
- **接入成本**: 1 (0.5-1 天)
- **价值**: 2 (防失衡, 立竿见影)
- **优先级**: 0 (V1.5 补)
- **状态**: 待 sprint
- **拥有者**: TBD
- **设计**:
  - `lib/kpi/bsc-validation.ts`: `computeBscDistribution(kpis)` → `{ financial, customer, process, growth }` (按 weight 求和归一)
  - 健康区间 (软警告, 不阻断): financial ≤ 50%, customer/process/growth 各 ≥ 10%
  - `/admin/kpi/setup` 顶部加四维雷达图 + 失衡黄区告警
  - 周期 `draft → active` 激活时若严重失衡 (某维度 = 0% 或 financial > 70%) → 二次确认 + audit 留痕
- **依赖**: 无

---

### �🔴 战略级 / 高优先 · 通用 AI 能力

#### B-002 · `lib/tools/` MCP 化

- **来源**: 2026-05 月报 L3 · MCP 已成事实标准
- **解谁的痛**: 用户希望 Tandem 能集成钉钉日历 / GitHub issue / Notion / 企业邮箱等。当前每集成一个都要写一份 adapter，工作量重复
- **接入成本**: 3（1-2 周，要重构当前 lib/agents 的工具调用层）
- **价值**: 4（战略级 — 标准化后享受全社区第三方工具生态）
- **优先级**: +1
- **状态**: 待评估
- **拥有者**: TBD
- **备注**: 等 OpenAI 也明确支持 MCP 后启动（已半官方表态）。先不动 schema，先读 spec 写 ADR

#### B-005 · `LlmUsageLog` 表 + 埋点 + 成本报表 ✅ **已完成 (2026-05-27)**

- **来源**: ROADMAP-AI.md "代码层 AI-Ready 清单"
- **解谁的痛**: Owner / 财务 / 你自己 — 不知道 AI 调用每月花多少钱、哪个场景烧最多、是否被某用户刷
- **接入成本**: 2（实际: 1 个会话）
- **价值**: 4（战略级）
- **优先级**: +2
- **状态**: ✅ **已完成**, 详见 commit "feat: usage analytics + LLM cost dashboard"
- **拥有者**: Cascade
- **交付物**:
  - `lib/infra/drizzle-schema.ts` 加 `llmUsageLog` + `usageEvent` 表
  - `drizzle/migrations/0003_usage_and_llm_log.sql` 已应用到本地 PG
  - `lib/analytics/track.ts` 提供 `track()` / `trackLlm()` + 价格表 + cost 估算
  - `lib/taf/router.ts` chat() 自动埋 LlmUsageLog (success + failure 都记)
  - `app/api/analytics/track/route.ts` 前端埋点入口 (匿名容忍)
  - `app/api/admin/usage/route.ts` 看板数据 API
  - `app/admin/usage/page.tsx` 看板 UI (总览 + Top 事件/用户 / LLM provider / scenario / 每日趋势 / 失败原因)

#### B-007 · `lib/agent-runtime/` adapter 层

- **来源**: ROADMAP-AI.md
- **解谁的痛**: 工程团队 — 当前 9 个页面直接耦合 Hermes CLI。Hermes 升级 / 想换 langchain 都要改一大片
- **接入成本**: 2（1 天，但需要小心不破坏现有 9 个页面）
- **价值**: 3（战略级 — 解耦 agent runtime，未来切换零成本）
- **优先级**: +1
- **状态**: 待 sprint（计划 Phase 3，下下次会话启动）
- **拥有者**: Cascade

### 🟡 高价值 / 中优先

#### B-003 · Anthropic Prompt Caching 接入

- **来源**: 2026-05 月报 L2
- **解谁的痛**: Owner 关心成本 — 当前 persona 系统 prompt 每次调用都全量发，浪费 token
- **接入成本**: 1（半天，Claude 已有原生支持）
- **价值**: 3（成本砍 50-90%，立竿见影）
- **优先级**: +2
- **状态**: 待评估
- **依赖**: 需先有 B-005 才能量化"砍了多少"
- **拥有者**: TBD

#### B-001 · DeepSeek-R1 推理模型接入

- **来源**: 2026-05 月报 L1
- **解谁的痛**: 议事决策模块 / OKR 推演 — 复杂思考类任务用普通 chat 模型质量不够
- **接入成本**: 1（半天，已有 DeepSeek adapter）
- **价值**: 2（特定场景质量提升）
- **优先级**: +1
- **状态**: 待评估
- **拥有者**: TBD
- **备注**: 加一个 `provider: 'deepseek-r1'` 选项到 TAF Router；只在 convergence + okr/ai-suggest 路由用

#### B-004 · OpenAI Structured Outputs 推广

- **来源**: 2026-05 月报 L2
- **解谁的痛**: 工程团队 — JSON parse 报错时不时出现，影响功能稳定性
- **接入成本**: 2（1-2 天，要扫现有所有 LLM 调用点改成 schema 约束）
- **价值**: 3（消除一类 production 错误）
- **优先级**: +1
- **状态**: 待评估

#### B-008 · Eval harness（LLM 回归测试）

- **来源**: ROADMAP-AI.md "代码层 AI-Ready 清单"
- **解谁的痛**: 工程团队 — 当前换模型 / 改 prompt 全靠肉眼测，质量回退要等用户投诉
- **接入成本**: 2（1-2 天，建一组 fixture + 跑分脚本）
- **价值**: 3（每次模型变更有回归保险）
- **优先级**: +1
- **状态**: 待评估
- **依赖**: 与 B-005 配合最佳

### 🟢 中等 / 待积累

#### B-006 · 长上下文 1M+ tokens 评估

- **来源**: 2026-05 月报 L2
- **解谁的痛**: 议事决策跨年度回顾 / 全公司 OKR 树喂 LLM 时上下文不够
- **接入成本**: 1（半天，Gemini 2 / Claude 已支持）
- **价值**: 2（特定场景，不是日常用）
- **优先级**: +1
- **状态**: 观察
- **备注**: 等 V2 国际化时一并接入 Gemini

#### B-009 · Qwen 2.5/3 国内备选 provider

- **来源**: 2026-05 月报 L1
- **解谁的痛**: 国内政企客户的"国产化要求"
- **接入成本**: 1（半天，加 adapter）
- **价值**: 2（特定客户群强需求）
- **优先级**: +1
- **状态**: 观察
- **备注**: 有第一个明确要求"国产化"的客户再启动

#### B-010 · OpenAI Realtime API / 语音 Coach

- **来源**: 2026-05 月报 L2
- **解谁的痛**: 1on1 模块的"教练对话"场景，文字打字不如语音自然
- **接入成本**: 4（>2 周，前端 audio 录制 + 后端 streaming + 整体交互重做）
- **价值**: 2（锦上添花，不是非有不可）
- **优先级**: -2
- **状态**: 观察（先不动）
- **备注**: 等 1on1 模块用户量起来再评估

### 🔵 观察 / 不急

#### B-011 · A2A 协议（Google Agent-to-Agent）

- **来源**: 2026-05 月报 L3
- **接入成本**: ?
- **价值**: ?（采纳度未明）
- **状态**: 观察 6 个月
- **下次 review**: 2026-11

#### B-012 · LangGraph state machine 范式

- **来源**: 2026-05 月报 L3
- **接入成本**: 4（如果切换 agent runtime）
- **价值**: 3（架构清晰度）
- **优先级**: -1（高代价）
- **状态**: 观察
- **依赖**: 需先有 B-007（agent-runtime adapter）才能干净切换

#### B-013 · Agentic RAG / GraphRAG

- **来源**: 2026-05 月报 L3
- **接入成本**: 3
- **价值**: 2（Memory 模块未来升级）
- **状态**: 观察

---

## 已完成

<!-- 完成的从上方移到这里, 加上完成日期和 commit / PR 链接 -->

（暂无）

---

## 已丢弃

<!-- 评估后决定不做的, 写明原因, 防止半年后又有人提 -->

#### B-XXX · Anthropic Computer Use

- **丢弃原因**: Tandem 当前用户场景（OKR / 协作 / 议事）不需要"agent 操作浏览器"。等 1 年后用户提出明确需求再说
- **丢弃日期**: 2026-05

---

## 下次 review

**日期**: 2026-08-（季度末）  
**该 review 的事**:

- 所有"观察"状态的条目，看是否升级 / 降级 / 丢弃
- 所有"已完成"项目，复盘是否达到预期价值
- 价值/成本评分是否需要重新打（业界变化后）
- 加入新一季度雷达扫到的新条目

---

## 模板（新增 backlog 时复制）

```markdown
#### B-NNN · <能力名>

- **来源**: <month 月报 / 哪个文档>
- **解谁的痛**: <具体场景，禁止抽象>
- **接入成本**: <1-4>
- **价值**: <1-4>
- **优先级**: <价值 - 成本>
- **状态**: <观察 / 待评估 / 进 sprint / 已完成 / 已丢弃>
- **拥有者**: <name or TBD>
- **依赖**: <如有>
- **备注**: <可选>
```
