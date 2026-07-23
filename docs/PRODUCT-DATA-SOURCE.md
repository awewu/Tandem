# 产品数据源统一方案

> 目标：把散落在多个应用/脚本里的产品数据收敛到 `services/api/src/modules/product-catalog`，作为唯一事实源。

---

## 一、现状

| 位置 | 产品数据形式 | 问题 |
|---|---|---|
| `apps/public-portal/src/lib/products.ts` | 硬编码 JS 数组 | 与后端不同步，需手工维护 |
| `apps/product-catalog/src/app/page.tsx` | 未知/占位 | 可能未真正接入 product-catalog |
| `apps/everhot-cn/scripts/sync:products` `fetch:products` | 构建期拉取 | 已部分接入，但只服务 everhot |
| `apps/consumer-diagnosis` 新 /diagnosis | 后端 `/api/v2/diagnosis/quote` | 报价依赖 product-catalog 目录价 |
| `nexus-console /comfort/catalog` | 已接入 `/api/v2/product-catalog/devices` | ✅ 本阶段完成 |

---

## 二、唯一事实源

```
services/api/src/modules/product-catalog
├── 受保护编辑面：/api/v2/product-catalog/devices
├── 受保护运营面：/api/v2/product-catalog/devices/:id/content
└── 公开只读面：/api/v2/brand/:slug/products
```

- **后台编辑、成本价、发布工作流** 走受保护端点。
- **品牌站、集团官网、AI 问诊** 走公开只读端点。
- `:slug` 与 `brand` 字段对应：`everhot`、`rheem`、`ruud`、`lithnova`、集团聚合品牌如 `rhautt`。

---

## 三、各消费方改造路线

### 3.1 public-portal（集团官网）

当前 `apps/public-portal/src/lib/products.ts` 为硬编码。

改造：
1. 新增公开品牌 `rhautt`（或复用 `rheem`）作为集团产品门户的数据门牌。
2. `app/products/page.tsx` 改为 Server Component，调用 `fetch('/api/v2/brand/rhautt/products')`。
3. 把返回的 `{ sku, name, brand, category, localeContent }` 映射到现有卡片视觉字段（`name`、`desc`、`metric`、`brand`、`cat`）。
4. 保留 fallback：API 不可用时降级到本地 `PRODUCTS`，避免白屏。

### 3.2 product-catalog（独立应用）

该应用应成为「产品目录展示」的官方入口：
1. 首页直接调用 `/api/v2/brand/:slug/products`。
2. 支持按品牌切换、搜索、对比。

### 3.3 everhot-cn / rheem-cn / ruud-cn / lithnova-cn

- 已接入的 everhot 继续用 `/api/v2/brand/everhot/products`。
- 其它品牌站同步接入各自 slug 端点，替换硬编码/占位页。

### 3.4 consumer-diagnosis / AI 问诊

`diagnosis/quote` 已依赖 product-catalog 目录价。前端如要展示推荐产品，应调用：

```
POST /api/v2/brand/:slug/recommend
```

---

## 四、数据契约

消费方只应依赖以下字段，避免被内部 schema 变更影响：

```ts
interface PublicProduct {
  sku: string;
  brand: string;
  category?: string;
  name: string;
  desc?: string;
  image?: string;
  highlights?: string[];
  specs?: Record<string, string>;
  isPublished: boolean;
}
```

后台内部字段（`costPrice`、`supplier`、`margin`）不应对外暴露。

---

## 五、已完成的步骤

- `nexus-console /comfort/catalog` 已接入 `/api/v2/product-catalog/devices`，展示「品牌-产品数-最近更新」表。

---

## 六、下一步建议

1. 为集团官网确定 `slug`（推荐新增 `rhautt`）。
2. 改造 `public-portal/products` 为 Server Component 并接入公开产品 API。
3. 逐步移除 `apps/public-portal/src/lib/products.ts` 硬编码。
4. 在 everhot-cn 外，为 rheem/ruud/lithnova 建立同样的构建期同步脚本。
