# Hermes Tandem VI/UI 设计审计与迁移参考

来源项目：`D:\Project\Red\hermes-tandem-main-25e4f561356ec4877e2a6315ab6257a30557928f`

审计时间：2026-07-24

## 1. 项目视觉定位

Hermes Tandem 是一个 Next.js 14 + Tailwind CSS + Radix UI + lucide-react 的企业工作台。它的设计系统在 `app/globals.css` 中直接声明为：

> Tandem Design Tokens (Apple HIG + MS Fluent + Vercel Geist)

整体视觉不是传统后台的重边框表格风格，而是“Apple 式留白和动效 + Microsoft Teams 式左侧应用栏 + Vercel/Linear 式轻量面板”的组合。适合迁移到瑞合数智枢纽的部分主要是：设计 token、两级导航结构、卡片/面板层级、字体体系、lucide 线性图标规范。

## 2. VI 色彩系统

### 2.1 主品牌色

项目主色是 Rheem Red，定义在 `app/globals.css` 和 `tailwind.config.ts`：

| Token | RGB | Hex | 用途 |
| --- | --- | --- | --- |
| `--brand-50` | `252 233 235` | `#FCE9EB` | 浅红背景、选中底色 |
| `--brand-100` | `250 203 207` | `#FACBCF` | 轻提示边框 |
| `--brand-200` | `245 150 156` | `#F5969C` | hover 边框 |
| `--brand-300` | `237 96 104` | `#ED6068` | 深色背景辅助红 |
| `--brand-400` | `220 61 69` | `#DC3D45` | 强提示 |
| `--brand-500` | `200 32 44` | `#C8202C` | 主按钮、主状态、导航激活条 |
| `--brand-600` | `159 24 34` | `#9F1822` | 主按钮 hover |
| `--brand-700` | `126 19 26` | `#7E131A` | 文字强调 |
| `--brand-800` | `93 14 19` | `#5D0E13` | 深色区域 |
| `--brand-900` | `61 9 12` | `#3D090C` | 极深红 |

shadcn 兼容主色为 `--primary: 356 72% 45%`，破坏性操作色 `--destructive` 也被统一到红色体系。

### 2.2 辅助品牌色与中性色

Rheem/Teams 风格的关键辅助色：

| Token | Hex | 用途 |
| --- | --- | --- |
| `--rheem-charcoal` | `#1F1F1F` | 桌面左侧 AppRail 背景 |
| `--rheem-charcoal-2` | `#2B2B2B` | AppRail hover/active 背景 |
| `--rheem-ink-black` | `#0E0E0E` | 大标题、强品牌文字 |
| `--rheem-steel` | `#5C6470` | 次级文字 |
| `--rheem-hairline` | `#E5E7EB` | 细分割线 |

界面 surface 采用 Apple System Gray 思路：

| Token | Hex | 用途 |
| --- | --- | --- |
| `--surface-1` | `#FFFFFF` | 主内容面 |
| `--surface-2` | `#FAFAFA` | 页面底色、弱区块 |
| `--surface-3` | `#F4F4F5` | 输入框、hover、弱按钮 |
| `--surface-elevated` | `rgba(255,255,255,.72)` | 玻璃面板 |

文字 token：

| Token | RGB | 用途 |
| --- | --- | --- |
| `--text-primary` | `9 9 11` | 主文字 |
| `--text-secondary` | `82 82 91` | 副标题、说明 |
| `--text-tertiary` | `161 161 170` | 弱信息、占位 |

语义色：

| Token | RGB | 用途 |
| --- | --- | --- |
| `--semantic-success` | `16 185 129` | 成功、已完成 |
| `--semantic-warning` | `245 158 11` | 警告、SLA 风险 |
| `--semantic-danger` | `239 68 68` | 错误、否决、逾期 |
| `--semantic-info` | `59 130 246` | 信息、进行中 |

### 2.3 深色模式

项目使用 `darkMode: 'class'`。深色模式下：

- 背景从白色切换到 Zinc/近黑：`--surface-1: 9 9 11`。
- 主红色提高明度：`--primary: 356 72% 55%`。
- 阴影转为黑色透明层。
- 同一套 `surface-*`、`ink-*`、`brand-*` class 自动换肤。

