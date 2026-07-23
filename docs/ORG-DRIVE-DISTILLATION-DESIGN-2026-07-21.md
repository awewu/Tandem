# 组织云盘 + AI 蒸馏飞轮 · 设计文档 (2026-07-21)

> 状态: **设计评审中** (未开工)。Owner 选定"先出详细设计文档"。
> 关联: `docs/KNOWLEDGE-MEMORY-EVOLUTION-2026-07-21.md` §8.6/§8.7 (方案 A 整合 + 部门标签澄清)。

---

## 0. 重大修正 (2026-07-21 晚 · Owner 澄清)

早前草案把「我的资料库」当作组织云盘的组成部分、且可被 AI 蒸馏 —— **错**。Owner 澄清**两条清晰边界**:

- **云盘 = 纯工作内容, 无隐私顾虑**。工作产出属于公司, AI 可自由扫描蒸馏 → 进化组织记忆。组织云盘 + 蒸馏飞轮**只作用于云盘**。
- **我的记事本 / 我的资料库 = 私人空间, 归入「搭子手抄」**。用于搭子(工作分身)协同, **公司不整理、不阅读、不蒸馏**; 仅本人可逐条 opt-in 喂给自己的分身 (`ShouchaoNote.sharedToPersona`, 默认关, 公司无入口)。它是**独立模块, 不属于组织云盘**。

代码已支持此模型: 搭子手抄 (`lib/types/shouchao.ts`) 本就是"独立模块 + `ownerId` 私有 + 知识库(`ShouchaoNotebook`)分组 + `sharedToPersona` 本人闸门(公司无入口)"。所以「我的资料库」应**合并进搭子手抄**(名字用「我的记事本」或「我的资料库」皆可), 而非并入云盘。

**受影响的修正**:
- §1 能力 C: 我的资料库**不是**组织云盘的组成部分, 而是私人手抄。
- §3.4: `knowledgeNodes` 归位目标 = **搭子手抄 (私人)**, 不是组织云盘。
- §5.2: 蒸馏范围 = **仅云盘工作内容**; **绝不扫描搭子手抄私人空间**。原"个人区隐私 / `distillable` 开关"顾虑**取消** (私人内容根本不在蒸馏池)。
- §9 Q1/Q2 (个人区可见性 / 蒸馏隐私) **作废** —— 私人=搭子手抄不进池, 无此问题。

> 下文 §1-§11 中凡涉及"个人区在组织云盘内 / 蒸馏个人文件"的表述, 均以本 §0 为准。

### 0.1 根因: 「组织记忆」菜单实为个人记事本 (2026-07-21 晚 · 核实)

Owner 指出"我的记事本搅和在组织记忆里"。核实根因 —— **私人笔记散落三处**:

| 存储 | 模块 | AI 决策泄漏? |
|---|---|---|
| `shouchaoNotes` + `shouchaoNotebooks` | 搭子手抄 | 否 (retriever/promotion 不读) |
| `knowledgeNodes` | 我的资料库 (12 条 seed) | 否 (不读) |
| **`MemoryEntry` + `ownershipLevel='personal'`** | **组织记忆 `/memories`** | 否 (retriever.ts:193 防火墙已排除) |

**字面真相**: `components/nav-modules.ts` 导航项 `组织记忆（需审批）· 公司权威·签批后喂 AI → /memories`, 但 `app/memories/page.tsx:86` 实际只拉 `ownershipLevel=personal&ownerUserId=<self>` —— **这个"组织记忆"菜单点进去是当前用户的私人记事本**。不是数据泄漏 (AI 决策防火墙 `retriever.ts:189-193` 已把 personal 排除), 而是 **IA/命名把私人记事本伪装成组织记忆**。

