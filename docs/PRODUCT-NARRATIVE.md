# Tandem · 产品叙事 (重校准 2026-05-27)

> 这是对外讲故事的金字塔顶. 给 Owner / 同事 / 投资人 / 招聘候选人 / 早期用户用.
>
> 之前 `REFLECTION-2026-05 v1.0` 误说"OSS 借力, 通用模块不自建" — 经 Owner 2026-05-27 19:23 澄清产品意图 + 重新核对代码事实, **真实定位是全栈自建 AI 原生协作平台**.

---

## 一、一句话定义

**Tandem 是 AI 原生的全栈企业协作平台. 全面替代飞书 / 钉钉 / Tita, 同时给每个员工配一个 AI 分身, 用 OKR 驱动战略执行 + 4 层企业记忆 + 议事 17min + 组织记忆基线管控做飞书钉钉做不了的事.**

---

## 二、三段定位 (从短到长)

### 一句话 (10 秒讲清楚)

> "AI 原生的飞书替代品. 每个员工一个 AI 分身, 战略 → OKR → 议事 → 记忆全自动联动."

### 一段话 (30 秒讲清楚)

> Tandem 是企业内部协作平台. 飞书钉钉做的事 (IM / 日历 / 文档 / 云盘 / OKR / KPI) 我们全做, **但每个模块都跟 AI 分身深度耦合**: 议事自动产生 Memory, OKR 进度自动喂 Persona 训练, IM 消息可直接升级为公司知识, 公司战略层 Memory 又自动注入每个员工分身的决策上下文 (Baseline-Guard 强制约束, 分身越权直接阻断). 飞书是工具, Tandem 是一支由你的同事 + 他们 AI 分身组成的协作体.

### 三段话 (3 分钟讲清楚)

**问题**: 主流协作工具 (飞书/钉钉/Tita) 解决"沟通+任务管理", 但**不解决"知识沉淀 + 战略执行 + 决策质量"**. AI 工具 (ChatGPT/Notion AI) 是个人助手, **不跟企业真实工作流耦合**, 喂的还是公开数据.

**洞察**: 企业的真正资产是 **"工作记忆 + 决策传统 + 人才画像"**. 这些资产散在飞书消息 / 邮件 / 会议纪要 / OKR 进度里, 没被结构化, 没被流转, 没被分发到每个员工的 AI 工具.

**Tandem 的做法**: 把整个企业协作栈**自建一遍 + 跟 AI 一等公民耦合**:

- **议事 17min** 五步流程 + 3+1 决策框架 (A=SOP / B=AI推演 / C=历史案例 / D=员工原创) → 自动产生 Decision Card
- **OKR 双轨度量** 标的 + TTI (思考时间含金量) + 9-Box + 战略对齐树 → 战略到个人的完整执行链
- **Persona 5 阶段进化** newborn → apprentice → assistant → deputy → partner. 你的 AI 分身用真实工作数据训练, 越用越懂你
- **4 层企业记忆** Origin → Material → Memory → Baseline. 升降级 PR 流, 个人/团队/部门/公司四层共享, 业内独家
- **Baseline-Guard** 每次 AI 调用前强制校验公司级红线. 分身越权 → 阻断 + 通知治理委员会. 业内独家

**结果**: 同事不再是单兵作战 + 个人 ChatGPT 凑合, 而是 **"同事 + 他的 AI 分身 + 公司集体记忆"** 三件套.

---

## 三、跟竞品的本质区别 (一张表说清楚)

|  | 飞书 / 钉钉 | Notion AI | ChatGPT Team | Tita / Worktile | **Tandem** |
|---|---|---|---|---|---|
| **IM / 日历 / 文档 / 云盘** | ⭐⭐⭐⭐⭐ 旗舰级 | ⭐⭐⭐ 文档强 | ❌ | ⭐ | ⭐⭐⭐ 自建框架就绪, 待补深度 |
| **OKR / KPI** | ⭐⭐⭐ | ⭐ | ❌ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ + **TTI 双轨独家** |
| **议事决策** | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ **独家 (17min/5步/3+1)** |
| **个性化 AI 分身** | ❌ | ❌ | ⭐ Memory | ❌ | ⭐⭐⭐⭐⭐ **5 阶段 Persona Evolution** |
| **企业知识 4 层流转** | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ **独家** |
| **组织记忆基线管控** | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ **Baseline-Guard 独家** |
| **AI 跟业务模块深度耦合** | ❌ 只有助手 bot | ❌ 只问文档 | ❌ 隔离 | ❌ | ⭐⭐⭐⭐⭐ **IM→Memory→Persona 飞轮** |

### 一句话本质区别

- **飞书 = 协作工具**, 把人连起来
- **Notion AI = 个人知识助手**, 把文档问起来
- **ChatGPT = 通用 AI**, 把全网信息问起来
- **Tandem = 企业 AI 协作体**, 把 **人 + 知识 + AI 分身 + 决策传统** 编织在一起

---

## 四、不要这样讲 (容易翻车的话术)

