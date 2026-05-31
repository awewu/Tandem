# 三省六部 · 项目与决策治理协同模型

> **2026-05-30 · Phase 1 定型** · 替代旧的 `/organization` "Agent 工作组 fixture" 含糊定位

## 1 · 一句话定位

**三省六部 = 跨部门战略项目的「提案 → 审议 → 执行」三段式治理协同模板。**

它**不是**：
- ❌ HR 组织架构（那是 `/admin/organization` 走 `User.departmentId` 真员工数据）
- ❌ Agent 工作组配置（Agent 自己在 `/agents` 管理）

它**是**：
- ✅ **决策路径模板** — 一个战略项目 / 决议如何从拟定到落地的协同骨架
- ✅ **跨部门 RACI 矩阵的中国式表达** — 用古制 metaphor 让人一眼看懂职能分工
- ✅ **与企业部门线并行的"横向治理"维度** — 部门是「人的归属」，三省六部是「事的流转」

---

## 2 · 三省六部语义映射

| 古制 | 现代含义 | 在 Tandem 的用途 | 默认负责人 |
|---|---|---|---|
| **中书省** | 提案/拟定 | 战略起草、目标制定、决议草案 | Owner / 战略负责人 |
| **门下省** | 审议/封驳 | 审核、风险把关、否决权 | Steward / 治理委员会 |
| **尚书省** | 执行/落地 | 项目执行的六大职能司 | 各事业部 / 项目经理 |
| └ 吏部 | 人事 | 项目组班子搭建、角色任免 | HR Lead |
| └ 户部 | 资源 | 预算、知识库、信息资产 | Finance / 知识管家 |
| └ 礼部 | 接口 | 对外接口、客户协议、标准规范 | BD / 标准化 |
| └ 兵部 | 调度 | 任务派发、运维、应急响应 | Ops Lead |
| └ 刑部 | 合规 | 安全审计、合规审查、风险事件 | 安全/合规官 |
| └ 工部 | 工程 | 实际开发实施、技术落地 | Tech Lead |

---

## 3 · 与企业 HR 部门线的关系

```
        ┌─────────────────────────────────────────┐
        │  企业 HR 部门线 (纵向: 人的归属)         │
        │  /admin/organization · User.departmentId│
        │  - 销售部 / 研发部 / 财务部 / ...       │
        └──────────────┬──────────────────────────┘
                       │ 人 (User)
                       ▼
        ┌─────────────────────────────────────────┐
        │  战略项目 / 决议 (横向: 事的流转)        │
        │  /governance/three-departments          │
        │  ┌──────┐  ┌──────┐  ┌──────┐           │
        │  │中书省│→ │门下省│→ │尚书省│            │
        │  │ 提案 │  │ 审议 │  │六部执行│         │
        │  └──────┘  └──────┘  └──────┘           │
        └─────────────────────────────────────────┘
```

**举例**：要推一个「Q3 客户成功体系升级」战略项目：
- **中书省**：CEO + 客户成功 VP 起草目标 KR
- **门下省**：Steward + 法务复盘风险，过 / 封驳
- **尚书省** 六部分工：
  - 吏部：从销售/研发/客服三个部门借调团队成员
  - 工部：研发部出 3 位工程师
  - 兵部：Ops 配 CI/监控
  - 礼部：法务出客户合同模板
  - 刑部：审计合规
  - 户部：财务核预算

**关键**：项目执行时，**人**还属于原 HR 部门（吏部不夺人），**事**走三省六部协同流。这就是横纵并行。

---

## 4 · 数据模型 (Phase 1)

```ts
type Pillar = 'decision' | 'review' | 'execution';
//             中书省       门下省       尚书省

interface Department {
  id: string;
  name: string;                    // 中书省 / 门下省 / 尚书省
  pillar?: Pillar;                 // 必备 (fixture 全标记)
  projectId?: string;              // 关联战略项目 ID (Phase 2 启用)
  ministries: Ministry[];
}

interface Ministry {
  id: string;
  name: string;                    // 决策司 / 吏部 / 户部 / ...
  tag: string;                     // decision / hr / resources / ...
  description: string;
  agents: string[];                // Phase 1 保留 Agent 引用
  purpose?: string;                // RACI 描述: "为项目 X 负责合规审查"
}
```

**Phase 1 不改**：
- 现有 OKR / IM / Analytics 对 `useOrgStore` 的引用 (向后兼容)
- 默认 fixture 仍是公司总治理结构 (`projectId` 为空表示「公司级模板」)

**Phase 2 启用**：
- 战略项目 CRUD → 每个项目一份独立三省六部实例
- OKR Ownership 从 `team:<ministryId>` 迁移到真 User.departmentId
- IM 通讯录从 ministry 改为 User.departmentId

---

## 5 · 路由 / 导航

| 路径 | 用途 | 状态 |
|---|---|---|
| `/governance/three-departments` | 三省六部治理模板 (新主入口) | ✅ 新建 |
| `/organization` | 旧入口 | ↪ 308 redirect 到上一条 |
| `/admin/organization` | 真员工 HR 管理 | ✅ 原状, 文案加强 |

导航重组：
- **「组织」模块** 改清晰: `公司架构` → `/admin/organization` (真员工), 删假分支
- **「管理」模块** 新增: `三省六部 · 项目治理` → `/governance/three-departments`

---

## 6 · 文案改造关键句

> 三省六部 = 「事如何流转」的模板; 部门 = 「人归属哪里」的事实.
>
> 一个战略项目可以借用多个部门的人, 但事仍走中书 → 门下 → 尚书的协同流.

放在 `/governance/three-departments` 顶部 hero。

---

## 7 · 验收

- [x] 文档落地 (本文)
- [ ] Type 升级 `Pillar` + `projectId` + `purpose`
- [ ] Fixture pillar 标记
- [ ] 新路由 `/governance/three-departments` + 旧路由 308 redirect
- [ ] 导航重组
- [ ] 类型检查 + 全量测试通过

Phase 2 在另文。
