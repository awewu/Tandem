# 恒热 EVERHOT 中国站（everhot-cn）

独立品牌站（静态站，自有域名 `everhot.com.cn`，部署在域名根路径 `/`）。

## 后台图片同步（A/B 分离部署）

当官网运行在服务器 A、Nexus 后台/API 运行在服务器 B 时，A 同时作为官网公开图片源：

- A 设置 `EVERHOT_MEDIA_ROOT` 为部署目录之外的持久化目录，例如 `E:\data\everhot-media`。
- A 设置 `EVERHOT_MEDIA_SYNC_TOKEN`，只允许 B 调用 `POST /internal/media-sync`。
- B 设置 `SITE_MEDIA_ORIGIN_URL`、`SITE_MEDIA_SYNC_URL` 和相同的 `SITE_MEDIA_SYNC_TOKEN`。
- 首页素材写入 A 的 `site-materials/`，其他官网公开图片写入 A 的 `artifacts/`。
- JPG/PNG 保留原格式；B 只有在 A 写入并通过公网 `HEAD` 校验后才返回上传成功。

不要把客户户型图、工程交付物或其他私有文件同步到官网媒体目录。同步范围由 B 的
`PUBLIC_SITE_IMAGE_TYPES` 白名单控制。

如果 A 前面还有 Nginx，必须将 `/internal/media-sync`、`/media/` 和
`/assets/img/site-materials/` 代理到 Everhot Node 服务，不能让 Nginx 的旧静态目录提前截获这些路径。

B 部署新代码后，先预览历史图片迁移，再显式执行写入：

```powershell
npm.cmd run deploy:sync-site-images-to-a
npm.cmd run deploy:sync-site-images-to-a -- --apply
```

迁移脚本会同步现有产品图、资讯图、Logo 和首页 manifest；数据库有记录但 B 的 `storage`
中已经缺失的图片不会伪造，脚本会列出并要求重新上传。

## 📖 先读这个：官网建设总纲

> **[`docs/EVERHOT-WEBSITE-HANDBOOK.md`](../../docs/EVERHOT-WEBSITE-HANDBOOK.md)** —— 恒热官网建设/运维/迭代的**单一事实源**。
> 架构、VI/UI 标准、标准操作手册（SOP）、常见问题排查（FAQ）、规划路线图。**任何人接手先读它。**

## 快速上手

```bash
# 本地起官网静态站（:5011）
npm run dev

# 从 Nexus 重生成静态数据 + 图，再做 GEO/SEO + 链接审计
npm run build
```

常用单步：
| 命令 | 作用 |
|---|---|
| `npm run fetch:products` | 从 Nexus 公开端点重生成 `public/js/products-data.js` |
| `npm run fetch:images` | 从 DAM 拉产品图，重生成 `public/js/product-images.js` |
| `npm run sync:products` | 把 `products-data.js` 导入 Nexus（幂等） |
| `npm run sync:images` | 把产品图上传 DAM（默认只传 `owned` 授权图） |
| `npm run gen:subtypes` | 生成商用子类型 SEO 落地页 |

> ⚠️ `public/js/products-data.js`、`public/js/product-images.js`、`public/assets/img/products/` 是**构建产物，勿手改**。
> 改数据请走后台 `apps/brand-console`（:5012）或直接改 Nexus，再「发布/构建」重生成。

## 关联文档
- 总纲：[`docs/EVERHOT-WEBSITE-HANDBOOK.md`](../../docs/EVERHOT-WEBSITE-HANDBOOK.md)
- VI 规范：[`VI-SPEC.md`](./VI-SPEC.md) · 设计令牌：[`DESIGN-TOKENS-README.md`](./DESIGN-TOKENS-README.md)
- 对标审计：[`docs/EVERHOT-RHEEM-PARITY-AUDIT.md`](../../docs/EVERHOT-RHEEM-PARITY-AUDIT.md)
- 后台数据打通：[`docs/EVERHOT-NEXUS-INTEGRATION-DESIGN.md`](../../docs/EVERHOT-NEXUS-INTEGRATION-DESIGN.md)
