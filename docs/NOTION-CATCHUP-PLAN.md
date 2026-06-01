# Notion 完整追赶计划 (Notion Catchup Plan)

> **版本**: 2026-06-01
> **目的**: 既要 Notion 的编辑体验 + 架构灵魂，又要 Tandem 的 AI 原生 + 决策闭环 + 知识治理
> **前置**: `COMPETITOR-ARCHITECTURE.md` (Notion 灵魂) · `UNIFIED-TECH-DESIGN.md` (TandemNode 设计) · `PLAN-DOCS-BEYOND-FEISHU-2026-05-31.md` (文档能力)

---

## 一、Notion 的完整能力清单

### 1.1 功能层（用户可见）

| 能力 | 描述 | Tandem 现状 |
|------|------|------------|
| **块编辑器** | `/` 命令呼出块，拖放重组，15+ 块类型 | ❌ Tiptap 无块级拖拽 |
| **无限嵌套页面** | Sidebar 树状导航，任意子页，面包屑追踪 | ❌ 无统一 Sidebar |
| **反向链接** | 双向引用 `[[页面名]]`，自动发现关联 | ❌ 无 |
| **Database 多视图** | 表格/看板/日历/画廊/时间线切换 | ⚠️ 只有 grid |
| **模板库** | 快速复制标准结构，内置 10+ 模板 | ❌ 无 |
| **全站搜索** | 跨文档/表格/搜索，operators 支持 | ❌ 无全局搜索 |
| **实时协同** | WebSocket + MessageStore，多人同时编辑 | ⚠️ Yjs 有，但未达 Notion 级别 |
| **版本历史** | 页面级版本回滚，对比视图 | ❌ 无 |
| **评论** | 块级评论，@ 提及，线程讨论 | ❌ 无 |
| **锁定** | 页面/块锁定，防止冲突 | ⚠️ Yjs 有冲突解决 |
| **导出** | Markdown/PDF/HTML/CSV 多格式导出 | ⚠️ 部分支持 |
| **API** | 完整 REST API，第三方集成 | ❌ 无 |
| **移动端** | iOS/Android 原生 App | ❌ 无 |
| **Web Clipper** | 浏览器插件，剪藏网页 | ❌ 无 |

### 1.2 架构层（技术灵魂）

| 能力 | 描述 | Tandem 现状 |
|------|------|------------|
| **Block 原语** | `block = {id, type, properties, content[], parent}`，type 与 properties 解耦 | ❌ 按类型分仓 |
| **Turn into** | 切换块类型不丢数据 | ❌ 无法平滑转换 |
| **两套指针** | `content[]` 向下（render tree），`parent` 向上（权限继承） | ❌ 无 |
| **事务系统** | `/saveTransactions`，载入 before → 应用 op → 校验 → commit | ❌ 无 |
| **MessageStore** | 实时推送版本变更，客户端 `syncRecordValues` | ⚠️ event-bus 有，但未达 Notion 级别 |
| **Quick Find** | 异步建全局搜索索引 | ❌ 无 |
| **Collection 模型** | 数据库 = 带 schema 的 collection 块，视图 = collection 上的查询 | ⚠️ Bitable 有，但未统一 |
| **Relation + Rollup** | 统一指针 + 聚合引擎，跨表关联 | ❌ Bitable AI 列独立，无 relation |
| **权限继承** | 沿 parent 树继承 ownershipLevel | ❌ 无 |

---

## 二、Tandem 的独特价值（Notion 没有）

| 能力 | 描述 | 差异化 |
|------|------|--------|
| **AI 原生** | 议事室自动生成纪要 + Decision Card，AI 预填日报 | Notion AI 是后加插件 |
| **决策闭环** | Document → 议事室 → Decision Card → OKR 执行 | Notion 文档是终点 |
| **知识治理** | 四层架构 + 签批工作流，信噪比高 | Notion 自由 Wiki，信噪比低 |
| **OKR 驱动** | 文档必须可回溯到 OKR | Notion 无 OKR |
| **企业级管控** | 中央 AI 4 道闸，红线一票否决 | Notion 是个人工具 |
| **AI 列** | Bitable AI 列真调 LLM | Notion 要等 18 个月 |

