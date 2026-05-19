# Tandem (牛马搭子) · 产品完整架构与宪章

> **版本**: v1.0 综合版 (2026-05-12)
> **性质**: 产品宪章 + 全栈架构 + 数据模型 + 技术实现的唯一真源文档
> **覆盖**: `MANIFESTO` + `PRODUCT-DEFINITION` + `PRD` + `TAF` + 代码实现
> **阅读顺序**: 宪章 → 产品架构 → 技术架构 → 数据模型 → 路线图

---

## 目录

1. [产品定义](#1-产品定义)
2. [宪章 · 18 条不动条款](#2-宪章--18-条不动条款)
3. [双模块产品架构](#3-双模块产品架构)
4. [技术架构](#4-技术架构)
5. [数据模型](#5-数据模型)
6. [信息架构](#6-信息架构)
7. [知识架构](#7-知识架构)
8. [安全与隐私架构](#8-安全与隐私架构)
9. [演进路线图](#9-演进路线图)
10. [附录](#10-附录)

---

## 1. 产品定义

### 1.1 一句话

> **Tandem (牛马搭子)**: 一个有 AI 副驾的**企业决议操作系统 + 员工成长伴侣**.
> 双模块: **事半 (企业级 OKR-决议-知识闭环)** × **拿捏 (员工级个人 AI 持续成长)**.

### 1.2 与三巨头的本质差别

| 维度 | 飞书/钉钉/企微 | Tandem |
|---|---|---|
| 工作单元 | 消息 | 决议卡 (Decision Card) |
| 成功度量 | 活跃度 (DAU/MAU) | 决议执行率 |
| AI 形态 | 消息生成器 | 决策结构化器 |
| 员工视角 | 被监督的对象 | 被赋能的主体 |
| 进入路径 | 公司买单 (SLG) | 员工自下而上 (PLG) |
| 数据归属 | 全部归公司 | 数据归公司 + 员工尊严铁律 |
| 时间观 | 鼓励实时在线 | 鼓励异步心流 |
| 知识管理 | 单层 Wiki (死) | 四层架构 (活) |
| 绩效管理 | OKR 直接挂薪资 | KPI/TTI 双轨分离 |
| 文化基座 | DAU/MAU | 四个满意 |

### 1.3 北极星指标 (6 维)

| 维度 | 目标 |
|---|---|
| 决议平均成交时长 | ≤ 17 min |
| 决议否决率 | ≤ 15% |
| D 选项使用率 | ≥ 20% |
| KR 绑定率 | ≥ 95% |
| 日报完成率 | ≥ 90% |
| 5min 内完成日报 | ≥ 80% |

---

## 2. 宪章 · 18 条不动条款

> **性质**: 不可频繁修改的产品根基. 所有 PRD / 设计 / 代码决策必须服从.
> **修订**: 每 6 个月复审, 创始人+产品+AI 三方签字, >20% 改动视为大版本变更.

### §1 · 工作的原子单元是「决议」, 不是「消息」

- 每个 Decision Card 含: 关联 KR/TTI、上下文链路、责任人、时间戳、影响范围、后果回溯指针
- 会议成功 = 产出几张 DC; 员工成长 = 推动几张 DC; 团队效能 = DC 执行率
- **禁止**: 消息数/在线时长/回复速度作为正向激励

### §2 · AI 给 3+1 选项, 不替员工决策

- 🅰 SOP 方案 (守正) · 🅱 推演方案 (出奇) · 🅲 经验方案 (借势) · 🅳 自创方案 (临场, 强制填"我多看到了什么")
- 每选项强制展示: 置信度、风险评级、适用边界、关联 KR 影响
- **禁止**: 一键自动最佳建议 / AI 无依据输出 / 多 Agent 互相辩论扩散

### §3 · 议事室 17 分钟硬上限或升级

```
1. ALIGN    (校准)  2 min
2. FRAME    (界定)  3 min
3. DIVERGE (发散)  5 min  ← AI 给 3+1
4. CONVERGE(收敛)  4 min  ← 投票/分歧检测
5. COMMIT  (落地)  3 min  ← DC + 行动项
─────────────────────
单议题硬上限 17 分钟
```

- 分歧 > 阈值 → AI 暴露根源 → 1 轮再议 → 仍分歧 → **自动升级到指定决策人**
- **禁止**: 1 小时以上议题 / 无 DC 产出的会议 / AI 无限循环

### §4 · KPI → 钱; TTI → 成长 (双轨彻底分离)

- TTI 完成情况 **不影响** 任何金钱回报
- KPI 评分 **不直接决定** 晋升或高潜身份
- **禁止**: TTI 加成系数 / KPI 强制作为高潜条件

### §5 · KPI 100% 合格; TTI 60-70% 健康

- KPI: <100% 红, 100%+ 绿; 设定时 AI 强制三审视 (历史均值/客观性/可控性)
- TTI: 60-80% 绿, 40-60% 黄, >90% **橙警告**: "目标定低了?"

### §6 · 全公司透明 (CEO 的 OKR/TTI 全员可见)

- OKR 树最大 3 层 (公司→团队→个人)
- 任何员工可看任何同事 OKR/TTI, 含 CEO
- **例外** (默认私密): 个人 KPI 详情、述职不愿公开部分、红区会议 DC

### §7 · Material ≠ Memory (材料层 vs 记忆层)

四层知识架构:
```
Layer 1: ORIGINS   (录像/原始消息)        ← 仅当事人可见
              ↓ 自动
Layer 2: MATERIALS (纪要/Decision Card)   ← 全员可写可查
              ↓ 严肃签批 ⚖️
Layer 3: MEMORY    (SOP/案例/红线/价值观)  ← 签批后入, 全员引用
              ↓ 季度训练 🧠
Layer 4: BASELINE  (公司大模型权重 + RAG)
```
- Material 描述「事实如何」; Memory 描述「我们认为应该如何」
- **禁止**: Material 直喂 Baseline / 无层级混合知识库 / AI 自动归档 Memory

### §8 · 公司记忆必须经签批 (防基线漂移)

| 级别 | 签批人 | SLA | 范围 |
|---|---|---|---|
| Lv1 团队级 | 团队 Leader + 治理官 | 3 工作日 | 团队 SOP / 小型案例 |
| Lv2 部门级 | 部门 Leader + 治理官 + KR 关联人 | 5 工作日 | 部门 SOP / 跨团队案例 |
| Lv3 公司级 | C-level 集体 | 14 工作日 | 红线 / 价值观 / 战略叙事 |

- 逾期自动 escalate +1 级; Lv3 逾期 → 通知 CEO + 治理委员会
- **禁止**: 自动判定 Memory / 基于时间自动归档 / 治理官由业务 Leader 兼任

### §9 · 分身代参必须显式标识 (反 AI 欺诈)

- 强制水印 (音频+视频) · 会议邀请方可拒绝分身
- 红区禁用分身: 客户/招聘/战略/C-level/法务/审计/财务
- 事后纪要确认: 24h 否决窗口, 员工可一键否决任何分身决议
- **禁止**: 静默代参 / 一次授权终身代参 / SKU 屏蔽否决权

### §10 · 9 宫格人才矩阵 (KPI × TTI)

```
              KPI 不达标  KPI 达标  KPI 超出
   TTI 突出  ❓待开发高潜  💎高潜稳健  ⭐核心接班人
   TTI 中    ⚠️方向错位  🟢中坚骨干  🚀强力贡献者
   TTI 低    🔴末位 PIP   ✅稳定老将  🎯技术专家
```

- 末位淘汰 **仅基于 KPI**, 不基于 TTI; Calibration 用盲打分去偏见
- **禁止**: 强制 10/20/70 stack ranking / TTI 完成度淘汰 / KPI 直接判定高潜

### §11 · 反对消息黏性, 拥抱异步聚合 (心流神圣)

- 消息默认进 AI Digest, **每天 2-3 次集中处理**
- 紧急通道 (@紧急/老板加急) 每人每天 ≤ 3 次
- 目标: 员工每天有 **4-6 小时不被打断的心流时间**
- **允许决议型已读**: DC 阅签 / 紧急任务确认 / 签批状态 / TTI 节点承认
- **禁止焦虑型已读**: IM 秒级红点 / "X 分钟未回复"提醒 / 上司监控下属阅读时间 / 已读未回红字

### §12 · 末位机制基于绝对 KPI, 不基于相对排名

- **允许**: KPI 连续 N 季不达标 → PIP / 严重低于底线 → 预警 / 客观数据触发 / Calibration 综合评估
- **禁止**: "团队必须淘汰末位 10%" / Stack Ranking / 凑数 / 末位与 TTI 挂钩 / 跨团队相对排名

### §13 · 数据归公司, 尊严归员工

- **数据归公司 (明面)**: 员工在岗期间所有工作数据归企业, 离职全留
- **尊严归员工 (暗面)**: 不监控在线时长/输入速度/屏幕活动 / 不强制 8h 外响应 / 不差别化建议 / 不抹黑离职档案 / 不公开披露末位身份
- **员工合理获得**: 个人成长报告 PDF / 述职摘要 / 拿捏老板使用统计 (匿名化)
- **禁止**: 监控日常状态 / AI 替员工承担情绪压力 / 剥夺最低尊严保障

### §14 · 知识治理官独立角色 (防腐败)

- Steward **不可**由直接业务 Leader 或 HR 兼任
- **可兼任** (中小公司): 战略部门 / 总裁办 / 资深专家 (≤30%)
- 治理官有专属 AI Co-pilot, 自动标注矛盾/过时/引用统计

### §15 · AI 助员工成长, 不替员工劳动

- 所有 AI 输出满足: ① 24h 内可被员工否决 ② 每次输出让员工更聪明 (展示推演过程)
- **禁止**: 一键自动完成 / 无解释黑盒 / 连续 N 周替做同类决策
- **口号**: "下班早一小时是表象, 员工成长更快才是承诺"

### §16 · LLM 可热插拔, TAF 不可妥协

- LLM 抽象层: OpenAI 兼容接口, 一行切换 (DeepSeek/Qwen/Doubao/Kimi/Hermes)
- 协议层固化: 3+1 决策 / 议事室 / DC / Persona / Memory 在 TAF 协议层定义
- 多模型路由: 按场景+成本+失败回退自动选择
- **禁止**: 业务逻辑写进单一模型 fine-tune / 自训基座 / 锁定单一 LLM 厂商

### §17 · 我们做民企的牛马搭子

**目标客户**: 互联网/SaaS/消费/教育/创意/跨境电商/文化娱乐, 50-3000 人民营企业 (sweet spot 200-1000)
**不进入**: 政府机关/国企/银行证券保险/涉密/军工/公检法
**不做**: 信创版/涉密版/国密版/政企招标/国资云/强制分布功能
**口号**: "我们做民企的牛马搭子. 让民企员工先翻身."

### §18 · OSS 借力 + 自建思考层

- **自建 (核心差异化)**: OKR/TTI+DC+9宫格 / 议事室+3+1 / 拿捏老板 / TAF / 四层知识+Steward / Inbox 聚合
- **自建 (复用 Hermes)**: IM+群聊 / 组织架构 / 邮件 (调用 API)
- **寄生 (调 API)**: 音视频会议 (腾讯会议)
- **永不做**: CRM/OA/审批/考勤/外勤/GPS/印章

---

## 3. 双模块产品架构

```
                 ┌─────────────────────┐
                 │  Tandem · 牛马搭子   │
                 │  18 条宪章 (不可改)   │
                 └──────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                                        ▼
   ╔═══════════╗                          ╔═══════════╗
   ║   事半    ║                          ║   拿捏    ║
   ║  (企业)   ║                          ║  (员工)   ║
   ╚═══════════╝                          ╚═══════════╝
   事半功倍                                拿捏老板
```

### 3.1 事半模块 · 企业级 7 大功能区

#### 3.1.1 OKR 重型 5 层 + 日报闭环 + Dashboard

```
Objective (年度/公司或部门)
  └─ KR (季度/可量化)
       ├─ Initiative (跨季度举措)
       ├─ DecisionCard (议事决议, 17min 闭环)
       └─ ActionItem / AP (任务追踪 + 截止日)
```

- **5 分钟极简日报**: AI 预填 80%, 员工只核对; AP 反向强推; 写不出超 24h → 自动 escalate 主管
- **三层 Dashboard**: 个人(今日AP/本周KR/季度9宫格) / 主管(团队红绿灯/AP卡点热力图) / 老板(全公司OKR树/Memory健康/合规仪表)

#### 3.1.2 议事室 (Convergence Room)

- 5 步状态机 (ALIGN→FRAME→DIVERGE→CONVERGE→COMMIT)
- 17min 硬上限 · 3+1 选项 (D 必填) · 24h 否决窗口
- 发起默认必选 KR, escape hatch (无关 KR) 强制填理由

#### 3.1.3 IM 企微级

| 子能力 | 状态 |
|---|---|
| 频道+私聊+群 | ✅ V1 |
| 一键开议事+沉 Memory | ✅ V1 |
| @中央 AI / @个人 Persona | ✅ V1 |
| 音视频会议 | ★ V1 GA (腾讯会议 ISV) |
| 文件存储 | ★ V1 GA (MinIO) |
| 协同文档 | ★ V1 GA (Univer+Tiptap+Yjs) |

#### 3.1.4 知识 4 层架构

`Origins → Materials → Memory → Baseline`, 三级签批 + AI 反向降级扫描.

#### 3.1.5 邮件存证回路

- **入站**: IMAP (Exchange/Office 365/腾讯/阿里) → Material / DC.originRefs / Memory promotion
- **出站**: 12 事件模板 (DC COMMIT/VETOED/KR 滞后/Persona 升阶/安全事件等)
- **归档**: hash 链入审计, DKIM/SPF/DMARC 全配

#### 3.1.6 Intranet (企业内网)

4 分类: 公告 / 政策(强制已读+AI摘要+版本管理) / 大事记 / 福利
差异化: CEO 周记 + 匿名意见箱 + 新员工必读解锁机制

#### 3.1.7 Launchpad (跳板)

3 分类: 业务系统 (ERP/CRM) / 通讯 / 学习. 卡片式+SSO一键+部门权限+AI今日推荐

### 3.2 拿捏模块 · 员工级 4 大功能区

#### 3.2.1 个人 AI 双层架构

```
┌──────────────────────────────────────────────┐
│  员工 Persona (本地 Hermes 4 量化)             │
│    部署: 客户本地 GPU (A10/4090 起步)         │
│    职责: 学员工风格, 跑日常 Skill             │
│    数据: decisionHistory + styleProfile       │
└──────────────────┬───────────────────────────┘
                   │ 复杂任务升级 (token>4K / reasoning_complex)
                   ▼
┌──────────────────────────────────────────────┐
│  中央 AI (云 DeepSeek V3 + Qwen-Max 备)       │
│    强注入: Baseline + Memory (公司价值观+SOP) │
└──────────────────────────────────────────────┘
```

#### 3.2.2 5 阶段进化 + 拿捏度

```
🥚 newborn    (0-2w 旁听)
🐣 apprentice (2w-2m 代汇报)      ── 自动升级
🐤 assistant  (2m-6m 绿区表态)   ── 自动升级
🦅 deputy     (6m-1y 黄区代行)    ── ★ 员工 consent
🐉 partner    (>1y 跨企业代行)    ── ★ 双向 consent

bossCaptureScore = f(决议数, 否决率, 风格相似度, KR 贡献度)
score ≥ 80 → "反客为主" 提示出现
```

#### 3.2.3 持续训练材料挂接 (5+2 层注入)

1. Baseline (公司价值观, 强制)
2. Memory.redline (红线, 硬约束)
3. Memory.sop (SOP, 软建议)
4. Memory.case (最佳案例)
5. Skills (标准智能体)
6. decisionHistory (个人决议轨迹)
7. styleProfile (个人风格)

#### 3.2.4 代行边界 (autonomy 守门)

- 红区 (薪资/法律/投诉): **永禁** AI 代行
- 黄区: 24h 否决窗口 + 全程水印 `isProxy=true`
- 绿区: 可自动代

---

## 4. 技术架构

### 4.1 全栈技术选型

```
┌─────────────────────────────────────────────────────────────┐
│  呈现层                                                      │
│  ────────────────────────────────────────────────────────  │
│  Web:    Next.js 14 (App Router) · React 18 · TypeScript   │
│  Desktop: Tauri v2 (Rust) + WebView2                       │
│  UI:     Tailwind CSS · shadcn/ui · Radix UI · Lucide      │
│  State:  Zustand                                            │
├─────────────────────────────────────────────────────────────┤
│  API / BFF 层                                                │
│  ────────────────────────────────────────────────────────  │
│  Next.js Route Handlers (app/api/*)                         │
│  全局 Auth: middleware.ts (Edge) + requireAuth (endpoint)    │
│  统一客户端: lib/hermes-api.ts (Web fetch ↔ Tauri invoke)   │
├─────────────────────────────────────────────────────────────┤
│  业务逻辑层                                                  │
│  ────────────────────────────────────────────────────────  │
│  TAF:    lib/taf/ (Router + Provider + Skills)             │
│  OKR:    lib/okr/                                           │
│  议事室: lib/convergence/ (状态机 + 编排器)                  │
│  知识:   lib/memory/                                        │
│  Persona: lib/persona/                                      │
│  隐私:   lib/privacy/ (redactor + redactors-domain)          │
│  审计:   lib/audit/                                         │
├─────────────────────────────────────────────────────────────┤
│  数据层                                                      │
│  ────────────────────────────────────────────────────────  │
│  存储:   Prisma + PostgreSQL (生产) / InMemory (dev+e2e)    │
│  Schema: prisma/schema.prisma (30+ 表)                     │
│  Auth:   自研 JWT (HS256) · 15min access + 30d refresh      │
│  Vector: pgvector (V2 升 Milvus)                             │
├─────────────────────────────────────────────────────────────┤
│  外部集成层                                                  │
│  ────────────────────────────────────────────────────────  │
│  LLM:    DeepSeek V3 / Qwen-Max / Doubao / Kimi (OpenAI兼容)│
│  会议:   腾讯会议 ISV API                                   │
│  邮件:   IMAP/SMTP (腾讯/网易/Outlook)                     │
│  SSO:    钉钉/企微/飞书 OAuth                               │
│  文档:   Univer (Sheet) + Tiptap+Yjs (Doc)                 │
│  存储:   MinIO (文件) · Cal.com (日历, AGPL 法务 review)     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 运行时双态架构

```
┌──────────────┐              ┌──────────────┐
│   Web 模式    │              │ Desktop 模式  │
│  (浏览器)     │              │  (Tauri exe)   │
└──────┬───────┘              └──────┬───────┘
       │                            │
       ▼                            ▼
┌──────────────┐              ┌──────────────┐
│ Next.js API  │              │ Rust Commands│
│ app/api/*    │              │ src-tauri/   │
│ (Route       │              │ (12 commands)│
│  Handlers)   │              │              │
└──────┬───────┘              └──────┬───────┘
       │                            │
       └────────────┬───────────────┘
                    │
                    ▼
           ┌────────────────┐
           │ hermes-api.ts  │
           │ 统一客户端      │
           │ (runtime 分支)  │
           └────────────────┘
```

**统一客户端原则**: 页面永远 `import { getStatus } from '@/lib/hermes-api'`, 不直接 `fetch()` 或 `invoke()`.

### 4.3 TAF 五层架构

```
Layer 5: 应用层 (Use Cases)
  • 议事室会议 · 拿捏老板分身 · Check-in 草稿 · 自动绩效自评包 · 卡顿检测 · 分身代参

Layer 4: 编排层 (Orchestrator)
  • 3+1 决策状态机 · 议事室 5 步状态机 · Plan/Act 分离 · 24h 否决窗口 · 17min 硬上限定时器

Layer 3: 协议层 (Tandem Protocol)
  • Decision Card Schema · Tool Schema (Hermes Function Calling) · Persona Schema · Memory Schema · Conversation Protocol

Layer 2: LLM 抽象层 (Provider Adapter)
  • OpenAI 兼容接口 · 路由策略 (场景/成本/延迟/失败回退) · Function Calling 适配 · Streaming + Interrupt 标准化

Layer 1: 基础设施层
  • 多模型并发池 · 请求级 tracing · 成本计量 · token 预算控制 · 缓存层
```

### 4.4 启动与存储架构

```
[boot.ts] 启动注入 (globalThis 单例, 防 HMR 重置)
  │
  ├─ Storage 选择 (DATABASE_URL 存在? Prisma : InMemory)
  │     ├─ PrismaStore  → PostgreSQL (V1 GA 生产路径)
  │     └─ InMemoryStore → dev / e2e / 测试
  │
  ├─ TandemRouter (TAF 模型路由)
  │     └─ DeepSeek-v3 / Qwen-Max / 多模型 fallback
  │
  ├─ ConvergenceOrchestrator (议事室编排器)
  │
  ├─ registerBuiltinSkills (标准技能注册)
  │
  └─ seedDevData (dev 环境种子数据)
```

### 4.5 认证架构 (双层防御)

```
Request → middleware.ts (Edge, Layer 1)
            │
            ├─ /api/auth/* /health* → 放行 (白名单)
            │
            ├─ 有效 tandem_at cookie → 透传 header (x-tandem-user-id/roles/tenant-id)
            │                         → NextResponse.next({ request: { headers } })
            │
            ├─ demo 模式 → 放行, 下游 requireAuth fallback demo-user
            │
            └─ 生产无 token → 401 JSON
            │
            ▼
         app/api/*/route.ts
            │
            └─ requireAuth(req) (Layer 2)
                 ├─ 读 header → 验证 → 返回 { userId, roles, tenantId, demo }
                 └─ 无效 → 403
```

**Edge 兼容**: `lib/auth/session-edge.ts` 用 `crypto.subtle.verify` (Web Crypto), 与 `lib/auth/session.ts` (Node crypto) 输出格式完全兼容.

---

## 5. 数据模型

### 5.1 Prisma Schema 核心实体 (30+ 表)

```
用户 / 组织
  ├── User (身份, RBAC, 多租户 tenantId)
  ├── Department
  ├── PasswordHash (argon2id)
  ├── Session (设备指纹, refresh token hash)
  ├── MfaSecret (TOTP, 恢复码)
  └── Invite (邀请码 hash, 预设角色)

OKR / 绩效
  ├── Objective (年度/公司级)
  ├── KeyResult (季度/可量化)
  ├── TTI (成长目标)
  ├── Initiative (跨季度举措)
  └── CheckIn (5min 日报)

决议
  ├── DecisionCard (17min 产物)
  ├── ActionItem / AP (任务追踪)
  └── ConvergenceRoom (议事室状态机)

知识
  ├── Material (纪要/原始素材)
  ├── Memory (SOP/案例/红线)
  ├── MemoryPromotionRequest (签批流)
  └── MemoryVersion (版本历史)

Persona / 拿捏
  ├── Persona (员工 AI 分身)
  ├── StyleProfile (风格学习)
  └── DecisionHistory (决议轨迹)

1on1 / 360
  ├── OneOnOne (主管-员工私语)
  ├── OneOn1Template
  ├── FeedbackCycle (360 周期)
  └── FeedbackSubmission (匿名提交)

IM / 沟通
  ├── Channel (5-15 个常驻)
  ├── Message
  └── Thread (轻量讨论分支)

审计 / 隐私
  ├── AuditLog (链式 hash)
  └── (EVO-7 PII 按 scope 抹白, 不存于 schema, 运行时计算)
```

### 5.2 关键关系

- **User** 1:N Department (managerId 自引用报告链)
- **Objective** 1:N KeyResult 1:N Initiative 1:N DecisionCard 1:N ActionItem
- **User** 1:N Persona (每人可有多分身)
- **Channel** 1:N Message N:M Thread (via thread_id)
- **Memory** 升级: Material → MemoryPromotionRequest (Lv1/Lv2/Lv3 签批流)

---

## 6. 信息架构

### 6.1 页面结构 (41 页)

```
首页 (/)                           ← EVO-10 Workbench Agent View
├── 事半
│   ├── /okr                       ← OKR 5 层 + AI 纠偏面板
│   ├── /convergence               ← 议事室列表/创建
│   ├── /convergence/[id]          ← 议事室 5 步实时会话
│   ├── /decision-card             ← Decision Card 库
│   ├── /tasks                     ← AP / ActionItem 追踪
│   ├── /checkin                   ← 5min 日报
│   ├── /1on1                      ← 主管-员工 1on1
│   ├── /360                       ← 360 反馈周期
│   └── /nine-box                  ← 9 宫格人才矩阵
├── 拿捏
│   ├── /persona                   ← 个人 AI 分身管理
│   └── /persona/[id]              ← 分身详情 + 训练材料
├── 沟通
│   ├── /im                        ← IM 首屏 (Inbox 聚合)
│   └── /chat                      ← 多会话流式聊天
├── 知识
│   ├── /knowledge                 ← 四层知识浏览器
│   ├── /memories                  ← Memory 库 + 签批流
│   └── /skills                    ← 技能市场
├── 组织
│   ├── /organization              ← 三省六部 org chart
│   └── /intranet                  ← 企业内网 (公告/政策/大事记/福利)
├── 管理
│   ├── /admin                     ← 管理员后台
│   ├── /analytics                 ← 数据洞察
│   ├── /report                    ← 报告导出
│   └── /logs                      ← 实时日志 tail
├── 系统
│   ├── /settings                  ← 主题/测试/数据导出导入
│   ├── /login                     ← 自研登录
│   ├── /register                  ← 注册 (邀请码)
│   └── /design                    ← 设计系统参考
└── API (68 routes, app/api/*)
```

### 6.2 API 结构 (68 个 Route Handlers)

```
/api/auth/*         登录/注册/登出/刷新/邀请/MFA
/api/health         系统健康
/api/me/*           当前用户 (dashboard / persona / checkin)
/api/org/*          组织/部门/用户列表
/api/okr/*          OKR CRUD + 进度
/api/convergence/*  议事室状态机 + 会话
/api/decision-card/* Decision Card CRUD
/api/memory/*       Memory / Material / Promotion
/api/persona/*      分身 CRUD + 训练
/api/1on1/*         1on1 会话
/api/360/*          360 反馈周期/提交
/api/im/*           频道/消息/线程
/api/tasks/*        Cron / AP
/api/skills/*       技能市场
/api/mcp/*          MCP 服务器
/api/stream         SSE 聊天流
/api/llm-stream     SSE BYOK 流
/api/workflows/*    工作流执行
```

---

## 7. 知识架构

### 7.1 四层架构详解

```
Layer 1: ORIGINS (起源层)
  ── 未经处理的原始数据
  ── 腾讯会议录像 / IM 原始消息 / 文件原件 / 邮件原文 / 操作日志
  ── 仅当事人可见, 不可作为决策依据

Layer 2: MATERIALS (材料层)
  ── 描述性: "事情发生了什么"
  ── 议事室纪要 / Decision Card / Check-in 报告 / 复盘
  ── 全员可写可查, 鼓励多

Layer 3: MEMORY (记忆层)
  ── 规范性: "我们认为应该如何"
  ── SOP 库 / 案例库 / 红线库 / 价值观库 / 经验库
  ── 签批后入, 全员引用, 严肃少
  ── 三级签批 (Lv1 3天 / Lv2 5天 / Lv3 14天) + 逾期 escalate

Layer 4: BASELINE (基线层)
  ── 公司基因: 大模型权重 + RAG
  ── 季度训练, 强注入到所有个人 Persona 调用
  ── 防止个人 AI 跑偏
```

### 7.2 信息流

```
ORIGINS   ──自动──>  MATERIALS  ──签批──>  MEMORY  ──季度训练──>  BASELINE
 (原始)              (纪要/DC)            (SOP/案例)            (模型权重)
   │                    │                   │
   │                    ▼                   │
   │              Decision Card              │
   │              (工作原子单元)              │
   │                    │                   │
   └────────────── 强注入到 Persona ─────────┘
```

---

## 8. 安全与隐私架构

### 8.1 认证 (G1 V1 GA)

- **自研 JWT**: HS256, 15min access (`tandem_at`) + 30d refresh (`tandem_rt`), 设备指纹绑定
- **双层防御**: `middleware.ts` (Edge 全局拦截) + `requireAuth` (endpoint 级验证)
- **白名单**: `/api/auth/*`, `/api/health*`, `/api/integrations/health`, `/api/llm-health`
- **MFA**: TOTP + 10 个恢复码
- **防爆破**: 失败登录计数 + 自动锁定

### 8.2 授权 (RBAC)

```
角色: admin / hr / steward / manager / employee
Steward: 独立角色, 不可由业务 Leader 或 HR 兼任
权限粒度: 用户级 (self) / 部门级 / 租户级 / 全局
```

### 8.3 隐私 (EVO-7)

- **PII 默认剥离框架**: `lib/privacy/redactor.ts`
- **Scope 体系**: `self` / `admin` / `tenant` / `public`
- **按视角抹白**: 同事看不到 email/IP/锁定状态; 本人+admin 看全
- **API 级保护**: `/api/me/dashboard` userId 锁定 session; `/api/persona/[userId]` 仅 self/admin/hr/steward 可读

### 8.4 审计

- 链式 hash 审计日志 (不可篡改)
- 所有进出邮件 hash 入审计
- 安全事件 (异常登录/MFA/锁定) 实时邮件告警

---

## 9. 演进路线图

### 9.1 当前状态 (2026-05-12)

| 指标 | 数值 |
|---|---|
| Commit | 61 |
| 文件改动 | 501 次 |
| API routes | 68 个 |
| 页面 | 41 个 |
| 组件 | 59 个 |
| lib TS 模块 | 81 个 |
| 文档 | 35 篇 |
| Prisma 模型 | 30+ 表 |
| tsc 违章 | 0 (pre-commit gate 强制) |

### 9.2 V1 GA (剩余 3 天)

| 任务 | 工期 | 阻塞解除 |
|---|---|---|
| **G1** middleware.ts 全局 auth gate | 2 天 | ✅ 已交付 |
| **G2** Prisma e2e 1on1/360 | 1 天 | 待做 |

### 9.3 V1.5 (后续 4-6 周)

| 进化 | 价值 | 预算 |
|---|---|---|
| EVO-11 议事室 5min course-correct | 17min 协同最后一公里 | 4 天 |
| EVO-9 ReasoningBank | 复盘闭环 | 6 天 |
| EVO-3 HRIS Adapter (只读入站) | 客户落地必备 | 7 天 |

### 9.4 V2 (V1 GA 后 6 个月)

- 钉钉/企微/飞书任一上架
- 多租户 SaaS 切面
- Persona partner 跨企业
- Memory marketplace
- 移动端 iOS/Android

### 9.5 V3 (V1 GA 后 12 个月)

- Tandem 反向 IdP
- 国密 SM2/SM3/SM4
- BI + 国际化
- Skills Marketplace

---

## 10. 附录

### A. 5 问产品决策检验

任何新功能上线前自检:

1. 这个功能让员工 **离决议更近, 还是离消息更近**?
2. 这个功能让 AI 是 **辅助员工, 还是替代员工**?
3. 这个功能让 KPI/TTI 双轨 **保持分离, 还是混淆**?
4. 这个功能让员工 **心流时间增加, 还是被打断更多**?
5. 这个功能尊重 **员工是主体, 还是把员工当资源**?

**任一答案是"后者" → 设计不合格, 重新做.**

### B. 反例清单 (我们永远不做)

| 功能 | 来源 | 不做原因 |
|---|---|---|
| 焦虑型已读红点 | IM 类 | 制造焦虑, 反心流 |
| 强制末位分布 (stack ranking) | GE 模式 | 反生产力, 破坏协作 |
| OKR 直接挂薪资 | Tita 模式 | 异化 OKR 为 KPI |
| AI 一键代写所有内容 | 通用 AI | 培养橡皮图章 |
| 监控员工在线时长/屏幕 | 监控 SaaS | 违反员工尊严 |
| 多 Agent 互相辩论扩散 | AutoGen | 违反目标驱动收敛 |
| 自动归档 Memory | 知识管理 | Memory 必须严肃维护 |
| AI 替员工承担情绪压力 | 通用 AI | 让员工抗压能力退化 |
| 公开披露员工末位身份 | 排行榜 SaaS | 违反员工尊严 |

### C. 关键文档索引

| 文档 | 内容 | 优先级 |
|---|---|---|
| `MANIFESTO.md` | 18 条宪章完整版 | 最高 |
| `PRODUCT-DEFINITION.md` | 14 项锁定决策 + 7 个月路线图 | 高于 PRD |
| `PRD.md` | 功能需求完整版 | 实施基线 |
| `AGENT-FRAMEWORK.md` | TAF 五层架构 | 技术核心 |
| `CONVERGENCE-PRINCIPLE.md` | 3+1 决策 + 议事室方法论 | 产品灵魂 |
| `KNOWLEDGE-ARCHITECTURE.md` | 四层知识 + 签批流 | 差异化 |
| `UI-IA.md` | 信息架构 + 设计语言 | 体验基准 |
| `RETROSPECTIVE-2026-05-12.md` | 项目全景复盘 | 演进参考 |

---

> **签字**:
>
> 创始人: ____________  日期: ____
> 产品负责人: ____________  日期: ____
> AI 负责人: ____________  日期: ____
> 技术负责人: ____________  日期: ____
>
> **宪章是地基. 我们不在地基上跳舞.**
