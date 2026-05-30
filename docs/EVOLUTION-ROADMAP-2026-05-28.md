# Tandem 进化路线 v3 · Master Roadmap

**日期**: 2026-05-28 PT 23:55
**状态**: 待 Owner 拍板 14 项决策 → 启动 P0
**范围**: 整合本轮（5/28）所有讨论与校准的最终落地路线

**关联文档**:
- `docs/OPTIMIZATION-PLAN-2026-05-28.md` (v1 优化方案)
- `docs/OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md` (v2 交叉验证)
- 本文档 = v3 收口 + 决策清单

---

## 一、立项铁律（不可触碰，仅作背景）

> 1. 牛马（事半）每项**必可回溯 OKR**
> 2. 搭子 + 拿捏与 OKR **解耦**, **开放接入市面所有个人 AI**
> 3. Tandem **不重发明个人 AI**, 做组织级网关

---

## 二、当前现状基线 (v0, 已交付)

| 模块 | 状态 |
|---|---|
| 三柱命名 (事半/搭子/拿捏) | ✅ nav-modules 已落 |
| OKR / TTI / KPI 三层目标 | ✅ 完整 |
| 议事室 5 步 + 3+1 引擎 + 24h 否决窗 | ✅ 闭环 |
| 5min 智能日报 (KR check-in) | ✅ 已迁事半 + 移动 sticky CTA |
| TAF Router (6 场景 + 自动 fallback + LlmUsageLog) | ✅ 生产可用 |
| LlmPreference (tenant/user 双层 × 6 场景) | ✅ |
| TenantAiPolicy (allowPersonalAiTokens / 月配额 / 白名单) | ✅ |
| Budget Tracker (三层预算阻断) | ✅ |
| Persona Profile / 训练台 / 五阶段 / 代行边界 | ✅ V0 已建 |
| Skill Gateway 4 道闸代码框架 | ⚠️ 存在但未在 router 入口拦截 |
| Mobile 6 项优化 (IM 流式 / report sticky / OKR 锁定 ...) | ✅ |

---

## 三、进化分期总览

```
v0 (当前)           v1 (本轮目标, 6-8 周)              v2 (长期)
   │                    │                                │
   │  P0 → P0.5 → P1 → P2 → P3 → P4 → P5 → P6           │
   │  IA   3+1   主    学   单    合   三   长           │  BYOK
   │  落   抽    分    习   分    规   柱   尾           │  +模式
   │  位   层    身    中   身    强   闭   深           │  独立
   │              MVP   心   +    校   环   化           │  预算
   │                    MVP  模   准                     │  + 市面
   │                         式                          │  AI 真接入
   │                                                     │
1 天 0.5天 2-3天 3-5天 3-5天 1 周 1 周 持续              数月
```

---

## 四、Phase 详细

### P0 · IA 正本清源 (1 天) — 最低风险最快见效

**目标**: 用户进 Tandem 看到清晰三柱，认知不再混乱

**交付**:
- `nav-modules.ts` 三柱重排（按 CROSSCHECK § 5.3）
  - 搭子: 主分身工作台 / 我的分身 · 技能模式 / 个人 AI 接入 / 召唤台 + 配置
  - 拿捏: 我的分身（保留训练台）/ 自我画像 / 技能与成长 / 学习中心
  - 事半: 不变（5min 日报已 commit）
- 新增 stub 页（点开不 404，不实现具体功能）：
  - `/learning` `/learning/onboarding` `/learning/compliance` ...
  - `/portfolio` `/retros/me`
  - `/summon/external` `/summon/audit`
- 文档：把 v3 决策清单写进 `/admin/baseline` （或类似页）作 PR checklist

**依赖**: 无
**风险**: 低（仅 IA + stub）

---

### P0.5 · Decision Layer 抽层 (半天) — P1 前置

**目标**: 让 3+1 不再只服务议事室，符合 MANIFESTO §2

