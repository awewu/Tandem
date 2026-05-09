# 拿捏 Enterprise — 产品需求文档 (PRD)

> 版本：v0.1（2026-05-07 草案）
> 作者：拿捏团队
> 状态：架构定稿，待 V1 MVP 排期

---

## 0. 一句话定位

**拿捏 Enterprise** 是一个 **OKR 牵引 + 群聊承载 + AI 分身代劳 + 公司基线管控** 的企业协作操作系统。让员工不再写日报、不再做 OKR 进度汇报；让管理者通过分身议事室对工作脉搏即时可视；让公司价值观以 prompt 形式注入每一次 AI 行为。

---

## 1. 愿景与目标

### 1.1 痛点

| 痛点 | 现状 | 拿捏的解法 |
|---|---|---|
| OKR 与日常脱节 | 季度初定，季末才看 | OKR 群 + 自动 Check-in 草稿 |
| 重复汇报 | 周报/日报/OKR 进度三遍写 | AI 分身从聊天/邮件/Git 自动汇总 |
| AI 失控风险 | 个人 AI 助理乱承诺、泄密 | 公司基线 + Drift 检测 + 行为审计 |
| 跨人接手成本高 | 群聊考古、文档散落 | OKR 原生群 + 议事室纪要自动归档 |
| 管理盲区 | 不知道员工实际堵在哪 | 健康度告警 + 议事室实时观察 |

### 1.2 北极星指标

> **每位活跃员工每周节省汇报时间 ≥ 60 分钟**，且 **OKR 周中 Check-in 达成率 ≥ 80%**

### 1.3 非目标

- ❌ 通用 IM（不和企微/飞书抢 1:1 闲聊）
- ❌ 全功能项目管理（不和 Jira/Linear 重叠）
- ❌ 不做"全自动决策" AI，永远人在回路

---

## 2. 系统架构总览

```
┌─────────────────────── 客户端 ───────────────────────────┐
│  拿捏 Desktop (Tauri/TS)   Web (Next.js)   Mobile (RN)   │
└──────────────────┬─────────────────────┬────────────────┘
                   │ WebSocket           │ HTTPS
                   ▼                     ▼
┌─────────────────── 网关层 ──────────────────────────────┐
│  API Gateway (NestJS)  WS Gateway  SSO (企微/飞书/SAML) │
└─────────┬──────────────────────────┬───────────────────┘
          ▼                          ▼
┌────────────── 业务服务层 (TypeScript/NestJS) ───────────┐
│  Identity   OKR    Chat   Meeting   Org   File   Audit  │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌────────── AI 编排层 (Python · circles-bot 内核) ────────┐
│  ┌────────────────────────────────────────────────────┐ │
│  │  Agent Runtime（主控制器 + 任务循环）              │ │
│  │  Skill Registry  ←  Memory Manager  ←  LLM Engine  │ │
│  └────────────────────────────────────────────────────┘ │
│  上层应用：                                             │
│  • Persona Engine（员工分身 → 多类 Agent 实例）         │
│  • Baseline Engine（公司价值观 prompt 注入 + 守门）     │
│  • Meeting Orchestrator（多分身议事，LangGraph 风格）   │
│  • OKR Auto-Updater（消息流 → KR Check-in 草稿）        │
│  • Daily Digest（自动日报）                             │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────── 存储与集成层 ────────────────────────────┐
│ Postgres  Redis  S3/MinIO  Vector DB(Qdrant)  Kafka     │
│ 适配器：企微 / 飞书 / 钉钉 / Tita / Jira / GitHub / 邮件│
└─────────────────────────────────────────────────────────┘
```

### 2.1 关键架构决策

| 决策 | 选型 | 理由 |
|---|---|---|
| **客户端协议** | WebSocket + HTTPS | 实时聊天 + REST 兜底 |
| **协作合并** | Yjs CRDT | OKR/文档多人编辑无冲突 |
| **业务服务** | NestJS + Prisma + Postgres | 拿捏前端 TS 同栈，团队上手快 |
| **AI 编排** | Python（circles-bot） | LLM 生态最完备，独立部署易扩缩 |
| **跨语言** | gRPC + Protobuf | NestJS ↔ Python，强类型契约 |
| **向量库** | Qdrant | 自托管、API 简洁、Rust 写性能好 |
| **事件总线** | Kafka / Redpanda | 聊天/Git/邮件事件流接入 |
| **多租户** | Schema-per-tenant + Row-level | 平衡隔离与运维成本 |
| **部署形态** | 私有部署优先 + SaaS 双轨 | 中国 OKR 数据敏感 |

---

## 3. AI 编排层 — circles-bot 内核详解

> 这一层是产品最核心的差异化。**全部基于 circles-bot 框架并扩展为多租户、多角色、多场景。**

### 3.1 目录结构（`/ai-runtime` 子项目）