| ❌ 别讲 | ✅ 改成 |
|---|---|
| "Tandem 是 AI-Native 协作平台 + 数据可从飞书迁移过来" (太弱) | "Tandem 全面替代飞书 + 每个员工配 AI 分身" |
| "在 OKR/议事场景替代飞书, 通用模块借 OSS" (v1.0 误读) | "全栈业务自建, Cal.com/MinIO 是可选 BYO 集成" |
| "Tandem 比 ChatGPT 厉害" (没法比, 不同物种) | "ChatGPT 是个人通用 AI, Tandem 是企业 AI 协作体 — 你公司的人 + 知识 + 战略" |
| "我们 6 个月做出飞书功能" (会被技术人看穿) | "业务模块框架已全建好, 体验深度需要 6-12 个月持续打磨, 但加上 Memory/Persona/议事 这些飞书做不了的事, 整体能力已超越" |
| "AI + 协作 = Tandem" (太空泛) | "企业真实工作流喂养出来的、有边界的 AI 同事矩阵" |

---

## 五、自用阶段的讲法 (现在用)

Owner 当前给同事讲:

> "我开发了一个内部用的工具, 把公司的 OKR / 议事 / 1on1 / 知识管理统一在一个平台. 每个人都会有一个自己的 AI 分身, 它知道公司的战略, 知道你的工作风格, 越用越懂你. 试用 3 个月后我们一起看效果."

不讲 "AI Native / 全栈替代飞书 / SaaS" 这些词. 自用阶段同事不 care 这些, 他们 care:

- **能不能让我每天工作更快**
- **AI 分身真能帮我做事还是又一个 ChatGPT 套壳**
- **我隐私安全吗** (Memory 4 层 / Baseline-Guard 这些可以拿出来讲, 但用人话: "公司机密不会被你的 AI 误传出去, 公司战略红线 AI 不敢碰")

---

## 六、什么时候启动"全面替代飞书"对外叙事

参考 `docs/SELF-USE-FIRST.md` 4 条成功标准:

```
✅ 公司 70%+ 同事每周打开 ≥ 3 次, 持续 3 个月
✅ 80%+ OKR/议事/1on1 在 Tandem 完成
✅ 50%+ 同事主动训练 Persona
✅ 至少 3 个具体的"省时间"故事
```

4 条全达成后, 才可以对外说:

> "我们公司自己用 Tandem 替代了飞书. 你也可以."

之前对外讲 "全面替代" 容易翻车 (没真实用户数据, 没成功故事).

---

## 七、跟"OSS 借力"v1 误读的对账

v1.0 REFLECTION-2026-05.md 错误判断:

```
错: "Tandem 在差异化场景 (OKR/议事/Memory/Persona) 自建,
     通用模块 (IM/日历/文档/云盘) 借 OSS (Cal.com/Etherpad/MinIO)."
```

代码事实纠正:

```
对: "Tandem 全栈业务模块都自建 (含 IM/日历/文档/云盘/通知).
     OSS 是可选 BYO 集成 (适合已经在用 Cal.com 等的客户对接).
     差异化创新 (Memory 4 层 / Persona Evolution / Baseline-Guard / 议事 17min / TTI)
     建立在自建栈之上, 跟业务模块深度耦合."
```

为什么之前误读: 我看了 `docs/OSS-STACK.md` 这份"可选 BYO 集成清单"误以为是核心架构. 实际上自建路径的 `lib/repositories/` + `lib/services/` 才是真理之源, OSS-STACK 只是说"如果你不想用我们的, 这些 OSS 是可选替代".

---

## 八、给文案 / 销售 / 招聘的语言库

### 一行话 (邮件签名 / Twitter bio)

> "Tandem · AI 原生企业协作平台. 全栈自建 + 每人 AI 分身 + 4 层企业记忆."

### 两行话 (LinkedIn 公司简介)

> "Tandem is an AI-native enterprise collaboration platform. We replace Lark / DingTalk / Tita with a full-stack rebuild, then add personal AI personas, 4-layer enterprise memory, and 17-min decision rooms — things Lark can't do."

### 一段话 (融资 BP / Pitch Deck 开篇)

> "We're building Tandem — the AI-native replacement for Lark/DingTalk for the era where every employee has their own AI persona. Existing collaboration tools (Lark, DingTalk, Notion) solve communication and task management but not knowledge accumulation, strategy execution, and decision quality. AI tools (ChatGPT, Notion AI) are personal assistants disconnected from enterprise workflows. Tandem rebuilds the entire collaboration stack with AI as first-class citizen: every employee gets a Persona that evolves through 5 stages from real work data; every meeting becomes structured Memory with 4-layer ownership flow (personal → team → dept → company); every AI invocation passes through Baseline-Guard to enforce organizational alignment. We're testing internally first (path: ByteDance → Lark 2016-2020), targeting product-market fit before going public."

---

## 九、修正记录

| 日期 | 修正者 | 修正内容 |
|---|---|---|
| 2026-05-27 19:23 | Owner | 澄清"全面替代飞书钉钉"是真意, 非 OSS 借力 |
| 2026-05-27 19:30 | Cascade | 代码事实核对: IM/日历/文档/云盘/OKR 都是自建 |
| 2026-05-27 19:35 | Cascade | 新建本文档作为唯一权威叙事源 |

---

## 十、相关文档

- `docs/MANIFESTO.md` — 18 条产品宪章 (不变的根基)
- `docs/PRODUCT-DEFINITION.md` — 详细功能定义
- `docs/PRODUCT-SPIRIT.md` — 创造价值 / 赢得尊重 / 快乐工作 三段精神
- `docs/SELF-USE-FIRST.md` — 自用阶段战略锚点
- `docs/REFLECTION-2026-05.md` § 二 — 已修正的全栈自建论述
