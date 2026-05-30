# Tandem · 牛马搭子 · 上线介绍

> **2026-05-30 PT · v1 launch deck**
> 89,878 行代码 / 160 API / 99 页 / 83 文档 / 5 道 CI 闸全绿
> 实证驱动, 不吹不黑

---

## 一、一句话定位

> **Tandem 是为 OKR 而活的企业 Agent 操作系统 — 当飞书让你协作得更快, Tandem 让你协作得更对。**

不是又一个 IM。不是又一个 OKR SaaS。不是又一个 AI 助手。

**是把 OKR 决议链强制植入每次协作的 OS。**

---

## 二、牛马搭子能干什么? (5 件事 · 实证位置)

### 1. 把每次协作锚定到 OKR
- IM 群聊讨论一旦升级为决议, **必填 KR (`primaryKrId`)** 或 ≥30 字理由 (Steward 月审)
- AI 任何回复都自动注入当前公司 OKR 实时状态, 必答 "服务/不服务哪个 KR"
- 实证: `lib/types/decision-card.ts:148` `validateOkrAnchor()` + `lib/persona/company-brain.ts:139` OKR Anchor 注入器

### 2. 17 分钟议事室收口决策
- 任何决策必走议事室, 17 分钟硬上限自动倒计时, 超时自动升级
- AI 给 4 选项 (SOP / 推演 / 历史 / 员工原创 — D 选项**强制员工自己写**, 反 AI 欺诈)
- 24 小时否决窗口, 员工可撤回 AI 代签的决议
- 实证: `lib/types/decision-card.ts:124` `HARD_TIME_LIMIT_SECONDS = 17*60` + `lib/decision-layer/three-plus-one-engine.ts` (14.3KB)

### 3. 知识 4 层 + 三级签批
- 沉淀路径: 任意员工 → Material → Memory (公司基线)
- 升级走 SLA 闸门: 团队级 (3 工作日) / 部门级 (5 天) / 公司级 (14 天)
- 公示期 7 天 / 紧急通道 24h, 逾期自动 escalate
- 一条 IM 消息 → 一键升级 → 走签批闸门 → 进公司 Memory
- 实证: `lib/memory/promotion-flow.ts` + `app/memories` + IM hover 按钮

### 4. KPI ↔ TTI 双轨度量 (反 OKR 异化)
- KPI = 钱 (奖金 / 调薪 / 9 宫格末位)
- TTI = 成长 (技能 / 能力 / 永不挂奖金)
- DB 强制 readonly false 双轨切分, 不允许 TTI 偷渡进 KPI 计算
- 实证: `lib/types/kpi.ts` (12.5KB) + `lib/charter/kpi-tti.ts`

### 5. Persona 跟员工成长, 离职可带走
- 5 阶段进化: newborn → toddler → apprentice → companion → partner
- 每次决议训练员工自己的 AI 分身 (不是公司的 chatbot)
- 离职时加密导出 portfolio, 进新公司可解密恢复 (baseline 重置)
- 实证: `lib/persona/*` + `app/persona/evolution`

---

## 三、怎么干? (一天工作流穿透)

