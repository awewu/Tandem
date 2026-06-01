# Tita OKR 深度分析报告

> **目的**: 深度理解 Tita OKR 的完整功能思路与设计哲学，为 Tandem OKR 系统升级提供对标参考。
>
> **研究时间**: 2026-06-01
>
> **数据来源**: Tita 官方文档、帮助手册、知识社区文章

---

## 一、Tita OKR 核心框架：OKRs-E

### 1.1 框架定义

Tita 开创性地提出了 **OKRs-E** 目标执行管理应用框架：

- **OKR**: Objectives and Key Results（目标与关键成果）
- **E**: Execute（执行）

> "E 是 Execute，即执行，执行是支撑关键成果达成的一系列行动。学东西不能只学表面，只有将 E 执行落实到位，才能成功推行 OKR。每一个 OKR 都该有它的实施路径（KR），每一种实施路径都依靠具体的【工作计划】和【项目】来支撑完成。"

### 1.2 设计哲学

Tita 的核心哲学是：**OKR 不只是目标设定，而是从战略到执行的完整闭环**。

传统的 OKR 实践往往停留在"设定目标-跟踪进度"层面，但 Tita 认为：
- 目标必须分解为可执行的行动（Initiative/项目/任务）
- 执行过程必须实时追踪并与 OKR 进度自动联动
- 执行数据必须反哺到 OKR 评分和复盘

---

## 二、Tita OKR 的三大灵魂特性

### 2.1 特性一：OKR 对齐与目标地图

#### 2.1.1 对齐机制

Tita 支持**多目标对齐**：
- 一个目标可以对齐多个父目标（支持跨部门协作）
- 可以分别对齐父目标本身或其下的关键成果
- 对齐关系自动生成目标地图

#### 2.1.2 目标地图

**OKR 地图是企业战略的全局作战图**，核心价值：
- 全局查看企业目标，明确目标之间的上下关联性
- 清楚目标分布情况及自身目标担当情况
- 支持按公司/部门/团队/成员视角查看
- 支持展开 KR 详情，查看 O 与 KR 之间的关联关系
- 支持导出，可供企业 show 在文化墙上
- 支持一键分享，复盘时可快速打开地图链接

#### 2.1.3 对齐 vs 级联

Tita 的对齐机制不同于传统的"级联"（Cascading）：
- **级联**：CEO 的 Key Results 直接分配给不同团队，容易导致团队聚焦自己的切片，回到孤岛
- **对齐**：团队目标创建后与 CEO 目标对齐，保持透明和共享理解，但团队仍有自主性

> "真正的一致性不是来自连接方框的箭头，而是来自对话、清晰度和共同理解。"

### 2.2 特性二：自动进度传播（Rollup 机制）

#### 2.2.1 唯一的上下自动更新系统

Tita 宣称是**唯一一个能上下自动更新的 OKR 系统**：

```
任务进度 → 关键结果进度 → 目标进度 → 顶层目标进度
```

#### 2.2.2 定量任务追踪

定量的关键结果可以通过**定量的任务**进行过程追踪：
- 创建定量任务
- 过程中只需要维护好定量任务的完成值
- 关键结果的进度就能天然变化

#### 2.2.3 层层往上传递

如果完整使用 OKRs-E 框架，进度是层层往上传递的：
- 任务的进度会自动影响关键结果的进度
- 关键结果的进度影响目标的进度
- 顶层目标可以灵活选择按照对齐的目标进行自动更新

#### 2.2.4 技术实现原理

这本质上是 **Notion 式的 relation + rollup 机制**：
- 任务（Task）与 KR 是 relation 关系
- KR 的 `currentValue` 是 rollup，聚合其下任务的完成值
- Objective 的进度是 rollup，聚合其下 KR 的进度
- 顶层 Objective 的进度是 rollup，聚合对齐子目标的进度

### 2.3 特性三：CFR 持续绩效管理

#### 2.3.1 CFR 定义

CFR = Conversation（对话）+ Feedback（反馈）+ Recognition（认可）

> "CFR 是连续绩效管理的缩写。该系统使管理人员能够定期提供反馈，帮助员工全年改进并解决出现的问题。"

#### 2.3.2 C：对话

每周或每月发生一次，涵盖 5 个主要主题：
1. 反思过去的目标并设定新的目标
2. 更新 OKR 进度，必要时解决问题
3. 指导：指导员工思考 OKR 方法，并鼓励员工提供反馈意见
4. 专业发展：与员工一起发展必要的技能、知识和思维定式
5. "轻量级"绩效审查：讨论自上次会议以来的成就

#### 2.3.3 F：反馈

员工需要了解自己的工作状况。在一对一会议中：
- 员工问："您对我如何提高绩效，在实现目标方面取得更大的进步或制定更具雄心的 OKR 有任何反馈？"
- 经理问："您需要我什么才能成功？"