迁移建议：Rhautt Comfort 如果继续做品牌控制台，应优先保留 token 化颜色，不要在业务组件里散落 `red-500`、`slate-500` 这类原子色。

## 3. UI 布局与组件语言

### 3.1 应用壳层

核心壳层在 `components/app-shell.tsx`：

- 桌面端：`AppRail + SubSidebar + main` 三栏结构。
- 移动端：顶部栏 `MobileTopBar` + 全屏 main + 底部 `MobileTabBar`。
- 登录、注册、独立应用路由会去掉内部 chrome，直接全屏显示。
- `html` 和 `body` 锁定满高和 overflow，实际滚动发生在 main 内部容器。

桌面结构类似 Microsoft Teams：

- `AppRail`：64px 深炭黑主导航。
- `SubSidebar`：240px 白色二级导航，可收起为 48px。
- `main`：白色主工作区，内部滚动。

### 3.2 左侧 AppRail

`components/app-rail.tsx` 定义了强识别的应用栏：

- 宽度固定 `w-16`。
- 背景 `rgb(var(--rheem-charcoal))`。
- 图标使用 18px lucide 图标。
- 激活状态：深色 hover 背景 + 左侧 3px Rheem Red 竖条。
- 图标下方保留 10px 短标签。
- 顶部放品牌 logo，底部放用户菜单。

这套结构适合 Rhautt Comfort 的内部控制台/运营台，不适合对外品牌官网首屏直接照搬。

### 3.3 二级导航 SubSidebar

`components/sub-sidebar.tsx` 的模式：

- 240px 白底面板，右侧细分割线。
- 顶部 56px header：模块全名 + tagline。
- 列表项使用 `rounded-md`、`text-caption`、`h-4 w-4` 图标。
- 选中项：`bg-brand-50 text-brand-700 font-semibold`。
- CTA 选中项：`bg-brand-500 text-white`。
- 分组标题：10px、大写、letter spacing、弱灰色。
- 可收起状态只保留图标。

迁移建议：产品目录、品牌站控制台这类高频管理页面可以采用“左侧模块 + 主表格”的密度；营销页面不要使用此壳层。

### 3.4 卡片与面板

全局组件 class：

- `.card-elevated`
  - 白底、细边框、10px 圆角、soft shadow。
  - hover 时提升阴影并 `translateY(-1px)`。
  - active 时轻微缩放 `scale(0.995)`。
- `.surface-card`
  - 白底、细边框、16px 圆角、极轻阴影。
- `.surface-card-soft`
  - 浅灰底、细边框、16px 圆角。
- `.glass` / `.glass-thick`
  - 半透明白底、20/40px blur、saturate。

项目中常见的业务区块：

- 首页工作台指标卡：`card-elevated p-5 h-full`。
- 列表容器：`card-elevated overflow-hidden` + `divide-y divide-border`。
- 学习/档案页 hero：`.hero-ink` 深色品牌 hero。
- 快捷入口：`.rheem-tile` 实心红色磁贴。

### 3.5 按钮与交互

主要按钮模式：

- `.rheem-btn-pill`：红底白字、9999px 胶囊、15px/600、左右 28px。
- 普通命令按钮：`rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption`。
- 危险/主操作：`bg-brand-500 text-white hover:bg-brand-600`。
- 所有可交互表面普遍加 `.surface-interactive`。

交互动效：

- active 按压缩放：`scale(0.98)`。
- hover 卡片轻微上移。
- loading 使用 skeleton shimmer 或 lucide `Loader2 animate-spin`。
- 全局支持 `prefers-reduced-motion: reduce`。

### 3.6 状态、空态与加载态

代表页面中状态表达比较统一：

- 加载：居中弱文字 `text-caption text-ink-tertiary`，或 `Loader2`。
- 空态：卡片内 `p-10/p-12 text-center`，主文字 `text-body text-ink-secondary`。
- 错误：`AlertTriangle/AlertCircle` + `text-danger`，浅红/浅黄背景。
- 进行中/完成/警告/错误使用语义色，不直接复用品牌红。

迁移建议：产品列表里的“上架/下架/未上架”和“产品启用/停用”应像 Hermes 一样区分品牌色与语义色，避免所有状态都用红色。

