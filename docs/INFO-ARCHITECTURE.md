# 拿捏信息架构修正：Channels / Threads / OKR Views 三元模型

> 配套：`PRD.md` · `OKR-EXPERIENCE.md` · `SUPPLEMENT-TEAMS-COWORK.md`
> 版本：v0.1（2026-05-07）
> **本文件覆盖** `OKR-EXPERIENCE.md §2.3.2 OKR 原生群聊` 与 `SUPPLEMENT-TEAMS-COWORK.md §1.1 Channels+Tabs` 中"每个 OKR 自动建群"的错误设计。

---

## 0. 错误回顾与修正立场

### 0.1 之前的设计（错误）

> 每个 Objective 自动创建一个群 → 200 人公司 → 600+ Objective → 600+ 群 → 员工注意力被肢解。

**错在哪**：把"逻辑关联（这条讨论涉及哪个 KR）"误等同于"独立容器（应该有一个新的群）"。Slack 的频道泛滥、Teams 的 Team 失控，都验证了这条路不可持续。

### 0.2 修正后的核心立场

| 维度 | 原（错） | 新（对） |
|---|---|---|
| **OKR 与群** | OKR 创建群 | OKR 是**横切群的视图**，不创建群 |
| **首屏** | 群列表 | **Inbox**（按"该我处理/关注的事"排序） |
| **认知边界** | 几十个群+频道 | **常驻 5–15 个 Channel**，其他都是 thread/视图 |
| **消息归属** | 多群冗余 | 消息**只归一个 Channel/Thread**，标签关联到 N 个 KR |
| **OKR 详情页** | 跳到群 | 透视所有相关讨论（跨 Channel 聚合） |

---

## 1. 三元模型详解

### 1.1 Channels（容器，少而稳定）

**定位**：员工日常常驻的工作空间。

**类型**：

| 类型 | 例 | 数量 | 成员 |
|---|---|---|---|
| **Team** | 产品部、增长团队 | 部门 + 跨部门虚拟团队 | 长期 |
| **Project** | "Q1 北极星项目"、"客户 X 重大订单" | 项目期 | 项目期间 |
| **Function** | "数据周会"、"OKR 复盘" | 长期 | 职能内 |
| **Personal** | 1:1 私聊 | 多但低噪音 | 双方 |
| **Public** | 全员公告、CEO 频道 | 极少 | 全员只读+评论 |

**目标**：一名普通员工**常驻 5–15 个**。多了会触发"频道清理建议"。

**Tabs 仍然有用**（但不是每个 OKR 一个 Channel）：每个 Channel 内可挂 OKR Tab、文档 Tab、文件 Tab、白板 Tab，**OKR Tab 仅展示该 Team/Project 关联的 KR**。

### 1.2 Threads（讨论分支，无负担）

**定位**：解决一个**问题/议题**的轻量讨论；解决即冷却。

**特点**：
- 任何消息都可一键起 thread
- 参与者只在该 thread 内被通知，不打扰整 channel
- 解决后 thread 折叠归档，不再占首屏
- thread 是消息流的**自然组织单元**，无需"建群"

**适用场景**：
- 临时问题（"客户 X 报价怎么算？"）
- KR 的具体讨论（关联到 KR 标签）
- 决议（决议达成后关闭）

### 1.3 OKR Views（透视，不是容器）

**定位**：以 KR 为视角的**聚合视图**，跨所有 Channels/Threads 抽取相关内容。

**实现**：

```
每条消息有 metadata:
  channel_id: ch_abc
  thread_id?: th_xyz
  related_kr_ids[]: [kr_001, kr_002]   ← 关键

OKR 详情页"动态"Tab：
  query: SELECT * FROM messages WHERE kr_001 IN related_kr_ids
  groupBy: channel + thread
  返回：
    [Channel 产品周会]
      └─ [Thread 留存 KR 进展讨论] (15 条)
    [Channel Project Q1 北极星]
      └─ [Thread A/B 实验设计] (8 条)
    [1:1 张三 ↔ 李四]
      └─ (3 条引用)
```

**关键设计**：
- 视图 = 查询 + 聚合，**不复制不搬家**
- 权限沿用源 Channel 的 RBAC（你看不到的群里的消息，OKR 视图也看不到）
- 视图模式可切换：时间轴 / 按 Channel 聚合 / 按贡献人聚合 / 决议高亮

### 1.4 标签机制：消息如何关联到 KR

