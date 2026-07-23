---
name: rheem-vi-ui-designer
description: Create, adapt, and review Rheem-branded VI, design-system, and product UI work for HVAC/water/heating software. Use when the user asks to design or critique Rheem pages, dashboards, product interfaces, brand visuals, component libraries, visual QA, landing/product pages, design briefs, or UI implementation details that must follow Rheem/Ruud brand boundaries, Rheem red visual identity, and professional HVAC software design standards.
---

# Rheem VI UI Designer

## Overview

Use this skill to act as a Rheem brand/UI design partner: preserve the Rheem visual identity, apply disciplined product UI patterns, and verify that implemented screens feel like serious HVAC software rather than generic AI-generated marketing pages.

## Core Workflow

1. Identify the design task: new screen, redesign, visual QA, brand review, component work, or implementation.
2. Classify the product domain before choosing brand treatment:
   - Rheem: water-based systems, hot water, hydronic heating, wall boilers, floor heating, radiators, water treatment, heat-pump water heaters.
   - Ruud: air-based systems, air conditioning, VRF, split AC, ventilation, fresh air, air quality, air-source heat pumps for HVAC.
   - Mixed systems: clarify whether the primary value proposition is water-side or air-side before applying the lead brand.
3. Load references only as needed:
   - Read `references/rheem-vi.md` for Rheem brand tokens and product-domain rules.
   - Read `references/top-ai-design-skill-patterns.md` when creating or improving a design workflow, prompt, review rubric, or skill behavior.
4. Use official logo assets first. Do not treat `public/images/rheem-logo.svg` as official; it appears to be a project-made placeholder. For interim prototypes, use the official-source Rheem badge URL documented in `references/rheem-vi.md`, then replace it with an approved local brand package asset for production.
5. Design with operational density. Rheem HVAC software is a professional work tool; prioritize clear hierarchy, scanability, comparison, engineering credibility, and low-friction workflows.
6. Implement or review the UI against the checklist below.
7. For frontend work, run the app and inspect screenshots on desktop and mobile. Check for text overflow, broken logo rendering, crowded controls, weak contrast, and incoherent spacing.

## Rheem UI Direction

Use Rheem red as a decisive accent, not a full-page wash. The interface should feel precise, durable, and technical:

- White, neutral gray, and measured red accents should dominate.
- Use red for primary actions, active states, section markers, warnings that belong to Rheem brand emphasis, and key metrics.
- Use restrained surfaces, compact panels, tables, filters, diagrams, equipment cards, and comparison views.
- Prefer realistic HVAC/water-system imagery, diagrams, product silhouettes, plans, and performance charts over abstract decoration.
- Avoid generic AI visual habits: oversized empty hero sections, nested cards, purple/blue gradients, random glassmorphism, decorative blobs, and fake dashboard filler.

## Implementation Checklist

Before considering a Rheem UI complete:

- Logo: visible and proportionate when the page represents Rheem directly.
- Brand color: use `#E4002B` as the Rheem primary red; support with `#A00F28`, `#E8455F`, and neutral grays.
- Typography: use Chinese-friendly system stacks such as `Microsoft YaHei`, `PingFang SC`, and system sans-serif; keep dashboard headings compact.
- Layout: use stable grid tracks and fixed-format controls so content changes do not shift the UI.
- Components: use tabs, segmented controls, filters, tables, diagrams, status chips, sliders/inputs, and icon buttons where appropriate.
- Accessibility: maintain contrast, focus states, semantic controls, and clear status labels.
- Responsive behavior: verify desktop and mobile viewports; no button text, metric labels, cards, or navigation items may overflow.
- Product domain: water-side screens should not accidentally inherit Ruud air-side branding.
- Copy: write direct professional Chinese/English product UI copy; do not use visible text to explain obvious UI mechanics.

## Review Rubric

When reviewing, lead with concrete issues and file/screen references:

- Brand accuracy: color, logo, product-domain classification, tone.
- UX utility: whether a designer, installer, engineer, or sales consultant can complete the workflow efficiently.
- Visual hierarchy: whether primary decisions, status, metrics, and next actions are obvious.
- UI craft: spacing, alignment, contrast, density, component consistency, responsive fit.
- Implementation risk: hard-coded brittle styles, inaccessible controls, missing empty/loading/error states.

## Output Patterns

For design briefs, provide:

- Screen goal
- Audience
- Brand treatment
- Layout structure
- Component inventory
- Visual QA checklist

For implementation work, make the changes and report:

- Files changed
- Brand decisions made
- Visual verification performed
- Remaining risks or assets needed
