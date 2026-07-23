<!-- ⚠️ DEPRECATED 2026-07-03: 内容已整合入 skills/rheem-design-director/references/RHEEM-VI-STANDARD.md，以该文件为准。-->

# VI Brand System Skill Module

Use this module for Rheem brand identity, logo usage, color, typography, icon/image style, Chinese naming, and design tokens.

## Source Priority

1. Official Rheem brand package or brand standards.
2. Official rheem.com pages and official PDFs.
3. Official-source logo references documented in `rheem-official-vi.md`.
4. Local project files only as implementation, never as brand authority.

## Non-Negotiables

- Rheem primary red: `#E4002B`.
- Use the official red circular Rheem badge with white lettering.
- Do not use the old local flame/Chinese/`Since 1925` lockup.
- Do not redraw, recolor, stretch, rotate, crop, or combine the logo into a new Chinese lockup.
- Do not call local placeholders official.

## Palette Roles

- Red: brand identity, primary action, active state, urgent commercial path.
- Navy/blue: engineering authority, specs, documentation, professional navigation.
- Gray: work surfaces, tables, secondary copy, parameters.
- Teal: water/system continuity, support ecology.
- Green: efficiency, sustainability, savings, low-carbon.
- Orange: rebates, warnings, pending checks.

## Typography

- Use Chinese-friendly system sans-serif for product UI.
- Keep headings direct, not decorative.
- Use compact labels in dashboards and tables.
- Avoid font novelty unless producing a marketing concept with explicit approval.

## Icon And Image Style

Prefer:

- Product photos, equipment silhouettes, installation contexts, system diagrams.
- Technical line icons with consistent stroke.
- Diagrammatic water/energy/document/support motifs.

Avoid:

- Abstract AI gradients, bokeh, decorative blobs, fake 3D tech shapes.
- Flame icons as unofficial Rheem identity.
- Cute consumer illustrations in professional/commercial contexts.

## Chinese Brand Language

Read `rheem-chinese-localization.md`.

Use:

- `稳供`: endless hot water / reliability.
- `定规`: products, specs, engineering documents.
- `善度`: sustainability and efficiency.
- `通达`: expert support and service path.
- `安心`: warranties, protection, peace of mind.

Each anchor must have a concrete subtitle or metric.

## Token Output

When asked to produce VI tokens, output three layers:

- Primitive: raw official colors/type/radius.
- Semantic: purpose tokens such as `action.primary`, `surface.panel`, `domain.commercial`.
- Component: `button.primary.bg`, `badge.warning.fg`, `table.header.bg`.
