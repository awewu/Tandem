# 拿捏 Persona 进化机制设计 — 中央赋能 × 自我进化的混合架构

> 配套：`PRD.md` · `OKR-EXPERIENCE.md` · `SUPPLEMENT-TEAMS-COWORK.md`
> 版本：v0.1（2026-05-07）
> 目的：定义每个员工 AI 分身如何在"中央平台赋能 + 自我学习"的双引擎下持续进化，借鉴 **Hermes** 既有机制 + **circles-bot** 框架，形成拿捏独家"联邦化分身进化"（Federated Persona Evolution，FPE）。

---

## 0. 核心命题

> **每个分身既是中央平台的延伸，又是员工自己的成长伙伴。**
>
> - **中央赋能**：公司沉淀的经验、基线、最佳实践、技能升级 → 自动下发给每个分身
> - **自我进化**：每次对话、每条反馈、每个 OKR 周期 → 分身自我学习 → 个性化沉淀
> - **反哺中央**：个体分身的高价值学习 → 经验萃取 → 回流中央 → 再赋能全体

形成 **闭环 + 双向 + 联邦** 的进化飞轮。

---

## 1. 借鉴 Hermes 既有机制

### 1.1 Hermes 已经提供的"骨架"

拿捏桌面端目前通过 `lib/hermes-api.ts` 接入 Hermes 运行时，提供了以下能力：

| Hermes 能力 | 文件 | 在拿捏中的位置 |
|---|---|---|
| **Skills Registry** | `app/skills/page.tsx` + Hermes CLI | 可注册、检索、热加载工具 |
| **Agents** | `app/agents/page.tsx` | 多类型 Agent（探索/验证/规划等） |
| **Workflows DAG** | `app/workflows/page.tsx` | 节点式可视化编排 |
| **Memories** | `app/memories/page.tsx` | 显式/隐式记忆条目 |
| **Knowledge** | `app/knowledge/page.tsx` | 文件夹式知识库 |
| **MCP** | `app/mcp/page.tsx` | 标准协议挂第三方工具 |
| **Tasks / Cron** | `app/tasks/page.tsx` + `api/cron` | 任务调度 |
| **Logs** | `app/logs/page.tsx` | 全行为日志 |
| **Status / Health** | `api/status` + `api/health` | 系统脉搏 |
| **Streaming chat** | `api/stream` | LLM 流式响应 |

### 1.2 拿捏 Persona 直接复用 Hermes 的部分

| Hermes 原件 | Persona 复用方式 |
|---|---|
| **Skills Registry** | Persona 的"技能集"是该 Registry 的子集 + 个人扩展 |
| **Workflows** | Persona 学到的成功流程沉淀为本地 Workflow 模板 |
| **Memories** | Persona Memory = 员工显式记忆 + 隐式行为画像 |
| **Knowledge** | 公司 Knowledge → 全员共享；员工个人 Knowledge → 私人 |
| **Agents** | Persona 是一个"长生命周期 Agent"，使用 Spawn 机制召唤子 Agent |
| **MCP** | Persona 通过 MCP 安全调用第三方工具（沙箱） |
| **Cron** | 定时进化任务（每日/每周）由 Cron 触发 |
| **Logs** | 进化轨迹全留痕，可回放、回滚、审计 |

### 1.3 拿捏在 Hermes 之上要新增的部分

| 新增模块 | 作用 |
|---|---|
| **Persona Profile** | 个人画像（性格/偏好/边界/委托级别） |
| **Empowerment Channel** | 接收中央下发的 baseline / skill / template 更新 |
| **Self-Evolution Loop** | 本地学习闭环（反馈 → 更新 → 验证） |
| **Distillation Pipeline** | 个体经验 → 群体智慧的萃取流水线 |
| **Drift & Safety Kernel** | 进化期间防漂移、防偏见、防隐私泄露 |
| **Persona Time Machine** | 进化版本管理与回滚 |

---

## 2. FPE — 联邦化分身进化的三层结构