#### 2.3.4 R：认可

认可应该是私人的，也应该是公共的，并应着眼于行动：
- 介绍点对点识别系统（如周五会议结束时让员工大声疾呼同事的工作）
- 专注于行动和结果（而不是荣誉本月员工，而是荣誉本月成就）
- 将认可与公司目标联系起来（当推出全公司范围的 OKR 时，聚焦在帮助公司在此方面取得进展的人员）

#### 2.3.5 CFR 与 OKR 的协同

> "OKR 是积极的工作场所文化的催化剂；CFR 是维持它的营养。"

- OKR 提供目标设定、从失败中学习、透明、参与有意义的工作、自由分享想法（催化剂）
- CFR 提供积极反馈、专业发展、情感支持、心理安全和认可（营养素）

---

## 三、Tita OKR 的执行追踪与复盘

### 3.1 复盘方法论

Tita 的复盘不是简单的"总结会议"，而是通过结构化分析找出 OKR 执行中的关键问题。

#### 3.1.1 复盘的 3 个关键阶段

**阶段 1：复盘前 - 数据准备与问题聚焦**
- 数据收集：OKR 进度、任务完成情况、协作记录等数据自动汇总
- AI 诊断：自动识别 OKR 的健康度（如 KR 是否滞后、信心指数变化等）
- 设定复盘议题：基于智能周报功能，快速生成 OKR 进展概览

**阶段 2：复盘中的结构化分析与决策**
- 回顾目标与关键结果：使用"OKR 对比视图"对比初始目标与当前进展
- 分析根因：5Why 分析法（连续追问"为什么"找到根本原因）
- 制定行动计划：直接关联改进任务到 OKR，确保后续跟踪

**阶段 3：复盘后 - 跟踪改进与知识沉淀**
- 更新 OKR（如有必要）：直接调整 OKR 并保留历史版本，便于追溯
- 同步团队：通过"智能生成复盘报告"功能，一键生成包含关键结论与行动项的摘要
- 持续监控：在"OKR 仪表盘"中设置关键指标预警

#### 3.1.2 AI 驱动的自动化分析

- 智能诊断 OKR：自动评估目标合理性，识别高风险 KR
- 智能周报：汇总 OKR 进展、任务完成情况，减少手动整理
- 进度热力图：直观展示各 KR 完成情况
- 团队协作图谱：分析跨部门协作效率

### 3.2 评分机制

#### 3.2.1 KR 评分

- 目前只能在关键结果 KR 上进行评分
- 目标 O 的评分是根据关键结果 KR 的权重和评分来计算的
- 只有所有的 KR 都评分后，系统才自动计算目标 O 的评分

**计算公式**：
```
目标评分 = KR1权重 * KR1评分 + KR2权重 * KR2评分 + KR3权重 * KR3评分 ...
```

- 如果 KR 未设置权重，则以平均分计算目标得分
- 评分当前只能 0-1
- 只有目标负责人和 KR 负责人可以对 KR 进行评分
- 如果评分时 @他人，则对方也可以评分；如果别人评分了，则前面的评分结果会被覆盖

#### 3.2.2 评分角色

- **自评**：负责人在周期末自己打分
- **上级评分**：直属上级评估
- **终评**：通常是 (self * 0.4 + manager * 0.6) 的折中，或人工议定

---

## 四、Tita OKR 与 PDCA 的结合

### 4.1 PDCA 理论

Tita 依据 **PDCA 质量管理理论**（Plan-Do-Check-Act）：
- **Plan（计划）**：企业战略目标制定
- **Do（执行）**：工作计划执行
- **Check（检查）**：工作结果考核
- **Act（改进）**：激发员工潜能，实现企业高速增长

### 4.2 OKRs-E 与 PDCA 的映射

| PDCA 阶段 | OKRs-E 对应 |
|-----------|-------------|
| Plan | OKR 目标设定 |
| Do | E 执行（工作计划/项目/任务） |
| Check | CFR 对话反馈 + OKR 复盘 + 评分 |
| Act | 改进任务关联 + 下一周期 OKR 调整 |

---

## 五、Tita OKR 的技术架构推演

### 5.1 数据模型推演

基于 Tita 的功能描述，可以推演出其核心数据模型：

```
Cycle（周期）
  └─ Objective（目标）
       ├─ parentObjectiveId（对齐父目标）
       ├─ weight（在父目标下的权重）
       └─ KeyResult（关键成果）
            ├─ weight（在 Objective 下的权重）
            └─ Initiative（行动项/项目）
                 ├─ linkedTaskId（关联任务）
                 └─ linkedProjectId（关联项目）
```

### 5.2 进度传播机制

Tita 的自动进度传播本质上是 **事件驱动的 rollup 计算**：

