---
status: 持续自我学习产出
date: 2026-05-11
input:
  - MANIFESTO.md (18 条宪章, 不可违)
  - PRD.md v0.3 (14 项决策, 6 北极星)
  - PRODUCT-DEFINITION.md
  - 既有 OKR-VS-TITA.md / WECOM-FEATURE-MAPPING.md
output: 6 项进化建议 + 3 项战略观察 + 1 张反例清单更新
constraint: 任何与宪章冲突的功能 → 不论商业收益 → 一律否决
review_cycle: 月度复审
---

# Tandem 持续进化方案 · 2026-05 月度

> **「我们不在地基上跳舞.」** 本文档读宪章 + PRD 后, 扫 4 大象限竞品 2025 H2 - 2026 H1 最新动作, 做相容性筛, 给 6 项进化建议. 与 18 条宪章冲突者一律否决, 已列入 §附录.

---

## 0. 摘要 (一表览全)

| # | 进化点 | 来源 | 与宪章相容性 | 优先级 | 工期 |
| --- | --- | --- | --- | --- | --- |
| 1 | 决议节奏护栏 (Habits 反向用) | Lattice Habits 2025-10 | ✅ 相容 (§1 + §11 反例改写) | V1.5 | 5 天 |
| 2 | 员工自助健康仪表盘 | Lattice Employee Health 反向 | ⚠️ 边界 (§13 尊严铁律) | V2 | 8 天 |
| 3 | HRIS Adapter (Moka/北森/钉钉 HR 入站) | 飞书 People 2025-5 战略压力 | ✅ 相容 (§18 OSS 借力) | V1.5 | 7 天 |
| 4 | OKR 智能纠偏 (强约束 3+1 版) | Tita 2025-7 AI 助理纠偏 | ✅ 相容 (§2 + §15) | V1 GA | 4 天 |
| 5 | Persona 工作记忆 (短期心智模型) | OpenAI/Claude Memory 趋势 | ✅ 相容 (§7 四层补强) | V1.5 | 6 天 |
| 6 | Steward Agent (治理官 AI Co-pilot) | MIT Sloan "HR for Agents" | ✅ 相容 (§14 已埋字段) | V2 | 10 天 |

**4 项观察 (不动手, 仅做战略立场记录)**:

- O1. 飞书 People 一体化 → Tandem 反向定位 "决议操作系统, 不做 HR 全栈"
- O2. 钉钉精选助理 6 大垂类 → Tandem 不下场 (§17 不做 OA/通用工具)
- O3. Lattice Agent Library Marketplace → 警惕但不抄, 治理成本极高
- O4. agentic enterprise 2026 → 「人在环」是 Tandem 护城河, 别人放弃就是我们的机会

---

## 1. 竞品 2025 H2 - 2026 H1 雷达图

### 1.1 Lattice (美国 HR-Tech 旗舰) · Fall/Winter 2025

新发布 (2025-10-21):

- **Habits** — 把战略目标拆成日/周微习惯, 员工每天打卡
- **AI Agent Plus** — 第二代 AI 代理, 能访问 Talent / Compensation 数据
- **AI Meeting Agent** — 自动开会前准备 + 会中纪要 + 会后跟进
- **Employee Health** — 检测 burnout / disengagement / quiet quitting
- **Agent Library** — 客户可定制 IT / Sales coach / Onboarding 等垂直 Agent

战略叙事: **"People + AI is the new way to work"**.

### 1.2 飞书 People (中国 HR-Tech 旗舰) · 2025-5

- 整合飞书 OKR + 飞书人事 + 飞书招聘 + 飞书绩效 → **飞书 People** 套件
- IM / 文档 / 日历 / 会议 → **飞书 Office** 套件
- 卖点: "投递→招聘→评价→激励→培养" 全周期 + 全景人才视角 + 数据打通

战略叙事: **"组织管理一体化, 不是零散功能拼盘"**. 明显是飞书拿"打包"封锁中型客户.