```
ai-runtime/
├── core/                          ← circles-bot 主干（保留原结构）
│   ├── agent.py                   # Agent 主控制器（任务循环 + 计划生成）
│   ├── llm_engine.py              # LLM 抽象（OpenAI/Claude/DeepSeek/Ollama）
│   ├── memory_manager.py          # 多层记忆系统
│   ├── skill_registry.py          # Skill 注册中心
│   └── safety_kernel.py           # ★新增：安全内核（基线 + 委托级别 + 熔断）
│
├── skills/                        ← Skill 工具集
│   ├── base_skill.py
│   ├── exec_skill.py              # 命令执行（沙箱）
│   ├── file_skill.py              # 文件操作
│   ├── browser_skill.py           # 浏览器
│   ├── search_skill.py            # 网络搜索
│   ├── canvas_skill.py            # HTML 可视化
│   ├── agent_spawn_skill.py       # 子 Agent 创建
│   ├── todo_write_skill.py        # 待办管理
│   ├── ★ okr_skill.py             # 读写 OKR / 提交 Check-in
│   ├── ★ chat_skill.py            # 群聊读写
│   ├── ★ meeting_skill.py         # 议事室发言/总结
│   ├── ★ org_skill.py             # 组织架构查询
│   ├── ★ jira_skill.py            # Jira 状态
│   ├── ★ github_skill.py          # PR/commit 摘要
│   └── ★ email_skill.py           # 邮件读取
│
├── agents/                        ← Agent 类型
│   ├── general_agent.py           # 通用
│   ├── explore_agent.py           # 探索型
│   ├── verification_agent.py      # 验证型
│   ├── plan_agent.py              # 规划型
│   ├── code_review_agent.py       # 代码审查
│   ├── ★ persona_agent.py         # 员工分身 Agent
│   ├── ★ coordinator_agent.py     # 议事室协调 Agent
│   ├── ★ extractor_agent.py       # 消息→OKR 进度抽取 Agent
│   └── ★ baseline_guard_agent.py  # 基线守门 Agent
│
├── personas/                      ★ 新增：员工分身存储
│   ├── persona_loader.py          # 从画像生成 Agent 实例
│   ├── persona_builder.py         # 用历史聊天/邮件/OKR 建模
│   └── delegation_levels.py       # L0-L4 委托级别策略
│
├── baseline/                      ★ 新增：公司基线引擎
│   ├── baseline_tree.py           # Company → Dept → Project 三层 prompt 树
│   ├── injector.py                # system prompt 拼装
│   ├── drift_detector.py          # 第二 LLM 跑漂移检测
│   └── policies/                  # YAML 配置：价值观、红线、风格
│
├── orchestrators/                 ★ 新增：高层编排
│   ├── meeting_room.py            # 多分身议事
│   ├── okr_updater.py             # OKR 自动更新流
│   └── daily_digest.py            # 日报生成
│
├── system/                        ← 配置 + Prompt 模板
│   ├── config.yaml
│   ├── prompts/
│   │   ├── system_prompt.txt
│   │   ├── strategy_prompts.txt
│   │   └── instruction_prompts.txt
│   └── memory_storage/            # 持久化记忆（生产改 Postgres+Qdrant）
│
├── transport/                     ★ 新增：与 NestJS 通信
│   ├── grpc_server.py             # 暴露给业务层调用
│   └── event_consumer.py          # Kafka 消费消息流
│
├── utils/
│   ├── logger.py
│   ├── error_handler.py
│   ├── security_checker.py
│   ├── token_tracker.py
│   └── audit_logger.py            ★ 行为留痕
│
└── tests/
    ├── unit_tests/
    ├── integration_tests/
    └── e2e_tests/
```

### 3.2 核心模块（继承 circles-bot 设计）

#### 3.2.1 Agent 主控制器

```python
class Agent:
    """所有 Agent（通用 / 分身 / 协调）的基类"""
    def __init__(self, config: Config, persona: Persona | None = None):
        self.llm = LLMEngine(config)
        self.memory = MemoryManager(config)
        self.skill_registry = SkillRegistry()
        self.safety = SafetyKernel(persona)   # ★ 注入基线 + 委托
        self.todo_list = []

    async def execute(self, user_input: str) -> str:
        intent = await self.llm.analyze_intent(user_input)
        memories = await self.memory.retrieval(intent)
        skills = await self.skill_registry.search(intent)
        plan = await self.llm.generate_plan(intent, memories)

        while not plan.is_complete:
            action = await self.decide_next_action(plan)
            await self.safety.preflight(action)         # ★ 执行前过基线
            result = await self.execute_action(action)
            await self.safety.postflight(action, result) # ★ 留痕审计
            plan.update(result)
        return self.format_response(plan)
```

#### 3.2.2 Skill 基类与注册

```python
class BaseSkill(ABC):
    name: str
    description: str
    parameters: dict
    @abstractmethod
    async def execute(self, args: dict) -> dict: ...
    async def validate(self, args: dict) -> bool: ...

class SkillRegistry:
    """支持三种检索语法：
       - 关键词："贪吃蛇 HTML 可视化"
       - 精确选择：select:canvas,file
       - 必选+关键词：+canvas 游戏  """
```

#### 3.2.3 多层记忆系统

| 层 | 用途 | 存储 | 保留期 |
|---|---|---|---|
| `org_shared` | 公司知识/术语/历史决策 | Postgres + Qdrant | 永久 |
| `team_context` | 团队 OKR 背景 / 项目坑位 | Postgres + Qdrant | 项目周期 |
| `agent_experience` | 该分身做过的事、踩过的坑 | Postgres + Qdrant | 长期，按重要度衰减 |
| `local_context` | 当前会话 / 当次议事 | Redis | 24h TTL |

