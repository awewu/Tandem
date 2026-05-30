# CHARTER · UI 设计铁律 V1

> **立项**: 2026-05-29 PT (因 Academy Metaphor 落地时 UI 违规重大事故立)
> **地位**: 与 MANIFESTO 同等不可妥协. 任何 PR 违反此文件 = 直接打回, 不论功能完成度.
> **配套**: `docs/UI-IA.md §5` (设计语言细则) · `app/globals.css` (实现层)

---

## 0. 缘起 (写在最前)

2026-05-29, 落地 Academy Metaphor 时, AI 助手批量创建了 7 个组件 (`StudentCard / CourseTabs / TodayTab / ArchiveTab / LessonViewer / app/persona/page / app/learning/page`), 几乎全部:
- 直接用 `bg-slate-*` `text-amber-700` `bg-rose-50` 等 **raw Tailwind 调色**
- 用 Tailwind 默认 `shadow-sm / shadow-md` (Material 风) 而非 Apple soft `shadow-soft-*`
- Hero 卡用 `text-lg` 当主标题 (Apple HIG / Vercel 节奏要求 `text-title-2` 以上)
- 完全无视 `app/globals.css` 早已定义好的 `.text-display` `.text-title-1/2/3` `.text-headline` `.shadow-soft-*` `.glass` `.card-elevated` `.rheem-display`

**根因**: 没把 UI-IA §5 + globals.css 当成强约束. 写宪章入档防止再犯.

---

## 1. 不可妥协铁律 (Hard Rules)

### §1.1 三层 Token 架构 强制
| 层 | 内容 | 谁能用 |
|---|---|---|
| L1 raw | hex / RGB | **禁** 组件直接用 |
| L2 alias | CSS 变量 (`--surface-1`, `--brand-500`, `--text-secondary`) | `globals.css` 内部 |
| L3 semantic | `HEALTH.green` / `TONE_TOKENS` / `.surface-card` | **组件只用这层** |

**违规示例 (一律不通过)**:
```tsx
<div className="bg-slate-50 border-slate-200 text-slate-700 shadow-sm">  ❌
<span className="text-rose-700 bg-rose-100 border-rose-200">  ❌
<h1 className="text-lg font-bold text-slate-900">  ❌ (Hero 应 text-title-2 起)
```

**合规示例**:
```tsx
<div className="surface-card-soft text-secondary shadow-soft-xs">  ✅
<span className="pill-brand">  ✅
<h1 className="text-title-2 text-primary">  ✅
```

### §1.2 字体节奏 (Apple HIG / Vercel Geist)
组件层只用 `globals.css` 已定义的语义级 type scale, **禁止** 用 Tailwind 原始 `text-{sm/lg/xl/2xl}` 当结构性 typography:

| 用途 | 强制类 | 像素 |
|---|---|---|
| Hero 大标题 (登录页 / 营销 Hero) | `.text-display` 或 `.rheem-display` | 56px |
| 页面主标 (路由 H1) | `.text-title-1` | 36px |
| 区块标题 (section h2 / Hero 卡 H1) | `.text-title-2` | 28px |
| 卡片标题 (card h3) | `.text-title-3` | 22px |
| 小标题 / 强调 | `.text-headline` | 18px |
| 正文 | `.text-body` | 15px |
| 辅助说明 | `.text-caption` | 13px |
| Micro (徽章 / 学籍号) | `.text-footnote` | 12px |

**例外**: `text-xs` `text-[10px]` `text-[11px]` 仍可用于真正 micro 场景 (badge 内数字, 角标), 但 ≥ Caption 级别一律走语义类.

### §1.3 阴影只用 Apple soft
| 用途 | 强制类 |
|---|---|
| 小卡 / 列表项 | `.shadow-soft-xs` 或 `.shadow-soft-sm` |
| 浮起卡 / 工具栏 | `.shadow-soft` (md) |
| Hero / 模态 | `.shadow-soft-lg` 或 `.shadow-soft-xl` |
| 品牌发光 | `.ring-brand-glow` |

**禁**: `shadow-sm` `shadow-md` `shadow-lg` (Tailwind 默认 Material 阴影, opacity 0.25, 太重).

### §1.4 圆角节奏
- 按钮 / pill: `rounded-full` 或 `rounded-md` (10px)
- 列表项 / 输入: `rounded-md` (10px)
- 卡片: `rounded-2xl` (= `--radius-lg` 16px)
- Hero / 大模块: `rounded-3xl` (= `--radius-xl` 24px)

**禁**: 在 Hero 用 `rounded-lg` (8px), 太碎.

### §1.5 颜色调用
所有非 Stage 相关颜色, **必须**走 CSS var:

| 替换前 | 替换后 |
|---|---|
| `bg-slate-50` | `surface-2` |
| `bg-white` | `surface-1` |
| `bg-slate-100` | `surface-3` |
| `text-slate-900` | `text-primary` |
| `text-slate-600/700` | `text-secondary` |
| `text-slate-400/500` | `text-tertiary` |
| `border-slate-200` | `border` + 已有 `--border-subtle` |
| `bg-amber-50 text-amber-700` 当 pill | `pill-brand` 或 `pill-neutral` |
| `bg-rose-500 text-white` 当 CTA | `rheem-btn-pill` 或 `bg-[rgb(var(--brand-500))]` |