**修正方向 (待 Owner 确认)**:
1. **组织记忆模块只显示权威记忆** (`ownershipLevel ∈ {company, department, team}`, status=active), 不再显示 personal。
2. **私人记事本统一到搭子手抄**: `MemoryEntry(personal)` 与 `knowledgeNodes` 的私人角色由搭子手抄承接。
3. **注意迁移风险**: `MemoryEntry(personal)` 现被 `getBaselineSystemPrompt` 注入到**本人分身 baseline** (priority/isActive 门槛) —— 与搭子手抄 `sharedToPersona` 是**两套并行的"私人语料→本人分身"机制**。合并需保留此能力 (搭子手抄已有 `sharedToPersona`, 可承接), 属独立迁移项, 不可盲改。

### 0.2 存量审计结果 (2026-07-21 晚 · `scripts/audit-personal-notebook.mjs`)

生产库 (`localhost:5432`) 实测:

| collection | 条数 | 说明 |
|---|---|---|
| `memories` (全部 ownershipLevel) | **0** | 整个记忆表空 —— 连权威记忆都尚未产生 |
| `memories` (personal) | **0** | **个人记事本零真实数据** |
| `knowledge_nodes` | 12 | 全 seed (2 owner) |
| `shouchao_notes` | 2 | 真实 (1 owner) |
| `shouchao_notebooks` | 14 | (2 owner) |

**结论**: 「组织记忆」里的个人记事本是**空功能**, 无数据可迁。故"一步到位合并" = **纯代码改动, 零数据迁移风险**:
- `getBaselineSystemPrompt` (客户端 zustand) 当前注入的是空集 —— 改走搭子手抄 `sharedToPersona` **无回归**。
- `knowledge_nodes` 12 条纯 seed, 已从导航下线, 可直接弃用。
- `/memories` 页无个人数据可留 → 直接改造为**权威记忆浏览** (company/dept/team, 读多写少经签批)。

---

## 1. 愿景与范围

把当前**割裂的**个人文件模块(我的资料库 / 云盘)升级为**一套按组织架构组织的组织云盘 (Org Drive)**,并让中央 AI 定期"扫描—蒸馏—提议",持续进化「组织记忆」的完整度。

Owner 原话拆解为 5 项能力:

| # | 能力 | 说明 |
|---|---|---|
| A | 组织架构化目录 | 租户 → 部门 → 团队 → 个人;每人有"预设个人主目录" |
| B | 真·组织级 ACL | 能看到**被授权的**组织内他人资料,类云服务器权限 |
| C | 我的资料库 = 组织云盘的组成部分 | 个人区是大体系里的一个子树,不再是孤立模块 |
| D | 中央 AI 定期扫描蒸馏 | 按租户配置,定期分析全公司内容沉淀 |
| E | 发现价值 → 进化组织记忆 | 发现问题/缺口/高价值内容 → 提议 → 签批 → 提升组织记忆完整度 |

**非目标 (本期不做)**: 全文检索/向量索引重建 (复用现有 retriever);外部同步 (飞书/OneDrive);版本 diff/协同编辑 (文档协作已覆盖富文本协同)。

---

## 2. 核心原则:可见性 ⊥ 权威度 (与 P0 自洽)

这是整套设计的宪法级前提,也是对早前"部门标签是假标签"结论的**升级而非推翻**:

- **可见性 (谁能看到文件)** —— 由**组织云盘 ACL** 管。正交维度一。
- **权威度 (是否进入中央 AI 决策依据)** —— 由**组织记忆签批**管。正交维度二。

旧「我的资料库」的 `ownership` 标签之所以是"假"的,正因它把两者**混为一谈**(以为打个"公司"标签既共享又变权威),实则两件事都没发生。新体系**把两轴彻底拆开**:

```
文件可见性:  ACL 决定 (user/dept/ministry/role 授权 + 目录继承)
文件权威度:  签批决定 (proposePromotion → sign → materialize Memory)

AI 蒸馏:    扫描"可见性池" → 发现价值 → 产出【pending 提议】→ 人工签批 → 才变权威
```

**治理不变量 (Constitution A)**: AI 蒸馏**永不自动写 Memory**,只产出 `status='pending'` 的提议 (完全比照 `generateReflection()` 现有行为)。个人存文件本身**永不自动成为权威**。