格式：`[type|priority] content` —— priority ≥ 8 自动晋升到长期。

#### 3.2.4 LLM 引擎

- 多 Provider：OpenAI / Claude / DeepSeek / Ollama / 国产
- 内置 system_prompt 见 §6.1
- `generate_plan(intent, memories)` 输出步骤化执行计划

#### 3.2.5 Agent Spawn

复用 circles-bot 的"是否要 spawn"判别：
- **不要 spawn**：读明确文件、查 2-3 个文件、写代码、调用 prompt skill
- **要 spawn**：跨多未知文件研究 / 对抗性审查 / 真并行子任务

---

## 4. 上层应用（拿捏独有）

### 4.1 Persona Engine — 员工 AI 分身

**画像构建**：从员工的 OKR、过往群聊、邮件、文档自动建模。

```yaml
persona:
  employee_id: zhang_san
  name: 张三
  traits: [技术细节型, 简洁, 不喜套话]
  knowledge_scopes:
    - okr: [my, my_team]
    - projects: [recommend_v2]
    - docs: [tech_design_*, meeting_notes_*]
  delegation_default: L1
  baseline_inheritance: [company, dept_product]
  forbidden_actions:
    - 代员工承诺日期
    - 公开未发布战略
```

**4 档委托级别**：

| 级别 | 描述 | 默认场景 |
|---|---|---|
| **L0 观察** | 只读群聊，给员工写摘要 | 新员工首月 |
| **L1 建议** | 私聊给员工草稿，员工一键发出 | 默认值 |
| **L2 跟进** | 代员工回"收到/我看一下"等低风险消息 | 老员工自选 |
| **L3 代办** | 代写 Check-in / 日报，事后审阅 | 高自主员工 |
| **L4 全权** | 代员工开会、做决策（仅 demo / 销售场景） | 一般禁用 |

**水印与审计**：每条 AI 分身消息显示 🤖 + 员工头像；每条审计记录含 prompt + baseline 版本 + LLM 模型 + token。

**熔断**：管理员一键停某员工 / 整公司分身。员工自己也可一键关闭。

### 4.2 Baseline Engine — 公司价值观注入

**三层 prompt 树**：

```
Company Baseline                    （CEO / 法务 / HR 维护）
├─ 价值观：客户第一 / 拥抱变化 / 数据驱动
├─ 红线：不承诺时间 / 不泄露未发布战略 / 不政治表态
├─ 表达风格：简洁、有数据支撑、不夸大
├─ Department Baseline (产品)        （部门负责人维护）
│   └─ 决策框架：用户价值 > ROI > 工程成本
└─ Project Baseline (X 项目)         （项目经理维护）
    └─ 关键事实：截止日 / 关键人 / 已知坑
```

**注入点**：每次 LLM 调用前，`system = company + dept + project + persona + skill_specific`。

**Drift 检测**：第二 LLM 跑 baseline 检查，违反时：
- **轻**：自动改写后再发
- **中**：标红警告 + 让员工人工确认
- **重**：拦截 + 升级管理员

**版本与审计**：每条 baseline 变更要审批；每次 AI 行为留痕的"baseline 版本号"可回溯。

### 4.3 Meeting Orchestrator — 多分身议事室

```
场景：经理在 OKR 卡片上 @ 5 个 KR Owner 的 AI 分身

┌─ 议事室：Q1 留存 KR 进展评估 ──────────────────┐
│ [系统] 议题：本周 KR 进展和阻塞                 │
│ 🤖 张三分身：留存升至 38%，瓶颈在新手引导       │
│ 🤖 李四分身：A/B 基础设施就绪，等样本           │
│ 🤖 王五分身：UX 招聘阻塞，HR 已介入             │
│ 🤖 协调员：建议本周聚焦"新手引导优化"           │
│ [系统] 草稿待人类经理批准并发到正式群           │
└─────────────────────────────────────────────────┘
```

**实现要点**：
- LangGraph 风格回合制：`议题 → 各分身发言 → 协调员总结 → 人类裁决`
- 每个分身从自己的 persona + baseline + RAG 上下文取材，**绝不跨权限读取他人数据**
- 流式同步给真人观察，真人随时打断
- 议事结束自动产出：会议纪要 + OKR 进度更新 + 行动项

### 4.4 OKR Auto-Updater — 消息流自动汇报

```
聊天/邮件/Git/Jira  →  Kafka 事件流
                          ▼
                  Extractor Agent  ←  公司基线 + 抽取规则
                          ▼
                  候选 Check-in 草稿
                          ▼
   ┌──────────────────────────────────────────┐
   │ 每天 18:00 推给员工"今日自动汇总"        │
   │ • KR1 留存：38% (+2%)  来源：周二群聊讨论 │
   │ • KR2 推荐：80% (+0%)  无变化            │
   │ • 障碍：UX 招聘卡住    来源：HR 邮件      │
   │ [一键发布 Check-in] [修改] [忽略]         │
   └──────────────────────────────────────────┘
```

