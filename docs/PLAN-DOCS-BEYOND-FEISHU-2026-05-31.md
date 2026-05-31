# 文档板块 · 超越飞书 · 三阶段落地计划

> 立项: 2026-05-31 凌晨
> 起因: Owner 巡检 `/documents` 时指出 "如何上传和调用文件? 多维表格太简单, 没超越飞书"
> 战场: Tandem 文档板块 = AI 原生 × 知识资产 (Memory) × 决策资产 (议事), 不跟飞书拼"协同/公式/同步"

---

## 现状诊断 (2026-05-31)

| 能力                            | 现状                                         | 缺口                       |
| ------------------------------- | -------------------------------------------- | -------------------------- |
| 文件解析 (docx/xlsx/pptx/pdf)  | ✅ `lib/document-parser.ts`                  | —                          |
| 上传到 `/knowledge`             | ✅ `app/knowledge/page.tsx`                  | 不在 `/documents`         |
| 上传到 `/documents`             | ❌                                            | **D-01**                   |
| @ 文件进 chat/议事/persona     | ❌                                            | **D-01 拓展**              |
| 上传即提议升级 Memory          | ❌ (`promoteDocumentToMemory` 仅手工触发)    | **D-04**                   |
| 多维表格 (真 bitable)          | ❌ (sheet 仅空白 CollabTextarea)             | **D-02**                   |
| 协同编辑 (Yjs)                  | ✅ `components/documents/collab-textarea.tsx`| —                          |
| 升级 Memory + 发起议事 按钮    | ✅ `/documents/[id]`                          | —                          |

---

## 三阶段 · D-01 → D-04 → D-02

### 阶段 1 · D-01 @ 文件进上下文 (2-3 天 · 最底层)

**目标**: chat / 议事 / persona 任何对话都能 @ 一个文件, LLM 拿到原文.

任务:

- [ ] `/documents` 加 "上传" 按钮 (复用 `parseDocument`)
- [ ] 上传后落 Document (`type=doc`, `content=parsed text`, metadata 标 `source: upload`)
- [ ] 新增 `GET /api/documents/search?q=` (按 title 全文检索)
- [ ] 新增 `<DocumentMentionPicker>` 组件 (Cmd+K 调出, 模糊搜索, 插入 `[[doc:id|title]]`)
- [ ] 在 chat / 议事 / persona builder 的输入框集成 picker (检测 @ 触发)
- [ ] 在 LLM compose-prompt 链路里加 `resolveDocumentMentions(text)` — 把 `[[doc:id|title]]` 展开为 `<file title="..."><content>...</content></file>` 注入 systemContent
- [ ] 单测覆盖 resolver + picker 搜索

差异化点: 飞书 @ 只跳转, Tandem @ 把内容**真送进 LLM**.

### 阶段 2 · D-04 上传即提议升级 (1-2 天 · 复用现有)

**目标**: 用户传 PDF/Word, 不只是存, 自动塞进"待提议升级 Memory"队列, 走宪章 §8.1 三级签批.

任务:

- [ ] 上传 UI 加复选框 "提议升级为团队/部门/公司级 Memory" (默认勾"团队级")
- [ ] 勾选 → 调 `promoteDocumentToMemory({ documentId, triggeredBy, level })`
- [ ] `/memories` 队列页显示来源 = `document` 的提议, 带文档反链
- [ ] 单测: 上传 + 自动 promote 端到端

差异化点: 飞书云盘是死存档, Tandem 上传 = 触发知识沉淀工作流.

### 阶段 3 · D-02 多维表格 AI 列 (5-7 天 · 重头戏)

**目标**: 重写 `sheet` 为真 bitable, 字段类型化, 加 AI 列能调 LLM 跑每行.

任务:

- [ ] 数据模型: `BitableSchema` (字段定义) + `BitableRow` (行数据)
  - 字段类型: `text / number / date / select / multi-select / user / url / checkbox / **ai_compute**`
- [ ] AI 列定义: `{ kind: 'ai_compute', prompt: string, dependsOn: fieldId[], model: 'fast'|'standard' }`
- [ ] 后端 `POST /api/bitable/:tableId/rows/:rowId/compute-ai-cell` (按 row 调 LLM)
- [ ] 前端 `<BitableView>` 替换现在的 sheet CollabTextarea (用 TanStack Table)
- [ ] 行右键菜单: "对这行发起议事" (复用 `/convergence?fromBitableRowId=...`)
- [ ] 行 → Memory: 任意行可"沉淀为 Memory" (D-04 流程)
- [ ] 单测: AI 列计算 + 行级议事派生

差异化点 (飞书做不到):

- AI 列**真调 LLM** 不是公式 (飞书要等 18 个月)
- 行级议事派生 — bitable 跟决策资产打通
- 行 → Memory — bitable 跟知识资产打通

---

## 验收标准

| 阶段 | 验收                                                                                  |
| ---- | ------------------------------------------------------------------------------------- |
| D-01 | 在议事室 @ 一份合同 PDF, LLM 真答得出合同里的条款                                       |
| D-04 | 上传 SOP.docx, `/memories` 队列 5s 内出现新提议                                          |
| D-02 | 建一张 "员工 OKR 表", AI 列 prompt = "评估这一行进度", 跑 10 行 < 30s, 行右键能发起议事 |

---

## 不在范围 (后续单独立项)

- D-03 行级议事 (已在 D-02 内)
- D-05 AI 反向 inline 评论 (太重, 留待 v2)
- D-06 `@OKR-XX` first-class 引用 (D-01 验证后再加这条)
- 公式引擎 (跟飞书拼公式没意义, 跳过)
- 富文本工具栏增强 (留给 CollabTextarea 自然演进)

---

## 风险 / 决策点

1. **D-01 resolver 注入策略**: 直接拼到 systemContent 头? 还是用工具调用 (function call) 让 LLM 主动取? — 一期先简单拼, 后期看 token 开销决定
2. **D-02 bitable 数据模型**: 单独 table 还是复用 Document.content (JSON)? — 一期复用 Document, AI 列独立表
3. **D-02 AI 列模型选择**: 全用 standard 太贵, 全用 fast 太弱 — 默认 fast, 用户可切 standard

---

## 进度跟踪

- [ ] D-01 阶段 1 开工 (2026-05-31)
- [ ] D-01 验收
- [ ] D-04 开工
- [ ] D-04 验收
- [ ] D-02 开工
- [ ] D-02 验收
- [ ] 整体上线 + Owner 验收 "@ PDF 议事 + bitable AI 列" 真实演示