**交付**:
- 新建 `lib/decision-layer/`
  - `three-plus-one-engine.ts` (从 `lib/convergence/decision-engine.ts` 抽)
  - `memory-retriever.ts`
  - `adapters/`
    - `convergence.ts` (议事室)
    - `report.ts` (5min 日报推流前给 4 选项)
    - `tti.ts` (TTI 拆解 4 选项)
    - `weekly-retro.ts` (周回顾 4 选项)
    - `persona-brief.ts` (主分身 brief 推荐)
- `lib/convergence/decision-engine.ts` 改成 thin wrapper 引 decision-layer

**依赖**: 无（纯抽层）
**风险**: 低（行为不变，只换 import 路径）

---

### P1 · 主分身 brief MVP (2-3 天)

**目标**: `/persona` 改造成 AI-Native 主分身工作台

**交付**:
- `/persona` 主页改造
  - 复用 `WorkbenchAgentView` 聚合（6 类 Waiting/Running）
  - 套 LLM 流式播报（CompanyBrain 流式技术栈，scenario=`agentic`）
  - 主分身建议 = 走 P0.5 的 3+1（4 个推荐"先做哪一项"选项）
  - 默认私有标识（footer "仅你可见, Steward/Admin 后台无法检索"）
- 5 个技能模式入口（参数化 URL，不是新页）
  - `/persona?mode=design|pm|tech|marketing|strategy`
  - 切换时叠加 Skill Pack system prompt（来自 `/admin/launchpad` 已有 Expert）
- 首页 §1.5 改成单行入口卡（"张伟的分身有 3 件 Waiting · 2 件 Running →"）

**依赖**: P0 + P0.5
**风险**: 中（LLM 提示词需调；流式集成）

---

### P2 · 学习中心 MVP (3-5 天)

**目标**: 拿捏的能力输入端跑通

**交付**:
- `/learning` 主页（学习台 + 主分身 brief 提醒必修）
- `/learning/onboarding` 入职必修（先 1 个员工跑通 5 课）
- AI 课程生成器原型 `/api/learning/generate`
  - 输入: `/knowledge` 文档 ID 或 `/memories` SOP ID
  - 输出: 讲解（流式） + 5 题选择题 + 摘要卡
  - **课程内容是 Material 衍生包，不入 Memory**（MANIFESTO §7）
- 完成 → 自动推流 KR-onboarding 进度（事半闭环）

**依赖**: P0 + P0.5
**风险**: 中（生成质量需人工兜底）

---

### P3 · 单分身 + 技能模式 + Mode Proficiency (3-5 天)

**目标**: 让"主分身的 5 种模式"真有差异化

**交付**:
- `lib/persona/compose-prompt.ts` 拼装函数
  - input: persona + mode + okr_context + privacy_scope
  - output: system prompt
- `lib/persona/maturity.ts` Mode Proficiency 评分
  - 算法: 该模式样本量 × 公司认可度 × 时间衰减
  - 0-100 分，独立于 overallStage(1-5)
- `/persona/training` 训练台支持按模式标注（"这条样本属于设计模式 / 通用"）
- `/skills` 技能矩阵显示 Mode Proficiency 映射

**依赖**: P1
**风险**: 中（评分算法易受数据稀疏影响，先用启发式）

---

### P4 · 合规强校准 (1 周)

**目标**: Steward 治理闭环 + 隐性约束兑现

**交付**:
- Skill Gateway 4 道闸真接入 router 入口
  - `router.chatGuarded(req, gateway)` 包装
  - 调企业数据/工具时必经
  - 拦截原因写入 audit
- 红线类必修过期 → 自动锁权限（灰度，先 24h grace）
- `/settings/privacy` 一键擦除分身记忆链
- 训练数据 Opt-In 显式勾选页（每类样本来源独立开关）
- 主分身代办（ProxyAction）三区分级 + 24h 否决窗强制

**依赖**: P1 + P3
**风险**: 高（涉及权限系统改动，需小步验证）

---

### P5 · 三柱真闭环 (1 周)

**目标**: 事半 ↔ 搭子 ↔ 拿捏 数据双向打通

