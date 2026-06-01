# Tandem UI 设计规范 · 完整沟通资料

> **版本**: V1.0 (2026-05-31)
> **编制依据**: `docs/CHARTER-UI-V1.md` + `app/globals.css` + `lib/design-tokens.ts` + `lib/persona/stage-meta.ts`
> **适用范围**: 所有前端组件开发、设计师对接、PR Review

---

## 一、设计哲学与标杆

Tandem 的 UI 不是通用 SaaS 的灰白脸，而是**企业级 Apple HIG + Vercel Geist + Linear** 的混合体。

**一句话目标**: "Tandem 看一眼就知道是 Tandem，不是 SaaS 抄飞书的灰白脸。"

### 1.1 五个学习品牌

| 标杆 | 学什么 | 适用场景 |
|------|--------|----------|
| **Linear** | 命令面板 / 键盘第一 / 极简卡片 / 通知设计 | 命令面板、快捷键、操作反馈 |
| **Notion** | 信息密度 / 内联编辑 | **内容卡**（列表、详情、表单） |
| **Vercel** | Geist 字体节奏 / 黑白对比 / 微妙动效 | **所有 Hero / 顶层框架** |
| **Apple Music** | 玻璃拟态 sidebar / 大标题留白 / 卡片网格 | Hero 卡、切换面板、导航 |
| **Stripe Dashboard** | 数据可视化 / 表格设计 / 财务级精确 | **数据密集卡**（KPI、报表、看板） |

### 1.2 心智模型映射

- **Hero / 顶层框架** = Vercel + Apple（大留白，深底，品牌色 accent）
- **内容卡** = Notion + Stripe（信息密度，表格精确）
- **命令面板 / 快捷键** = Linear

---

## 二、三层 Token 架构（强制，不可妥协）

组件**绝对禁止**直接使用 raw Tailwind 颜色，必须走语义层。

| 层级 | 内容 | 谁能用 | 违规示例 |
|------|------|--------|----------|
| **L1 · 原始值** | hex / RGB / `bg-slate-50` | ❌ **禁止组件使用** | `bg-slate-50`、`text-amber-700`、`border-rose-200` |
| **L2 · 别名** | CSS 变量（`--surface-1`、`--brand-500`） | 仅 `globals.css` 内部定义 | — |
| **L3 · 语义** | `.surface-card`、`.text-primary`、`HEALTH.green` | ✅ **组件只用这层** | `surface-card-soft`、`text-secondary`、`shadow-soft-md` |

### 2.1 典型替换对照表

| 违规写法 (禁止) | 合规写法 (强制) |
|-----------------|-----------------|
| `bg-slate-50` | `.surface-2` |
| `bg-white` | `.surface-1` |
| `bg-slate-100` | `.surface-3` |
| `text-slate-900` | `.text-primary` |
| `text-slate-600/700` | `.text-secondary` |
| `text-slate-400/500` | `.text-tertiary` |
| `border-slate-200` | `border` + CSS var 或 `.surface-card` 自带 |
| `bg-amber-50 text-amber-700` 当 pill | `.pill-brand` 或 `.pill-neutral` |
| `bg-rose-500 text-white` 当 CTA | `.rheem-btn-pill` 或品牌 var |
| `shadow-sm` / `shadow-md` (Tailwind 默认) | `.shadow-soft-xs` / `.shadow-soft` |

**唯一例外**: `lib/design-tokens.ts` 中的语义 token（`HEALTH`、`TONE_TOKENS` 等）已把 Tailwind 包成语义层，可用。

---

## 三、字体节奏（Apple HIG / Vercel Geist）

**禁止**用 Tailwind 原始 `text-sm/lg/xl/2xl` 当结构性 typography。