```
┌──────────────────────────────────────────────────────────────────┐
│                     Org Layer（组织层）                          │
│  • Company Baseline（价值观/红线/风格）                          │
│  • Skill Library（已认证的可复用技能）                            │
│  • Best-Practice Templates（OKR/沟通/决策模板）                   │
│  • Distilled Patterns（去标识的群体智慧）                         │
└──────────────┬─────────────────────────────────┬────────────────┘
               │ 下行赋能                         ▲ 上行萃取
               ▼                                  │
┌──────────────────────────────────────────────────────────────────┐
│                     Department Layer（部门层）                   │
│  • Dept Baseline（专业框架/术语/惯例）                           │
│  • Dept Skill Pack（专业工具组合）                                │
│  • Peer Insights（同侪的成功模式，匿名）                          │
└──────────────┬─────────────────────────────────┬────────────────┘
               │                                  │
               ▼                                  │
┌──────────────────────────────────────────────────────────────────┐
│                     Personal Layer（个体层）                     │
│  • Personal Memory（个人事实/偏好）                              │
│  • Persona Skills（自定义/试验技能）                              │
│  • Interaction Log（交互轨迹）                                   │
│  • Owner Feedback（员工的修正/赞同信号）                          │
└──────────────────────────────────────────────────────────────────┘
```

**核心特性**：
- **下行**：上层向下层赋能，每层都注入上层 prompt + skills + 数据
- **上行**：下层向上层贡献，但**先去标识 + 经审核**才能进入上层
- **隔离**：员工私域永远不被上层"看见"，只贡献"模式"不贡献"内容"

---

## 3. 双引擎：中央赋能 + 自我进化

### 3.1 中央赋能引擎（Central Empowerment Engine）

**触发**：HR/管理员主动发布 / 定时调度（每周日 23:00 等）。

**赋能内容**：

| 类型 | 来源 | 推送频率 | 影响范围 |
|---|---|---|---|
| **Baseline 更新** | 法务/HR | 即时 | 全员立即生效 |
| **新认证 Skill** | Skill Maintainer | 每周 | 全员自动加载 |
| **OKR 模板** | OKR Champion | 每季 | 推荐入模板库 |
| **Pattern 包** | 数据团队 | 每月 | 默认开启，可关闭 |
| **公司知识** | Wiki 编辑 | 实时 | 全员检索可见 |
| **训练 Corpus** | 模型团队 | 每季 | 影响下次微调 |
| **Persona Hotfix** | 监管告警 | 即时 | 紧急熔断/修补 |

**推送通道**：
- Empowerment Channel（基于 Kafka topic `personas.empower`）
- 客户端订阅 + 服务端拉取双保险
- 每次更新有 manifest，分身可选择性应用 + 灰度

### 3.2 自我进化引擎（Self-Evolution Engine）

**触发器**：每次交互、每个反馈、每个 OKR 周期。

**5 类学习信号**：

| 信号 | 来源 | 学习什么 |
|---|---|---|
| **直接反馈** | 员工点赞/修改/驳回分身回复 | 当前回答的好/坏 → 偏好向量 |
| **间接反馈** | 草稿被采纳率、点击率、修改幅度 | 隐式偏好 |
| **结果反馈** | OKR 是否达成 / Check-in 是否被认可 | 长期决策质量 |
| **同侪反馈** | 协作者评价该分身的协作表现 | 协作风格 |
| **Drift 信号** | Baseline Drift 检测器报警 | 边界守护 |

**5 步进化循环**：

```
   ┌──────────────────────────────────────────────────────┐
   │ ① 收集（log 每次交互 + 反馈 + 结果）                 │
   ▼                                                      │
   ② 萃取（聚类 + 模式识别）                               │
   ▼                                                      │
   ③ 候选（生成"可能改进"的 Persona Patch 草稿）           │
   ▼                                                      │
   ④ 验证（影子运行 / A/B / 员工试用确认）                 │
   ▼                                                      │
   ⑤ 应用（写入 Persona Profile + 留版本可回滚）           │
                                                          │
                ↑ 触发下一轮 ─────────────────────────────┘
```

**进化粒度**：
- **Hot path（毫秒）**：在线偏好更新（如"这位员工倾向用"我们"而非"我"）
- **Cold path（小时/天）**：离线萃取，生成 Patch 候选
- **Cycle path（周/季）**：周期级技能升级、Wiki 摘录沉淀

### 3.3 双引擎冲突仲裁

中央下发 vs 个体偏好可能冲突。**仲裁规则**：

