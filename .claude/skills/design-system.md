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
