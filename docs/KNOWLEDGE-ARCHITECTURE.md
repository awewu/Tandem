# 四层知识架构 · Knowledge Architecture

> **「Material 描述事情如何, Memory 描述我们认为应该如何.」**
>
> 版本: v1.0
> 最后更新: 2026-05
> 性质: 牛马搭子知识管理与公司基线训练核心架构文档

---

## 摘要 (TL;DR)

牛马搭子拒绝主流 SaaS 的单层 Wiki 模式. 用**四层架构**严格区分「事实」与「规范」, 让企业记忆既丰富又不污染.

```
Layer 1: ORIGINS    (录像/原始消息)        ← 仅当事人可见
              ↓ 自动
Layer 2: MATERIALS  (纪要/Decision Card)    ← 全员可写可查
              ↓ 严肃签批 ⚖️
Layer 3: MEMORY     (SOP/案例/红线/价值观)   ← 签批后入, 全员引用
              ↓ 季度训练 🧠
Layer 4: BASELINE   (公司大模型权重 + RAG)
```

**核心原则**:

- Material ≠ Memory (描述性 vs 规范性)
- Memory 必须经签批进入 (防基线漂移)
- Knowledge Steward 是独立角色 (防腐败)
- Memory 不基于时间自动归档 (人工评估)

---

## 第一章: 为什么需要四层

### 1.1 单层 Wiki 的失败模式

主流 SaaS (Confluence / Notion / 飞书 Wiki / 钉钉知识) 的通病:

| 问题 | 表现 |
|---|---|
| 信噪比低 | 一个搜索关键词出 100 个结果, 不知哪个是公司"正式" |
| 过时不察 | 三年前的 SOP 还在搜索结果里, 没人删 |
| 主观注入失控 | 任何员工都能"建立 SOP", 没人审 |
| AI 训练污染 | 把所有 Wiki 喂给 AI, AI 学到一堆陈年错误 |
| 离职带走知识 | 员工的"个人笔记"消失, 公司知识断层 |
| 文档与执行脱节 | 文档说一套, 实际做另一套 |

### 1.2 四层架构的解决思路

```
事实层 (Material): 描述「事情发生了什么」 — 鼓励多
规范层 (Memory):   描述「我们认为应该怎样」 — 严肃少
模型层 (Baseline): 公司基因, 季度训练
```

**信息密度递减, 严肃度递增**: 越往上的层, 数量越少但权威越高.

### 1.3 与产品功能的对应

| 层 | 牛马搭子产品功能 |
|---|---|
| Origins | 腾讯会议录像 / IM 原始消息 / 文件原件 |
| Materials | 议事室纪要 / Decision Card / Check-in 报告 / 复盘 |
| Memory | SOP 库 / 案例库 / 红线库 / 价值观库 / 经验库 |
| Baseline | 公司基线模型 (RAG + 微调) / 拿捏老板 / 推演引擎 |

---

## 第二章: Layer 1 · ORIGINS (起源层)

### 2.1 定义

ORIGINS 是**未经处理的原始数据**:

- 腾讯会议录像 / 字幕
- IM 原始消息流
- 上传的文件原件 (PDF / Word / 图片)
- 邮件原文
- 屏幕录制 / 操作日志

### 2.2 访问规则

| 维度 | 规则 |
|---|---|
| **可见性** | 仅当事人可见 (录像 → 参会者; 消息 → 对话双方) |
| **检索** | 不暴露给全员搜索 |
| **保留期** | 默认 90 天, 客户可配置 30-365 天 |
| **加密** | AES-256, 客户可指定 KMS |
| **导出** | 员工本人可导出自己参与部分 |
| **法务调取** | 需双重签批 (法务 + Steward) |

### 2.3 用途

ORIGINS 主要作为**MATERIALS 的溯源**:

- Decision Card 链接到原始会议录像
- Material 中可点"查看原始上下文"
- 法律纠纷时可调取证

### 2.4 禁忌

- ❌ 把 ORIGINS 直接喂给 AI 训练
- ❌ 把 ORIGINS 暴露给全员搜索
- ❌ 老板看下属的 ORIGINS (合规审计除外)
- ❌ 跨部门"扒料"