**唯一例外**: 语义化 token (`@/lib/design-tokens` 的 `HEALTH/GRADE/CONFIDENCE/PRIORITY/PERSONA_STAGE/SCOPE/DATA_SOURCE/NINE_BOX_CELL` + `TONE_TOKENS`). 这些已经把 Tailwind 包成语义层, 可用.

### §1.6 Hero 卡设计强制
所有"页面级 Hero"(Student 学员证 / LessonViewer 顶部 / learning index 顶部 / 营销页 Hero), **必须**:
- 用 `.hero-ink` (深底 ink-black + brand 径向光) 或 `.glass` (浅页玻璃)
- 标题 ≥ `.text-title-2` (28px)
- 副标用 `.text-caption` 或 `.text-body`, 颜色用 `rgba(255,255,255,0.7)` (深底) / `text-secondary` (浅底)
- 内边距 ≥ `p-6 sm:p-8`
- 圆角 `rounded-3xl`
- 阴影 `shadow-soft-lg` 或 `shadow-soft-xl`

**禁**: Hero 用 `bg-amber-50` `bg-sky-50` 这类浅花色铺底 — 那是**内容卡** (Notion-density) 才有的视觉量.

### §1.7 学院 Stage 配色专属通道
Persona stage 5 阶段 (`newborn/apprentice/assistant/deputy/partner`) **只能**通过 `STAGE_META[stage].tone` → `TONE_TOKENS[tone]` 取色; 不许散落. `TONE_TOKENS` 是 stage 视觉的唯一 SSOT.

### §1.8 动效铁律
- 时长用 `--duration-{instant|fast|base|slow|emphasis}`
- 曲线用 `--ease-{standard|decelerate|accelerate|emphasis}`
- **禁**: 在 Tailwind 写 `transition duration-300 ease-in-out` (用默认曲线 = Material, 不是 iOS spring)

---

## 2. 5 个学习对象 (UI-IA §5.6 重申)

| 标杆 | 学什么 |
|---|---|
| **Linear** | 命令面板 / 键盘第一 / 极简卡片 / 通知设计 |
| **Notion** | 信息密度 / 内联编辑 (适用**内容卡**, 不适用 Hero) |
| **Vercel** | Geist 字体节奏 / 黑白对比 / 微妙动效 (适用**所有 Hero / 顶层框架**) |
| **Apple Music** | 玻璃拟态 sidebar / 大标题留白 / 卡片网格 (适用 Hero / 切换面板) |
| **Stripe Dashboard** | 数据可视化 / 表格设计 / 财务级精确 (适用**数据密集卡**) |

**心智模型**:
- Hero = Vercel + Apple (大留白, 深底, 品牌色 accent)
- 内容卡 = Notion + Stripe (信息密度, 表格精确)
- 命令面板 / 快捷键 = Linear

---

## 3. PR 自检清单 (强制)

提交任何 UI 改动前, **逐条**勾选:

- [ ] 颜色: 没有 `bg-slate-*` `text-amber-*` `border-rose-*` 等 raw Tailwind 颜色 (语义 token 例外)
- [ ] 字体: 结构性 typography 用 `.text-{display|title-1|title-2|title-3|headline|body|caption|footnote}`, 不用 raw `text-lg/xl/2xl`
- [ ] 阴影: 用 `.shadow-soft-*`, 不用 Tailwind 默认 `shadow-*`
- [ ] 圆角: 卡片 `rounded-2xl`+, Hero `rounded-3xl`, 不用 Hero 上的 `rounded-lg`
- [ ] Hero: 用 `.hero-ink` 或 `.glass`, 标题 ≥ 28px
- [ ] Stage 色: 走 `STAGE_META.tone` → `TONE_TOKENS`, 不散落
- [ ] 动效: 用 `--duration-*` `--ease-*`, 不用 Tailwind 默认
- [ ] dark mode: 验证浅深色都正常 (`globals.css` 已覆盖, 别破坏)

---

## 4. ESLint Backlog (P1)

未来加 `eslint-plugin-tandem-ui` 自定义规则, 直接 lint 拦截:

```js
'tandem-ui/no-raw-color': 'error',     // 禁 bg-slate-* 等
'tandem-ui/no-tailwind-shadow': 'error', // 禁 shadow-sm 等
'tandem-ui/typography-scale': 'error',   // 强制 .text-{...} 用于 ≥H3
'tandem-ui/hero-uses-ink-or-glass': 'warn',
```

立项 backlog ID: `B-UI-LINT-01`. P1 GA 后做, 不阻塞 V1.

---

## 5. 违规事故档案

| 日期 | 范围 | 文件 | 描述 | 修复 PR |
|---|---|---|---|---|
| 2026-05-29 | Academy Metaphor 7 组件 | StudentCard / CourseTabs / TodayTab / ArchiveTab / LessonViewer / app/persona/page / app/learning/page | 全 raw Tailwind 颜色 + Tailwind 默认 shadow + Hero `text-lg` 当主标 | 同日重构 (见 git log) |

每次违规事故必须登记在此表, 不许默默修, 防止重复犯.

---

## 6. 与其它宪章的关系

- `MANIFESTO §20` "设计语言入宪": 一句话级别承诺 (顶层)
- `CHARTER-UI-V1.md` (本文): 战术细则 + 违规清单
- `docs/UI-IA.md §5`: 全量设计语言规格 (战略, 给设计师)
- `app/globals.css`: 实现层 SSOT

任何冲突, 上位文件优先 (MANIFESTO > 本 CHARTER > UI-IA > 实现).