### 1.3 Tita (国内 OKR 标杆) · 2025-4 至 2025-7 月度发版

- 4月: AI 一键生成 OKR 地图
- 5月: 钉钉双向同步 + 工作事项一键分享
- 6月: OKR AI 智能诊断
- 7月: OKR AI 助理智能纠偏 + DeepSeek 智能对话 + AI 生成绩效分析报告

战略叙事: **AI 全面注入 OKR 管理流程**. 重点在"诊断 + 纠偏 + 报告生成".

### 1.4 钉钉 (中国通讯+协同 巨头) · 2025-7 WAIC

- 推 6 大精选 AI 助理: 工单 / Excel / 法务 / 财务洞察 / 会议记录 / 文档纠错
- 1+N 智能体目标 (1 个底座 + N 个垂类), 7亿用户
- 战略叙事: "技术平权 + 减重复"

### 1.5 行业趋势 (MIT Sloan + agentic enterprise 2026 共识)

- **2026 = agentic 操作卓越 vs 结构性失败的分水岭**
- 企业必须设 "HR for Agents" 角色 — 给 agent 服务账号 + 行为边界 + 防止权限提升
- 员工角色重定义: 从 "做事" 到 "监督/重定向/批判 agent 输出"
- onboarding 必须教新人"如何与 agent 共事"

---

## 2. 进化建议 6 项 (按优先级排)

### EVO-1 · 决议节奏护栏 (Habits 反向用) · V1.5 · 5 天

**来源**: Lattice Habits (2025-10) — 把战略拆日常微习惯, 每天打卡.

**冲突点**: 直抄会违反:

- 宪章 §1 "工作单元是决议, 不是消息/在线" — 打卡是低价值劳动
- 宪章 §11 "反对消息黏性, 拥抱异步聚合" — 每日打卡 = 制造焦虑
- 宪章 §15 "AI 助员工成长, 不替员工劳动" — 打卡退化成 KPI

**反向重构 (相容版)**:

不是 "员工每天给 AI 看自己干了啥", 而是 **"AI 提醒员工 KR 上的空白节奏"**:

- 利用现有 `lib/okr/cadence.ts` (objectivePulse) + ActivityFeed
- 规则: 一个 KR 连续 N 天 (KR cadence 决定 N) 没新 DecisionCard / CheckIn → AI 推一条**温和提示** (类似"这周还没决议产出, 是不是被某个外部依赖卡住了?")
- **关键铁律**:
  - 提示**只给员工本人**, 不上传上级 (§13 尊严)
  - 提示有"我现在不需要"按钮, 标记后 7 天不再推
  - **永不进入活动流**, 永不进入 9 宫格判定输入
  - **永不**按"打卡天数"做激励 / 排行榜 / 完成率 (§11.2)

**落地**:

```
新增: lib/okr/rhythm-nudge.ts (规则引擎)
扩展: components/dashboard/personal-dashboard.tsx (柔性提示卡片)
事件: cron 每日 9am 跑一次 → 写入个人收件箱 (不进 IM)
开关: 员工设置页可全局关闭
```

**度量**:

- ✅ 7 天内 nudge 后 DC 产出率 vs 控制组
- ❌ **不**度量"提示打开率" / "打卡连续天数" — 这一类即违反 §11.2

---

### EVO-2 · OKR 智能纠偏 (强约束 3+1 版) · V1 GA · 4 天

**来源**: Tita 2025-7 "AI 助理智能纠偏" + 4月"AI 一键生成 OKR 地图" + DeepSeek 智能对话.

**冲突风险**: Tita 路线**直改**员工 OKR — 这违反:

- 宪章 §2 "AI 给 3+1 选项, 不替员工决策"
- 宪章 §15 "AI 助员工成长, 不替员工劳动"

**强约束相容版**:

`OKRHealthPanel` 已经有"健康诊断" (本仓库 OKR-VS-TITA.md §1). 升级为:

