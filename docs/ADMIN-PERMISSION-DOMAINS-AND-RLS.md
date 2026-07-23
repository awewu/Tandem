# 后台权限域 × 数据库 RLS 策略设计（6 域制）

> 平台：瑞诺瓦AI舒适家 · Rhautt Nexus / 瑞合数智枢纽
> 事实源：`PROJECT-CHARTER.md` 1.2.2。本文件是**展示/权限视图层**设计，映射到宪章的板块与数据平面；**不改变任何数据平面的单写归属**。
> 生效：2026-07-01 · 修订：2026-07-01（产品独立一级，5 域→6 域）· 状态：设计锁定。
> 决策：6 域制（D0 平台与系统 + D1 品牌管理 + D2 产品 + D3 用户与体验 + D4 客户与赋能 + D5 推广与增长）；用户/客户边界按「是否绑定租户」切。

---

## 0. 三条被锁定的边界

1. **6 个权限域**：五业务域 + 第 0 域「平台与系统」（底座横切能力单独授权）。
2. **品牌与产品分治**：**D1 品牌管理**下各品牌网站为二级模块（`brand_scope` 站点级授权）；**D2 产品**为独立一级域，主写产品/规格/SKU/系统包，供各站与经营域只读消费。
3. **用户 vs 客户 = 是否绑定租户**：
   - **D3 用户与体验** = 匿名 / 公域获客，落在 **anonymous/public 暂存租户**。
   - **D4 客户与赋能** = 已绑定租户（经销商 + 门店 + 签约客户）。
   - 留资成交即触发 **D3 → D4 迁移**（暂存线索绑定到正式租户）。

---

## 1. 六大权限域总表

| 域 | 名称 | 对应宪章板块 | NestJS 模块（写归属） | 主数据平面（单写） | 只读跨平面 | RLS 主键 |
|---|---|---|---|---|---|---|
| D0 | 平台与系统 | 底座/控制平面 | `auth` `entitlement` `tenant` `governance` `notification` `workflow` `mdm` `compliance` `analytics` | 底座主库 / 分析数仓 | 各库 CDC | 平台角色（超域） |
| D1 | 品牌管理 | 板块一 | `brand` `file-artifact`(DAM) | 品牌运营库 | brand-registry · 产品(只读) | `tenant_id`=总部 + `brand_scope` |
| D2 | 产品 | 板块一 | `product-catalog` | 品牌运营库 | brand-registry | `tenant_id`=总部 + `product_line_scope` |
| D3 | 用户与体验 | 横切 · C 端获客 | `ingress` `diagnosis`(public) `notification`(触达) | 赋能库 + **公域暂存租户** | 产品(展示) | **`tenant_id`=anonymous/public** |
| D4 | 客户与赋能 | 板块二 | `crm` `quote` `design` `rysnova-bim` `ai-design` `delivery` `lifecycle` `aftersales` | 赋能库 + Mongo + 对象存储 | 产品(价格/参数快照) | **`tenant_id`+`dealer_id`+`store_id`+`role`** |
| D5 | 推广与增长 | 板块三 增长中枢 | `growth`(规划) | 增长库 | 品牌运营库 · 分析数仓 | `tenant_id`=总部 + `hq_marketing` |

> D1 品牌管理的**二级模块**（站点级）：集团官网、Rheem 中国站、Ruud 中国站、Everhot 恒热官网 —— 各站按 `brand_scope` 独立授权，统一在品牌管理域下治理。
> 后台一级导航 = 这 6 个域。角色按域授权；每个 API 的 owner 已在 `services/api/src/modules/module-boundary.ts` 标注，导航与授权据此自动对齐。

---

## 2. 角色 × 域 权限矩阵（首版）

| 角色 | D0 平台 | D1 品牌管理 | D2 产品 | D3 用户体验 | D4 客户赋能 | D5 推广增长 |
|---|---|---|---|---|---|---|
| `platform_admin` 超管 | 读写 | 读写 | 读写 | 读写 | 读写 | 读写 |
| `sre` / `security` | 读+运维 | - | - | - | - | - |
| `compliance` 合规 | 审计读 | - | - | 同意/撤回读写 | PII 策略读写 | AI 产出核准读 |
| `hq_ops` 总部运营 | 读 | 读 | 读 | 读 | 跨租户汇总读 | 读 |
| `brand_ops` 品牌运营 | - | 读写(站点级) | 读 | - | - | 素材读 |
| `product_manager` 产品经理 | - | 产品读 | 读写 | - | - | - |
| `hq_marketing` 市场部 | - | 内容读 | 读 | 获客读 | 线索读 | 读写 |
| `dealer_admin` 经销商管理员 | - | 品牌读 | 产品读 | 本租户线索读 | 本租户读写 | - |
| `sales` 销售 | - | - | 产品读 | 本人线索读 | 本人商机读写 | - |
| `designer` 设计师 | - | - | 产品读 | - | 本人设计/报价读写 | - |
| `delivery` 交付 | - | - | - | - | 本租户施工/验收读写 | - |
| `customer` 签约客户 | - | - | - | 本人分享页读 | **本人项目读**（门户） | - |
| `anonymous` 公域访客 | - | 公开读 | 公开读 | **匿名问诊/留资写** | - | - |

