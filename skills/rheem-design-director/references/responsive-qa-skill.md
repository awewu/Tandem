# Responsive QA Skill Module

Use this module to verify Rheem UI across mobile, tablet, and desktop after design or frontend implementation.

## Default Viewports

- Mobile: `390x844`
- Tablet: `768x1024`
- Desktop: `1440x1000`

Add project-specific widths when the layout suggests breakpoints.

## Required Checks

- No body-level horizontal scroll except intentional table wrappers.
- Header/logo/CTA do not collide.
- Chinese labels do not overflow buttons, tabs, badges, or cards.
- Metric values fit without resizing neighboring panels.
- Tables scroll inside containers on mobile.
- Sidebars collapse or become horizontal/stacked navigation.
- Hero content leaves next content visible on ordinary laptop sizes when used as a website hero.
- Dialogs fit mobile width and keep actions visible.
- Form labels, units, validation, and help text remain readable.
- Focus states and active states remain visible at all sizes.

## Rheem-Specific Checks

- Official badge remains proportionate.
- Red is not overused after stacking on mobile.
- Chinese anchors such as `稳供`, `定规`, `善度`, `通达`, `安心` remain paired with explanatory evidence.
- Commercial support/document paths are not pushed below irrelevant decorative content.
- Product/spec tables retain scanability.

## Failure Patterns

Fix immediately:

- Text clipping in Chinese labels.
- Card grids that become narrow unreadable columns.
- CTA row overflow.
- Hero image/text overlap.
- Badges wrapping into awkward isolated characters.
- Tables causing page-level horizontal scroll.
- Logo stretching or remote logo failing silently.

## QA Report

For each viewport, record:

- Pass/fail.
- Screenshot path if available.
- Issues found.
- Fixes applied.
- Residual risk.

Do not approve a screen if any viewport has visible overlap or unreadable primary actions.
