# Native Brand Site Content Console Issue 拆分

来源 PRD：`docs/dev/native-brand-site-console-prd.md`

本拆分遵循本仓库本地 issue 约定，正式 issue 文件发布在 `docs/dev/native-brand-site-console-issues/`。每个 issue 都按可领取的 vertical slice 编写，优先保证一条可验证的端到端路径，而不是按纯前端/纯后端分层拆分。

## Issue 列表

| Issue | 标题 | 类型 | 依赖 | 并发批次 |
| --- | --- | --- | --- | --- |
| 01 | 品牌站点路由切换到原生内容控制台壳 | AFK | 无 | Wave 0 |
| 02 | 品牌产品列表与 taxonomy 数据适配 | AFK | 无 | Wave 0 |
| 03 | 产品行内编辑、保存和上新闭环 | AFK | 02 | Wave 1 |
| 04 | 上架/下架、删除/归档和权限门禁 | AFK | 02 | Wave 1 |
| 05 | 主图、详情图和素材引用管理 | AFK | 02 | Wave 1 |
| 06 | 结构化官网内容编辑器迁移 | AFK | 03 | Wave 2 |
| 07 | 品牌发布/静态备份原生动作 | AFK | 02, 04 | Wave 2 |
| 08 | 多品牌空态、菜单联动和验收守卫 | AFK | 01, 02, 03, 04, 05, 06, 07 | Wave 3 |

## 可并发执行顺序

### Wave 0：第一批，可立即并发

1. `01-native-brand-route-shell`
2. `02-brand-product-data-adapter`

说明：01 建立 `/comfort/sites/:brandCode` 的原生页面壳和 no-iframe 路由行为；02 打通品牌产品列表、taxonomy、品牌/租户映射的数据读取。二者可以并行，但需要约定 shared props/data shape。

### Wave 1：核心操作，可并发

1. `03-product-inline-edit-create`
2. `04-product-status-delete-rbac`
3. `05-product-image-asset-management`

说明：这三个 issue 都依赖 02 的产品数据适配，但彼此关注不同操作面：字段保存/上新、状态与删除、图片与素材。建议不同 agent 尽量通过同一个窄 product console adapter 接口接入，减少冲突。

### Wave 2：高级内容和发布，可并发

1. `06-structured-website-content-editors`
2. `07-brand-publish-static-backup`

说明：06 做 5012 中较深的 specs/features/gallery/faqs/positioning 等编辑器；07 做发布/静态备份动作。二者可并发。

### Wave 3：收口验收

1. `08-multibrand-empty-state-menu-guards`

说明：最后统一验证新增品牌、空数据品牌、菜单顺序、Brand Operations 固定最后、no iframe、VI 一致性和守卫命令。

## 第一批并发执行提示词

### Agent A：Issue 01

```text
请实现 docs/dev/native-brand-site-console-issues/01-native-brand-route-shell.md。

要求先读取 AGENTS.md、docs/AGENT-MEMORY.md、docs/dev/native-brand-site-console-prd.md 和该 issue 文件。只做 Issue 01 范围：让 /comfort/sites/:brandCode 从一行筛选表切换为原生品牌内容控制台壳，保留 /comfort/sites 主数据 CRUD，不使用 iframe，不嵌入 5012。完成后运行 apps/dealer-workbench build，并用页面检查证明 /comfort/sites/everhot 不含 iframe。
```

### Agent B：Issue 02

```text
请实现 docs/dev/native-brand-site-console-issues/02-brand-product-data-adapter.md。

要求先读取 AGENTS.md、docs/AGENT-MEMORY.md、docs/dev/native-brand-site-console-prd.md 和该 issue 文件。只做 Issue 02 范围：为 5000 原生品牌内容控制台建立品牌产品列表和 taxonomy 数据适配，复用现有 /api/v2/product-catalog 与 /api/v2/brand-sites 能力，避免把 5012 的 session/login 复制过来。完成后用测试或浏览器脚本证明 Everhot 产品列表能在原生页读取，未知品牌显示可操作空态。
```

## 执行注意

1. 不允许 iframe，不允许嵌入或跳转到 `localhost:5012` 作为实现。
2. 5012 只能作为功能和字段参考。
3. 5000 的 Nexus auth/RBAC 是权限来源，不迁移 5012 dev login。
4. 新生产 API 必须位于 `/api/v2/*` 并有 route ownership。
5. 不要向 `server-production.js` 新增业务路由。
6. 新增品牌必须保留在 Brand Operations 上方；Brand Operations 永远是二级菜单最后一项。
