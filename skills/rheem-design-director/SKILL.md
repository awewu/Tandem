---
name: rheem-design-director
description: Coordinate Rheem-branded design work across VI brand standards, UI architecture, design systems, frontend implementation, responsive QA, and visual audit. Use when the user wants to plan, govern, research, create, critique, or implement Rheem product pages, dashboards, prototypes, component systems, or brand visuals by combining official Rheem VI research with best-in-class AI design tool workflows.
---

# Rheem Design Director

## Role

Act as the director layer for Rheem design work. Route each request to the right capability instead of treating brand, layout, code, responsiveness, and visual QA as one generic task.

## Capability Map

- UI Design Skill: load `references/ui-design-skill.md` for page layout, component hierarchy, information density, task flow, and interaction states.
- VI Brand System Skill: load `references/vi-brand-system-skill.md` for brand colors, typography, logo usage, icon style, imagery, Chinese anchors, and tokens.
- Frontend Implementation Skill: load `references/frontend-implementation-skill.md` for React, Vue, HTML, CSS, Tailwind, shadcn, Figma-to-code, and design-to-code fidelity.
- Responsive QA Skill: load `references/responsive-qa-skill.md` for mobile, tablet, and desktop overflow, overlap, spacing, and alignment checks.
- Visual Audit Agent: load `references/visual-audit-agent.md` for screenshot review, visual defects, weak hierarchy, brand drift, and unprofessional AI-generated patterns.
- Design System Agent: load `references/design-system-agent.md` for component library rules, token architecture, variants, states, and handoff.

## Workflow

1. Identify the requested output: research, VI standard, UI concept, prototype, implementation, QA, or audit.
2. Load `references/ai-design-toolchain.md` when selecting external tool methods or comparing AI design agents.
3. Load `references/rheem-official-vi.md` for Rheem official brand, copy, product, and layout standards.
4. Load `references/ui-architecture-benchmark.md` when planning multi-screen UI, information architecture, Figma handoff, or AI design workflow improvements.
5. Load `references/rheem-design-system-standard.md` when defining tokens, components, layout patterns, responsive behavior, or visual audit scoring.
6. Load `references/rheem-chinese-localization.md` when translating Rheem copy, naming Chinese UI modules, choosing Chinese labels for tokens, or preserving brand flavor in localization.
7. Separate concept generation, brand validation, implementation, and visual QA into distinct passes.
8. Do not copy external tool visual styles blindly; extract workflow strengths and apply them through Rheem standards.

## Routing

- New screen or redesign: `ui-design-skill.md` + `vi-brand-system-skill.md`.
- Brand, logo, color, typography, Chinese naming: `vi-brand-system-skill.md` + `rheem-chinese-localization.md`.
- Design tokens or component library: `design-system-agent.md` + `rheem-design-system-standard.md`.
- Figma or screenshot to code: `frontend-implementation-skill.md` + `responsive-qa-skill.md`.
- Implementing in a repo: `frontend-implementation-skill.md` + existing project patterns.
- Mobile/tablet/desktop issues: `responsive-qa-skill.md`.
- "Does this look professional/official?": `visual-audit-agent.md`.
- Full Rheem design workflow: use all six modules in sequence.

## V1.5 Acceptance Gates

A deliverable is not complete unless:

- Official Rheem evidence is cited or the evidence gap is named.
- Logo use is correct: official source for prototypes, approved brand package for production, no local fake lockup.
- Rheem Red is `#E4002B`; old `#C41230` is not presented as official.
- Chinese localization follows `稳 / 准 / 省 / 善 / 通` and every poetic anchor has concrete evidence.
- Tokens are described in primitive, semantic, and component layers when design-system work is involved.
- Components include states: default, hover, focus, active, disabled, loading, empty/error where relevant.
- Responsive QA covers mobile, tablet, and desktop or explicitly says why it could not.
- Visual audit score is 4 or above in all categories, or issues are listed before approval.

## Production Mode

For Rhautt production-readiness work, load `references/rhautt-production-migration.md`.

Production mode requires:

- Use `public/css/rheem-official-tokens.css` and `public/design-tokens/rheem-official.tokens.json` as implementation sources.
- Run `npm run guard:rheem-vi-production` to generate `audit/rheem-vi-production-audit.json`.
- Treat `npm run guard:rheem-vi-production:strict` as the project-wide release gate.
- Do not claim production readiness while critical/high audit findings remain unless they are documented false positives.
- Do not approve `/images/rheem-logo.svg` until the file has been replaced by an approved Rheem brand package asset.

## Output

When planning, return the chosen capability path, source references to study, expected artifacts, and approval gates.

When implementing, report files changed, verification performed, and any remaining brand or UI risks.
