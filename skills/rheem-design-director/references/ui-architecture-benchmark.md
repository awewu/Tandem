# UI Architecture Benchmark

This benchmark summarizes what to learn from leading AI UI and app-building tools, and what Rheem design work must improve.

## Competitor Lessons

| Segment | Reference tools / agents | Strength | Rheem improvement |
| --- | --- | --- | --- |
| Fast UI concepts | Google Stitch | Natural-language high-fidelity screens, multi-screen flows, rapid option exploration | Generate 2-3 directions before choosing one; compare concept fit against Rheem VI. |
| Figma collaboration | Figma AI / Figma Make | Editable prototypes, collaboration, interactive design handoff | Define Figma-ready component names, variants, auto-layout rules, tokens, and handoff notes. |
| React/Next.js UI | Vercel v0 | Fast React/Tailwind/shadcn-style page and dashboard generation | Build Rheem-specific component language so output does not feel like generic shadcn SaaS. |
| Full-stack MVP | Lovable / Bolt / Replit Agent | Prompt-to-running-product workflows | Convert screens into real Rheem flows: equipment selection, quotation, project status, support, document lookup. |
| Brand VI | Canva AI / Adobe Firefly / Recraft / Brandmark | Brand kits, logo/asset exploration, style consistency | Produce Rheem brand boards and asset rules, but ground final decisions in official Rheem research. |
| Design to code | Builder.io Visual Copilot / Locofy / Anima | Figma-to-code and responsive component conversion | Map design tokens and components to the current repo instead of generating isolated code. |
| Code refinement | Codex / Claude Code / Cursor | Repository-aware implementation and bug fixing | Run visual QA loops and patch real files without breaking existing architecture. |
| Visual QA | Applitools / Chromatic / visual regression tools | Screenshot baselines and cross-state visual checking | Add browser screenshot audits for desktop, tablet, mobile, hover/focus/error/empty/loading states. |

## Required UI Architecture Capabilities

### 1. Multi-Concept Exploration

For important screens, create at least two viable UI directions:

- Engineering Console: dense, operational, table/diagram heavy.
- Commercial Solution: role-based, support/logistics heavy.
- Customer Presentation: visual, simplified, benefit-led.

Compare them by audience, workflow fit, Rheem brand fit, implementation effort, and responsive risk.

### 2. Information Density Rules

Rheem professional tools should be dense but orderly:

- Keep core metrics, status, and next action visible above the fold.
- Prefer tables and comparison matrices for specs.
- Use cards only for repeated items, grouped metrics, product entries, or actions.
- Avoid card stacks that do not support decisions.
- Use dashboard surfaces for current project state, equipment selection, load/pipe calculations, quotation, documentation, and support.

### 3. State Architecture

Every interactive surface needs states:

- Default
- Hover
- Focus
- Active/selected
- Disabled
- Loading
- Empty
- Error
- Warning
- Success

States must be visually distinct without relying only on color.

### 4. Handoff Rules

Design handoff should specify:

- Screen purpose and user role.
- Component inventory.
- Responsive behavior.
- Token names.
- Data requirements.
- Empty/error/loading behavior.
- Accessibility notes.
- Visual QA checklist.

### 5. Anti-Generic Rules

Reject designs that:

- Look like unbranded v0/shadcn defaults.
- Use gradients or glass panels as the main visual idea.
- Overuse oversized cards and hero copy.
- Hide actual product/system details.
- Lack real workflow states.
- Cannot explain why each module exists.