**抽取规则**（YAML 可配）：
- 提及 KR 关键词 + 数字 → 候选进度
- "搞定 / 完成 / 上线" → 候选 Initiative 状态变更
- "卡住 / 阻塞 / 等" → 候选 confidence 降级

### 4.5 Daily Digest — 自动日报

每天 18:00 汇总当天的：Check-in、群聊重点、Git/PR、Jira 状态变更，让员工 30 秒审阅一次发给上级。

---

## 5. 业务模块（NestJS 服务）

### 5.1 模块清单

| 模块 | 职责 | 依赖 AI 编排层 |
|---|---|---|
| **Identity** | 多租户、SSO、RBAC/ABAC | — |
| **Org** | 部门/团队/人员、矩阵汇报 | — |
| **OKR** | 周期/O/KR/Initiative/Check-in/Score/Health | OKR Auto-Updater |
| **Chat** | 群聊、@、回复、引用 OKR 卡 | Persona Engine |
| **Meeting** | 议事室创建/记录/纪要 | Meeting Orchestrator |
| **File** | 附件、版本、权限 | — |
| **Audit** | 全行为审计（含 AI 行为） | 所有 |
| **Integration** | 企微/飞书/Tita/Jira/GitHub 适配器 | — |

### 5.2 群类型

- **1:1** 私聊（默认不被分身扫描，可手动开启）
- **部门群** 自动按 Org 创建
- **项目群** 手动创建
- **OKR 群** 每个 Objective 自动创建，关联 KR 卡片
- **议事室** 临时，含分身

### 5.3 OKR 数据模型（继承拿捏现有 + 联机扩展）

保留：`Cycle / Objective / KeyResult / Initiative / CheckIn / Comment / Activity / Score / Watcher`，扩展：
- `tenant_id` 多租户隔离
- `crdt_doc_id` 关联 Yjs 文档
- `auto_update_source[]` 来源追踪（哪条聊天、哪个 PR）
- `persona_authored: boolean` 是否分身代写

---

## 6. 安全与治理

### 6.1 系统 Prompt（继承 circles-bot 风格）

```
你是一个全能力的执行 Agent，可以搜索、分析、编辑文件和运行命令。
完整完成交给你的任务，如实报告结果。

# 任务执行规则
- 开始任何多步任务前，先一两句说你打算怎么做
- 正确优先于快，完整优先于花哨
- 不确定就用工具确认，不要猜测
- 发现用户请求基于误解时要指出来

# 动作安全
- 破坏性操作必须先告知用户
- 用户授权是本次动作级，不代表长期授权

# 工具使用
- 多个调用互无依赖时，必须在同一条消息里并发发起
- 长驻进程必须传 background: true
- 不要轻易下沉到子 Agent

# 拿捏 Enterprise 专属
- 严格遵守注入的 Company / Department / Project Baseline
- 涉及他人 OKR / 群聊时严格按 RBAC 校验
- 所有对外发言带 🤖 水印；不能伪装成真人
- 写 Check-in / 提交日报前必须给员工人工确认机会
```

### 6.2 安全检查器

```python
class SecurityChecker:
    DANGEROUS_COMMANDS = ["rm -rf", "sudo", "mkfs", "dd if=/dev/zero", ":(){:|:&};:"]
    RESTRICTED_PATHS = ["/etc/shadow", "C:\\Windows\\System32\\config", ".git", ".env"]

    async def check_command(self, cmd: str): ...
    async def check_file_access(self, path: str): ...
    async def check_data_scope(self, persona, target):     # ★ 新增
        """分身能否读 target 数据"""
    async def check_baseline_compliance(self, output):     # ★ 新增
        """输出是否违反基线"""
```

### 6.3 数据隔离

- **租户级**：Postgres schema + 网关强制 `tenant_id` 上下文
- **员工级**：每个 Persona 仅能访问其授权 scope（OKR、群聊、文档）
- **私聊保护**：1:1 私聊默认不被任何分身索引，员工可一对一开启

### 6.4 行为审计

每条 AI 行为记录：`{tenant, persona, action, prompt, baseline_version, llm_model, tokens, output, drift_flags, timestamp}`，留 7 年（合规要求）。

### 6.5 数据归属与离职

- 群聊/OKR/文档 → 归公司
- 员工 Persona 画像 + 私聊 → 归员工
- 离职时：公司数据保留，Persona 可导出/删除（GDPR 合规）

---

## 7. 性能与扩展性

| 优化点 | 实现 | 目标 |
|---|---|---|
| **并发工具调用** | `asyncio.gather` | 单回合多 skill 并行 |
| **记忆剪枝** | 定期淘汰 priority<3 且 30天未访问 | Vector DB 控本 |
| **工具缓存** | 常用 skill 预加载，LRU | 首调用 <100ms |
| **Prompt 压缩** | LongLLMLingua + summary | -30% token |
| **批量处理** | 多消息合并喂 Extractor | 高吞吐 |
| **AI 编排层水平扩展** | 无状态 + Redis 队列 + Kafka 分区 | 万人租户可扩 |
| **数据库分片** | 按 tenant_id hash | 大客户独立 schema |

---

