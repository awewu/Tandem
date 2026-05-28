# Charter · 四大基础板块必须超越飞书 (Four Pillars Charter)

> **Owner 强制约束 (2026-05-27 19:52 PT)**: IM / 文档 / 日历 / 邮箱 这 4 个**同事每天用 100 次的基础协作板块**, 必须**超越**飞书钉钉, **不是接近, 不是追平**.
>
> 这是 Tandem 的产品级根基判断, 跟 `MANIFESTO.md` 同级. 不可频繁修改. 未来任何 PM / 工程师 / AI 协作者**先读本文档再做基础板块的功能决策**.

---

## 一、为什么这 4 个板块是 Pillar?

| 板块 | 同事每天使用频次 | 不超越的代价 |
|---|---|---|
| **IM** | 每天 100+ 条消息 | 同事会回飞书, Tandem 飞轮转不起来 |
| **文档** | 每周 20+ 次编辑/查阅 | 知识沉淀 → Memory 升级路径断裂 |
| **日历** | 每天 5-10 次查 | 跟 OKR/议事时间线断裂 |
| **邮箱** | 每天 30-50 封内外通信 | 跟外部世界的接口 + AI 整理收件箱的核心场景失守 |

**结论**: 这 4 件事**没做到超越飞书**, Tandem 就只是"有 AI 的协作工具", 不是 "AI 原生协作平台". 同事用一周就会回飞书.

---

## 二、"超越"的定义 (不可误读)

### ❌ 不是这个意思

- ❌ 跟飞书在 UI 工程量上对垒 (移动端原生 / 富文本 / 文件预览 / 多端推送 ...)
- ❌ 复刻飞书所有功能再做一遍 (那只能"接近", 永远是追赶)
- ❌ "我们的 IM 体验跟飞书差不多" (这是失败)

### ✅ 是这个意思

**用 Tandem 独家的 AI 一等公民基础设施 (Memory 4 层 / Persona Evolution / Baseline-Guard / 议事 / TTI) 把这 4 个板块做出飞书永远做不到的新维度**.

判定标准: **任何一位资深产品经理看到 Tandem 的 IM/文档/日历/邮箱后, 应该说**:

> "这个能力飞书在 18-24 个月内都做不到, 因为它需要重做底层架构."

而不是:

> "嗯, 跟飞书差不多, 还差一些细节."

---

## 三、IM 板块 · 8 条超越能力 (必做)

当前底子: `lib/im/service.ts` 890 行 + 14 API + `app/im/page.tsx` 1212 行.

| # | 超越能力 | 杠杆来源 | 飞书做不到的根因 | 工作量 |
|---|---|---|---|---|
| IM-1 | **Persona-aware 频道**: 每个频道有 AI 分身在场, 知道每个人风格, 自动调和冲突 / 总结争论 / 帮缺席代答 | `lib/persona/` | 飞书 AI 是单点 bot, 不是 first-class 参与者 | 2 周 |
| IM-2 | **消息→Memory 一键升级**: 任何消息升级为公司 SOP/案例, 走 promotion-flow 签批 | `lib/memory/promotion-flow.ts` | 飞书消息没有 4 层 ownership 概念 | 1 周 (UI) |
| IM-3 | **Spawn-Room 像 git branch**: 消息派生子频道讨论, 完事 merge 回主频道 + 保留决策痕迹 | `messages/[id]/spawn-room` API | 飞书 thread 不可 merge, 决策痕迹散失 | 1 周 |
| IM-4 | **Agent-Mode 全频道 AI 主持**: 用于头脑风暴/议事/培训, AI 自动控场 | `channels/[id]/agent-mode` API | 飞书没有"频道级 AI 主持人"概念 | 2 周 |
| IM-5 | **多 Persona 在场协作**: 一个频道 @ 多个分身一起讨论 | Persona × N + Convergence | 飞书 AI 不是个人化的, 无法多 Persona | 2-3 周 |
| IM-6 | **跨频道智能 digest**: 每天给你读"你关心的频道发生了什么"摘要 | UsageEvent + LLM | 飞书有"重要消息"但无 personalized digest | 1 周 |
| **IM-7** | **AI 回复透明化**: 每条 AI 回复点开看 — 召回了哪些 Memory + 用了哪个 model + cost + latency + tokens | `LlmUsageLog` (2026-05-27 已建) | 飞书 AI 是黑盒, 无 trace | 3 天 (今晚启动) |
| IM-8 | **消息自动判定敏感性**: Baseline-Guard 介入, 公司机密自动提示发件人 + 收件人受限 | `lib/memory/baseline-guard.ts` | 飞书 DLP 是规则, 不是组织记忆驱动 | 1 周 |