---

## 第三章: Layer 2 · MATERIALS (材料层)

### 3.1 定义

MATERIALS 是**经过结构化整理的事实记录**:

- 议事室会议纪要
- Decision Card (决议卡)
- Check-in 周报 / 月报
- 述职材料 / 季度复盘
- 项目过程文档
- 培训笔记 / 学习记录
- 1:1 会议笔记

### 3.2 访问规则

| 维度 | 规则 |
|---|---|
| **可见性** | 默认全员可见 (含 CEO) |
| **可标密** | 个别敏感 Material 可设权限 |
| **可写** | 任何员工可创建 |
| **保留期** | 永久保留 (除非员工离职 + 合规要求删除) |
| **检索** | 全文检索 + 向量检索 |

### 3.3 与 ORIGINS 的链接

每条 Material 必须有溯源指针:

```yaml
material_id: M-2026-Q2-9981
title: "Q2 用户增长策略评审 - 会议纪要"
type: meeting_minutes
created_at: 2026-04-15
participants: [李四, 王五, 张三]

origins:
  - meeting_recording: REC-8821
  - chat_thread: T-7723

decision_cards:
  - DC-7901
  - DC-7902

action_items:
  - owner: 李四
    task: "调整灰度策略文档"
    due: 2026-04-17

embedding_status: indexed_for_rag
```

### 3.4 自动化生成

Material 大部分**由 AI 自动生成**, 员工 review:

- 议事室结束 → 自动生成纪要 + Decision Card
- 1:1 结束 → 自动生成 Action Items
- 周末自动 → Check-in 草稿
- 季末自动 → 复盘 + 述职材料

→ 员工只需 review + 签字, 不需写文档.

### 3.5 在产品中的位置

```
事半功倍 (中央 AI):
  • 议事室生成的纪要 / DC → MATERIALS
  • Check-in 草稿 → MATERIALS
  • 述职材料 → MATERIALS

拿捏老板 (个体 AI):
  • 1:1 笔记 → MATERIALS
  • 个人复盘 → MATERIALS
  • 学习记录 → MATERIALS
```

### 3.6 反例

- ❌ Material 直接当 SOP 用 (要先签批升级到 Memory)
- ❌ 老 Material 自动归档消失 (永久保留)
- ❌ 把 Material 视为最终决策依据 (只是事实记录, 不是规范)

---

## 第四章: Layer 3 · MEMORY (记忆层)

### 4.1 定义

MEMORY 是**经过签批的规范层**, 描述"公司认为应该怎么做":

| 类型 | 描述 | 示例 |
|---|---|---|
| **SOP** | 标准操作流程 | "新员工入职流程" / "退款审批 SOP" |
| **案例库** | 经典决策案例 (含成败) | "2025 Q3 危机公关案例" |
| **红线库** | 不可触碰底线 | "不能向客户承诺退款率 X" |
| **价值观库** | 文化原则 | "客户第一" / "诚信无欺" |
| **经验库** | 教训 + 智慧 | "为什么我们不做强制分布" |

### 4.2 访问规则

| 维度 | 规则 |
|---|---|
| **可见性** | 全员可见 (默认) |
| **可写** | ❌ 员工不能直接写 Memory |
| **进入路径** | 必须经过 Material → Memory 升级签批 |
| **修订** | 必须经过签批工作流 |
| **归档** | 不基于时间自动归档, 由 Steward 季度评估 |

### 4.3 与拿捏老板和议事室的关系

```
议事室决策时:
  • A 选项 = SOP 检索 (来自 MEMORY)
  • C 选项 = 历史案例 (来自 MEMORY)

拿捏老板教学时:
  • 引用红线库 (MEMORY)
  • 引用价值观库 (MEMORY)

→ MEMORY 是 AI 给员工的"公司宪法"
```

### 4.4 与基线模型的关系

```
MEMORY 不直接 fine-tune 基线模型. 而是:

MEMORY → Embedding → 向量库 (RAG)
       ↘
        季度选择高质量条目 → 加入基线 fine-tune 训练集
```