## 4. 字体与排版

### 4.1 字体来源

`app/layout.tsx` 引入了 `@fontsource/noto-sans-sc`：

- 简体中文：400/500/600/700。
- Latin：400/500/600/700。

全局 body 字体栈：

```css
font-family:
  'Noto Sans SC',
  'Inter',
  -apple-system, BlinkMacSystemFont,
  'Segoe UI Variable Text', 'Segoe UI',
  'PingFang SC', 'Microsoft YaHei UI', 'Microsoft YaHei',
  'Source Han Sans CN', 'Hiragino Sans GB',
  system-ui, sans-serif;
```

Display 字体栈：

```css
'Noto Sans SC',
'Inter Tight',
'Inter',
-apple-system,
BlinkMacSystemFont,
'PingFang SC',
'Microsoft YaHei UI',
system-ui,
sans-serif;
```

Mono 字体栈：

```css
'SF Mono',
'Menlo',
'Cascadia Code',
'Consolas',
'Liberation Mono',
monospace;
```

### 4.2 字号体系

Tailwind 与全局 CSS 都定义了 8 级 Apple-style type scale：

| Class | Size | Line height | Weight | Letter spacing | 用途 |
| --- | --- | --- | --- | --- | --- |
| `text-display` | 56px | 1.05 | 700 | -0.02em | 超大品牌标题 |
| `text-title-1` | 36px | 1.1 | 700 | -0.015em | 页面大标题/核心数字 |
| `text-title-2` | 28px | 1.2 | 600 | -0.01em | 一级页面标题 |
| `text-title-3` | 22px | 1.25 | 600 | -0.005em | 区块标题 |
| `text-headline` | 18px | 1.3 | 600 | 0 | 小标题 |
| `text-body` | 15px | 1.5 | 400 | 0 | 正文 |
| `text-caption` | 13px | 1.4 | 400 | 0 | 控件、列表、说明 |
| `text-footnote` | 12px | 1.3 | 400 | 0 | 脚注、弱提示 |

全局开启：

- `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11', 'ss01'`
- `text-rendering: optimizeLegibility`
- `-webkit-font-smoothing: antialiased`
- `-moz-osx-font-smoothing: grayscale`

迁移建议：中文后台优先使用 `Noto Sans SC` 或当前项目已有中文字体栈；标题不要滥用 56px，业务台主标题建议控制在 `22px-28px`。

## 5. 图标样式

### 5.1 图标库

项目统一使用 `lucide-react`。导航、按钮、状态、空态、表单操作均从 lucide 引入。

典型图标尺寸：

| 场景 | 尺寸 | 示例 |
| --- | --- | --- |
| AppRail 主图标 | `18px` | `h-[18px] w-[18px]` |
| 移动底部 Tab | `22px` | `h-[22px] w-[22px]` |
| 普通按钮/列表 | `16px` | `h-4 w-4` |
| 小链接/箭头 | `14px` | `h-3.5 w-3.5` |
| 状态圆标内图标 | `16px` | `h-4 w-4` |
| 页面标题图标 | `20-24px` | `h-5 w-5` / `h-6 w-6` |

### 5.2 stroke 与颜色

lucide 默认线性风格，项目通常不显式改 stroke；移动底部 Tab 会按状态调 stroke：

- active：`strokeWidth={2.2}`
- inactive：`strokeWidth={1.8}`

颜色使用 token：

- 主品牌：`text-brand-500` / `text-brand-600`
- 弱图标：`text-ink-tertiary`
- 成功/警告/错误：`text-success` / `text-warning` / `text-danger`
- 深色 AppRail：白色 65%-100% 透明度

### 5.3 图标使用规则

可复用原则：

- 功能入口必须有图标，图标在左、文字在右。
- 状态类图标放在圆形浅色底中，例如成功 `bg-success/10 text-success`。
- 快捷入口磁贴使用白色图标，尺寸 28px。
- 图标不要混用 filled/彩色插画风格，除非是外部应用 logo。
- 外部系统如 launchpad 优先根据名称映射 lucide 图标，其次使用上传 iconUrl，最后用分类 fallback。

## 6. 品牌资产

`components/brand-logo.tsx` 说明了 logo 文件矩阵：