```
Task.update(currentValue)
  → emit('task.progressed')
  → KR.subscribe('task.progressed') → recalculate(currentValue)
  → emit('kr.progressed')
  → Objective.subscribe('kr.progressed') → recalculate(progress)
  → emit('objective.progressed')
  → ParentObjective.subscribe('objective.progressed') → recalculate(progress)
```

### 5.3 对齐关系存储

目标对齐关系可能是多对多关系：

```
ObjectiveAlignment:
  - childObjectiveId
  - parentObjectiveId
  - alignmentType: 'objective' | 'keyresult'  // 对齐目标本身或其 KR
```

---

## 六、Tandem OKR 现状与差距分析

### 6.1 Tandem OKR 现状

基于代码分析（`lib/types/okr-tti.ts`、`lib/store/okr.ts`、`lib/okr/scoring.ts`）：

**已有的功能**：
- ✅ Cycle / Objective / KeyResult / CheckIn 基础数据模型
- ✅ Objective 支持父目标对齐（`parentObjectiveId`）
- ✅ KR 支持权重（`weight`）
- ✅ 信心度（`confidence`）
- ✅ 评分机制（自评/上级评分/终评）
- ✅ Initiative（行动项）基础模型
- ✅ CheckIn（周报/月报）scope-based 模型

**缺失的功能**：
- ❌ **自动进度传播**：KR 进度不会自动从 Initiative/Task rollup
- ❌ **多目标对齐**：一个目标只能对齐一个父目标（`parentObjectiveId` 是单值）
- ❌ **OKR 地图**：没有全局对齐关系可视化
- ❌ **CFR 持续绩效**：没有对话/反馈/认可的专门模块
- ❌ **AI 复盘助手**：没有智能诊断和复盘报告生成
- ❌ **定量任务追踪**：Initiative 没有与 Task 面板深度联动
- ❌ **事件驱动的进度更新**：CheckIn 更新后没有触发 rollup 事件

### 6.2 核心差距

#### 差距 1：执行层断裂

Tita 的 OKRs-E 框架强调"执行落实到位"，Tandem 虽然有 Initiative 模型，但：
- Initiative 与 Task 面板联动薄弱（只有 `linkedTaskId` 字段）
- Task 完成不会自动更新 KR 的 `currentValue`
- KR 进度不会自动 rollup 到 Objective 进度

**影响**：OKR 停留在"目标设定"层面，无法形成从战略到执行的闭环。

#### 差距 2：对齐机制单一

Tita 支持多目标对齐和目标地图，Tandem 只有：
- 单一父目标对齐（`parentObjectiveId`）
- 没有对齐关系可视化
- 没有跨部门协作的透明视图

**影响**：无法形成企业战略的全局作战图，跨部门协作效率低。

#### 差距 3：持续绩效缺失

Tita 强调 CFR（对话/反馈/认可），Tandem 只有：
- CheckIn（进度更新）的三段式叙述（成就/障碍/下一步）
- 没有专门的 1:1 对话模块
- 没有反馈和认可机制

**影响**：OKR 容易变成"待办事项"，而不是指导性的力量。

#### 差距 4：复盘能力薄弱

Tita 有 AI 驱动的智能复盘，Tandem 只有：
- 手动填写复盘记录（`retrospective` 字段）
- 没有自动诊断和预警
- 没有复盘报告生成

**影响**：复盘沦为形式主义，无法真正驱动改进。

---

## 七、Tandem OKR 升级建议

### 7.1 短期升级（P0 - 必须做）

#### 7.1.1 实现自动进度传播

**目标**：让 Task → KR → Objective 的进度自动 rollup

**技术方案**：
1. 在 `KeyResult` 表增加 `computeMethod` 字段（已有 `KRComputeMethod` 类型）
2. 在 `Initiative` 表增加 `linkedTaskIds` 数组字段（支持多任务关联）
3. 实现 event-bus 事件：
   - `task.completed` → 触发关联 KR 的进度重算
   - `kr.progressed` → 触发关联 Objective 的进度重算
4. 在 `lib/okr/` 下新增 `rollup-engine.ts`，实现 rollup 计算逻辑

**与 UNIFIED-TECH-DESIGN.md 的关系**：
- 这与 §2.5 的"relation+rollup 引擎统一"一致
- OKR 进度传播复用 Notion 式的 rollup 机制

#### 7.1.2 支持多目标对齐

**目标**：让一个目标可以对齐多个父目标

**技术方案**：
1. 新增 `ObjectiveAlignment` 表：
   ```typescript
   interface ObjectiveAlignment {
     id: string;
     childObjectiveId: string;
     parentObjectiveId: string;
     alignmentType: 'objective' | 'keyresult';  // 对齐目标本身或其 KR
     parentKRId?: string;  // 如果 alignmentType='keyresult'
   }
   ```