| 用途 | 强制类名 | 字号 | 字重 | 字距 |
|------|----------|------|------|------|
| 营销 Hero 大标题 | `.text-display` / `.rheem-display` | 56px | 700/800 | -0.02em |
| 页面主标 (路由 H1) | `.text-title-1` | 36px | 700 | -0.015em |
| 区块标题 (section h2 / Hero 卡 H1) | `.text-title-2` | 28px | 600 | -0.01em |
| 卡片标题 (card h3) | `.text-title-3` | 22px | 600 | -0.005em |
| 小标题 / 强调 | `.text-headline` | 18px | 600 | — |
| 正文 | `.text-body` | 15px | 400 | — |
| 辅助说明 | `.text-caption` | 13px | 400 | — |
| Micro (徽章 / 学籍号 / 角标) | `.text-footnote` | 12px | 400 | — |

**例外**: `text-xs`、`text-[10px]`、`text-[11px]` 仍可用于真正 micro 场景（badge 内数字、角标），但 ≥ Caption 级别一律走语义类。

### 3.1 字体栈

系统原生字体栈，不加载 web font：

```
var(--font-sans) → 'Inter' → -apple-system → BlinkMacSystemFont → 'Segoe UI Variable Text' → 'PingFang SC' → 'Microsoft YaHei' → system-ui
```

Display 级（≥ headline）自动绑定 `Inter Tight`（`--font-display`）。

---

## 四、颜色体系

### 4.1 品牌色（Rheem Red）

以 `#C8202C`（`--brand-500`）为核心，覆盖 50→900 完整色阶：

| Token | 值 | 用途 |
|-------|-----|------|
| `--brand-50` | #FCE9EB | 极浅品牌底 |
| `--brand-100` | #FACBCF | 浅品牌边 |
| `--brand-500` | #C8202C | **主品牌色** |
| `--brand-600` | #9F1822 | hover 态 |
| `--brand-700` | #7E131A | 深品牌文字 |

### 4.2 表面色（Surface）

| 类名 | Light | Dark | 用途 |
|------|-------|------|------|
| `.surface-1` | #FFFFFF | #09090B | 主背景 |
| `.surface-2` | #FAFAFA | #18181B | 次背景 / 卡片底 |
| `.surface-3` | #F4F4F5 | #27272A | 输入区 / 三级背景 |

### 4.3 文字色

| 类名 | Light | Dark | 用途 |
|------|-------|------|------|
| `.text-primary` | #09090B | #FAFAFA | 标题、正文 |
| `.text-secondary` | #52525B | #A1A1AA | 副标题、说明 |
| `.text-tertiary` | #A1A1AA | #71717A | 禁用、时间戳 |

### 4.4 语义色（Semantic）

| 语义 | 值 | 场景 |
|------|-----|------|
| `success` | #10B981 | COMMIT / 绿区 / 达标 |
| `warning` | #F59E0B | 黄区 / SLA 警告 |
| `danger` | #EF4444 | 红区 / 否决 / 逾期 |
| `info` | #3B82F6 | 信息提示 |

### 4.5 TS 语义 Token（`lib/design-tokens.ts`）

组件中可直接 import 使用：

```typescript
import { HEALTH, CONFIDENCE, PRIORITY, BSC_PERSPECTIVE, NINE_BOX_CELL } from '@/lib/design-tokens';

// 用法示例
<div className={HEALTH.green.badge}>健康</div>
<div className={CONFIDENCE['at-risk'].bar}>有风险</div>
<span className={PRIORITY.urgent.badge}>紧急</span>
```

| Token | 用途 |
|-------|------|
| `HEALTH` | KPI 健康度（green/amber/red） |
| `GRADE` | 九宫格纵轴等级（high/mid/low） |
| `CONFIDENCE` | OKR/TTI 信心度（on-track/at-risk/off-track） |
| `PRIORITY` | 优先级（urgent/high/medium/low） |
| `SCOPE` | KPI 范围（bonus/monitor） |
| `DATA_SOURCE` | 数据来源（manual/erp/system/pending） |
| `BSC_PERSPECTIVE` | 平衡记分卡四维（financial/customer/process/growth） |
| `NINE_BOX_CELL` | 九宫格人才格（star/high_performer 等 9 格） |

