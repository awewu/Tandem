# 瑞诺瓦 AI 舒适家 — DESIGN.md
> 设计语言的唯一真相来源。AI 生成任何界面前必须读此文件。

---

## 1. 品牌身份

**品牌名称：** 瑞诺瓦 AI 舒适家  
**母品牌：** 瑞合瑞德 (Rhautt)  
**定位：** 专业暖通经销商数字工作台  
**感觉：** 精准 · 专业 · 可信赖 · 克制  
**参照：** Rheem.com × Linear × Vercel Dashboard  
**禁止：** 渐变 · 圆角胶囊 · 彩色背景卡片 · 装饰字体

---

## 2. 色彩系统

### 核心色
| Token | Hex | 用途 |
|-------|-----|------|
| `--ink` | `#111827` | 主文字、标题（90% 黑）|
| `--ink-2` | `#374151` | 次要文字 |
| `--ink-3` | `#6B7280` | 占位、说明 |
| `--ink-4` | `#9CA3AF` | 禁用、最弱文字 |
| `--ink-5` | `#D1D5DB` | 分割线 |

### 表面色
| Token | Hex | 用途 |
|-------|-----|------|
| `--bg` | `#F9FAFB` | 页面背景 |
| `--surface` | `#FFFFFF` | 卡片、模态 |
| `--surface-hover` | `#F3F4F6` | hover 状态 |

### 品牌色
| Token | Hex | 用途 |
|-------|-----|------|
| `--brand` | `#C8102E` | 主 CTA、激活态、Logo |
| `--brand-hover` | `#A80D26` | 品牌色 hover |
| `--brand-subtle` | `#FFF1F2` | 品牌色浅背景 |

### 侧边栏（独立黑色体系）
| Token | Hex | 用途 |
|-------|-----|------|
| `--sidebar` | `#111827` | 侧边栏背景 |
| `--sidebar-text` | `rgba(255,255,255,0.6)` | 非激活导航项 |
| `--sidebar-active-bg` | `rgba(200,16,46,0.15)` | 激活背景 |

### 功能色
| Token | Hex | 用途 |
|-------|-----|------|
| `--success` | `#16A34A` | 成功、完成 |
| `--warning` | `#D97706` | 警告、待处理 |
| `--error` | `#DC2626` | 错误、危险 |
| `--info` | `#2563EB` | 信息、提示 |

---

## 3. 字体系统

### 字体栈
```
Primary: "Inter", -apple-system, "Helvetica Neue", "PingFang SC", sans-serif
Mono:    "SF Mono", "Menlo", "Consolas", monospace
```

> Inter 用 Google Fonts 加载。中文由 PingFang SC（macOS）/ 微软雅黑（Windows）兜底。

### 字型比例（T-shirt 命名）
| Class | Size | Weight | Line-h | 场景 |
|-------|------|--------|--------|------|
| `.t-2xl` | 30px | 800 | 1.2 | 页面主标题 |
| `.t-xl` | 24px | 700 | 1.25 | 二级标题 |
| `.t-lg` | 18px | 600 | 1.35 | 卡片标题 |
| `.t-base` | 14px | 400 | 1.6 | 正文 |
| `.t-sm` | 13px | 400 | 1.5 | 辅助文字 |
| `.t-xs` | 12px | 500 | 1.4 | 标签、UPPERCASE |
| `.t-mono` | 13px | 400 | — | 代码、数据 |
| `.t-num` | 36px | 800 | 1.1 | 大数字统计 |

### 规则
- **NEVER** 在界面中使用宋体/楷体/艺术字
- **ALWAYS** 数字用 `font-variant-numeric: tabular-nums`
- **PREFER** 标题 `letter-spacing: -0.02em`

---

## 4. 间距（8px 基线栅格）

| Token | 值 | 典型用途 |
|-------|----|----|
| `--s1` | 4px | 图标内间距 |
| `--s2` | 8px | 紧凑元素间距 |
| `--s3` | 12px | 小组件内边距 |
| `--s4` | 16px | 标准内边距 |
| `--s5` | 20px | 卡片内边距 |
| `--s6` | 24px | 区块间距 |
| `--s8` | 32px | 章节间距 |
| `--s10` | 40px | 页面内边距 |
| `--s12` | 48px | 大区块间距 |

---

## 5. 圆角 & 阴影

### 圆角
| Token | 值 | 用途 |
|-------|----|------|
| `--r-sm` | 4px | 标签、小组件 |
| `--r` | 8px | 按钮、输入框（主要） |
| `--r-lg` | 12px | 卡片 |
| `--r-xl` | 16px | 模态 |

> **NEVER 圆角 > 16px。NEVER 圆角胶囊按钮（pill）。**

### 阴影（基于 `#101828` 深色系）
| Token | 值 | 用途 |
|-------|----|------|
| `--sh-xs` | `0 1px 2px rgba(16,24,40,0.05)` | 输入框 |
| `--sh-sm` | `0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)` | 卡片默认 |
| `--sh-md` | `0 4px 8px -2px rgba(16,24,40,0.10), 0 2px 4px -2px rgba(16,24,40,0.06)` | hover 卡片 |
| `--sh-lg` | `0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)` | 模态 |

---

## 6. 组件规范

### Button
```
.btn          — 基础：padding 9px 17px, border-radius 8px, font-weight 600, font-size 14px
.btn-sm       — 小：padding 6px 12px, font-size 13px
.btn-brand    — 品牌红背景，白字
.btn-outline  — 白背景，1px border #D1D5DB，深文字
.btn-ghost    — 透明背景，无边框，hover 显 surface-hover
```
- **NEVER** pill/圆角胶囊按钮
- **NEVER** 渐变背景按钮
- **ALWAYS** disabled 状态 opacity 0.45

