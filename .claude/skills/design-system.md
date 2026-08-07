---
name: design-system
description: 瑞诺瓦AI舒适家设计系统执行器。Use when building or modifying any React/Next.js UI components in apps/dealer-workbench. Enforces DESIGN.md rules.
---

# Design System Enforcer — 瑞诺瓦AI舒适家

## Source of Truth
`/Users/tiechuishan/Documents/rhautt-web/enterprise_website/DESIGN.md`
`/Users/tiechuishan/Documents/rhautt-web/enterprise_website/apps/dealer-workbench/src/app/globals.css`

## CSS Classes (use these — never inline styles for layout/color)
```
Layout:    .layout .sidebar .content
Type:      .t-2xl .t-xl .t-lg .t-base .t-sm .t-xs .t-mono .t-num .t-muted
Cards:     .card .card-flat .inset
Buttons:   .btn .btn-sm .btn-brand .btn-outline .btn-ghost
Badges:    .badge .badge-red .badge-green .badge-blue .badge-amber .badge-grey
Input:     .input
Table:     .table
Grid:      .g2 .g3 .g4 .ga
Page head: .ph (contains h1 + p)
```

## Color Tokens (use CSS vars — never hex in JSX)
```
--ink --ink-2 --ink-3 --ink-4    (text hierarchy)
--bg --surface --surface-hover   (backgrounds)
--brand #C8102E                   (CTAs, active)
--brand-subtle                    (brand tint bg)
--sidebar #111827                 (nav only)
--success --warning --error --info
--border --border-2
```

## Shadows
```
--sh-xs  input boxes
--sh-sm  cards default
--sh-md  cards hover / dropdowns
--sh-lg  modals
```

## Page Template
```tsx
export default function MyPage() {
  return (
    <>
      <div className="ph">
        <h1>页面标题</h1>
        <p>副标题说明</p>
      </div>
      <div className="g2">
        <div className="card">...</div>
        <div className="card">...</div>
      </div>
    </>
  );
}
```

## NEVER
- Inline `style={{ background: '#xxx' }}` for colors
- `border-radius > 16px` or pill/capsule buttons
- Gradient backgrounds as main color blocks
- Emoji as navigation icons
- `.card` with colored backgrounds (yellow/blue/green)

## ALWAYS
- Stats: `<span className="t-num">42</span>`
- Status: `<span className="badge badge-green">完成</span>`
- Page wrap: layout is in layout.tsx — pages just return fragments `<>...</>`
- Font: Inter loads from Google Fonts in layout.tsx

## UX 体验层（DESIGN.md §9-16，v2 · 所有界面必守）
使用统一组件库（`src/components/ui/`）而非手搓状态：
- **状态五态**：异步区用 `<AsyncBoundary>`（loading→`<Skeleton/>`、empty→`<EmptyState/>`、error→`<ErrorState onRetry/>`）；禁白屏/禁无限 spinner。
- **反馈**：提交按钮用 loading 态；结果用 `toast()`；<100ms 反馈。
- **A11y**：交互区 ≥40px、可见 focus ring、表单 label/aria、对比 ≥4.5:1。
- **渐进披露**：一屏 ≤7 主区块，细节走抽屉/详情。
- **响应式**：工作台 ≥1280/1024/768 不塌；C 端移动优先。
- **表单**：行内校验、错误贴字段旁、破坏性操作二次确认、长表单存草稿。
- **导航**：面包屑+当前位置、⌘K 命令面板、返回不丢状态。
- **性能**：长列表(>50)虚拟化/分页、图片懒加载、路由级骨架屏。