## 8. 设计模式映射

| 模式 | 应用 |
|---|---|
| **策略** | Skill 选择（按意图动态组合） |
| **工厂** | Agent 创建（按 type 实例化 persona / coordinator / extractor） |
| **单例** | LLM Engine、Skill Registry |
| **观察者** | 任务状态、议事流式同步 UI |
| **责任链** | Safety Kernel：preflight → baseline → drift → audit |
| **适配器** | LLM Provider、外部 IM/OKR/Issue 系统 |
| **模板方法** | BaseSkill / BaseAgent 标准生命周期 |
| **CQRS** | 写走 NestJS、读走 GraphQL/搜索 |

---

## 9. 路线图

### 9.1 V0（已完成）— 拿捏单机版
- ✅ Tauri 桌面 + 14 模块（OKR/群聊雏形/任务/知识等）
- ✅ OKR 完整：Initiative/Comment/Activity/Score/Health/Cadence/Templates
- ✅ Tita 双向适配

### 9.2 V1 MVP（3–4 个月）— 联机地基
- 后端骨架：NestJS + Postgres + Redis + WebSocket
- AI 编排层骨架：circles-bot 内核 + gRPC + 基础 5 个 Skill
- 多租户 + 企微 SSO + 组织架构同步
- 桌面端联机：Yjs CRDT + 离线优先
- 群聊（不含 AI 分身）+ OKR 多人协作
- **里程碑**：3 个内部用户跑 1 个 OKR 周期

### 9.3 V2（再 2–3 个月）— AI 注入
- Persona Engine（L0/L1）
- Baseline Engine + Drift 检测
- OKR Auto-Updater（草稿 + 一键确认）
- Daily Digest
- **里程碑**：周报场景对比，员工节省 ≥30 分钟/周

### 9.4 V3（再 3 个月）— 议事室与生态
- Meeting Orchestrator（多分身议事）
- Drift 监控大盘
- 完整集成：飞书/钉钉/Jira/GitHub/邮件
- 委托级别 L2/L3
- **里程碑**：第一个外部客户付费

### 9.5 V4 — 平台化
- Persona SDK（行业版分身：销售 / HR / 客服）
- 国际化 + Slack/Teams 适配
- L4 委托（特定 demo 场景）

---

## 10. 当前代码迁移路径

| 当前 | 目标 | 动作 |
|---|---|---|
| `lib/store.ts` (zustand) | 本地缓存 + Yjs 同步层 | 抽 `lib/sync/` 包，store 接 sync 钩子 |
| `lib/tita-adapter.ts` | 接 NestJS Integration 服务 | 保留本地 import/export，加 server push |
| `app/okr/*` | 接 WebSocket + REST | `useOKRStore` 改 hook 形式订阅服务端事件 |
| `lib/okr/health.ts` 等 | 拷贝到 Python AI 编排层 | 健康度规则也用于自动告警发到群 |
| 新增 `ai-runtime/` | 独立 Python 子项目 | 见 §3.1 |
| 新增 `nanie-server/` | NestJS + Prisma | 业务服务层 |

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 员工抵触被 AI 观察 | 推不动 | 三件事：透明（行为可见可追溯）+ 获益（少写日报）+ 可控（一键关闭/导出/删除） |
| AI 误汇报误承诺 | 信任崩塌 | L1 默认；所有外发都先经员工确认；Drift 检测兜底 |
| 数据合规（中国） | 法律风险 | 私有部署优先；模型可换国产 |
| LLM 成本失控 | 商业不可持续 | Token 预算/员工/月 + 缓存 + 国产模型兜底 |
| 多租户串数据 | P0 事故 | 网关强制注入 tenant_id；每个 query 必校验；定期红蓝对抗 |
| circles-bot 单体扩展瓶颈 | 性能上不去 | 无状态 + 队列化；Coordinator 单独跑独立池 |

---

## 12. 团队与排期建议

| 角色 | 人数 | 职责 |
|---|---|---|
| 后端 (Node/NestJS) | 2 | API 网关、业务服务 |
| AI 工程 (Python) | 2 | circles-bot 内核 + Persona/Baseline |
| 前端 (TS/React) | 2 | 桌面端联机 + Web |
| SRE / DBA | 1 | K8s + Postgres + Kafka |
| PM / 设计 | 1 | 用户研究、原型 |
| **合计** | **8 人** | V1 MVP 4 个月 |

---

## 13. 验收标准（V1 出闸条件）

- ✅ 3 租户，100 用户并发，P95 消息延迟 < 200ms
- ✅ OKR/群聊/组织架构 CRUD 全通
- ✅ 离线 30 分钟后联网自动合并无丢失
- ✅ 企微 SSO + SCIM 同步通过
- ✅ AI 编排层至少跑通 5 个 Skill：file/exec/search/okr/chat
- ✅ Persona L0 跑通：每日给 1 名员工生成议事室摘要
- ✅ 全行为审计 7 年留存 + 一键导出
- ✅ 安全：通过红蓝队渗透 + 多租户串数据自动化测试

---

## 14. 拿捏 IM 平台（自研企业微信级整套架构）

