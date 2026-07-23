---
name: ui-elite
description: 顶级 SaaS 设计系统技能。融合 Linear / Vercel / Stripe / Shadcn/ui 实际 CSS token 和设计规则。写任何 UI 组件前必读此文件。
---

# UI Elite Design Skill
> 来源：Linear.app、Vercel、Stripe、Shadcn/ui、2026 SaaS 趋势报告

---

## 1. 2026 核心设计原则（Linear 范式）

> "In 2026, the most-admired products are doing the opposite—removing everything that doesn't serve the immediate task." — SaaS UI Trends 2026

1. **极简不是装饰** — 空白是主动设计决策，不是填充
2. **每个像素有功能** — 没有装饰性渐变、没有纯装饰阴影
3. **颜色即语义** — 颜色传达状态，不传达美感
4. **字重即层级** — 用 font-weight 800/600/400 建立层级，不用颜色
5. **边框代替阴影** — 精准 1px border 比模糊阴影更专业
6. **数据密度优先** — 紧凑但可读；padding 缩小不是错误

---

## 2. Linear.app 真实 Token（从 live CSS 提取）

```css
/* 来源：Webpage Style Extractor 从 linear.app 提取 */

/* 语义色 */
--linear-color-white: #ffffff;
--linear-color-black: #000000;
--linear-color-blue:  #4ea7fc;   /* 主 accent */
--linear-color-red:   #eb5757;   /* error */
--linear-color-green: #4bc97d;   /* success */
--linear-color-yellow:#f6b519;   /* warning */
--linear-color-purple:#9b6dff;   /* brand（Linear 紫）*/

/* 背景层 */
--linear-bg-app:      #1a1a24;   /* 应用主背景（dark） */
--linear-bg-surface:  #222232;   /* 卡片/面板 */
--linear-bg-hover:    #2c2c3e;   /* hover 态 */
--linear-bg-border:   rgba(255,255,255,0.1);

/* 文字 */
--linear-text-primary:   #f0f0f0;
--linear-text-secondary: #9494a4;
--linear-text-tertiary:  #5a5a6e;
```

**Linear 的设计哲学：**
- 几乎没有阴影，用深浅色块区分层次
- nav 激活：背景色加深 + 左边 2px accent 竖线
- 字体：Inter，标题 -0.02em 字距
- 圆角：4-8px，**绝不超过 8px**

---

## 3. Vercel 设计 Token

```css
/* Vercel 实际 CSS — geist.vercel.app */
--geist-background:   #000000;
--geist-foreground:   #ffffff;
--accents-1:          #111;
--accents-2:          #333;
--accents-3:          #444;
--accents-4:          #666;
--accents-5:          #888;
--accents-6:          #999;
--accents-7:          #eaeaea;
--accents-8:          #fafafa;
--geist-success:      #0070f3;
--geist-error:        #ff0000;
--geist-warning:      #f5a623;
```

**Vercel 哲学：**
- 极端对比：黑/白，没有中间色
- 字体：Geist（自研）/ Inter fallback
- 技术内容：等宽字体 Geist Mono
- 圆角：极小，4-6px

---

## 4. Stripe 设计 Token

```css
/* Stripe Dashboard — stripe.com */
--colorBackground:      #ffffff;
--colorBackgroundGray:  #f6f8fa;
--colorText:            #0a2540;   /* 深蓝黑，比纯黑更专业 */
--colorTextSecondary:   #425466;
--colorTextTertiary:    #697386;
--colorBorder:          #e3e8ef;
--colorBorderHover:     #cdd5df;
--colorAction:          #635bff;   /* Stripe 紫 */
--colorActionHover:     #5851db;
--colorSuccess:         #09825d;
--colorDanger:          #c0392b;
--colorWarning:         #9b6700;
```

**Stripe 哲学：**
- 文字用深蓝黑 `#0a2540`，不用纯黑（更高级）
- 表格行高宽松，但内容精准
- 状态 badge：柔色背景（不刺眼的红/绿）
- 卡片：极细边框 `#e3e8ef` + 微小阴影

---

## 5. Shadcn/ui CSS 变量（2024-2026 主导体系）

