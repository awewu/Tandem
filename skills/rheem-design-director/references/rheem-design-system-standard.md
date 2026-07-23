<!-- ⚠️ DEPRECATED 2026-07-03: 内容已整合入 skills/rheem-design-director/references/RHEEM-VI-STANDARD.md，以该文件为准。-->

# Rheem Design System Standard

Use this as the component and token baseline for Rheem product UI work. It combines official Rheem brand research with professional HVAC software UI requirements.

## Token Layers

### Brand Tokens

- `brand.rheem.red`: `#E4002B`
- `brand.rheem.redDark`: `#A00F28`
- `brand.rheem.redLight`: `#E8455F`
- `brand.neutral.900`: `#2D2D2D`
- `brand.neutral.700`: `#4A4A4A`
- `brand.neutral.500`: `#666666`
- `brand.neutral.300`: `#999999`

### Semantic Tokens

- `surface.page`: light neutral page background.
- `surface.panel`: white panels for work areas.
- `surface.subtle`: light gray for secondary grouped content.
- `border.default`: neutral low-contrast border.
- `text.primary`: dark neutral.
- `text.secondary`: medium neutral.
- `action.primary`: Rheem red.
- `action.primaryHover`: dark Rheem red.
- `status.success`: green.
- `status.warning`: orange.
- `status.error`: red.
- `status.info`: blue.

### Domain Tokens

- `domain.water`: Rheem red.
- `domain.hydronic`: Rheem red with neutral technical surfaces.
- `domain.commercial`: darker neutral plus Rheem red action.
- `domain.residential`: white/light gray plus benefit-led red accents.
- `domain.air`: use only when local Ruud/Rheem taxonomy allows.

## Typography

Use Chinese-friendly system sans-serif:

```css
font-family: "Microsoft YaHei", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Rules:

- Dashboard H1: 22-28px.
- Panel titles: 15-18px.
- Table/body text: 12-14px.
- Metrics: 22-32px depending on density.
- Do not scale fonts with viewport width.
- Letter spacing should be 0 except tiny uppercase labels when needed.

## Logo Rules

- Use official Rheem brand package assets when available. For interim prototypes, use the official-source badge URL documented in `rheem-official-vi.md`.
- Do not use `/images/rheem-logo.svg` in production until that local file is replaced by an approved Rheem asset.
- Do not stretch, crop, recolor, rotate, or place on noisy backgrounds.
- Brand-led screens must show the logo or clear Rheem wordmark signal in the first viewport.
- Operational app screens can use compact logo placement, but not so small that brand identity disappears.

## Components

### Buttons

- Primary: Rheem red fill, white text, 8px radius or less.
- Secondary: white or subtle surface with Rheem red border/text.
- Tertiary: text or icon button for low-emphasis actions.
- Destructive: use semantic error, not brand red unless the action is also brand-primary.
- Include hover, focus, disabled, loading.

### Navigation

- Use side navigation for professional workbenches.
- Use top navigation for marketing/product pages.
- Active state may use Rheem red fill or red left marker.
- Group navigation by workflow, not internal departments.

### Cards And Panels

- Cards are for repeated entities or framed tools.
- Panels are for dashboard sections and work surfaces.
- Avoid nested cards.
- Keep radius 8px or less unless matching existing code.
- Use red top/left markers sparingly to mark primary panels.

### Tables

Use tables for equipment, specs, quote lines, documents, and audit findings.

Required table behavior:

- Sticky or clear header when long.
- Horizontal scroll on mobile.
- Status badges.
- Sorting/filtering when practical.
- Empty and loading states.

### Forms

- Labels always visible.
- Inputs 36-44px high in dense tools.
- Clear focus rings.
- Inline validation for technical values.
- Units visible for engineering inputs: kW, L, GPM, m, Pa, C, F.

### Badges

Use badges for:

- Brand domain: Rheem Water, Hydronic, Commercial.
- Status: pending, passed, warning, error.
- Product category.
- Role: engineer, contractor, homeowner, sales.

Badges must be readable and not become decorative confetti.

### Dialogs

Use dialogs for decisions, confirmations, imports/exports, and focused edits.

Rules:

- Clear title.
- One primary action.
- Secondary cancel action.
- Avoid long marketing content in dialogs.

### Empty / Loading / Error States

- Empty states explain what is missing and the next action.
- Loading states preserve layout dimensions.
- Error states state the problem and recovery path.
- Do not use cute illustrations unless approved for consumer-facing residential pages.

## Layout Patterns

### Professional Workbench

Use for designers, engineers, installers, sales consultants:

- Sidebar navigation.
- Top project/status bar.
- Metric strip.
- Main analysis panel.
- Detail table.
- Right-side audit/support panel when useful.

### Commercial Solution Page

Use for commercial water heating:

- Role selector.
- Application consulting CTA.
- Product/spec finder.
- Availability/logistics panel.
- Training/support block.
- Case studies or featured reading.

### Residential Product Page

Use for homeowner-facing experiences:

- Product category selector.
- Benefit-led innovation blocks.
- Savings/rebates/financing.
- Find-a-pro CTA.
- Warranty/registration.
- Education cards.

## Responsive Standard

Breakpoints:

- Mobile: 360-767px.
- Tablet: 768-1199px.
- Desktop: 1200px and up.

Rules:

- No horizontal body scroll except intentional table wrappers.
- Navigation collapses or wraps predictably.
- Metric grids become 2-column then 1-column.
- Tables scroll inside their containers.
- Buttons preserve readable labels.
- No text overlaps icons or adjacent content.

## Visual Audit Score

Score each screen 0-5:

- Brand accuracy
- Information hierarchy
- Component consistency
- Responsive fit
- Accessibility
- Professional HVAC credibility
- Anti-generic distinctiveness

Any score under 4 requires revision before approval.
