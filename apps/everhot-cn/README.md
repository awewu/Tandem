# 恒热 EVERHOT 中国站（everhot-cn）

独立品牌站（静态站，自有域名 `everhot.com.cn`，部署在域名根路径 `/`）。

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
