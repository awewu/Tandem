# 知识库 & Memory 进化方案 (Knowledge & Memory Evolution)

> **定稿**: 2026-07-21 · **配套**: `docs/KNOWLEDGE-ARCHITECTURE.md` (四层架构 SSOT) · `docs/EVOLUTION-ROADMAP-2026-07-20.md` (总方向)
> **一句话**: 类型层已对齐 2026 前沿 (Mem0/Letta), 但**检索层仍跑关键词兜底、公司基线无部署入口** —— 本方案打通"能录入基线 + 能语义检索 + 能混合重排"。
> **触发**: Owner 准备部署公司基线和知识库 (2026-07-21)。
> **维护**: 与代码不一致时先改本文档; 每完成一个 Phase 在 §6 打勾。

---

## §1 现状盘点 (代码级实证)

### 1.1 已达前沿的部分 ✅

| 能力 | 落点 | 状态 |
|---|---|---|
| 四层知识架构 (Origins/Materials/Memory/Baseline) | `lib/types/memory.ts` | 类型完备 |
| Mem0 三类认知记忆 (`episodic/semantic/procedural`) | `MemoryKind` | 已建模 |
| Mem0 4-scope 标识 (`orgId/agentId/userId/sessionId`) | `MemoryScope` | 已建模 |
| 4 级 ownership + 三级签批门 | `promotion-flow.ts` · `app/admin/steward` | 完整闭环 |
| 降级评估 (引用率低于均值 30% 自动扫描) | Steward 工作台 downgrades tab | 可用 |
| 决策防火墙 (personal 记忆硬排除决策召回) | `baseline-guard` · `retriever.CompositeRetriever` | 已密封 (2026-07-12) |
| 三道镜片 (入口 baseline-guard / 出口 output-guard / 重排 reranker) | `lib/memory/*` | 闭环, 出口镜片刚升级 |
| GraphRAG 1 跳扩展 | `retriever.ts` `expandNeighbors` | 已建雏形 |
| 多信号重排 (BM25-lite + entity + recency + popularity + priority) | `reranker.ts` | 启发式版可用 |
| embedding 回填脚本 | `scripts/backfill-embeddings.mjs` | 就绪, 待配 provider |

### 1.2 技术断层 ⚠️ (按严重度排序)

| # | 断层 | 实证 | 影响 |
|---|---|---|---|
| **D1** | **公司基线无部署入口** | `app/admin/baseline/page.tsx` 仍是占位页 ("M2 上线") | 从零部署时无法录入初始 Memory; Steward 台只能签批已存在的 Material, 新部署 Materials 为空 |
| **D2** | **向量检索未真正启用** | `backfill-embeddings.mjs` 确认 `EMBEDDING_PROVIDER` 默认 `none`; `.env.local` 无 EMBEDDING key | 检索全程降级 Jaccard 关键词匹配, "向量 RAG" 名存实亡 |
| **D3** | **pgvector 未落地** | embedding 存 `number[]` 于 KvStore, cosine 在 JS 里 O(N) 全表算 (`embedding.ts` `cosineSim`) | 文档 (`KNOWLEDGE-ARCHITECTURE` §11.1 附录 B) 写 pgvector, 实际未建; 上千条即变慢 |
| **D4** | **无混合检索 (BM25 + 向量)** | `retriever.ts` 是"向量优先, 零命中才落 Jaccard"的二选一, 非融合 | Anthropic 实测: 纯向量→混合可降 top-20 失败率 49% |
| **D5** | **无 chunking / contextual retrieval** | 整条 Memory `${title}\n${body}` 直接 embed | 长条目信号稀释; 缺 chunk 上下文前缀 |
| **D6** | **无写时去重/合并 (consolidation)** | `store.memories.create` 直接插入, 无 ADD/UPDATE/NOOP 判定 | 反哺路径可能堆冗余记忆 |

---