> **核心立场**：不调用企业微信任何 API，自研一整套企业级即时通讯 + 协同 OA 平台。让拿捏成为企业的"操作系统中枢"，而不是某个 SaaS 工具的插件。

### 14.1 为什么要自研

| 项 | 调用企微 | 自研 IM |
|---|---|---|
| 数据归属 | 在腾讯 | 全部在企业自己 |
| 合规存档 | 受限（接口限流、字段不全）| 完整原始消息 + 媒体可法务调阅 |
| AI 注入深度 | 表层 webhook | 协议层注入 Persona / Baseline / Drift |
| 协议演进 | 受腾讯节奏 | 自主，可端到端优化（如分身水印） |
| 商务模式 | 被腾讯锁住客户 | 客户全在拿捏，可独立续费 |
| 海外可用 | 不行 | 原生支持多区域 |

### 14.2 整体架构

```
┌────────────────────── 客户端层 ─────────────────────────────────┐
│ Desktop(Tauri) · Web · iOS(Swift) · Android(Kotlin) · 命令行    │
└─────────────────────┬──────────────────────────────────────────┘
                      │ IM 二进制协议（TCP+TLS / WSS）
                      ▼
┌──────────────────── 接入层 (Connection Tier) ───────────────────┐
│  IM Gateway 集群（Go / Erlang OTP）                              │
│  • 长连接管理（百万级 / 单机 50K 连接）                          │
│  • 心跳 / 重连 / 多端同步                                         │
│  • 协议解码 + 鉴权（JWT + 设备指纹）                              │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌──────────────── 路由层 (Logic Tier) ────────────────────────────┐
│  Message Router · Presence Service · Push Service               │
│         ↕ Redis Cluster（在线状态 / 路由表）                     │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌──────────────── 业务层 (Business Tier · NestJS) ────────────────┐
│ Conversation · Message Store · Group · Broadcast · Approval     │
│ Email · Doc · Calendar · Attendance · Compliance · App Store    │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌──────────── AI 注入层（贴在协议路径上）─────────────────────────┐
│ Persona Inject · Baseline Drift · OKR Extractor · Auto Digest   │
│     （引用 §4 的 circles-bot 内核，对每条消息做实时旁路处理）   │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌──────────── 存储层 ─────────────────────────────────────────────┐
│ Postgres(主)  Cassandra/TiDB(消息)  Redis(状态)                 │
│ MinIO/S3(媒体)  Qdrant(向量)  Kafka(事件)  Elasticsearch(搜索)  │
└─────────────────────────────────────────────────────────────────┘

旁路：APNs / FCM / VoIP Push / SMS / Email Gateway · 媒体服务（SFU/MCU）
```

### 14.3 协议设计（拿捏 IM Protocol，简称 NIP）

| 维度 | 选型 |
|---|---|
| **传输** | TLS 1.3 over TCP（原生客户端）+ WSS（Web） |
| **编码** | Protobuf v3，可选 MessagePack |
| **会话模型** | `cmd + seq + ack`，支持流式与多路复用 |
| **核心命令** | `LOGIN / LOGOUT / SEND / SYNC / READ / TYPING / PRESENCE / RTC_SIGNAL` |
| **消息 ID** | Snowflake 64-bit（ts + dc + seq），全局唯一可排序 |
| **可靠性** | 客户端 ACK + 服务端持久化后再回 ACK，重发幂等 |
| **多端同步** | 服务端按 `(user, device)` 维度维护已读位 + 未拉取队列 |
| **离线消息** | 7 天级别队列（可配置），合规存档永久 |
| **加密** | TLS 传输层 + 可选 E2EE 群（Signal Protocol 改造）；合规模式强制非 E2EE |

### 14.4 核心模块清单（17 项）

#### 14.4.1 会话与消息

| 子模块 | 功能 |
|---|---|
| **1:1 私聊** | 文本/图片/文件/音视频/位置/名片/链接卡 |
| **群聊** | 上限 2000 人；管理员、@全员、禁言、入群审批、群公告 |
| **超级群** | 万人广播群（只读 + 评论） |
| **频道/订阅号** | 公司向员工的单向广播 |
| **消息状态** | 已发送/已送达/已读回执，支持撤回（2分钟内）+ 编辑 |
| **消息类型扩展** | 卡片、模板、AI 卡（含 🤖 水印）、OKR 卡、任务卡、投票、问卷 |

#### 14.4.2 组织与通讯录

| 子模块 | 功能 |
|---|---|
| **企业通讯录** | 部门树 + 人员 + 矩阵汇报 + 头衔/工号/分机 |
| **外部联系人** | 内部员工与外部客户/供应商的独立通讯录（不与个人微信打通） |
| **群组通讯录** | 跨部门项目组、虚拟团队 |
| **联系人导入** | SCIM、CSV、API；离职自动转移 |

#### 14.4.3 音视频会议

| 子模块 | 功能 |
|---|---|
| **1:1 通话** | WebRTC P2P 优先，Failover 到 SFU |
| **多人会议** | SFU（mediasoup / janus）支持百人 |
| **直播/网络研讨会** | 万人级 RTMP/HLS |
| **屏幕共享** | 含批注、远程控制（可关） |
| **会议室白板** | Yjs 协同，可粘贴 OKR/任务卡 |
| **AI 实时纪要** | ASR → LLM 摘要 → 自动写 Check-in |
| **录制** | 服务端录制，合规级别可强制 |