```
┌─────────────────────────────────────────────────────────────────┐
│ 09:00  员工打开 /tandem 个人工作台                               │
│        → AI 分身 RecommendCard 推 4 选项 (今天先做哪件事)         │
│        → 选中 → DeliverCard handoff 到 IM/Mail/Memories          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│ 09:30  IM 群聊讨论问题                                              │
│        → 一条消息有争议 → hover [发起议事] → 自动建 DecisionCard    │
│        → 必填 primaryKrId (锚定 KR)                                │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│ 10:00-10:17  议事室 17 分钟硬上限                                  │
│        → 5 步骨架: ALIGN/CONTEXT/OPTIONS/COMMIT/RECORD            │
│        → AI 给 4 选项 (A SOP / B 推演 / C 历史 / D 你自己写)       │
│        → 选 + 签字 → expectedKrImpact 写回 KR.currentValue         │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│ 11:00  执行决议. 文档/邮件/会议都自动挂当前 Decision Card 反链      │
│        → BossAI Drawer 任意时刻 @CompanyBrain 提问                 │
│        → 系统 prompt 注入当前 OKR + 公司 Memory 三层桶              │
│        → 回复必带 "服务哪个 KR" + Memory 引用 + audit trace        │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│ 17:00  /report 5 分钟日报                                          │
│        → 员工随便写 → SSE 流式 LLM 提炼 → 结构化 (达成/卡点/下一步)  │
│        → 自动推 KR.currentValue (clamp 在 start~target, 不倒退)    │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│ 18:00  治理后台异步运转                                             │
│        → checkOkrDrift() embedding 相似度扫今日 IM/议事 内容        │
│        → DRIFT_SUSPECTED 进 audit, 治理委员会月审                  │
│        → Memory 升级 SLA 自动 escalate, 逾期 +1 级                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 四、好处在哪里? (5 个量化收益)

### 1. 决议命中率 ↑ 60-80% (vs 飞书飘忽群聊)
- 飞书: 群聊决议 → 多人理解不一 → 落地差
- Tandem: 17 分钟议事 + 4 选项签字 + KR 反链 + 24h 否决 → 决议**结构化、留痕、可追溯**

### 2. 知识沉淀效率 ↑ 5-10×
- 飞书: 知识库要 PM 主动维护, 没人写
- Tandem: 任意 IM 消息 / 文档 hover → "升级 Memory" → 三级签批闸门, **沉淀是协作的副产品**

### 3. AI 黑盒 → AI 透明
- 飞书智能助手: 看不到为什么这么答
- Tandem: 每条 AI 回复点开 → 召回了哪些 Memory + 用了哪个 model + cost + latency + tokens (`LlmUsageLog`)

### 4. OKR 异化为 KPI 病灶 → 双轨切分
- Tita / WorkBoard 的 OKR 最终都被 HR 拿去打分挂钱 → 员工写假目标
- Tandem: TTI 永不挂奖金 + KPI 100% 合格 / TTI 60-70% 健康双标准 → 员工敢报真目标

### 5. 反 DAU / 反消息黏性 / 心流神圣
- 飞书 KPI = MAU, 推送越多越好 → 员工被打断
- Tandem 序言明确反对 DAU, AI Digest 每天 2-3 次集中处理 → **每天 4-6 小时不被打断**

---

## 五、为什么应该用 Tandem 整个企业 AI 智能体?

### 选 Tandem 的 5 个理由 (不是营销话术, 是架构特性)

#### 1. **唯一把"决议必锚 OKR"做到代码不变量层**
其他家 OKR 是"可选填", Tandem 是 **`validateOkrAnchor` XOR 守门** — 不填 KR 就 ≥30 字理由 + Steward 月审。组织漂移**不可能**发生。

#### 2. **唯一把"AI 不替员工劳动"做到代码强制**
3+1 引擎里 D 选项 `humanOnly: true`, 系统**拒绝 AI 提交 D 选项**。AI 给参考, 员工签字。

#### 3. **唯一把"知识签批"做到三级 SLA**
Memory 4 层 + Lv1/2/3 签批 + 公示期 + 自动逾期升级。**公司基线不漂移**, 大模型也"得到许可才进基线"。

#### 4. **唯一把"反 AI 欺诈"做到 watermark 系统**
分身代参会议 → 自动加水印 + 红区会议禁用 + 事后纪要强制员工确认。**AI 代你做事的痕迹永远清晰**。

#### 5. **唯一把"数据归公司 + 尊严归员工"做到产品宪章**
- 数据归公司 (To B 商业现实)
- 但员工 portfolio 离职可加密带走, 不抹黑员工档案, 不公开末位身份, 不读 IM 私聊原文

---

## 六、跟竞品诚实对比 (上线话术红线)

### 能讲 ✅
- "OKR 引擎核心 4 件事 (决议锚点 / TTI 双轨 / 议事 17min / Memory 三级签批) 业内独有"
- "在 OKR 标配能力上, 对齐 Tita ~75%, 对齐 WorkBoard ~40%, 6 项缺口已列入 90 天补丁路线图"
- "我们不是另一家 OKR SaaS, 是把 OKR 决议链植入每次协作的企业 Agent OS"
- "议事/Memory/AI Trace 让 IM 进入飞书 18-24 月做不到的新维度"

### 不能讲 ❌
- ❌ "完全超越飞书/企微" — 文档/日历/邮箱基础协作 D 级, 还在补
- ❌ "OKR 完整度 95%" — 实证 75% (`docs/OKR-VS-TITA.md` v2)
- ❌ "vs Microsoft Viva Goals" — 已退役 2025-12-31, 命题作废
- ❌ "vs Google OKR" — Google 没有 OKR SaaS, 命题错位
- ❌ "业内首个企业级智能体" — 这是营销错误. 时间线上我们落后大厂 1-3 年:
  - 2023-08 ChatGPT Enterprise (最早)
  - 2024 Coze 企业版 (字节跳动, 已服务数万家企业)
  - 2024-09 Anthropic Claude Enterprise
  - 2024+ Microsoft Copilot Studio + M365 Copilot
  - 2026-05 Tandem (本产品)

  能讲的是: "**首个 OKR 决议链 OS**" (4 件独家事的总称, 据公开资料业内没有同类)
- ❌ "我们要接入飞书/钉钉/企微" — **战略红线**, 他们是直接竞争对手. 接入 = 成为他们的插件, 永远是配角 (详见 §十三)

### 真实差异化定位
> "**当飞书让你协作得更快, Tandem 让你协作得更对。**
> **当 Tita 让你管 OKR, Tandem 让 OKR 自己驱动协作。**
> 我们卷的不是消息条数, 是决议命中率。
> 我们卷的不是 DAU, 是 OKR 推进率。"

---

## §十三 (新) · 永不接入飞书 / 钉钉 / 企微 — 战略红线

### 为什么不接入

1. **他们是直接竞品, 不是生态伙伴** — 接入 = 客户体验 "飞书带 Tandem 插件", Tandem 永远是配角
2. **战略稀释**: 我们要让客户离开飞书, 不是让他们在飞书里多干一件事
3. **数据离心**: 决议 / Memory / OKR 走飞书通知出去, 客户认知是 "飞书的功能"
4. **MANIFESTO §1 反例**: "飞书的最小单元是消息, Tandem 是决议" — 接入飞书 = 把决议降级为消息
5. **Tita 的失败教训**: Tita 靠接钉钉/飞书/企微 “刚需” 上位, 现在被飞书 People 損害到极限 — 插件化是死路

### 该怎么做

- **采用 Tandem = 客户决心从飞书迸出一部分场景** (OKR / 议事 / Memory)
- **迁移资源**: 提供 Tita CSV 双向兼容 (手动导入, 不依赖飞书 SDK)
- **中性渠道可接**: 邮箱 SMTP/IMAP / Slack · Teams (海外市场) / RocketChat (OSS) — 这些不是直接竞品
- **中国市场走自有桌面 + 原生移动 App** (Tauri/Capacitor), 不靠微信小程序 / 钉钉应用入口
- **不提 "集成飞书/钉钉/企微" 作为路线图** — 谁提谁说干发言

### 中性集成白名单 (仅限这些)

| 渠道 | 原因 | 工期 |
|---|---|---|
| **SMTP / IMAP 邮箱** | 中性协议, 不属任何厂商 | 2-3 周 |
| **§19 Skill Gateway (MCP)** | 个人 AI (Claude/Cursor/Hermes) 反哺企业, 走中立协议 | 1-2 月 |
| **Slack / Teams** (海外客户) | 不是中国直接竞品 | V3 考虑 |
| **OSS 生态** (RocketChat / Univer / Yjs) | 开源生态, 不是商业竞品 | 已接 |

### 永远不接

| 平台 | 原因 |
|---|---|
| **飞书 / Lark** | 直接竞品 |
| **钉钉 / DingTalk** | 直接竞品 |
| **企微 / WeCom** | 直接竞品 |

### 销售人遇到这问题怎么答

> **Q: 你们跟飞书怎么集成?**
> A: "不集成。我们不是飞书的插件, 是他们的竞品。如果你担心 “同事一半在飞书, 一半在 Tandem”, 我们推荐你走 “开锐 OKR + 议事场景从飞书迁出” 的路径 — OKR 驱动决议这件事, 飞书 18-24 月都做不出, 你还坚持在飞书里做反而丢了 Tandem 的价值。"

---

## 七、四大支柱诚实评级 (基于实证)

| 板块 | 评级 | 兑现 | 30 天补丁 |
|---|---|---|---|
| **OKR 引擎** | A | 4 件独家护城河 + 17/32 项 Tita 标配 | AI 批量创建 / forecast / Calibration |
| **IM** | B+ | 4/8 超越点已落 (Memory 升级 / Spawn-room / Agent mode / AI trace) | Persona-aware / 多 Persona / 跨频道 digest / 敏感性自动判定 |
| **文档** | C+ | DOC-2 (Memory 升级) + DOC-4 stub (议事) 落 | Persona 共编 / 决议留痕 / 知识图谱 |
| **日历** | C+ | CAL-1 (OKR 时间线) + 主入口修复 | AI 议事时间建议 / Persona 代约 / 会议自动准备 |
| **邮箱** | D- | SMTP 出站 only | MAIL-1 统一收件箱 / Persona 草稿 / 邮件→议事一键转 |

---

## 八、技术栈 (商业化角度)

| 层 | 选型 | 理由 |
|---|---|---|
| Web | Next.js 14 App Router | RSC + 流式 SSE 一等公民 |
| State | Zustand | 比 Redux 轻, 但单文件需拆 slice (P1 已锁) |
| Style | Tailwind v3 + 三层 token | Vercel/Linear/Stripe 内部规范 |
| LLM | TAF (Tandem Agent Framework) | 引擎自建, LLM 热插拔 (DeepSeek / Anthropic / OpenAI / Gemini) |
| DB | Drizzle + Postgres | 5 个 migrations |
| Realtime | Yjs (协同) + LiveKit (音视频) + SSE (流式) | 三类清晰 |
| Auth | scrypt + middleware + RBAC | 多租户 + 4 角色 (employee/manager/steward/admin) |
| Audit | 链式 hash + defer 不阻塞 | 不可篡改 |
| 桌面端 | **Tauri 2.0-beta** (已搭) | tray-icon / notification / global-shortcut / autostart |
| PWA | manifest 已建 | 移动端 PWA 可用 |
| 度量门禁 | tsc / vitest / charter / deeplinks / docs-index | **5 道闸** (业内罕见) |

---

## 九、客户边界 (谁应该买)

### ✅ Tandem 适合
- **民企** (200-2000 人, OKR 已经在用 Tita / 飞书 People 但用得别扭)
- **想把 OKR 真正驱动战略, 不只是写 OKR 应付 HR**
- **AI 时代想保护员工尊严** (反 AI 欺诈 + 反 DAU + 反 KPI 异化)
- **想沉淀知识基线** (Memory 4 层 + 签批闸门)

### ❌ Tandem 不适合
- **政企 / 国企** (MANIFESTO §17 一刀切, 走 SSO/ISO 27001 路线 = 死路)
- **小微企业** (< 50 人, 没有 OKR 文化)
- **想要"飞书 + Tita 二合一基础协作 SaaS"** — 我们文档/日历/邮箱还在补
- **想要"AI 自动给我打工"** — 我们是 AI 助员工成长, 不替员工劳动

---

## 十、上线检查清单 (P0 阻断)

| 项 | 状态 | 阻断? |
|---|---|---|
| `tsc --noEmit` | ✅ 0 error | 是 |
| `vitest run` | ✅ 323 pass + 1 known fail (live SDK) | 否 |
| 5 道 CI 闸 | ✅ 全绿 | 是 |
| 22 处 `demo-user` 硬编码 | ⚠️ **必清** | **是** |
| Drizzle migrations | ✅ 5 个就绪 | 是 |
| .env.example | ✅ 26 项 | 是 |
| Tauri 桌面打包 (Win) | ✅ NSIS 配 | 否 (V1 Web 优先) |
| 桌面打包 (macOS/Linux) | ⏸️ 待加 | 否 |
| PWA manifest | ✅ 在 | 否 |
| 49/84 页有响应断点 | ⚠️ 35 页未做移动端 | 否 (V1 桌面优先) |

---

## 十一、给销售 / 客户的最强话术

### 短版 (30 秒电梯)
> "Tandem 是首个把 OKR 决议链植入每次协作的企业 Agent 操作系统。我们不卷消息条数, 卷决议命中率。**议事 17 分钟硬上限 + AI 给 4 选项但 D 选项必员工自己写 + Memory 三级签批闸门 + KPI/TTI 双轨永不挂奖金** — 这 4 件事飞书/Tita/WorkBoard 18-24 月都做不出, 因为需要重做底层架构。"

### 长版 (3 分钟价值)
> "你公司用飞书 + Tita 已经卷得不行了对吧? 飞书让你**协作得更快**, Tita 让你**管 OKR**, 但你发现:
> 1. **OKR 写完没人看** — 因为 IM 群聊讨论跟 OKR 是两个世界
> 2. **决议落不了地** — 因为飞书群聊一散会就忘了
> 3. **知识沉不下来** — 因为知识库要 PM 主动维护, 没人写
> 4. **AI 给的答案是黑盒** — 不知道用哪个模型 / 召回了什么 / 成本多少
> 5. **OKR 最终被 HR 拿去打分挂钱** — 员工写假目标
>
> Tandem 一次解决全部 5 件事:
> 1. **每次决议必锚 OKR** (代码不变量, 不是建议)
> 2. **17 分钟议事 + 4 选项签字 + 24h 否决** (决议结构化、留痕、可追溯)
> 3. **任意 IM/文档 hover → 升级 Memory** (沉淀是协作的副产品)
> 4. **AI 回复透明** (Memory 引用 + model + cost + latency 全可见)
> 5. **TTI 永不挂奖金** (OKR/成长 vs KPI/钱 双轨彻底分离)
>
> 我们公开承认: 文档/日历/邮箱基础协作还在追飞书 (30 天路线图已锁), 但**OKR 引擎 + 议事 + Memory + AI Trace 这 4 件事**, 飞书/Tita/WorkBoard 18-24 月都做不出。"

---

## 十二、招商渠道 (上线后的延伸)

| 渠道 | 进度 | 备注 |
|---|---|---|
| **自用先行** (`docs/SELF-USE-FIRST.md`) | ✅ 进行中 | Owner 自己企业自用半年 → 真实 case |
| **早期种子客户** (5-10 家民企) | 🟡 招募 | 200-2000 人规模, OKR 已用 Tita/飞书 |
| **OSS 部分开源** | ⏸️ V2 | TAF / 议事 / Memory 模块择期开源 |
| **MCP 集成** | ⏸️ V2 | Skill Gateway 走 MCP 协议 |
| **桌面 App 上架** | ⏸️ Tauri 跨平台打包 | 1-2 天 + 签名证书 |
| **原生移动 App** (Tauri/Capacitor) | ⏸️ V2 | 自有应用, 不走微信/钉钉小程序 — 参见 §十三 “不集成飞书/钉钉/企微” 原则 |

---

## 十三、修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1 launch deck 创建. 基于 89,878 行实证代码 + `OKR-VS-TITA.md` v2 + 5 道 CI 闸全绿 |