---

## 三、分阶段追赶计划

### Phase 1 · 地基级（2-3 个月）· TandemNode 统一原语

**目标**: 引入 Notion Block 原语，解决知识 4 层孤岛问题

#### 1.1 TandemNode 数据模型落地

```typescript
// lib/types/tandem-node.ts
export interface TandemNode {
  id: string;
  type: NodeType;  // 'origin'|'material'|'memory'|'decision_card'|'email'|'im_message'|'doc_block'|'collection'|'row'...
  props: Record<string, unknown>;  // 与 type 解耦
  content: string[];  // 向下指针 → render tree
  parent?: string;  // 向上指针 → 权限继承
  ownershipLevel: 'personal' | 'team' | 'department' | 'company';
  tenantId: string;
  schema?: CollectionColumn[];  // collection 的 schema
  relations?: Array<{ field: string; targetNodeIds: string[]; twoWay?: boolean }>;
  rollups?: Array<{ field: string; viaRelation: string; agg: 'sum'|'count'|'min'|'max'|'latest'|'ai' }>;
  createdAt: string;
  updatedAt: string;
  promotionStatus?: 'material' | 'pending' | 'memory';
}
```

#### 1.2 迁移路径

- **Phase 0**: 新增 `tandemNodes` repo (KvStore)，不动现有 repo
- **Phase 1**: 新功能（邮件 IMAP / 统一搜索）直接落 TandemNode
- **Phase 2**: origins/materials/memories 双写适配器 → 逐步以 TandemNode 为 SoT
- **Phase 3**: 旧 repo 变成 TandemNode 上的 typed view
- **Phase 4**: Bitable → `TandemNode(type=collection)` + `NodeView`

#### 1.3 验收标准

- 邮件 IMAP 收信直接落 TandemNode
- TandemNode `Turn into` 切换 type 不丢数据
- 权限沿 parent 树继承正确

#### 1.4 工期

- 数据模型 + repo: 1 周
- 双写适配器: 2 周
- Bitable 迁移: 1 周
- **合计**: 4 周

---

### Phase 2 · 编辑体验（2-3 个月）· 块编辑器 + 统一空间

**目标**: 达到 Notion 基础编辑体验

#### 2.1 块编辑器

| 块类型 | 优先级 | 工期 |
|--------|--------|------|
| 段落/标题/列表/引用 | P0 | 1 周 |
| 代码块/数学公式 | P0 | 3-4 天 |
| 图片/视频/文件 | P0 | 3-4 天 |
| 分割线/调用块/折叠块 | P1 | 2-3 天 |
| 数据库视图嵌入 | P1 | 1 周 |
| 嵌入页面 | P2 | 3-4 天 |

**技术方案**:
- Tiptap Block Extension: 块级拖拽 + `/` Slash Menu
- 块级选中 + 拖拽手柄
- 块级菜单（删除/复制/移动/转类型）

#### 2.2 统一知识空间

```
/workspace
├── Sidebar 树状导航
│   ├── 我的文档（无限嵌套）
│   ├── 企业 Memory
│   ├── 多维表格（grid/kanban/calendar）
│   └── 知识图谱
├── Main Area
│   ├── 块编辑器
│   ├── 反向链接面板
│   └── 全局搜索（Cmd+Shift+F）
```

**技术方案**:
- 新 `/workspace` 路由
- Sidebar 树状导航（递归渲染）
- 面包屑自动追踪
- 拖拽重组（react-beautiful-dnd）

#### 2.3 验收标准

