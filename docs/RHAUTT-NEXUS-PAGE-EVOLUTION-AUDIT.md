# Rhautt Nexus 页面进化审计 + 路线（E0–E3）

> 审计日期：2026-06-30。范围：`apps/nexus-console`（现代壳）+ `public/*.html`（legacy 巨石页）+ `public/css/*`（令牌层）。
> 配套纪律：`docs/DESIGN-SYSTEM-PRINCIPLES.md`。

---

## 一、现状：两套世界

| | 现代壳 `nexus-console` | Legacy 巨石页 `public/*.html` |
|---|---|---|
| 技术 | Next.js · 动态路由 `[board]/[[...section]]` | 单文件 HTML（1000–2414 行/页）|
| 架构 | 声明式 `lib/boards.ts` → block 渲染器（cards/table/note/live）| 内联 `<style>` + 多 CSS 链接 |
| 定位 | 管理中枢（编排，**不托管**三件套 UI）| 三件套真实功能 UI |
| 主题 | 深色 `--bg #0d0f12` | 浅色 `--bg #f7f9fc` |
| 数据 | `lib/api.ts` 已实现，优雅降级（见 C）| 静态/内联 |

legacy 页清单（行数）：`pain-diagnosis 2414` · `rysnova-bim-designer 1991` · `floorplan-bim 1472` · `designer 1417` · `business-console 1241` · `crm-dashboard 1073` · `design-review 955` · `sales-crm-module 560`。

## 二、关键问题（按严重度）

### P0 · 令牌碎片化（最致命）
`public/css/` 共 8 个 CSS，存在多套竞争令牌：

| 文件 | 行/变量 | 角色 | 处置 |
|---|---|---|---|
| `rheem-official-tokens.css` | 110 / 49 | **已验证的 primitive→semantic→component 系统**（rheem.com 实测）| ✅ 定为**单一真相源** |
| `rhautt-comfort-tokens.css` | 244 / 103 | `--rc-*` 品牌运营层（多品牌 hover 覆盖）| ⮕ 改为**别名** rheem-official |
| `design-system-v2.css` | 540 / 59 | 新版组件/令牌 | ⮕ 保留，向单一源对齐 |
| `design-system.css` | 2062 / 37 | v1 旧版 | ⚠️ **弃用**，迁移到 v2 |
| `rhautt-operational-surfaces.css` | 463 / 8 | 运营面组件 | 组件层，消费令牌 |
| `rhautt-production-workbench.css` | 620 / 0 | 工作台组件 | 组件层，消费令牌 |
| `common-components.css` | 381 / 0 | 通用组件 | 组件层，消费令牌 |

**红色现状**：运营侧高度统一在 `#E4002B`（Rheem 官方红，rheem.com 实测 ×143），深色档 `#C20025 / #B60022 / #9B0E26`。**everhot 暖红 `#BF1924` 是品牌专属**，应保留为品牌覆盖层（非错误）。
另发现遗留渐变色 `--primary-purple #764ba2` / `--primary-blue #667eea`（应清除）。

### P1 · 深浅主题割裂
nexus-console 深色 vs legacy 浅色，无统一明暗令牌。先在 CSS 层统一命名与刻度（Figma 双模待编辑席位）。

### P1 · 巨石页不可复用
2000+ 行单文件把结构/样式/逻辑焊死，无组件边界——违背「重复即组件化」。

### P2 · 两套世界无迁移桥
nexus-console 骨架好但占位；legacy 有功能但进不了新壳。

## 三、进化路线

### E0 · 令牌归一（地基）—— 本次已起步（见 B）
- 以 `rheem-official-tokens.css` 为 primitive/semantic 真相源。
- 新增 `public/css/rhautt-tokens.css`：统一入口，补齐**间距阶 / 分层电梯**（对齐 everhot 纪律），提供**品牌覆盖层**（`[data-brand=everhot]` → 暖红）。
- `--rc-*` 逐步改为别名；弃用 design-system v1；清除 purple/blue 渐变残留。

### E1 · 中枢落数据 —— 代码已完成（见 C）
`lib/api.ts` 已实现 `getTenantsCount / getBrandStats / getHealth` + JWT httpOnly cookie + 4s 超时优雅降级；`page.tsx` 的 `withLiveKpis` 已接。**仅需后端 :3300（NestJS `/api/v2`）在跑**即显真实 KPI，否则降级占位。可继续把更多卡片 KPI 接入真实端点。

### E2 · 巨石页组件化迁移
按「一个源组件↔一套规则」，把 `pain-diagnosis / crm-dashboard / design-review / floorplan-bim` 拆为可复用组件，迁入对应 workbench app，消费归一令牌。

### E3 · 统一壳与导航
三件套 workbench 复用 nexus-console 的 Sidebar/Panel/SessionBar 心智，统一明暗主题。

## 四、令牌归一映射（E0 迁移表）

| 旧（散落）| 新（单一源）|
|---|---|
| 内联 `--primary #E4002B` / nexus `--red #e4002b` / `--rc-red-rheem` | `--rh-action-primary`（= rheem `--rheem-color-red`）|
| `--primary-dark #8d0d20` / `--rheem-red-dark #9B0E26` | `--rh-action-primary-hover`（= `--rheem-color-red-deep`）|
| 各页 `--bg` / `--card` / `--border` | `--rh-surface-page` / `--rh-surface-panel` / `--rh-border` |
| 散装 px 间距 | `--rh-space-*`（4px 基数尺）|
| 各页 box-shadow | `--rh-elev-1/2/3` |
| everhot `--red #BF1924` | 品牌覆盖层 `[data-brand=everhot]`，保留 |
| `--primary-purple` / `--primary-blue` | 删除 |
