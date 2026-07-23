# Visual Audit Agent Module

Use this module to critique Rheem UI visually after a concept, screenshot, or implementation exists.

## Audit Inputs

- Screenshot or live page.
- Target user and page purpose.
- Relevant references:
  - `rheem-official-vi.md`
  - `rheem-chinese-localization.md`
  - `rheem-design-system-standard.md`
  - `responsive-qa-skill.md`

## Scorecard

Score 0-5:

- Brand accuracy: official logo, official red, palette roles, no fake lockups.
- Rheem voice: reliability, efficiency, sustainability, expert support.
- Chinese localization: flavor, compactness, concrete evidence.
- Information hierarchy: primary action/status/evidence visible.
- Component consistency: buttons, badges, cards, panels, tables.
- Responsive fit: no overlap, clipping, or layout drift.
- Accessibility: contrast, focus, labels, status semantics.
- Anti-generic distinctiveness: does not look like a random AI SaaS template.

Any score under 4 requires revision.

## Audit Method

1. Identify the screen type: official-site page, commercial solution, workbench, residential page, component sheet.
2. Compare against the matching archetype.
3. Flag the highest-risk issues first.
4. Separate brand violations from ordinary UI polish.
5. Propose concrete fixes tied to tokens or components.

## Brand Violations

Treat as severe:

- Wrong logo or recreated logo.
- Old `#C41230` presented as official Rheem red.
- Unapproved Chinese/English lockup.
- Flame icon used as Rheem identity.
- Purple/blue gradient tech styling.
- Abstract decoration replacing product/support evidence.

## Professionalism Issues

Treat as medium/high:

- Random cards without workflow purpose.
- Weak CTA hierarchy.
- Overuse of red.
- Low-density generic hero for a professional tool.
- Product or document path missing from commercial screens.
- Chinese copy sounds ceremonial, empty, or too consumer-flashy.

## Output Format

Lead with findings:

- Severity
- Screen area
- Issue
- Why it violates Rheem standard
- Fix

Then give score summary and approval status.