---

## 3. 数据模型

### 3.1 组织层级 (复用现有)

- `Department { id, name, pillar, ministries: Ministry[] }` (`lib/types/governance.ts`)
- `Ministry { id, name, tag, ... }`
- 人员归属: `PersonLike { id, name, ministryId?, managerId? }` (`lib/org/ownership.ts`);扩展用户 extras 已有 `departmentId`/`orgId` (见 `auth_user_extras`)。
- 解析器 `resolveOwner()` 已支持 `team:<id>` / `person:<id>` 约定 —— ACL principal 复用同一约定。

### 3.2 云盘节点 (在现有 DriveFile 上做增量)

现有 `DriveFile` (`lib/types/feishu-catchup.ts`):
```ts
{ id, name, mimeType, size, parentId, ownerId, tenantId,
  storageKey, permissions: { read?: string[]; write?: string[] },
  version, isFolder, createdAt, updatedAt, deletedAt }
```

**增量 (向后兼容)**:
1. **ACL principal 泛化**: `permissions.read/write` 由"纯 userId 数组"升级为"principal 数组",元素取值:
   - `user:<userId>` (等价旧裸 id, 兼容)
   - `dept:<deptId>` — 整部门可见
   - `ministry:<ministryId>` — 整团队可见
   - `role:<role>` — 按角色 (如 `role:admin`)
   - `all` — 全租户 (公司共享区)
   *裸 id 继续按 `user:` 解释,零迁移。*
2. **目录 ACL 继承**: 子节点未显式设权时,继承最近祖先文件夹的 ACL (effective-permission 解析时向上回溯)。
3. **节点角色标记** `nodeRole?: 'dept_root' | 'ministry_root' | 'personal_home' | 'dept_share' | 'company_share' | null` — 用于预设目录树语义 + 蒸馏范围判定。
4. **蒸馏开关** `distillable?: boolean` (默认 true;用户可对个人区/某节点标 false = "纯私有,不参与蒸馏")。
5. **文本内容入口**: 蒸馏读的是**文本**,不是 S3 二进制。文档正文来自 `documents.content` / `knowledgeNodes.content` (均在 PG);二进制文件仅在有文本抽取 (`parseDocument`) 时纳入。

> 说明: 是否把上述字段直接加进 `DriveFile`,还是引入 §GA-2 记忆里的统一 `TandemNode{type,props,ownershipLevel,parent}` 原语,见 §9 开放问题。本设计默认**先在 DriveFile 上增量**,不阻塞。

### 3.3 预设目录树 (自动 provision)

租户初始化 / 新员工入职时,幂等创建:
```
组织云盘 (tenant root, nodeRole=company_share, read: all)
├─ 公司共享区            read: all,          write: role:admin|steward
├─ 事业部 (dept_root)     read: dept:<id>
│  ├─ 决策司 (ministry_root)  read: ministry:<id>
│  │  ├─ 团队共享区 (dept_share) read/write: ministry:<id>
│  │  └─ 个人-张三 (personal_home) write: user:张三, read: ministry:<id> (可配)
│  └─ ...
└─ ...
```
- "预设个人主目录" = 每人在其 ministry 下自动获得 `personal_home`。
- 默认可见范围 (个人区对谁可见) 由**租户策略**配置 (§9)。

### 3.4 我的资料库归位 (Phase B)

- 现 `knowledgeNodes` (12 条,均 seed) → 迁移/桥接为组织云盘中该用户 `personal_home` 下的子树。
- 保留其"文本解析后可编辑"体验 = 复用文档协作 (已是严格超集,见 §8.6);或在个人区内保留轻量编辑。
- `/knowledge` 路由收敛为组织云盘的"我的个人区"视图。

---

## 4. ACL 模型与鉴权

### 4.1 有效权限解析 `resolveEffectivePermissions(node, user, ctx)`

