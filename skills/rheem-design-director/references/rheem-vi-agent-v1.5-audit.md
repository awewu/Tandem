# Rheem VI Agent V1.5 Self-Audit

Audit target:

- Skill: `skills/rheem-design-director/SKILL.md`
- Sample: `public/rheem-vi-ui-sample.html`
- Date: 2026-06-06

## Summary

V1.5 is usable as a Rheem VI/UI design director for concepting, critique, component planning, localized Chinese copy, frontend implementation guidance, and responsive/visual QA planning.

It is not yet a production-certified brand package because the approved internal Rheem logo asset is not present locally. The sample uses a remote official-source badge reference for prototype evidence and blocks the previous fake local logo.

## Evidence Basis

The agent standard uses:

- Rheem official public site page families: homeowners, commercial, professionals, products, warranties, rebates/tax credits, sustainability, help/support, document finder.
- Rheem Brand Standards evidence for Rheem Red `#E4002B`.
- Official-source Rheem badge URL for prototypes.
- Local project constraints and Chinese HVAC software context.

## V1.5 Deliverables

### Completed

- `rheem-design-director` total-control skill.
- Six specialist modules:
  - `ui-design-skill.md`
  - `vi-brand-system-skill.md`
  - `frontend-implementation-skill.md`
  - `responsive-qa-skill.md`
  - `visual-audit-agent.md`
  - `design-system-agent.md`
- Official VI baseline:
  - `rheem-official-vi.md`
  - `rheem-design-system-standard.md`
  - `ui-architecture-benchmark.md`
  - `ai-design-toolchain.md`
- Chinese localization standard:
  - `rheem-chinese-localization.md`
- Sample page:
  - `public/rheem-vi-ui-sample.html`

## Sample Audit

### Brand Accuracy

Score: 4.3 / 5

Pass:

- Uses Rheem Red `#E4002B`.
- Blocks old local flame/Chinese/`Since 1925` logo.
- Uses remote official-source Rheem badge URL for prototype.
- Avoids fake Chinese lockup inside logo.

Gate:

- Production still needs approved local Rheem brand package SVG.

### Rheem Voice

Score: 4.5 / 5

Pass:

- Communicates commercial uptime, hot-water continuity, expert support, documents, specs, rebates, warranty, and sustainability.
- Uses direct benefit language rather than abstract technology language.

Improve:

- V2 should add screenshots and more exact copy examples from all rheem.com page families.

### Chinese Localization

Score: 4.6 / 5

Pass:

- Uses the `稳 / 准 / 省 / 善 / 通` localization frame.
- Adds concrete evidence under poetic anchors:
  - `稳供`
  - `定规`
  - `善度`
  - `通达`
  - `待核`
  - `安心`

Improve:

- Add residential Chinese variants for homeowner-facing pages.
- Add official product-name glossary when product catalogs are finalized.

### Design System

Score: 4.2 / 5

Pass:

- Defines palette tokens.
- Demonstrates buttons, badges, metrics, tables, inputs, alerts, panels, and role tabs.
- Avoids nested cards and red overload.

Improve:

- Convert sample tokens into reusable CSS package or JSON token file.
- Add component variants and states as real reusable code.

### Responsive Readiness

Score: 4.0 / 5

Pass:

- Defines breakpoints for desktop/tablet/mobile.
- Uses grid collapse, table wrapper scroll, flexible header, and responsive language grids.

Gate:

- Browser screenshot automation for `file://` was blocked earlier by in-app browser policy. Use local server or approved browser path for screenshot-backed QA.

### Anti-Generic Distinctiveness

Score: 4.4 / 5

Pass:

- Evidence-first UI distinguishes it from generic SaaS dashboard pages.
- Chinese anchors create localized brand flavor without fake logo manipulation.
- Avoids purple gradients, generic glass panels, and decorative blob identity.

Improve:

- Add real product/system imagery or official product photography once approved assets are available.

## V1.5 Acceptance Gate Result

Status: Pass with production logo gate.

This agent can now:

- Guide Rheem VI/UI design decisions.
- Produce or critique localized Chinese UI concepts.
- Specify tokens and components.
- Guide implementation.
- Define responsive and visual QA.

This agent must not:

- Claim the local logo asset is approved.
- Treat the sample as production brand certification.
- Skip screenshot QA for production pages.

## Browser QA Evidence

Local static preview:

- `http://localhost:4177/rheem-vi-ui-sample.html`

Playwright viewport checks:

| Viewport | Width | Body scroll width | Old `#C41230` | Logo source | Result |
| --- | ---: | ---: | --- | --- | --- |
| Desktop | 1440 | 1440 | Not present | Remote official-source badge loaded | Pass |
| Tablet | 768 | 768 | Not present | Remote official-source badge loaded | Pass |
| Mobile | 390 | 390 | Not present | Remote logo did not complete during one run | Pass layout, logo reliability gate |

Notes:

- No page-level horizontal overflow was detected in the checked viewports.
- The sample source intentionally mentions `/images/rheem-logo.svg` only as a blocked local-logo path, so automated string checks may flag it as text evidence rather than active image usage.
- Production should use an approved local Rheem brand package asset to remove remote-logo loading risk.

## V2 Requirements

To reach brand-department production readiness:

- Crawl and screenshot representative rheem.com pages across all major page families.
- Extract CSS/image/type evidence from official pages where technically available.
- Replace remote prototype logo with approved local brand package asset.
- Create reusable Rheem token JSON/CSS.
- Create component examples for React/shadcn or the project's chosen UI stack.
- Run screenshot QA at mobile, tablet, and desktop.
- Run full-repo migration for old `#C41230`, old logo references, fake flames, and generic red gradients.

## Production Follow-Up

Production work has started in:

- `rhautt-production-migration.md`
- `public/css/rheem-official-tokens.css`
- `public/design-tokens/rheem-official.tokens.json`
- `scripts/agent-guards/rheem-vi-production-audit.js`

The full Rhautt project remains blocked until the production audit and approved logo gate pass.
