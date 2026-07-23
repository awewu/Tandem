# Frontend Implementation Skill Module

Use this module to turn Rheem UI/VI designs into code while preserving brand, component structure, accessibility, and project conventions.

## Implementation Order

1. Inspect the existing project structure, CSS tokens, components, and routing.
2. Load `rheem-design-system-standard.md` and any relevant UI/brand module.
3. Map design tokens before writing layout.
4. Reuse existing components and styles where they are compatible with the Rheem standard.
5. Build the smallest working slice first.
6. Run visual QA on desktop, tablet, and mobile.

## HTML/CSS Pages

- Use CSS custom properties for Rheem tokens.
- Avoid hardcoded repeated color values after token setup.
- Use semantic class names tied to roles: `.commercial-hero`, `.spec-table`, `.support-panel`.
- Keep responsive constraints explicit with grid/flex, minmax, max-width, and overflow wrappers.
- For tables, use container-level horizontal scroll on mobile.

## React/Vue/Next

- Map Rheem tokens into the app's design system or theme layer.
- Prefer existing Button, Table, Badge, Tabs, Dialog, Form, and Sidebar components.
- Preserve routing and state-management patterns already in the repo.
- Keep product data separate from presentation.
- Type component props when TypeScript is present.

## Tailwind / shadcn

- Use semantic tokens (`bg-primary`, `text-muted-foreground`) instead of raw red utilities.
- Compose with installed shadcn components before creating custom markup.
- Use full component composition: CardHeader, CardTitle, CardContent, CardFooter.
- Use Badge, Alert, Skeleton, Empty, Dialog, Tabs, Table instead of custom spans/divs.
- Do not override component color/typography with scattered utility classes.

## Figma To Code

When Figma is involved:

1. Fetch design context for the exact node.
2. Fetch screenshot.
3. Download assets from the Figma payload.
4. Map Figma tokens to Rheem/project tokens.
5. Implement with project conventions.
6. Compare against screenshot and document deviations.

## Logo Handling

- For prototypes, the current sample may reference the official-source remote badge URL.
- For production, block use of `/images/rheem-logo.svg` until it is replaced by approved Rheem brand package asset.
- Never recreate the logo in code.

## Accessibility

- Buttons and links must have discernible text.
- Dialog/sheet/drawer must have titles.
- Focus states must be visible.
- Status must not rely on color alone.
- Form labels and units must be visible.

## Delivery Report

Report:

- Files changed.
- Tokens/components used.
- Viewports checked.
- Visual QA findings.
- Remaining brand gates, especially logo asset approval.
