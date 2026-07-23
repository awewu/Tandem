# AI Design Toolchain Reference

Use this reference to choose which external AI design tool/agent pattern to learn from or emulate during Rheem design work. Tool capabilities change quickly; verify official pages before making "latest" claims.

## Tool Map

| Target | Best-fit tools / agents | Use for |
| --- | --- | --- |
| Fast UI concept generation | Google Stitch | Natural-language high-fidelity screens, UI flows, and multi-screen design exploration. |
| Figma design collaboration | Figma AI / Figma Make | Prompt-to-design exploration, interactive prototypes, editable design collaboration, and web app mockups in the Figma workflow. |
| React / Next.js UI delivery | Vercel v0 | Frontend components, pages, dashboards, SaaS UI, React/Tailwind/shadcn-style implementation drafts. |
| Full-stack MVP | Lovable / Bolt / Replit Agent | Quickly produce runnable product prototypes with UI, app logic, and basic backend or deployment flow. |
| Brand VI / visual system | Canva AI / Adobe Firefly / Recraft / Brandmark | Logo directions, brand colors, typography exploration, campaign visuals, social assets, and visual identity boards. |
| Code-level refinement | Codex / Claude Code / Cursor Agent | Turn design into maintainable production code, fix layout, responsiveness, accessibility, interaction states, and integration issues. |

## Selection Rules

- Use Stitch-like methods when the user needs multiple UI concepts before code.
- Use Figma-like methods when collaboration, editable prototypes, or design handoff is central.
- Use v0-like methods when the target is React/Next.js UI code or dashboard/page scaffolding.
- Use Lovable/Bolt/Replit-like methods when the target is a runnable MVP rather than a design system.
- Use Canva/Firefly/Recraft/Brandmark-like methods for VI exploration, brand boards, and marketing visual assets.
- Use Codex/Claude/Cursor-like methods for repository-aware implementation, debugging, responsive repair, accessibility, and visual QA loops.

## Integration Boundary

Do not copy a tool's surface style blindly. Extract reusable method patterns:

- How it structures prompts
- How it represents design tokens
- How it handles multi-screen flows
- How it turns design into code
- How it validates responsiveness and visual quality

Rheem standards remain governed by official Rheem research and the local product context.