---

## 四、文档板块 · 7 条超越能力 (必做)

当前底子: `lib/services/document-service.ts` + `app/documents/[id]/page.tsx` + Yjs 实时协作已设.

| # | 超越能力 | 杠杆来源 | 飞书做不到的根因 | 工作量 |
|---|---|---|---|---|
| DOC-1 | **Persona 共编**: 你写时分身在旁边自动补事实 / 改错别字 / 查 Memory / 提示遗漏 (协同编辑级, 不是注释级) | `lib/persona/` + Memory retriever | 飞书云文档 AI 是注释级 | 2-3 周 |
| DOC-2 | **文档→Memory 智能升级**: 保存时 AI 提议 "这段值得升级为团队 SOP" + 签批入库 | `promotion-flow` | 飞书无 4 层 Memory 结构化 | 1 周 |
| DOC-3 | **版本即决策痕迹**: 重大修改自动产出 Decision Card 留住"为什么这么改" | `DecisionCard` | 飞书版本只有 diff, 无决策语义 | 1 周 |
| DOC-4 | **文档 ↔ 议事联动**: 议事室决策结果自动写入相关 PRD/SOP | Convergence + 文档 | 飞书议事 ↔ 文档完全断裂 | 1-2 周 |
| DOC-5 | **多 Persona 评审**: 一份文档请多个分身从专业角度 review (产品/技术/法务/财务) | Persona × N | 飞书 AI 评审不分专业领域 | 2 周 |
| DOC-6 | **AI 自动写更新提示**: 某 Memory 升级时, 引用该 Memory 的文档自动获得"建议更新"标记 | Memory 引用图 | 飞书文档无 Memory 引用关系 | 2 周 |
| DOC-7 | **跨文档知识图谱可视化**: 文档 ↔ Memory ↔ 其他文档的引用网络 | C 类 #21 | 飞书无结构化引用数据 | 2 周 |

---

## 五、日历板块 · 8 条超越能力 (必做)

当前底子: `lib/services/calendar-service.ts` + `app/okr/calendar/page.tsx` 11.4 KB.

| # | 超越能力 | 杠杆来源 | 飞书做不到的根因 | 工作量 |
|---|---|---|---|---|
| CAL-1 | **OKR 时间线一体化**: 日历直接看到 KR 截止 + 议事 + 1on1 + 复盘 | OKR + Convergence | 飞书日历 ↔ OKR 完全独立产品 | 1 周 |
| CAL-2 | **AI 智能议事时间建议**: 看相关人空闲 + 议题紧急度 + 历史节奏, 推荐最佳时间 | LLM + 议事数据 | 飞书智能日历无议事语义 | 2 周 |
| CAL-3 | **Persona 代约会议**: 分身代你接受/拒绝/改约 (24h 否决) | `proxy-actions` | 飞书 AI 不能代理动作 | 1 周 |
| CAL-4 | **会议自动准备**: 议事前 AI 召回 Memory + 拉之前 Decision Card + 准备 3+1 选项草稿 | retriever + decision-engine | 飞书会议无"准备"语义 | 1 周 |
| CAL-5 | **会议自动复盘**: 议事结束自动产出 Decision Card → retrospective → Memory 候选 | 已就绪 | 飞书会议结束就结束了 | 1 周 |
| CAL-6 | **空闲时间智能保护**: AI 学你工作节奏, 自动 hold 深度工作块 | UsageEvent 学习 | 飞书无个人节奏学习 | 2 周 |
| CAL-7 | **KR 偏差议事预警**: KR 偏差 ≥ 阈值, 系统自动插一场议事 | C 类 #19 | 飞书 OKR/日历两个孤岛 | 1-2 周 |
| CAL-8 | **跨企业日历协调** (远期): 你的分身跟客户/供应商的分身协调 | Persona 协议 | 远期, V3 阶段 | 1-2 人月 |

---

## 六、邮箱板块 · 7 条超越能力 (必做)

当前底子: ⚠️ **没有专门的邮箱模块**. notification + IM channels + intranet-post 覆盖了部分, 但外部邮件互通 (SMTP/IMAP) 未建.

