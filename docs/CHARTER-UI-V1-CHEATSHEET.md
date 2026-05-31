# CHARTER-UI-V1 速查卡

> 一页纸 lookup. 写 UI 时左列搜"想要的视觉", 右列直接抄 class.
> 全量规格见 `docs/CHARTER-UI-V1.md`. token 定义见 `app/globals.css` + `tailwind.config.ts`.
>
> **强制等级**: pre-commit + CI 都跑 `npm run lint:ui-charter --strict`. 任何 raw token 直接 fail.

---

## 1. 字号 (§1.2 · 8 步 Apple Type Scale)

| 想要的视觉                          | ❌ 不许用      | ✅ 用                   | 像素 |
| ----------------------------------- | -------------- | ----------------------- | ---: |
| 大 hero 主标 (落地页 / launch hero) | `text-5xl`+    | `text-display`          | 56   |
| 章节大标题                          | `text-4xl`     | `text-title-1`          | 36   |
| 卡片大标 / dialog 标题              | `text-3xl`     | `text-title-2`          | 28   |
| 卡片中标 / 表头                     | `text-2xl`     | `text-title-3`          | 22   |
| 子区段 / 按钮内文 / 重点行          | `text-lg`/`xl` | `text-headline`         | 18   |
| 正文                                | `text-base`    | `text-body`             | 15   |
| 次要正文 / label / 表格内文         | `text-sm`      | `text-caption`          | 13   |
| 元数据 / 时间戳 / 提示              | `text-xs`      | `text-footnote`         | 12   |

> **一句话**: 字号一律用语义名 (display / title-1..3 / headline / body / caption / footnote), **永远不用 text-{size 数字}**.

---

## 2. 文本色 (§1.3)

| 重要程度        | ❌ 不许用                       | ✅ 用                |
| --------------- | ------------------------------- | -------------------- |
| 主标 / 强调     | `text-zinc-900` `text-slate-800`| `text-ink-primary`   |
| 正文 / 多数文字 | `text-zinc-700` `text-slate-600`| `text-ink-secondary` |
| 弱化 / 元数据   | `text-zinc-400` `text-gray-500` | `text-ink-tertiary`  |
| 静默 (shadcn)   | —                               | `text-muted-foreground` (兼容 shadcn 组件) |
| 反白 (深底上)   | `text-white`                    | `text-white` (深底场景允许) |

---

## 3. 表面 / 背景 (§1.5)

| 用途                    | ❌ 不许用                  | ✅ 用                   |
| ----------------------- | -------------------------- | ----------------------- |
| 页面主底                | `bg-zinc-50` `bg-gray-50`  | `bg-surface-1`          |
| 卡片底 / 二级容器       | `bg-zinc-100` `bg-white`   | `bg-surface-2`          |
| 输入框 / 嵌套底         | `bg-zinc-200`              | `bg-surface-3`          |
| 玻璃拟态 (浮层 / 顶栏)  | 自调 `backdrop-blur`       | `.glass` / `.glass-thick` |
| Hero 深底               | `bg-gradient...`           | `.hero-ink`             |
| 标准卡片 (圆角+阴影+边) | 散搭                       | `.surface-card` / `.surface-card-soft` |

---

## 4. 语义色 (§1.4 · success / warning / danger / info)

> 规则: **text 永远纯色, bg/border/ring 按色阶用 `/N` alpha**.

| 想要的视觉            | ❌ 不许用                 | ✅ 用                            |
| --------------------- | ------------------------- | -------------------------------- |
| 成功 / 通过文字       | `text-green-600`          | `text-success`                   |
| 成功背景 (淡)         | `bg-green-50`             | `bg-success/5`                   |
| 成功背景 (中)         | `bg-green-100`            | `bg-success/10`                  |
| 成功边框              | `border-green-200`        | `border-success/20`              |
| 警告文字              | `text-amber-700`          | `text-warning`                   |
| 警告背景 (淡)         | `bg-amber-50`             | `bg-warning/5`                   |
| 警告 dashed 边        | `border-amber-300`        | `border-warning/30`              |
| 危险文字              | `text-red-600`            | `text-danger`                    |
| 危险按钮底            | `bg-red-500`              | `bg-danger`                      |
| 危险背景 (淡)         | `bg-red-50`               | `bg-danger/5`                    |
| 信息蓝文字            | `text-blue-600`           | `text-info`                      |

