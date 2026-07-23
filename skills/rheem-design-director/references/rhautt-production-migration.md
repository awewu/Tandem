# Rhautt Rheem VI Production Migration

Date: 2026-06-07

This document defines the production migration path for applying the Rheem VI Agent to the Rhautt project.

## Current Status

Production readiness: blocked for full Rhautt site.

Reason: the agent and sample are production-grade as a governance system, but the wider Rhautt codebase still contains legacy Rheem VI conflicts.

Latest audit command:

```bash
npm run guard:rheem-vi-production
```

Latest audit output after full strict cleanup:

- Report: `audit/rheem-vi-production-audit.json`
- Total findings: 0
- High: 0
- Critical: 0
- Medium: 0

Rule counts:

- `fake-logo-lockup-language`: 0
- `local-logo-production-risk`: 0
- `old-rheem-red-hex`: 0
- `old-rheem-red-rgba`: 0
- `red-pink-gradient`: 0

Cleanup completed:

- `public/pain-diagnosis.html`: old `#C41230`, old `rgba(196,18,48,...)`, and gated `/images/rheem-logo.svg` references removed.
- `public/customer-share.html`: gated `/images/rheem-logo.svg` reference removed.
- Legacy, migration-candidate, static-inventory, shared-asset, and source-candidate fake lockup language has been cleaned from strict audit scope.
- Strict Rheem VI audit passes; browser visual QA remains a separate required launch proof.

## Production Assets Added

- `public/css/rheem-official-tokens.css`
- `public/design-tokens/rheem-official.tokens.json`
- `public/images/RHEEM_LOGO_ASSET_GATE.md`
- `scripts/agent-guards/rheem-vi-production-audit.js`

NPM scripts:

```bash
npm run guard:rheem-vi-production
npm run guard:rheem-vi-production:strict
```

## Production Gates

### Gate 1: Logo Asset

Blocked until brand owner provides an approved Rheem logo package asset.

Do not use:

- Project-made flame/wordmark logo.
- Chinese lockup inside logo.
- `Since 1925` additions.
- Redrawn SVG approximations.

Allowed for prototypes:

- Remote official-source badge URL documented in `rheem-official-vi.md`.

Required for production:

- Approved local logo asset at `public/images/rheem-logo.svg`.

### Gate 2: Official Color Migration

Replace:

- `#C41230` -> `#E4002B`
- `rgba(196,18,48,...)` -> `rgba(228,0,43,...)`

Prefer:

- Import `public/css/rheem-official-tokens.css`.
- Use `var(--rheem-color-red)` and semantic/component tokens.

### Gate 3: Red-Pink Gradient Cleanup

Audit `#ff6b6b`, `#E91E63`, and pink glow treatments.

Replace with:

- Official red plus deep red, navy, gray, teal, green, or orange depending on purpose.
- Neutrals for work surfaces.
- Red only for identity/action/critical path.

### Gate 4: Component System Adoption

Before production migration, each active route should map to:

- Buttons
- Tables
- Badges
- Forms
- Alerts
- Panels
- Empty/loading/error states
- Navigation

Use `design-system-agent.md` and `rheem-design-system-standard.md`.

### Gate 5: Responsive Visual QA

Each migrated route requires:

- Desktop screenshot
- Tablet screenshot
- Mobile screenshot
- No page-level horizontal overflow
- Logo rendered
- No Chinese text clipping
- Primary action visible

Use `responsive-qa-skill.md` and `visual-audit-agent.md`.

## Migration Order

### Phase 1: Token Foundation

- Import `rheem-official-tokens.css` into high-priority Rheem pages.
- Replace route-local primary variables with official tokens.
- Keep behavior unchanged.

### Phase 2: Logo Cleanup

- Install approved brand package asset.
- Replace all `/images/rheem-logo.svg` usages only after the local asset is approved.
- Remove any fake lockup references.

### Phase 3: High-Risk Route Migration

Start with top affected/high-traffic routes:

1. `public/pain-diagnosis.html`
2. `public/index-ready.html`
3. `public/sales.html`
4. `public/quotation-pro.html`
5. `public/construction-management.html`
6. `public/product-showcase.html`

### Phase 4: Visual Cleanup

- Remove red-pink gradients and glow-heavy treatments.
- Replace with Rheem official palette roles.
- Apply Chinese localization anchors only where they support concrete meaning.

### Phase 5: Strict Guard

Run:

```bash
npm run guard:rheem-vi-production:strict
```

Strict mode should pass before claiming project-wide production VI readiness.

## Definition Of Done

Rhautt reaches Rheem VI production readiness when:

- Strict VI audit passes or only documented false positives remain.
- Approved logo asset is installed.
- No active page presents `#C41230` as official Rheem red.
- No fake Rheem lockups remain in active product surfaces.
- High-priority routes pass screenshot QA at desktop/tablet/mobile.
- Design tokens are used instead of scattered hardcoded values.
- Chinese localization follows `稳 / 准 / 省 / 善 / 通` with concrete evidence.
