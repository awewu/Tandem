# EVERHOT 设计令牌 ↔ Figma 同步

`design-tokens.json`（Tokens Studio 格式）是 `public/css/everhot.css` `:root` 的结构化镜像，55 个令牌：`color / color-aux / spacing / radius / fontSize / lineHeight / fontFamily / boxShadow`。每项 `$extensions.web` 记录对应 CSS 变量名（如 `--space-6`），用于 Code Connect 与 Dev Mode 回显。

## 一、导入 Figma（生成 Variables）

> 需要 **editor 席位**。当前账号为 starter + View 席位，无法直接由 MCP 写入；以下为人工一键导入路径。

1. Figma 文件 → Plugins → 安装 **Tokens Studio for Figma**。
2. 插件内 **Tools → Import** → 选择本仓库 `apps/everhot-cn/design-tokens.json`。
3. **Export to Figma → Create Variables**：自动生成同名 Variables collection
   - `spacing/*` → FLOAT，scope `GAP`
   - `radius/*` → FLOAT，scope `CORNER_RADIUS`
   - `color/*`、`color-aux/*` → COLOR
   - `boxShadow/*` → Effect Styles
   - `fontSize/lineHeight/fontFamily` → Typography（合成 Text Styles）
4. 之后双向同步：Figma 改令牌 → 插件 **Export to JSON** 覆盖本文件；代码改 → 重新 Import。

> Starter plan 仅 1 个 mode：本套为单模（无 light/dark）。升级 Professional 后可加 Dark mode 并把语义色改为别名。

## 二、Code Connect（令牌/组件 ↔ 代码）

令牌的 WEB code syntax 即 `$extensions.web` 的 `var(--x)` 形式，Dev Mode 选中元素时回显真实 CSS 变量（而非 hex）。

组件映射（需 editor 席位执行 `send_code_connect_mappings`）建议首批：

| Figma 组件 | 代码位置 | 说明 |
|---|---|---|
| Mega Nav / Util Bar | `public/css/everhot.css` `.ev-util-bar` | 已全 token 化 |
| Mega Panel (compact) | `.ev-mega--compact / .ev-mega-mini` | 右锚定窄面板 |
| Product Card | `.product-card` | 卡片栅格 |
| Section Head | `.section-head` | 区块标题节奏 |

## 三、令牌纪律（已落地）

- **间距只取 `--space-*`**（4px 基数尺）。全文件已转 ~191 处精确刻度。
- **非刻度遗留值**（复审清单）：`3,5,6,7,9,10,11,13,14,15,18,22,26,28,30,34,36,52,56,72,80,120` px —— 多为卡片高/图标尺/特定留白，按需逐项决定是否并入阶梯或保留为组件专属尺寸。
- **颜色/阴影用语义令牌**，禁内联 `rgba(191,25,36,…)`（改 `--red-tint` 等）。
