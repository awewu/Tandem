Status: ready-for-agent

# Everhot 独立根路径部署

## What to build

让 Everhot 官网能够作为独立站点部署在域名根路径。公开页面、静态资源、导航、搜索、产品链接和详情链接不得依赖 `/everhot/` 基路径。

本 issue 只调整独立部署与链接行为，不重写官网技术栈，也不引入新的发布或回滚系统。

## Acceptance criteria

- [ ] 首页能够通过 `/` 直接访问，不发生自重定向或重定向循环。
- [ ] 产品中心能够通过 `/products/` 访问。
- [ ] 产品详情链接不包含 `/everhot/`。
- [ ] CSS、JavaScript、字体、图片、favicon、导航和页脚链接均从根路径正确加载。
- [ ] 本地服务和生产部署配置都支持空 base path。
- [ ] robots、sitemap、canonical 和站内链接使用 Everhot 独立域名的根路径语义。
- [ ] 桌面和移动视口下关键页面可访问，链接审计无失效内部链接。

## Blocked by

None - can start immediately.

## Comments

