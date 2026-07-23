# UI Design Skill Module

Use this module for Rheem page layout, information architecture, screen concepts, workflow design, component hierarchy, and interaction states.

## Inputs To Inspect

- User role: homeowner, commercial owner, engineer, contractor, builder, installer, sales consultant, brand reviewer.
- Product domain: residential water, commercial water, HVAC, hydronic, support, warranty, rebates, sustainability, documentation.
- Task: discover, compare, specify, quote, review, support, register, find a pro, document lookup.
- Brand standard: read `rheem-official-vi.md` and `rheem-chinese-localization.md` for copy and tone.

## Layout Archetypes

### Official Website Page

Use for marketing/product pages:

- Header with official Rheem badge and utility navigation.
- Benefit-led hero with real product/lifestyle/system evidence.
- Category entry cards.
- Product education or innovation band.
- Support paths: Find a Pro, warranties, rebates, document finder, training.
- Direct CTAs.

### Commercial Solution Page

Use for commercial water and professional audiences:

- Role switcher: engineer, contractor, builder, owner.
- Application selector.
- Product/spec table.
- Expert/application support panel.
- Document package readiness.
- Delivery/availability/emergency support path.
- Training and contact CTAs.

### Professional Workbench

Use for internal product software:

- Compact header with project/status.
- Sidebar or workflow navigation.
- Metric strip.
- Main analysis or design panel.
- Product/spec/quote/document table.
- Right-side QA/support panel.

### Chinese Brand Presentation

Use for Chinese localized executive or customer views:

- Use short anchors such as `稳供`, `定规`, `善度`, `通达`, `安心`.
- Pair every poetic phrase with operational evidence.
- Avoid ceremonial copy without action.

## Information Density

- Marketing pages can breathe; workbenches should be dense but calm.
- Keep primary status, next action, and evidence above the fold.
- Use tables for specs, documents, quote lines, and audit findings.
- Use cards for product categories, proof points, or repeated entities only.
- Avoid nested cards and dashboard filler.

## Interaction States

Define:

- Default, hover, focus, selected, disabled.
- Loading, empty, error, warning, success.
- Mobile collapsed navigation or horizontal table scroll.
- Form validation with units for engineering inputs.

## Concept Generation

For important screens, produce 2-3 concepts before implementation:

- Official Site Fidelity: closest to rheem.com language and structure.
- Commercial Operations: dense professional support/spec workflow.
- Chinese Brand Localized: preserves Rheem tone through localized anchors.

Compare by brand fit, user task fit, implementation effort, and responsive risk.

## Acceptance Criteria

- The screen communicates reliability, efficiency, sustainability, and support.
- Rheem red is used as identity/action, not decoration.
- The user can identify the next action within three seconds.
- Product/support/document paths are visible when relevant.
- Chinese copy has flavor without becoming vague.
