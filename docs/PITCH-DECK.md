---
marp: true
theme: default
paginate: true
size: 16:9
header: 'Tandem · 牛马搭子'
footer: '宪章 18 条 · 50/50 e2e PASS · V1 GA 已就绪'
style: |
  section {
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(135deg, #fafafa 0%, #f3f4f6 100%);
  }
  section.cover {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #f8fafc;
  }
  section.cover h1 { font-size: 88px; line-height: 1.0; margin-bottom: 0; }
  section.cover h2 { font-size: 32px; color: #94a3b8; font-weight: 400; margin-top: 20px; }
  section.section-break {
    background: #0f172a;
    color: #f8fafc;
    text-align: center;
  }
  section.section-break h1 { font-size: 64px; }
  h1 { color: #0f172a; border-bottom: 3px solid #f97316; padding-bottom: 8px; }
  h2 { color: #1e293b; }
  strong { color: #ea580c; }
  table { font-size: 22px; }
  blockquote {
    border-left: 6px solid #f97316;
    background: #fff7ed;
    padding: 12px 18px;
    color: #1e293b;
  }
  code { background: #1e293b; color: #fbbf24; padding: 2px 6px; border-radius: 4px; }
  .small { font-size: 20px; color: #64748b; }
  .big { font-size: 56px; font-weight: 700; color: #ea580c; }
---

<!-- _class: cover -->

# Tandem
## 牛马搭子 · 给民企老板和员工的搭档

<br>

**北极星指标**: 不让 AI 替员工对老板撒谎 · 也不让老板用 AI 把员工挤干

<br>

`v1 · 2026.05` · 50/50 e2e PASS · 18 条宪章

---

<!-- _class: section-break -->

# 一、痛

---

# 现在所有 "AI for work" 工具有个共同病

<br>

| 客户实际反馈 | 本质 |
|---|---|
| "买回去员工不用, 三个月就废了" | 工具不对 **真实工作流** 负责 |
| "用了之后, 员工拿 AI 写的周报骗我" | AI 帮**弱者欺骗强者** |
| "老板拿 AI 替我做决定, 我不知情" | AI 帮**强者剥削弱者** |
| "省下的时间不是用来思考, 是用来摸鱼" | 没有**结构性产出闭环** |

<br>

> **真正的痛不是效率不够, 是信任崩塌**.
> 老板和员工互相用 AI 防着对方. 工具越强, 关系越塌.

---

# 谁家的"AI 助手"做对了这件事?

<br>

- **飞书/钉钉/企微**: 通讯 + 审批数字化. **不解决决策, 不防 AI 欺诈**
- **Notion AI / Lark AI**: 单点效率工具. **没有边界, 没有 consent**
- **Microsoft Copilot**: 个人生产力. **不是组织工具**
- **国内做 "AI 员工" 的**: 直接替员工干活. **加速 AI 欺诈**

<br>

**没人敢碰 "AI 不可以替员工伪造对老板的决策"** — 因为这等于宣告 AI 不万能, 但这才是真问题.

---

<!-- _class: section-break -->

# 二、做法

---

# Tandem 的解法: 一个有边界的搭档

<br>

> 不是 "AI 助手", 是 "**员工 + AI** 这对搭档" — 像副驾(tandem)那样, 谁主驾必须明牌

<br>

四个核心机制 (V1 已上线 50/50 e2e PASS):

1. **议事室** · 17 分钟硬上限, AI 给 3 选项, **D 选项必须人写**
2. **拿捏老板分身** · 5 阶段, 永不跳级, autonomy 必须员工本人 consent
3. **双轨 KPI × TTI** · TTI **永不挂钩奖金**, 真员工成长
4. **Memory 三级签批 + AI 反向建议降级** · 知识库不靠累积, 靠**淘汰**

---

# 议事室: 17 分钟硬上限闭环

<br>

```
1. AI 自动收上下文          ← 关联 SOP / 历史决议 / KR / TTI
2. 3 + 1 选项                ← A:SOP  B:AI 推演  C:历史  D:你的原创 (必填!)
3. 团队审议
4. 收敛 (≤17 min, 否则自动 ESCALATE)
5. COMMIT → 24h 否决窗口 → 生效
```

<br>

> **D 选项是反 AI 欺诈的核心**:
> 如果员工把 D 留空, 系统记一笔 "依赖 AI/SOP/历史". 公司可以从 9 宫格看 D 占比.
> **D 占比 < 20% 的员工, 是 AI 替老板挤干的早期信号**.

---

# 拿捏老板分身: 5 阶段, autonomy 守门

<br>

| 阶段 | 时间 | 能做什么 |
|---|---|---|
| 🥚 新生 | 0-2w | 仅旁听学习 |
| 🐣 学徒 | 2w-2m | 代汇报数据 |
| 🐤 助手 | 2m-6m | 绿区会议表态 |
| 🦅 副手 | 6m-1y | **承诺 1 工作日动作** (黄区, 需 consent) |
| 🐉 搭档 | >1y | **跨企业代行** (红区, 需双向 consent) |

<br>

> 关键: **assistant → deputy 必须员工本人在 UI 点 "同意升阶"**.
> 老板/管理员不能强行升级你的分身. 高敏话题(薪资/法律/裁员)永久红区, AI 强退.

---

# 双轨指标: KPI × TTI

<br>

```
KPI (硬指标)              TTI (成长度, Tandem Improvement Index)
─────────                 ─────────
完成度 100%               完成度 60-70% 健康
挂钩奖金/调薪/末位        永不挂钩任何金钱回报
按部门/岗位               按个人成长方向
对外承诺                  对内自我对齐
```

<br>

> **9 宫格 (KPI × TTI)**: 一眼看出
> · KPI高 TTI 高 = 真明星
> · KPI 高 TTI 低 = **疲于奔命的螺丝钉** (留人警报)
> · KPI 低 TTI 高 = 学习者 (容忍)
> · KPI 低 TTI 低 = 末位

---

# Memory 三级 + AI 反向建议降级

<br>

**三级签批入库** (越高级 SLA 越长 + 公示越久):

| 级别 | 签字人 | 公示 | 用途 |
|---|---|---|---|
| Lv1 团队 | 部门 Leader + Steward | 3 天 | 部门 SOP |
| Lv2 业务线 | + 业务负责人 | 7 天 | 业务标准 |
| Lv3 公司 | + CEO | 14 天 | 公司红线 / 价值观 |

<br>

**反向降级** (V1 已上线, 别人没做):
> AI 每周扫 Memory 引用率 ≤ 均值 30% 的条目, 主动给 Steward 推 "建议降级 / 修订 / 归档"
> 知识库**不是越大越好, 是越精越好**. 你的 SOP 库每年自然瘦身 20%.

---

# 数据归谁: §13 一明一暗

<br>

**明面** (写在合同里):
- 数据归 **公司**, 装在客户自己的 PostgreSQL
- pg_dump 随时带走, 不续签 Tandem 0 残留

**暗面** (写在系统宪章里, 对客户 Champion 透明):
4 项**员工尊严铁律** (不可绕过的技术兜底):

1. **导出权** · `/api/me/export` 拉个人成长报告 + 决议历史 JSON
2. **匿名化** · 离职 admin 一键 `anonymize`, Persona 学习停 + 通讯示例清空
3. **否决权** · AI 代行任何决策 24h 内可撤回
4. **拒绝代笔** · 薪资/法律/投诉红区 AI 强退

> **销售话术**: 别家说 "员工数据你都能看". 我们说: **数据你都能看, 员工尊严不受侵犯, 这样员工才不会联合起来防你**.

---

<!-- _class: section-break -->

# 三、技术

---

# 架构: OSS 借力 + 自建思考层

<br>

```
┌─ 应用层 ─────────────── Next.js 14 + React 18 + Tailwind
│
├─ 思考层 (自建) ────────  Tandem Agent Framework (TAF)
│                          · 议事室 orchestrator (17min 闭环)
│                          · Persona 进化 (5 阶段守门)
│                          · Memory 三级签批 + 降级扫描
│                          · 红区 skill blacklist (强阻断)
│
├─ Runtime ────────────── DeepSeek V3 (主) · Hermes 4 (本地兜底)
│                          · 真流式 SSE (非 buffered)
│
├─ 持久化 ──────────────── Prisma + PostgreSQL (客户私有部署)
│                          · 完整 schema migrate · 审计链 hash
│
└─ 接入层 ──────────────── 企微 / 钉钉 / 飞书 SSO
                            · 寄生策略, 不替换通讯, 只接管决策
```

---

# 测试: 50 / 50 e2e PASS (实跑)

<br>

```
e2e-v1.ps1 (业务全链路)            33 / 33 PASS
  · IM 消息 + 议事室 spawn + Memory 升级
  · 议事室 5 步全闭环 (DIVERGE → COMMIT → VETO)
  · Persona 升阶 consent (POST upgrade + DELETE dismiss)
  · Memory 降级 AI 扫描
  · 红区 AI 拒签
  · 审计链 hash 完整性 ✓

e2e-auth.mjs (Auth + §13 隐私)     17 / 17 PASS
  · 邀请注册 + 5 次锁定
  · MFA TOTP 全闭环
  · §13.3 自助导出 bundle
  · §13.2 离职匿名化 (5 个 case 全验)

────────────────────────────────────────
                                  50 / 50 PASS · 0 FAIL
```

<br>

> **每条断言都对应宪章 18 条的具体条款**. 这不是测试覆盖率, 是**承诺**.

---

<!-- _class: section-break -->

# 四、商业

---

# 种子客户试用: 60 分钟装机, 7 天判生死

<br>

| 阶段 | 时长 | 我方 / 客户 |
|---|---|---|
| Day 0 | 24h | NDA + 指派 Champion / IT / Steward |
| Day 1 | 60 min | IT 装机 + Champion 首登 + e2e 验收 50/50 |
| Day 2 | 60 min | 邀请 + Steward 任命 + Champion 跑首条议事 |
| Day 3-7 | 每天 30 min | 每人跑 1 条决议 + 第一条 pilot 自产 SOP |
| Day 7 | 1h 复盘 | Go / No-Go |

<br>

**4 个硬指标达标续签 V1 GA, 不达标全额退款 + 我方协助物理销毁数据**.

---

# 为什么是现在 (Why Now)

<br>

- **DeepSeek V3 (2025-12)** 把中文场景 reasoning 拉到 GPT-4 level — 第一次有可负担的 "中文母语 AI 副驾"
- **民企老板买教训 3 年了**: 钉钉装了, 飞书也装了, 但**决策质量没提高, 员工流失反而增加**
- **AI 欺诈 / AI 反控 已经是真问题** — 我们听过太多 "员工拿 AI 写周报" 的故事, 老板心里有数, 但找不到工具
- **数据归属焦虑攀升** — Lark 跨境 / 钉钉数据出境合规问题让民企开始要私有化

<br>

> **窗口期 12-18 个月**. 等大厂(钉钉/飞书)抄到 §13 员工尊严铁律时, 我们已经吃到 50 家头部种子.

---

# 为什么是我们 (Why Us)

<br>

- **18 条宪章**: 不是产品价值观, 是**不可妥协的工程约束**
  · §1 反 AI 欺诈 · §4 TTI 永不挂钩奖金 · §9 红区永远禁
  · §13 员工尊严 · §15 autonomy 守门 · §17 只服务民企
- **真私有化部署**: 客户机器, 客户 PG, 我方 0 残留
- **真 OSS 借力**: 底座社区维护, 我们只做思考层差异化
- **真在产品里写代码**: 不是 PPT 公司, 是 50/50 e2e PASS 的代码公司
- **创始人答辩**: Pilot 期间任何宪章疑问, **创始人直接答**, 不走客服

---

# Pilot 提议 (今天)

<br>

寻找 **首批 3 家友好客户**:

- 200-1000 人民企
- 互联网 / SaaS / 跨境 / 文娱 / 教育 / 消费 (任一)
- CEO / COO 是决策人, **他本人愿意 Day 1 跑议事室**

<br>

**我们提供**:
- 60 分钟装机 + 7 天 pilot 期
- 创始人本人对接, 30 min P0 响应
- DeepSeek 调用成本我方先垫
- **不达标全额退款**

<br>

**你提供**:
- 一个真实业务议题
- 一个 Champion + 3-5 试用员工
- 7 天后 1 小时复盘

---

<!-- _class: cover -->

# 联系

<br>

**微信**: `<wechat_id>`
**邮箱**: `<your_email>`
**仓库**: `<repo_url>` (私域)

<br>

> *Tandem 不是另一个 AI 工具. 是给民企老板和员工的一份 18 条宪章的物化形式.*
> *如果你信这 18 条, 我们一起跑 7 天.*