| 维度 | 中央优先 | 个体优先 |
|---|---|---|
| **价值观/红线** | ✅ | ❌ |
| **法律合规** | ✅ | ❌ |
| **公司术语统一** | ✅ | ❌ |
| **个人语气** | ❌ | ✅ |
| **专业偏好（"用 Python 不用 Go"）** | ❌ | ✅ |
| **审美/格式** | ❌ | ✅ |
| **隐私（联系人/家事）** | ❌ | ✅ |

**实现**：分层 prompt 拼接 + 冲突检测器，当个体 Patch 撞中央红线时拦截并提示员工"这条偏好与公司基线冲突，是否…"。

---

## 4. 经验从个体到群体的"萃取流水线"

> 既要让每个分身从同侪学习，又要绝对保护员工隐私。

### 4.1 萃取四阶段

```
原始交互（PII 完整）
    ↓ 阶段一：本地脱敏（去名字/邮箱/客户/项目代号）
    ↓
脱敏样本（只在该员工设备/分区）
    ↓ 阶段二：聚合阈值（同一模式至少 N 个员工出现才上报）
    ↓
群体候选模式
    ↓ 阶段三：人工 + AI 双审（HR + Pattern Reviewer）
    ↓
认证模式
    ↓ 阶段四：发布到 Skill Library / Pattern Pack
    ↓
全员下行赋能
```

### 4.2 萃取的 6 类产物

| 产物 | 例 |
|---|---|
| **Skill 候选** | "处理客户退款异议的 5 步流程" |
| **Prompt 优化** | "周报开头用'本周三件事'比'本周工作'采纳率高 23%" |
| **OKR 模板** | "销售 Q1 北极星 KR 通常是这 3 个组合" |
| **沟通话术** | "拒绝跨部门请求时这 4 句话不冒犯" |
| **决策框架** | "面对 P0 故障：先回滚再排查，比并行处理快 40%" |
| **反模式警告** | "周五下午发紧急任务，被推回率高" |

### 4.3 隐私保护四道墙

1. **本地脱敏**：永不上传含 PII 的原文
2. **K-匿名阈值**：≥ N（默认 5）员工出现的模式才进入群体候选
3. **差分隐私**：聚合统计加噪
4. **员工选择性退出**：每位员工可关闭"我的数据贡献到群体智慧"

---

## 5. Hermes 机制如何具体赋能 Persona 进化

### 5.1 Skills Registry → Persona Skill Graft

**机制**：
- 每个 Persona 有自己的 `installed_skills[]`（中央下发 + 个人选装）
- 中央每周发布"认证 Skill 包"，员工可一键安装
- Persona 可在沙箱里**试用未认证 Skill**（标 `experimental`），表现好就上报候选
- Skill 升级有版本号，老版本 1 周内可回滚

**对应 Hermes 现有**：复用 `app/skills/page.tsx` 的注册中心 + 增加"per-persona installed set"和"per-org library"两层。

### 5.2 Workflows → 成功流程自动沉淀

**机制**：
- Persona 完成一个高分任务后，自动产出"任务回放"
- 回放经反思 Agent 提炼出可复用步骤 → 候选 Workflow
- 员工确认后，存入个人 Workflow 库
- 跨员工高频出现的 Workflow → 萃取流水线 → 候选公司模板

**对应 Hermes 现有**：`/workflows` 页扩展为"个人 / 团队 / 公司"三层。

### 5.3 Memory Layers → 分层记忆继承

```
Persona Memory 结构：

Memory(persona)
├─ inherited:
│   ├─ org_baseline(version=v23, read-only)
│   ├─ dept_facts(version=v8, read-only)
│   └─ company_wiki_index(real-time)
├─ personal:
│   ├─ owner_facts（员工告诉过分身的事实）
│   ├─ owner_preferences（行为推断的偏好）
│   ├─ interaction_episodes（重要对话片段）
│   └─ feedback_signals（反馈历史）
└─ working:
    ├─ current_session（当前对话）
    └─ scratchpad（临时计算）
```

**对应 Hermes 现有**：`app/memories/page.tsx` 的多层模型 + 增加"inherited"层。

### 5.4 MCP → 安全自实验

- Persona 想试用新工具时通过 MCP 沙箱调用
- 沙箱限制：不能写入主存储、不能发外部消息、不能调用 destructive command
- 实验结果由 Drift Kernel 评估，通过则升级为常规权限