```
诊断阶段: 同现有 (已实现)
建议阶段: AI 给 3+1 改写选项 (新增)
  🅰 SOP 方案: 套用历史相似 KR 模板的写法
  🅱 推演方案: 基于公司 Baseline 拟一个 (说明置信度)
  🅲 经验方案: 列出公司 3 个相似历史 KR 怎么写
  🅳 自创方案: 强制员工填"我多看到了什么不在 ABC 里的"
应用阶段: 员工选其一 → diff 视图 → 24h 否决窗口 → 写入 retrospective
```

**关键铁律**:

- 永不"一键改写" (违反 §2 例外条款的范围 — 改 OKR 不是常规决策)
- 永不静默写入 (24h 否决, §9.3)
- 连续 N 次员工选 🅰/🅱/🅲 → 系统降低 AI 介入度 (§15 退化检测)
- D 选项必须填且 ≥ 30 字 (反 AI 欺诈)

**落地**:

```
新增: lib/okr/refine-suggest.ts (调 LLM 生成 ABC)
扩展: components/okr/okr-health-panel.tsx (加"AI 改写建议" tab)
新增: components/okr/okr-refine-dialog.tsx (3+1 选项 + diff)
  - 复用议事室 components/convergence/options-panel.tsx 的 ABCD 卡片样式
事件: 员工提交 → DecisionCard 入库 (decision_type='okr-refine')
```

**度量**:

- ✅ D 选项使用率 ≥ 25% (高于北极星 20% 阈值)
- ✅ 员工接受 AI 建议后 30 天 KR 进度 vs 没接受组
- ❌ **不**度量"AI 建议采纳率" — 高采纳率 = AI 替员工做决定, 反我们价值

---

### EVO-3 · HRIS Adapter (Moka/北森/钉钉 HR 入站) · V1.5 · 7 天

**来源**: 飞书 People 2025-5 战略压力 — 打包诱惑下中型客户被锁.

**Tandem 立场** (引宪章 §17 + §18):

- 不做招聘 / 培训 / 薪酬 (§17 民企 sweet spot 限定 / §18 永不做 CRM/OA)
- 但**应集成**, 让客户从 Moka / 北森 / 钉钉 HR / 企微 HR 拉员工 + 部门 + 入职日期, 让 9-box / Persona / IDP 用上真数据

**为什么必要**:

- 9 宫格人才 (§10) 必须配真员工属性 (司龄, 部门, 职级) 才有 calibration 意义
- Persona 学员工风格需要稳定身份 (跨部门 / 调岗后保留学习数据)
- IDP 培养计划要落到 "下季度晋升候选" 等真业务事件

**落地**:

```
新增: lib/integrations/hris/
  ├─ moka-adapter.ts        (Moka API)
  ├─ beisen-adapter.ts      (北森 API)
  ├─ dingtalk-hr-adapter.ts (钉钉智能人事)
  └─ wework-hr-adapter.ts   (企微 HR)
仅入站, 不出站: 我们不写回 HRIS (避免成为他们的影子系统)
新增: app/admin/hris/page.tsx (管理员配置页)
事件: 每日 02:00 增量同步, 失败告警进 audit_event
schema: User.hrisExternalId (新增字段, 无破坏性)
```

**关键铁律**:

- 同步**只读**: HRIS → Tandem, 永不反向写
- **不**同步薪资 / 绩效评级 (§13 尊严, 不让 Tandem 知道员工工资数字)
- 入站员工默认 disabled=false, departmentId 填入, roles 由 admin 在 Tandem 后赋

---

### EVO-4 · Persona 工作记忆 (短期心智模型) · V1.5 · 6 天

**来源**: 2025 大模型趋势 — OpenAI Memory / Claude Projects / DeepSeek 上下文持久化都已成熟. 用户开始期待 AI "知道我现在在做什么".