| 来源 | 机制 |
|---|---|
| **手动** | 发消息时 `#KR-001 留存` 或在消息上长按 → 关联 KR |
| **AI 自动** | OKR Extractor 扫描消息内容，置信度高时自动打标（标"AI 推断"） |
| **结构化引用** | 在消息里 @ 某 KR 卡（NCard）自动关联 |
| **派生** | thread 标了 KR，则该 thread 内所有消息默认关联（可逐条取消） |

**取消标签**：消息发起人或 KR Owner 可移除关联。

---

## 2. Inbox 才是员工首屏，不是群列表

### 2.1 为什么

群列表是"地理学"，Inbox 是"任务学"。员工每天关心的不是"今天哪些群有动静"，而是"今天我该处理什么、关注什么"。

### 2.2 Inbox 智能排序（AI 分身核心价值）

```
今日 Inbox （AI 分身整合）：

🔴 待处理 (3)
  • @我的：李四在 [产品周会] 问 KR1 留存数据
  • 待审 Check-in 草稿：本周 KR 进展 →
  • 审批：报销单 #234

🟡 我的 OKR 关键动态 (5)
  • [KR 留存] 周二 A/B 实验数据出来了 → 开 thread
  • [KR 推荐] 阻塞升级：UX 招聘已 2 周
  • ...

🟢 订阅频道 (12 条新动态，已折叠摘要)

⚪ 闲聊与噪音（默认折叠）
```

**关键**：员工每天的注意力**只在"红 + 黄"两层**，绿色由 AI 摘要，白色默认折叠。

### 2.3 群列表降级到二级菜单

- 群列表仍然存在（"我的所有 Channels" 视图）
- 但**不是首屏**，不是默认入口
- 员工只在"我要主动找某个项目空间"时才打开

---

## 3. 修正后的"OKR 原生协作"

### 3.1 之前（错）

> 每个 Objective 自动建群 → 群里挂 OKR Tab → 群里发消息可转 Check-in。

### 3.2 修正后（对）

| 场景 | 实现 |
|---|---|
| **OKR 讨论发生在哪？** | 已有的 Team/Project Channel 内，标关联 KR 即可 |
| **跨部门 KR 讨论？** | 起 thread，邀请相关人，标关联 KR |
| **OKR 详情看讨论？** | OKR 详情页"动态"Tab 透视抽取，跨 Channel 聚合 |
| **OKR Owner 关注度** | 订阅"关联到本 KR 的所有消息" → 推 Inbox |
| **Check-in 提交渠道** | 任何消息可转 Check-in（独立模块，不依赖某个群） |

### 3.3 真正需要建专属群的场景（少数）

只有以下场景才**主动建独立 Channel**：

1. **重大公司级 Objective**：CEO 设置的"年度战略 Channel"，高层共识场
2. **跨部门长期项目**：影响多部门、持续 1 季度以上的项目
3. **Owner 明确请求**：员工主动说"这个 KR 太重要，我要建独立讨论空间"

**默认状态**：**不建** Channel，让 OKR 通过标签 + 视图存在于已有 Channels 中。

---

## 4. 200 人公司的实际容量验算

### 4.1 修正前（错误模型）

| 项 | 数量 |
|---|---|
| 员工 | 200 |
| 平均每人 OKR | 3 |
| 公司 Objective 总数 | 600 |
| 自动建的 OKR 群 | 600 |
| 加上 Project/Team/Function/部门群 | +200 |
| **每员工潜在 Channel 数** | **30–60** ❌ |

### 4.2 修正后（三元模型）

| 项 | 数量 |
|---|---|
| 员工 | 200 |
| Team Channel（部门 + 虚拟团队） | 30–50 |
| Project Channel（活跃项目） | 10–20 |
| Function Channel（数据/复盘等） | 5–10 |
| Public/CEO Channel | 3–5 |
| **每员工常驻 Channel 数** | **5–15** ✅ |
| Threads（动态产生，自然冷却） | 不限制，因为不占首屏 |
| OKR Views | 等于员工关心的 KR 数（5–10），但不是 Channel |

**对比**：6 倍以上的认知负担降级。

---

## 5. NCard / Loop / Tabs 仍然有用，只是用法变

### 5.1 NCard（不变）

所有卡片协议保留，OKR 卡可以发到任何 Channel/Thread/Inbox 里。

### 5.2 Loop 活组件（不变）

OKR 卡发到 Channel 里仍可被多人编辑，更新值实时同步到 OKR 数据。

### 5.3 Tabs（用法变）

- ❌ 不是"OKR 群里挂 OKR Tab"
- ✅ Team/Project Channel 里可以挂 OKR Tab（**展示该团队/项目关联的 KR 集合**）
- ✅ 个人首屏 Inbox 是默认 Tab，群列表是次要 Tab

---

## 6. 实现细节