#### 14.4.4 协同 OA

| 子模块 | 功能 |
|---|---|
| **审批流** | 流程编辑器（请假/报销/合同/采购）；可触发分身写工单摘要 |
| **企业邮箱** | SMTP/IMAP 网关，统一收件箱与 IM 并列 |
| **协同文档** | 类飞书文档，Yjs CRDT；含表格/思维导图/白板 |
| **日历** | 会议室预订、日程共享、外部 ICS |
| **考勤打卡** | GPS / WiFi / 拍照打卡，月报自动生成 |
| **任务/工作台** | 复用 §拿捏 Tasks，向下兼容 |

#### 14.4.5 平台与扩展

| 子模块 | 功能 |
|---|---|
| **企业应用市场** | 自营 + 第三方，OAuth 接入 |
| **机器人** | Webhook + Bot SDK，可消费消息触发回复 |
| **小程序框架** | 类微信小程序（自有 DSL），运行在 Tauri/Web/Mobile WebView |
| **开放 API** | OAuth2 + 限流；REST + WebSocket + Webhook |

### 14.5 关键技术挑战与对策

| 挑战 | 对策 |
|---|---|
| **百万长连接** | Erlang/OTP 或 Go + epoll；按 `tenant_hash` 分片网关；接入层水平扩展 |
| **消息存储洪峰** | Cassandra/TiDB 按 `conv_id + msg_id` 分片；冷热分层（7 天热在 SSD，超期入对象存储） |
| **多端已读同步** | 每端维护 `last_seen_seq`；服务端按 user 聚合；同步差量 |
| **推送送达率** | iOS APNs / Android FCM + 厂商通道（华为/小米/OPPO）+ Tauri 桌面通知；多通道兜底 |
| **音视频质量** | SFU 自建（mediasoup）+ 边缘节点；可对接公有云 SFU 兜底 |
| **群聊扩散写** | 大群用 Fan-out-on-Read；小群用 Fan-out-on-Write；阈值切换 |
| **撤回/编辑一致性** | 消息全局唯一 ID + 操作日志覆盖；客户端重放 |
| **跨设备会话同步** | 服务端 `Conversation` 列表唯一来源；客户端订阅增量 |
| **法务合规存档** | 强制企业版关闭 E2EE；存档服务订阅 Kafka 持久化 7 年 |
| **国产化** | 信创版可换龙芯/麒麟；SM2/SM4 算法可选；模型可全切国产 |

### 14.6 AI 注入到 IM 协议的方式（差异化关键）

每条消息从客户端到达 Message Router 之后，**走旁路异步管道**给 AI 编排层，不阻塞主链路：

```
客户端 → Gateway → Router ──同步── 持久化 + Fan-out
                       │
                       └──异步── Kafka topic: messages.in
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ Persona Pipeline    │
                              │  ├─ 摘要给 owner    │
                              │  ├─ OKR 提取候选    │
                              │  ├─ Baseline Drift  │
                              │  └─ 审计留痕        │
                              └─────────────────────┘
                                       │
                              候选输出 → 系统消息（草稿/告警）
```

**注入点举例**：
- 群里有人 @ 张三的分身 → Persona Engine 接管，按委托级别决定回复 / 给草稿
- 群里讨论 KR 数字 → OKR Extractor 抽取候选 Check-in
- 员工说"我保证下周三上线" → Baseline Drift 检测命中"不承诺时间"红线 → 私聊提醒员工

### 14.7 客户端要做的事

| 平台 | 技术 | 复杂度 |
|---|---|---|
| **Desktop** | Tauri（已有），加 IM SDK + WebRTC | ★★ |
| **Web** | Next.js（已有），加 IM SDK + WebRTC | ★★ |
| **iOS** | Swift + UIKit/SwiftUI；NIP SDK 二进制；CallKit/PushKit | ★★★★ |
| **Android** | Kotlin + Jetpack；NIP SDK；FCM + 厂商推送 | ★★★★ |
| **CLI** | Rust，运维 / 机器人场景 | ★ |

**SDK 设计**：
- 统一 `NimClient` 抽象（多端实现一致接口）
- 提供 `Conversation / Message / Group / Call / Auth` 五大领域对象
- 内置离线队列、重连、消息漫游、本地全文索引

### 14.8 数据模型核心实体

```sql
-- 会话
Conversation(id, type[1to1|group|channel], tenant_id, members[], created_at)

-- 消息（按 conv_id 分片）
Message(id, conv_id, sender_id, type, payload_json, reply_to,
        edited_at, recalled_at, ai_authored_by_persona,
        baseline_version, drift_flags, created_at)

-- 群组
Group(id, name, owner_id, member_count, max_members,
      announcement, mute_all, join_policy, ai_listeners[])

-- 已读位
ReadCursor(user_id, device_id, conv_id, last_seen_msg_id, updated_at)

-- 在线状态
Presence(user_id, status[online|away|busy|offline],
         devices[], last_active_at)  ← Redis

-- 通话
Call(id, conv_id, type[audio|video|screen],
     participants[], started_at, ended_at, recording_url)

-- 审批单
Approval(id, type, applicant_id, fields_json, status,
         flow_steps[], current_node, created_at)
```