V1: 全部 RAG. V2: 加入轻量 LoRA fine-tune.

---

## 第五章: 升级签批门 (Material → Memory)

### 5.1 谁可发起

- 任何员工可发起"建议把 Material A 升级为 Memory"
- 系统自动检测 (高频被引用的 Material 自动建议升级)
- Knowledge Steward 主动提议

### 5.2 签批流程

```
[员工或系统] 发起升级申请
        ↓
[直接业务 Leader] 第一签 (业务合理性)
        ↓
[Knowledge Steward] 第二签 (体系合规性)
        ↓
[CEO 或授权人] 第三签 (战略一致性, 可跳过非战略级)
        ↓
[公示 7 天] 全员可异议
        ↓
[正式入 Memory] 进入向量库
```

### 5.3 签批要点

Steward 审核时必检:

| 检查项 | 通过标准 |
|---|---|
| 与现有 Memory 矛盾? | 无 (或显式标注替代关系) |
| 来源可信? | Material 已被多次引用 / 来自可靠 Origins |
| 普适性 | 不只是"某个项目"特例 |
| 与价值观一致? | 不违反 MANIFESTO |
| 时效性 | 不会很快过时 |
| 独立性 | 不与现有红线冲突 |

### 5.4 紧急通道

危机情况 (公关事件 / 重大事故) 后:
- 24h 紧急通道
- 直接 CEO + Steward 双签
- 7 天内补完整公示

### 5.5 失败案例

签批失败的 Material 留在 Material 层, 不消失:

- 标注"曾建议升级, 未通过"
- 列原因, 供未来参考
- Material 价值不减

---

## 第六章: 降级机制 (Memory → 归档)

### 6.1 不基于时间

❌ "三年前的 Memory 自动归档" → **错**. Memory 太重要不能机器决定.

✅ Steward 季度评估 → 主动决定哪些应归档.

### 6.2 评估触发

| 信号 | 含义 |
|---|---|
| Memory 长期未被引用 (> 6 月) | 可能已失效 |
| Memory 反复被员工质疑 | 与现实脱节 |
| 多个 Decision Card 选择"D 原创" 而非引用 SOP | SOP 不再适用 |
| 业务模式重大变化 | 老 Memory 集体过期 |

### 6.3 归档流程

```
[Steward 评估]
  ↓
[召开归档评审]
  • 业务相关 Leader 列席
  • CEO 或授权人最终决策
  ↓
[决定: 修订 / 归档 / 保留]
  ↓
[归档 = 标记 inactive, 不删除]
  ↓
[公示 + 通知所有相关方]
```

### 6.4 归档不等于删除

```
Memory 状态:
  active   → 正在生效, 全员引用
  revising → 修订中, 暂停引用
  inactive → 归档, 仍可查询作历史参考
  deprecated → 已被新 Memory 替代, 强烈不推荐

→ 历史 Memory 保留, 不消失
```

---

## 第七章: Knowledge Steward (知识治理官)

### 7.1 角色定义

Knowledge Steward 是产品 RBAC 中的**独立角色**, 职责:

- 审核 Material → Memory 升级申请
- 主持 Memory 季度评估
- 维护 SOP / 案例 / 红线体系健康度
- 监控基线漂移, 触发预警
- 主持年初战略部署 Workshop
- 培训员工知识贡献意识

### 7.2 不可由这些角色兼任

| 不可兼任 | 原因 |
|---|---|
| 直接业务 Leader | 避免裁判兼运动员 |
| HR / 法务 | 避免合规优先, 业务沦陷 |
| AI 模型工程师 | 避免技术债务伪装为知识债务 |
| CEO / 创始人 | 避免一言堂 |

### 7.3 配置

| 公司规模 | Steward 配置 |
|---|---|
| < 100 人 | 兼职 (创始人 + 业务高管轮值) |
| 100-500 人 | 1 名专职 |
| 500-2000 人 | 1 主 + 部门兼职助理 |
| 2000+ 人 | 团队 (3-5 人) |

### 7.4 治理官的工作流