### 6.1 数据模型变更

```sql
-- 不再为每个 Objective 自动创建 Conversation
-- Objective 表移除 conversation_id 字段

-- 改为：消息端做 KR 标签
Message(
  ..., 
  related_kr_ids[]   -- 多对多，可来自手动/AI/派生
)

-- OKR 视图通过查询实现，无新表
```

### 6.2 客户端首屏改造

- `app/page.tsx`（首屏）→ 默认 Inbox 视图，而非模块导航
- 侧边栏：Inbox(置顶) / Channels / OKR / Tasks / 我的 / ...
- Inbox 由 AI 分身实时排序

### 6.3 OKR 详情页 "动态" Tab 实现

```ts
async function getKRDynamics(krId: string) {
  return await db.message.findMany({
    where: {
      related_kr_ids: { has: krId },
      // RBAC 过滤
      channel: { members: { some: { user_id: currentUser } } }
    },
    orderBy: { created_at: 'desc' },
    include: { channel: true, thread: true, sender: true },
    take: 100,
  })
}
```

聚合方式：按 channel/thread 分组 → 时间轴展示。

### 6.4 AI Extractor 自动标签

AI Pipeline（已有）：
- 每条消息走 `OKR Extractor` 试图识别"涉及哪个 KR"
- 置信度 > 0.7 → 自动加 `related_kr_ids`
- 置信度 0.4–0.7 → 提示用户"这条好像跟 KR-X 相关，是否关联？"
- 用户可一键确认 / 否定 / 改其他 KR

---

## 7. 取消的设计 / 保留的设计 / 新增的设计

### 7.1 取消（之前错的）

- ❌ 每个 Objective 自动建 Channel
- ❌ "OKR 群" 作为消息归属容器
- ❌ Channel 数量等于 Objective 数量

### 7.2 保留（之前对的）

- ✅ NCard 卡片协议
- ✅ Loop 活组件
- ✅ Tabs 概念（但只用于 Team/Project Channel）
- ✅ 消息可一键转 Check-in
- ✅ OKR Auto-Updater（自动起草 Check-in）

### 7.3 新增（修正后）

- ⭐ **Inbox 作为首屏**，AI 分身整合排序
- ⭐ **消息 ↔ KR 多对多标签机制**
- ⭐ **OKR Views 作为透视层**，不是容器
- ⭐ **Threads 作为讨论分支**，替代"建群讨论"的冲动

---

## 8. 同步修订其他文档的位置

| 文档 | 章节 | 修订动作 |
|---|---|---|
| `OKR-EXPERIENCE.md` | §2.3.2 OKR 原生群聊 | 改为 "OKR Views + 消息标签"；删除"自动建群" |
| `OKR-EXPERIENCE.md` | §4.1 与 IM 整合 | 改"每个 OKR 有群" → "每条消息可标 KR；OKR 详情有透视视图" |
| `SUPPLEMENT-TEAMS-COWORK.md` | §1.1 Channels+Tabs | 删除 "OKR 群升级" 描述；保留 Channel+Tab 概念，但 OKR 不是 Channel |
| `PRD.md` | §14.4.1 群类型 | 删除 "OKR 群"；增加 "Inbox 首屏" |
| `PRD.md` | §14.8 数据模型 | `Objective` 去掉 `conversation_id`；`Message` 加 `related_kr_ids[]` |

---

## 9. 一句话总结

> **OKR 不是一个新的群。它是穿透所有群的"工作意图标签"，员工通过 Inbox 看到与自己 OKR 相关的事，通过 OKR 详情页透视所有相关讨论。**
>
> Channel 服务于"我们一起做什么"；Thread 服务于"我们要解决什么"；OKR 服务于"我们为什么做"。三者不重叠，不替代。

---

## 附录：与 Slack 频道泛滥的反差

| Slack 默认形态 | 拿捏修正形态 |
|---|---|
| 项目→建频道 | 项目→建 Channel |
| 议题→建频道 | 议题→起 Thread |
| 客户→建频道 | 客户→Bitable + Channel 统一 |
| 跨职能→建频道 | 跨职能→Channel + 标签 |
| **OKR→建频道** | **OKR→标签 + 视图（不建）** |
| 一年下来 200+ 频道 | 常驻 5–15 个 Channel |

---

> **教训**：每次想"建一个新容器"时，先问"这个能不能用现有容器+标签解决？"。容器是有成本的，标签是接近零成本的。

---

> **下一步**：修订 OKR-EXPERIENCE.md / SUPPLEMENT-TEAMS-COWORK.md / PRD.md 中相关章节，把本文档的修正同步进去。
