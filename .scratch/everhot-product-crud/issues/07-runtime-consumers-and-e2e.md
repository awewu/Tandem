Status: ready-for-agent

# 官网产品消费面切换与端到端验收

## What to build

把 Everhot 官网所有依赖产品目录的现有消费面统一切换到运行时公开 API，并完成最终最小闭环验收。首页、分类、详情、搜索、选型和对比应共享同一个异步产品目录加载机制，不再把构建期产品数据文件作为运行时事实源。

部署优先使用 Everhot 域名下的同源 API 反向代理，避免在页面中写死平台 API 地址。只增加必要的加载、失败、空数据和未找到状态，不引入新的发布、安全审计或回滚系统。

## Acceptance criteria

- [ ] 首页精选、分类列表、产品详情、搜索、选型和对比读取同一运行时产品目录。
- [ ] 产品目录只请求一次并在页面会话内复用，详情可按 slug 获取单品数据。
- [ ] API 加载期间页面结构稳定，不显示旧占位产品。
- [ ] API 失败、空目录和产品不存在时显示明确且可恢复的页面状态。
- [ ] 管理端新增、编辑、上下架、排序、图片、规格、亮点和推荐变更无需重建官网即可生效。
- [ ] Everhot 正式页面 URL 不包含 `/everhot/`，后端品牌 API 标识不影响页面 URL。
- [ ] 产品公开 API 和公开素材可通过 Everhot 部署层同源访问。
- [ ] 完整演示路径通过：新增产品、填写内容、上传图片、配置推荐、上架、官网查看、下架和删除。
- [ ] 完整演示从“网站管理”点击 Everhot 进入 `/comfort/sites/everhot/products` 开始，而不是从独立或重复的产品管理入口开始。
- [ ] PDF、规格书和技术资料上传未被引入本次实现。

## Blocked by

- [01 Everhot 基础产品 CRUD 闭环](./01-basic-product-crud.md)
- [02 Everhot 独立根路径部署](./02-root-path-deployment.md)
- [03 产品上下架、删除与官网排序](./03-product-status-and-order.md)
- [04 产品主图与详情图片闭环](./04-product-images.md)
- [05 规格参数与产品亮点编辑](./05-specs-and-highlights.md)
- [06 推荐产品配置与跳转](./06-product-recommendations.md)

## Comments