## §2 行业最新迭代扫描 (2025-2026)

> 来源: Anthropic Contextual Retrieval (2024-late, 2026 已成标配) · Mem0/Letta/Hindsight 生产基准 (2026) · Jina Late Chunking (arXiv:2409.04701)。

| 突破 | 关键数据 | 对 Tandem 的启发 |
|---|---|---|
| **Contextual Retrieval** (Anthropic) | chunk embed 前加 50-100 token LLM 上下文前缀 → top-20 失败率 **-35%**; +BM25 **-49%**; +rerank **-67%** | 入库时给 Memory 生成上下文前缀 (已有 DeepSeek, prompt cache 降本) |
| **Hybrid Search** | 2026 生产 RAG 几乎都是 向量+BM25+metadata, 纯向量已过时 | D4: 现有两路信号做 RRF 融合而非二选一 |
| **Mem0 consolidation** | 写时去重 (ADD/UPDATE/DELETE/NOOP) + 多因子打分 → **+26% 准确率, -90% token** | D6: 反哺写入前做冲突/重复判定 |
| **Mem0ᵍ / Hindsight 图记忆** | 图谱 + 多路并行 (语义/BM25/图/时序) + cross-encoder → 多跳 **68.4%** | 深化现有 `expandNeighbors` GraphRAG |
| **多因子相关性** | `relevance = base * exp(-λ·Δt) * importance` (LLM 1-10 打分) | reranker 已有 recency/priority, 缺 LLM importance |
| **Late Chunking** (Jina) | 长上下文模型先整篇 embed 再切, 零额外 LLM 成本, 指代密集文本 +10-12% | D5 的低成本替代方案 |
| **Agentic RAG** | 单发 → 多轮"检索-判断-再检索" + 查询改写 + 自适应路由 (简单问题跳检索) | 快慢双轨已是雏形, 可深化 |

---

## §3 进化蓝图 (可用性 × 检索质量 双轴)

```
检索质量 ↑
        │  [D6] 写时去重/合并 consolidation           (Mem0)
        │  [D5] contextual retrieval / late chunking  (Anthropic/Jina)
        │  [D4] hybrid 检索 (BM25 + 向量 RRF)          (2026 标配)
        │  [D3] pgvector + HNSW 索引                   (规模化)
        │  [D2] 启用真向量检索 (配 provider + 回填)     ★ 基石
        └──────────────────────────────────────────────→ 可部署性
                                              [D1] 基线 Authoring 台 ★ 拦路石
```

**两个 ★ 是 P0**: D1 不做无法部署基线; D2 不做知识库=关键词搜索。其余按质量回报排。

---

## §4 分期实施方案

### Phase 0 · 部署前置 (P0 · 解 D1 + D2) — 目标: 能录入基线 + 能语义搜

#### 4.1 公司基线 Authoring 台 (解 D1)

**方案**: 把 `app/admin/baseline/page.tsx` 从占位改成真页面 + 新增 owner 专属 API。

**关键设计 (合宪)**:
- Memory 必须经签批 (宪章 §8.1) —— 基线 bootstrap **不绕过签批**, 而是走**紧急通道** (`isEmergencyTrack`, CEO+Steward 双签, 已存在于 `promoteTextToMemory`)。
- 或提供 **owner-only「初始部署」模式**: 仅当"公司级 active Memory 计数 = 0"时开放直建 (`store.memories.create({ownershipLevel:'company'})`), 一旦有数据即关闭, 强制走签批。防止后续绕过治理。
- `redline/value` 类型由 `proposePromotion` 自动强制 company 级 (已实现)。

**UI 能力**:
- 单条录入 (类型选择 sop/case/redline/value/lesson + 标题 + 正文 + level)。
- 批量导入 (CSV/Markdown/JSON → 逐条建 Material → 批量 proposePromotion 紧急通道)。
- 从飞书/Confluence/Notion 导出物默认落 **Materials 层** (遵 `KNOWLEDGE-ARCHITECTURE` §10.1, 不直入 Memory)。
- 已录入基线列表 (按 ownership/type/status 过滤) + 引用计数。