---

## 五、阴影与圆角

### 5.1 阴影（Apple Soft，禁止 Material）

**绝对禁止**使用 Tailwind 默认 `shadow-sm/md/lg`（Material 风格，opacity 0.25，太重）。

| 用途 | 强制类名 | 特征 |
|------|----------|------|
| 微浮起 / 列表项 | `.shadow-soft-xs` | 0 1px 2px, opacity 0.04 |
| 小卡 / 工具栏 | `.shadow-soft-sm` | 0 2px 8px, opacity 0.06 |
| 浮起卡 / 下拉 | `.shadow-soft` (md) | 0 4px 16px, opacity 0.08 |
| Hero / 模态 | `.shadow-soft-lg` | 0 12px 32px, opacity 0.10 |
| 大模态 / 强调 | `.shadow-soft-xl` | 0 24px 64px, opacity 0.14 |
| 品牌聚焦环 | `.ring-brand-glow` | 0 0 0 4px rgba(200,32,44,0.16) |

### 5.2 圆角节奏

| 场景 | 值 | 类名 |
|------|-----|------|
| 按钮 / pill | 9999px | `rounded-full` |
| 按钮 / 输入框 / 列表项 | 10px | `rounded-md` |
| **卡片** | **16px** | **`rounded-2xl`** |
| **Hero / 大模块** | **24px** | **`rounded-3xl`** |

**禁止**: 在 Hero 上使用 `rounded-lg` (8px)，太碎。

---

## 六、Hero 卡设计强制

所有"页面级 Hero"（学员证、课程页、营销页顶部、个人工作台头部）必须遵循以下规范：

| 属性 | 强制要求 |
|------|----------|
| **背景** | `.hero-ink`（深底 ink-black + 品牌径向光）或 `.glass`（玻璃拟态） |
| **标题** | ≥ `.text-title-2` (28px) |
| **副标** | `.text-caption` 或 `.text-body`，深底用 `rgba(255,255,255,0.7)` |
| **内边距** | ≥ `p-6 sm:p-8` |
| **圆角** | `rounded-3xl` (24px) |
| **阴影** | `shadow-soft-lg` 或 `shadow-soft-xl` |

**禁止**: Hero 用 `bg-amber-50`、`bg-sky-50` 等浅花色铺底——那是**内容卡**才有的视觉量。

### 6.1 `.hero-ink` 构成

```css
background:
  radial-gradient(120% 80% at 100% 0%, rgb(var(--brand-700) / 0.25) 0%, transparent 60%),
  linear-gradient(135deg, rgb(var(--rheem-ink-black)) 0%, rgb(var(--rheem-charcoal)) 100%);
/* + 32px 网格纹理 + 圆角 24px + shadow-soft-lg */
```

---

## 七、核心组件类速查

### 7.1 卡片

| 类名 | 特征 | 用途 |
|------|------|------|
| `.surface-card` | 白底 + 细边框 + 微阴影 (`shadow-xs`) + `rounded-2xl` | 标准内容卡 |
| `.surface-card-soft` | 灰底 (`surface-2`) + 细边框 + `rounded-2xl`，**无阴影** | 列表内部卡、次级信息 |
| `.card-elevated` | 白底 + 边框 + `shadow-sm` + hover 升 `shadow-md` + active scale | 可交互入口卡 |

### 7.2 Pill 徽章

| 类名 | 特征 | 用途 |
|------|------|------|
| `.pill-brand` | 粉白底 + 红字 + 红边 | 品牌状态、强调标签 |
| `.pill-neutral` | 灰底 + 灰字 + 灰边 | 中性状态、默认标签 |
| `.pill-on-dark` | 半透明白底 + 白字 + blur | 深色背景上的标签 |