- `/` 命令呼出 15+ 块类型
- 拖拽重组流畅
- Sidebar 树状导航无限嵌套
- 面包屑正确追踪

#### 2.4 工期

- 块编辑器: 2-3 周
- 统一空间: 1 周
- **合计**: 3-4 周

---

### Phase 3 · 多视图 + 反向链接（1-2 个月）· Database 增强

**目标**: 达到 Notion Database 完整体验

#### 3.1 多视图

| 视图 | 优先级 | 工期 |
|------|--------|------|
| 看板 (Kanban) | P0 | 3-4 天 |
| 日历 (Calendar) | P0 | 3-4 天 |
| 画廊 (Gallery) | P1 | 2-3 天 |
| 时间线 (Timeline) | P2 | 1 周 |

**技术方案**:
- KanbanView: 按 select 列分组，拖拽卡片
- CalendarView: 按 date 列渲染日历（react-big-calendar）
- 视图切换 UI（Tab）

#### 3.2 反向链接

**技术方案**:
- 解析 `[[页面名]]` / `@页面名`
- 建立双向关系表 `nodeRelations`
- 被引用页显示"被 X 页引用"
- 反向链接面板

#### 3.3 验收标准

- Bitable 至少 grid + kanban + calendar
- 反向链接正确显示
- 双向引用可跳转

#### 3.4 工期

- 多视图: 1-2 周
- 反向链接: 3-4 天
- **合计**: 2 周

---

### Phase 4 · 实时协同 + 搜索（1-2 个月）· MessageStore + Quick Find

**目标**: 达到 Notion 实时协同 + 搜索体验

#### 4.1 MessageStore 升级

**技术方案**:
- 复用现有 event-bus 广播
- 客户端 `syncRecordValues` 拉新数据
- WebSocket 订阅 record
- 版本快照

#### 4.2 Quick Find 全局搜索

**技术方案**:
- 异步建全局搜索索引（全文 + 向量）
- `/api/search?q=` 跨文档/Memory/IM/OKR/DC
- operators 支持（`type:memory` `tag:sop`）
- 搜索结果高亮

#### 4.3 验收标准

- 多人同时编辑无冲突
- 搜索 < 500ms
- 搜索结果准确

#### 4.4 工期

- MessageStore 升级: 1 周
- Quick Find: 1 周
- **合计**: 2 周

---

### Phase 5 · 高级功能（2-3 个月）· 模板 + 版本历史 + 评论

**目标**: 达到 Notion 高级功能

#### 5.1 模板库

**技术方案**:
- TemplateGallery: 内置 + 用户自建
- 一键复制（TandemNode 深拷贝）
- 模板市场（可选）

#### 5.2 版本历史

**技术方案**:
- 页面级版本快照
- 对比视图（diff）
- 一键回滚

#### 5.3 评论

**技术方案**:
- 块级评论
- @ 提及
- 线程讨论

#### 5.4 验收标准

- 内置 10+ 模板
- 版本历史可回滚
- 块级评论可 @ 提及

#### 5.5 工期

- 模板库: 1 周
- 版本历史: 1 周
- 评论: 1 周
- **合计**: 3 周

---

### Phase 6 · AI 原生增强（持续）· Tandem 独特价值

**目标**: 在 Notion 基础上加 Tandem 独特价值

#### 6.1 AI 列增强

- 复用 relation+rollup 引擎
- `rollups[].agg='ai'` 统一进 rollup
- OKR 进度传播 = KR/O 节点间 relation + `agg='sum'`

#### 6.2 决策闭环

- Document 详情页加"发起议事"按钮
- Bitable 行右键"发起议事"
- Decision Card 自动关联 OKR

#### 6.3 知识治理

- Document → Memory 升级签批（D-04）
- 四层架构严格区分
- Steward 独立角色

#### 6.4 验收标准

- AI 列真调 LLM
- Document 可发起议事
- Memory 签批流程完整

#### 6.5 工期