**落点**:
- `app/admin/baseline/page.tsx` (改写)
- `app/api/admin/baseline/route.ts` (新增, `requireAuth` + owner 角色校验)
- 复用 `lib/services/text-promotion.ts` `promoteTextToMemory`

**验收标准**:
- [ ] owner 可从空库录入 ≥1 条 company 级 redline, 落库后 `ownershipLevel==='company' && status==='active'`。
- [ ] 批量导入 10 条, 全部生成 promotion 且紧急通道双签后物化。
- [ ] 非 owner 访问 API 返回 403。
- [ ] 库中已有 company Memory 后, 直建模式关闭 (返回明确错误引导走签批)。

**工时**: M (页面 L + API M, 约 3-4 天)

#### 4.2 启用真向量检索 (解 D2)

**方案** (无代码改动, 配置 + 运维):
1. `.env.local` 配 `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_API_URL` / `EMBEDDING_API_KEY`
   (候选: DeepSeek embedding / BGE-large-zh 本地 / Qwen-Embed; 中文场景优先 BGE 或 Qwen)。
   或经 Admin UI `app/admin/ai-settings` 热更新 (`getAiSettings().embeddingProvider` 优先级高于 env)。
2. `node scripts/backfill-embeddings.mjs` (dry-run 看条数) → `--apply` 回填。
3. 验证: `isEmbeddingConfigured()` → true; baseline-guard / retriever 走 cosine 分支。

**验收标准**:
- [ ] `backfill-embeddings.mjs --apply` 回填全部存量 Memory, 无 `embedding=null` 残留。
- [ ] 同一查询, 向量检索命中与 Jaccard 命中差异可观测 (记一组对比样本)。
- [ ] embedding provider 挂掉时优雅降级 Jaccard, 不报错 (回归 `embedding.ts` fail-soft)。

**工时**: S (半天, 主要是选模型 + 回填)

**⚠️ 依赖**: 需 Owner 决定 embedding 模型 + API 预算 (每条 Memory 一次 embed, 回填是一次性成本)。

---

### Phase 1 · 检索质量 (P1 · 解 D4 + D5) — 目标: 对齐 2026 hybrid 标配

#### 4.3 Hybrid 检索 (BM25 + 向量 RRF) (解 D4)

**方案**: 把 `retriever.ts` 的"向量优先/零命中落 Jaccard"改为 **Reciprocal Rank Fusion**: 向量路 top-K + BM25 路 top-K → RRF 合并 → reranker 复排。

**落点**: `lib/memory/retriever.ts` (`rankSemantic` 改融合) · 复用 `reranker.ts` `bm25Lite`。

**验收标准**:
- [ ] 含精确术语/ID 的查询, hybrid 召回优于纯向量 (构造 5 个 golden-chunk 样本, Pass@5 提升)。
- [ ] 现有 `tests/eval/memory-rerank.eval.test.ts` 不回归。
- [ ] 新增 `tests/unit/retriever-hybrid.test.ts`。

**工时**: M (2-3 天)

#### 4.4 Contextual Retrieval (解 D5)

**方案**: 入库时 (materializePromotion + backfill) 用 DeepSeek 给每条 Memory 生成 50-100 token 上下文前缀, 与正文一起 embed; 检索命中后**只把原文**注入 prompt (前缀仅用于提升召回)。

**落点**: `lib/memory/promotion-flow.ts` `materializePromotion` · `backfill-embeddings.mjs` · 新增 `lib/memory/contextualize.ts`。

**验收标准**:
- [ ] 每条新入库 Memory 带 `contextPrefix` 字段 (类型扩展)。
- [ ] top-20 检索失败率相对基线下降 (用 §4.3 样本集度量)。
- [ ] prompt 注入仍是原文 (前缀不进最终 context, 省 token)。