**交付**:
- 学习完成 → Mode Proficiency +N（拿捏 → 搭子）
- Mode Proficiency 高 → 主分身 brief 主动推荐"试试新挑战 KR"（搭子 → 事半）
- 季末打分时主分身参与回顾（搭子 → 事半 KPI）
- 个人 AI Capture 层 B-016 第一版（IDE 插件 stub）

**依赖**: P2 + P3 + P4
**风险**: 中（数据通路设计）

---

### P6 · 长尾深化 (持续, 可与 v2 并行)

- 我的代表作 (`/portfolio`)
- 我的复盘库 (`/retros/me`)
- 学习社区 (`/learning/community`)
- 主分身夜间 brief 自动生成 (cron)
- 9-Box 自动重新定位

---

### v2 · 长期 (3-6 个月)

- **BYOK**: 员工自带 API key（不消耗公司 token）
- **byPersonaMode**: 员工按模式独立配 provider
- **预算独立池**: central / persona / mode 三独立 bucket
- **市面 AI 真接入**: Cursor/Claude Code/ChatGPT IDE 插件 + 邮件 webhook + 文档 metadata
- **Skill Marketplace V2**: 跨租户 Skill 共享（脱敏 + K-匿名）

---

## 五、关键依赖图

```
P0 (IA)
 ├─→ P1 (主分身)
 │    ├─→ P3 (模式)
 │    │    └─→ P4 (合规) ──┐
 │    └─→ P5 (闭环) ←──────┤
 └─→ P2 (学习) ────────────┘

P0.5 (3+1 抽层) ──→ P1 / P2 / P5 都依赖
```

---

## 六、待 Owner 拍板的 14 项决策

> ⚠️ 这些是 **进入 P0 之前必须明确**的产品决定。我已用 ★ 标推荐项。

### A · 召唤组合（技能模式）的底座 Agent

- ☐ A1 ★ 复用 `/admin/launchpad` 已有 Expert + Skill Library，技能模式只是组合呈现层
- ☐ A2 单独建一组 ModeAgent schema

### B · 技能模式的 UI 呈现

- ☐ B1 ★ 同一 `/persona?mode=...` 参数切换（顶部 tab + system prompt 注入）
- ☐ B2 独立路由 `/persona/skills/design` 等（更重，但视觉独立）

### C · 学习中心课程来源

- ☐ C1 纯 AI 生成（极轻、可立即上线、需校验）
- ☐ C2 HR/Steward 手动建课（重、扩展慢）
- ☐ C3 ★ 混合（AI 起草 + 人工审核）

### D · 合规必修过期处置

- ☐ D1 ★ 分级（红线/合规锁权限；产品/流程仅提醒）
- ☐ D2 全部仅提醒（缓和）
- ☐ D3 全部锁权限（强硬）

### E · 培训 ↔ KPI 联动

- ☐ E1 ★ 必修不完成减分；选修完成加分；专项完成解锁晋升
- ☐ E2 完成必修加分（中性）
- ☐ E3 不影响 KPI

### F · 学习中心导航位置

- ☐ F1 ★ 拿捏的子分组（保持三柱清晰）
- ☐ F2 独立第 4 模块「学院」

### G · 主分身命名最终方案

- ☐ G1 ★ "主分身" + "技能模式" (设计模式/PM 模式/...)
- ☐ G2 "我的分身" + "专长能力"
- ☐ G3 其他

### H · 市面 AI 接入清单（首批）

- ☐ H1 ★ Claude Code / Cursor / ChatGPT / Notion AI / Kimi 五个
- ☐ H2 仅 Cursor + Claude Code（先做开发场景）
- ☐ H3 全开放，员工自报

### I · 3+1 在各处的呈现密度

- ☐ I1 ★ 默认折叠（只显推荐项 + "查看其他选项"），点开看 4 选项
- ☐ I2 完全展开（所有 4 选项平铺）—— UX 重
- ☐ I3 仅议事室展开，其他场景默认隐藏

### J · 是否启用 BYOK（员工自带 key）

