---
name: rheem-design
description: Rheem.com 设计系统完整分析。从 rheem.com 真实 CSS/HTML 提取的设计 token 和规律。用于构建专业暖通品牌 UI。
---

# Rheem.com 设计系统 — 逆向工程分析
> 提取自 rheem.com 真实 CSS（330KB HTML + 8个组件CSS文件）

---

## 1. Rheem 设计系统架构

Rheem 使用自研 `rmc-`（Rheem Manufacturing Company）前缀设计系统，叠加 Bootstrap 5 栅格。

### 核心发现：T-shirt 间距命名系统
```
xs → sm → md → lg → xl → 2xl → 3xl → 4xl → 5xl → 6xl → 7xl → 8xl → 9xl → 10xl
```
用法：`rmc-gap-md`, `rmc-py-2xl`, `rmc-px-lg-8xl`（响应式+语义化）

### 字型层级（`rmc-ty-*`）
| Class | 类型 | 用途 |
|-------|------|------|
| `rmc-ty-display-xl` | Display | 英雄区大标题 |
| `rmc-ty-display-md` | Display | 二级英雄标题 |
| `rmc-ty-display-sm` | Display | 三级标题 |
| `rmc-ty-display-xs` | Display | 四级 |
| `rmc-ty-text-xl` | Text | 大正文 |
| `rmc-ty-text-lg` | Text | 正文 |
| `rmc-ty-text-md` | Text | 标准文字 |
| `rmc-ty-text-sm` | Text | 小文字 |
| `rmc-ty-text-xs` | Text | 最小说明 |

---

## 2. 关键设计 Token（从真实 CSS 提取）

### 阴影系统（从 SearchField 组件）
```css
/* Rheem 卡片默认阴影 */
box-shadow: 0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06);

/* Rheem 卡片 hover 阴影 */
box-shadow: 0 20px 24px -4px rgba(16,24,40,0.08), 0 8px 8px -4px rgba(16,24,40,0.03);
```
> **关键：阴影颜色用 #101828（深海军），不用纯黑**

### 搜索/建议框（直接提取）
```css
.suggestions-container {
  background: #fff;
  padding: 24px;
  border-radius: 0 0 8px 8px;  /* 底部圆角，顶部直角 */
}
.suggestions-title {
  text-transform: uppercase;
  font-size: 12px;
  color: #999;          /* 标签颜色 */
  font-weight: 500;
}
.suggestions__item {
  padding: 8px;
  font-size: 16px;
  color: #000;           /* 正文颜色 */
}
.suggestions__item:hover { background: #f5f5f5; }
```

### 颜色系统（从类名推断）
```
--rmc-color-base-black: #000000 (软黑)
--rmc-color-base-white: #ffffff
--rmc-color-gray-dark-500: 约 #6b7280
--rmc-color-gray-dark-650: 约 #4b5563

页面背景: #f5f5f5 (暖灰，非纯白)
hover背景: #f5f5f5
```

### 品牌标识
```
.rmc-header-red-line  — 导航栏下方的品牌红线（Rheem 标志性设计）
.rmc-btn-primary      — 主按钮（品牌红背景）
.rmc-btn-secondary    — 次要按钮（白底/边框）
.rmc-btn-link-brand   — 品牌文字链接
```

---

## 3. 页面结构模式

### 间距规律（从 HTML 类名分析）
```
英雄区: rmc-py-8xl, rmc-px-lg-8xl (最大留白)
内容区: rmc-py-3xl, rmc-px-2xl
卡片:   rmc-p-3xl, rmc-p-xl
紧凑:   rmc-gap-md, rmc-gap-xs
```

### 导航结构
```
.rmc-header              — 整个 header
.rmc-header-navigation   — 导航区
.rmc-header-red-line     — 品牌红线（细线，约 3-4px 高，Rheem 红）
.rmc-nav                 — 导航容器
.rmc-nav-item            — 导航项
.rmc-nav-solid           — 强调导航项（有背景色）
.rmc-nav-solid--badge    — 导航 badge
```

### 英雄区模式
```
.rmc-product-line-hero   — 产品英雄区（全宽背景图）
.rmc-punch-line          — 英雄标题（大字重）
.rmc-product-line-hero--tout — 英雄 + 小卡片变体
```

---

## 4. Rheem 设计感的核心：3个关键元素

### ① 红线（Red Line）
Rheem 最标志性的视觉元素：导航栏底部的细红线。
```css
.rmc-header-red-line {
  height: 3px;            /* 极细 */
  background: #CC0000;    /* Rheem 品牌红 */
  width: 100%;
}
```

### ② 全宽背景图区块
产品展示用 CSS 变量注入背景：
```css
.rmc-product-line-hero-bg {
  background-image: var(--rmc-product-line-hero-bg);
  background-size: cover;
  background-position: center;
}
```

### ③ 精确的过渡动画
```css
transition: opacity 0.3s ease-in;    /* 加载过渡 */
transition: box-shadow 0.2s ease-in-out;  /* 卡片 hover */
```

---

## 5. 应用到瑞诺瓦 AI 舒适家

### 可直接借鉴的元素
1. **导航红线** — 在 `DealerNav` 侧边栏顶部加一条竖向 `#C8102E` 品牌线
2. **阴影系统** — 已应用（`#101828` 深色阴影）
3. **背景色** — `#f5f5f5` 页面背景（比 #fafafa 稍暖）
4. **标签样式** — `12px uppercase font-weight:500 color:#999`
5. **建议框圆角** — 下方圆角 `border-radius: 0 0 8px 8px`（输入框聚焦时）

### Rheem 品牌色参考
```
Rheem 品牌红: 约 #CC0000 (深红)
瑞合品牌红: #C8102E (接近，已采用)
```

---

## 6. Rheem 与 styleseed 规则对比

| 规则 | Rheem 实际 | styleseed 规范 | 一致？|
|------|-----------|---------------|-------|
| 阴影颜色 | `rgba(16,24,40,0.1)` | opacity 4-8% | ✅ |
| 标签大小 | 12px uppercase | 12px uppercase | ✅ |
| 背景颜色 | #f5f5f5 | #FAFAFA | ≈ |
| 字体 | 系统字体 | Inter | 类似 |
| 圆角 | 8px | 6-8px | ✅ |
| 品牌色使用 | 仅 CTA + 标志线 | 仅accent | ✅ |