> 速查 alpha 表:
>
> shade 50 → /5 · shade 100 → /10 · shade 200 → /20 · shade 300 → /30 · shade 400 → /50 · shade 500+ → 纯色 (无 /N)

---

## 5. Persona 阶段色 (TONE_TOKENS · 唯一来源 `lib/persona/stage-meta.ts`)

```ts
import { STAGE_META, type PersonaStage } from '@/lib/persona/stage-meta';

const tone = STAGE_META[stage].tone;
//   tone.bg     → bg-{persona-stage}/10  写法的预设
//   tone.text   → text-persona-{stage} 等
```

不允许写死 `bg-blue-500 // newborn`, 一律读 `STAGE_META[stage].tone`.

---

## 6. 圆角 (§1.7)

| 用途                  | ❌ 不许用     | ✅ 用                                |
| --------------------- | ------------- | ------------------------------------ |
| Hero / 大卡           | —             | `rounded-3xl`                        |
| 标准卡 / dialog       | `rounded-xl`  | `rounded-2xl`                        |
| 中等元素 / popover    | —             | `rounded-lg` (16px 等价 design token)|
| 按钮 / Pill           | —             | `rounded-md` 或 `rounded-full`       |
| 输入框                | —             | `rounded-md` 或 `rounded-lg`         |

> **rounded-xl 已废**, 一律走 `rounded-2xl` 起步. 全项目已清零.

---

## 7. 阴影 (§1.8 · Apple soft, 不要 Material)

| 强度          | ❌ 不许用    | ✅ 用              |
| ------------- | ------------ | ------------------ |
| 极轻 (hairline) | `shadow-sm`  | `shadow-soft-xs`   |
| 轻 (列表卡)   | `shadow-md`  | `shadow-soft-sm`   |
| 中 (默认卡)   | `shadow-lg`  | `shadow-soft`      |
| 重 (悬浮 / dialog) | `shadow-xl` | `shadow-soft-lg`   |
| 超重 (modal)  | `shadow-2xl` | `shadow-soft-xl`   |
| 焦点 brand 光 | 自调 ring    | `ring-brand-glow` 或 `shadow-glow-brand` |

---

## 8. 动效 (§1.10 · 必走 CSS var)

❌ **禁止**:

```tsx
className="transition-all duration-300 ease-in-out"
```

✅ **允许**:

```tsx
// 方案 1 · 内联 style 走 CSS var
<div style={{
  transition: 'all var(--duration-fast) var(--ease-standard)',
}}>

// 方案 2 · 用 globals.css 已封装的语义类
<button className="surface-interactive">     // hover / active 节奏
<div className="card-elevated">              // 卡片标准 hover 抬起
<div className="animate-fade-in-up">         // 入场
<div className="animate-pulse-soft">         // 软呼吸 (loading)
```

| Duration token       | 时长   | 用途                      |
| -------------------- | ------ | ------------------------- |
| `--duration-instant` | 100ms  | 按下 / press feedback     |
| `--duration-fast`    | 200ms  | hover / focus             |
| `--duration-base`    | 300ms  | 一般状态切换              |
| `--duration-slow`    | 500ms  | 大组件展开                |
| `--duration-emphasis`| 700ms  | 营销级强调动画            |

| Ease token             | 用途                     |
| ---------------------- | ------------------------ |
| `--ease-standard`      | 默认 (in-out)            |
| `--ease-decelerate`    | 入场 (从静到动)          |
| `--ease-accelerate`    | 出场 (从动到静)          |
| `--ease-emphasis`      | iOS 17 Apple emphasis    |

---

## 9. 响应式 (§M1 · 强制断点)

每个 `app/**/page.tsx` 必须**至少出现一次** `sm:` / `md:` / `lg:` / `xl:` / `2xl:`.

常用模式:

```tsx
// 双栏布局 (mobile 堆叠 → desktop 并排)
<div className="flex flex-col md:flex-row h-screen">
  <aside className="w-full md:w-80 ...">...</aside>
  <main className="flex-1 ...">...</main>
</div>

// 网格 (mobile 单列 → desktop 多列)
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

// padding (mobile 紧 → desktop 松)
<div className="p-4 md:p-8">

// 字号 (mobile 小 → desktop 大)
<h1 className="text-title-2 md:text-title-1">

// 显示控制 (mobile 隐藏次要)
<div className="hidden md:block">  {/* mobile 不显示 */}
<div className="md:hidden">         {/* mobile 才显示 */}
```