### 7.3 玻璃拟态

| 类名 | blur | 用途 |
|------|------|------|
| `.glass` | 20px + saturate 180% | 标准玻璃浮层 |
| `.glass-thick` | 40px + saturate 200% | 重度玻璃（模态、侧边栏） |

### 7.4 Rheem 品牌组件

| 类名 | 特征 | 用途 |
|------|------|------|
| `.rheem-tile` | 红色实心砖 (`brand-500`)、白字、圆角 12px、hover 变 `brand-600` | 首页 launchpad 入口 |
| `.rheem-btn-pill` | 红色 pill 按钮、白字、shadow-sm、hover/active 动效 | 主要 CTA |
| `.rheem-display` | 800 字重、ink-black、大字 | 登录页 "hello." 级标题 |

### 7.5 交互表面

| 类名 | 特征 |
|------|------|
| `.surface-interactive` | hover 背景过渡 + active `scale(0.98)` |

---

## 八、动效规范

### 8.1 时长 Token

| 名称 | 值 | 场景 |
|------|-----|------|
| `--duration-instant` | 100ms | 按压反馈、微交互 |
| `--duration-fast` | 200ms | hover、开关、颜色过渡 |
| `--duration-base` | 300ms | 标准过渡、出现消失 |
| `--duration-slow` | 500ms | 较大状态变化 |
| `--duration-emphasis` | 700ms | 强调动效、引导 |

### 8.2 曲线 Token

| 名称 | 值 | 场景 |
|------|-----|------|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 标准过渡 |
| `--ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | 元素进入 |
| `--ease-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | 元素离开 |
| `--ease-emphasis` | `cubic-bezier(0.32, 0.72, 0, 1)` | **iOS Spring**，强调 |

### 8.3 可用动画类

| 类名 | 效果 |
|------|------|
| `.animate-pulse-soft` | 柔和呼吸（opacity 1→0.7） |
| `.animate-fade-in-up` | 淡入上滑（8px → 0） |
| `.skeleton` | 骨架屏扫光（品牌色温） |

**禁止**: 在 Tailwind 写 `transition duration-300 ease-in-out`（默认曲线 = Material，不是 iOS spring）。

**无障碍**: `prefers-reduced-motion: reduce` 已全局处理，动画时长强制降至 0.01ms。

---

## 九、Persona Stage 配色专属通道

5 阶段（newborn → partner）**只能**通过以下链路取色：

```
STAGE_META[stage].tone → TONE_TOKENS[tone]
```

`TONE_TOKENS` 是 Stage 视觉的**唯一 SSOT**，禁止散落硬编码。

### 9.1 Stage 映射

| Stage | 中文 | Emoji | Tone | TONE_TOKENS 键 |
|-------|------|-------|------|----------------|
| newborn | 新手 | 🥚 | slate | `slate` |
| apprentice | 上手 | 🐣 | sky | `sky` |
| assistant | 熟手 | 🐤 | amber | `amber` |
| deputy | 老手 | 🦅 | emerald | `emerald` |
| partner | 拿手 | 🐉 | purple | `purple` |

### 9.2 Tone Token 结构

每个 tone 提供：
- `bgSoft` — Hero 浅背景
- `border` — 边框色
- `text` — 文字主色
- `progressFill` — 进度条填充
- `nodeBg` — Timeline 节点背景

---

## 十、PR 自检清单（提交前逐条勾选）

提交任何 UI 改动前，**必须**逐条自检：