| # | 超越能力 | 杠杆来源 | 飞书做不到的根因 | 工作量 |
|---|---|---|---|---|
| MAIL-1 | **统一智能收件箱**: 议事邀请 / 决策卡通知 / Memory 升级请求 / Persona 训练建议 / OKR 评分截止 / 1on1 提醒 / 邮件 — 一个箱子 | notification 已有 | 飞书各通知分散, 无统一抽屉 | 1-2 周 |
| MAIL-2 | **AI 收件箱整理**: 自动分类 + 摘要 + 待办提取 + 智能优先级 | LLM + 4 层可见性 | 飞书无 personalized 整理 | 1 周 |
| MAIL-3 | **Persona 智能回复草稿**: 分身预填回复 (含 Memory 上下文), 你审一下发出 / 24h 否决撤回 | `proxy-actions` | 飞书 AI 草稿是无上下文的 | 1-2 周 |
| MAIL-4 | **邮件→议事一键转**: 一封争议邮件直接转议事室 + 邀相关人 + 3+1 决策 | Convergence | 飞书邮件/议事断裂 | 3-5 天 |
| MAIL-5 | **邮件→Memory 升级** | promotion-flow | 飞书无 4 层 Memory | 3-5 天 |
| MAIL-6 | **SMTP/IMAP 外部邮箱互通**: 收公司邮箱 + Gmail/Outlook 都汇总 | 需新建 IMAP client | 飞书 Mail 是独立产品 | 2-3 周 |
| MAIL-7 | **跨企业邮件代签** (远期): 礼貌性邮件让分身代签 (24h 否决) | proxy-actions + 跨企业协议 | 远期, V3 | 1-2 人月 |

---

## 七、杠杆映射 (为什么 Tandem 有底子超越, 而飞书没有)

```
                    Tandem 独家基础设施
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   Memory 4 层           Persona 5 阶段         Baseline-Guard
   (含升降级 PR 流)       Evolution             (HARD_BLOCK)
        │                     │                     │
        ▼                     ▼                     ▼
   ┌────────────────────────────────────────────────────┐
   │           Convergence + Decision Card               │
   │              (议事 17min + 3+1 决策)                │
   └────────────────────────────────────────────────────┘
        │                     │                     │
   ┌────┴────┐           ┌────┴────┐          ┌─────┴────┐
   │   IM    │           │  文档    │          │   日历    │
   │ 8 超越点 │           │ 7 超越点 │          │ 8 超越点  │
   └─────────┘           └─────────┘          └──────────┘
        │
        ▼
   ┌─────────┐
   │  邮箱    │
   │ 7 超越点 │
   └─────────┘
```

**飞书做不到的根因 (一句话)**:

> 飞书的 IM/文档/日历/邮箱是 4 个独立产品, 各自带一个 AI bot. Tandem 的 4 个板块是**同一套 Memory + Persona + 议事基础设施**喂出来的, 数据天然联动, 飞书要做到这一步需要重做底层架构.

---

## 七.5 · 4 板块如何服务 OKR (2026-05-27 灵魂层补)

> 详见 `docs/OKR-DRIVEN-ARCHITECTURE.md`. 4 板块"超越飞书"不是为了表面功能强, 而是**让每个板块都成为 OKR 驱动器的肢体**.

| 板块 | 如何服务 OKR | 具体落地 |
|---|---|---|
| **IM** | 每条 @CompanyBrain 必含 OKR 上下文; 群聊讨论的 Decision 自动 anchor 到 KR | B-014 OKR Anchor 注入器 ✅; 群聊 → DecisionCard 必填 `primaryKrId` |
| **文档** | 文档跟 KR 关联 (一篇文档可标注 "服务于 KR-12"); 文档 AI 摘要带"对 KR 进展贡献" | V1.5: 文档元数据加 `relatedKrIds`; AI 摘要 prompt 注入 OKR 上下文 |
| **日历** | 会议必填关联 KR (跟议事室 ALIGN 步骤一致); 日历看板按 KR 分组事件 | V1.5: 创会必选 KR; 日视图侧栏显示"今日事件如何推 KR" |
| **邮箱** | 入站邮件 AI 抽取行动项 → ActionItem 必 anchor KR; 出站邮件可声明"为 KR-X 推进" | V2: 邮件 → ActionItem pipeline 接 OKR Anchor 守门 |

**铁律**: 4 板块都要回答"这次互动**服务/不服务**哪个 OKR" — 这是 Tandem 跟飞书 IM/文档/日历/邮箱的本质区别, **不是功能多, 是每次互动都有 OKR 锚**.