### 5.5 Cron → 定时进化任务

| Cron Job | 频率 | 任务 |
|---|---|---|
| `persona.daily.reflect` | 每晚 23:00 | 当日交互回顾、更新偏好向量 |
| `persona.weekly.distill` | 每周日 22:00 | 一周 episodes → Pattern 候选 |
| `persona.cycle.review` | OKR 周期末 | 复盘 + 能力画像更新 |
| `central.empower.push` | 每周日 23:00 | 推送中央更新 |
| `org.distill.aggregate` | 每月 1 号 | 全员 Patterns → 群体候选 |

### 5.6 Logs → 进化可观测

每条进化动作都进 Logs：`(persona_id, change_type, source_signal, before, after, applied_at, rolled_back?)`，员工和 HR 都能查。

---

## 6. Persona 数据模型扩展

```sql
Persona(
  id, employee_id, tenant_id,
  -- 静态画像
  name, avatar, traits[], delegation_level,
  baseline_inheritance[],   -- ['company:v23', 'dept:product:v8']
  -- 动态状态
  installed_skills[],       -- 含版本号
  installed_workflows[],
  preferences_vector,       -- 嵌入向量
  forbidden_actions[],
  -- 评分与画像
  trust_score,              -- 员工对其的信任分（0-1）
  capability_profile,       -- 各领域能力画像
  drift_score,              -- 距 baseline 漂移度
  -- 版本
  version,                  -- Persona Schema 版本
  history_id,               -- 时间机器指针
  created_at, updated_at
)

PersonaPatch(
  id, persona_id,
  patch_type,               -- preference | skill | workflow | memory
  source_signal,            -- direct_feedback | distilled | central_push
  diff_json,
  status,                   -- candidate | validating | applied | rolled_back
  applied_at, rolled_back_at,
  created_at
)

EmpowermentRelease(
  id, tenant_id,
  release_type,             -- baseline | skill | template | pattern_pack
  payload_uri,              -- S3 path
  manifest_json,
  rollout_strategy,         -- immediate | canary | scheduled
  affected_personas[],
  published_at
)

DistillationCandidate(
  id, tenant_id,
  pattern_type,
  anonymized_payload,
  contributor_count,        -- K-匿名 K 值
  confidence_score,
  status,                   -- pending_review | approved | rejected
  reviewed_by, reviewed_at
)

EvolutionLog(
  id, persona_id,
  action,                   -- patch_applied | skill_installed | rolled_back
  metadata_json,
  occurred_at
)
```

---

## 7. 治理与安全

### 7.1 防漂移（Drift Guard）

- 每次 Patch 应用后跑 Drift Detector
- 若 drift_score 超阈值 → 自动回滚 + 告警
- 月度 Persona 体检：所有分身按 baseline 跑回归测试集

### 7.2 防偏见放大

- 萃取流水线第三阶段强制人工审核
- 模式来源若高度集中于单一群体（如同部门同性别）→ 标记"潜在偏见"
- 每季度发布 Bias Audit Report

### 7.3 防隐私泄露

- 4 道墙（§4.3）
- 员工可在 `/settings` 一键导出/删除自己的 Persona Memory
- 离职：Persona Memory 跟员工走，公司只保留聚合贡献

### 7.4 防"AI 反客为主"

- Persona 永远不能未经员工确认就修改自己的"价值观/红线层"
- 关键决策类 Patch 强制需要员工确认
- 每周一员工收到"上周 Persona 学到了 N 件事"摘要，可选择回滚

### 7.5 版本管理与回滚

- Persona 每次 Patch 应用都有快照，30 天可回滚
- 重大 Baseline 变更允许员工延迟接受（最多 7 天）
- 提供 **Persona Time Machine** UI，员工可回看任意时刻的"我"

---

## 8. 进化路线图

| 阶段 | 周期 | 能力 |
|---|---|---|
| **PE-α** | 4 周 | 单一 Persona / 仅个人偏好向量 / 中央 Baseline 单向下推 |
| **PE-β** | 6 周 | 多层 Memory 继承 / Skill Graft / 反馈循环 |
| **PE-γ** | 8 周 | Distillation Pipeline / K-匿名 / Pattern Library |
| **PE-δ** | 6 周 | Persona Time Machine / Drift Guard 完整版 |
| **PE-ε** | 持续 | 行业 Persona SDK / 跨租户匿名贡献池（可选） |