- ☐ J1 v2 启用（v1 暂不做）★ 若 v1 成本可控
- ☐ J2 v1 P4 就启用（解决合规担忧"公司 key 泄漏到员工市面 AI"）
- ☐ J3 永不启用（强统一）

### K · 是否分技能模式独立 provider

- ☐ K1 v2 启用 `byPersonaMode` ★
- ☐ K2 v1 P3 就启用
- ☐ K3 不启用，所有模式共享 `persona_dialogue` 路由

### L · 预算独立池

- ☐ L1 v2 拆 central/persona/mode 三池 ★
- ☐ L2 v1 拆 central vs persona 两池
- ☐ L3 保持单池（现状）

### M · P0.5 (3+1 抽层) 是否立即启动

- ☐ M1 ★ 是，与 P0 并行（半天工作量）
- ☐ M2 推迟到 P1 前再做
- ☐ M3 不抽层，每个调用方各自处理

### N · 学习中心是否进入 V1 范围

- ☐ N1 ★ 是，作为 P2（拿捏的核心输入端）
- ☐ N2 推迟到 v2（聚焦 P1 主分身先）
- ☐ N3 仅做 stub（IA 占位，不做 MVP）

---

## 七、风险地图（top 8）

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| LLM 生成 brief / 课程内容质量不稳 | 高 | 中 | 输出可编辑；保留人工兜底；接 Steward 审计 |
| Mode Proficiency 算法不科学 | 中 | 中 | 先启发式（样本量 × 衰减）；后期接 360 反馈 |
| 合规锁权限误伤业务 | 中 | 高 | 灰度推进；红线类先 24h grace |
| 员工觉得"培训是负担"不愿用 | 高 | 高 | 强绑 Mode Proficiency，让"学习 = 模式升级" |
| 三柱重构破坏现有模块 | 中 | 高 | 路由全保旧路径；schema 0 改动 |
| Skill Gateway 加固后性能下降 | 中 | 中 | 闸门异步化；缓存 baseline 校验结果 |
| 3+1 通用化 UX 疲劳（每次都看 4 选项）| 高 | 中 | 默认折叠（决策 I）；仅议事室高决策强展开 |
| 24h 否决窗用户教育成本 | 中 | 中 | 首次代行强引导；提供"信任后默认绿区"选项 |

---

## 八、推荐执行节奏

### 周一（明天）
- Owner 拍板 14 项决策（建议批量同意 ★ 推荐项）
- Cascade 启动 **P0 + P0.5 并行**（1.5 天总工作量）

### 第 1 周
- P0 落位 → P0.5 抽层 → P1 启动

### 第 2-3 周
- P1 主分身 MVP → P2 学习中心 MVP

### 第 4-5 周
- P3 模式差异化 → P4 合规强校准

### 第 6-8 周
- P5 三柱闭环 → P6 长尾启动

### v2（M3-M6）
- BYOK / 模式独立 provider / 市面 AI 真接入

---

## 九、Owner 三种回复模板

**回复 1 · 全部同意 ★（最快）**:
> "全部按推荐执行, 启动 P0 + P0.5"

→ Cascade 立即开干，1.5 天后给 P0/P0.5 完成报告。

**回复 2 · 部分调整**:
> "A=A1, B=B2, C=C3, D=D1, E=E1, F=F1, G=G1, H=H1, I=I1, J=J3, K=K1, L=L1, M=M1, N=N2"

→ Cascade 按你选的执行；N=N2 意味着 P2 推迟。

**回复 3 · 先讨论某项**:
> "G 命名再聊一下" / "学习中心要不要 v1 做我有疑虑"

→ Cascade 针对性深入，其他可同时并行 P0。

---

**附录 · 三句宪法底线再次备忘**

> 1. 事半每项**必可回溯 OKR**
> 2. 搭子 + 拿捏与 OKR **解耦**, **开放接入市面所有个人 AI**
> 3. Tandem **不重发明个人 AI**, 做组织级网关

任何 P0-P6 任何决策，违反这三条 → 自动驳回。