```
每周:
  • 处理签批申请队列
  • 监控 Memory 引用率

每月:
  • 发"知识健康度月报"
  • 评估 Hermes Watch 月报中的可借鉴改进
  • 与 AI 工程师对齐基线变化

每季:
  • 主持 Memory 评估会
  • 决定归档 / 修订
  • 触发 Baseline 季度训练

每年:
  • 主持战略部署 Workshop
  • 大型 Memory 重构 (如有需要)
```

### 7.5 防腐败机制

- Steward 决策必须**两人复议**(自己 + 一名业务 Leader)
- 季度公示"治理官决议清单"
- 任何员工可对 Steward 决策**异议申诉**
- CEO 有否决权 (但需公开理由)

---

## 第八章: Layer 4 · BASELINE (基线层)

### 8.1 定义

BASELINE 是**公司大模型形态**, 由两部分组成:

```
基线 = 基座 LLM + 公司向量库 + 公司 LoRA 微调 (V2 起)

具体形态:
  Layer 1 (基座): DeepSeek-V3 / Qwen-3 / 等 (Layer 1 选定)
  + Memory 层 RAG (向量检索)
  + 公司 LoRA fine-tune (V2 起)
  + 拿捏老板各员工分身画像
```

### 8.2 训练频率

| 项目 | 频率 | 触发 |
|---|---|---|
| 向量库更新 | 实时 | 每条新 Memory 入库即重建 embedding |
| LoRA fine-tune | 季度 | 由 Steward + AI 工程师共同启动 |
| 基线大版本 | 年度 | 重大业务模式变化 / 重大新模型发布 |

### 8.3 基线漂移检测

V2 加入. 触发预警的信号:

- Steward 评估发现大量 Memory 失效
- AI 输出质量评分下降 (员工反馈)
- 多个员工反馈"AI 答非所问"
- 客户类型重大变化 (业务转型)

→ 触发**基线重训练**.

### 8.4 客户专属基线

```
默认: SaaS 公有云, 客户共享基础基线 + 客户独立向量库
私有化: 客户独立基线 + 独立 LoRA + 独立向量库
```

数据隔离铁律: **不同客户的 Memory 永不混合**.

---

## 第九章: 反例与禁忌

### 9.1 产品形态禁忌

| 反例 | 为何禁止 |
|---|---|
| Material 直接驱动 AI | AI 学到事实而非规范, 污染 |
| Memory 任何员工可改 | 失控, Memory 不再权威 |
| Memory 自动归档基于时间 | 太重要不能机器决定 |
| Steward 由业务 Leader 兼 | 利益冲突 |
| ORIGINS 全员搜索 | 隐私灾难 |
| AI 训练时混入未签批数据 | 基线漂移加速 |

### 9.2 文化禁忌

- ❌ "管理层制定 Memory, 员工执行" → 员工应可发起升级
- ❌ "签批就是 CEO 一个人决定" → 必须三签 + 公示
- ❌ "新业务必须先入 Memory 才能做" → Memory 是描述, 不是审批
- ❌ "为了好看而堆 Memory 数量" → 质量而非数量

---

## 第十章: 数据迁移与导入导出

### 10.1 客户从其他系统迁移过来

```
飞书 Wiki / Confluence / Notion → 牛马搭子:
  默认目标: MATERIALS 层
  ❌ 不直接进 Memory (避免污染)
  
  Steward 后续梳理 → 选择性升级到 Memory
```

### 10.2 客户离开

```
客户终止合同后:
  • 全部 ORIGINS / MATERIALS / MEMORY 可导出
  • 我们的客户基线 LoRA 可交付
  • 30 天后我方彻底删除 (GDPR-style)
```

### 10.3 员工离职

按 MANIFESTO 第十三条:
- 数据归公司 (Material / Memory 不带走)
- Persona 数据匿名化处理
- 个人原始 ORIGINS (1:1 私下笔记) 可导出

---

## 第十一章: V1 实施清单

### 11.1 V1 必含