**与 PRD 路线图映射**：
- PE-α/β 在 PRD V2 内
- PE-γ 在 PRD V3 内
- PE-δ 在 PRD V3 末
- PE-ε 在 PRD V4

---

## 9. 关键技术实现要点

### 9.1 偏好向量与个性化

- 每个 Persona 维护一个偏好向量（256-d 嵌入）
- 每次反馈微调向量（学习率 0.01–0.05）
- 调用 LLM 时把向量序列化为 prompt 片段（"用户偏好：A>B>C"）

### 9.2 影子运行与 A/B

- Patch 应用前先在影子分身上跑同样 prompt，对比新旧输出
- 关键 Patch 走 A/B：新版本对 10% 流量灰度 7 天
- 灰度期间任何 Drift 报警自动停灰

### 9.3 模型微调与蒸馏（可选高级）

- 季度从全员高质量交互蒸馏一个"组织 Persona LoRA"
- 个体 Persona 在调用基模型时叠加自己的微 LoRA + 组织 LoRA
- 推理时融合，训练时离线

### 9.4 跨租户匿名贡献池（远期）

- 类似 Linux 内核的"上游" pattern pool
- 多个企业自愿贡献去标识模式
- 反哺所有参与企业（拿捏成为"分身进化操作系统"）

---

## 10. 三个具象场景

### 10.1 新员工 Onboarding（中央赋能主导）

**Day 1**：HR 发起 → 自动从公司模板生成 `张三的分身 v0`
- 继承：公司 Baseline + 产品部 Baseline + Onboarding Skill 包
- Memory：公司 Wiki + 部门历史决策摘要
- 委托级别：L0（仅观察 + 摘要）

**Week 2–4**：分身陪员工跑通"新员工 7 天计划"
- 每天记录员工反馈与偏好
- 自动注入"该员工偏好 Slack 风格、不喜冗长邮件"等

**Month 3**：分身已建立稳定个性
- 委托级别可升 L1（建议草稿）
- 萃取流水线开始接收该员工的去标识模式

### 10.2 资深员工的 Persona 升级（自我进化主导）

**周三 16:00**：李四给客户写报价单。分身建议用模板 A，李四改用模板 B 完成。
- 反馈信号：草稿被改写 60% 内容
- 当晚 23:00 离线萃取：发现"李四在金额>X 时偏好 B 模板"
- 候选 Patch 生成

**周四 09:00**：分身在 Daily Coach 提示"我注意到您偏好 B 模板，是否更新偏好？"
- 李四确认 → 写入 personal preferences
- 后续金额>X 的报价直接用 B

**月度萃取**：发现 5+ 销售都有类似偏好 → 候选 Pattern 进入审核 → 认证后下发"高金额报价用 B 模板"。

### 10.3 中央 Hotfix（紧急赋能）

**周二 14:00**：法务发现公司基线漏了一条"不主动提及竞品名"。
- 法务在 `/baseline` 改条款 → 发布 Hotfix
- Empowerment Channel 即时推送到所有 Persona
- 5 分钟内全员生效，所有进行中草稿被重新 baseline 检查
- 当天 18:00 全员收到摘要："本周基线更新 1 条，影响您草稿 3 条已重写"

---

## 11. 与现有 PRD 章节的整合点

| 现有章节 | 增补内容 |
|---|---|
| `PRD §3.1 ai-runtime/` | 在 `personas/` 增加 `evolution_engine.py` `empowerment_channel.py` `distillation_pipeline.py` |
| `PRD §4.1 Persona Engine` | 引入 4 档委托 → 加上"信任分 trust_score"动态调级 |
| `PRD §4.2 Baseline Engine` | 加 Hotfix 推送通道与员工通知 |
| `OKR-EXPERIENCE §2.5 进化阶段` | 把 Persona 进化纳入 OKR 周期反馈 |
| `OKR-EXPERIENCE §6 22 个 Agent` | 新增 `Distill Agent` `Patch Validator Agent` `Evolution Coach Agent` |
| `SUPPLEMENT §1.10 拿捏 Flow` | 进化任务调度也走 Flow（与 Cron 互补） |

---