- [ ] **颜色**：无 `bg-slate-*`、`text-amber-*`、`border-rose-*` 等 raw Tailwind 颜色（语义 token 例外）
- [ ] **字体**：结构性 typography 用 `.text-{display|title-1|title-2|title-3|headline|body|caption|footnote}`，不用 raw `text-lg/xl/2xl`
- [ ] **阴影**：用 `.shadow-soft-*`，不用 Tailwind 默认 `shadow-*`
- [ ] **圆角**：卡片 `rounded-2xl`+，Hero `rounded-3xl`，不用 Hero 上的 `rounded-lg`
- [ ] **Hero**：用 `.hero-ink` 或 `.glass`，标题 ≥ 28px
- [ ] **Stage 色**：走 `STAGE_META.tone → TONE_TOKENS`，不散落
- [ ] **动效**：用 `--duration-*` / `--ease-*`，不用 Tailwind 默认
- [ ] **Dark Mode**：验证浅深色都正常（`globals.css` 已覆盖，别破坏）

**违规 = PR 直接打回，不论功能完成度。**

---

## 十一、关键文件索引

| 文件 | 职责 | 修改权限 |
|------|------|----------|
| `docs/CHARTER-UI-V1.md` | 战术细则 + 违规档案（与 MANIFESTO 同等不可妥协） | Owner 级 |
| `docs/UI-IA.md` | 全量信息架构 + 设计语言规格（给设计师/产品） | 产品Owner |
| `app/globals.css` | **实现层 SSOT**（所有原子类、变量、token 定义） | 前端 Lead |
| `lib/design-tokens.ts` | 语义 Token TS 层（HEALTH/GRADE/SCOPE/BSC 等） | 前端 Lead |
| `lib/persona/stage-meta.ts` | Stage 元数据 + TONE_TOKENS（Stage 配色唯一 SSOT） | 前端 Lead |

**优先级链**: `MANIFESTO §20` > `CHARTER-UI-V1.md` > `UI-IA.md` > `globals.css`

---

## 十二、违规事故档案（持续更新）

| 日期 | 范围 | 违规项 | 修复 |
|------|------|--------|------|
| 2026-05-29 | Academy Metaphor 7 组件 | 全 raw Tailwind + Tailwind 默认 shadow + Hero `text-lg` 当主标 | 同日重构 |
| 2026-05-29 PT 19:30 | /learning banner + BossAI header | `bg-amber-50` raw 调色 + 未定义 `text-callout` | 同日整改 |
| 2026-05-29 PT 22:10 | /admin/usage 看板 | 全 raw Tailwind (`text-zinc-*`、`border-zinc-*`、`bg-white` + `text-2xl` 未走 scale) | commit `4d495d5` 整改 |

**每次违规必须登记，不许默默修。**

---

## 十三、快速速查卡

### 13.1 新建一个标准卡片

```tsx
<div className="surface-card p-6">
  <h3 className="text-title-3 text-primary">标题</h3>
  <p className="text-body text-secondary mt-2">正文内容...</p>
</div>
```

### 13.2 新建一个 Hero

```tsx
<div className="hero-ink p-6 sm:p-8 rounded-3xl shadow-soft-lg">
  <h1 className="text-title-2">页面主标题</h1>
  <p className="text-caption mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
    副标题说明
  </p>
</div>
```

### 13.3 新建一个 Pill 徽章

```tsx
<span className="pill-brand">品牌标签</span>
<span className="pill-neutral">中性标签</span>
```

### 13.4 使用语义 Token

```tsx
import { HEALTH, CONFIDENCE } from '@/lib/design-tokens';

<span className={HEALTH.green.badge}>达标</span>
<div className={CONFIDENCE['on-track'].bar} style={{ width: '80%' }} />
```

### 13.5 Stage 配色

```tsx
import { STAGE_META, TONE_TOKENS } from '@/lib/persona/stage-meta';

const tone = STAGE_META[userStage].tone;
const tokens = TONE_TOKENS[tone];

<div className={`${tokens.bgSoft} ${tokens.border} ${tokens.text}`}>...</div>
```

---

*本文档为 `docs/CHARTER-UI-V1.md` 的完整沟通版，覆盖所有实现细节，可直接用于团队培训、设计师对接、外包沟通。*