```
✅ 四层数据模型 + 表结构
✅ ORIGINS 自动归集 (会议录像 / IM)
✅ MATERIALS 自动生成 + 编辑 + 检索
✅ MEMORY 签批工作流 (UI + 工作流引擎)
✅ Knowledge Steward 角色 (RBAC)
✅ Memory 向量库 (PG + pgvector)
✅ RAG 基础接入 (Layer 4 简化版)
```

### 11.2 V2 增量

```
🔧 基线漂移检测
🔧 LoRA 季度 fine-tune
🔧 Memory 智能归档建议
🔧 跨公司 Memory 联邦 (谨慎)
🔧 Milvus 升级
```

### 11.3 V1 工时

```
数据模型 + 表结构:        S (1 周)
ORIGINS 接入 + 加密:      M (3 周)
MATERIALS 自动生成:       L (1 月) ← 与议事室共用
MEMORY 签批工作流 + UI:   L (1 月)
Steward 角色 + 后台:      M (3 周)
向量库 + RAG:             M (3 周)
─────────────────────────────────
合计:                      4-5 人月
```

---

## 第十二章: 与其他文档的关联

| 关联点 | 文档 |
|---|---|
| 四层架构原则 | `MANIFESTO.md` 第七条 / 第八条 |
| Steward 独立角色 | `MANIFESTO.md` 第十四条 |
| Memory 与 AI | `AGENT-FRAMEWORK.md` Layer 3 |
| 议事室生成 Material | `CONVERGENCE-PRINCIPLE.md` |
| 拿捏老板使用 Memory | `PERSONA-EVOLUTION.md` |
| Material 自动生成 | `MEETING-PROXY.md` |

---

## 附录 A: 数据流图

```
[会议 / 消息 / 文件] → ORIGINS (加密, 仅参与者)
       ↓ (议事室自动 / Steward 整理)
   MATERIALS (全员可见, 永久保留)
       ↓ (员工/系统/Steward 发起)
   [升级签批: 业务 Leader → Steward → CEO → 公示]
       ↓
   MEMORY (全员引用, Steward 维护)
       ↓ (实时 embedding / 季度 fine-tune)
   BASELINE (公司模型权重 + 向量库)
       ↓ (RAG 调用)
   [3+1 决策选项 A/C / 拿捏老板教学 / Decision Card]
```

---

## 附录 B: 数据库 Schema (V1 关键表)

```sql
-- ORIGINS (起源层)
CREATE TABLE origins (
  id UUID PRIMARY KEY,
  type VARCHAR(50),  -- meeting_recording, chat_thread, file
  source_url TEXT,
  participants JSONB,
  encrypted_blob BYTEA,
  retention_days INT DEFAULT 90,
  created_at TIMESTAMP
);

-- MATERIALS (材料层)
CREATE TABLE materials (
  id UUID PRIMARY KEY,
  type VARCHAR(50),  -- meeting_minutes, decision_card, etc
  title TEXT,
  body JSONB,
  origin_refs JSONB,  -- 链接到 ORIGINS
  participants JSONB,
  visibility VARCHAR(20) DEFAULT 'public',
  embedding VECTOR(1024),  -- pgvector
  created_at TIMESTAMP
);

-- MEMORY (记忆层)
CREATE TABLE memory_entries (
  id UUID PRIMARY KEY,
  type VARCHAR(50),  -- sop, case, redline, value
  title TEXT,
  body TEXT,
  status VARCHAR(20),  -- active, revising, inactive, deprecated
  source_material_id UUID REFERENCES materials(id),
  signed_by JSONB,  -- 签批人 + 时间
  embedding VECTOR(1024),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 签批申请
CREATE TABLE memory_promotion_requests (
  id UUID PRIMARY KEY,
  material_id UUID REFERENCES materials(id),
  proposed_type VARCHAR(50),
  status VARCHAR(20),  -- pending, approved, rejected
  signers JSONB,  -- 签批人状态
  public_review_until TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP
);
```

---

## 修订历史

| 版本 | 日期 | 修订人 | 主要变化 |
|---|---|---|---|
| v1.0 | 2026-05 | 牛马搭子产品团队 | 初版, 四层架构 + Steward + 签批流 |