## 12. 关键决策点（待你拍板）

| 决策 | 我的倾向 | 理由 |
|---|---|---|
| **个体偏好 vs 中央基线冲突时谁优先？** | 红线类中央优先；风格类个体优先 | 平衡治理与体验 |
| **跨员工 Pattern 萃取的 K-匿名 K 值？** | 默认 5，敏感场景 10 | 隐私与统计有效性平衡 |
| **Persona Memory 是否端到端加密？** | 私聊 / 个人 facts 强制 E2EE；工作上下文走服务端可见 | 合规与功能平衡 |
| **离职带走 vs 公司保留？** | 个人 Persona 带走，公司保留聚合贡献 | 员工权利 + 公司知识沉淀 |
| **是否允许 Persona 间 P2P 学习？** | 否，必须经过中央萃取审核 | 防偏见放大与失控 |
| **跨租户匿名池是否启用？** | 默认关闭，企业可订阅 | 商业差异化 + 增量收入 |

---

## 13. 一句话总结

> **拿捏的 Persona 进化机制 = Hermes 的"骨架"（Skills/Memory/Workflows/MCP/Cron）× circles-bot 的"反射弧"（Agent/Skill/Memory）× FPE 的"双引擎"（中央赋能 ↑↓ 自我进化）。**
>
> **结果**：每个员工拥有一个**比自己更懂公司、又始终是自己**的 AI 分身；公司拥有一个**会自我升级**的智能层；行业拥有一个可贡献可受益的"分身联邦"。

---

## 附录：与三大方法论的对应

| 方法论 | 拿捏的实现 |
|---|---|
| **联邦学习 (Federated Learning)** | 个体设备本地训练偏好，只上传梯度 / 模式，不上传数据 |
| **课程学习 (Curriculum Learning)** | Onboarding 7 天 / 季度 / 年度有清晰的能力升级曲线 |
| **强化学习 from 反馈** | 直接/间接/结果三类反馈作为 reward 信号 |
| **知识蒸馏** | 个体 Persona 的成功路径 → 蒸馏为公司级 Skill / Pattern |
| **A/B 测试** | 重大 Patch 灰度发布 |
| **版本控制 + 回滚** | Persona 每次进化是一个"提交"，可 git-blame，可 revert |

> 本质上，**拿捏让"组织即一个会进化的群体智能"成为工程现实。**

---

## 附录：2026-05-29 实现快照

> 本节是 v0.1 哲学论述的代码落地锚点. 详见 `docs/IMPL-NOTES-2026-05-29.md` 模块 3 + 4.

### 单分身 + 5 技能模式 (取代"主分身/子分身"早期思路)

**核心铁律 (MANIFESTO §13.2)**: 每个员工**只有一个分身**, 无论调哪个技能模式, 名字 / 总 stage / 风格画像 / 边界跨模式一致.

**5 模式标准清单** (`lib/persona/skill-modes.ts`):

| 模式 ID | emoji | 适用场景 |
|---|---|---|
| `design` | 🎨 | 视觉/交互设计 |
| `pm` | 📦 | PRD / 路线图 / 调研 |
| `tech` | 🛠️ | 架构 / 代码 / CR |
| `marketing` | 📣 | 文案 / 活动 / 品牌 |
| `strategy` | 🎯 | OKR / 决策 / 复盘 |

切换模式 = URL `?mode=X` 参数. 模式只换 system prompt segment + recommended tools, **不切实体**.

### Mode Proficiency 算法 v0 (`lib/persona/maturity.ts`)

与 §6 Persona 数据模型扩展中的 `overallStage` (nascent → maturing → mature → master) **双层独立, 不混淆**.

```
proficiency = base × decay + bonus

  base = log10(samples + 1) × 20         # 100 样本 = 40 分, 饱和增长
  decay = exp(-recentDays / 90)          # 90 天半衰
  bonus = endorsements × 3 + okrContrib × 5

→ 1-5 ★ 映射: ≥80=5★ / ≥60=4★ / ≥40=3★ / ≥20=2★ / <20=1★
```

5 模式各自独立 proficiency, 跨模式不传染.

### 新增模式的治理 (P6 待定)

提议 → Decision Card 走议事室 → Steward 评审是否真"通用模式" → 写入 `skill-modes.ts` 灰度发布.