**现状**: 宪章 §7 四层架构定义了 Origins/Materials/Memory/Baseline. Persona (拿捏老板) 已经学员工**长期风格**. 但 Persona 在 D 选项辅助 / 议事室裁判 / 决议预填时, 是否清楚员工**本周在做什么**?

**当前盲点**: Persona 接 long-term Memory, 但缺 **short-term working memory** (本周心智状态).

**补强方案**:

定义 `PersonaWorkingMemory` (新表):

```prisma
model PersonaWorkingMemory {
  id          String   @id @default(cuid())
  userId      String   // 谁的工作记忆
  weekStart   DateTime // 周一 00:00
  // 自动派生 (不让员工填):
  activeKrs       String[]  // 本周 progressBefore != progressAfter 的 KR
  decisionCardIds String[]  // 本周参与的 DC
  meetingIds      String[]  // 本周开过的议事室
  blockers        String?   // 从 CheckIn.blockers 聚合
  mood            Int?      // 从 1on1.moodScore 拉
  // 派生 prompt 缓存 (供 Persona 调用)
  systemPromptCache String   @db.Text
  generatedAt DateTime @default(now())
  expiresAt   DateTime  // 周日 23:59 自动失效
}
```

**用法**:

- D 选项辅助: "这周你在 KR-005 上推进, 上周决议 X 已经选过 SOP 方案, 这次是不是该试 D?"
- 议事室裁判: 自动加载所有参会人本周心智, 帮助 ALIGN 阶段更快
- 拒绝: Persona 永不主动推送, 仅在员工触发时使用

**关键铁律**:

- 完全派生, 员工不能编辑 (避免造假)
- 周末自动重置 (§11 心流神圣 — 不让 AI 在周末追员工)
- 上级**不可访问下属的 working memory** (§13 尊严)
- 24h 否决: 任何基于 working memory 的 AI 输出仍可否决

**风险点**:

- 数据膨胀: 每人每周 1 行 → 1 年 ≈ 50 行 / 人 → 可控
- LLM 长上下文成本: prompt cache 解决, 周内不变
- 员工觉得被监视: UI 透明展示 — "AI 看到的你本周" 可视化页面

---

### EVO-5 · 员工自助健康仪表盘 · V2 · 8 天

**来源**: Lattice Employee Health (2025-10) 检测 burnout / quiet quitting.

**冲突风险**: 直抄即违反:

- 宪章 §13.2 "不可监控员工的在线时长 / 输入速度 / 屏幕活动"
- 宪章 §13.2 "不可在公开场合披露员工的 9 宫格末位身份"
- 宪章 §11 "反对消息黏性 / 心流神圣"

**反向重构 (相容版)**:

不是 "老板看员工健康", 而是 **"员工自己看自己 (像 Apple Health)"**:

```
顶部: 我的本周心流时间               [█████░░░░░] 5h / 期望 4h ✅
      我的决议产出                  [3 张 DC]
      我的 KR 推进                  [+5pp on KR-005, +2pp on KR-007]
      心情 (来自 1on1 moodScore)    [😊 4/5]

底部 (柔性提示, 仅本人见):
- 你周末发了 12 条工作消息. 上周是 2 条. 一切还好吗?
- KR-005 已经 9 天没决议产出. 是不是被外部依赖卡住?
- 你这周决议否决率 0%. 检查一下是不是太顺了 (反思偏差).
```

**关键铁律**:

- **永不**主动推给上级 / HR / 9-box calibrator
- 员工**主动分享**才能让 1on1 主管看 (单向, 可撤回)
- HR 看到的**只是公司汇总匿名值** (像"全公司平均心流时间 4.5h, 你公司 3.2h, 警告")
- "卷度指数" 计算: 8h 后消息密度 + 周末 DC 提交占比 — 触发**只警示员工自己**
- **不**用 worktime / mouse activity / 输入速度 (§13.2 红线)

**落地**:

```
新增: app/me/health/page.tsx (个人健康自助页, 仅自己看)
扩展: lib/insights/personal-derive.ts (派生指标)
新增: components/me/burnout-soft-warn.tsx (柔性提示)
事件: 每周日 18:00 跑一次 derive
```

**为什么 V2 而非 V1.5**:

- 需要 1 年数据才能判定基线 (个人/团队/公司)
- 否则 AI 会拍脑袋说"你不正常", 员工反感

---

### EVO-6 · Steward Agent (治理官 AI Co-pilot) · V2 · 10 天

**来源**: 宪章 §14 已埋字段 ("治理官有专属 AI Co-pilot, 自动标注矛盾 / 过时 / 引用统计"); MIT Sloan 2026 共识 "HR for agents".

**现状**: §14 是 placeholder, 没实际产品功能. 现在到了实现的时候.

**Steward Agent 干什么**:

```
1. Memory 矛盾检测
   - 跨 SOP 文本扫"前后说法不一"
   - 红线 vs 客户实际案例的偏离
   - 提示治理官: "SOP-042 与 SOP-088 在'退款流程'矛盾, 建议合并"

2. Memory 漂移监控 (§8.2 降级支持)
   - 引用率连续 3 季度 < 公司均值 30% → 自动通知治理官
   - 但: AI 永不主动归档 (§7 红线)
   - 仅生成评估申请, 治理官人工决议

3. 升级签批协助 (§8.1 闸门)
   - 申请进 Lv1: AI 总结申请要点 + 列出相似已批 SOP + 风险点
   - 治理官看 30 秒就能决策 (vs 现在读 5 分钟原文)

4. Steward 漂移自检 (§14 防腐败)
   - 治理官自己批的申请, AI 监控是否倾向某部门
   - 季度报告给 CEO + 治理委员会 (透明)
```

**关键铁律**:

- Steward Agent 永不直接归档 / 升级 / 修订 (人才能)
- 永不替治理官签批 (§14 角色独立)
- AI 自身决策必须 24h 否决窗口 (§9.3)
- AI 输出永远配置信度 + 推演路径 (§15)

**落地**:

```
新增: app/steward/agent/page.tsx (治理官专用 AI 工作台)
新增: lib/agents/steward-agent.ts (规则引擎 + LLM 调度)
扩展: prisma schema MemoryEntry/PromotionRequest 加 ai_review JSON 字段
事件: nightly job 跑 4 类检测
角色: 仅 roles=['steward'] 的用户可访问
```

**度量**:

- ✅ Memory 升级签批平均时长 < 现状 50%
- ✅ Memory 矛盾发现数量 (人不容易看出来的)
- ❌ **不**度量"AI 自动批准率" — 不存在, AI 永不批

---

## 3. 战略观察 4 项 (不动手, 仅记录立场)

### O1 · 飞书 People 一体化 → Tandem 反向定位

飞书把 OKR / 招聘 / 绩效 / 人事打包卖. 这是中型客户最大压力来源 (买飞书一站省事).

**Tandem 立场**: 我们**不做 HR 全栈**.

- 引宪章 §17: 民企 sweet spot 限 7 类 (互联网/SaaS/消费/教育/创意/跨境电商/文化娱乐), 不做政企不做央企
- 引宪章 §18: 永不做 OA / 审批 / 考勤 / 印章 / 招聘 / CRM
- 商业逻辑: 客户**继续用**飞书 / 钉钉 / 企微做 HR 全栈, **加买**Tandem 接管"决议 + OKR 反虚报 + Persona 成长"
- 销售话术: **"飞书让全员一致做事. Tandem 让全员做出好决议."**

不要被飞书 People 战略动作牵着鼻子走, 不扩功能边界.

### O2 · 钉钉精选 6 大 AI 助理 → Tandem 不下场垂类工具

钉钉做工单 / Excel / 法务 / 财务 / 会议记录 / 文档纠错助理 — 单点效率工具.

**Tandem 立场**: 我们**不做 AI 助理类垂直工具**.