### Card
```
.card     — background white, border 1px solid #E5E7EB, border-radius 12px, 
            padding 20px, box-shadow: var(--sh-sm)
.card:hover — box-shadow: var(--sh-md), transition 0.2s
```
- **NEVER** 彩色卡片背景
- **PREFER** 白色表面 + 精细边框

### Input / Form
```
height: 38px, border: 1px solid #D1D5DB, border-radius: 8px
focus: border-color #2563EB, box-shadow 0 0 0 3px rgba(37,99,235,0.1)
placeholder: color #9CA3AF
```

### Badge / Tag
```
padding: 2px 8px, border-radius: 4px, font-size: 12px, font-weight: 500
red:    bg #FEF2F2, text #991B1B, border #FECACA
green:  bg #F0FDF4, text #166534, border #BBF7D0
blue:   bg #EFF6FF, text #1E40AF, border #BFDBFE
amber:  bg #FFFBEB, text #92400E, border #FDE68A
grey:   bg #F9FAFB, text #374151, border #E5E7EB
```

### Table
```
th: font-size 12px, font-weight 600, uppercase, letter-spacing 0.05em, color #6B7280, 
    background #F9FAFB, border-bottom 1px solid #E5E7EB
td: font-size 14px, padding 12px 16px, border-bottom 1px solid #F3F4F6
tr:hover: background #F9FAFB
```

### Sidebar Navigation
```
width: 240px, background: #111827
Brand area: padding 24px 20px, border-bottom rgba(255,255,255,0.08)
Nav group header: font-size 11px, uppercase, color rgba(255,255,255,0.3)
Nav item: padding 7px 12px, border-radius 6px, font-size 14px
  default: color rgba(255,255,255,0.6)
  active:  color #fff, background rgba(200,16,46,0.15), border-left 2px solid #C8102E
  hover:   background rgba(255,255,255,0.05)
```

---

## 7. 布局

```
.layout   — display: flex
.sidebar  — 240px, sticky, height 100vh
.content  — flex 1, padding 40px, max-width none
```

页面内容最大宽度：**无限制**（填满可用空间）

---

## 8. 规则汇总

### ALWAYS（必须）
- 用 Inter 字体 + PingFang SC 中文回退
- 统计数字用 `font-variant-numeric: tabular-nums`
- 按钮有 disabled 状态（opacity 0.45）
- 卡片有 hover 阴影过渡
- 表格 th 大写缩写标签 + 6B7280 颜色
- 品牌红 #C8102E 只用于 CTA 和导航激活态

### NEVER（禁止）
- 渐变背景（linear-gradient 作为主色块）
- 圆角超过 16px 或使用胶囊形
- 彩色卡片背景（黄/蓝/绿背景卡片）
- emoji 作为导航图标
- 超过 3 层的阴影叠加
- 紫色、粉色等非品牌色

### PREFER（优先）
- 对比度：白色文字在深色侧边栏
- 数据密集区用 `.card` + `.table` 组合
- 页面标题 `.t-2xl`，卡片标题 `.t-lg`
- 空状态用简洁文案 + 次级按钮
- 错误/成功用 badge 而非整行变色

---

# 体验层 · UX 宪章（v2）
> 上面 §1-8 是"视觉"（长什么样）；以下 §9-16 是"体验"（用起来怎么舒服）。**所有界面必须遵守**，可被 `guard:ui-vi` / `guard:browser-visual` / `guard:active-page-static` 检查。

## 9. 状态五态完备
每个列表/卡片/异步区必须覆盖：`loading`(骨架屏，非空白/无限转圈) · `empty`(简洁文案 + 次级 CTA) · `error`(行内提示 + 重试) · `success` · `partial`(部分失败可见)。**禁白屏、禁无限 spinner。**

## 10. 反馈与延迟
- 交互 <100ms 有可见反馈；提交用**乐观更新**或按钮 loading 态。
- 耗时操作显进度；结果用 `toast` 报成败（成功 `--success`，失败 `--error`）。

## 11. 可访问性 WCAG AA
- 文本对比 ≥4.5:1（`--ink-3 #6B7280` 在白底≈4.6 ✓；`--ink-4` 仅装饰用）。
- 全键盘可达 + 可见 `focus ring`（沿用 input `0 0 0 3px rgba(37,99,235,0.1)`）。
- 交互区 ≥40px；表单控件有 `label`/`aria-*`。

## 12. 渐进披露
数据密集页默认精简（关键 KPI 上浮），细节走折叠/抽屉/详情页；**一屏 ≤7 主区块**。

## 13. 响应式双轨
- 工作台(dealer-workbench)桌面优先，断点 `≥1280/1024/768` 不塌。
- C 端(诊断/品牌站)移动优先。

## 14. 表单纪律
行内即时校验；错误贴**字段旁**（非顶部一句话）；破坏性操作二次确认；长表单**自动存草稿**防丢。

## 15. 信息架构与导航
面包屑 + 当前位置高亮；层级 ≤3；`⌘K` 命令面板全局跳转/搜索；返回不丢状态（列表筛选/滚动位保留）。

## 16. 性能感知
长列表虚拟化/分页（>50 行）；图片懒加载；路由级骨架屏消冷启动白屏。

### UX ALWAYS / NEVER
- ALWAYS：异步区先渲染骨架屏；破坏性操作二次确认；表单错误定位到字段。
- NEVER：白屏 / 无限 spinner / 顶部一句笼统报错 / 提交无反馈 / 长列表全量渲染。
