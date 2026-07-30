# 第一批可并发执行 Issue 提示词

以下 3 个任务可以第一批并发启动。并发时请各自严格限制改动范围，避免跨 issue 抢同一职责。

## Prompt A - 数据模型与 API 合同

请执行 `docs/dev/official-site-product-detail-issues/01-data-model-and-api-contract.md`。

要求：
- 先从产品/官网产品相关路径入手，不要全仓库无差别搜索。
- 找出现有产品模型、DTO、保存接口、详情读取接口和官网产品详情接口。
- 增加官网产品详情富文本字段，字段优先命名为 `officialDetailHtml`，如果现有命名体系明显不同，请沿用现有体系并在总结中说明。
- 确保字段保存到数据库，不允许只落前端状态、静态 JSON 或内存。
- 不实现后台编辑器 UI，不实现前台页面样式，只完成数据/API 合同和必要测试。
- 验证后报告运行过的测试/门禁，跳过项说明原因。

## Prompt B - 后台富文本编辑器 UI 骨架

请执行 `docs/dev/official-site-product-detail-issues/02-admin-rich-text-editor.md`，可以先做 UI 骨架并预留 `officialDetailHtml` 字段接入点。

要求：
- 先定位当前产品新增/编辑页和现有富文本/上传组件。
- 在产品表单中增加“官网产品详情”富文本区域。
- 文案明确：推荐上传宽度 750px 的详情图片，高度不限。
- 内容变化进入产品表单状态；如果 API 字段尚未合并，使用 `officialDetailHtml` 作为预期字段并标注联调点。
- 不修改数据库模型，不实现官网前台详情页。
- UI 遵循现有 Rhautt Nexus / Rheem VI 和产品表单布局。
- 运行相关前端构建或组件测试；无法运行需说明。

## Prompt C - 官网详情页路由与 750px 渲染骨架

请执行 `docs/dev/official-site-product-detail-issues/05-official-site-detail-page-rendering.md`，可以先用现有产品详情接口或 mock 字段做前台骨架。

要求：
- 先定位官网产品列表、点击跳转逻辑、产品详情页或可新增的详情页位置。
- 实现产品点击进入官网产品详情页的路径。
- 详情页预留读取 `officialDetailHtml` 的渲染区域。
- 富文本正文最大宽度 750px，居中；图片 `max-width: 100%`、`height: auto`，长图自然向下滚动。
- 无详情内容时不报错，展示基础信息和合理空态。
- 不做后台编辑器，不改数据库迁移。
- 运行相关官网前端构建或 smoke；无法运行需说明。

## 第一批之后的汇合顺序

1. 在 A 确定字段和接口后，B 做保存联调并推进 04。
2. 在 A 确定前台接口后，C 做真实数据联调。
3. B/C 完成图片链路后推进 03。
4. 真实渲染完成后推进 06 安全清洗。
5. 全部完成后执行 07 端到端验收与门禁。