规则：
- 域授权是**粗粒度门**，域内再按 `tenant/dealer/store/owner`（D1 再按 `brand_scope` 站点、D2 按 `product_line_scope`）做 RLS 细粒度。
- `customer` 属 D4 但只读**本人项目**（不是经营数据）；其 C 端分享入口在 D3。
- `anonymous` 只能写 D3 的匿名问诊/留资，永远打不进 D4 的经营数据（信任边界）。

---

## 3. RLS 策略设计（PostgreSQL，沿用迁移 004/005 模式）

### 3.1 通用会话变量（每请求由 `withRlsTransaction` 注入）
```
app.tenant_id   -- 当前租户；匿名域=公域暂存租户ID
app.actor_id    -- 当前用户/系统 actor
app.role        -- 角色（决定域门 + 细粒度）
app.dealer_id / app.store_id  -- D4 经营隔离
app.brand_scope / app.product_line_scope  -- D1 站点 / D2 产品线细粒度
```

### 3.2 D3（公域/用户体验）策略
- 所有 D3 写表（问诊会话、ingress 线索暂存）强制 `tenant_id = current_setting('app.tenant_id')`，且该值必须是**公域暂存租户白名单**之一。
- 匿名写入禁止携带真实 `dealer_id/store_id`（防止越权写进经营域）。
- 只读产品展示：走 D2 产品只读视图，无 PII。

### 3.3 D4（经营/客户赋能）策略
- 强隔离：`tenant_id` + `dealer_id`（+ `store_id` 视表而定），行级 `USING`/`WITH CHECK` 双向校验。
- `owner_id` 级：`sales`/`designer` 默认只见本人商机/设计，`dealer_admin` 见本租户全量。
- `customer` 门户：仅 `customer_id = app.actor_id` 的项目行可读。

### 3.4 D1 品牌管理 / D2 产品 策略
- D1：`tenant_id`=总部 + `brand_scope`——`brand_ops` 只写被授权的品牌站点（集团/Rheem/Ruud/Everhot），跨站点不可写。
- D2：`tenant_id`=总部 + `product_line_scope`——`product_manager` 写本产品线；其余业务域只读产品视图（价格/参数快照）。

### 3.5 D0 / D5
- D0 平台库：仅平台角色；跨租户读走**脱敏分析数仓**，不直连业务 OLTP。
- D5 增长库：`tenant_id`=总部，仅 `hq_marketing`/`brand_ops`；AI 产出行带 `approval_status`，未核准不可导出（应用层 + 约束双保险）。

---

## 4. D3 → D4 迁移（留资成交 = 绑定租户）

这是最关键的机制，直接对应 Flow 1 闭环：

```text
匿名访客 → D3 问诊/留资(公域暂存租户) → ingress.lead 暂存
   │  运营/系统分配经销商租户
   ▼
D4 crm.customer 绑定 tenant/dealer  ←  发 crm 事件迁移
   │  （问诊会话、报告随之 rebind 到正式租户，PIPL 同意继承）
   ▼
经销商在 D4 跟进：商机→报价→设计→签约→交付→生命周期
```

- 迁移经**事件**完成（`lead.assigned` / `lead.converted`），不跨域直写。
- 迁移是**单向、可审计**：暂存租户数据打标 `migrated_to_tenant`，保留获客归因（供 D5 分析）。
- PIPL：同意范围从"公域问诊"升级为"签约客户服务"时需记录二次同意（compliance 域）。

---

## 5. 后台管理落地

- **一级导航 = 6 域**；D1 品牌管理下二级 = 各品牌网站（集团/Rheem/Ruud/Everhot）。二级应用见 `docs/EXECUTION-ROADMAP-2026-07.md` 与 hub 入口重组。
- 每个菜单项绑定 `module-boundary` 的 owner + 所属域；无权限域的用户不渲染该菜单。
- hub 页（`:54393`）实现：`login`/`staff-portal` 归 D0；品牌各站归 D1；`products` 归 D2；`pain-diagnosis`/`customer-share` 归 D3；`business-console`/`customer-view`/`rysnova-bim`/`solution-matching`/`template-library`/商用设计 归 D4。

---

## 6. 与宪章的关系（不冲突声明）
- 本 6 域是**权限与导航视图**，D1 品牌管理 + D2 产品↔板块一、D4↔板块二、D5↔板块三、D3=C 端获客横切、D0=底座。
- **数据单写归属仍以宪章 1.3 数据平面表为准**；域只决定"谁能看/操作哪些菜单与行"，不决定"谁是数据的写主"。
- 门禁 `guard:permission-domain`：校验每个 NestJS 模块归属唯一权限域、匿名域(D3)不可写经营表(D4)、增长域(D5) AI 产出必须带核准态。