用户 `u` 对节点 `n` 可读,当且仅当以下任一 principal 命中 `n` (或其继承来源) 的 read 集合:
- `user:u.id`
- `dept:u.departmentId`
- `ministry:u.ministryId`
- `role:r` 对任意 `r ∈ u.roles`
- `all`
- `u.id === n.ownerId` (owner 恒可读写)

写权限同理 (write 集合)。文件夹 ACL 向下继承,子节点显式 ACL 覆盖继承值。

### 4.2 落点

- 新增 `lib/drive/acl.ts`: `resolveEffectivePermissions` + `canRead/canWrite(node,user)` 纯函数 (无 React/DB,可单测)。
- `DriveService.list/getById/requestDownload/create/move/delete` 全部经 `canRead/canWrite` 过滤 (现在只按 `ownerId`/裸 permissions)。
- 租户隔离维持: `tenantId` 恒取鉴权上下文 (现有 P0-A 不变)。

---

## 5. AI 蒸馏飞轮 (Phase D)

完全比照现有 `generateReflection()` (§CA-13) 的"启发式 + 可选 LLM + 永不抛错 + 产出 pending"模式。

### 5.1 触发
- Admin API: `POST /api/admin/org-drive/distill` (手动/联调)。
- Cron (V2): 按租户定期 (如每周),同现有 reflection cron 计划。

### 5.2 范围与隐私 (关键治理点)
- 只扫描 `distillable !== false` 的节点文本内容。
- 提供节点级/个人区级 "不参与蒸馏" 开关。
- 蒸馏产出**只有提议 (pending)**,绝不改可见性、绝不自动入 Memory。
- 全程 audit (`org_drive.distilled` 新 AuditAction)。
- **默认策略建议**: 个人 `personal_home` 默认 `distillable=true` 但**仅产出"提议给本人确认"**;部门/公司共享区蒸馏产出直接进签批队列。(最终由 Owner 定,§9)

### 5.3 管道
```
scan (取 distillable 文本 + 元数据)
  → analyze (启发式聚类 + 可选 LLM: 识别 高频主题/规则空白/重复劳动/与现有 Memory 的 gap)
  → 产出 OrgDrileDistillationReport { gaps[], valuableCandidates[], duplicates[] }  (status=pending)
  → 对 valuableCandidates 调 proposePromotion / promoteDocumentToMemory
       level 启发式: 命中多部门 → company; 单部门 → dept; 单团队 → team
       (宪法不变量沿用: redline/value 强制升 company)
  → audit + 通知治理委员会 / 相关 steward
  → 人工签批 (sign) → finalizeApprovedPromotions → 物化 Memory
```

### 5.4 复用的既有资产 (不重造)
- `lib/services/document-promotion.ts` `promoteDocumentToMemory({documentId, triggeredBy, proposedType, level})`
- `proposePromotion / sign / reject / finalizeApprovedPromotions / escalateOverduePromotions` (已单测覆盖 `tests/unit/promotion-flow-sign.test.ts`)
- `lib/memory/retriever.ts` (判断"是否已有等价 Memory",避免重复提议)
- `generateReflection()` 模式 (启发式 + LLM fail-soft)

---

## 6. 分期

| Phase | 内容 | S3 依赖 | 产出 |
|---|---|---|---|
| **A** | 组织云盘骨架: principal ACL + 目录继承 + 预设目录树 provision + 鉴权改造 | 否 | 兑现 A/B(可见性) |
| **B** | 我的资料库归位: knowledgeNodes 桥接进个人区 + `/knowledge` 收敛为个人区视图 | 否 | 兑现 C |
| **C** | 真实文件上传: 云盘 UI 接通 `/api/drive/presign` (S3/MinIO) | **是** | 二进制上传下载 |
| **D** | AI 蒸馏飞轮: 定时任务 + 蒸馏报告 + 自动提议签批 + 审计 | 否(读 PG 文本) | 兑现 D/E |

依赖序: A → B → D 可先行 (无 S3);C 待 S3/MinIO 就绪并行插入。

---

## 7. 文件级改动地图 (预估)