- AI 列增强: 1 周
- 决策闭环: 1 周
- 知识治理: 已有
- **合计**: 2 周

---

## 四、综合优先级矩阵

| 阶段 | 优先级 | 关键动作 | 工期 | 影响 |
|------|--------|----------|------|------|
| **Phase 1** | **P0** | TandemNode 统一原语 | 4 周 | 地基级，必须先做 |
| **Phase 2** | **P0** | 块编辑器 + 统一空间 | 3-4 周 | Notion 基础体验 |
| **Phase 3** | **P1** | 多视图 + 反向链接 | 2 周 | Database 完整体验 |
| **Phase 4** | **P1** | 实时协同 + 搜索 | 2 周 | 协同 + 搜索体验 |
| **Phase 5** | **P2** | 模板 + 版本历史 + 评论 | 3 周 | 高级功能 |
| **Phase 6** | **P0** | AI 原生增强 | 2 周 | Tandem 独特价值 |

**总工期**: 16-18 周（4-5 个月）

---

## 五、技术风险与应对

| 风险 | 应对 |
|------|------|
| TandemNode 迁移数据丢失 | 双写适配器 + 渐进迁移 + 完整备份 |
| 块编辑器性能 | 虚拟滚动 + 懒加载 + debounced 更新 |
| 实时协同冲突 | Yjs CRDT 已有冲突解决 |
| 搜索性能 | 异步索引 + 分片 + 缓存 |
| 多视图复杂度 | 视图抽象层 + 统一数据源 |

---

## 六、与现有计划的整合

| 现有计划 | 整合点 |
|----------|--------|
| `PLAN-DOCS-BEYOND-FEISHU-2026-05-31.md` | D-01/D-02/D-04 整合进 Phase 2/3 |
| `UNIFIED-TECH-DESIGN.md` | Phase 1 直接落地 TandemNode |
| `KNOWLEDGE-ARCHITECTURE.md` | Phase 6 知识治理 |
| `ARCHITECTURE-BREAKDOWN.md` | 知识库部分整合进 Phase 2/3 |

---

## 七、验收标准（最终）

### 功能层

- ✅ 块编辑器 15+ 块类型
- ✅ 无限嵌套页面 + Sidebar 树状导航
- ✅ 反向链接双向引用
- ✅ Database 多视图（grid/kanban/calendar/gallery）
- ✅ 模板库 10+ 内置模板
- ✅ 全站搜索 < 500ms
- ✅ 实时协同无冲突
- ✅ 版本历史可回滚
- ✅ 块级评论 @ 提及

### 架构层

- ✅ TandemNode 统一原语
- ✅ Turn into 切换 type 不丢数据
- ✅ 两套指针（content[] + parent）
- ✅ 事务系统
- ✅ MessageStore 实时推送
- ✅ Quick Find 全局索引
- ✅ Collection + relation + rollup 统一
- ✅ 权限沿 parent 树继承

### Tandem 独特价值

- ✅ AI 原生（议事室自动生成纪要 + DC）
- ✅ 决策闭环（Document → 议事室 → DC → OKR）
- ✅ 知识治理（四层架构 + 签批工作流）
- ✅ OKR 驱动（文档可回溯到 OKR）
- ✅ 企业级管控（中央 AI 4 道闸）
- ✅ AI 列真调 LLM

---

## 八、一句话

> **6 个阶段，16-18 周，既要 Notion 的编辑体验 + 架构灵魂，又要 Tandem 的 AI 原生 + 决策闭环 + 知识治理。先做 Phase 1（TandemNode 地基），再 Phase 2（块编辑器），然后依次推进。**

---

_本文档为 Notion 完整追赶计划，与 `COMPETITOR-ARCHITECTURE.md`、`UNIFIED-TECH-DESIGN.md`、`PLAN-DOCS-BEYOND-FEISHU-2026-05-31.md` 联动。_