- `/public/brand/{variant}-{theme}.svg`
- `/public/brand/{variant}-{theme}.png`
- `/public/brand/logo.svg`
- `/public/brand/logo.png`

支持的 variant：

- `mark`
- `wordmark`
- `lockup`

支持的 theme：

- `auto`
- `light`
- `dark`
- `brand`

如果找不到 logo，组件会回退为红底白字 `T` 方块或红色 `Tandem.` 字标。这个回退机制适合在品牌资产尚未交付时保证页面不崩，但正式项目应补齐 SVG。

## 7. 可迁移到 Rhautt Comfort 的建议

### 7.1 建议直接借鉴

1. token 化颜色体系：保留 `brand-*`、`surface-*`、`ink-*`、`semantic-*` 四类。
2. 后台壳层：品牌站控制台适合采用 AppRail/SubSidebar 的清晰分区，但宽度和栏目要结合 Rhautt 当前 IA 调整。
3. 卡片和表格容器：使用轻边框、白底、soft shadow，不要厚重投影。
4. 字体体系：中文优先 `Noto Sans SC`，英文和数字使用 Inter/system fallback。
5. 图标体系：统一 lucide 线性图标，按钮/状态/导航都从同一库出。
6. 状态表达：品牌色只代表品牌和主操作，业务状态用 success/warning/info/danger。
7. 交互动效：保留 100/200/300ms 的短动效和 active 缩放，避免大面积装饰动画。

### 7.2 需要谨慎调整

1. Hermes 的主红是 `#C8202C`，而 Rhautt Comfort 现有规则里 Rheem Red 是 `#E4002B`。迁移时应以当前项目 token 为准，不能直接覆盖生产 VI。
2. Hermes 大量使用 16px/24px 大圆角；Rhautt Comfort 的运营后台如果要更密集，可把卡片圆角收敛到 8-12px。
3. `.hero-ink` 适合学院/档案/高亮模块，不适合产品表格页滥用。
4. AppRail 的 10px 中文短标签可读性一般，Rhautt 内部台可以保留，但面向经销商时建议提供更清晰的文字导航。
5. 玻璃拟态只适合浮层、顶栏或轻量提示，不建议作为主要表格背景。

### 7.3 不建议照搬

1. 不要把对外官网做成三栏工作台。
2. 不要把所有 CTA 都做成实心红磁贴，红色应保持稀缺。
3. 不要在业务组件中混用 raw Tailwind 色值和 token 色值。
4. 不要混用 lucide、emoji、彩色插画作为同一级导航图标。
5. 不要把 `text-display` 用在普通后台面板，中文会显得过重。

## 8. Rhautt Comfort 落地清单

建议后续按以下顺序落地：

1. 对照 `public/css/rheem-official-tokens.css` 和 `public/design-tokens/rheem-official.tokens.json`，建立与 Hermes 类似的 `brand/surface/ink/semantic` 映射。
2. 为 dealer workbench/brand console 统一按钮、状态 pill、表格空态、loading 和错误态。
3. 统一 lucide 图标尺寸：表格行动 16px，页头 20-24px，导航 18-22px。
4. 产品管理页保留高密度布局，采用 Hermes 的轻边框/弱背景/清晰状态，不引入营销 hero。
5. 对外品牌站只吸收 VI token、字体和按钮语气，不迁移内部工作台壳层。

## 9. 主要参考文件

- `app/globals.css`：设计 token、字体、基础样式、组件 utility、动效。
- `tailwind.config.ts`：Tailwind token 映射、字号、圆角、阴影、动效。
- `app/layout.tsx`：字体引入、Provider、AppShell 挂载。
- `components/app-shell.tsx`：响应式应用壳层。
- `components/app-rail.tsx`：深色左侧主导航。
- `components/sub-sidebar.tsx`：二级导航面板。
- `components/nav-modules.ts`：导航 IA 和 lucide 图标使用。
- `components/brand-logo.tsx`：品牌 logo 加载矩阵与 fallback。
- `app/page.tsx`：首页工作台、卡片、快捷入口、状态列表样式。
- `components/learning/LessonViewer.tsx`：`.hero-ink`、`.surface-card`、`.rheem-btn-pill` 的代表用法。