**工时**: M (2-3 天) · **成本**: 每条一次 LLM 调用 (prompt cache 降本)

---

### Phase 2 · 规模化 & 记忆质量 (P2 · 解 D3 + D6)

#### 4.5 pgvector 落地 (解 D3)

**方案**: 新增 pgvector 列 + HNSW 索引, cosine 下推到 DB。**严格遵守 DB 规则**: 幂等 DDL 脚本 (`CREATE EXTENSION IF NOT EXISTS vector` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS embedding vector(N)` + `CREATE INDEX IF NOT EXISTS ... USING hnsw`), 经 Node 迁移脚本跑, **禁用 `db:push`**。

**落点**: `drizzle/migrations/00XX_pgvector.sql` (幂等) · `lib/storage/drizzle-store.ts` memories repo 检索方法。

**验收标准**:
- [ ] 迁移脚本可重复运行不报错 (幂等)。
- [ ] 1000+ Memory 检索延迟 < JS 全表算基线的 1/5。
- [ ] 降级路径保留: pgvector 不可用时回退 JS cosine。

**工时**: L (需处理维度对齐 + 双写迁移, 约 1 周)

#### 4.6 写时去重/合并 consolidation (解 D6)

**方案**: 反哺写入前 (async-writer / reflexion / promotion) 对新事实与 top-K 近似 Memory 做 ADD/UPDATE/NOOP 判定 (Mem0 模式)。

**落点**: `lib/memory/async-writer.ts` + 新增 `lib/memory/consolidate.ts`。

**验收标准**:
- [ ] 重复事实入库判 NOOP, 库不膨胀。
- [ ] 修正型事实判 UPDATE (标 supersedes 链)。
- [ ] 不误合并语义相近但实质不同的记忆 (构造对抗样本)。

**工时**: M (3-4 天)

---

## §5 骨架原则 (不变量)

- **合宪**: Memory 入库必经签批 (§8.1); 基线 bootstrap 走紧急通道或"空库一次性" owner 直建, 不开永久后门。
- **决策防火墙**: personal 记忆永不进决策召回 (2026-07-12 密封), 本方案所有检索改动必须保留该过滤。
- **DB 安全**: 禁 `db:push`; 所有 schema 变更走幂等 DDL Node 脚本; 保留 `departmentId` 等 legacy 列。
- **fail-soft**: embedding/pgvector/LLM 任一挂掉, 优雅降级到 Jaccard/JS cosine, 不阻断业务。
- **评估先行** (承 EVOLUTION-ROADMAP §7): 每个 Phase 上线前先有 golden 样本集 + 至少 1 个回归测试。

---

## §6 分期进度 (勾选)

- [ ] **Phase 0 · 部署前置**: 4.1 基线 Authoring 台 + 4.2 启用真向量检索。
- [ ] **Phase 1 · 检索质量**: 4.3 Hybrid (BM25+向量 RRF) + 4.4 Contextual Retrieval。
- [ ] **Phase 2 · 规模化**: 4.5 pgvector + 4.6 写时 consolidation。

---

## §7 待 Owner 决策项

1. **embedding 模型选型**: DeepSeek embedding / BGE-large-zh (本地免费) / Qwen-Embed? (影响成本 + 中文效果 + 是否需 GPU)。
2. **基线 bootstrap 方式**: 紧急通道双签 (更合规) vs 空库一次性 owner 直建 (更快)?
3. **初始基线内容来源**: 手工录入 / 从现有文档 (飞书/Confluence) 批量导入 / 从 `docs/MANIFESTO.md` 等宪章文档抽取?
4. **Phase 优先级**: 是否 Phase 0 先上线跑一段再评估 Phase 1/2, 还是一次性排期?

---

## §8 知识模块 IA 混淆整改 (2026-07-21 追加)

> **触发**: Owner 指出"用户会混淆"。深度推演后确认: 5 个知识子模块按**数据形态**切分, 但用户按**意图 (放哪/信哪)** 思考, 两套心智模型无翻译层 → 大面积重叠。其中一处混淆会**击穿治理防火墙**, 列为 P0。

### 8.1 用户的元问题

普通员工面对知识模块只有两个意图: ①"我这东西该放哪?"(录入) ②"公司权威答案/AI 依据从哪来?"(信任)。系统用 5 个按数据形态 (doc/table/file/tree/entry) 的入口回应, 形态是工程视角, 非用户视角 —— 这是混淆总根。

### 8.2 碰撞矩阵

| 碰撞 | 涉及模块 | 重叠点 (代码实证) | 严重度 |
|---|---|---|---|
| **A · 三处放文件** | 文档协作 / 知识图谱 / 云盘 | 三者都收上传: `documents` `parseDocument` · `knowledge` `parseDocument`+`SUPPORTED_ACCEPT` · `drive` file 树 | 高 (高频) |
| **B · 三处做表** | 文档(sheet) / 知识图谱 / 多维表格 | `documents.type='sheet'` · `KnowledgeSpreadsheetEditor` · `bitable` | 中 |
| **C · 权威幻觉** | 组织记忆 vs 知识图谱 | 共用 `FileManager` + 同套 4 级 ownership 标签; `/knowledge` 页注释"与 /memories 同语义"。**但后端天差地别**: `/memories`→`store.memories` 签批后喂中央 AI; `/knowledge`→`store.knowledgeNodes`, `lib/knowledge/service.ts` `listNodes(ownerId)` **按 ownerId 隔离且无任何 AI 消费方** | **致命 (P0)** |
| **D · "知识"泛滥** | 组织记忆 / 内网 / 学院 / 手抄 | 多处承载"知识/规定", 无单一权威入口 | 中 |

### 8.3 碰撞 C 的致命误解链 (P0)

```
员工在【知识图谱】上传文件 → 打"公司"ownership 标签
  → 预期: 我发布了公司级知识, 全员可见 + AI 会用
  → 实际: ① 只有自己可见 (ownerId 隔离)
          ② KnowledgeNode ≠ 签批 Memory, 永不进 AI 决策路径
  → 后果: 以为"部署了公司基线", 实际什么都没发生 → 治理幻觉
```

这与产品核心卖点 (签批防漂移) 直接冲突, 在"准备部署公司基线"当口尤其危险。

> **文档漂移**: `KNOWLEDGE-ARCHITECTURE.md` §9.3 声称企业决策通道含"公司级已发布 KnowledgeNode", 但代码中 KnowledgeNode 无 published 概念、无决策消费方 —— 声明未实现, 须修正。

### 8.4 根因

模块按 **"存储什么"(数据形态)** 建模; 用户按 **"要干什么 + 信不信"(意图/权威度)** 思考。两套模型缺翻译层。

### 8.5 整改项 (P0-P3)

**P0 · 堵治理幻觉 (本次实施)**
- [x] `/knowledge` ownership 选择器文案去歧义: 删除"与 /memories 同语义 · 影响 Persona 可见性"假声明; 明示"仅个人整理分类, 不等于公司发布; 全员权威知识请走【组织记忆】签批"。
- [x] 修正 `KNOWLEDGE-ARCHITECTURE.md` §9.3 与代码对齐 (KnowledgeNode 未入决策)。
- **验收**: 员工在 /knowledge 设"公司"标签时, UI 明确告知不等于公司发布并给出正确路径; 架构文档无未实现声明。

**P1 · 意图漏斗统一入口** ✅ (2026-07-21)
- 新建 `app/knowledge-hub/page.tsx`: 按意图分流的卡片页 (查权威→组织记忆(唯一权威, 高亮) · 沉淀协作→文档 · 结构化表→多维表格 · 个人整理→我的资料库 · 存原件→云盘), 顶部"一条规则"提示唯一权威 = 组织记忆。
- 设为「知识」模块首项 (`nav-modules.ts` `kb.items[0]`, `pathPrefixes` 加 `/knowledge-hub`), rail 图标默认落此。
- **验收**: 新员工无提示下能正确选中目标模块 (可用性测试通过率 ≥80%)。

**P2 · 生命周期式导航** ✅ (2026-07-21)
- `nav-modules.ts` `kb.items` 加 `group` 小标题, 按权威度排序: `共创沉淀 → 公司权威·需签批 → 数据工具 → 个人空间`, 由 SubSidebar 渲染分组标题, 明示权威分层。

**P3 · 术语澄清** ✅ (2026-07-21)
- "知识图谱"→"我的资料库" (`nav-modules.ts` item name + `app/knowledge/page.tsx` FileManager `title`), 避免与 `retriever.ts` 真 GraphRAG 混淆, 并契合"个人空间"定位。

### 8.6 整合进化 · 认知层重构 ✅ + 结构层待决 (2026-07-21)

**纠错**: 早前一版误判"云盘功能很薄"。核实 `app/api/drive/route.ts` + `lib/services/drive-service.ts` 后确认: **云盘后端是完整 S3 网盘** (预签名上传/下载、`mimeType/size/permissions` 共享、软删+S3 清理, 属 V1 GA), **弱的是 `app/drive/page.tsx` UI 半成品** (只发 `{name,type}`, 未接通真实上传)。真正定位最含糊的是 **我的资料库** (`/knowledge`, 个人解析文本草稿, 夹在"编辑文档"与"存文件"之间, 且不喂 AI)。

**准确的 3 类模型** (按权威度, 非数据形态):

| 类 | 模块 | 定位 |
|---|---|---|
| ① 公司权威 (签批·喂 AI) | 组织记忆 | 唯一权威 |
| ② 协作产出 | 文档协作 · 多维表格 | 团队工作面 (文档=表达, 多维表格=数据) |
| ③ 个人文件 | 我的资料库 · 云盘 | 私有 (资料库=解析后可编辑, 云盘=原件可共享) |

**认知层 (零风险, 已实施)**:
- [x] 导航 `kb.items` 按 3 类重组 + group 小标题 (`公司权威·签批后喂 AI` / `协作产出` / `个人文件`), 组织记忆置顶。
- [x] `knowledge-hub` 卡片修正 (云盘=S3 原件/共享, 资料库=解析文本个人草稿) + 底部"3 类速记 + 两条易混点 (sheet vs 多维表格 · 资料库 vs 云盘)"。

**Owner 选定: 方案 A** (2026-07-21) —— 云盘为唯一个人文件入口, 弃用「我的资料库」入口, 解析/编辑能力归入文档协作。
- **方案 A**: 补齐云盘 UI (接通 S3 上传) + 弃用/收编「我的资料库」入口 (个人加工归入文档协作个人视图), 5→4。
- 方案 B/C 备选 (未采用)。

**方案 A 执行进度**:
- [x] **Phase 1 · 导航 5→4** (已实施): `nav-modules.ts` 移除「我的资料库」item; `/knowledge` 路由暂留 (存量直链可达)。hub 个人文件卡合并为单一"云盘"。
- [x] **Phase 3-fold · 能力核实 (无需新建)**: 核实 `app/documents/page.tsx:81` `handleUpload` 已用**同一 `parseDocument`** + POST `/api/documents` (type=doc) + 自动 promote-to-memory, 支持同款文件类型。**文档协作 = 我的资料库上传/解析/编辑能力的严格超集** → 折叠无需搬代码, hub "要编辑→上传文档协作解析" 文案真实可用 (非假闭环)。
  - 遗留唯一独有点: 「我的资料库」的"部署对话"(存会话为 .md) 属 niche, 弃用后可另接文档协作或省略。
- [ ] **Phase 2 · 云盘真实上传 UI** (阻塞): 需 S3/MinIO (`S3_ENDPOINT` 未配, 见 §环境)。本地起 MinIO 或加开发态回退后再接通 `/api/drive/presign`。
- [ ] **数据清理**: 12 条 seed knowledgeNodes (纯 showcase, 无真实用户数据), 已离导航, 可后续脚本清理。

**存量核实** (2026-07-21): `knowledge_nodes`=12 (admin 6 + 另一用户 6, 均 seed-showcase), `drive_files_legacy`=0, `documents_legacy`=0 → 无真实用户数据, 弃用/迁移零风险。

### 8.7 关于"部门体系预设归属"为何移除 (2026-07-21)

用户质疑: 原「我的资料库」按 公司/部门/团队/个人 打 `ownership` 标签的模式为何不要。核实结论: **它从来不是真归属管理, 是会误导的假标签** ——
- **不是访问控制**: `KnowledgeNode` 按 `ownerId` 隔离, 标"公司/部门"文件仍只有本人可见, 不共享给部门/全员。
- **不喂 AI**: 无任何 AI 决策路径读取 `KnowledgeNode.ownership` (类型注释明确"仅做可见性语义标记")。
- **制造治理幻觉**: 员工误以为"标公司=成了公司知识", 实则无事发生 (=P0 根除对象)。

真机制未动: 全员权威→**组织记忆 `/memories` 签批**; OKR 归属解析→`lib/org/ownership.ts`; 文件真共享→**云盘 `DriveFile.permissions`** (真 ACL)。若确需"真·部门共享", 应基于云盘 permissions 做新功能, 而非恢复假标签 (待 Owner 决定)。

### 8.8 升级: Owner 明确"组织云盘 + AI 蒸馏飞轮" 愿景 (2026-07-21)

Owner 澄清真实意图 (远大于清理): **云盘按组织架构组织, 个人隶属部门有预设主目录, 能看被授权的组织内他人资料 (类云服务器); 各租户配置后中央 AI 定期扫描蒸馏全公司内容, 发现价值 → 进化组织记忆完整度; 我的资料库是大云盘体系的组成部分。**

- 这**升级而非推翻** §8.7: 部门归属不是要删的假标签, 而是要**做成真的** —— 但严格拆分两轴: **可见性由 ACL 管 / 权威度由签批管**。AI 扫描全池只产出 pending 提议, 经签批才成权威 (Constitution A), 故与 P0 自洽。
- Owner 选定"先出详细设计文档" → 见 **`docs/ORG-DRIVE-DISTILLATION-DESIGN-2026-07-21.md`** (数据模型/ACL/预设目录/蒸馏飞轮/分期 A-D/文件改动图/测试计划/6 个开放问题)。
- 方案 A 的 Phase 1 (导航 5→4) 成果并入新体系 Phase B (我的资料库归位)。

---

## 附录: 关联文件速查

| 主题 | 文件 |
|---|---|
| 四层类型 | `lib/types/memory.ts` |
| 检索 | `lib/memory/retriever.ts` |
| 重排 | `lib/memory/reranker.ts` |
| 入口镜片 | `lib/memory/baseline-guard.ts` |
| 出口镜片 | `lib/memory/output-guard.ts` |
| 签批流 | `lib/memory/promotion-flow.ts` |
| 文本→Memory | `lib/services/text-promotion.ts` |
| embedding 服务 | `lib/infra/embedding.ts` |
| embedding 回填 | `scripts/backfill-embeddings.mjs` |
| Steward 台 | `app/admin/steward/page.tsx` |
| 基线台 (占位) | `app/admin/baseline/page.tsx` |
| 架构 SSOT | `docs/KNOWLEDGE-ARCHITECTURE.md` |