---

## 八、防变形条款 (危险信号清单)

如果出现以下情况, 说明 Tandem 正在退化为"飞书克隆", **立刻警报**:

| 危险信号 | 防变形动作 |
|---|---|
| ❌ PM 说 "我们 IM 要做得跟飞书一样" | 反问: "这条能力的杠杆来源是 Memory/Persona/议事 哪一个?" 没答案 → 砍 |
| ❌ 工程师追求 "把飞书 X 功能做出来" | 反问: "飞书做不到的版本是什么?" 没答案 → 砍 |
| ❌ 产品讨论里出现 "对标飞书 Y" 而无差异化版本 | 拉回 PRODUCT-NARRATIVE.md + 本 charter |
| ❌ UI 工程量超过 70% (移动端 / 富文本 / 文件预览 ...) 而反向杠杆推进 < 30% | 重新分配工程精力 |
| ❌ 同事反馈 "Tandem 不如飞书" 而无独家能力解释 | 不修复 UI 体验, 而是问 "Tandem 该让你做飞书做不到的什么事" |

---

## 九、跟其他 Charter 的关系

| 文档 | 关系 |
|---|---|
| `MANIFESTO.md` (18 条产品宪章) | 本 charter 是 MANIFESTO 的延伸, 把 4 大基础板块的"超越"约束实例化 |
| `PRODUCT-NARRATIVE.md` | 对外讲故事, 本 charter 是对内做事的根基 |
| `PRODUCT-DEFINITION.md` | 14 决策, 本 charter 跟其中"自建栈 + AI 一等公民"决策对齐 |
| `SUMMON-AND-NURTURE.md` | 拿捏/搭子双范式, 本 charter 里 IM-1 / DOC-1 / MAIL-3 都是"拿捏"分身在 4 板块的具体体现 |
| `SELF-USE-FIRST.md` | 自用阶段战略, 本 charter 第 1-2 月落地 IM-2/IM-7/DOC-1/CAL-1/MAIL-1 这 5 条最高 ROI 的超越点 |
| `CHARTER-KPI-TTI.md` | KPI/TTI 双轨, 本 charter 跟它平级, 4 板块属基础板块, KPI/TTI 属度量板块 |

---

## 十、实施节奏 (插入主路线图)

完整 18 个月路线图见 `PRODUCT-NARRATIVE.md § 五`. 本 charter 关注 4 板块超越能力的落地节奏:

```
🔴 第 1-2 月 · 自用启动 + 4 板块超越底层铺设
  IM-2 (Memory 升级 UI) · IM-7 (AI trace) · DOC-1 (Persona 共编 v0) · CAL-1 (OKR 时间线) · MAIL-1 (统一收件箱)
  ⭐ 今晚启动: IM-7 AI 回复透明化

🟡 第 3-4 月 · 体验深化 + 反向杠杆铺开
  IM-1/3/4/5 · DOC-2/3/4 · CAL-3/4/5 · MAIL-2/3/4

🟢 第 5-8 月 · 战略级能力 + UI 工程追平 30%
  IM-6/8 · DOC-5/6/7 · CAL-2/6/7 · MAIL-5/6

🔵 第 9-18 月 · 平台化 + 跨企业协议
  CAL-8 · MAIL-7 · 跨企业 Persona 协作
```

---

## 十一、修订记录

| 日期 | 修订者 | 修订内容 |
|---|---|---|
| 2026-05-27 19:52 PT | Owner | 明确 "4 板块必须超越" 强制约束, 区别于 A 类追平 |
| 2026-05-27 20:05 PT | Cascade | 新建本 charter, 30 条超越能力锁定 |

---

## 附录: 30 条能力 ID 速查

```
IM:    IM-1  IM-2  IM-3  IM-4  IM-5  IM-6  IM-7  IM-8       (8 条)
DOC:   DOC-1 DOC-2 DOC-3 DOC-4 DOC-5 DOC-6 DOC-7            (7 条)
CAL:   CAL-1 CAL-2 CAL-3 CAL-4 CAL-5 CAL-6 CAL-7 CAL-8      (8 条)
MAIL:  MAIL-1 MAIL-2 MAIL-3 MAIL-4 MAIL-5 MAIL-6 MAIL-7     (7 条)
                                                  ────────
                                                  30 条
```

未来在 backlog / commit / PR / 设计文档里, **直接用 ID 引用** (例如 "本 PR 实现 IM-7"), 避免长描述歧义.