断点参考 (Tailwind 默认):

- `sm:` ≥ 640px (大手机横屏)
- `md:` ≥ 768px (平板)
- `lg:` ≥ 1024px (桌面)
- `xl:` ≥ 1280px (大桌面)

---

## 10. Pill / 标签 / 砖 (§1.6, §1.9 · 视觉口径锁住)

| 想要的视觉              | ✅ 用                                                |
| ----------------------- | ---------------------------------------------------- |
| 品牌色 Pill             | `.pill-brand`                                        |
| 中性 Pill               | `.pill-neutral`                                      |
| 深底 Pill (Hero 上)     | `.pill-on-dark`                                      |
| Launchpad 砖            | `.rheem-tile` (+ `.launchpad-narrow` 变体)           |
| CTA 大按钮              | `.rheem-btn-pill`                                    |
| Rheem 大字标            | `.rheem-display`                                     |

---

## 11. 上手流程 (写新组件 / 改老组件)

1. **先 grep**: `Get-ChildItem -Recurse -Filter '*Card*.tsx' -Path components` 看是否已有同名组件可复用
2. **写时只用 § 1-10 的 ✅ 列表**, 不用任何 raw Tailwind palette
3. **存盘前自检**: `npm run lint:ui-charter -- --strict` 必 0 违规
4. **提交时**: pre-commit hook 自动跑同一闸 (script: `scripts/check-ui-charter.mjs`)
5. **Push 后**: GitHub Actions `ui-charter` job 第三道闸. fail 即 block merge.
6. **写完忘了某个映射**: 跑 `node scripts/codemod-charter-tokens.mjs --dry` 自动建议替换

---

## 12. 自检命令一栏

```powershell
# 全量审计 (绕过 allowlist, 报真实数字)
node scripts/audit-ui-charter.mjs > docs/UI-AUDIT-now.md

# 增量审计 (只查改过的文件)
node scripts/audit-ui-charter.mjs --since=HEAD~10
node scripts/audit-ui-charter.mjs --since=main      # 跟主干 diff

# pre-commit / CI 用 (有 allowlist, strict mode)
npm run lint:ui-charter -- --strict

# 一键自动迁移 (token + 响应断点)
node scripts/codemod-charter-tokens.mjs --dry        # 预览
node scripts/codemod-charter-tokens.mjs              # 实修
node scripts/codemod-responsive-layout.mjs --dry     # 预览
node scripts/codemod-responsive-layout.mjs           # 实修
```

---

## 13. 不可妥协铁律 (违反 = PR 直接打回)

1. **禁** raw `bg-slate-*` `text-amber-*` `border-rose-*` (语义 token 例外)
2. **禁** `shadow-{sm,md,lg,xl}` (Material 重影), 必用 `.shadow-soft-*`
3. **禁** Hero 用浅花底 (`bg-amber-50`), 必用 `.hero-ink` 或 `.glass`
4. **禁** Hero 主标 `text-lg/xl`, 主标 ≥ `text-title-2` (28px)
5. **禁** Stage 颜色散落, 唯一走 `STAGE_META.tone` → `TONE_TOKENS`
6. **禁** Tailwind raw motion (`transition-all duration-300`), 走 `--duration-*` + `--ease-*`
7. **禁** `rounded-xl`, 标准卡 `rounded-2xl` 起步
8. **禁** `app/**/page.tsx` 不带响应断点

---

## 14. 看别人怎么写 · 5 个学习对象

- **Vercel** (Geist 节奏 / 黑白对比) — Hero / 顶层框架
- **Apple Music** (大留白 / 玻璃拟态 / 大标题) — Hero / 内容呈现
- **Notion** (信息密度 / 内联编辑) — 内容卡 / 文档编辑
- **Stripe** (数据精确 / 表格审美) — Dashboard / 数据看板
- **Linear** (命令面板 / 快捷键) — 命令面板 / 快捷键 UX

---

## 15. 历史

- **2026-05-29** Academy Metaphor 7 组件批量违规事故 → 立宪
- **2026-05-31** 凌晨 1919 → 0 全量清零, allowlist 永久空; CI ratchet 上线