### 14.9 安全与合规

- **传输**：TLS 1.3 + 证书钉扎；移动端启动网络证书检查
- **存储**：消息字段级加密（AES-256-GCM），密钥按租户隔离
- **审计**：所有消息（含 AI 行为）落 Compliance topic，保 7 年
- **权限**：消息可见性 = 会话成员 ∩ RBAC ∩ 数据脱敏规则
- **风控**：发文敏感词过滤 + 涉密 OCR 检测（图片/PDF）
- **熔断**：管理员可一键禁言、撤群、停号
- **法律**：等保三级、SOC2、GDPR、ISO 27001 路线

### 14.10 性能目标（V2 出闸条件）

| 指标 | 目标 |
|---|---|
| 单租户并发连接 | 10 万 |
| 单消息端到端延迟 | P95 < 200ms（同区域） |
| 群消息扩散 1000 人 | < 1s 完成 90% 送达 |
| 1:1 音视频建联 | < 1.5s |
| 历史消息漫游 | 1000 条 < 800ms |
| 客户端冷启动 | < 1.2s（桌面）/ < 800ms（移动） |
| 消息丢失率 | < 1ppm（百万分之一） |

### 14.11 落地路线（IM 子项目）

| 阶段 | 周期 | 内容 |
|---|---|---|
| **IM-α** | 6 周 | 仅 1:1 + 群聊文本 + 拿捏桌面端联通；最小可用 |
| **IM-β** | 6 周 | 离线推送、撤回、@、文件、消息搜索；通讯录与 Org 打通 |
| **IM-γ** | 8 周 | 1:1/小型群组音视频；移动端 SDK（iOS+Android） |
| **IM-δ** | 8 周 | 直播、协同文档、审批流、邮箱网关 |
| **IM-ε** | 持续 | AI 注入、机器人 SDK、应用市场 |

> **资源建议**：IM 核心 4 人（接入层 1 + 业务 2 + 移动 1），音视频 1 人，OA 应用 2 人。**单 IM 模块约 12 人月起**。

### 14.12 与 §3-§7 既有架构的整合点

| §3 模块 | IM 平台关系 |
|---|---|
| Skill `chat_skill.py` | 通过 NIP API 收发，覆盖率 100% |
| Skill `meeting_skill.py` | 与 14.4.3 RTC 接通，自动加入会议拉摘要 |
| Persona Engine | 每个分身在 IM 内是一个有 🤖 水印的特殊 user_id，受 Group ai_listeners 列表管控 |
| Baseline Drift | 在 14.6 的旁路 pipeline 拦截 / 标红 |
| OKR Auto-Updater | 直接消费 IM 的 `messages.in` Kafka topic |
| 拿捏 OKR 群 | 每个 Objective 自动 `Conversation(type=group, ai_listeners=[owner_persona])` |

### 14.13 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| **自研 IM 工程量大** | 拖慢 V1 | IM-α 严格控范围，仅文本聊天，6 周内端到端打通 |
| **音视频质量难** | 用户体验崩 | 一期对接公有云 SFU（声网/即构）兜底，自建 SFU 二期 |
| **移动端推送难** | 国内厂商通道复杂 | 引入 JPush/getui 等聚合平台兜底 |
| **合规存档容量爆炸** | 成本失控 | 媒体冷存（S3 Glacier 等价物）+ 文本压缩；按租户计费 |
| **客户已有企微** | 切换阻力 | 提供企微历史消息一次性导入工具（用户自己授权） |

---

## 附录 A：决策记录

- **A1（2026-05-07）**：AI 编排层选 Python（circles-bot 现有架构成熟），通过 gRPC 暴露给 NestJS。理由：LLM 生态、成熟 Agent 框架。
- **A2**：默认 L1 委托。理由：员工接受度优先于自动化深度。
- **A3**：私有部署优先。理由：中国大客户 OKR 数据敏感度高。
- **A4**：保留拿捏桌面端作为重客户端。理由：本地算力（Ollama 摘要）+ 离线办公差异化。

---

## 附录 B：术语表

| 术语 | 含义 |
|---|---|
| **Persona** | 员工的 AI 分身实例（含画像、知识、边界） |
| **Baseline** | 公司/部门/项目级 prompt 与策略约束 |
| **Drift** | AI 输出偏离基线的程度（轻/中/重三级） |
| **Delegation Level** | 员工授予分身的权限级别 (L0–L4) |
| **议事室** | 多 Persona + 真人混编的临时会议会话 |
| **Check-in** | KR 进度更新（含成就/障碍/下一步） |
| **Cadence** | OKR Check-in 节奏（周/双周/月） |
| **Skill** | 可注册的工具能力（继承 BaseSkill） |

---

> **下一步行动**：等待 GO 决定 → 起 `nanie-server/` 与 `ai-runtime/` 骨架 → 跑通 V1 第一条端到端链路（员工 A 在桌面端建 OKR → 服务端落库 → 员工 B 实时看到 → AI 分身 L0 摘要推送）。