**Phase A**
- 改 `lib/types/feishu-catchup.ts`: DriveFile 加 `nodeRole?`/`distillable?`;permissions 注释 principal 语义。
- 新 `lib/drive/acl.ts`: principal 解析 + 有效权限 + 继承 (纯函数 + 单测)。
- 新 `lib/drive/provision.ts`: 幂等建预设目录树 (按 Department/Ministry)。
- 改 `lib/services/drive-service.ts`: 全 CRUD 经 ACL;`list` 支持组织可见性。
- 改 `app/drive/page.tsx`: 目录树导航 + "共享给部门/团队" UI。

**Phase B**
- 新 `scripts/migrate-knowledge-to-drive.mjs`: 12 条 seed (幂等,可跳过)。
- 改 `app/knowledge/page.tsx` → 收敛为组织云盘个人区视图 (或重定向)。

**Phase C**
- 改 `app/drive/page.tsx`: 接 `/api/drive/presign` 真实上传/下载。
- 环境: `S3_ENDPOINT/S3_ACCESS_KEY/...` (本地 MinIO 或云 S3)。

**Phase D**
- 新 `lib/org-drive/distillation.ts`: `runDistillation({tenantId, windowDays})` (仿 `generateReflection`)。
- 新 `app/api/admin/org-drive/distill/route.ts`。
- 新类型 `OrgDriveDistillationReport` + store repo 注册 (三处: 接口 + memory + drizzle)。
- 新 AuditAction `org_drive.distilled`。
- Admin UI: 蒸馏报告 + 一键发起签批。

---

## 8. 迁移与数据
- 存量核实 (2026-07-21): `knowledge_nodes`=12 (纯 seed-showcase), `drive_files_legacy`=0, `documents_legacy`=0 → **无真实用户数据**,迁移零风险。
- principal ACL 向后兼容: 旧裸 userId 按 `user:` 解释,存量 permissions 不需改写。

---

## 9. 开放问题 (需 Owner 拍板)

1. **个人区可见性默认策略**: 个人 `personal_home` 默认对"本团队可见"还是"仅自己 + 显式授权"?
2. **蒸馏隐私边界**: AI 是否可扫描个人区?建议: 可扫但**个人区候选仅提议给本人确认**,共享区候选进治理签批。是否接受?
3. **ACL principal 粒度**: dept/ministry/role/all 四类够不够?是否要"指定人 + 角色"组合、或"除某人外"排除项?
4. **统一原语**: 直接在 DriveFile 增量 (快),还是借此上 `TandemNode` 统一原语 (§GA-2 专项,重构大)?本设计默认前者。
5. **多租户配置**: 组织架构 (部门/团队) 来源 = 现有 org 数据;是否需要 Owner 在 admin 配"预设目录模板"?
6. **二进制 vs 文本**: 蒸馏只吃文本;扫描到的纯二进制 (图片/压缩包) 如何处理 (跳过 / OCR 后期)?

---

## 10. 测试计划
- `lib/drive/acl.ts`: 有效权限 + 继承 + principal 解析单测 (含跨部门不可见、owner 恒可读、role 命中)。
- `lib/drive/provision.ts`: 幂等 provision (重复跑不重复建)。
- 迁移脚本: 幂等 + owner 隔离。
- `lib/org-drive/distillation.ts`: 无内容→null;有内容→产出 pending 提议;**断言绝不自动物化 Memory** (Constitution A 回归)。
- 端到端: 蒸馏提议 → sign → finalize → Memory 物化 (串起 promotion-flow 现有测试)。

---

## 11. 与既有架构的一致性检查
- ✅ 存储三处注册模式 (`repository.ts` + memory-store + drizzle-store)。
- ✅ 幂等 DDL / provision (不用 `db:push`)。
- ✅ API 路由 `boot()` + `requireAuth` + tenantId 取鉴权上下文。
- ✅ 软删 (`deletedAt`),不物理删。
- ✅ AI 产出 pending + 签批物化,Constitution A (AI 非 proposer 自动执行)。
- ✅ 蒸馏 fail-soft (永不抛错,比照 reflection)。