- 引宪章 §16: LLM 是燃料, TAF 是引擎. 我们做协议层, 不做 prompt 工厂
- 引宪章 §1: 工作单元是决议. 写邮件 / 改 Excel 不是决议
- 销售话术: **"钉钉助理帮你今天发邮件少 3 分钟. Tandem 帮你这季度多产出 5 个高质量决议."**

警示: 不要因为客户问"你们有没有 Excel 助理"就妥协. 答: "你们用钉钉那个就够好, 我们和它互补".

### O3 · Lattice Agent Library Marketplace → 警惕但暂不抄

Lattice 让客户定制 IT / Sales / Onboarding agent 上架库.

**Tandem 立场**: 看见但暂不下场.

- **不下场理由**: 治理成本极高 — 每个客户自定义 agent 都要符合宪章 18 条 (D 选项 / 24h 否决 / 红区禁用 / 推演展示) 才能上, 审查工作量 = 一个独立产品团队
- **远期可能**: V3 后期或 V4. 前提: TAF 协议层稳定 (现在还在 V1)
- **当前替代**: 让客户在自己 Tandem 实例里写 Persona, 不开放给跨客户 marketplace

不要为对标 Lattice 提前开 marketplace.

### O4 · agentic enterprise 2026 → 「人在环」是护城河

行业 2026 共识 (MIT Sloan / Adobe / Akka): agent 开始"自主执行端到端工作流". 多数厂商在卷"agent 能多自主".

**Tandem 立场**: 反向选边 — **「人在环 + 24h 否决 + D 选项必填」是我们最强护城河**.

- 引宪章 §15: 「下班早一小时」是表象, 「员工成长更快」才是承诺
- 引宪章 §9.3: 24h 否决窗口对所有 SKU 开放, 不基于商业等级 gate
- 别人放弃"人在环"换 demo 噱头时, 我们坚守 → 客户信任红利

**销售话术**:

- **"agent 自主率 95% 听起来很美, 但你下次裁员时第一个被裁的不是 AI."**
- **"Tandem 让你的员工每月学会一项新技能, 这才是真 ROI."**

---

## 4. 与宪章映射检查 (合规扫描)

| 宪章条款 | 6 项进化合规情况 |
| --- | --- |
| §1 决议为单元 | EVO-1 强化 (节奏护栏挂 KR), 其他无冲突 |
| §2 3+1 不替决策 | EVO-2 强约束遵守, EVO-6 Steward 不批不归档 |
| §3 17min 议事 | 无影响 |
| §4 KPI/TTI 双轨 | 无影响 |
| §5 KPI 100% / TTI 60-70% | 无影响 |
| §6 全公司透明 | EVO-5 个人健康仅本人见 — 是**例外明示**, 文档化即可 |
| §7 Material vs Memory | EVO-4 working memory 是**派生缓存**, 非新一层, 标注清楚 |
| §8 签批闸门 | EVO-6 Steward Agent 强化签批协助, 不替代签批人 |
| §9 分身显式标识 | EVO-2/4 都涉及 AI 输出 → 必须强制 watermark + 24h 否决 |
| §10 9 宫格 | EVO-3 HRIS Adapter 让 9-box 数据更准 |
| §11 反消息黏性 | EVO-1 反向用 Habits, EVO-5 个人健康度量 — 双双合规 |
| §12 末位绝对 | 无影响 |
| §13 数据归公司+尊严 | EVO-5 关键合规点 — **本人主动分享** + 公司只看匿名汇总 |
| §14 治理官独立 | EVO-6 实现现有 placeholder |
| §15 AI 助成长 | EVO-1/2/4/6 都强制保留**推演路径展示** + **退化检测** |
| §16 LLM 热插拔 | 无影响 (复用 TAF) |
| §17 民企 only | 无影响 (HRIS Adapter 限民企客户用的工具栈) |
| §18 OSS 借力 | EVO-3 HRIS 接 API, 不重写 |

