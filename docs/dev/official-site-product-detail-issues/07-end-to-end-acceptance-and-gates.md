# 07 - 官网产品详情端到端验收与门禁

## What to build

完成官网产品详情从后台编辑、数据库保存、后台回显、官网详情页展示到移动端响应式的端到端验收，并运行相关现有门禁。

## Acceptance Criteria

- [x] 后台可以新增或编辑产品官网详情。
- [x] 富文本中可以插入 750px 宽详情长图。
- [x] 保存后刷新后台页面，详情内容从数据库回显。
- [x] 官网产品列表点击产品进入详情页。
- [x] 官网详情页读取并展示数据库中的详情内容。
- [x] 详情主体最大宽度 750px，居中展示。
- [x] 移动端图片不超屏、不变形。
- [x] 无详情内容产品不报错。
- [x] 富文本危险脚本不执行。
- [x] 记录所有已运行、失败或跳过的测试和门禁。

## Verification

- [x] 运行相关产品/backend/官网展示测试。
- [x] 运行相关现有门禁，例如 `npm.cmd run harness:arch`。
- [x] 如触发官网视觉守卫，运行对应 guard 并记录结果。

## Blocked By

- 01 - 官网产品详情数据模型与 API 合同。
- 02 - 后台官网产品详情富文本编辑器。
- 03 - 详情图上传与 750px 展示规则。
- 04 - 后台保存与数据库回显闭环。
- 05 - 官网产品详情页渲染。
- 06 - 富文本安全清洗与安全渲染。

## Execution Record

Completed on 2026-07-29. See `docs/dev/official-site-product-detail-acceptance-report.md` for the accepted scope, touched files, passed checks, failed gates, skipped manual live-browser checks, and residual risk.
