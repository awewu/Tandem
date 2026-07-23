# Design System Agent Module

Use this module to define or refine Rheem component libraries, token architecture, variants, and design-to-code handoff.

## Token Architecture

Use three layers:

1. Primitive tokens: official colors, typography, spacing, radius, shadows.
2. Semantic tokens: purpose aliases.
3. Component tokens: per-component styling.

Example:

```css
:root {
  --rheem-red: #E4002B;
  --color-action-primary: var(--rheem-red);
  --button-primary-bg: var(--color-action-primary);
}
```

## Required Component Specs

Define each component with:

- Purpose.
- Anatomy.
- Variants.
- States.
- Tokens.
- Accessibility notes.
- Responsive behavior.
- Do/don't examples.

## Rheem Core Components

- Button: primary, secondary, tertiary, destructive, loading.
- Badge: brand domain, status, role, document state.
- Tabs/segmented control: product category, role switcher, system view.
- Table: products/specs, documents, quotes, audit findings.
- Form field: engineering input with units and validation.
- Card: product/category/proof point only.
- Panel: dashboard/workbench sections.
- Alert: rebate, warning, brand gate, missing document.
- Dialog/sheet: focused edits, approvals, export, confirmation.
- Empty/loading/error: practical next action, no cute filler.
- Sidebar/navigation: workflow-first grouping.

## Component Naming

Use names that preserve Rheem workflow:

- `CommercialSolutionHero`
- `ApplicationSupportPanel`
- `ProductSpecTable`
- `DocumentReadinessBadge`
- `BrandGateAlert`
- `ChineseAnchorCard`
- `ResponsiveAuditPanel`

## State Matrix

Every interactive component needs:

- Default
- Hover
- Focus
- Active/selected
- Disabled
- Loading
- Empty when relevant
- Error/warning/success when relevant

## Handoff

For Figma or design-doc handoff:

- Include token names, not only hex values.
- Define Auto Layout or responsive constraints.
- List component variants.
- Include desktop/tablet/mobile notes.
- Include accessibility requirements.
- Include known brand gates, especially logo approval.

## Validation

- Run token validation when scripts exist.
- Search for hardcoded old Rheem red `#C41230`.
- Search for local placeholder logo usage.
- Screenshot key components at multiple viewports.
- Check all components against the visual audit scorecard.