**全部 6 项: ✅ 通过宪章合规扫描**.

---

## 5. 反例清单更新 (附加到宪章 §附录 C)

新增 6 行 (本月扫描产出):

| 功能 | 来自 | 我们为何不做 |
| --- | --- | --- |
| 每日打卡 / 习惯连续天数排行榜 | Lattice Habits 直抄版 | 制造焦虑, 退化为 KPI (违 §1 + §11.2) |
| 老板看下属 burnout 仪表盘 | Lattice Employee Health 直抄版 | 监控员工状态 (违 §13.2) |
| AI 一键改写 OKR | Tita 直抄版 | 替员工劳动 (违 §15), 培养橡皮图章 |
| 全栈 HR (招聘/培训/薪酬) | 飞书 People | 不属 sweet spot (违 §17/§18) |
| AI 写邮件/Excel 通用助理 | 钉钉精选助理 | 不是决议工作 (违 §1) |
| 跨客户 Agent Marketplace | Lattice Agent Library | 治理审查不可控 (违 §14 治理独立) |

---

## 6. 落地排期 (本月可启动)

| 月份 | 项目 | 工期 | 依赖 |
| --- | --- | --- | --- |
| 2026-05 (本月剩余) | EVO-2 OKR 智能纠偏 | 4 天 | A2 真后端已成 (依赖 ✅) |
| 2026-05 末 | EVO-1 决议节奏护栏 | 5 天 | 依赖 cadence pulse (已有) |
| 2026-06 | EVO-3 HRIS Adapter | 7 天 | 依赖 admin 后台 (已有 framework) |
| 2026-06 末 | EVO-4 Persona 工作记忆 | 6 天 | 依赖 Persona 表 (已有), prisma schema 加 1 表 |
| 2026-07 | EVO-6 Steward Agent | 10 天 | 依赖 §14 角色已 RBAC ready |
| 2026-Q3 后期 | EVO-5 员工自助健康 | 8 天 | 需 6 个月数据积累, V2 阶段 |

---

## 7. 自我学习方法论 (本次复盘)

本月扫描了 4 大象限:

- HR-Tech (Lattice / 15Five / Leapsome / Culture Amp / 飞书 People)
- OKR (Tita / Worktile / Notion)
- 通讯+协同+AI (钉钉 / 企微 / 飞书 / M365 Copilot)
- agentic enterprise 趋势 (MIT Sloan)

**抄什么 / 不抄什么决策路径**:

```
看见竞品功能 X
   │
   ├─ 触发 18 条宪章哪一条?
   │   └─ 触发 → 反向重构 (找相容版本)
   │       └─ 仍不相容 → 反例清单 (拒绝)
   │
   ├─ 不触发 →
   │   ├─ 在我们 sweet spot 内? → 进化建议
   │   └─ 不在 → 战略观察 (记录立场, 不动手)
   │
   └─ 风险评估 → 优先级 / 工期 / 度量
```

**下月扫描清单 (2026-06)**:

- Notion AI 2026 H1 update (关注 Workspace + Memory 趋势)
- Linear AI Agents (听说在做但没正式发)
- Anthropic Claude Computer Use (对 Persona 启发)
- Microsoft Copilot Studio (对 Steward Agent 启发)
- 国内: 阿里通义千问企业 / 腾讯混元企业版

---

## 8. 一句话宣言 (本月版)

> **「Lattice 用 Habits 教员工每天打卡. 我们用决议教员工每周思考整齐.**
> **飞书 People 给老板一张人才全景图. 我们给员工一份成长发现录.**
> **钉钉给老板 6 个 AI 助理. 我们给员工 1 个 AI 搭子.**
> **别人卷 agent 自主率. 我们卷员工成长率.」**

---

> **审议**:
> 创始人: ____________  日期: ____
> 产品负责人: ____________  日期: ____
> AI 负责人: ____________  日期: ____
>
> **下次复审**: 2026-06-11 (月度自学循环)