```css
/* shadcn/ui default (light mode) */
:root {
  --background:        0 0% 100%;
  --foreground:        222.2 84% 4.9%;
  --card:              0 0% 100%;
  --card-foreground:   222.2 84% 4.9%;
  --popover:           0 0% 100%;
  --popover-foreground:222.2 84% 4.9%;
  --primary:           221.2 83.2% 53.3%;   /* blue */
  --primary-foreground:210 40% 98%;
  --secondary:         210 40% 96.1%;
  --secondary-foreground:222.2 47.4% 11.2%;
  --muted:             210 40% 96.1%;
  --muted-foreground:  215.4 16.3% 46.9%;
  --accent:            210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive:       0 84.2% 60.2%;
  --border:            214.3 31.8% 91.4%;
  --input:             214.3 31.8% 91.4%;
  --ring:              221.2 83.2% 53.3%;
  --radius:            0.5rem;               /* 8px */
}
```

**为什么 Shadcn 是 2024-2026 标准：**
- 不是组件库，是可复制的代码（ownership 在你）
- Radix UI 无头组件 + Tailwind 样式
- HSL 色彩空间（更易主题化）
- 48个组件，覆盖所有SaaS场景

---

## 6. 字体对比表

| 产品 | 字体 | 获取方式 |
|------|------|--------|
| Linear | Inter | Google Fonts |
| Vercel | Geist | vercel.com/font（免费）|
| Stripe | -apple-system + Inter | 系统回退 |
| Shadcn | Inter | Google Fonts |
| **瑞诺瓦** | **Inter + PingFang SC** | Google Fonts（被墙）→ 本地 |

**中国可用 Inter 方案：**
```css
/* 方案1：国内镜像 */
@import url('https://fonts.loli.net/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* 方案2：系统回退（最快）*/
font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
/* macOS 上 -apple-system = SF Pro，效果等同 Inter */

/* 方案3：本地安装 Inter → 用 @font-face */
```

---

## 7. 2026 SaaS UI 趋势（实际研究）

### 趋势1：Noise Reduction（降噪）
- 删掉所有装饰元素
- Linear 默认视图：只有文字，无图标、无颜色标签

### 趋势2：Semantic Color（语义色）
- 颜色只表示状态（success/error/warning）
- 主界面：灰度 + 单一 accent

### 趋势3：Micro Typography
- 标签：12px uppercase letter-spacing 0.06em
- 数字：tabular-nums
- 代码：专用等宽字体

### 趋势4：Borderless Cards（无框卡片）
- 背景色区分代替 border
- `--bg #f9fafb` 页面 + `#fff` 卡片 = 自然分层

### 趋势5：Tight Density（高密度）
- 行高 1.4-1.5（不是 1.6-1.8）
- padding 缩小：卡片 16px（不是 24px）
- 能放更多内容 = 更专业

---

## 8. 对比：我之前的错误 vs 正确做法

| 项 | 我之前做的 | 正确（Linear/Stripe） |
|---|---|---|
| 圆角 | `border-radius: 12-16px` | **4-8px** |
| 阴影 | 3层嵌套阴影 | **1px border** 或极细 sh-xs |
| 按钮 | pill/胶囊形 | **方形，r=6-8px** |
| 卡片 | 白色+大阴影 | **f9fafb背景+1px #e5e7eb** |
| 字体 | 中文回退体 | **Inter（或SF Pro fallback）** |
| 颜色 | 多色装饰 | **灰度+单accent** |
| 间距 | padding:20-24px | **padding:12-16px（密集）**|

---

## 9. 立即可用的最佳 globals.css 模板

```css
/* 融合 Linear/Stripe/Shadcn 最佳实践 */
:root {
  /* Stripe 文字系统 */
  --text-900: #0a2540;
  --text-600: #425466;
  --text-400: #697386;
  --text-200: #adb5c0;

  /* Shadcn 表面 */
  --bg:      #f9fafb;
  --surface: #ffffff;
  --border:  #e5e7eb;

  /* 品牌 */
  --brand:   #C8102E;

  /* 阴影（极轻）*/
  --sh: 0 1px 3px rgba(0,0,0,0.08);

  /* 字体 */
  --font: -apple-system, BlinkMacSystemFont, 'Inter', 'PingFang SC', sans-serif;

  /* 圆角（Linear 范式）*/
  --r: 6px;
}
```

---

**参考来源：**
- [Linear Design Tokens](https://promptbase.com/prompt/webpage-style-extractor-agent-2)
- [Popular Web Designs — 54 systems](https://hermes-agent.nousresearch.com/docs/user-guide/skills/bundled/creative/creative-popular-web-designs)
- [Reverse-engineer any design system](https://skillui.vercel.app/)
- [2026 SaaS UI Trends](https://www.saasui.design/blog/7-saas-ui-design-trends-2026)
- [Shadcn/ui](https://ui.shadcn.com)