2. 修改 `Objective` 接口，移除 `parentObjectiveId` 单值字段
3. 在 UI 层支持选择多个对齐目标

#### 7.1.3 实现 OKR 地图

**目标**：全局查看企业目标对齐关系

**技术方案**：
1. 基于对齐关系生成树状结构
2. 使用 D3.js 或类似库渲染交互式地图
3. 支持按公司/部门/团队/成员视角过滤
4. 支持展开/收起 KR 详情

### 7.2 中期升级（P1 - 应该做）

#### 7.2.1 实现 CFR 模块

**目标**：支持对话、反馈、认可的持续绩效管理

**技术方案**：
1. 新增 `CFRConversation` 表：
   ```typescript
   interface CFRConversation {
     id: string;
     participantIds: string[];  // 参与者（通常是 1:1）
     objectiveId?: string;  // 关联的 OKR（可选）
     scheduledAt: string;  // 计划时间
     actualAt?: string;  // 实际时间
     topics: string[];  // 讨论主题（5 个主题）
     notes: string;  // 会议纪要
     actionItems: string[];  // 行动项 ID
   }
   ```
2. 新增 `Feedback` 表：
   ```typescript
   interface Feedback {
     id: string;
     fromUserId: string;
     toUserId: string;
       context: 'okr' | 'project' | 'general';
     contextId?: string;
     content: string;
     createdAt: string;
   }
   ```
3. 新增 `Recognition` 表：
   ```typescript
   interface Recognition {
     id: string;
     fromUserId: string;
     toUserId: string;
     objectiveId?: string;
     achievement: string;  // 成就描述
     isPublic: boolean;
     createdAt: string;
   }
   ```

#### 7.2.2 实现 AI 复盘助手

**目标**：自动诊断 OKR 健康度，生成复盘报告

**技术方案**：
1. 在 `lib/okr/` 下新增 `diagnosis.ts`（已有基础版本，需增强）
2. 实现健康度评估：
   - KR 滞后检测（进度 < 预期）
   - 信心指数趋势分析
   - 跨部门协作瓶颈识别
3. 实现复盘报告生成：
   - 汇总 OKR 进展
   - 识别关键问题
   - 生成改进建议
   - 关联改进任务

### 7.3 长期升级（P2 - 可以做）

#### 7.3.1 深度 Task 面板集成

**目标**：让 Task 面板成为 OKR 执行的核心界面

**技术方案**：
1. Task 支持关联 KR/Initiative
2. Task 完成自动触发 OKR 进度更新
3. Task 视图支持按 OKR 分组
4. Task 甘特图支持 OKR 里程碑标记

#### 7.3.2 OKR 与绩效深度集成

**目标**：让 OKR 数据自然流入绩效考核

**技术方案**：
1. OKR 评分直接作为绩效考核的输入
2. CFR 对话记录作为绩效评估的依据
3. Recognition 数据作为员工贡献度的参考

---

## 八、总结

### 8.1 Tita OKR 的核心灵魂

Tita OKR 的成功在于它不是一个简单的"目标管理工具"，而是一个**从战略到执行的完整闭环系统**：

1. **OKRs-E 框架**：强调执行落实，通过 Initiative/项目/任务将目标落地
2. **自动进度传播**：通过 rollup 机制让执行数据自动反哺到 OKR 进度
3. **多目标对齐**：支持跨部门协作，形成企业战略的全局作战图
4. **CFR 持续绩效**：通过对话/反馈/认可让 OKR 成为指导性的力量
5. **AI 驱动复盘**：自动诊断和报告生成，让复盘真正驱动改进

### 8.2 Tandem 的升级路径

Tandem 当前的 OKR 实现停留在"目标设定"层面，需要向"执行闭环"进化：

**短期（P0）**：
- 实现自动进度传播（Task → KR → Objective）
- 支持多目标对齐
- 实现 OKR 地图

**中期（P1）**：
- 实现 CFR 模块（对话/反馈/认可）
- 实现 AI 复盘助手

**长期（P2）**：
- 深度 Task 面板集成
- OKR 与绩效深度集成

### 8.3 与 UNIFIED-TECH-DESIGN.md 的一致性

本报告的建议与 `UNIFIED-TECH-DESIGN.md` 的技术设计高度一致：

- **自动进度传播** → §2.5 的 relation+rollup 引擎统一
- **多目标对齐** → §2.2 的 TandemNode relation 机制
- **OKR 地图** → §2.5 的全局搜索索引 + 可视化
- **CFR 模块** → §1 的 governedChat 统一治理 chokepoint

Tandem 的 OKR 升级不仅是功能补齐，更是**向 Tita 学习灵魂**，将 OKR 从"目标设定工具"进化为"战略执行系统"。

---

_本报告基于 Tita 官方文档和公开资料深度分析，结合 Tandem 当前代码实现，提出具体的升级建议。_
